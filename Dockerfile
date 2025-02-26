# Build the project with Node.js
FROM node:18 AS builder

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the project files
COPY . .

# Build the project with Vite
RUN npm run build

# Serve the static files with GoStatic
FROM pierrezemb/gostatic

# Copy the built files from the builder stage
COPY --from=builder /app/dist /srv/http

# Expose the port
EXPOSE 8080

# Copy the config.json file to configure GoStatic
COPY config.json /srv/http/config.json

# Start the server
CMD ["-port", "8080", "-https-promote", "-enable-logging"]
