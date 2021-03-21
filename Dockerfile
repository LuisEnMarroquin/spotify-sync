# Build environment
FROM node:lts-alpine AS build-env

# Show all node logs
ENV NPM_CONFIG_LOGLEVEL warn

# Set working directory
WORKDIR /opt/app/

# Copy only this for cache
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --no-optional

# Copy all files
COPY tsconfig.json src/ public/ ./

# Compile frontend
RUN npm run browser

# Compile backend
RUN npm run server

# Production environment
FROM node:lts-alpine

# Copy files from build environment
COPY --from=build-env /opt/app/dist .

# Show all node logs
ENV NPM_CONFIG_LOGLEVEL warn

# Set working directory
WORKDIR /opt/app/

# Show all files
RUN ls -aR

# Run the application
CMD [ "node", "index.js" ]
