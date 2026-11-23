import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const colorCache = new Map<string, string>();

function resolveCssColor(colorStr: string): string {
  if (!colorStr) return '#000000';
  if (colorCache.has(colorStr)) return colorCache.get(colorStr)!;

  let resolved = '#000000';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      if (a === 0) {
        resolved = 'transparent';
      } else if (a === 255) {
        resolved = `rgb(${r}, ${g}, ${b})`;
      } else {
        resolved = `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`;
      }
    }
  } catch {
    resolved = '#000000';
  }

  colorCache.set(colorStr, resolved);
  return resolved;
}

function cleanUnsupportedColors(cssText: string): string {
  if (!cssText) return cssText;
  return cssText.replace(/(oklch|oklab|lch|lab|color-mix)\([^\)]*(?:\([^\)]*\)[^\)]*)*\)/gi, (match) => {
    return resolveCssColor(match);
  });
}

function prepareCloneForCapture(
  clonedDoc: Document,
  clonedEl: HTMLElement,
  isThermal: boolean,
  isReport: boolean,
  isLandscape: boolean
) {
  // Remove dark mode class and unclip ALL ancestors so modal max-h-[95vh] / h-screen / overflow-hidden NEVER clips rows
  if (clonedDoc.documentElement) {
    clonedDoc.documentElement.classList.remove('dark');
    clonedDoc.documentElement.style.height = 'auto';
    clonedDoc.documentElement.style.overflow = 'visible';
  }
  if (clonedDoc.body) {
    clonedDoc.body.classList.remove('dark');
    clonedDoc.body.style.height = 'auto';
    clonedDoc.body.style.maxHeight = 'none';
    clonedDoc.body.style.overflow = 'visible';
  }
  let current: HTMLElement | null = clonedEl;
  while (current) {
    current.classList.remove('dark');
    if (current !== clonedEl) {
      current.style.overflow = 'visible';
      current.style.height = 'auto';
      current.style.minHeight = '0px';
      current.style.maxHeight = 'none';
      if (
        current.classList.contains('fixed') ||
        current.classList.contains('h-screen') ||
        current.classList.contains('overflow-hidden') ||
        current.classList.contains('overflow-y-auto')
      ) {
        current.style.position = 'static';
        current.style.display = 'block';
      }
    }
    current = current.parentElement;
  }

  // 1. Sanitize all <style> tags in the cloned document for html2canvas parser
  const styleTags = clonedDoc.querySelectorAll('style');
  styleTags.forEach((styleTag) => {
    if (styleTag.textContent) {
      styleTag.textContent = cleanUnsupportedColors(styleTag.textContent);
    }
  });

  // 2. Sanitize all inline styles across all cloned elements
  const allElements = clonedDoc.querySelectorAll('*');
  allElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.getAttribute && htmlEl.getAttribute('style')) {
      const currentStyle = htmlEl.getAttribute('style') || '';
      if (/(oklch|oklab|lch|lab|color-mix)/i.test(currentStyle)) {
        htmlEl.setAttribute('style', cleanUnsupportedColors(currentStyle));
      }
    }
  });

  // 3. Clean up any broken or hidden images
  const imgElements = clonedDoc.querySelectorAll('img');
  imgElements.forEach((img) => {
    const htmlImg = img as HTMLImageElement;
    if (!htmlImg.src || htmlImg.src.trim() === '' || htmlImg.style.display === 'none' || htmlImg.classList.contains('hidden')) {
      htmlImg.style.display = 'none';
    }
  });

  // 4. Force solid white background, block layout, and exact A4 width on clone
  clonedEl.style.backgroundColor = '#ffffff';
  clonedEl.style.color = '#000000';
  clonedEl.style.margin = '0 auto';
  clonedEl.style.boxShadow = 'none';
  clonedEl.style.border = 'none';
  clonedEl.style.height = 'auto';
  clonedEl.style.minHeight = '0px';
  clonedEl.style.maxHeight = 'none';
  clonedEl.style.overflow = 'visible';
  clonedEl.querySelectorAll('.overflow-x-auto, .overflow-hidden').forEach((child) => {
    const htmlChild = child as HTMLElement;
    htmlChild.style.overflow = 'visible';
    htmlChild.style.maxWidth = 'none';
  });
  if (isReport) {
    clonedEl.style.display = 'block';
    clonedEl.style.padding = '8px 12px';
  }
  if (!isThermal) {
    const targetW = isLandscape ? '1123px' : '794px';
    clonedEl.style.width = targetW;
    clonedEl.style.minWidth = targetW;
    clonedEl.style.maxWidth = targetW;
  }
}

