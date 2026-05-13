#!/bin/sh
set -e
# Resolve any previously-failed migration so deploy is not blocked
npx prisma migrate resolve --rolled-back 20260513000000_add_bookmark_videocall --schema=./prisma/schema.prisma 2>/dev/null || true
npx prisma migrate deploy --schema=./prisma/schema.prisma
npx tsx prisma/seed-if-empty.ts
exec node server.js -p ${PORT:-3000}