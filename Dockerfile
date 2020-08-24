# NodeJS Alpine
FROM node:lts-alpine

# Show all node logs
ENV NPM_CONFIG_LOGLEVEL warn

# Set working directory
WORKDIR /opt/app/

# Copy only package.json and yarn.lock for cache
COPY package.json yarn.lock ./

# Install dependncies
RUN yarn install --production --ignore-optional --pure-lockfile --non-interactive

# Copy Files
COPY . ./

# Run the application
CMD [ "node", "server.js" ]
