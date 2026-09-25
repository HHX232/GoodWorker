// Self-check for access.ts's canStudentSee — run with
// `npx tsx src/shared/lib/tutorFiles/access.selfcheck.ts`. Pure function, no
// DB needed. No test runner in this project (see CLAUDE.md).
import { canStudentSee } from './access'

let failures = 0
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++
    console.error(`FAIL ${label}`)
  } else {
    console.log(`PASS ${label}`)
  }
}

// ── Scenario 1: explicit grant directly on the file ──
assert(
  canStudentSee({ id: 'file-1', ancestorIds: ['folder-a'], restrictedToStudentId: null }, 'student-s', new Set(['file-1'])),
  'canStudentSee: direct grant on the item itself is visible',
)

// ── Scenario 2: grant on an ancestor folder, several levels up ──
assert(
  canStudentSee(
    { id: 'file-2', ancestorIds: ['folder-a', 'folder-b', 'folder-c'], restrictedToStudentId: null },
    'student-s',
    new Set(['folder-a']), // grant sits on the top-level ancestor, not the immediate parent
  ),
  'canStudentSee: grant on a multi-level ancestor is visible',
)

// ── Scenario 3: no grant anywhere (neither item nor any ancestor) ──
assert(
  !canStudentSee({ id: 'file-3', ancestorIds: ['folder-a', 'folder-b'], restrictedToStudentId: null }, 'student-s', new Set(['folder-x'])),
  'canStudentSee: no grant on item or any ancestor is invisible',
)

// ── Scenario 4: student A's "учебная" subfolder invisible to student B, who
// has a grant on the shared parent folder ──
const studentAsStudySubfolder = { id: 'study-a', ancestorIds: ['folder-shared'], restrictedToStudentId: 'student-a' }
assert(
  !canStudentSee(studentAsStudySubfolder, 'student-b', new Set(['folder-shared'])),
  "canStudentSee: another student's restricted study subfolder stays invisible despite a grant on the shared parent",
)
// ...but it IS visible to the student it's restricted to, via the same parent grant.
assert(
  canStudentSee(studentAsStudySubfolder, 'student-a', new Set(['folder-shared'])),
  'canStudentSee: the restricted subfolder is visible to the student it belongs to',
)

if (failures > 0) {
  console.error(`access.selfcheck: ${failures} check(s) FAILED`)
  process.exit(1)
}
console.log('access.selfcheck: all checks passed')