function findPrimaryTable(root: HTMLElement): { table: HTMLTableElement | null; rowCount: number } {
  const tables = Array.from(root.querySelectorAll('table'));
  let primaryTable: HTMLTableElement | null = null;
  let maxRows = 0;
  tables.forEach((tbl) => {
    const count = tbl.querySelectorAll('tbody tr').length;
    if (count > maxRows) {
      maxRows = count;
      primaryTable = tbl;
    }
  });
  return { table: primaryTable, rowCount: maxRows };
}

interface MeasuredTablePagination {
  clonedHeight: number;
  tableTop: number;
  tableBottom: number;
  theadTop: number;
  theadHeight: number;
  rowBottoms: number[];
}

function measureTableOnClone(clonedEl: HTMLElement): MeasuredTablePagination | null {
  const rootRect = clonedEl.getBoundingClientRect();
  const { table: primaryTable, rowCount } = findPrimaryTable(clonedEl);
  if (!primaryTable || rowCount === 0 || rootRect.height <= 0) return null;

  const tblRect = primaryTable.getBoundingClientRect();
  const theadEl = primaryTable.querySelector('thead');
  const theadRect = theadEl ? theadEl.getBoundingClientRect() : null;
  const rows = Array.from(primaryTable.querySelectorAll('tbody tr, tfoot tr'));
  const rowBottoms = rows
    .map((row) => Math.round(row.getBoundingClientRect().bottom - rootRect.top))
    .filter((y) => y > 0)
    .sort((a, b) => a - b);

  return {
    clonedHeight: rootRect.height,
    tableTop: Math.max(0, tblRect.top - rootRect.top),
    tableBottom: Math.max(0, tblRect.bottom - rootRect.top),
    theadTop: theadRect ? Math.max(0, theadRect.top - rootRect.top) : 0,
    theadHeight: theadRect ? Math.max(0, theadRect.height) : 0,
    rowBottoms,
  };
}

function appendCanvasPagesToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  measuredTable: MeasuredTablePagination | null,
  safeScale: number,
  isFirstChunk: boolean,
  marginMm: number
) {
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfPageHeight = pdf.internal.pageSize.getHeight();
  const usableWidthMm = pdfWidth - marginMm * 2;
  const usableHeightMm = pdfPageHeight - marginMm * 2;
  const canvasPxPerMm = canvas.width / usableWidthMm;
  const maxPageCanvasPx = Math.floor(usableHeightMm * canvasPxPerMm);

  const cropSliceToDataUrl = (startY: number, sliceHeight: number): string => {
    const safeStart = Math.max(0, Math.min(canvas.height - 1, Math.floor(startY)));
    const safeHeight = Math.max(1, Math.min(canvas.height - safeStart, Math.ceil(sliceHeight)));
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = safeHeight;
    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        safeStart,
        canvas.width,
        safeHeight,
        0,
        0,
        canvas.width,
        safeHeight
      );
    }
    return sliceCanvas.toDataURL('image/png', 1.0);
  };

  if (canvas.height <= maxPageCanvasPx + 4) {
    if (!isFirstChunk) pdf.addPage();
    const imgData = canvas.toDataURL('image/png', 1.0);
    const renderedHeightMm = canvas.height / canvasPxPerMm;
    pdf.addImage(imgData, 'PNG', marginMm, marginMm, usableWidthMm, renderedHeightMm, undefined, 'FAST');
    return;
  }

  const pxToCanvasY =
    measuredTable && measuredTable.clonedHeight > 0
      ? canvas.height / measuredTable.clonedHeight
      : safeScale;

  const rowBottomsCanvas = measuredTable
    ? Array.from(new Set(measuredTable.rowBottoms.map((y) => Math.round(y * pxToCanvasY))))
        .filter((y) => y > 0 && y <= canvas.height)
        .sort((a, b) => a - b)
    : [];

  const theadTopCanvas = measuredTable ? Math.round(measuredTable.theadTop * pxToCanvasY) : 0;
  const theadHeightCanvas = measuredTable ? Math.round(measuredTable.theadHeight * pxToCanvasY) : 0;
  const tableTopCanvas = measuredTable ? Math.round(measuredTable.tableTop * pxToCanvasY) : 0;
  const tableBottomCanvas = measuredTable ? Math.round(measuredTable.tableBottom * pxToCanvasY) : 0;

  const canRepeatThead =
    Boolean(measuredTable) &&
    theadHeightCanvas > 4 &&
    theadHeightCanvas < maxPageCanvasPx * 0.40;

  const theadImgData = canRepeatThead
    ? cropSliceToDataUrl(theadTopCanvas, theadHeightCanvas)
    : null;
  const theadHeightMm = theadHeightCanvas / canvasPxPerMm;

  let currentY = 0;
  let localPageIndex = 0;

  while (currentY < canvas.height - 2) {
    if (!isFirstChunk || localPageIndex > 0) {
      pdf.addPage();
    }

    let cursorMmY = marginMm;
    let availableCanvasPx = maxPageCanvasPx;

    const shouldRepeatHeader =
      localPageIndex > 0 &&
      Boolean(theadImgData) &&
      currentY >= tableTopCanvas + theadHeightCanvas &&
      currentY < tableBottomCanvas - 4;

    if (shouldRepeatHeader && theadImgData) {
      pdf.addImage(
        theadImgData,
        'PNG',
        marginMm,
        cursorMmY,
        usableWidthMm,
        theadHeightMm,
        undefined,
        'FAST'
      );
      cursorMmY += theadHeightMm;
      availableCanvasPx = Math.max(100, availableCanvasPx - theadHeightCanvas);
    }

    const idealMaxY = Math.min(canvas.height, currentY + availableCanvasPx);
    let nextY = idealMaxY;

    if (idealMaxY < canvas.height && rowBottomsCanvas.length > 0) {
      let bestRowEnd = -1;
      for (let i = 0; i < rowBottomsCanvas.length; i++) {
        const candidate = rowBottomsCanvas[i];
        if (candidate > currentY + 4 && candidate <= idealMaxY) {
          bestRowEnd = candidate;
        } else if (candidate > idealMaxY) {
          break;
        }
      }
      if (bestRowEnd > currentY) {
        nextY = bestRowEnd;
      }
    }

    const sliceHeight = Math.max(1, nextY - currentY);
    const sliceDataUrl = cropSliceToDataUrl(currentY, sliceHeight);
    const sliceHeightMm = sliceHeight / canvasPxPerMm;

    pdf.addImage(
      sliceDataUrl,
      'PNG',
      marginMm,
      cursorMmY,
      usableWidthMm,
      sliceHeightMm,
      undefined,
      'FAST'
    );

    currentY = nextY;
    localPageIndex += 1;

    if (localPageIndex > 500) break;
  }
}

function stampPdfPageNumbers(pdf: jsPDF, isThermal: boolean, companyName: string = '') {
  if (isThermal) return;
  const totalPages = typeof pdf.getNumberOfPages === 'function' ? pdf.getNumberOfPages() : (pdf.internal.pages.length - 1);
  if (totalPages <= 0) return;
  const marginMm = 8;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let pNum = 1; pNum <= totalPages; pNum++) {
    pdf.setPage(pNum);
    pdf.setFontSize(8);
    pdf.setTextColor(80, 80, 80);
    const leftText = companyName ? `${companyName} • Generated Report` : 'DokanPro ERP • Generated Report';
    pdf.text(leftText, marginMm, pageHeight - 3);
    const pageSerial = `Page ${pNum} of ${totalPages}`;
    pdf.text(pageSerial, pageWidth - marginMm, pageHeight - 3, { align: 'right' });
  }
}

