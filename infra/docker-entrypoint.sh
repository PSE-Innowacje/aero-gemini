#!/bin/sh
set -e
# Named volumes usually mount as root-owned; match Dockerfile UID/GID 10001 (works even if passwd names drift).
mkdir -p /app/data
chown -R 10001:10001 /app/data
exec runuser -u 10001 -- "$@"
