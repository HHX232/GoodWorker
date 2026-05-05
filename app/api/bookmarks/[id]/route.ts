import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../../auth'

export async function DELETE(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const {id} = await params

  await prisma.bookmark.deleteMany({
    where: {id: id, authorId: session.user.id}
  })

  return NextResponse.json({ok: true})
}
