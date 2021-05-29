import cookieparser from 'cookie-parser'
import { stringify } from 'querystring'
import compression from 'compression'
import { randomBytes } from 'crypto'
import { CronJob } from 'cron'
import express from 'express'
import request from 'request'
import dotenv from 'dotenv'
import { join } from 'path'
import cors from 'cors'

dotenv.config()

let { connect, model, Schema } = require('mongoose')
let app = express()

if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
  console.log(`Create an '.env' file with your CLIENT_ID and CLIENT_SECRET`)
  process.exit(1)
}

// Models
let Users = model('Users', new Schema({}, { strict: false, versionKey: false, timestamps: true }))
let Tracks = model('Tracks', new Schema({}, { strict: false, versionKey: false, timestamps: true }))

// Spotify Dashboard variables
let PORT = 8888
let stateKey = 'spotify_auth_state'
let redirUri = process.env.API_HOST || `http://localhost:${PORT}/callback`
let buffAuth = (Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64'))

app.use(cors())
app.use(compression())
app.use(cookieparser())
app.use(express.static(join(__dirname, '../public')))

app.get('/login', (_, res) => {
  let state = randomBytes(8).toString('hex')
  res.cookie(stateKey, state)
  let scope = 'user-read-private user-read-email user-read-recently-played'
  res.redirect('https://accounts.spotify.com/authorize?' + stringify({ scope, state, response_type: 'code', redirect_uri: redirUri, client_id: process.env.CLIENT_ID }))
})

app.get('/callback', (req, res) => { // your application requests refresh and access token after checking the state parameter
  let code = req.query.code
  let state = req.query.state
  let storedState = req.cookies ? req.cookies[stateKey] : null
  if (state === null || state !== storedState) {
    res.redirect('/#' + stringify({ error: 'state_mismatch' }))
  } else {
    res.clearCookie(stateKey)
    let authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirUri,
        grant_type: 'authorization_code'
      },
      headers: { Authorization: `Basic ${buffAuth}` },
      json: true
    }
    request.post(authOptions, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        let accessToken = body.access_token
        let refreshToken = body.refresh_token
        let expireToken = Date.now() + body.expires_in - 300 // When token expires (-300 === expire 5 minutes before)
        let options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { Authorization: `Bearer ${accessToken}` },
          json: true
        }
        request.get(options, (error, response, body) => { // use the access token to access the Spotify Web API
          if (error) return console.log({ error })
          let newDocument = { ...body, accessToken, refreshToken, expireToken, activeCronjob: true }
          Users.findOneAndUpdate({ id: body.id }, newDocument, { upsert: true }).lean().exec()
            .then(data => {
              if (!data) console.log('New user created!', newDocument.display_name)
              else console.log('Existing user updated!', data.display_name)
            })
            .catch(error => {
              console.log({ error })
            })
        })
        res.redirect('/#' + stringify({ access_token: accessToken })) // we can also pass the token to the browser to make requests from there
      } else {
        res.redirect('/#' + stringify({ error: 'invalid_token' }))
      }
    })
  }
})

const formatDate = (date: Date) => {
  let mm = new Date(date).getMonth() + 1 // Month
  let dd = new Date(date).getDate() // Day
  let newDate = [
    (mm > 9 ? '' : '0') + mm + '/',
    (dd > 9 ? '' : '0') + dd + '/',
    new Date(date).getFullYear()
  ].join('')
  return newDate
}

const cleanUser = (element: any) => {
  try {
    delete element.track.explicit
  } catch (error) {
    console.error({ error })
  }
  try {
    delete element.track.is_local
  } catch (error) {
    console.error({ error })
  }
  try {
    delete element.track.available_markets
  } catch (error) {
    console.error({ error })
  }
  try {
    delete element.track.album.available_markets
  } catch (error) {
    console.error({ error })
  }
  return element
}

let lastPlayedTracks = (options, user) => { // Responding request
  options.url = 'https://api.spotify.com/v1/me/player/recently-played?limit=20'
  request.get(options, (error:any, response:any) => {
    if (!error && response.statusCode === 200) {
      response.body.items.forEach((element:any) => {
        element.user = user
        element = cleanUser(element)
        Tracks.findOneAndUpdate({ played_at: element.played_at }, element, { upsert: true }).lean().exec()
          .then((data:any) => {
            if (!data) console.log('- New track, added to DB!', element.track.name, element.played_at)
            else console.log('- Track was already on DB!', data.track.name, data.played_at)
          })
          .catch((error:any) => console.log({ error }))
      })
    } else {
      console.log('Error', { error })
    }
  })
}

app.get('/last_played', (req, res) => {
  Users.findOne({ accessToken: req.query.access_token }).lean().exec()
    .then((data:any) => {
      if (!data) return res.status(418).send('Please login again')
      lastPlayedTracks({ headers: { Authorization: `Bearer ${req.query.access_token}` }, json: true }, data.id)
      res.status(200).send('Hi')
    })
    .catch((error:any) => {
      console.log('Error getting last played', { error })
      res.status(500).send('Error interno del servidor')
    })
})

