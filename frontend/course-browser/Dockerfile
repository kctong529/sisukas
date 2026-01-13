# Create version.json
FROM alpine as build
ARG COMMIT_SHA
RUN echo "{\"commit\": \"${COMMIT_SHA}\"}" > /version.json


# Serve the static files with GoStatic
FROM pierrezemb/gostatic

# Copy the built files
COPY ./dist /srv/http
COPY --from=build /version.json /srv/http/version.json

# Expose the port
EXPOSE 8080

# Copy the config.json file to configure GoStatic
COPY config.json /srv/http/config.json

# Start the server
CMD ["-port", "8080", "-https-promote", "-enable-logging", "-fallback", "index.html"]