export async function exportElementToPdf(
  element: HTMLElement | null,
  fileName: string = 'document.pdf',
  isLandscape: boolean = false,
  companyName: string = ''
): Promise<boolean> {
  if (!element) {
    window.print();
    return true;
  }

  const targetElement = (element.querySelector('.printable-receipt') ||
    element.querySelector('.printable-invoice-a4') ||
    element.querySelector('.printable-invoice') ||
    element.querySelector('.printable-voucher') ||
    element.querySelector('.printable-report') ||
    element.querySelector('.printable-barcodes') ||
    element.querySelector('.printable-document') ||
    element.firstElementChild ||
    element) as HTMLElement;

  try {
    const isThermal =
      targetElement.classList.contains('printable-receipt') ||
      targetElement.offsetWidth <= 420;

    const isReport = targetElement.classList.contains('printable-report');
    const marginMm = 6;

    if (isThermal) {
      const estimatedHeight = Math.max(targetElement.scrollHeight || 1000, 1000);
      const canvas = await html2canvas(targetElement, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 400,
        windowHeight: estimatedHeight + 400,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc, clonedEl) => {
          prepareCloneForCapture(clonedDoc, clonedEl, true, isReport, false);
        },
      });
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdfWidth = 80;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, Math.max(pdfHeight, 60)],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(fileName);
      return true;
    }

    const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'mm', 'a4');
    const { rowCount: totalTableRows } = findPrimaryTable(targetElement);

    // Chunk capture for very large product/report tables (>80 rows) to stay razor-sharp & well under browser canvas limits
    const CHUNK_ROWS = 75;
    if (isReport && totalTableRows > CHUNK_ROWS) {
      const totalChunks = Math.ceil(totalTableRows / CHUNK_ROWS);
      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const startRow = chunkIdx * CHUNK_ROWS;
        const endRow = Math.min(totalTableRows, startRow + CHUNK_ROWS);
        const isLastChunk = chunkIdx === totalChunks - 1;
        let measuredTable: MeasuredTablePagination | null = null;
        const chunkScale = 1.8;

        const canvas = await html2canvas(targetElement, {
          scale: chunkScale,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: isLandscape ? 1200 : 900,
          windowHeight: 8000,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc, clonedEl) => {
            prepareCloneForCapture(clonedDoc, clonedEl, false, true, isLandscape);
            const { table: clonedTable } = findPrimaryTable(clonedEl);
            if (clonedTable) {
              // Hide report title/header block on subsequent chunks so rows start cleanly with table header
              if (chunkIdx > 0) {
                let sibling = clonedTable.previousElementSibling as HTMLElement | null;
                while (sibling) {
                  sibling.style.display = 'none';
                  sibling = sibling.previousElementSibling as HTMLElement | null;
                }
              }
              const bodyRows = Array.from(clonedTable.querySelectorAll('tbody tr'));
              bodyRows.forEach((tr, rIdx) => {
                if (rIdx < startRow || rIdx >= endRow) {
                  tr.remove();
                }
              });
              const tfoot = clonedTable.querySelector('tfoot') as HTMLElement | null;
              if (tfoot && !isLastChunk) {
                tfoot.remove();
              }
            }
            measuredTable = measureTableOnClone(clonedEl);
          },
        });

        appendCanvasPagesToPdf(pdf, canvas, measuredTable, chunkScale, chunkIdx === 0, marginMm);
      }

      stampPdfPageNumbers(pdf, isThermal, companyName);
      pdf.save(fileName);
      return true;
    }

    // Standard single-capture multi-page A4 export with full ancestor unclipping & row-boundary pagination
    const estimatedHeight = Math.max(targetElement.scrollHeight || 1000, targetElement.offsetHeight || 1000, 1000);
    const safeScale = Math.min(2.0, Math.max(0.5, Number((13500 / estimatedHeight).toFixed(2))));
    let measuredTable: MeasuredTablePagination | null = null;

    const canvas = await html2canvas(targetElement, {
      scale: safeScale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: isLandscape ? 1200 : 900,
      windowHeight: estimatedHeight + 600,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc, clonedEl) => {
        prepareCloneForCapture(clonedDoc, clonedEl, false, isReport, isLandscape);
        measuredTable = measureTableOnClone(clonedEl);
      },
    });

    appendCanvasPagesToPdf(pdf, canvas, measuredTable, safeScale, true, marginMm);
    stampPdfPageNumbers(pdf, isThermal, companyName);
    pdf.save(fileName);
    return true;
  } catch (error) {
    console.error('PDF export error:', error);
    window.print();
    return false;
  }
}
