import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { publicUrlForKey, s3, S3_BUCKET } from '@/shared/s3/s3Client'
import { getStorageLimits } from '@/shared/lib/tutorFiles/storage'
import { GB, MAX_FOLDER_DEPTH } from '@/shared/lib/tutorFiles/constants'
import type { StudentFile } from '@prisma/client'
import { lectureStorageBytes } from '@/shared/lib/lecture/audio'

// A student's own drive ("Мои файлы"). Paid from the student's quota
// (StorageSettings.studentQuotaGb, VIP only) — unlike homework handed in to a
// tutor, which lives in the tutor's library and counts toward the tutor.

export async function isStudentVipActive(studentId: string): Promise<boolean> {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { isVip: true, vipExpiresAt: true } })
  if (!student?.isVip) return false
  return student.vipExpiresAt === null || student.vipExpiresAt > new Date()
}

export async function getStudentDriveLimits(): Promise<{ quotaBytes: number; maxFileBytes: number }> {
  const [limits, row] = await Promise.all([
    getStorageLimits(),
    prisma.storageSettings.findUnique({ where: { id: 'global' }, select: { studentQuotaGb: true } }),
  ])
  return { quotaBytes: (row?.studentQuotaGb ?? 5) * GB, maxFileBytes: limits.maxFileBytes }
}

/** Drive files plus /lecture audio and photos kept in S3 — both are the student's own bytes. */
export async function getStudentUsedBytes(studentId: string): Promise<number> {
  const [files, audio] = await Promise.all([
    prisma.studentFile.aggregate({ where: { studentId }, _sum: { sizeBytes: true } }),
    lectureStorageBytes(studentId, 'STUDENT'),
  ])
  return (files._sum.sizeBytes ?? 0) + audio
}

export type DriveWriteError = 'FILE_TOO_LARGE' | 'QUOTA_EXCEEDED' | 'UPLOAD_FAILED'

export class DriveError extends Error {
  constructor(public code: DriveWriteError, public status: number) {
    super(code)
    this.name = 'DriveError'
  }
}

export function driveErrorResponse(e: DriveError): NextResponse {
  return NextResponse.json({ error: e.code }, { status: e.status })
}

function extOf(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'bin'
}

/** Quota check → S3 put → row. The row is written only after the put succeeded. */
export async function putStudentFile(opts: {
  studentId: string
  folderId: string | null
  name: string
  mimeType: string
  bytes: Buffer
  lectureNoteId?: string | null
}): Promise<StudentFile> {
  const { quotaBytes, maxFileBytes } = await getStudentDriveLimits()
  if (opts.bytes.length > maxFileBytes) throw new DriveError('FILE_TOO_LARGE', 413)
  if ((await getStudentUsedBytes(opts.studentId)) + opts.bytes.length > quotaBytes) throw new DriveError('QUOTA_EXCEEDED', 413)

  const key = `student-files/${opts.studentId}/${randomUUID()}.${extOf(opts.name)}`
  try {
    await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: opts.bytes, ContentType: opts.mimeType, ACL: 'public-read' }))
  } catch (e) {
    console.error('[putStudentFile] upload failed', e)
    throw new DriveError('UPLOAD_FAILED', 502)
  }
  return prisma.studentFile.create({
    data: {
      studentId: opts.studentId,
      folderId: opts.folderId,
      name: opts.name,
      key,
      url: publicUrlForKey(key),
      sizeBytes: opts.bytes.length,
      mimeType: opts.mimeType,
      lectureNoteId: opts.lectureNoteId ?? null,
    },
  })
}

/**
 * Replaces the bytes of an existing drive file (a lecture re-saved). New S3
 * object, row repointed; like the tutor library, old objects stay in S3.
 * Quota counts only the size difference.
 */
export async function replaceStudentFile(file: StudentFile, bytes: Buffer, mimeType: string): Promise<StudentFile> {
  const { quotaBytes, maxFileBytes } = await getStudentDriveLimits()
  if (bytes.length > maxFileBytes) throw new DriveError('FILE_TOO_LARGE', 413)
  if ((await getStudentUsedBytes(file.studentId)) - file.sizeBytes + bytes.length > quotaBytes) throw new DriveError('QUOTA_EXCEEDED', 413)
  const key = `student-files/${file.studentId}/${randomUUID()}.${extOf(file.name)}`
  try {
    await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: bytes, ContentType: mimeType, ACL: 'public-read' }))
  } catch (e) {
    console.error('[replaceStudentFile] upload failed', e)
    throw new DriveError('UPLOAD_FAILED', 502)
  }
  return prisma.studentFile.update({ where: { id: file.id }, data: { key, url: publicUrlForKey(key), sizeBytes: bytes.length, mimeType } })
}

/** The parent must be the student's own and leave room for one more level. */
export async function resolveOwnParent(studentId: string, parentId: string | null): Promise<{ ancestorIds: string[] } | 'NOT_FOUND' | 'TOO_DEEP'> {
  if (!parentId) return { ancestorIds: [] }
  const parent = await prisma.studentFolder.findFirst({ where: { id: parentId, studentId } })
  if (!parent) return 'NOT_FOUND'
  if (parent.ancestorIds.length + 1 >= MAX_FOLDER_DEPTH) return 'TOO_DEEP'
  return { ancestorIds: [...parent.ancestorIds, parent.id] }
}

/** The folder lecture notes are saved into by default — created on first save. */
export async function ensureLecturesFolder(studentId: string, name: string): Promise<string> {
  const existing = await prisma.studentFolder.findFirst({ where: { studentId, parentId: null, name }, select: { id: true } })
  if (existing) return existing.id
  const created = await prisma.studentFolder.create({ data: { studentId, name } })
  return created.id
}
