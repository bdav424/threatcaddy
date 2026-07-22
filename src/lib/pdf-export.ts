// CaddyLab Stage 6 — PDF export.
//
// Client-side only (CaddyLab's no-server charter): the product's rendered
// HTML — the same markup the on-screen preview shows, with charts inlined as
// images — is rasterized to a canvas and paged into a Letter-size PDF. This
// is exactly the spec's "charts flatten to images automatically on PDF
// export": the native editable Word chart serves the docx/Word-editing
// window, and the PDF deliverable is a faithful flattened snapshot regardless.
//
// jsPDF + html2canvas are heavy, so they're dynamically imported here and this
// module is only ever pulled in when the analyst actually exports a PDF.

const PAGE_PIXEL_WIDTH = 816; // 8.5in at 96dpi — the offscreen render width.
const PAGE_PADDING = '64px 67px'; // ~0.65in top/bottom, 0.7in sides, matching the print stylesheet.

/** Rasterizes an SVG markup string to a PNG data URL. html2canvas is
 * unreliable with inline <svg> (it stalls waiting on an image that never
 * fires load), so charts are flattened to PNG up front — which is also
 * exactly the spec's "charts flatten to images on PDF export." */
export function svgToPngDataUrl(svgMarkup: string, width = 440, height = 240, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    // The root <svg> needs an explicit namespace + pixel dimensions for an
    // <img> to render it; React's server markup omits both. A data: URL is
    // used rather than a blob: URL because blob-URL SVGs load unreliably (they
    // can silently never fire load/error) in some headless/embedded browsers.
    let svg = svgMarkup;
    if (!/xmlns=/.test(svg)) svg = svg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
    svg = svg.replace(/<svg\b/, `<svg width="${width}" height="${height}"`);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    const image = new Image();
    // Guard: never let a stuck image load hang the whole PDF export.
    const timer = setTimeout(() => reject(new Error('Chart rasterization timed out.')), 8000);
    image.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas 2D context unavailable.')); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    image.onerror = () => { clearTimeout(timer); reject(new Error('Failed to rasterize chart SVG.')); };
    image.src = url;
  });
}

/** Renders a body-HTML fragment (styled by `css`) to a multi-page Letter PDF
 * and triggers a download. The fragment is mounted offscreen in the live
 * document so its CSS + any inline SVG charts render exactly as on screen. */
export async function exportBodyToPdf(bodyHtml: string, css: string, fileName: string): Promise<void> {
  const [jsPdfModule, html2canvasModule] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const { jsPDF } = jsPdfModule;
  const html2canvas = html2canvasModule.default;

  const container = document.createElement('div');
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_PIXEL_WIDTH}px;background:#ffffff;padding:${PAGE_PADDING};box-sizing:border-box;`;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  container.appendChild(styleEl);
  const content = document.createElement('div');
  content.innerHTML = bodyHtml;
  container.appendChild(content);
  document.body.appendChild(container);

  try {
    // Let webfonts settle so text metrics match the on-screen render.
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* fonts API may reject in headless; render anyway */ }
    }
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', windowWidth: PAGE_PIXEL_WIDTH });
    const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageHeight = (canvas.height * pageWidth) / canvas.width;
    const imageData = canvas.toDataURL('image/jpeg', 0.92);

    let position = 0;
    let remaining = imageHeight;
    pdf.addImage(imageData, 'JPEG', 0, position, pageWidth, imageHeight);
    remaining -= pageHeight;
    while (remaining > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imageData, 'JPEG', 0, position, pageWidth, imageHeight);
      remaining -= pageHeight;
    }
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}
