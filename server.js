const cookieparser = require('cookie-parser')
const querystring = require('querystring')
const compression = require('compression')
const CronJob = require('cron').CronJob
const mongoose = require('mongoose')
const express = require('express')
const request = require('request')
const helmet = require('helmet')
const { join } = require('path')
const cors = require('cors')
require('dotenv').config()

if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
  console.log(`Create the '.env' file with your CLIENT_ID and CLIENT_SECRET`)
  process.exit(1)
}

// Models
let Users = mongoose.model('Users', new mongoose.Schema({}, { strict: false, versionKey: false, timestamps: true }))
let Tracks = mongoose.model('Tracks', new mongoose.Schema({}, { strict: false, versionKey: false, timestamps: true }))

// Spotify Dashboard variables
let stateKey = 'spotify_auth_state' // Which type of key
let redirectUri = process.env.API_HOST || 'http://localhost:8888/callback' // Your redirect uri (should be registered on my dashboard)
let bufferAuth = (Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'))

let generateRandomString = (length) => {
  let text = ''
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

let app = express()
app.use(cors())
app.use(helmet())
app.use(compression())
app.use(cookieparser())

app.use(express.static(join(__dirname, '/public'))) // Static files
app.use('/bootstrap', express.static(`${__dirname}/node_modules/bootstrap/dist`))
app.use('/handlebars', express.static(`${__dirname}/node_modules/handlebars/dist`))
app.use('/jquery', express.static(`${__dirname}/node_modules/jquery/dist`))
app.use('/popper', express.static(`${__dirname}/node_modules/popper.js/dist/umd`))

app.get('/login', (req, res) => {
  let state = generateRandomString(16)
  res.cookie(stateKey, state)
  res.redirect('https://accounts.spotify.com/authorize?' + // your application requests authorization
    querystring.stringify({
      response_type: 'code',
      client_id: process.env.CLIENT_ID,
      scope: 'user-read-private user-read-email user-read-recently-played',
      redirect_uri: redirectUri,
      state: state
    }))
})

app.get('/callback', (req, res) => { // your application requests refresh and access token after checking the state parameter
  let code = req.query.code || null
  let state = req.query.state || null
  let storedState = req.cookies ? req.cookies[stateKey] : null
  if (state === null || state !== storedState) {
    res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }))
  } else {
    res.clearCookie(stateKey)
    let authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      },
      headers: { Authorization: 'Basic ' + bufferAuth },
      json: true
    }
    request.post(authOptions, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        let accessToken = body.access_token
        let refreshToken = body.refresh_token
        let expireToken = Date.now() + body.expires_in - 300 // When token expires (-300 === expire 5 minutes before)
        let options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { Authorization: 'Bearer ' + accessToken },
          json: true
        }
        request.get(options, (error, response, body) => { // use the access token to access the Spotify Web API
          if (error) { // Handling error
            return console.log(error)
          }
          let newDoc = { ...body, accessToken, refreshToken, expireToken }
          Users.findOneAndUpdate({ id: body.id }, newDoc, { upsert: true }).lean().exec()
            .then(data => {
              if (!data) console.log('New user created!', newDoc.display_name)
              else console.log('Existing user updated!', data.display_name)
            })
            .catch(err => { console.log(err) })
        })
        res.redirect('/#' + querystring.stringify({ access_token: accessToken })) // we can also pass the token to the browser to make requests from there
      } else {
        res.redirect('/#' + querystring.stringify({ error: 'invalid_token' }))
      }
    })
  }
})

app.get('/refresh_token', (req, res) => {
  let authOptions = { // requesting access token using refresh token
    url: 'https://accounts.spotify.com/api/token',
    headers: { Authorization: `Basic ${bufferAuth}` },
    form: {
      grant_type: 'refresh_token',
      refresh_token: req.query.refresh_token
    },
    json: true
  }
  request.post(authOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      res.status(200).send({ access_token: body.access_token })
    } else {
      res.status(500).send({ message: 'Can\'t refresh your token' })
    }
  })
})

