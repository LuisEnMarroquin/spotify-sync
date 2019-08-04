(function () {
  var pagination = 1
  var navigation = 1

  var userProfile1 = Handlebars.compile(document.getElementById('perfil-template').innerHTML)
  var userProfile2 = document.getElementById('perfil')

  var playedSongs1 = Handlebars.compile(document.getElementById('played-template').innerHTML)
  var playedSongs2 = document.getElementById('played')

  function getHashParams () { // Obtains parameters from the hash of the URL
    var hashParams = {}
    var e; var r = /([^&;=]+)=?([^&;]*)/g; var q = window.location.hash.substring(1)
    while (e = r.exec(q)) { hashParams[e[1]] = decodeURIComponent(e[2]) }
    return hashParams // Returns object
  }

  function logout () { // Logs out of the app
    window.location.hash = '' // Cleaning hash from url
    $('#login').show()
    $('#loggedin').hide()
  }

  function getHistory (page) {
    $.ajax({
      url: '/my_history',
      data: { page, access_token: params.access_token }
    }).done(function (data) {
      // Change global pagination variable
      pagination = page
      // Create nav array
      data.nav = []
      // Calculating navigation
      navigation = Math.ceil(data.count / 30)
      // Creating navigation array
      for (var i = 0; i < navigation; i++) { // SHOULD BE THE SAME BUCLE
        data.nav.push(i + 1)
      }
      // Logging data
      console.log(pagination, data)
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
      for (var o = 0; o < navigation; o++) { // SHOULD BE THE SAME BUCLE
        document.getElementById('pg-' + (o + 1)).addEventListener('click', function () {
          var pageNumber = Number($(this).children().text())
          getHistory(pageNumber)
        })
      }
    })
  }

  var params = getHashParams()

  if (params.error) alert('There was an error during the authentication')
  else {
    if (params.access_token) {
      $.ajax({
        url: 'https://api.spotify.com/v1/me',
        headers: { 'Authorization': 'Bearer ' + params.access_token },
        success: function (response) {
          userProfile2.innerHTML = userProfile1(response)
          $('#login').hide()
          $('#loggedin').show()
        }
      })
        .fail(function () { // If it fails it's maybe because your token is expired
          logout()
        })
    } else logout() // Show initial screen if no access_token

    document.getElementById('obtain-last-50').addEventListener('click', function () {
      $.ajax({ url: '/last_played', data: { access_token: params.access_token } })
        .done(function (data) {
          console.log(data)
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

    $('.nav-item').on('click', function () { // Close navbar on option select
      $('.navbar-collapse').collapse('hide')
    })
  }

  // if ('serviceWorker' in navigator) {
  //   window.addEventListener('load', function () {
  //     navigator.serviceWorker.register('/sw.js').then(function (registration) { // Registration was successful
  //       console.log('ServiceWorker registration successful with scope:', registration.scope)
  //     }, function (err) { // registration failed :(
  //       console.log('ServiceWorker registration failed: ', err)
  //     })
  //   })
  // }
})()
