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
# Superseded migrateRussianCourseWave1CoverRefresh.ts (uncompressed v2 covers) —
# the 4 rich-content scripts below own covers now (compressed v3, plus
# text/PDF/tests), so running the old one would just be wasted API spend.
npx tsx prisma/migrateRussianCourseWave1RichOrthography.ts || echo "⚠️ russian-course rich orthography pass failed, continuing boot (will retry next restart)" >&2
npx tsx prisma/migrateRussianCourseWave1RichMorphology.ts || echo "⚠️ russian-course rich morphology pass failed, continuing boot (will retry next restart)" >&2
npx tsx prisma/migrateRussianCourseWave1RichSyntax.ts || echo "⚠️ russian-course rich syntax pass failed, continuing boot (will retry next restart)" >&2
npx tsx prisma/migrateRussianCourseWave1RichPunctuation.ts || echo "⚠️ russian-course rich punctuation pass failed, continuing boot (will retry next restart)" >&2
# TEMPORARY one-off, runs last so it has final say over the rich passes above:
# revert 7 topics to their pre-promo-poster cover, hide the whole batch
# (posts + roadmap) from public view pending a quality pass. Remove this line
# once confirmed to have run on production — it's a one-time fix, not a
# permanent part of boot.
npx tsx prisma/fixCoversAndHideRussianCourse.ts || echo "⚠️ russian-course cover-fix/hide failed, continuing boot (will retry next restart)" >&2
exec node server.js -p ${PORT:-3000}