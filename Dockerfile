# Build environment
FROM node:lts-alpine AS build-env

# Set working directory
WORKDIR /opt/app/

# Copy only this for cache
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --no-optional

# Copy all files
COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/

# Compile frontend
RUN npm run build-app

# Compile backend
RUN npm run build-api

# This file gets modified by ncc
RUN cp public/scripts.js build/public/scripts.js

# Production environment
FROM node:lts-alpine

# Set working directory
WORKDIR /opt/app/

# Copy files from build environment
COPY --from=build-env /opt/app/build .

# Run the application
CMD [ "node", "index.js" ]
