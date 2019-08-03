(function () {
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
      $.ajax({
        url: '/my_history',
        data: { page: 1 },
        headers: { access_token: params.access_token }
      }).done(function (data) {
        data.nav = []
        var navigation = Math.ceil(data.count / 30)
        for (var i = 0; i < navigation; i++) { data.nav.push(i + 1) }
        console.log(data)
        playedSongs2.innerHTML = playedSongs1(data)
        // Hide SPA
        $('#perfil').hide()
        $('#played').show()
      })
    }, false)

    document.getElementById('logout-obtain').addEventListener('click', function () {
      logout()
    }, false)
  }
})()