let lastPlayedTracks = (options, user, res = false) => { // Responding request
  console.log(new Date(Date.now()).toLocaleString())
  options.url = 'https://api.spotify.com/v1/me/player/recently-played?limit=25'
  request.get(options, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      response.body.items.forEach(element => {
        try { // Deleting trash data
          element.user = user
          if (element != null) {
            if (element.track != null) {
              if (element.track.explicit) delete element.track.explicit // If equals false won't be deleted
              if (element.track.explicit === false) delete element.track.explicit // Delete if equals false
              if (element.track.is_local) delete element.track.is_local // If equals false won't be deleted
              if (element.track.is_local === false) delete element.track.is_local // Delete if equals false
              if (element.track.available_markets) delete element.track.available_markets
              if (element.track.album != null) {
                if (element.track.album.available_markets) delete element.track.album.available_markets
              }
            }
          }
        } catch (err) {
          console.log(`Deletion error: ${err}`)
        }
        Tracks.findOneAndUpdate({ played_at: element.played_at }, element, { upsert: true }).lean().exec() // Saving to DB
          .then(data => {
            if (!data) console.log('- New track, added to DB!', element.track.name, element.played_at)
            else console.log('- Track was already on DB!', data.track.name, data.played_at)
          })
          .catch(err => {
            console.log(err)
          })
      })
      if (res) {
        response.body.items.forEach(track => { // Formatting date
          if (track.played_at) {
            try {
              let mm = new Date(track.played_at).getMonth() + 1 // Month
              let dd = new Date(track.played_at).getDate() // Day
              let newDate = [
                (mm > 9 ? '' : '0') + mm + '/',
                (dd > 9 ? '' : '0') + dd + '/',
                new Date(track.played_at).getFullYear()
              ].join('')
              track.played_at = newDate
            } catch (error) {
              console.log('error parsing date', error)
            }
          }
        })
        res.send(response)
      }
    } else {
      if (res) res.send(error)
      console.log('Error', error)
    }
  })
}

app.get('/last_played', (req, res) => { // Getting tracks from frontend
  Users.findOne({ accessToken: req.query.access_token }).lean().exec()
    .then(data => {
      if (!data) {
        return res.status(418).send('Please login again')
      }
      lastPlayedTracks({
        headers: { Authorization: 'Bearer ' + req.query.access_token },
        json: true
      }, data.id || 'Undefined', res)
    })
    .catch(err => {
      res.status(500).send('Error interno del servidor')
      console.log('Error getting last played', err)
    })
})

