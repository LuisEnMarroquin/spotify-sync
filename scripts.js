let baseURL

if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') baseURL = ''
else baseURL = 'https://spotify.marroquin.dev'

document.getElementById('login-button').addEventListener('click', function () {
  window.location.href = baseURL + '/login'
}, false)

let pagination = 1
let navigation = 1

let userProfile1 = Handlebars.compile(document.getElementById('perfil-template').innerHTML)
let userProfile2 = document.getElementById('perfil')

let playedSongs1 = Handlebars.compile(document.getElementById('played-template').innerHTML)
let playedSongs2 = document.getElementById('played')

function getHashParams() { // Obtains parameters from the hash of the URL
  let hashParams = {}
  let e
  let r = /([^&;=]+)=?([^&;]*)/g
  let q = window.location.hash.substring(1)
  while (e = r.exec(q)) { hashParams[e[1]] = decodeURIComponent(e[2]) } // eslint-disable-line no-cond-assign
  return hashParams // Returns object
}

function logout() { // Logs out removing token from url
  window.location.hash = '' // Cleaning hash from url
  $('#login').show()
  $('#loggedin').hide()
}

function getHistory(page) {
  $.ajax({
    url: `${baseURL}/my_history`,
    data: { page, access_token: params.access_token }
  })
    .done(function (data) {
      // Change global pagination variable
      pagination = page
      // Change global navigation variable
      navigation = data.navigation
      // Logging data
      console.log(pagination, navigation, data)
      // Create view
      playedSongs2.innerHTML = playedSongs1(data)
      // Remove 'active' class
      $('.pagination-number').removeClass('active')
      // Adding 'active' class to active pagination
      $('#pg-' + pagination).addClass('active')
      // Pagination previous
      document.getElementById('pagination-previous').addEventListener('click', function () {
        pagination -= 1
        if (pagination < 1) pagination = 1
        else getHistory(pagination)
      }, false)
      // Pagination next
      document.getElementById('pagination-next').addEventListener('click', function () {
        pagination += 1
        if (pagination > navigation) pagination = navigation
        else getHistory(pagination)
      }, false)
      // Adding event listenner to pagination content
      data.nav.forEach(function (navNumber) {
        document.getElementById('pg-' + navNumber).addEventListener('click', function () {
          let pageNumber = Number($(this).children().text())
          getHistory(pageNumber)
        })
      })
    })
    .fail(function (e) {
      if (e.status === 418) logout()
    })
}

let params = getHashParams()

if (params.error) alert('There was an error during the authentication')
else {
  if (params.access_token) {
    $.ajax({
      url: 'https://api.spotify.com/v1/me',
      headers: { Authorization: 'Bearer ' + params.access_token }
    })
      .done(function (res) {
        userProfile2.innerHTML = userProfile1(res)
        $('#login').hide()
        $('#loggedin').show()
      })
      .fail(function () { // If it fails it's maybe because your token is expired
        logout()
      })
  } else logout() // Show initial screen if no access_token

  document.getElementById('obtain-last-played').addEventListener('click', function () {
    $.ajax({ url: `${baseURL}/last_played`, data: { access_token: params.access_token } })
      .done(function (data) {
        console.log(data)
      })
      .fail(function (e) {
        if (e.status === 418) logout()
      })
  }, false)

  document.getElementById('perfil-obtain').addEventListener('click', function () {
    // Hide SPA
    $('#perfil').show()
    $('#played').hide()
  }, false)

  document.getElementById('played-obtain').addEventListener('click', function () {
    // Hide SPA
    $('#perfil').hide()
    $('#played').show()
    // Get last played history
    getHistory(pagination)
  }, false)

  document.getElementById('logout-obtain').addEventListener('click', function () {
    logout()
  }, false)

  $('.nav-item').on('click', function () {
    $('.navbar-collapse').collapse('hide') // Close navbar on option select
    $('.nav-link').removeClass('active') // Remove active class from all
    $(this).children().addClass('active') // Add active class to clicked
  })
}
