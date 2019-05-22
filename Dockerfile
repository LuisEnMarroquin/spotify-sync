# NodeJS Alpine
FROM node:alpine

# Show all node logs
ENV NPM_CONFIG_LOGLEVEL warn

# Create app directory
RUN mkdir -p /opt/app

# Copy Files
COPY . /opt/app

# Set Working Directory
WORKDIR /opt/app/

# Install Dependncies
RUN yarn install --production --ignore-optional --ignore-scripts
