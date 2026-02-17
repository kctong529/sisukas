# Create health + version metadata
FROM alpine AS buildmeta
ARG COMMIT_SHA
ARG BUILD_TIME_ISO
ARG ENVIRONMENT
ARG APP_VERSION
ARG SERVICE_NAME=course-browser

ARG VITE_FILTERS_API
ARG VITE_WRAPPER_API
ARG VITE_GCS_BUCKET
ARG VITE_FRONTEND_URL
ARG VITE_BACKEND_URL
ARG VITE_DEBUG_PANELS

RUN if [ "${VITE_DEBUG_PANELS}" = "true" ]; then echo true > /debugPanels.bool; else echo false > /debugPanels.bool; fi

RUN cat > /health.json <<EOF
{
  "status": "ok",
  "service": "${SERVICE_NAME}",
  "environment": "${ENVIRONMENT}",
  "version": "${APP_VERSION}",
  "commit": "${COMMIT_SHA}",
  "buildTime": "${BUILD_TIME_ISO}",
  "checks": [],
  "publicConfig": {
    "filtersApi": "${VITE_FILTERS_API}",
    "wrapperApi": "${VITE_WRAPPER_API}",
    "gcsBucket": "${VITE_GCS_BUCKET}",
    "frontendUrl": "${VITE_FRONTEND_URL}",
    "backendUrl": "${VITE_BACKEND_URL}",
    "debugPanels": $(cat /debugPanels.bool)
  }
}
EOF

RUN printf '{ "commit": "%s" }\n' "${COMMIT_SHA}" > /version.json

# Serve the static files with GoStatic
FROM pierrezemb/gostatic

COPY ./dist /srv/http
COPY --from=buildmeta /health.json /srv/http/health.json
COPY --from=buildmeta /health.json /srv/http/health
COPY --from=buildmeta /version.json /srv/http/version.json

EXPOSE 8080
COPY headerConfig.json /config/headerConfig.json
CMD ["-port", "8080", "-https-promote", "-enable-logging", "-fallback", "index.html"]
