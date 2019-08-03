const cookieParser = require('cookie-parser')
const querystring = require('querystring')
const compression = require('compression') // Compress public folder
const CronJob = require('cron').CronJob
const mongoose = require('mongoose') // MongoDB with schemas framework
const express = require('express') // Express web server framework
const request = require('request') // "Request" library
const helmet = require('helmet')
const { join } = require('path')
const _ = require('underscore')
const cors = require('cors')

// Models
var Users = require('./models/users')
var Tracks = require('./models/tracks')

// Spotify Dashboard variables
var stateKey = 'spotify_auth_state' // Which type of key
var clientId = '88f6696309ca49ada0261312613bcac0' // Your client id
var clientSecret = 'e55db49b5ff544a78fff96efd3b248c5' // Your secret
var redirectUri = process.env.API_HOST || 'http://localhost:8888/callback' // Your redirect uri (should be registered on my dashboard)
var bufferAuth = (Buffer.from(clientId + ':' + clientSecret).toString('base64'))

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
  var text = ''
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

var app = express()
app.use(cors())
app.use(helmet())
app.use(compression())
app.use(cookieParser())

// Static files
app.use(express.static(join(__dirname, '/public')))
app.use('/bootstrap', express.static(`${__dirname}/node_modules/bootstrap/dist`))
app.use('/handlebars', express.static(`${__dirname}/node_modules/handlebars/dist`))
app.use('/jquery', express.static(`${__dirname}/node_modules/jquery/dist`))
app.use('/underscore', express.static(`${__dirname}/node_modules/underscore`))

app.get('/login', function (req, res) {
  var state = generateRandomString(16)
  res.cookie(stateKey, state)
  // your application requests authorization
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: clientId,
      scope: 'user-read-private user-read-email user-read-recently-played',
      redirect_uri: redirectUri,
      state: state
    }))
})

app.get('/callback', function (req, res) { // your application requests refresh and access token after checking the state parameter
  var code = req.query.code || null
  var state = req.query.state || null
  var storedState = req.cookies ? req.cookies[stateKey] : null

  if (state === null || state !== storedState) {
    res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }))
  } else {
    res.clearCookie(stateKey)
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      },
      headers: { 'Authorization': 'Basic ' + bufferAuth },
      json: true
    }

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        var accessToken = body.access_token
        var refreshToken = body.refresh_token
        var expireToken = Date.now() + body.expires_in - 300 // When token expires (-300 === expire 5 minutes before)

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + accessToken },
          json: true
        }

        // use the access token to access the Spotify Web API
        request.get(options, function (error, response, body) {
          // Handling error
          if (error) {
            console.log(error)
            return
          }
          // console.log(body)
          var newDoc = { ...body, accessToken, refreshToken, expireToken }
          Users.findOneAndUpdate({ id: body.id }, newDoc, { upsert: true }).lean().exec()
            .then(data => {
              if (!data) console.log('User created!', newDoc.display_name) // If is a new user
              else console.log('User updated!', data.display_name) // If user was previously in my app
            })
            .catch(err => { console.log(err) })
        })

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' + querystring.stringify({ access_token: accessToken }))
      } else {
        res.redirect('/#' + querystring.stringify({ error: 'invalid_token' }))
      }
    })
  }
})

app.get('/refresh_token', function (req, res) {
  // requesting access token from refresh token
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + bufferAuth },
    form: {
      grant_type: 'refresh_token',
      refresh_token: req.query.refresh_token
    },
    json: true
  }

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) res.status(200).send({ 'access_token': body.access_token })
    else res.status(500).send({ 'message': 'Can\'t refresh your token' })
  })
})

