#!/bin/sh
# Ensure /data is writable by the admars user
# This runs as root before dropping to the admars user
if [ "$(id -u)" = "0" ]; then
  chown -R admars:admars /data 2>/dev/null || true
  exec su-exec admars "$@"
else
  exec "$@"
fi
