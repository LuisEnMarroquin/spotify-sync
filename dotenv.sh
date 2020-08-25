rm -f .env
touch .env
echo CLIENT_ID=$1 >> .env
echo CLIENT_SECRET=$2 >> .env
echo ME_USERNAME=$3 >> .env
echo ME_PASSWORD=$4 >> .env
echo ME_SESSION=$5 >> .env
echo ME_COOKIE=$6 >> .env
echo SPOTIFY_URL=spotify.marroquin.dev >> .env
