// Copies the lite single-thread Stockfish build (GPL-3) from node_modules into public/stockfish/.
// Runs on postinstall; a no-op when the dev dependency is absent (prod installs) — the files are committed.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const src = join(process.cwd(), 'node_modules', 'stockfish')
const out = join(process.cwd(), 'public', 'stockfish')
if (!existsSync(join(src, 'bin'))) process.exit(0)

mkdirSync(out, { recursive: true })
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) copyFileSync(join(src, 'bin', f), join(out, f))
copyFileSync(join(src, 'Copying.txt'), join(out, 'LICENSE.txt'))
writeFileSync(
  join(out, 'README.md'),
  `# Stockfish 19 (lite, single-threaded WASM)

Chess engine used by GoodWorker's chess section, run in the browser as a Web Worker.

- Stockfish: https://github.com/official-stockfish/Stockfish (GPL-3.0)
- WASM build: https://github.com/nmrugg/stockfish.js (npm \`stockfish\` 19), GPL-3.0
- License text: LICENSE.txt. Source code for these exact files: https://github.com/nmrugg/stockfish.js/tree/v19.0.1

Copied from node_modules by scripts/copy-stockfish.mjs — do not edit by hand.
`
)
