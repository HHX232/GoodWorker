// app/api/tests/[id]/route.ts
import {prisma} from '@/shared/prisma/prisma'
import {NextResponse} from 'next/server'

export async function GET(_: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params

  console.log('id param:', id)

  const test = await prisma.test.findUnique({
    where: {id},
    include: {testCategories: {include: {category: true}}}
  })

  if (!test) {
    return NextResponse.json({error: 'Not found'}, {status: 404})
  }

  return NextResponse.json(test)
}
