# Spotify Accounts Authentication Examples
This project contains an Authorization Code flow example with OAuth 2.0 for [authenticating against the Spotify Web API](https://developer.spotify.com/web-api/authorization-guide/).

## Installation
These examples run on Node.js. On this [website](http://www.nodejs.org/download/) you can find instructions on how to install it.
Once installed, clone the repository and install its dependencies running: `yarn`

### Using your own credentials
You will need to register your app and get your own credentials from the Spotify for Developers Dashboard. To do so, go to [your Spotify for Developers Dashboard](https://beta.developer.spotify.com/dashboard) and create your application. For the examples, we registered these Redirect URIs:
* http://localhost:8888 (needed for the implicit grant flow)
* http://localhost:8888/callback
Once you have created your app, create an `.env` file and add the `CLIENT_ID` and `CLIENT_SECRET` that you got from your Spotify Dashboard.

## Running the examples
In order to run the different examples, open the folder with the name of the flow you want to try out, and run its `app.js` file. For instance, to run the Authorization Code example do:

    $ cd spotify
    $ node app.js

Then, open `http://localhost:8888` in a browser.
