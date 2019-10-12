var CACHE_NAME = 'static'

self.addEventListener('install', function (event) {
  // Perform install steps
  console.log('installllllllllllllll')
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(
        [
          '/index.js',
          '/logo.png',
          '/index.css',
          '/index.html',
          '/favicon.png',
          '/manifest.json',
          '/jquery/jquery.min.js',
          '/popper/popper.min.js',
          '/handlebars/handlebars.min.js',
          '/bootstrap/js/bootstrap.min.js',
          '/bootstrap/css/bootstrap.min.css'
        ]
      )
    })
  )
})

self.addEventListener('fetch', function (event) {
  console.log('fetch')
  event.respondWith(
    caches.match(event.request)
      .then(function (response) {
        // Cache hit - return response
        if (response) return response

        return fetch(event.request).then(
          function (response) {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') return response

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            var responseToCache = response.clone()

            caches.open(CACHE_NAME)
              .then(function (cache) {
                cache.put(event.request, responseToCache)
              })

            return response
          }
        )
      })
  )
})
