#!/bin/sh
set -e
npx prisma migrate deploy --schema=./prisma/schema.prisma
exec node server.js -p ${PORT:-3000}