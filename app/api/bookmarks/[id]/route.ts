import { prisma } from "@/shared/prisma/prisma"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../auth"

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.bookmark.deleteMany({
    where: { id: params.id, authorId: session.user.id }
  })

  return NextResponse.json({ ok: true })
}