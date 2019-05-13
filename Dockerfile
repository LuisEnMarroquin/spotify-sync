# NodeJS Alpine
FROM node:10.7.0-slim

ENV NPM_CONFIG_LOGLEVEL warn
RUN mkdir -p /opt/app

# Copy Files
COPY . /opt/app

# Set Working Directory
WORKDIR /opt/app/

# Install Dependncies
RUN yarn install --ignore-scripts
