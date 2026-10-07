// npx tsx src/widgets/Files/Books/cover-crop.selfcheck.ts
import assert from 'node:assert/strict'
import { cropRect } from './cover-crop'

// Hand-worked: image 1200x600 into a 600x900 (2:3) frame.
// Cover-fit scale = max(600/1200, 900/600) = 1.5 -> displayed 1800x900, the visible
// window in source pixels is 400x600, centred: sx = (1200-400)/2 = 400, sy = 0.
assert.deepEqual(cropRect(1200, 600, 600, 900, 1, 0, 0), { sx: 400, sy: 0, sw: 400, sh: 600 })

// Slider ends push the image to the edge: the window reaches the image border (0 / 1200-400).
assert.deepEqual(cropRect(1200, 600, 600, 900, 1, 100, 0), { sx: 0, sy: 0, sw: 400, sh: 600 })
assert.deepEqual(cropRect(1200, 600, 600, 900, 1, -100, 0), { sx: 800, sy: 0, sw: 400, sh: 600 })
// Out-of-range sliders are clamped, never a blank strip.
assert.deepEqual(cropRect(1200, 600, 600, 900, 1, 500, 0), { sx: 0, sy: 0, sw: 400, sh: 600 })

// Zoom 2: scale 3 -> window 200x300 centred at (500,150); y=100 slides to the top edge.
assert.deepEqual(cropRect(1200, 600, 600, 900, 2, 0, 0), { sx: 500, sy: 150, sw: 200, sh: 300 })
assert.deepEqual(cropRect(1200, 600, 600, 900, 2, 0, 100), { sx: 500, sy: 0, sw: 200, sh: 300 })

// Portrait 600x1200: scale 1, no horizontal slack (x does nothing), 300px vertical slack.
assert.deepEqual(cropRect(600, 1200, 600, 900, 1, 0, 0), { sx: 0, sy: 150, sw: 600, sh: 900 })
assert.deepEqual(cropRect(600, 1200, 600, 900, 1, 100, 0), { sx: 0, sy: 150, sw: 600, sh: 900 })
assert.deepEqual(cropRect(600, 1200, 600, 900, 1, 0, -100), { sx: 0, sy: 300, sw: 600, sh: 900 })

// Zoom is clamped to 1..3. 600x900 image in a 600x900 frame: base scale 1.
// zoom 0.5 -> 1: the whole image. zoom 10 -> 3: scale 3, window 200x300 centred at (200,300).
assert.deepEqual(cropRect(600, 900, 600, 900, 0.5, 0, 0), { sx: 0, sy: 0, sw: 600, sh: 900 })
assert.deepEqual(cropRect(600, 900, 600, 900, 10, 0, 0), { sx: 200, sy: 300, sw: 200, sh: 300 })

// Shift beyond +-100 is clamped on both axes. 1200x600, zoom 2: scale 3, window 200x300;
// slack = 500 source px each side in x ((3600-600)/2/3) and 150 in y ((1800-900)/2/3).
assert.deepEqual(cropRect(1200, 600, 600, 900, 2, 500, 500), { sx: 0, sy: 0, sw: 200, sh: 300 })
assert.deepEqual(cropRect(1200, 600, 600, 900, 2, -500, -500), { sx: 1000, sy: 300, sw: 200, sh: 300 })
// +-100 exactly gives the same edges at zoom 2.
assert.deepEqual(cropRect(1200, 600, 600, 900, 2, 100, 0), { sx: 0, sy: 150, sw: 200, sh: 300 })
assert.deepEqual(cropRect(1200, 600, 600, 900, 2, -100, 0), { sx: 1000, sy: 150, sw: 200, sh: 300 })
// Zoom 3 on 600x900: slack 200 px in x, 300 px in y; centre (200,300).
assert.deepEqual(cropRect(600, 900, 600, 900, 3, 100, 100), { sx: 0, sy: 0, sw: 200, sh: 300 })
assert.deepEqual(cropRect(600, 900, 600, 900, 3, -100, -100), { sx: 400, sy: 600, sw: 200, sh: 300 })

console.log('cover-crop selfcheck: ok')
