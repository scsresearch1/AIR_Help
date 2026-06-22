/** Save any file blob to disk (no extra tabs). */
export function saveFileBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function zipFilenameForRef(ref: string): string {
  const slug = ref.split('/').pop() ?? ref
  return `${slug.replace(/[^\w.-]/g, '_')}.zip`
}