var last50Tracks = function (options, user, res = false) { // Responding request
  console.log(new Date(Date.now()).toLocaleString())
  request.get(options, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      // Enter new data
      // response.body.items = [
      //   {"_id":{ "$oid": "5cd9ef044a24c1649ea570bd" },"played_at":"2019-05-13T18:42:03.843Z","context":{"uri":"spotify:playlist:37i9dQZF1DZ06evO46wsnu","external_urls":{"spotify":"https://open.spotify.com/playlist/37i9dQZF1DZ06evO46wsnu"},"href":"https://api.spotify.com/v1/playlists/37i9dQZF1DZ06evO46wsnu","type":"playlist"},"createdAt":"2019-05-13T22:26:12.580Z","track":{"album":{"album_type":"album","artists":[{"external_urls":{"spotify":"https://open.spotify.com/artist/6Wr3hh341P84m3EI8qdn9O"},"href":"https://api.spotify.com/v1/artists/6Wr3hh341P84m3EI8qdn9O","id":"6Wr3hh341P84m3EI8qdn9O","name":"Rise Against","type":"artist","uri":"spotify:artist:6Wr3hh341P84m3EI8qdn9O"}],"external_urls":{"spotify":"https://open.spotify.com/album/2Gq0ERke26yxdGuRvrqFTD"},"href":"https://api.spotify.com/v1/albums/2Gq0ERke26yxdGuRvrqFTD","id":"2Gq0ERke26yxdGuRvrqFTD","images":[{"height":640,"url":"https://i.scdn.co/image/d2046d9cc60a6d13d31e352c15b34a7f828c7556","width":640},{"height":300,"url":"https://i.scdn.co/image/25426703fa7efbb6a80d752e5cfaa074c76fd3ed","width":300},{"height":64,"url":"https://i.scdn.co/image/93361c25eb95d226b5f0324b3fb4704934e05645","width":64}],"name":"Endgame","release_date":"2011-01-01","release_date_precision":"day","total_tracks":12,"type":"album","uri":"spotify:album:2Gq0ERke26yxdGuRvrqFTD"},"artists":[{"external_urls":{"spotify":"https://open.spotify.com/artist/6Wr3hh341P84m3EI8qdn9O"},"href":"https://api.spotify.com/v1/artists/6Wr3hh341P84m3EI8qdn9O","id":"6Wr3hh341P84m3EI8qdn9O","name":"Rise Against","type":"artist","uri":"spotify:artist:6Wr3hh341P84m3EI8qdn9O"}],"disc_number":1,"duration_ms":239893,"explicit":false,"external_ids":{"isrc":"USUM71111144"},"external_urls":{"spotify":"https://open.spotify.com/track/6z38xRV0gxWMyjtuz5T2Ea"},"href":"https://api.spotify.com/v1/tracks/6z38xRV0gxWMyjtuz5T2Ea","id":"6z38xRV0gxWMyjtuz5T2Ea","is_local":false,"name":"Survivor Guilt","popularity":49,"preview_url":"https://p.scdn.co/mp3-preview/36e69e5a62dab3283ab495ada420ba252147b84b?cid=88f6696309ca49ada0261312613bcac0","track_number":7,"type":"track","uri":"spotify:track:6z38xRV0gxWMyjtuz5T2Ea"},"updatedAt":"2019-05-14T03:03:43.019Z"},
      // ]
      // response.body.items.forEach(function (element) {
      //   try { // Deleting trash data
      //     if (element != null) {
      //       if (element._id != null) delete element._id
      //     }
      //   } catch (err) { console.log(`Deletion error: ${err}`) }
      // })
      response.body.items.forEach(function (element) {
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
        } catch (err) { console.log(`Deletion error: ${err}`) }
        Tracks.findOneAndUpdate({ played_at: element.played_at }, element, { upsert: true }).lean().exec() // Saving to DB
          .then(data => {
            if (!data) console.log('- New track!', element.track.name, element.played_at) // If is a new track
            else console.log('- Existing track!', data.track.name, data.played_at) // Track was previously there
          })
          .catch(err => { console.log(err) })
      })
      if (res) {
        res.send(response)
      }
    } else {
      if (res) res.send(error)
      console.log('Error', error)
    }
  })
}

