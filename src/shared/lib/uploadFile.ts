export async function uploadFile(file: File, folder = 'misc'): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  const res = await fetch('/api/upload', {method: 'POST', body: formData})
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Upload failed')
  }
  const data = await res.json()
  return data.url as string
}
