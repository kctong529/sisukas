# Serve the static files with GoStatic
FROM pierrezemb/gostatic

# Accept a build argument for commit SHA
ARG COMMIT_SHA

# Copy the built files
COPY ./dist /srv/http

# Write commit SHA to version.json for traceability
RUN echo "{\"commit\": \"${COMMIT_SHA}\"}" > /srv/http/version.json

# Expose the port
EXPOSE 8080

# Copy the config.json file to configure GoStatic
COPY config.json /srv/http/config.json

# Start the server
CMD ["-port", "8080", "-https-promote", "-enable-logging"]