app.get('/my_history', async (req, res) => {
  if (!req.query.page) { // Handling query.page // Aditional param is required
    return res.status(404).send('Send me a valid page')
  }
  let pagination = Number(req.query.page)
  if (isNaN(pagination)) { // Aditional param is required
    return res.status(404).send('Your page is not a number')
  }
  pagination = Math.round(pagination)
  if (pagination < 1) pagination = 1
  let skip = 0
  let limit = 20
  if (pagination > 1) skip = ((pagination * limit) - limit)
  if (!req.query.access_token) { // Handling query.page.access_token // Aditional param is required
    return res.status(404).send('Send me a valid access_token')
  }
  let user = await Users.findOne({ accessToken: req.query.access_token }, 'id -_id').lean().exec() // Getting user id from DB
  if (!user) { // Your access token has probably expired
    return res.status(418).send('Please login again')
  }
  if (!user.id) { // You have no id on DB
    return res.status(500).send('You should contact the app admin')
  }
  let filter = { user: user.id } // Getting tracks && documents length
  let music = await Tracks.find(filter, '-_id -createdAt -updatedAt -context', { skip, limit, sort: { played_at: -1 } }).lean().exec()
  if (!music) { // No music with your id
    return res.status(404).send('You have no music')
  }
  let count = await Tracks.countDocuments(filter).lean().exec() // Counting songs number
  if (count === 0) {
    count = 1
  }
  if (!count) {
    return res.status(500).send('Error counting your music')
  }
  let body = [] // Declare empty array
  music.forEach(el => { // Iterate for each music
    let obj = {} // Create clean object
    try { // played_at
      obj.played_at = el.played_at
    } catch (error) {
      obj.played_at = 'Undefined'
    }
    try { // Formatting played_at
      let mm = new Date(obj.played_at).getMonth() + 1 // Month
      let dd = new Date(obj.played_at).getDate() // Day
      let newDate = [
        (mm > 9 ? '' : '0') + mm + '/',
        (dd > 9 ? '' : '0') + dd + '/',
        new Date(obj.played_at).getFullYear()
      ].join('')
      obj.played_at = newDate
    } catch (error) {
      console.log('error parsing date', error)
    }
    try { // track name
      obj.name = el.track.name
    } catch (error) {
      obj.name = 'Undefined'
    }
    try { // url
      let url = el.track.uri.split(':')
      obj.url = 'https://open.spotify.com/' + url[1] + '/' + url[2]
    } catch (error) {
      obj.uri = 'Undefined'
    }
    try { // artist
      let str = ''
      for (let i = 0; i < el.track.artists.length; i++) {
        str += el.track.artists[i].name
        if (i + 1 !== el.track.artists.length) str += ', '
      }
      obj.artist = str
    } catch (error) {
      obj.artist = 'Undefined'
    }
    try { // image
      obj.img = el.track.album.images[el.track.album.images.length - 1].url
    } catch (error) {
      obj.img = 'favicon-32x32.png'
    }
    body.push(obj) // Push to array
  })
  let nav = [] // Create nav array
  let navigation = Math.ceil(count / limit) // Calculating navigation
  if (navigation < 6) { // Creating navigation array
    for (let i = 0; i < navigation; i++) {
      nav.push(i + 1)
    }
  } else if (pagination === 1 || pagination === 2) {
    nav = [1, 2, 3, 4, 5]
  } else if (pagination === navigation - 1) {
    nav = [pagination - 3, pagination - 2, pagination - 1, pagination, pagination + 1]
  } else if (pagination === navigation) {
    nav = [pagination - 4, pagination - 3, pagination - 2, pagination - 1, pagination]
  } else { // Has the at least 2 options on both sides
    nav = [pagination - 2, pagination - 1, pagination, pagination + 1, pagination + 2]
  }
  res.status(200).send({ count, body, nav, navigation }) // Send response
})

let cronjob = () => { // CronJob
  console.log('You will see this message every hour')
  Users.find({}).lean().exec()
    .then(data => {
      if (!data) { // If you have no users
        return console.log('You have no users')
      }
      data.forEach(elm => {
        console.log(elm.display_name, elm.id) // Showing username
        let authOptions = { // Refreshing token
          url: 'https://accounts.spotify.com/api/token',
          headers: { Authorization: 'Basic ' + bufferAuth },
          form: {
            grant_type: 'refresh_token',
            refresh_token: elm.refreshToken
          },
          json: true
        }
        request.post(authOptions, (error, response, body) => { // Call spotify to refresh token
          console.log(body)
          if (!error && body.access_token && response.statusCode === 200) {
            lastPlayedTracks({
              headers: { Authorization: 'Bearer ' + body.access_token },
              json: true
            }, elm.id || 'Undefined')
          } else {
            console.log('Can not refresh token', error)
          }
        })
      })
    })
    .catch(err => {
      console.log('Error Users', err)
    })
}

// Mongoose deprecations // https://mongoosejs.com/docs/deprecations.html
mongoose.set('useUnifiedTopology', true)
mongoose.set('useFindAndModify', false)
mongoose.set('useNewUrlParser', true)
mongoose.set('useCreateIndex', true)

let DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/spotify'

mongoose.connect(DATABASE_URL) // Database connection
  .then(() => {
    console.log(`Database on ${DATABASE_URL}`)
    new CronJob('0 0 * * * *', () => { // eslint-disable-line no-new
      cronjob() // Every hour, it has 6 dots, with 1 second as the finest granularity
    }, null, true, 'America/Los_Angeles')
  })
  .then(() => app.listen(8888, () => {
    console.log('Listening on 8888')
  }))
  .catch((error) => {
    console.error('Error at server startup', error)
  })
