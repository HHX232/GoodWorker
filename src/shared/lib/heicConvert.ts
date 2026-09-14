// iPhones save photos as HEIC/HEIF by default. No vision AI accepts that
// format directly, and no browser except Safari can even decode it — so
// every upload entry point that takes photos (info-pdf-to-test, PdfImportModal)
// must convert to JPEG client-side before the file ever reaches validation
// or a fetch() call, rather than teaching every backend route about HEIC.
export async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
  const blob = Array.isArray(result) ? result[0] : result
  const name = file.name.replace(/\.(heic|heif)$/i, '.jpg')
  return new File([blob], name, { type: 'image/jpeg' })
}

// Converts every HEIC/HEIF file in the list to JPEG (in place, same order),
// leaving already-supported formats untouched. A single bad HEIC file is
// dropped rather than failing the whole batch.
export async function convertHeicFiles(files: File[], isHeic: (name: string) => boolean): Promise<File[]> {
  const out: File[] = []
  for (const f of files) {
    if (!isHeic(f.name)) { out.push(f); continue }
    try {
      out.push(await convertHeicToJpeg(f))
    } catch (e) {
      console.error('[heicConvert] failed to convert', f.name, e)
    }
  }
  return out
}
