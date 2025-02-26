# Serve the static files with GoStatic
FROM pierrezemb/gostatic

# Copy the built files
COPY ./dist /srv/http

# Expose the port
EXPOSE 8080

# Copy the config.json file to configure GoStatic
COPY config.json /srv/http/config.json

# Start the server
CMD ["-port", "8080", "-https-promote", "-enable-logging"]
