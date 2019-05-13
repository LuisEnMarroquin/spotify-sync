var cookieParser = require('cookie-parser')
var querystring = require('querystring')
var compression = require('compression') // Compress public folder
var mongoose = require('mongoose') // MongoDB with schemas framework
var express = require('express') // Express web server framework
var request = require('request') // "Request" library
var cors = require('cors')
var path = require('path')

// Models
var Users = require('./models/users')
var Tracks = require('./models/tracks')

// Spotify Dashboard variables
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

// // // /**
// // //  * Gets user's the 50 most recently played tracks
// // //  * @param  {object} user The user who will get tracks
// // //  * @return {string} The generated string if this was successfull
// // //  */
// // // var last50Tracks = function (user) {
// // //   console.log(user)
// // //   return user
// // // }

var stateKey = 'spotify_auth_state'

var app = express()

app.use(cors())
app.use(compression())
app.use(cookieParser())
app.use(express.static(path.join(__dirname, '/public')))

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

app.get('/callback', function (req, res) {
  // your application requests refresh and access token after checking the state parameter

  var code = req.query.code || null
  var state = req.query.state || null
  var storedState = req.cookies ? req.cookies[stateKey] : null

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }))
  } else {
    res.clearCookie(stateKey)
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + bufferAuth
      },
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
          if (error) { console.log(error); return }
          // console.log(body)
          var newDoc = { ...body, accessToken, refreshToken, expireToken }
          Users.findOneAndUpdate({ id: body.id }, newDoc, { upsert: true }).lean().exec()
            .then(data => {
              console.log(data)
              if (!data) console.log('User created!') // If is a new user
              else console.log('User updated!') // If user was previously in my app
            })
            .catch(err => { console.log(err) })
        })

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: accessToken,
            refresh_token: refreshToken
          }))
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }))
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
    if (!error && response.statusCode === 200) {
      res.send({
        'access_token': body.access_token
      })
    }
  })
})

app.get('/last_played', function (req, res) {
  // requesting access token from refresh token
  var authOptions = {
    url: 'https://api.spotify.com/v1/me/player/recently-played?limit=50',
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      'Authorization': 'Bearer ' + req.query.access_token
    },
    json: true
  }
  // Responding request
  request.get(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      // Saving tracks
      console.log(response.body.items)
      // Users.findOneAndUpdate({ id: body.id }, newDoc, { upsert: true }).lean().exec()
      //   .then(data => {
      //     if (!data) console.log('New track!') // If is a new track
      //     else console.log('Existing track!') // Track was previously there
      //   })
      //   .catch(err => { console.log(err) })
      // Everything nice
      res.send(response)
    } else {
      res.send(error)
    }
  })
})

// Mongoose deprecations // https://mongoosejs.com/docs/deprecations.html
mongoose.set('useNewUrlParser', true)
mongoose.set('useFindAndModify', false)
mongoose.set('useCreateIndex', true)

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
    console.log('Error at server startup')
    console.error(error)
  })
