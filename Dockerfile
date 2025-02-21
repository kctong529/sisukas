FROM pierrezemb/gostatic

# Copy your static files
COPY . /srv/http/

# Copy the config.json file to configure GoStatic
COPY config.json /srv/http/config.json

# Run GoStatic with the specified options
CMD ["-port", "8080", "-https-promote", "-enable-logging"]
