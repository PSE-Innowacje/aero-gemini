#!/bin/sh
set -e
# Named volumes usually mount as root-owned; match Dockerfile UID/GID 10001.
mkdir -p /app/data
chown -R 10001:10001 /app/data
# runuser -u expects a login name; numeric 10001 is resolved as username "10001" and fails.
exec runuser -u appuser -- "$@"
