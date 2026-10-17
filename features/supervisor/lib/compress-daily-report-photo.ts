/**
 * @file features/supervisor/lib/compress-daily-report-photo.ts
 * @purpose فشرده‌سازی عکس قبل از آپلود (محدودیت حجم Vercel)
 * @safe-to-edit YES
 * @affects آپلود عکس گزارش روزانه
 * @depends-on features/supervisor/lib/daily-report-photos
 */

/** Stay under typical serverless multipart limits (~4.5MB). */
export const DAILY_REPORT_UPLOAD_TARGET_BYTES = 3 * 1024 * 1024
const MAX_EDGE = 1920

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image_load_failed'))
    }
    img.src = url
  })
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  )
  if (!blob) throw new Error('image_encode_failed')
  return blob
}

/**
 * Resize/compress phone photos so the Next.js API route accepts them.
 * Returns the original file when already small enough or compression is unavailable.
 */
export async function compressDailyReportPhoto(file: File): Promise<File> {
  if (typeof window === 'undefined') return file
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return file
  }
  if (file.size <= DAILY_REPORT_UPLOAD_TARGET_BYTES && file.type === 'image/jpeg') {
    return file
  }

  try {
    const img = await loadImage(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
    const width = Math.max(1, Math.round(img.width * scale))
    const height = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, width, height)

    let quality = 0.85
    let blob = await canvasToJpegBlob(canvas, quality)
    while (blob.size > DAILY_REPORT_UPLOAD_TARGET_BYTES && quality > 0.45) {
      quality -= 0.1
      blob = await canvasToJpegBlob(canvas, quality)
    }

    if (blob.size >= file.size && file.size <= DAILY_REPORT_UPLOAD_TARGET_BYTES) {
      return file
    }

    const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}
