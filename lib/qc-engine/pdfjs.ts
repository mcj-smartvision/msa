type PdfJsPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number }
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => {
    promise: Promise<void>
  }
}

type PdfJsDocument = {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfJsPage>
}

type PdfJsLib = {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (opts: { data: Uint8Array | ArrayBuffer }) => { promise: Promise<PdfJsDocument> }
}

let loading: Promise<PdfJsLib> | null = null

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-msa-pdfjs="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === '1') {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('pdf.js load failed')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.msaPdfjs = src
    script.onload = () => {
      script.dataset.loaded = '1'
      resolve()
    }
    script.onerror = () => reject(new Error('pdf.js load failed'))
    document.head.appendChild(script)
  })
}

export async function loadPdfJs(): Promise<PdfJsLib> {
  if (typeof window === 'undefined') throw new Error('pdf.js is browser-only')
  const existing = (window as Window & { pdfjsLib?: PdfJsLib }).pdfjsLib
  if (existing) return existing
  if (!loading) {
    loading = (async () => {
      const cdn = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      const cdnWorker = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      await loadScript(cdn)
      const lib = (window as Window & { pdfjsLib?: PdfJsLib }).pdfjsLib
      if (!lib) throw new Error('pdf.js load failed')
      lib.GlobalWorkerOptions.workerSrc = cdnWorker
      return lib
    })()
  }
  return loading
}

export async function renderPdfPage(bytes: Uint8Array, canvas: HTMLCanvasElement, pageNumber: number, maxDim = 2200) {
  const pdfjs = await loadPdfJs()
  const data = bytes.slice()
  const pdf = await pdfjs.getDocument({ data }).promise
  const page = await pdf.getPage(Math.min(Math.max(1, pageNumber), pdf.numPages))
  const unscaled = page.getViewport({ scale: 1 })
  const scale = Math.min(maxDim / unscaled.width, maxDim / unscaled.height, 2)
  const viewport = page.getViewport({ scale })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return { pageCount: pdf.numPages, width: canvas.width, height: canvas.height }
}
