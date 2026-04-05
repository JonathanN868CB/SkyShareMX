/**
 * PDFium Web Worker — renders PDF pages to JPEG using Google's PDFium (WASM).
 *
 * PDFium is the same engine Chrome uses to render PDFs, so it handles all
 * compression codecs including JBIG2 and CCITTFax that PDF.js cannot decode.
 *
 * Messages IN:
 *   { type: "render", pdfBytes: ArrayBuffer, dpi?: number }
 *
 * Messages OUT:
 *   { type: "init" }                                 — WASM loaded
 *   { type: "pageCount", pageCount: number }          — doc opened
 *   { type: "page", pageNumber, jpeg, width, height } — one page rendered
 *   { type: "done", pageCount }                       — all pages done
 *   { type: "error", error: string }                  — fatal error
 */

import { init, type WrappedPdfiumModule } from "@embedpdf/pdfium"

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@2.13.0/dist/pdfium.wasm"

let lib: WrappedPdfiumModule | null = null

async function loadPdfium(): Promise<WrappedPdfiumModule> {
  if (lib) return lib
  const resp = await fetch(WASM_URL)
  const wasmBinary = await resp.arrayBuffer()
  lib = await init({ wasmBinary })
  lib.PDFiumExt_Init()
  return lib
}

self.onmessage = async (e: MessageEvent) => {
  const { type, pdfBytes, dpi = 150 } = e.data
  if (type !== "render") return

  try {
    const pdfium = await loadPdfium()
    self.postMessage({ type: "init" })

    const bytes = new Uint8Array(pdfBytes)

    // Allocate WASM memory and copy PDF bytes
    const dataPtr = pdfium.pdfium.wasmExports.malloc(bytes.length)
    pdfium.pdfium.HEAPU8.set(bytes, dataPtr)

    const doc = pdfium.FPDF_LoadMemDocument(dataPtr, bytes.length, "")
    if (!doc) {
      pdfium.pdfium.wasmExports.free(dataPtr)
      self.postMessage({ type: "error", error: "PDFium failed to open document" })
      return
    }

    const pageCount = pdfium.FPDF_GetPageCount(doc)
    self.postMessage({ type: "pageCount", pageCount })

    for (let i = 0; i < pageCount; i++) {
      const page = pdfium.FPDF_LoadPage(doc, i)
      if (!page) {
        self.postMessage({
          type: "page",
          pageNumber: i + 1,
          jpeg: null,
          width: 0,
          height: 0,
        })
        continue
      }

      // Page dimensions in points (1 pt = 1/72 inch)
      const widthPt = pdfium.FPDF_GetPageWidthF(page)
      const heightPt = pdfium.FPDF_GetPageHeightF(page)

      // Convert to pixels at target DPI
      const pxW = Math.round((widthPt * dpi) / 72)
      const pxH = Math.round((heightPt * dpi) / 72)

      // Create bitmap (0 = no alpha → BGRx format)
      const bitmap = pdfium.FPDFBitmap_Create(pxW, pxH, 0)
      if (!bitmap) {
        pdfium.FPDF_ClosePage(page)
        continue
      }

      // Fill white background (0xFFFFFFFF = white in ARGB)
      pdfium.FPDFBitmap_FillRect(bitmap, 0, 0, pxW, pxH, 0xffffffff)

      // Render page onto bitmap
      // Flags: FPDF_ANNOT (0x01) | FPDF_PRINTING (0x800)
      pdfium.FPDF_RenderPageBitmap(bitmap, page, 0, 0, pxW, pxH, 0, 0x01 | 0x800)

      // Read pixel buffer — PDFium uses BGRA byte order
      const bufPtr = pdfium.FPDFBitmap_GetBuffer(bitmap)
      const stride = pdfium.FPDFBitmap_GetStride(bitmap)
      const pixelData = new Uint8Array(
        pdfium.pdfium.HEAPU8.buffer,
        bufPtr,
        stride * pxH,
      )

      // Convert BGRA → RGBA for ImageData
      const rgba = new Uint8ClampedArray(pxW * pxH * 4)
      for (let y = 0; y < pxH; y++) {
        for (let x = 0; x < pxW; x++) {
          const srcIdx = y * stride + x * 4
          const dstIdx = (y * pxW + x) * 4
          rgba[dstIdx] = pixelData[srcIdx + 2] // R ← B
          rgba[dstIdx + 1] = pixelData[srcIdx + 1] // G ← G
          rgba[dstIdx + 2] = pixelData[srcIdx] // B ← R
          rgba[dstIdx + 3] = 255 // A
        }
      }

      // Encode to JPEG via OffscreenCanvas
      const canvas = new OffscreenCanvas(pxW, pxH)
      const ctx = canvas.getContext("2d")!
      ctx.putImageData(new ImageData(rgba, pxW, pxH), 0, 0)
      const blob = await canvas.convertToBlob({
        type: "image/jpeg",
        quality: 0.85,
      })
      const jpeg = await blob.arrayBuffer()

      // Clean up this page
      pdfium.FPDFBitmap_Destroy(bitmap)
      pdfium.FPDF_ClosePage(page)

      // Transfer jpeg buffer (zero-copy)
      self.postMessage(
        { type: "page", pageNumber: i + 1, jpeg, width: pxW, height: pxH },
        [jpeg],
      )
    }

    pdfium.FPDF_CloseDocument(doc)
    pdfium.pdfium.wasmExports.free(dataPtr)

    self.postMessage({ type: "done", pageCount })
  } catch (err) {
    self.postMessage({
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
