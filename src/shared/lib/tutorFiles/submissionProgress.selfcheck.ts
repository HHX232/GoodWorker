// Self-check for buildSubmissionProgress (pure, no DB). No test runner in this
// project (see CLAUDE.md): `npx tsx src/shared/lib/tutorFiles/submissionProgress.selfcheck.ts`.
// Expected numbers are worked out by hand from the fixture below.
import assert from 'node:assert/strict'
import { buildSubmissionProgress } from './submissionProgress'

// Homework folder "hw" with 5 students. Personal subfolders (s1..s4; s5 has none):
//   s1: two files, both accepted        -> done
//   s2: one accepted + one unreviewed   -> waiting (unreviewed beats accepted)
//   s3: one accepted + one in revision  -> working
//   s4: empty subfolder                 -> not started
//   s5: no subfolder at all             -> not started
const hw = { id: 'hw', allowStudentUpload: true, restrictedToStudentId: null, grants: ['s1', 's2', 's3', 's4', 's5'].map(studentId => ({ studentId })) }
const personal = (id: string, student: string) => ({ id, allowStudentUpload: false, restrictedToStudentId: student, grants: [] })
const subfolders = ['s1', 's2', 's3', 's4'].map(s => ({ id: `p-${s}`, parentId: 'hw', restrictedToStudentId: s }))
const uploads = [
  { folderId: 'p-s1', status: 'ACCEPTED' }, { folderId: 'p-s1', status: 'ACCEPTED' },
  { folderId: 'p-s2', status: 'ACCEPTED' }, { folderId: 'p-s2', status: null },
  { folderId: 'p-s3', status: 'ACCEPTED' }, { folderId: 'p-s3', status: 'REVISION' },
]

const p = buildSubmissionProgress([hw, personal('p-s2', 's2'), personal('p-s4', 's4')], subfolders, uploads)

assert.deepEqual(p.get('hw'), { unit: 'students', done: 1, waiting: 1, working: 1, notStarted: 2, total: 5 })
assert.deepEqual(p.get('p-s2'), { unit: 'files', done: 1, waiting: 1, working: 0, notStarted: 0, total: 2 })
assert.deepEqual(p.get('p-s4'), { unit: 'files', done: 0, waiting: 0, working: 0, notStarted: 0, total: 0 })
// A plain folder gets no progress; a submissions folder nobody can open is an empty bar, not NaN.
assert.equal(buildSubmissionProgress([{ id: 'x', allowStudentUpload: false, restrictedToStudentId: null, grants: [] }], [], []).size, 0)
assert.equal(buildSubmissionProgress([{ ...hw, grants: [] }], [], []).get('hw')?.total, 0)

console.log('submissionProgress selfcheck: ok')
