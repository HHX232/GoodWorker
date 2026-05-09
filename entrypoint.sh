#!/bin/sh
set -e
npx prisma migrate deploy --schema=./prisma/schema.prisma
npm run seed:all
exec node server.js -p ${PORT:-3000}