app.get('/my_history', async (req, res) => {
  if (!req.query.page) return res.status(404).send('Send me a valid page, additional param is required') // Handling query.page
  let pagination = Number(req.query.page)
  if (isNaN(pagination)) return res.status(404).send('Your page is not a number, a valid param is required')
  pagination = Math.round(pagination)
  if (pagination < 1) pagination = 1
  let skip = 0
  let limit = 20
  if (pagination > 1) skip = ((pagination * limit) - limit)
  if (!req.query.access_token) return res.status(404).send('Send me a valid access_token, a valid param is required') // Handling query.page.access_token
  let user = await Users.findOne({ accessToken: req.query.access_token }, 'id -_id').lean().exec() // Getting user id from DB
  if (!user) return res.status(418).send('Please login again') // Your access token has probably expired
  if (!user.id) return res.status(500).send('You should contact the app admin') // You have no id on DB
  let filter = { user: user.id } // Getting tracks && documents length
  let music = await Tracks.find(filter, '-_id -createdAt -updatedAt -context', { skip, limit, sort: { played_at: -1 } }).lean().exec()
  if (!music) return res.status(404).send('You have no music') // No music with your id
  let count = await Tracks.countDocuments(filter).lean().exec() // Counting songs number
  if (count === 0) count = 1
  if (!count) return res.status(500).send('Error counting your music')
  let body = [] // Declare empty array
  music.forEach((el: any) => { // Iterate for each music
    let obj = {
      name: el.track.name,
      played_at: el.played_at,
      url: 'https://open.spotify.com/' + el.track.uri.split(':')[1] + '/' + el.track.uri.split(':')[2],
      artist: '',
      img: 'favicon.png'
    }
    try {
      obj.played_at = formatDate(obj.played_at)
    } catch (error) {
      console.log('error parsing date', error)
    }
    try {
      let str = ''
      for (let i = 0; i < el.track.artists.length; i++) {
        str += el.track.artists[i].name
        if (i + 1 !== el.track.artists.length) str += ', '
      }
      obj.artist = str
    } catch (error) {
      console.log({ error })
    }
    try {
      obj.img = el.track.album.images[el.track.album.images.length - 1].url
    } catch (error) {
      console.log({ error })
    }
    body.push(obj) // Push to array
  })
  let nav: Array<number> = [] // Create nav array
  let navigation = Math.ceil(count / limit) // Calculating navigation
  // Creating navigation array
  if (navigation < 6) for (let i = 0; i < navigation; i++) { nav.push(i + 1); }
  else if (pagination === 1 || pagination === 2) nav = [1, 2, 3, 4, 5]
  else if (pagination === navigation - 1) nav = [pagination - 3, pagination - 2, pagination - 1, pagination, pagination + 1]
  else if (pagination === navigation) nav = [pagination - 4, pagination - 3, pagination - 2, pagination - 1, pagination]
  else nav = [pagination - 2, pagination - 1, pagination, pagination + 1, pagination + 2] // Has at least 2 options on both sides
  res.status(200).send({ count, body, nav, navigation }) // Send response
})

let cronjob = () => {
  console.log('You will see this message every hour')
  Users.find({ activeCronjob: true }).lean().exec()
    .then(data => {
      if (!data) return console.log('You have no users') // If you have no users
      data.forEach(userFromCron => {
        console.log(`${userFromCron.display_name} - ${userFromCron.id}`)
        let authOptions = { // Refreshing token
          url: 'https://accounts.spotify.com/api/token',
          headers: { Authorization: `Basic ${buffAuth}` },
          form: {
            grant_type: 'refresh_token',
            refresh_token: userFromCron.refreshToken
          },
          json: true
        }
        request.post(authOptions, (error, response, body) => { // Call spotify to refresh token
          console.log(body)
          if (!error && body.access_token && response.statusCode === 200) {
            lastPlayedTracks({ headers: { Authorization: `Bearer ${body.access_token}` }, json: true }, userFromCron.id)
          } else {
            console.log(`Can't refresh token`, { error })
          }
        })
      })
    })
    .catch(error => {
      console.log('Error Users', { error })
    })
}

let DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/spotify'

connect(DATABASE_URL, { useCreateIndex: true, useNewUrlParser: true, useFindAndModify: false, useUnifiedTopology: true })
  .then(() => {
    console.log(`Database on ${DATABASE_URL}`)
    new CronJob('0 0 * * * *', () => cronjob(), null, true, 'America/Los_Angeles') // eslint-disable-line no-new
  })
  .then(() => app.listen(PORT, () => {
    console.log(`Listening on ${PORT}`)
  }))
  .catch((error) => {
    console.error('Error at server startup', { error })
  })
