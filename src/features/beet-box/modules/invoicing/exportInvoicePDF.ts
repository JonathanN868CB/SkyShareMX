import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import type { Invoice } from "../../data/mockData"

/**
 * Captures the on-screen invoice element and exports it as a PDF that looks
 * identical to the rendered UI. Falls back to a text-only PDF if capture fails.
 */
export async function exportInvoicePDF(element: HTMLElement, inv: Invoice): Promise<void> {
  // Temporarily expand the element to full height so nothing is clipped
  const originalOverflow = element.style.overflow
  element.style.overflow = "visible"

  const canvas = await html2canvas(element, {
    backgroundColor: null,   // preserve transparent/dark background
    scale: 2,                 // 2× for crisp text on retina and print
    useCORS: true,
    logging: false,
    // Scroll the element into view and capture from its natural position
    x: 0,
    y: 0,
    scrollX: 0,
    scrollY: 0,
  })

  element.style.overflow = originalOverflow

  const imgData  = canvas.toDataURL("image/png")
  const imgW     = canvas.width
  const imgH     = canvas.height

  // Letter page in portrait, margins in mm
  const margin   = 12   // mm
  const pageW    = 215.9
  const pageH    = 279.4
  const printW   = pageW - margin * 2   // usable width in mm

  // Scale the captured image to fit the usable width
  const scale    = printW / imgW
  const printH   = imgH * scale         // rendered height in mm

  const doc = new jsPDF({
    orientation: printH > pageH - margin * 2 ? "portrait" : "portrait",
    unit: "mm",
    format: "letter",
  })

  // If the invoice is taller than one page, split across multiple pages
  const usablePageH  = pageH - margin * 2
  const totalPages   = Math.ceil(printH / usablePageH)

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage()

    // y-offset inside the source image for this page (in source pixels)
    const srcY      = (page * usablePageH) / scale
    const srcSliceH = Math.min(usablePageH / scale, imgH - srcY)

    // Create a slice canvas for this page
    const sliceCanvas = document.createElement("canvas")
    sliceCanvas.width  = imgW
    sliceCanvas.height = Math.ceil(srcSliceH)
    const ctx = sliceCanvas.getContext("2d")!
    ctx.drawImage(canvas, 0, -srcY)

    const sliceData   = sliceCanvas.toDataURL("image/png")
    const slicePrintH = srcSliceH * scale

    doc.addImage(sliceData, "PNG", margin, margin, printW, slicePrintH, undefined, "FAST")
  }

  doc.save(`${inv.invoiceNumber}.pdf`)
}
