import { compile } from "handlebars"

let baseURL: string = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '' : 'https://spotify.marroquin.dev'

document.getElementById('login-button').addEventListener('click', () => window.location.href = `${baseURL}/login`, false)

let pagination: number = 1, navigation: number = 1

let userProfile1 = compile(document.getElementById('perfil-template').innerHTML)
let userProfile2 = document.getElementById('perfil')

let playedSongs1 = compile(document.getElementById('played-template').innerHTML)
let playedSongs2 = document.getElementById('played')

let getHashParams = () => { // Obtains parameters from the hash of the URL
  let hashParams = {}
  let e
  let r = /([^&;=]+)=?([^&;]*)/g
  let q = window.location.hash.substring(1)
  while (e = r.exec(q)) { hashParams[e[1]] = decodeURIComponent(e[2]) } // eslint-disable-line no-cond-assign
  console.log({ hashParams })
  return hashParams // Returns object
}

let logout = () => { // Logs out removing token from url
  window.location.hash = '' // Cleaning hash from url
  $('#login').show()
  $('#loggedin').hide()
}

function getHistory(page: number) {
  $.ajax({
    url: `${baseURL}/my_history`,
    data: { page, access_token: params.access_token }
  })
    .done(data => {
      pagination = page // Change global pagination variable
      navigation = data.navigation // Change global navigation variable
      console.log(pagination, navigation, data) // Logging data
      playedSongs2.innerHTML = playedSongs1(data) // Create view
      $('.pagination-number').removeClass('active') // Remove 'active' class
      $('#pg-' + pagination).addClass('active') // Adding 'active' class to active pagination
      // Pagination previous
      document.getElementById('pagination-previous').addEventListener('click', () => {
        pagination -= 1
        if (pagination < 1) pagination = 1
        else getHistory(pagination)
      }, false)
      // Pagination next
      document.getElementById('pagination-next').addEventListener('click', () => {
        pagination += 1
        if (pagination > navigation) pagination = navigation
        else getHistory(pagination)
      }, false)
      // Adding event listener to pagination content
      data.nav.forEach(navNumber => {
        var classNumber = 'pg-' + navNumber
        document.getElementById(classNumber).addEventListener('click', () => {
          let pageNumber = Number($(`#${classNumber}`).children().text())
          getHistory(pageNumber)
        })
      })
    })
    .fail(error => {
      if (error.status === 418) logout()
      console.log({ error })
    })
}

interface iParams {
  error?: any;
  access_token?: string;
}

let params: iParams = getHashParams()

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
      .fail(() => { // If it fails it's maybe because your token is expired
        logout()
      })
  } else logout() // Show initial screen if no access_token

  document.getElementById('obtain-last-played').addEventListener('click', () => {
    $.ajax({ url: `${baseURL}/last_played`, data: { access_token: params.access_token } })
      .done(data => {
        console.log(data)
      })
      .fail(error => {
        error.status === 418 ? logout() : console.log({ error })
      })
  }, false)

  document.getElementById('perfil-obtain').addEventListener('click', () => { // Hide SPA
    $('#perfil').show()
    $('#played').hide()
  }, false)

  document.getElementById('played-obtain').addEventListener('click', () => { // Hide SPA
    $('#perfil').hide()
    $('#played').show()
    getHistory(pagination) // Get last played history
  }, false)

  document.getElementById('logout-obtain').addEventListener('click', () => {
    logout()
  }, false)

  $('.nav-item').on('click', function () { // DON'T CHANGE TO ARROW FUNCTION, 'this' keyword inside won't work
    $('.navbar-collapse').collapse('hide') // Close navbar on option select
    $('.nav-link').removeClass('active') // Remove active class from all
    $(this).children().addClass('active') // Add active class to clicked
  })
}
