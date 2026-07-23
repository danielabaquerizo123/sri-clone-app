import PDFDocument from "pdfkit";
import type { LibroMayorFolio, LibroMayorResponse } from "./libro-mayor.types";

const PAGE_MARGIN = 32;
const ROW_HEIGHT = 18;
const TABLE_WIDTHS = [62, 168, 54, 64, 64, 72, 72];

function collectPdf(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: PAGE_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    build(doc);
    doc.end();
  });
}

function pageBottom(doc: PDFKit.PDFDocument) {
  return doc.page.height - PAGE_MARGIN;
}

function drawHeader(doc: PDFKit.PDFDocument, result: LibroMayorResponse, folio: LibroMayorFolio) {
  doc.fontSize(12).font("Helvetica-Bold").text(result.origen === "PREVIEW" ? "Libro Mayor - Borrador" : "Libro Mayor", PAGE_MARGIN, PAGE_MARGIN);
  doc.fontSize(8).font("Helvetica-Bold").text(`Estado: ${result.estadoReporte}`);
  doc.fontSize(8).font("Helvetica").text(`Empresa: ${result.empresa.razonSocial}`);
  doc.text(`RUC: ${result.empresa.ruc}`);
  doc.text(`Periodo: ${result.periodo.mes || ""}/${result.periodo.anio || ""}`);
  doc.text(`Cuenta: ${folio.nombreCuenta}`);
  doc.text(`Código: ${folio.codigoCuenta}`);
  doc.text(`Folio: ${folio.folio}`);
  doc.moveDown(0.5);
}

function drawTableHeader(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  let x = PAGE_MARGIN;
  const headers = ["Fecha", "Descripción", "N.º", "Debe", "Haber", "Deudor", "Acreedor"];
  doc.fontSize(8).font("Helvetica-Bold");
  headers.forEach((header, index) => {
    doc.rect(x, y, TABLE_WIDTHS[index], ROW_HEIGHT).stroke();
    doc.text(header, x + 2, y + 5, { width: TABLE_WIDTHS[index] - 4, align: index >= 3 ? "right" : "left" });
    x += TABLE_WIDTHS[index];
  });
  doc.y = y + ROW_HEIGHT;
}

function drawRow(doc: PDFKit.PDFDocument, cells: string[]) {
  const y = doc.y;
  let x = PAGE_MARGIN;
  doc.fontSize(7).font("Helvetica");
  cells.forEach((cell, index) => {
    doc.rect(x, y, TABLE_WIDTHS[index], ROW_HEIGHT).stroke();
    doc.text(cell || "", x + 2, y + 5, { width: TABLE_WIDTHS[index] - 4, align: index >= 3 ? "right" : "left" });
    x += TABLE_WIDTHS[index];
  });
  doc.y = y + ROW_HEIGHT;
}

function ensureSpace(doc: PDFKit.PDFDocument, result: LibroMayorResponse, folio: LibroMayorFolio) {
  if (doc.y + ROW_HEIGHT <= pageBottom(doc)) return;
  doc.addPage();
  drawHeader(doc, result, folio);
  drawTableHeader(doc);
}

function drawFolio(doc: PDFKit.PDFDocument, result: LibroMayorResponse, folio: LibroMayorFolio, first: boolean) {
  if (!first) doc.addPage();
  drawHeader(doc, result, folio);
  drawTableHeader(doc);
  for (const movement of folio.movimientos) {
    ensureSpace(doc, result, folio);
    drawRow(doc, [
      movement.fecha,
      movement.descripcion,
      movement.numeroAsiento,
      movement.debe,
      movement.haber,
      movement.saldoDeudor || "",
      movement.saldoAcreedor || "",
    ]);
  }
  ensureSpace(doc, result, folio);
  doc.font("Helvetica-Bold");
  drawRow(doc, ["", "TOTAL", "", folio.totalDebe, folio.totalHaber, folio.saldoFinalDeudor || "", folio.saldoFinalAcreedor || ""]);
}

export class LibroMayorExportPdfService {
  export(result: LibroMayorResponse): Promise<Buffer> {
    return collectPdf((doc) => {
      result.folios.forEach((folio, index) => drawFolio(doc, result, folio, index === 0));
      const generatedAt = new Date().toISOString().slice(0, 10);
      const pages = doc.bufferedPageRange();
      for (let index = pages.start; index < pages.start + pages.count; index += 1) {
        doc.switchToPage(index);
        doc.fontSize(7).font("Helvetica").text(`Generado: ${generatedAt} · Página ${index + 1}`, PAGE_MARGIN, doc.page.height - 20);
      }
    });
  }
}
