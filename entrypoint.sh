#!/bin/sh
set -e
npx prisma migrate deploy --schema=./prisma/schema.prisma
npx tsx prisma/seed-if-empty.ts
exec node server.js -p ${PORT:-3000}