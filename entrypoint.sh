#!/bin/sh
set -e
# Resolve any previously-failed migration so deploy is not blocked
npx prisma migrate resolve --rolled-back 20260513000000_add_bookmark_videocall --schema=./prisma/schema.prisma 2>/dev/null || true
npx prisma migrate deploy --schema=./prisma/schema.prisma
npx tsx prisma/seed-if-empty.ts
# Content seeding, not schema — a failure here must not crash-loop the whole
# app (unlike migrate deploy above). It's idempotent, so a failed/partial run
# just retries cleanly on the next boot.
npx tsx prisma/migrateRussianCourseWave1.ts || echo "⚠️ russian-course migration failed, continuing boot (will retry next restart)" >&2
npx tsx prisma/migrateRussianCourseWave1Roadmap.ts || echo "⚠️ russian-course roadmap migration failed, continuing boot (will retry next restart)" >&2
npx tsx prisma/migrateRussianCourseWave1CoverRefresh.ts || echo "⚠️ russian-course cover refresh failed, continuing boot (will retry next restart)" >&2
exec node server.js -p ${PORT:-3000}