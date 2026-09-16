/**
 * Compress an image File/Blob to a JPEG `File` via canvas, for cases that
 * need to hand the result to an uploader (`uploadFile()` / `POST /api/upload`
 * — a `FormData` file field, not a data URL). Sibling to
 * `compressImageToBase64` in `./compressImage.ts`, which returns a base64
 * data URL for inline/preview use instead.
 *
 * @param file      Source file (image/*)
 * @param maxWidth  Max width in pixels (default 1600)
 * @param maxHeight Max height in pixels (default 1600)
 * @param quality   JPEG quality 0–1 (default 0.75)
 */
export function compressImageForUpload(
  file: File | Blob,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.75,
): Promise<File> {
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
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return }
          const originalName = file instanceof File ? file.name : 'image'
          const baseName = originalName.replace(/\.[^./]+$/, '') || 'image'
          resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}
