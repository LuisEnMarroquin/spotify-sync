# NodeJS Alpine
FROM node:lts-alpine

# Show all node logs
ENV NPM_CONFIG_LOGLEVEL warn

# Set working directory
WORKDIR /opt/app/

# Copy only this for cache
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --omit=dev --omit=optional

# Copy all files
COPY . ./

# Compile TypeScript
RUN npm run compile

# This folder is not longed needed
RUN rm -rf src/

# Run the application
CMD [ "node", "server.js" ]