// Getting tracks from frontend
app.get('/last_played', function (req, res) {
  Users.findOne({ accessToken: req.query.access_token }).lean().exec()
    .then(data => {
      if (!data) return res.status(404).send('Please login again')
      last50Tracks({
        url: 'https://api.spotify.com/v1/me/player/recently-played?limit=50',
        headers: { 'Authorization': 'Bearer ' + req.query.access_token },
        json: true
      }, data.id || 'Undefined', res)
    })
    .catch(err => {
      res.status(500).send('Error interno del servidor')
      console.log('Error getting last played', err)
    })
})
app.get('/my_history', async function (req, res) {
  // Handling query
  if (!req.query.page) return res.status(404).send('Send me a valid page') // Aditional param is required
  var pagination = Number(req.query.page)
  if (isNaN(pagination)) return res.status(404).send('Your page is not a number') // Aditional param is required
  pagination = Math.round(pagination)
  if (pagination < 1) pagination = 1
  var skip = 0
  var limit = 30
  if (pagination > 1) skip = (pagination * limit) - limit
  // Handling headers
  if (!req.headers.access_token) return res.status(404).send('Send me a valid access_token') // Aditional param is required
  // Getting user
  var user = await Users.findOne({ accessToken: req.headers.access_token }, 'id -_id').lean().exec() // Getting user id from DB
  if (!user) return res.status(404).send('Please login again') // Your access token has probably expired
  if (!user.id) return res.status(500).send('You should contact the app admin') // You have no id on DB
  // Getting tracks && documents length
  var filter = { user: user.id }
  var music = await Tracks.find(filter, '-createdAt -updatedAt', { skip, limit, sort: { played_at: -1 } }).lean().exec()
  if (!music) return res.status(404).send('You have no music') // No music with your id
  var count = await Tracks.countDocuments(filter).lean().exec()
  // Declare empty array
  var body = []
  // Iterate
  music.forEach(el => {
    // Define clean object
    var obj = {}
    // played at
    try { obj.played_at = el.played_at } catch (error) { obj.played_at = 'Undefined' }
    // track name
    try { obj.name = el.track.name } catch (error) { obj.name = 'Undefined' }
    // url
    try {
      var url = el.track.uri.split(':')
      obj.url = 'https://open.spotify.com/' + url[1] + '/' + url[2]
    } catch (error) { obj.uri = 'Undefined' }
    // artist
    try {
      var str = ''
      for (let i = 0; i < el.track.artists.length; i++) {
        str += el.track.artists[i].name
        if (i + 1 !== el.track.artists.length) str += ', '
      }
      obj.artist = str
    } catch (error) { obj.artist = 'Undefined' }
    // image
    try { obj.img = el.track.album.images[el.track.album.images.length - 1].url } catch (error) { obj.img = 'favicon-32x32.png' }
    // Push to array
    body.push(obj)
  })
  // Sorting newest to oldest
  body = _.sortBy(body, function (objeto) { return !objeto.played_at })

  // Send response
  res.status(200).send({ count, body })
})

// CronJob
new CronJob('0 0 * * * *', function () { // Every hour, yes it has 6 dots, with 1 second as the finest granularity.
  console.log('You will see this message every hour')
  Users.find({}).lean().exec()
    .then(data => {
      // If you have no users
      if (!data) {
        console.log('You have no users')
        return
      }
      data.forEach(function (elm) {
        console.log(elm.display_name, elm.id) // Showing username
        var authOptions = { // Refreshing token
          url: 'https://accounts.spotify.com/api/token',
          headers: { 'Authorization': 'Basic ' + bufferAuth },
          form: {
            grant_type: 'refresh_token',
            refresh_token: elm.refreshToken
          },
          json: true
        }
        // Call spotify to refresh token
        request.post(authOptions, function (error, response, body) {
          console.log(body)
          if (!error && body.access_token && response.statusCode === 200) {
            last50Tracks({
              url: 'https://api.spotify.com/v1/me/player/recently-played?limit=50',
              headers: { 'Authorization': 'Bearer ' + body.access_token },
              json: true
            }, elm.id || 'Undefined')
          } else {
            console.log('Can not refresh token', error)
          }
        })
      })
    })
    .catch(err => { console.log('Error Users', err) })
}, null, true, 'America/Los_Angeles')

// Mongoose deprecations // https://mongoosejs.com/docs/deprecations.html
mongoose.set('useFindAndModify', false)
mongoose.set('useNewUrlParser', true)
mongoose.set('useCreateIndex', true)

// // Update many
// Tracks.updateMany({}, { user: 'v9vwcwisvvr7c811mudjsptlv' }).lean().exec()
//   .then(tra => { console.log(tra) })
//   .catch(err => { console.log('Error Users', err) })
// Tracks.updateMany({}, { $unset: { explicit: "" } }, { multi: true }).lean().exec()
//   .then(tra => { console.log(tra) })
//   .catch(err => { console.log('Error Users', err) })
// Tracks.updateMany({}, { $unset: { is_local: "" } }, { multi: true }).lean().exec()
//   .then(tra => { console.log(tra) })
//   .catch(err => { console.log('Error Users', err) })
// Tracks.find({}).exec()
//   .then(data => {
//     data.forEach(i => {
//       console.log(i.played_at)
//     })
//   })
//   .catch(err => { console.log('Error Users', err) })

var DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/spotify'

// Database connection
mongoose.connect(DATABASE_URL)
  .then(() => {
    console.log(`Database on ${DATABASE_URL}`)
  })
  .then(() => app.listen(8888, () => {
    console.log('Listening on 8888')
  }))
  .catch((error) => {
    console.error('Error at server startup', error)
  })
