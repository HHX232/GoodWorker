// Self-check for storage.ts's getUsedBytes/assertFolderDepthAllowed/
// assertNotUnderRestrictedFolder — run with
// `npx tsx src/shared/lib/tutorFiles/storage.selfcheck.ts` against the
// real dev DB (DATABASE_URL from .env). No test runner in this project.
// Creates and tears down its own throwaway Teacher rows.
import { prisma } from '@/shared/prisma/prisma'
import {
  assertFolderDepthAllowed,
  assertNotUnderRestrictedFolder,
  FolderDepthExceededError,
  getUsedBytes,
  MAX_FOLDER_DEPTH,
  RestrictedAncestorError,
} from './storage'

let failures = 0
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++
    console.error(`FAIL ${label}`)
  } else {
    console.log(`PASS ${label}`)
  }
}

async function main() {
  // ── getUsedBytes: sums across multiple folders of one teacher, ignores another teacher's files ──
  const teacherA = await prisma.teacher.create({
    data: { name: 'Storage Selfcheck A', email: `storage-selfcheck-a-${Date.now()}@example.test` },
    select: { id: true },
  })
  const teacherB = await prisma.teacher.create({
    data: { name: 'Storage Selfcheck B', email: `storage-selfcheck-b-${Date.now()}@example.test` },
    select: { id: true },
  })

  try {
    const folder1 = await prisma.tutorFolder.create({ data: { teacherId: teacherA.id, name: 'Folder 1', ancestorIds: [] } })
    const folder2 = await prisma.tutorFolder.create({ data: { teacherId: teacherA.id, name: 'Folder 2', ancestorIds: [] } })

    await prisma.tutorFile.createMany({
      data: [
        { teacherId: teacherA.id, folderId: folder1.id, name: 'a.pdf', key: 'k1', url: 'u1', sizeBytes: 1000, mimeType: 'application/pdf', uploadedByRole: 'TEACHER', uploadedById: teacherA.id },
        { teacherId: teacherA.id, folderId: folder2.id, name: 'b.pdf', key: 'k2', url: 'u2', sizeBytes: 2500, mimeType: 'application/pdf', uploadedByRole: 'TEACHER', uploadedById: teacherA.id },
        { teacherId: teacherB.id, folderId: null, name: 'other-teacher.pdf', key: 'k3', url: 'u3', sizeBytes: 999_999, mimeType: 'application/pdf', uploadedByRole: 'TEACHER', uploadedById: teacherB.id },
      ],
    })

    const usedA = await getUsedBytes(teacherA.id)
    assert(usedA === 3500, `getUsedBytes: sums 1000 + 2500 across two folders of the same teacher, got ${usedA}`)

    const usedB = await getUsedBytes(teacherB.id)
    assert(usedB === 999_999, `getUsedBytes: teacher B's own total is unaffected by teacher A's files, got ${usedB}`)

    const usedNoFiles = await getUsedBytes('no-such-teacher-id')
    assert(usedNoFiles === 0, `getUsedBytes: a teacher with no files sums to 0, got ${usedNoFiles}`)
  } finally {
    await prisma.tutorFile.deleteMany({ where: { teacherId: { in: [teacherA.id, teacherB.id] } } })
    await prisma.tutorFolder.deleteMany({ where: { teacherId: { in: [teacherA.id, teacherB.id] } } })
    await prisma.teacher.deleteMany({ where: { id: { in: [teacherA.id, teacherB.id] } } })
  }

  // ── assertFolderDepthAllowed: 6 existing levels allowed, a 7th rejected ──
  // Simulate ancestorIds growing one level per iteration, exactly like
  // TutorFolder creation would (`[...parent.ancestorIds, parent.id]`).
  let ancestorIds: string[] = []
  for (let level = 1; level < MAX_FOLDER_DEPTH; level++) {
    let threw = false
    try {
      assertFolderDepthAllowed(ancestorIds)
    } catch {
      threw = true
    }
    assert(!threw, `assertFolderDepthAllowed: level ${level + 1} (parent ancestors=${ancestorIds.length}) is allowed`)
    ancestorIds = [...ancestorIds, `folder-level-${level}`]
  }
  // ancestorIds now has MAX_FOLDER_DEPTH - 1 entries -> parent is at depth MAX_FOLDER_DEPTH (6th level).
  // Creating a child under it would be the 7th level -> must be rejected.
  let rejectedSeventh = false
  try {
    assertFolderDepthAllowed(ancestorIds)
  } catch (e) {
    rejectedSeventh = e instanceof FolderDepthExceededError
  }
  assert(rejectedSeventh, 'assertFolderDepthAllowed: creating a 7th level under a 6th-level folder throws FolderDepthExceededError')

  // ── assertNotUnderRestrictedFolder ──
  const teacherC = await prisma.teacher.create({
    data: { name: 'Storage Selfcheck C', email: `storage-selfcheck-c-${Date.now()}@example.test` },
    select: { id: true },
  })
  const studentC = await prisma.student.create({
    data: { name: 'Storage Selfcheck Student', email: `storage-selfcheck-student-${Date.now()}@example.test` },
    select: { id: true },
  })

  try {
    const normalFolder = await prisma.tutorFolder.create({ data: { teacherId: teacherC.id, name: 'Normal', ancestorIds: [] } })
    let threwUnderNormal = false
    try {
      await assertNotUnderRestrictedFolder(normalFolder)
    } catch {
      threwUnderNormal = true
    }
    assert(!threwUnderNormal, 'assertNotUnderRestrictedFolder: creating a child under an unrestricted folder is allowed')

    const restrictedFolder = await prisma.tutorFolder.create({
      data: { teacherId: teacherC.id, name: 'Учебная', ancestorIds: [], restrictedToStudentId: studentC.id },
    })
    let rejectedDirect = false
    try {
      await assertNotUnderRestrictedFolder(restrictedFolder)
    } catch (e) {
      rejectedDirect = e instanceof RestrictedAncestorError
    }
    assert(rejectedDirect, 'assertNotUnderRestrictedFolder: creating a child directly under a restricted folder is rejected')

    // A grandchild folder under the restricted folder — restriction found
    // via the ancestor query, not the folder's own field.
    const childOfRestricted = await prisma.tutorFolder.create({
      data: { teacherId: teacherC.id, name: 'Child', parentId: restrictedFolder.id, ancestorIds: [restrictedFolder.id] },
    })
    let rejectedViaAncestor = false
    try {
      await assertNotUnderRestrictedFolder(childOfRestricted)
    } catch (e) {
      rejectedViaAncestor = e instanceof RestrictedAncestorError
    }
    assert(rejectedViaAncestor, "assertNotUnderRestrictedFolder: a folder whose ancestor (not itself) is restricted also rejects — checked via ancestorIds, not just the folder's own field")
  } finally {
    await prisma.tutorFolder.deleteMany({ where: { teacherId: teacherC.id } })
    await prisma.student.delete({ where: { id: studentC.id } })
    await prisma.teacher.delete({ where: { id: teacherC.id } })
  }

  if (failures > 0) {
    console.error(`storage.selfcheck: ${failures} check(s) FAILED`)
    process.exit(1)
  }
  console.log('storage.selfcheck: all checks passed')
}

main()
  .catch(e => {
    console.error('storage.selfcheck: crashed', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
