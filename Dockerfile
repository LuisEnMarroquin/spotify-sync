# NodeJS Alpine
FROM node:alpine

# Show all node logs
ENV NPM_CONFIG_LOGLEVEL warn

# Create app directory
RUN mkdir -p /opt/app

# Set Working Directory
WORKDIR /opt/app/

# Copy only package.json and yarn.lock for cache
COPY package.json yarn.lock /opt/app/

# Install Dependncies
RUN yarn install --production --ignore-optional --ignore-scripts --pure-lockfile --non-interactive

# Copy Files
COPY . /opt/app
