/**
 * Client-side PDF page rendering using PDFium WASM (via Web Worker).
 *
 * Used at upload time to pre-render page images for PDFs that contain
 * JBIG2 or CCITTFax compression — codecs that PDF.js cannot decode.
 * The rendered JPEGs are uploaded to Storage alongside the PDF so the
 * viewer has an instant fallback path.
 */

// ─── Codec detection ─────────────────────────────────────────────────────────

const PROBLEMATIC_CODECS = ["/JBIG2Decode", "/CCITTFaxDecode"]

/**
 * Scan raw PDF bytes for JBIG2 or CCITTFax filter declarations.
 * Uses 64 KB chunks with overlap so needles split across boundaries are found.
 * Fast — runs in < 50 ms on an 85 MB file.
 */
export function pdfHasProblematicCodec(
  bytes: Uint8Array,
): { found: boolean; codec: string | null } {
  const maxLen = Math.max(...PROBLEMATIC_CODECS.map((n) => n.length))
  const decoder = new TextDecoder("ascii", { fatal: false })
  const CHUNK = 64 * 1024

  for (let offset = 0; offset < bytes.length; offset += CHUNK - maxLen) {
    const end = Math.min(offset + CHUNK, bytes.length)
    const chunk = decoder.decode(bytes.subarray(offset, end))
    for (const needle of PROBLEMATIC_CODECS) {
      if (chunk.includes(needle)) {
        return { found: true, codec: needle.slice(1) }
      }
    }
  }
  return { found: false, codec: null }
}

// ─── Page rendering via Web Worker ───────────────────────────────────────────

export interface RenderedPage {
  pageNumber: number
  jpeg: Uint8Array
  width: number
  height: number
}

export interface RenderProgress {
  phase: "loading" | "rendering" | "done" | "error"
  pagesRendered: number
  totalPages: number
  error?: string
}

/**
 * Render all pages of a PDF to JPEG using PDFium WASM in a Web Worker.
 *
 * @param pdfBytes  Raw PDF file bytes
 * @param dpi       Render resolution (default 150 — good balance of size vs quality)
 * @param onProgress  Called after each page completes
 * @returns  Array of rendered page images
 */
export function renderPdfPages(
  pdfBytes: Uint8Array,
  dpi = 150,
  onProgress?: (progress: RenderProgress) => void,
): Promise<RenderedPage[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./pdfium-render-worker.ts", import.meta.url),
      { type: "module" },
    )

    const pages: RenderedPage[] = []
    let totalPages = 0

    onProgress?.({ phase: "loading", pagesRendered: 0, totalPages: 0 })

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data

      switch (msg.type) {
        case "init":
          // WASM loaded, document about to be opened
          break

        case "pageCount":
          totalPages = msg.pageCount
          onProgress?.({ phase: "rendering", pagesRendered: 0, totalPages })
          break

        case "page":
          if (msg.jpeg) {
            pages.push({
              pageNumber: msg.pageNumber,
              jpeg: new Uint8Array(msg.jpeg),
              width: msg.width,
              height: msg.height,
            })
          }
          onProgress?.({
            phase: "rendering",
            pagesRendered: pages.length,
            totalPages,
          })
          break

        case "done":
          worker.terminate()
          onProgress?.({
            phase: "done",
            pagesRendered: pages.length,
            totalPages,
          })
          resolve(pages)
          break

        case "error":
          worker.terminate()
          onProgress?.({
            phase: "error",
            pagesRendered: pages.length,
            totalPages,
            error: msg.error,
          })
          reject(new Error(msg.error))
          break
      }
    }

    worker.onerror = (err) => {
      worker.terminate()
      reject(new Error(err.message ?? "Worker error"))
    }

    // Transfer the buffer to the worker (zero-copy)
    const buffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    )
    worker.postMessage({ type: "render", pdfBytes: buffer, dpi }, [buffer])
  })
}
