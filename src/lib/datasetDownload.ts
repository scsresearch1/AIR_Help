/** Save any file blob to disk (no extra tabs). */
export function saveFileBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function zipFilenameForRef(ref: string): string {
  const slug = ref.split('/').pop() ?? ref
  return `${slug.replace(/[^\w.-]/g, '_')}.zip`
}

export function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: contentType })
}

export async function isValidZipBlob(blob: Blob): Promise<boolean> {
  if (blob.size < 22) return false
  const buf = new Uint8Array(await blob.slice(0, 4).arrayBuffer())
  // ZIP local file header or empty archive EOCD
  return (
    (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) ||
    (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x05 && buf[3] === 0x06)
  )
}
