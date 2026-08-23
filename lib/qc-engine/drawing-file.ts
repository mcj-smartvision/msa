export type DrawingPreviewKind = 'pdf' | 'image' | 'unsupported'

export function sniffDrawingKind(bytes: Uint8Array, fileName = '', contentType = ''): DrawingPreviewKind {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image'
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image'
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image'
  }
  const name = fileName.toLowerCase()
  const type = contentType.toLowerCase()
  if (type.includes('pdf') || name.endsWith('.pdf')) return 'pdf'
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name)) return 'image'
  return 'unsupported'
}

export function drawingFileUrl(drawingId: string) {
  return `/api/technical-office/drawings/${encodeURIComponent(drawingId)}/file`
}

export async function fetchDrawingBytes(drawingId: string): Promise<{
  bytes: Uint8Array
  fileName: string
  contentType: string
}> {
  const res = await fetch(drawingFileUrl(drawingId))
  const fileName = decodeURIComponent(res.headers.get('X-File-Name') || 'drawing')
  const contentType = res.headers.get('Content-Type') || 'application/octet-stream'
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error || 'بارگذاری نقشه انجام نشد.')
  }
  const buffer = await res.arrayBuffer()
  return { bytes: new Uint8Array(buffer), fileName, contentType }
}
