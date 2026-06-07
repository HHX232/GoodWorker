/**
 * Compress an image File/Blob to a base64 data URL using canvas.
 * @param file      Source file (image/*)
 * @param maxWidth  Max width in pixels (default 1200)
 * @param maxHeight Max height in pixels (default 900)
 * @param quality   JPEG quality 0–1 (default 0.75)
 */
export function compressImageToBase64(
  file: File | Blob,
  maxWidth = 1200,
  maxHeight = 900,
  quality = 0.75,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }

      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}

/** Smaller version specifically for thumbnails / previews (max 600px). */
export function compressImageToThumbnail(file: File | Blob): Promise<string> {
  return compressImageToBase64(file, 600, 450, 0.7)
}
