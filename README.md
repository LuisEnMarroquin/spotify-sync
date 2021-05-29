# History Sync for Spotify

[![Fail](https://github.com/LuisEnMarroquin/spotify-sync/actions/workflows/deploy.yml/badge.svg)](https://github.com/LuisEnMarroquin)
[![Fail](https://github.com/LuisEnMarroquin/spotify-sync/actions/workflows/backup.yml/badge.svg)](https://github.com/LuisEnMarroquin)
[![Fail](https://github.com/LuisEnMarroquin/spotify-sync/actions/workflows/server.yml/badge.svg)](https://github.com/LuisEnMarroquin)

Sync your Spotify's playback history every hour

* Initially folked from [github.com/spotify/web-api-auth-examples](https://github.com/spotify/web-api-auth-examples)
* This project uses Authorization Code Flow to [authenticate against the Spotify Web API](https://developer.spotify.com/web-api/authorization-guide)

## Installation

These examples run on Node.js. On this [website](http://www.nodejs.org) you can find instructions on how to install it

Just clone this repo and install it's dependencies

```shell
npm install
```

## Use your credentials

You will need to register your app and get your own credentials from the Spotify for Developers Dashboard

To do so, go to [your Spotify for Developers Dashboard](https://developer.spotify.com/dashboard) and create your application

For the examples, we registered these Redirect URIs:

* http://localhost:8888 (needed for the implicit grant flow)
* http://localhost:8888/callback

Once you have created your app, create an `.env` file and add the `CLIENT_ID` and `CLIENT_SECRET` that you got from your Spotify Dashboard

```env
CLIENT_ID=12345678
CLIENT_SECRET=12345678
```

## Database (important)

[MongoDB 4.2](https://docs.mongodb.com/v4.2/tutorial) is required to run this project

If you have Docker you can run

```shell
docker volume create mongo
docker volume create mongoc
docker run -d --name mongo -p 27017:27017 -v mongo:/data/db -v mongoc:/data/configdb mongo:4.2
```
