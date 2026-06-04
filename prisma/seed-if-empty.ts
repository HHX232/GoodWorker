/**
 * Safe seed runner — skips all seeding if the DB already has data.
 * Called from the build script so Railway seeds on first deploy only.
 */
import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const categoryCount = await prisma.category.count()
  if (categoryCount > 0) {
    console.log(`⏩ DB already seeded (${categoryCount} categories found). Skipping.`)
    return
  }

  console.log('🌱 DB is empty — running all seeds...')
  const seeds = [
    'prisma/seed.ts',
    'prisma/seedUsers.ts',
    'prisma/seedErrors.ts',
    'prisma/seedContent.ts',
    'prisma/seedVipPosts.ts',
    'prisma/seedposts.ts',
    'prisma/seedAnalytics.ts',
  ]
  for (const file of seeds) {
    console.log(`  → ${file}`)
    execSync(`npx tsx ${file}`, { stdio: 'inherit' })
  }
  console.log('✅ All seeds done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
