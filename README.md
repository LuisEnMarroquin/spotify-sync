# Spotify Sync playback history every hour
This project contains an Authorization Code flow example with OAuth 2.0 for [authenticating against the Spotify Web API](https://developer.spotify.com/web-api/authorization-guide/).

## Installation
These examples run on Node.js. On this [website](http://www.nodejs.org/) you can find instructions on how to install it.
Once installed, install yarn using `npm i -g yarn`, then clone the repository and install its dependencies running: `yarn`

### Using your own credentials
You will need to register your app and get your own credentials from the Spotify for Developers Dashboard. To do so, go to [your Spotify for Developers Dashboard](https://developer.spotify.com/dashboard) and create your application. For the examples, we registered these Redirect URIs:
* http://localhost:8888 (needed for the implicit grant flow)
* http://localhost:8888/callback
Once you have created your app, create an `.env` file and add the `CLIENT_ID` and `CLIENT_SECRET` that you got from your Spotify Dashboard.

## Run database
MongoDB is needed to run this project. If you have Docker you can run:
```shell
yarn database
```

## Run the app
In order to run the project, run `server.js`:
```shell
node server.js
```

Then, open `http://localhost:8888` in a browser.
