(function () {
  var userProfile1 = document.getElementById('user-profile-template').innerHTML
  var userProfile2 = Handlebars.compile(userProfile1)
  var userProfile3 = document.getElementById('user-profile')

  var last50songs1 = document.getElementById('last-50-template').innerHTML
  var last50songs2 = Handlebars.compile(last50songs1)
  var last50songs3 = document.getElementById('last-50')

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

  var params = getHashParams(); var access_token = params.access_token

  if (params.error) alert('There was an error during the authentication')
  else {
    if (access_token) {
      $.ajax({
        url: 'https://api.spotify.com/v1/me',
        headers: { 'Authorization': 'Bearer ' + access_token },
        success: function (response) {
          userProfile3.innerHTML = userProfile2(response)
          $('#login').hide()
          $('#loggedin').show()
        }
      })
        .fail(function () { // If it fails it's maybe because your token is expired
          logout()
        })
    } else logout() // Show initial screen if no access_token

    document.getElementById('obtain-last-50').addEventListener('click', function () {
      $.ajax({
        url: '/last_played',
        data: { access_token }
      }).done(function (data) {
        // Declare empty array
        var array = []
        // Iterate
        data.body.items.forEach(el => {
          // Define clean object
          var obj = {}
          // Set props
          if (_.has(el, 'played_at')) { obj.played_at = el.played_at } else obj.played_at = 'Undefined'
          if (_.has(el.track, 'name')) { obj.name = el.track.name } else obj.name = 'Undefined'
          // Create url
          if (_.has(el.track, 'uri')) {
            obj.uri = el.track.uri
            var url = obj.uri.split(':')
            obj.url = 'https://open.spotify.com/' + url[1] + '/' + url[2]
          } else obj.uri = 'Undefined'
          // Set image
          if (_.has(el.track.album, 'images')) {
            if (el.track.album.images.length !== 0) obj.img = el.track.album.images[el.track.album.images.length - 1].url
            else obj.img = 'favicon-32x32.png'
          } else obj.img = 'favicon-32x32.png'
          // Push to array
          array.push(obj)
        })
        // Sorting newest to oldest
        array = _.sortBy(array, function (objeto) { return !objeto.played_at })
        // Add to view
        last50songs3.innerHTML = last50songs2(array)
      })
    }, false)
  }
})()
