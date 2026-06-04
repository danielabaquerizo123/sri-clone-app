import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma";

function generarNumeroAdhesion() {
  return `ADH-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
}

function generarNumeroBorrador() {
  return `BOR-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
}

const mesesMap: Record<string, string> = {
  "01": "Enero",
  "02": "Febrero",
  "03": "Marzo",
  "04": "Abril",
  "05": "Mayo",
  "06": "Junio",
  "07": "Julio",
  "08": "Agosto",
  "09": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre",
};

const mesesMapInverso = Object.fromEntries(
  Object.entries(mesesMap).map(([codigo, nombre]) => [nombre.toUpperCase(), codigo])
);

const retencionToCasillero: Record<string, { base: string; retenido?: string }> = {
  "302": { base: "302", retenido: "352" },
  "303": { base: "303", retenido: "353" },
  "304": { base: "304", retenido: "354" },
  "307": { base: "307", retenido: "357" },
  "308": { base: "308", retenido: "358" },
  "309": { base: "309", retenido: "359" },
  "311": { base: "311", retenido: "361" },
  "312": { base: "312", retenido: "362" },
  "314": { base: "314", retenido: "364" },
  "322": { base: "322", retenido: "372" },
  "323": { base: "323", retenido: "373" },
  "325": { base: "325", retenido: "375" },
  "332": { base: "332" },
  "343": { base: "343", retenido: "393" },
  "344": { base: "344", retenido: "394" },
  "345": { base: "345", retenido: "395" },
  "346": { base: "346", retenido: "396" },
};

function n(value: unknown) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function add(casilleros: Record<string, number>, key: string, value: number) {
  casilleros[key] = round2((casilleros[key] || 0) + value);
}

function mesCodigoFromValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (/^(0?[1-9]|1[0-2])$/.test(raw)) return raw.padStart(2, "0");
  return mesesMapInverso[raw.toUpperCase()] || undefined;
}

function money(value: unknown) {
  return Number(value || 0).toFixed(2);
}

function fechaLocal(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-EC");
}

function fechaHoraLocal(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function filenameSafe(value: string) {
  return value.replace(/[^\w.-]+/g, "_");
}

function sendPdf(res: Response, filename: string, build: (doc: PDFKit.PDFDocument) => void) {
  const doc = new PDFDocument({ size: "A4", margin: 42 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  doc.on("end", () => {
    const pdf = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameSafe(filename)}"`);
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  });

  build(doc);
  doc.end();
}

function sendPdfLandscape(res: Response, filename: string, build: (doc: PDFKit.PDFDocument) => void) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 34 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  doc.on("end", () => {
    const pdf = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameSafe(filename)}"`);
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  });

  build(doc);
  doc.end();
}

function pdfTitle(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc
    .fontSize(10)
    .fillColor("#003565")
    .text("SERVICIO DE RENTAS INTERNAS", { align: "center" })
    .moveDown(0.35)
    .fontSize(17)
    .text(title, { align: "center" })
    .moveDown(0.25)
    .fontSize(11)
    .fillColor("#333333")
    .text(subtitle, { align: "center" })
    .moveDown(1);
}

function pdfKV(doc: PDFKit.PDFDocument, label: string, value: unknown) {
  doc.fontSize(9).fillColor("#666666").text(label.toUpperCase(), { continued: true });
  doc.fillColor("#111111").text(`  ${String(value ?? "-")}`);
}

function pdfTable(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: Array<[string, string | number]>,
  startX = 42,
  width = 511
) {
  doc.moveDown(0.8).fontSize(11).fillColor("#003565").text(title, startX);
  const labelWidth = Math.round(width * 0.68);
  const valueWidth = width - labelWidth;
  let y = doc.y + 6;

  rows.forEach(([label, value], index) => {
    const rowHeight = 22;
    doc
      .rect(startX, y, width, rowHeight)
      .fill(index % 2 === 0 ? "#f8fafc" : "#ffffff")
      .strokeColor("#d7dde6")
      .rect(startX, y, width, rowHeight)
      .stroke();

    doc
      .fontSize(8.5)
      .fillColor("#334155")
      .text(label, startX + 7, y + 7, { width: labelWidth - 14 })
      .fontSize(8.5)
      .fillColor("#111827")
      .text(String(value), startX + labelWidth + 7, y + 7, {
        width: valueWidth - 14,
        align: "right",
      });

    y += rowHeight;
  });

  doc.y = y + 4;
}

type Formulario104PdfRow = {
  casillero: string;
  descripcion: string;
  valor: unknown;
  format?: "money" | "factor" | "integer" | "text";
};

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottom) {
    doc.addPage();
  }
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 22);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc
    .moveDown(0.35)
    .rect(x, doc.y, width, 17)
    .fill("#003565")
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(title.toUpperCase(), x + 7, doc.y + 4, { width: width - 14 });

  doc.font("Helvetica").fillColor("#111827");
  doc.y += 20;
}

function formatMoney(value: unknown) {
  return Number(value || 0).toFixed(2);
}

function formatFactor(value: unknown) {
  return Number(value || 0).toFixed(4);
}

function formatFormulario104Value(row: Formulario104PdfRow) {
  if (row.format === "factor") return formatFactor(row.valor);
  if (row.format === "integer") return String(Math.round(Number(row.valor || 0)));
  if (row.format === "text") return String(row.valor ?? "-");
  return formatMoney(row.valor);
}

function drawCasilleroTable(doc: PDFKit.PDFDocument, rows: Formulario104PdfRow[]) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const casilleroWidth = 62;
  const valueWidth = 86;
  const descWidth = width - casilleroWidth - valueWidth;
  const headerHeight = 16;
  const rowHeight = 15;

  ensureSpace(doc, headerHeight + rowHeight);

  const drawHeader = () => {
    doc
      .rect(x, doc.y, width, headerHeight)
      .fill("#e8eef7")
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(7.7)
      .text("CASILLERO", x + 5, doc.y + 5, { width: casilleroWidth - 10 })
      .text("DESCRIPCION", x + casilleroWidth + 5, doc.y + 5, { width: descWidth - 10 })
      .text("VALOR", x + casilleroWidth + descWidth + 5, doc.y + 5, {
        width: valueWidth - 10,
        align: "right",
      });
    doc.font("Helvetica");
    doc.y += headerHeight;
  };

  drawHeader();

  rows.forEach((row, index) => {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }

    const y = doc.y;
    doc
      .rect(x, y, width, rowHeight)
      .fill(index % 2 === 0 ? "#f8fafc" : "#ffffff")
      .strokeColor("#d7dde6")
      .rect(x, y, width, rowHeight)
      .stroke();

    doc
      .fontSize(7.6)
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .text(row.casillero, x + 5, y + 4, { width: casilleroWidth - 10 })
      .font("Helvetica")
      .fillColor("#334155")
      .text(row.descripcion, x + casilleroWidth + 5, y + 4, { width: descWidth - 10 })
      .fillColor("#111827")
      .text(formatFormulario104Value(row), x + casilleroWidth + descWidth + 5, y + 4, {
        width: valueWidth - 10,
        align: "right",
      });

    doc.y = y + rowHeight;
  });

  doc.moveDown(0.25);
}

function drawFormulario104Pdf(params: {
  doc: PDFKit.PDFDocument;
  declaracion: {
    formulario: string;
    mes: string | null;
    semestre: string | null;
    anio: number;
    numeroAdhesion: string;
    estado: string;
  };
  ruc: string;
  razonSocial: string;
  casilleros: Record<string, number>;
}) {
  const { doc, declaracion, ruc, razonSocial, casilleros } = params;
  const value = (key: string) => casilleros[key] ?? 0;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const textValue = (key: string) => (key === "563" ? formatFactor(value(key)) : formatMoney(value(key)));
  const codeValue = (key?: string) => (key ? `${key}\n${textValue(key)}` : "-");
  const drawTripletSection = (
    title: string,
    rows: Array<{ concepto: string; bruto?: string; neto?: string; impuesto?: string }>
  ) => {
    drawSectionTitle(doc, title);
    const conceptWidth = 294;
    const cellWidth = (pageWidth - conceptWidth) / 3;
    const x = doc.page.margins.left;
    const rowHeight = 28;

    ensureSpace(doc, 18 + rowHeight);
    doc
      .rect(x, doc.y, pageWidth, 18)
      .fill("#e8eef6")
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor("#0f172a")
      .text("CONCEPTO", x + 5, doc.y + 5, { width: conceptWidth - 10 })
      .text("VALOR BRUTO", x + conceptWidth + 5, doc.y + 5, { width: cellWidth - 10, align: "right" })
      .text("VALOR NETO", x + conceptWidth + cellWidth + 5, doc.y + 5, { width: cellWidth - 10, align: "right" })
      .text("IMPUESTO GENERADO", x + conceptWidth + cellWidth * 2 + 5, doc.y + 5, {
        width: cellWidth - 10,
        align: "right",
      });
    doc.y += 18;

    rows.forEach((row, index) => {
      ensureSpace(doc, rowHeight);
      const y = doc.y;
      doc
        .rect(x, y, pageWidth, rowHeight)
        .fill(index % 2 === 0 ? "#f8fafc" : "#ffffff")
        .strokeColor("#d7dde6")
        .rect(x, y, pageWidth, rowHeight)
        .stroke();

      doc
        .font("Helvetica")
        .fontSize(6.8)
        .fillColor("#111827")
        .text(row.concepto, x + 5, y + 5, { width: conceptWidth - 10 })
        .font("Helvetica-Bold")
        .text(codeValue(row.bruto), x + conceptWidth + 5, y + 4, { width: cellWidth - 10, align: "right" })
        .text(codeValue(row.neto), x + conceptWidth + cellWidth + 5, y + 4, { width: cellWidth - 10, align: "right" })
        .text(codeValue(row.impuesto), x + conceptWidth + cellWidth * 2 + 5, y + 4, {
          width: cellWidth - 10,
          align: "right",
        });
      doc.y = y + rowHeight;
    });

    doc.moveDown(0.25);
  };

  const drawSimpleSection = (title: string, rows: Array<{ code: string; concepto: string; valor?: string }>) => {
    drawSectionTitle(doc, title);
    const codeWidth = 58;
    const valueWidth = 92;
    const conceptWidth = pageWidth - codeWidth - valueWidth;
    const x = doc.page.margins.left;
    const headerHeight = 18;
    const rowHeight = 20;

    ensureSpace(doc, headerHeight + rowHeight);
    doc
      .rect(x, doc.y, pageWidth, headerHeight)
      .fill("#e8eef6")
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor("#0f172a")
      .text("CASILLERO", x + 5, doc.y + 5, { width: codeWidth - 10, align: "center" })
      .text("CONCEPTO", x + codeWidth + 5, doc.y + 5, { width: conceptWidth - 10 })
      .text("VALOR", x + codeWidth + conceptWidth + 5, doc.y + 5, { width: valueWidth - 10, align: "right" });
    doc.y += headerHeight;

    rows.forEach((row, index) => {
      ensureSpace(doc, rowHeight);
      const y = doc.y;
      doc
        .rect(x, y, pageWidth, rowHeight)
        .fill(index % 2 === 0 ? "#f8fafc" : "#ffffff")
        .strokeColor("#d7dde6")
        .rect(x, y, pageWidth, rowHeight)
        .stroke();

      doc
        .fontSize(7)
        .font("Helvetica-Bold")
        .fillColor("#111827")
        .text(row.code, x + 5, y + 5, { width: codeWidth - 10, align: "center" })
        .font("Helvetica")
        .fillColor("#334155")
        .text(row.concepto, x + codeWidth + 5, y + 5, { width: conceptWidth - 10 })
        .font("Helvetica-Bold")
        .fillColor("#111827")
        .text(row.valor ?? textValue(row.code), x + codeWidth + conceptWidth + 5, y + 5, {
          width: valueWidth - 10,
          align: "right",
        });
      doc.y = y + rowHeight;
    });

    doc.moveDown(0.25);
  };

  pdfTitle(doc, "FORMULARIO 104", "Declaración del Impuesto al Valor Agregado");
  pdfKV(doc, "RUC", ruc);
  pdfKV(doc, "Razón social", razonSocial);
  pdfKV(doc, "Período", `${declaracion.mes || declaracion.semestre || "-"} / ${declaracion.anio}`);
  pdfKV(doc, "Estado", declaracion.estado);
  pdfKV(doc, "Fecha generación", fechaLocal(new Date()));
  pdfKV(doc, "Número de adhesión", declaracion.numeroAdhesion);

  drawSimpleSection("Identificación", [
    { code: "101", concepto: "Mes", valor: declaracion.mes || declaracion.semestre || "-" },
    { code: "102", concepto: "Año", valor: String(declaracion.anio) },
    { code: "201", concepto: "RUC", valor: ruc },
    { code: "202", concepto: "Razón social", valor: razonSocial },
  ]);

  drawTripletSection("Ventas y otras operaciones", [
    { concepto: "Ventas locales gravadas tarifa diferente de cero", bruto: "401", neto: "411", impuesto: "421" },
    { concepto: "Ventas locales gravadas tarifa diferente de cero no objeto de retención", bruto: "402", neto: "412", impuesto: "422" },
    { concepto: "Ventas tarifa diferente de cero especiales", bruto: "410", neto: "420", impuesto: "430" },
    { concepto: "Ventas con liquidación posterior", bruto: "425", neto: "435", impuesto: "445" },
    { concepto: "Ventas locales tarifa 0% sin derecho a crédito tributario", bruto: "403", neto: "413" },
    { concepto: "Ventas locales tarifa 0% con derecho a crédito tributario", bruto: "404", neto: "414" },
    { concepto: "Exportaciones de bienes", bruto: "405", neto: "415" },
    { concepto: "Exportaciones de servicios", bruto: "406", neto: "416" },
    { concepto: "Transferencias no objeto de IVA", bruto: "407", neto: "417" },
    { concepto: "Transferencias exentas de IVA", bruto: "408", neto: "418" },
    { concepto: "Total ventas y otras operaciones", bruto: "409", neto: "419", impuesto: "429" },
    { concepto: "Transferencias no objeto o exentas adicionales", bruto: "431", neto: "441" },
    { concepto: "Otras transferencias", neto: "442" },
    { concepto: "Ajustes por ventas", bruto: "443", neto: "453" },
    { concepto: "Otros ajustes gravados", bruto: "434", neto: "444", impuesto: "454" },
  ]);

  drawSimpleSection("Liquidación del IVA en el mes", [
    { code: "480", concepto: "Total transferencias gravadas" },
    { code: "481", concepto: "IVA generado en ventas a crédito" },
    { code: "482", concepto: "IVA generado total" },
    { code: "483", concepto: "IVA a liquidar en mes anterior" },
    { code: "484", concepto: "IVA a liquidar en este mes" },
    { code: "485", concepto: "IVA a liquidar en el próximo mes" },
    { code: "499", concepto: "Total impuesto generado" },
  ]);

  drawSimpleSection("Comprobantes emitidos", [
    { code: "111", concepto: "Comprobantes emitidos" },
    { code: "113", concepto: "Comprobantes anulados o notas de crédito emitidas" },
  ]);

  drawTripletSection("Adquisiciones y pagos", [
    { concepto: "Adquisiciones gravadas con derecho a crédito tributario", bruto: "500", neto: "510", impuesto: "520" },
    { concepto: "Adquisiciones gravadas sin derecho a crédito tributario", bruto: "501", neto: "511", impuesto: "521" },
    { concepto: "Importaciones gravadas", bruto: "530", neto: "533", impuesto: "534" },
    { concepto: "Importaciones especiales", bruto: "540", neto: "550", impuesto: "560" },
    { concepto: "Adquisiciones tarifa 0%", bruto: "502", neto: "512", impuesto: "522" },
    { concepto: "Adquisiciones no objeto de IVA", bruto: "503", neto: "513", impuesto: "523" },
    { concepto: "Adquisiciones exentas de IVA", bruto: "504", neto: "514", impuesto: "524" },
    { concepto: "Otras adquisiciones", bruto: "505", neto: "515", impuesto: "525" },
    { concepto: "Ajustes IVA en compras", impuesto: "526" },
    { concepto: "Otros ajustes IVA", impuesto: "527" },
    { concepto: "Adquisiciones adicionales", bruto: "506", neto: "516" },
    { concepto: "Adquisiciones tarifa 0% o no objeto", bruto: "507", neto: "517" },
    { concepto: "Adquisiciones RISE / Régimen simplificado", bruto: "508", neto: "518" },
    { concepto: "Total adquisiciones y pagos", bruto: "509", neto: "519", impuesto: "529" },
    { concepto: "Notas de crédito en adquisiciones", bruto: "531", neto: "541" },
    { concepto: "Ajustes en adquisiciones", bruto: "532", neto: "542" },
    { concepto: "Ajuste impuesto generado", impuesto: "543" },
    { concepto: "Otros ajustes", bruto: "544", neto: "554" },
    { concepto: "Totales adicionales de adquisiciones", bruto: "535", neto: "545", impuesto: "555" },
  ]);

  drawSimpleSection("Crédito tributario", [
    { code: "563", concepto: "Factor de proporcionalidad" },
    { code: "564", concepto: "Crédito tributario aplicable" },
    { code: "565", concepto: "IVA no usado como crédito tributario" },
  ]);

  drawSimpleSection("Comprobantes recibidos", [
    { code: "115", concepto: "Comprobantes recibidos" },
    { code: "117", concepto: "Notas de crédito recibidas" },
    { code: "119", concepto: "Comprobantes anulados" },
  ]);

  drawSimpleSection("Resumen impositivo", [
    { code: "601", concepto: "Impuesto causado" },
    { code: "602", concepto: "Crédito tributario del mes" },
    { code: "603", concepto: "Crédito tributario mes anterior" },
    { code: "604", concepto: "Saldo crédito tributario mes anterior" },
    { code: "605", concepto: "Saldo crédito tributario por adquisiciones" },
    { code: "606", concepto: "Saldo retenciones mes anterior" },
    { code: "607", concepto: "Ajustes por devolución" },
    { code: "608", concepto: "Ajustes por compensación" },
    { code: "609", concepto: "Retenciones IVA que le efectuaron" },
    { code: "622", concepto: "Ajuste por devolución automática" },
    { code: "610", concepto: "Ajuste crédito tributario" },
    { code: "611", concepto: "Ajuste por devoluciones" },
    { code: "612", concepto: "Ajuste por compensaciones" },
    { code: "613", concepto: "Ajuste por notas de crédito" },
    { code: "614", concepto: "Otros ajustes" },
    { code: "615", concepto: "Saldo crédito tributario próximo mes" },
    { code: "617", concepto: "Saldo retenciones próximo mes" },
    { code: "618", concepto: "Saldo crédito tributario a compensar" },
    { code: "619", concepto: "Saldo retenciones a compensar" },
    { code: "625", concepto: "Saldo a favor" },
    { code: "620", concepto: "Subtotal a pagar" },
    { code: "621", concepto: "IVA presuntivo" },
    { code: "699", concepto: "Impuesto a pagar" },
  ]);

  drawSimpleSection("Agente de retención IVA", [
    { code: "721", concepto: "Retención IVA 10%" },
    { code: "723", concepto: "Retención IVA 20%" },
    { code: "725", concepto: "Retención IVA 30%" },
    { code: "727", concepto: "Retención IVA 50%" },
    { code: "729", concepto: "Retención IVA 70%" },
    { code: "731", concepto: "Retención IVA 100%" },
    { code: "799", concepto: "Total retenciones IVA" },
    { code: "800", concepto: "Retenciones IVA compensadas" },
    { code: "802", concepto: "Retenciones IVA pendientes" },
    { code: "801", concepto: "Retenciones IVA a pagar" },
    { code: "859", concepto: "Total obligación IVA" },
  ]);

  drawSimpleSection("Valores a pagar", [
    { code: "890", concepto: "Pago previo" },
    { code: "897", concepto: "Interés por mora previo" },
    { code: "898", concepto: "Multa previa" },
    { code: "899", concepto: "Total impuesto a pagar previo" },
    { code: "880", concepto: "Valor pagado previamente" },
    { code: "902", concepto: "Impuesto causado a pagar" },
    { code: "903", concepto: "Interés" },
    { code: "904", concepto: "Multa" },
    { code: "999", concepto: "Total pagado" },
    { code: "905", concepto: "Total pagado por débito u otros medios" },
    { code: "906", concepto: "Pago con notas de crédito" },
    { code: "907", concepto: "Pago con compensación" },
    { code: "925", concepto: "Pago en exceso" },
  ]);

  doc
    .moveDown(0.8)
    .fontSize(7.5)
    .fillColor("#475569")
    .text("Documento generado dinámicamente a partir de la declaración almacenada en el sistema.", {
      align: "center",
    });
}

type Formulario103PdfRow = {
  concepto: string;
  baseCode?: string;
  retCode?: string;
};

const formulario103Sections: Array<{ title: string; rows: Formulario103PdfRow[] }> = [
  {
    title: "Detalle de pagos y retención por impuesto a la renta",
    rows: [
      { concepto: "En relación de dependencia", baseCode: "302", retCode: "352" },
      { concepto: "Honorarios profesionales", baseCode: "303", retCode: "353" },
      { concepto: "Honorarios profesionales no residentes", baseCode: "3030" },
    ],
  },
  {
    title: "Derivadas del trabajo y servicios prestados",
    rows: [
      { concepto: "Servicios donde predomina el intelecto", baseCode: "304", retCode: "354" },
      { concepto: "Servicios donde predomina la mano de obra", baseCode: "307", retCode: "357" },
      { concepto: "Utilización o aprovechamiento de imagen o renombre", baseCode: "308", retCode: "358" },
      { concepto: "Publicidad y comunicación", baseCode: "309", retCode: "359" },
      { concepto: "Servicios profesionales adicionales", baseCode: "310" },
      { concepto: "Liquidaciones de compra por nivel cultural o rusticidad", baseCode: "311", retCode: "361" },
    ],
  },
  {
    title: "Por bienes y servicios",
    rows: [
      { concepto: "Transferencia de bienes muebles de naturaleza corporal", baseCode: "312", retCode: "362" },
      { concepto: "Seguros y reaseguros", baseCode: "322", retCode: "372" },
      { concepto: "Transferencias especiales de bienes", baseCode: "3120" },
      { concepto: "Transferencias especiales de bienes", baseCode: "3121" },
      { concepto: "Pagos aplicables tarifa 1%", baseCode: "3430" },
      { concepto: "Pagos aplicables tarifa 1%", baseCode: "343", retCode: "393" },
      { concepto: "Pagos aplicables tarifa 2%", baseCode: "344", retCode: "394" },
      { concepto: "Otras compras de bienes y servicios no sujetas a retención", baseCode: "332" },
    ],
  },
  {
    title: "Por regalías, comisiones, arrendamientos y otros",
    rows: [
      { concepto: "Regalías, derechos de autor, marcas y patentes", baseCode: "314", retCode: "364" },
      { concepto: "Regalías y similares", baseCode: "3140" },
      { concepto: "Arrendamientos mercantiles", baseCode: "319" },
      { concepto: "Arrendamientos de bienes inmuebles", baseCode: "320" },
      { concepto: "Rendimientos financieros", baseCode: "323", retCode: "373" },
      { concepto: "Otros rendimientos financieros", baseCode: "324" },
      { concepto: "Rendimientos financieros especiales", baseCode: "3230" },
    ],
  },
  {
    title: "Relacionadas con el capital",
    rows: [
      { concepto: "Dividendos", baseCode: "325", retCode: "375" },
      { concepto: "Dividendos anticipados", baseCode: "3250" },
      { concepto: "Ganancias de capital", baseCode: "326" },
      { concepto: "Utilidades por enajenación", baseCode: "327" },
      { concepto: "Rendimientos en fideicomisos", baseCode: "328" },
      { concepto: "Cesión de derechos", baseCode: "329" },
      { concepto: "Otros conceptos de capital", baseCode: "330" },
      { concepto: "Otros pagos relacionados con capital", baseCode: "331" },
    ],
  },
  {
    title: "Autorretenciones y otras retenciones",
    rows: [
      { concepto: "Otros pagos no sujetos", baseCode: "333" },
      { concepto: "Otros pagos locales", baseCode: "334" },
      { concepto: "Otros pagos sujetos a retención", baseCode: "335" },
      { concepto: "Concepto especial", baseCode: "3481" },
      { concepto: "Otros conceptos", baseCode: "336" },
      { concepto: "Otros conceptos especiales", baseCode: "337" },
      { concepto: "Otros conceptos especiales", baseCode: "3370" },
      { concepto: "Autorretenciones", baseCode: "350" },
      { concepto: "Pagos aplicables tarifa 2% especiales", baseCode: "3440" },
      { concepto: "Otras retenciones aplicables 8%", baseCode: "345", retCode: "395" },
      { concepto: "Otras retenciones aplicables a otros porcentajes", baseCode: "346", retCode: "396" },
      { concepto: "Otros conceptos de cierre", baseCode: "348" },
    ],
  },
  {
    title: "Pagos al exterior",
    rows: [
      ...["402", "403", "404", "405", "406", "407", "408", "409", "410", "411", "412", "413", "414", "415", "416", "417", "418", "419", "420", "421", "422", "423", "424", "425", "426", "427", "428", "429", "430", "431", "432", "433"].map((code) => ({
        concepto: `Pago al exterior casillero ${code}`,
        baseCode: code,
      })),
    ],
  },
  {
    title: "Subtotal operaciones efectuadas en el país",
    rows: [{ concepto: "Subtotal operaciones efectuadas en el país", baseCode: "349", retCode: "399" }],
  },
  {
    title: "Total retención impuesto a la renta",
    rows: [{ concepto: "Total retención de impuesto a la renta", retCode: "499" }],
  },
  {
    title: "Valores a pagar",
    rows: [
      { concepto: "Total impuesto a pagar", retCode: "902" },
      { concepto: "Mediante cheque, débito bancario, efectivo u otras formas de pago", retCode: "905" },
      { concepto: "Total pagado", retCode: "999" },
    ],
  },
];

function drawFormulario103Section(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: Formulario103PdfRow[],
  casilleros: Record<string, number>
) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const conceptWidth = 365;
  const codeWidth = 72;
  const valueWidth = 100;
  const headerHeight = 18;
  const rowHeight = 20;

  ensureSpace(doc, 24 + headerHeight + rowHeight);
  doc
    .moveDown(0.35)
    .rect(x, doc.y, width, 18)
    .fill("#003565")
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(8.4)
    .text(title.toUpperCase(), x + 8, doc.y + 4, { width: width - 16 });
  doc.font("Helvetica");
  doc.y += 21;

  const drawHeader = () => {
    doc
      .rect(x, doc.y, width, headerHeight)
      .fill("#e8eef7")
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .text("CONCEPTO", x + 5, doc.y + 5, { width: conceptWidth - 10 })
      .text("COD. BASE", x + conceptWidth + 5, doc.y + 5, { width: codeWidth - 10, align: "center" })
      .text("BASE IMPONIBLE", x + conceptWidth + codeWidth + 5, doc.y + 5, {
        width: valueWidth - 10,
        align: "right",
      })
      .text("COD. RET.", x + conceptWidth + codeWidth + valueWidth + 5, doc.y + 5, {
        width: codeWidth - 10,
        align: "center",
      })
      .text("VALOR RETENIDO", x + conceptWidth + codeWidth * 2 + valueWidth + 5, doc.y + 5, {
        width: valueWidth - 10,
        align: "right",
      });
    doc.font("Helvetica");
    doc.y += headerHeight;
  };

  drawHeader();

  rows.forEach((row, index) => {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }

    const y = doc.y;
    const baseValue = row.baseCode ? casilleros[row.baseCode] || 0 : undefined;
    const retValue = row.retCode ? casilleros[row.retCode] || 0 : undefined;

    doc
      .rect(x, y, width, rowHeight)
      .fill(index % 2 === 0 ? "#f8fafc" : "#ffffff")
      .strokeColor("#cbd5e1")
      .rect(x, y, width, rowHeight)
      .stroke();

    doc
      .fillColor("#111827")
      .fontSize(7.7)
      .font("Helvetica")
      .text(row.concepto, x + 5, y + 5, { width: conceptWidth - 10 })
      .font("Helvetica-Bold")
      .text(row.baseCode || "", x + conceptWidth + 5, y + 5, { width: codeWidth - 10, align: "center" })
      .font("Helvetica")
      .text(baseValue === undefined ? "" : formatMoney(baseValue), x + conceptWidth + codeWidth + 5, y + 5, {
        width: valueWidth - 10,
        align: "right",
      })
      .font("Helvetica-Bold")
      .text(row.retCode || "", x + conceptWidth + codeWidth + valueWidth + 5, y + 5, {
        width: codeWidth - 10,
        align: "center",
      })
      .font("Helvetica")
      .text(retValue === undefined ? "" : formatMoney(retValue), x + conceptWidth + codeWidth * 2 + valueWidth + 5, y + 5, {
        width: valueWidth - 10,
        align: "right",
      });

    doc.y = y + rowHeight;
  });
}

function drawFormulario103Pdf(params: {
  doc: PDFKit.PDFDocument;
  declaracion: {
    formulario: string;
    mes: string | null;
    semestre: string | null;
    anio: number;
    numeroAdhesion: string;
    estado: string;
  };
  ruc: string;
  razonSocial: string;
  casilleros: Record<string, number>;
}) {
  const { doc, declaracion, ruc, razonSocial, casilleros } = params;
  const periodo = `${declaracion.mes || declaracion.semestre || "-"} / ${declaracion.anio}`;
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottom = doc.page.height - doc.page.margins.bottom;
  const conceptWidth = 365;
  const codeWidth = 72;
  const valueWidth = 100;
  let y = 32;

  doc
    .fontSize(9)
    .fillColor("#003565")
    .font("Helvetica-Bold")
    .text("SERVICIO DE RENTAS INTERNAS", x, y, { width, align: "center" })
    .fontSize(16)
    .text("FORMULARIO 103", x, y + 13, { width, align: "center" })
    .fontSize(10)
    .fillColor("#334155")
    .text("Declaración de Retenciones en la Fuente del Impuesto a la Renta", x, y + 34, {
      width,
      align: "center",
    });
  y += 58;

  const pageBreak = (needed: number) => {
    if (y + needed > bottom) {
      doc.addPage();
      y = 32;
    }
  };

  const sectionTitle = (title: string) => {
    pageBreak(20);
    doc.rect(x, y, width, 17).fill("#003565");
    doc
      .font("Helvetica-Bold")
      .fontSize(8.2)
      .fillColor("#ffffff")
      .text(title.toUpperCase(), x + 8, y + 4, { width: width - 16 });
    y += 19;
  };

  const header = () => {
    pageBreak(18);
    doc.rect(x, y, width, 17).fill("#e8eef7");
    doc
      .font("Helvetica-Bold")
      .fontSize(7.2)
      .fillColor("#0f172a")
      .text("CONCEPTO", x + 5, y + 5, { width: conceptWidth - 10 })
      .text("COD. BASE", x + conceptWidth + 5, y + 5, { width: codeWidth - 10, align: "center" })
      .text("BASE IMPONIBLE", x + conceptWidth + codeWidth + 5, y + 5, {
        width: valueWidth - 10,
        align: "right",
      })
      .text("COD. RET.", x + conceptWidth + codeWidth + valueWidth + 5, y + 5, {
        width: codeWidth - 10,
        align: "center",
      })
      .text("VALOR RETENIDO", x + conceptWidth + codeWidth * 2 + valueWidth + 5, y + 5, {
        width: valueWidth - 10,
        align: "right",
      });
    y += 17;
  };

  const row = (item: Formulario103PdfRow, index: number) => {
    const rowHeight = 18;
    pageBreak(rowHeight);
    const baseValue = item.baseCode ? casilleros[item.baseCode] || 0 : undefined;
    const retValue = item.retCode ? casilleros[item.retCode] || 0 : undefined;

    doc
      .rect(x, y, width, rowHeight)
      .fill(index % 2 === 0 ? "#f8fafc" : "#ffffff")
      .strokeColor("#cbd5e1")
      .rect(x, y, width, rowHeight)
      .stroke();

    doc
      .font("Helvetica")
      .fontSize(7.4)
      .fillColor("#111827")
      .text(item.concepto, x + 5, y + 5, { width: conceptWidth - 10, height: rowHeight - 4 })
      .font("Helvetica-Bold")
      .text(item.baseCode || "", x + conceptWidth + 5, y + 5, { width: codeWidth - 10, align: "center" })
      .font("Helvetica")
      .text(baseValue === undefined ? "" : formatMoney(baseValue), x + conceptWidth + codeWidth + 5, y + 5, {
        width: valueWidth - 10,
        align: "right",
      })
      .font("Helvetica-Bold")
      .text(item.retCode || "", x + conceptWidth + codeWidth + valueWidth + 5, y + 5, {
        width: codeWidth - 10,
        align: "center",
      })
      .font("Helvetica")
      .text(retValue === undefined ? "" : formatMoney(retValue), x + conceptWidth + codeWidth * 2 + valueWidth + 5, y + 5, {
        width: valueWidth - 10,
        align: "right",
      });
    y += rowHeight;
  };

  sectionTitle("Identificación");
  doc.font("Helvetica").fontSize(8).fillColor("#111827");
  const idLines = [
    `RUC: ${ruc}`,
    `Razón social: ${razonSocial}`,
    `Período: ${periodo}    Estado: ${declaracion.estado}    Adhesión: ${declaracion.numeroAdhesion}`,
    `Fecha generación: ${fechaLocal(new Date())}`,
  ];
  idLines.forEach((line) => {
    pageBreak(14);
    doc.text(line, x + 6, y + 2, { width: width - 12 });
    y += 14;
  });

  formulario103Sections.forEach((section) => {
    sectionTitle(section.title);
    header();
    section.rows.forEach(row);
  });
}

type TalonRow = [string, string | number, boolean?];

const casilleroLabels103: Record<string, string> = {
  "302": "Honorarios profesionales y dietas",
  "303": "Predomina intelecto",
  "304": "Predomina mano de obra",
  "307": "Servicios predomina intelecto no relacionados",
  "311": "Servicios predomina mano de obra",
  "314": "Servicios entre sociedades",
  "322": "Pagos locales",
  "323": "Pagos al exterior",
  "325": "Otros pagos sujetos a retención",
  "332": "Retención en la fuente de IVA",
  "343": "Dividendos",
  "344": "Rendimientos financieros",
  "345": "Loterías, rifas, apuestas y similares",
  "346": "Otros conceptos",
  "352": "Retención honorarios profesionales",
  "353": "Retención predomina intelecto",
  "354": "Retención predomina mano de obra",
  "357": "Retención servicios intelecto no relacionados",
  "361": "Retención servicios mano de obra",
  "364": "Retención servicios entre sociedades",
  "372": "Retención pagos locales",
  "373": "Retención pagos al exterior",
  "375": "Retención otros pagos",
  "393": "Retención dividendos",
  "394": "Retención rendimientos financieros",
  "395": "Retención loterías, rifas, apuestas y similares",
  "396": "Retención otros conceptos",
  "349": "Subtotal base operaciones país",
  "399": "Subtotal retención impuesto a la renta",
  "499": "Total retenciones",
  "890": "Pago previo",
  "897": "Interés por mora",
  "898": "Multa",
  "899": "Total impuesto a pagar",
  "902": "Impuesto causado",
  "903": "Interés",
  "904": "Multa",
  "905": "Pago con débito bancario, efectivo u otras formas",
  "999": "Total pagado",
};

const casilleroLabels104: Record<string, string> = {
  "401": "Ventas tarifa diferente de 0%",
  "402": "IVA generado ventas tarifa diferente de 0%",
  "403": "Ventas tarifa 0%",
  "404": "IVA ventas tarifa 0%",
  "405": "Ventas no objeto de IVA",
  "406": "IVA ventas no objeto",
  "421": "Notas de crédito emitidas",
  "422": "IVA notas de crédito emitidas",
  "429": "IVA generado",
  "480": "Total transferencias",
  "481": "Total IVA generado",
  "484": "IVA en ventas",
  "500": "Compras tarifa diferente de 0%",
  "501": "IVA compras tarifa diferente de 0%",
  "502": "Compras tarifa 0%",
  "507": "Compras sin derecho a crédito tributario",
  "518": "Adquisiciones no objeto de IVA",
  "563": "Factor de proporcionalidad",
  "564": "Crédito tributario aplicable",
  "601": "Impuesto causado",
  "602": "Crédito tributario",
  "605": "Saldo crédito tributario mes anterior",
  "606": "Saldo retenciones mes anterior",
  "609": "Retenciones IVA recibidas",
  "615": "Saldo crédito tributario próximo mes",
  "617": "Saldo retenciones próximo mes",
  "620": "Subtotal a pagar",
  "699": "Impuesto a pagar",
  "890": "Pago previo",
  "897": "Interés por mora",
  "898": "Multa",
  "899": "Total impuesto a pagar",
  "902": "Impuesto causado a pagar",
  "903": "Interés",
  "904": "Multa",
  "999": "Total pagado",
};

function talonMoney(value: unknown) {
  return money(value);
}

function talonInt(value: unknown) {
  return String(Math.round(Number(value || 0)));
}

function sumFields(row: Record<string, unknown>, fields: string[]) {
  return fields.reduce((acc, field) => acc + n(row[field]), 0);
}

function atsCompraBaseGravada(compra: Record<string, unknown>) {
  return sumFields(compra, ["baseGravableIva1", "baseGravableIva2", "baseGravableIva3"]);
}

function atsCompraIva(compra: Record<string, unknown>) {
  return sumFields(compra, ["montoIva1", "montoIva2", "montoIva3"]);
}

function atsVentaBaseGravada(venta: Record<string, unknown>) {
  return sumFields(venta, ["baseGravableIva1", "baseGravableIva2", "baseGravableIva3"]);
}

function atsVentaIva(venta: Record<string, unknown>) {
  return sumFields(venta, ["montoIva1", "montoIva2", "montoIva3"]);
}

function resumenComprasAts(compras: Array<Record<string, unknown>>) {
  return {
    facturas: compras.filter((compra) => String(compra.comprobante || "") !== "04").length,
    notasCredito: compras.filter((compra) => String(compra.comprobante || "") === "04").length,
    base0: round2(compras.reduce((acc, compra) => acc + n(compra.baseTarifa0), 0)),
    baseGravada: round2(compras.reduce((acc, compra) => acc + atsCompraBaseGravada(compra), 0)),
    baseNoObjeto: round2(compras.reduce((acc, compra) => acc + n(compra.baseNoObjetoIva), 0)),
    iva: round2(compras.reduce((acc, compra) => acc + atsCompraIva(compra), 0)),
    retIva: round2(
      compras.reduce(
        (acc, compra) =>
          acc +
          n(compra.valorRetencionIva30) +
          n(compra.valorRetencionIva50) +
          n(compra.valorRetencionIva70) +
          n(compra.valorRetencionIva100) +
          n(compra.valorRetencionIva100SectorPublico) +
          n(compra.liqImpSumatoriaRetIva),
        0
      )
    ),
  };
}

function resumenVentasAts(ventas: Array<Record<string, unknown>>) {
  return {
    documentos: ventas.reduce((acc, venta) => acc + Number(venta.cantidadComprobantes || 1), 0),
    base0: round2(ventas.reduce((acc, venta) => acc + n(venta.baseTarifa0), 0)),
    baseGravada: round2(ventas.reduce((acc, venta) => acc + atsVentaBaseGravada(venta), 0)),
    baseNoObjeto: round2(ventas.reduce((acc, venta) => acc + n(venta.baseNoObjetoIva), 0)),
    iva: round2(ventas.reduce((acc, venta) => acc + atsVentaIva(venta), 0)),
    retIva: round2(ventas.reduce((acc, venta) => acc + n(venta.valorRetenidoIva), 0)),
    retFuente: round2(ventas.reduce((acc, venta) => acc + n(venta.valorRetenidoFuente), 0)),
  };
}

function talonHeader(
  doc: PDFKit.PDFDocument,
  tipoDocumento: string,
  nombre: string,
  ruc: string,
  periodo: string,
  fechaGeneracion: string
) {
  const startY = 34;
  doc
    .roundedRect(42, startY, 82, 46, 5)
    .fill("#003565")
    .fillColor("#ffffff")
    .fontSize(24)
    .text("SRI", 42, startY + 11, { width: 82, align: "center" });

  doc
    .fillColor("#003565")
    .fontSize(18)
    .text("TALÓN RESUMEN", 130, startY + 1, { width: 380, align: "center" })
    .fontSize(10)
    .text("SERVICIO DE RENTAS INTERNAS", 130, startY + 23, { width: 380, align: "center" })
    .fontSize(11)
    .fillColor("#111827")
    .text(tipoDocumento, 130, startY + 39, { width: 380, align: "center" });

  doc.moveDown(2.7);
  pdfTable(doc, "DATOS DEL CONTRIBUYENTE", [
    ["Nombre contribuyente", nombre],
    ["RUC", ruc],
    ["Período", periodo],
    ["Fecha de generación", fechaGeneracion],
  ]);
}

function talonTable(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: TalonRow[],
  startX = 42,
  width = 511
) {
  doc.moveDown(0.48).fontSize(9.7).fillColor("#003565").text(title, startX);
  const labelWidth = Math.round(width * 0.68);
  const valueWidth = width - labelWidth;
  let y = doc.y + 4;

  rows.forEach(([label, value, bold], index) => {
    const rowHeight = 18;
    doc
      .rect(startX, y, width, rowHeight)
      .fill(index % 2 === 0 ? "#f8fafc" : "#ffffff")
      .strokeColor("#cbd5e1")
      .rect(startX, y, width, rowHeight)
      .stroke();

    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(7.8)
      .fillColor("#334155")
      .text(label, startX + 6, y + 5, { width: labelWidth - 12 })
      .fillColor("#111827")
      .text(String(value), startX + labelWidth + 6, y + 5, {
        width: valueWidth - 12,
        align: "right",
      })
      .font("Helvetica");

    y += rowHeight;
  });

  doc.y = y + 2;
}

function talonCasilleros(
  doc: PDFKit.PDFDocument,
  title: string,
  casilleros: Record<string, number>,
  labels: Record<string, string>,
  keys: string[]
) {
  const rows = keys
    .filter((key) => Number(casilleros[key] || 0) !== 0 || ["499", "699", "899", "999"].includes(key))
    .map((key) => [`${key} - ${labels[key] || "Casillero"}`, talonMoney(casilleros[key]), ["499", "699", "899", "999"].includes(key)] as TalonRow);

  talonTable(doc, title, rows.length ? rows : [["Sin casilleros con valor", "0.00"]]);
}

function talonDeclaracionTexto(doc: PDFKit.PDFDocument) {
  doc
    .moveDown(0.6)
    .fontSize(7.8)
    .fillColor("#334155")
    .text(
      "Declaro que los valores presentados corresponden a la información registrada y almacenada para la declaración indicada.",
      { align: "justify" }
    );
}

function talonFirmasYPie(doc: PDFKit.PDFDocument, fechaEmision: string) {
  const y = Math.max(doc.y + 26, 705);
  doc
    .strokeColor("#111827")
    .moveTo(82, y)
    .lineTo(242, y)
    .stroke()
    .moveTo(350, y)
    .lineTo(510, y)
    .stroke()
    .fontSize(8)
    .fillColor("#111827")
    .text("Firma del Contador", 82, y + 8, { width: 160, align: "center" })
    .text("Firma del Representante Legal", 350, y + 8, { width: 160, align: "center" });

  doc
    .fontSize(7.2)
    .fillColor("#64748b")
    .text(`Fecha de emisión: ${fechaEmision}`, 42, 812, { width: 250 })
    .text("Page 1 of 1", 360, 812, { width: 170, align: "right" });
}

function periodoTalon(declaracion: { mes: string | null; semestre: string | null; anio: number }) {
  return `${declaracion.mes || declaracion.semestre || "-"} / ${declaracion.anio}`;
}

function findAtsLoteId(root: Record<string, any>, nested: Record<string, any>, resumen: Record<string, any>) {
  const resumenNested = asObject(nested.resumen);
  return (
    root.atsLoteId ||
    root.loteId ||
    nested.atsLoteId ||
    nested.loteId ||
    resumen.atsLoteId ||
    resumen.loteId ||
    resumenNested.atsLoteId ||
    resumenNested.loteId ||
    null
  );
}

function isAtsDeclaracion(formulario: string, tipoImpuesto: string) {
  const value = `${formulario} ${tipoImpuesto}`.toUpperCase();
  return value.includes("ATS") || value.includes("ANEXO TRANSACCIONAL");
}

function getJsonCasilleros(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};

  const root = value as Record<string, unknown>;
  const datosJSON = root.datosJSON;

  if (datosJSON && typeof datosJSON === "object") {
    const nested = datosJSON as Record<string, unknown>;
    if (nested.casilleros && typeof nested.casilleros === "object") {
      return nested.casilleros as Record<string, number>;
    }
  }

  if (root.casilleros && typeof root.casilleros === "object") {
    return root.casilleros as Record<string, number>;
  }

  return {};
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function atsImportadoPorRuc(lote: { resumenJSON: unknown }, ruc: string) {
  const resumen = asObject(lote.resumenJSON);
  return asObject(resumen.contribuyenteAcceso).ruc === ruc;
}

async function contribuyenteOperativoPorAts(rucAcceso: string, anio?: number, mes?: string) {
  const lotes = await prisma.atsLote.findMany({
    where: {
      ...(anio ? { anio } : {}),
      ...(mes ? { mes } : {}),
    },
    include: {
      contribuyente: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
  });

  return lotes.find((lote) => atsImportadoPorRuc(lote, rucAcceso))?.contribuyente || null;
}

async function contribuyenteParaConsulta(ruc: string, anio?: number, mes?: string) {
  const contribuyenteImportado = await contribuyenteOperativoPorAts(ruc, anio, mes);
  if (contribuyenteImportado) return contribuyenteImportado;

  return prisma.contribuyente.findUnique({
    where: { ruc },
  });
}

function previousMonth(anio: number, mesCodigo: string) {
  const mes = Number(mesCodigo);
  if (mes <= 1) {
    return { anio: anio - 1, mes: "Diciembre" };
  }

  const previousCode = String(mes - 1).padStart(2, "0");
  return { anio, mes: mesesMap[previousCode] || previousCode };
}

function initCasilleros(keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function compraRetencionBase(compra: Record<string, unknown>, index: number) {
  const declarada = n(compra[`baseImponibleRet${index}`]);
  if (declarada !== 0) return declarada;

  return (
    n(compra.baseGravableIva1) +
    n(compra.baseGravableIva2) +
    n(compra.baseGravableIva3) +
    n(compra.baseTarifa0) +
    n(compra.baseNoObjetoIva) +
    n(compra.baseExenta)
  );
}

function compraRetencionValor(compra: Record<string, unknown>, index: number, base: number) {
  const declarado = n(compra[`valorRetenido${index}`]);
  if (declarado !== 0) return declarado;

  const porcentaje = n(compra[`porcentajeRetencion${index}`]);
  return porcentaje > 0 ? round2(base * porcentaje) : 0;
}

function buildFormulario103Resumen(lote: {
  id: string;
  rucInformante: string;
  razonSocial: string;
  anio: number;
  mes: string;
  createdAt: Date;
  compras: Array<Record<string, unknown>>;
}) {
  const casilleros = initCasilleros([
    "302",
    "352",
    "303",
    "353",
    "3030",
    "304",
    "354",
    "307",
    "357",
    "308",
    "358",
    "309",
    "359",
    "310",
    "311",
    "361",
    "312",
    "362",
    "3120",
    "3121",
    "314",
    "364",
    "3140",
    "319",
    "320",
    "322",
    "372",
    "323",
    "373",
    "3230",
    "324",
    "325",
    "375",
    "3250",
    "326",
    "327",
    "328",
    "329",
    "330",
    "331",
    "332",
    "333",
    "334",
    "335",
    "336",
    "337",
    "3370",
    "343",
    "3430",
    "393",
    "344",
    "3440",
    "394",
    "345",
    "395",
    "346",
    "396",
    "348",
    "3481",
    "349",
    "350",
    "399",
    "402",
    "403",
    "404",
    "405",
    "406",
    "407",
    "408",
    "409",
    "410",
    "411",
    "412",
    "413",
    "414",
    "415",
    "416",
    "417",
    "418",
    "419",
    "420",
    "421",
    "422",
    "423",
    "424",
    "425",
    "426",
    "427",
    "428",
    "429",
    "430",
    "431",
    "432",
    "433",
    "497",
    "498",
    "499",
    "890",
    "897",
    "898",
    "899",
    "902",
    "903",
    "904",
    "905",
    "907",
    "999",
  ]);

  let comprasConRetencion = 0;
  let comprasSinRetencion = 0;
  let retencionesLeidas = 0;
  const codigosNoMapeados: string[] = [];

  for (const compra of lote.compras) {
    const retenciones = [1, 2, 3]
      .map((index) => {
        const codigo = String(compra[`codigoRetencion${index}`] || "").trim();
        const base = compraRetencionBase(compra, index);
        const valor = compraRetencionValor(compra, index, base);
        return { codigo, base, valor };
      })
      .filter((ret) => ret.codigo && (ret.base !== 0 || ret.valor !== 0));

    if (retenciones.length === 0) {
      comprasSinRetencion += 1;
      continue;
    }

    comprasConRetencion += 1;

    for (const ret of retenciones) {
      retencionesLeidas += 1;
      const map = retencionToCasillero[ret.codigo];

      if (!map) {
        if (!codigosNoMapeados.includes(ret.codigo)) {
          codigosNoMapeados.push(ret.codigo);
        }

        add(casilleros, "346", ret.base);
        add(casilleros, "396", ret.valor);
        continue;
      }

      add(casilleros, map.base, ret.base);
      if (map.retenido) {
        add(casilleros, map.retenido, ret.valor);
      }
    }
  }

  const basesPais = [
    "302",
    "303",
    "304",
    "307",
    "308",
    "309",
    "311",
    "312",
    "314",
    "322",
    "323",
    "325",
    "332",
    "343",
    "344",
    "345",
    "346",
  ];

  const retenidosPais = [
    "352",
    "353",
    "354",
    "357",
    "358",
    "359",
    "361",
    "362",
    "364",
    "372",
    "373",
    "375",
    "393",
    "394",
    "395",
    "396",
  ];

  casilleros["349"] = round2(basesPais.reduce((acc, key) => acc + (casilleros[key] || 0), 0));
  casilleros["399"] = round2(retenidosPais.reduce((acc, key) => acc + (casilleros[key] || 0), 0));
  casilleros["499"] = round2(casilleros["399"] + casilleros["498"]);
  casilleros["902"] = Math.max(round2(casilleros["499"] - casilleros["898"]), 0);
  casilleros["999"] = Math.max(
    round2(casilleros["902"] + casilleros["903"] + casilleros["904"] - casilleros["907"]),
    0
  );
  casilleros["905"] = casilleros["999"];

  return {
    casilleros,
    resumen: {
      atsLoteId: lote.id,
      atsLoteCreatedAt: lote.createdAt,
      comprasLeidas: lote.compras.length,
      comprasConRetencion,
      comprasSinRetencion,
      comprasSinRetencionExcluidas: comprasSinRetencion,
      retencionesLeidas,
      codigosNoMapeados,
    },
  };
}

function buildFormulario104Resumen(lote: {
  rucInformante: string;
  razonSocial: string;
  anio: number;
  mes: string;
  compras: any[];
  ventas: any[];
  anulados: any[];
}) {
  const casilleros: Record<string, number> = {};
  const setZero = (keys: string[]) => keys.forEach((key) => (casilleros[key] = 0));

  setZero([
    "111",
    "113",
    "115",
    "117",
    "119",
    "401",
    "402",
    "403",
    "404",
    "405",
    "406",
    "407",
    "408",
    "411",
    "421",
    "422",
    "429",
    "431",
    "480",
    "481",
    "482",
    "483",
    "484",
    "485",
    "499",
    "500",
    "501",
    "502",
    "507",
    "509",
    "510",
    "517",
    "518",
    "519",
    "520",
    "529",
    "531",
    "532",
    "541",
    "542",
    "563",
    "564",
    "565",
    "601",
    "602",
    "603",
    "604",
    "605",
    "606",
    "607",
    "608",
    "609",
    "610",
    "611",
    "612",
    "613",
    "614",
    "615",
    "617",
    "618",
    "619",
    "620",
    "621",
    "699",
    "721",
    "723",
    "725",
    "727",
    "729",
    "731",
    "799",
    "800",
    "801",
    "859",
    "890",
    "897",
    "898",
    "899",
    "902",
    "903",
    "904",
    "905",
    "906",
    "907",
    "925",
    "999",
  ]);

  const compras = lote.compras;
  const ventas = lote.ventas;
  const facturas = compras.filter((compra) => String(compra.comprobante || "") !== "04");
  const notasCredito = compras.filter((compra) => String(compra.comprobante || "") === "04");

  for (const venta of ventas) {
    add(casilleros, "111", n(venta.cantidadComprobantes || 1));
    add(casilleros, "401", n(venta.baseGravableIva1));
    add(casilleros, "421", n(venta.montoIva1));
    add(casilleros, "609", n(venta.valorRetenidoIva));
  }

  for (const compra of facturas) {
    add(casilleros, "115", 1);
    add(casilleros, "500", n(compra.baseGravableIva1));
    add(casilleros, "520", n(compra.montoIva1));
    add(casilleros, "725", n(compra.valorRetencionIva30));
    add(casilleros, "729", n(compra.valorRetencionIva70));
  }

  let notasCreditoBaseGravada = 0;
  for (const notaCredito of notasCredito) {
    notasCreditoBaseGravada = round2(notasCreditoBaseGravada + Math.abs(n(notaCredito.baseGravableIva1)));
    add(casilleros, "520", -Math.abs(n(notaCredito.montoIva1)));
  }

  casilleros["411"] = casilleros["401"];
  casilleros["429"] = casilleros["421"];
  casilleros["480"] = casilleros["401"];
  casilleros["482"] = casilleros["421"];
  casilleros["484"] = round2(casilleros["480"] * 0.15);
  casilleros["485"] = round2(casilleros["482"] - casilleros["484"]);
  casilleros["499"] = casilleros["484"];

  casilleros["509"] = casilleros["500"];
  casilleros["510"] = round2(casilleros["500"] - notasCreditoBaseGravada);
  casilleros["519"] = casilleros["510"];
  casilleros["529"] = casilleros["520"];
  casilleros["563"] = casilleros["480"] > 0 ? 1 : 0;
  casilleros["564"] = round2(casilleros["529"] * casilleros["563"]);
  casilleros["565"] = round2(casilleros["529"] - casilleros["564"]);

  casilleros["601"] = Math.max(round2(casilleros["499"] - casilleros["564"]), 0);
  casilleros["602"] = Math.max(round2(casilleros["564"] - casilleros["499"]), 0);
  casilleros["615"] = casilleros["602"];
  casilleros["617"] = casilleros["609"];
  casilleros["620"] = Math.max(
    round2(
      casilleros["601"] -
        casilleros["602"] -
        casilleros["603"] -
        casilleros["604"] -
        casilleros["605"] -
        casilleros["606"] -
        casilleros["607"] -
        casilleros["608"] -
        casilleros["609"] +
        casilleros["610"] +
        casilleros["611"] +
        casilleros["612"] +
        casilleros["613"] +
        casilleros["614"]
    ),
    0
  );
  casilleros["699"] = round2(casilleros["620"] + casilleros["621"]);

  casilleros["799"] = round2(
    casilleros["721"] +
      casilleros["723"] +
      casilleros["725"] +
      casilleros["727"] +
      casilleros["729"] +
      casilleros["731"]
  );
  casilleros["801"] = Math.max(round2(casilleros["799"] - casilleros["800"]), 0);
  casilleros["859"] = round2(casilleros["699"] + casilleros["801"]);
  casilleros["902"] = Math.max(round2(casilleros["859"] - casilleros["898"]), 0);
  casilleros["999"] = round2(casilleros["902"] + casilleros["903"] + casilleros["904"]);
  casilleros["905"] = casilleros["999"];

  return casilleros;
}

export const crearDeclaracion = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;
    const anio = Number(req.body.anio);
    const mesCodigo = mesCodigoFromValue(req.body.mes || asObject(req.body.datosJSON).identificacion?.mes);
    const estadoSolicitado = String(req.body.estado || "PRESENTADA").toUpperCase();
    const esBorrador = estadoSolicitado === "BORRADOR";
    const estadoFinal = esBorrador ? "BORRADOR" : "PRESENTADA";
    const declaracionId = String(req.body.declaracionId || "").trim();
    const usaContribuyenteOperativo =
      String(req.body.formulario || "").includes("103") ||
      String(req.body.formulario || "").includes("104");

    const contribuyente = usaContribuyenteOperativo
      ? await contribuyenteParaConsulta(ruc, anio, mesCodigo)
      : await prisma.contribuyente.findUnique({
          where: { ruc },
        });

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    const payload = {
      ...req.body,
      estado: estadoFinal,
      fechaGuardado: new Date().toISOString(),
      ...(esBorrador ? {} : { fechaPresentacion: new Date().toISOString() }),
    };

    const data = {
        formulario: req.body.formulario,
        tipoImpuesto: req.body.tipoImpuesto,
        periodoFiscal: req.body.periodoFiscal,
        anio,
        mes: req.body.mes || null,
        semestre: req.body.semestre || null,

        ventasPeriodo: Boolean(req.body.ventasPeriodo),
        emitioRetenciones: Boolean(req.body.emitioRetenciones),
        tieneEmpleados: Boolean(req.body.tieneEmpleados),

        baseImponible: Number(req.body.baseImponible || 0),
        impuestoGenerado: Number(req.body.impuestoGenerado || 0),
        valorRetenido: Number(req.body.valorRetenido || 0),
        valorCancelado: Number(req.body.valorCancelado || 0),

        tipoPago: req.body.tipoPago || null,
        banco: req.body.banco || null,
        tipoCuenta: req.body.tipoCuenta || null,
        numeroCuenta: req.body.numeroCuenta || null,

        numeroAdhesion: req.body.numeroAdhesion || (esBorrador ? generarNumeroBorrador() : generarNumeroAdhesion()),
        tipoDeclaracion: req.body.tipoDeclaracion || "Original",
        estado: estadoFinal,

        linkFormulario: null,
        linkTalonResumen: null,

        datosJSON: payload,

        contribuyenteId: contribuyente.id,
      };

    const declaracion =
      declaracionId
        ? await prisma.declaracion.update({
            where: { id: declaracionId },
            data: {
              ...data,
              numeroAdhesion: esBorrador ? data.numeroAdhesion : generarNumeroAdhesion(),
            },
          })
        : await prisma.declaracion.create({ data });

    return res.status(201).json({
      message: esBorrador ? "Borrador guardado correctamente." : "Declaración presentada correctamente.",
      declaracion,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error registrando declaración.",
    });
  }
};

export const consultarDeclaraciones = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;
    const { tipoImpuesto, anioDesde, anioHasta, estado } = req.query;

    const lotesImportados = await prisma.atsLote.findMany({
      include: {
        contribuyente: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    const contribuyentesImportadosIds = lotesImportados
      .filter((lote) => atsImportadoPorRuc(lote, ruc))
      .map((lote) => lote.contribuyenteId);

    const declaraciones = await prisma.declaracion.findMany({
      where: {
        OR: [
          {
            contribuyente: {
              ruc,
            },
          },
          ...(contribuyentesImportadosIds.length
            ? [{ contribuyenteId: { in: contribuyentesImportadosIds } }]
            : []),
        ],
        ...(tipoImpuesto && tipoImpuesto !== "Todos"
          ? { tipoImpuesto: String(tipoImpuesto) }
          : {}),
        ...(estado && estado !== "Todas" ? { estado: String(estado) } : {}),
        ...(anioDesde && anioHasta
          ? {
              anio: {
                gte: Number(anioDesde),
                lte: Number(anioHasta),
              },
            }
          : {}),
      },
      orderBy: {
        fechaEnvio: "desc",
      },
    });

    return res.json(declaraciones);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error consultando declaraciones.",
    });
  }
};

export const consultarFormulario103 = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;
    const { anio, mes } = req.query;

    if (!anio || !mes) {
      return res.status(400).json({
        message: "Debe enviar anio y mes.",
      });
    }

    const mesCodigo = String(mes).padStart(2, "0");
    const mesTexto = mesesMap[mesCodigo] || String(mes);

    const lote = await prisma.atsLote.findFirst({
      where: {
        rucInformante: ruc,
        anio: Number(anio),
        mes: mesCodigo,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        compras: true,
      },
    });

    if (!lote) {
      return res.status(404).json({
        message: "No existe un lote ATS para el RUC y período seleccionado.",
      });
    }

    const { casilleros, resumen } = buildFormulario103Resumen({
      ...lote,
      compras: lote.compras as unknown as Array<Record<string, unknown>>,
    });

    return res.json({
      ruc: lote.rucInformante,
      razonSocial: lote.razonSocial,
      anio: Number(anio),
      mes: mesCodigo,
      mesTexto,
      resumen,
      casilleros,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error consultando Formulario 103.",
    });
  }
};

export const consultarFormulario104 = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;
    const { anio, mes } = req.query;

    if (!anio || !mes) {
      return res.status(400).json({
        message: "Debe seleccionar el período fiscal.",
      });
    }

    const anioNumero = Number(anio);
    const mesCodigo = String(mes).padStart(2, "0");
    const mesTexto = mesesMap[mesCodigo] || String(mes);

    const lote = await prisma.atsLote.findFirst({
      where: {
        rucInformante: ruc,
        anio: anioNumero,
        mes: mesCodigo,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        compras: true,
        ventas: true,
        anulados: true,
      },
    });

    if (!lote) {
      return res.status(404).json({
        message: "No existe un lote ATS vigente para el RUC y período seleccionado.",
      });
    }

    const casilleros = buildFormulario104Resumen(lote);

    return res.json({
      ruc: lote.rucInformante,
      razonSocial: lote.razonSocial,
      anio: anioNumero,
      mes: mesCodigo,
      mesTexto,
      semestre: null,
      resumen: {
        atsLoteId: lote.id,
        ventasLeidas: lote.ventas.length,
        comprasLeidas: lote.compras.length,
        anuladosLeidos: lote.anulados.length,
        requiereRevision: ["603", "604", "607", "608", "800"],
      },
      casilleros,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error consultando Formulario 104.",
    });
  }
};

export const descargarDeclaracionPdf = async (req: Request, res: Response) => {
  try {
    const { declaracionId } = req.params;
    const esResumen = String(req.query.tipo || "").toLowerCase() === "resumen";

    const declaracion = await prisma.declaracion.findUnique({
      where: { id: declaracionId },
      include: { contribuyente: true },
    });

    if (!declaracion) {
      return res.status(404).json({ message: "Declaración no encontrada." });
    }

    const root = asObject(declaracion.datosJSON);
    const nested = asObject(root.datosJSON);
    const identificacion = asObject(root.identificacion || nested.identificacion);
    const resumen = asObject(root.resumen || nested.resumen);
    const casilleros = getJsonCasilleros(declaracion.datosJSON);
    const formulario = declaracion.formulario.includes("104") ? "104" : declaracion.formulario.includes("103") ? "103" : "";
    const ruc = String(identificacion.ruc || declaracion.contribuyente.ruc);
    const razonSocial = String(identificacion.razonSocial || declaracion.contribuyente.razonSocial);

    if (esResumen) {
      if (isAtsDeclaracion(declaracion.formulario, declaracion.tipoImpuesto)) {
        const loteId = findAtsLoteId(root, nested, resumen);

        if (!loteId) {
          return res.status(422).json({
            message:
              "No existe un lote ATS asociado a esta declaración. Genere el talón desde el lote ATS o regenere la declaración con referencia al lote.",
          });
        }

        const lote = await prisma.atsLote.findUnique({
          where: { id: String(loteId) },
          include: {
            ventas: true,
            compras: true,
            anulados: true,
            guias: true,
          },
        });

        if (!lote) {
          return res.status(404).json({ message: "Lote ATS asociado no encontrado." });
        }

        const compras = resumenComprasAts(lote.compras as unknown as Array<Record<string, unknown>>);
        const ventas = resumenVentasAts(lote.ventas as unknown as Array<Record<string, unknown>>);
        const periodo = `${String(lote.mes).padStart(2, "0")}/${lote.anio}`;

        return sendPdf(res, `Talon_Resumen_ATS_${lote.rucInformante}_${lote.id}.pdf`, (doc) => {
          talonHeader(
            doc,
            "ANEXO TRANSACCIONAL",
            lote.razonSocial,
            lote.rucInformante,
            periodo,
            fechaHoraLocal(new Date())
          );

          talonTable(doc, "COMPRAS", [
            ["Facturas", talonInt(compras.facturas)],
            ["Notas de crédito", talonInt(compras.notasCredito)],
            ["BI tarifa 0%", talonMoney(compras.base0)],
            ["BI tarifa diferente 0%", talonMoney(compras.baseGravada)],
            ["BI No Objeto IVA", talonMoney(compras.baseNoObjeto)],
            ["Valor IVA", talonMoney(compras.iva), true],
          ]);

          talonTable(doc, "VENTAS", [
            ["Documentos autorizados", talonInt(ventas.documentos)],
            ["BI tarifa 0%", talonMoney(ventas.base0)],
            ["BI tarifa diferente 0%", talonMoney(ventas.baseGravada)],
            ["BI No Objeto IVA", talonMoney(ventas.baseNoObjeto)],
            ["Valor IVA", talonMoney(ventas.iva), true],
          ]);

          talonTable(doc, "RETENCION EN LA FUENTE DE IVA", [
            ["Retención IVA compras", talonMoney(compras.retIva)],
            ["Retenciones que le efectuaron en ventas", talonMoney(ventas.retIva), true],
          ]);

          talonTable(doc, "RESUMEN DE RETENCIONES QUE LE EFECTUARON EN EL PERIODO", [
            ["Retenciones de IVA", talonMoney(ventas.retIva)],
            ["Retenciones en la fuente", talonMoney(ventas.retFuente)],
            ["Total retenciones efectuadas", talonMoney(round2(ventas.retIva + ventas.retFuente)), true],
          ]);

          talonDeclaracionTexto(doc);
          talonFirmasYPie(doc, fechaHoraLocal(new Date()));
        });
      }

      const tipoDocumento = formulario === "104" ? "FORMULARIO 104 - IVA" : "FORMULARIO 103 - RETENCIONES EN LA FUENTE";
      const filename = `Talon_Resumen_${formulario || "Declaracion"}_${ruc}_${declaracion.id}.pdf`;

      return sendPdf(res, filename, (doc) => {
        talonHeader(doc, tipoDocumento, razonSocial, ruc, periodoTalon(declaracion), fechaHoraLocal(new Date()));

        pdfKV(doc, "Número de adhesión", declaracion.numeroAdhesion);
        pdfKV(doc, "Estado", declaracion.estado);
        doc.moveDown(0.4);

        if (formulario === "103") {
          talonTable(doc, "RESUMEN DE RETENCIONES EN LA FUENTE", [
            ["Total retenciones", talonMoney(casilleros["499"] ?? declaracion.valorRetenido), true],
            ["Interés", talonMoney(casilleros["903"] ?? casilleros["897"])],
            ["Multa", talonMoney(casilleros["904"] ?? casilleros["898"])],
            ["Total pagado", talonMoney(casilleros["999"] ?? casilleros["899"] ?? declaracion.valorCancelado), true],
          ]);

          talonCasilleros(
            doc,
            "CASILLEROS RELEVANTES",
            casilleros,
            casilleroLabels103,
            [
              "302",
              "303",
              "304",
              "307",
              "311",
              "314",
              "322",
              "323",
              "325",
              "332",
              "343",
              "344",
              "345",
              "346",
              "352",
              "353",
              "354",
              "357",
              "361",
              "364",
              "372",
              "373",
              "375",
              "393",
              "394",
              "395",
              "396",
              "499",
              "890",
              "897",
              "898",
              "899",
              "902",
              "903",
              "904",
              "999",
            ]
          );
        } else if (formulario === "104") {
          talonTable(doc, "RESUMEN IVA", [
            ["Ventas tarifa diferente 0%", talonMoney(casilleros["401"])],
            ["Ventas tarifa 0%", talonMoney(casilleros["403"])],
            ["Compras tarifa diferente 0%", talonMoney(casilleros["500"])],
            ["Compras tarifa 0%", talonMoney(casilleros["507"] ?? casilleros["502"])],
            ["IVA generado", talonMoney(casilleros["429"] ?? declaracion.impuestoGenerado), true],
            ["Crédito tributario", talonMoney(casilleros["564"])],
            ["Retenciones IVA", talonMoney(casilleros["609"] ?? declaracion.valorRetenido)],
            ["Impuesto a pagar", talonMoney(casilleros["699"] ?? casilleros["902"])],
            ["Total pagado", talonMoney(casilleros["999"] ?? declaracion.valorCancelado), true],
          ]);

          talonCasilleros(
            doc,
            "CASILLEROS RELEVANTES",
            casilleros,
            casilleroLabels104,
            [
              "401",
              "402",
              "403",
              "404",
              "405",
              "406",
              "421",
              "422",
              "429",
              "480",
              "481",
              "484",
              "500",
              "501",
              "502",
              "507",
              "518",
              "563",
              "564",
              "601",
              "602",
              "605",
              "606",
              "609",
              "615",
              "617",
              "620",
              "699",
              "890",
              "897",
              "898",
              "899",
              "902",
              "903",
              "904",
              "999",
            ]
          );
        } else {
          talonTable(doc, "RESUMEN", [
            ["Base imponible", talonMoney(declaracion.baseImponible)],
            ["Impuesto generado", talonMoney(declaracion.impuestoGenerado)],
            ["Valor retenido", talonMoney(declaracion.valorRetenido)],
            ["Valor cancelado", talonMoney(declaracion.valorCancelado), true],
          ]);
        }

        talonDeclaracionTexto(doc);
        talonFirmasYPie(doc, fechaHoraLocal(new Date()));
      });
    }

    if (formulario === "103") {
      return sendPdfLandscape(
        res,
        `Formulario_103_${ruc}_${declaracion.id}.pdf`,
        (doc) => {
          drawFormulario103Pdf({
            doc,
            declaracion,
            ruc,
            razonSocial,
            casilleros,
          });
        }
      );
    }

    if (formulario === "104") {
      return sendPdfLandscape(
        res,
        `Formulario_104_${ruc}_${declaracion.id}.pdf`,
        (doc) => {
          drawFormulario104Pdf({
            doc,
            declaracion,
            ruc,
            razonSocial,
            casilleros,
          });
        }
      );
    }

    return sendPdf(
      res,
      `Formulario_${formulario || "Declaracion"}_${ruc}_${declaracion.id}.pdf`,
      (doc) => {
        pdfTitle(
          doc,
          `FORMULARIO ${formulario || ""}`.trim(),
          declaracion.formulario
        );

        pdfKV(doc, "RUC", ruc);
        pdfKV(doc, "Razón social", razonSocial);
        pdfKV(doc, "Período", `${declaracion.mes || declaracion.semestre || "-"} / ${declaracion.anio}`);
        pdfKV(doc, "Número de adhesión", declaracion.numeroAdhesion);
        pdfKV(doc, "Estado", declaracion.estado);
        pdfKV(doc, "Fecha de generación", fechaLocal(new Date()));

        const rows = Object.entries(casilleros)
          .filter(([, value]) => Number(value || 0) !== 0)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([key, value]) => [`Casillero ${key}`, money(value)] as [string, string]);

        pdfTable(
          doc,
          "VALORES DECLARADOS",
          rows.length ? rows : [["Sin valores calculados", "0.00"]]
        );

        pdfTable(doc, "RESUMEN", [
          ["Base imponible", money(declaracion.baseImponible)],
          ["Impuesto generado", money(declaracion.impuestoGenerado)],
          ["Valor retenido", money(declaracion.valorRetenido)],
          ["Valor cancelado", money(declaracion.valorCancelado)],
          ["Registros leídos", String(resumen.comprasLeidas || resumen.ventasLeidas || "-")],
        ]);

        doc
          .moveDown(1.2)
          .fontSize(8)
          .fillColor("#475569")
          .text(
            "Documento generado dinámicamente a partir de la declaración almacenada en el sistema.",
            { align: "center" }
          );
      }
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error generando PDF de declaración.",
    });
  }
};

export const descargarComprobanteDeclaracion = async (req: Request, res: Response) => {
  try {
    const { declaracionId } = req.params;

    const declaracion = await prisma.declaracion.findUnique({
      where: { id: declaracionId },
      include: { contribuyente: true },
    });

    if (!declaracion) {
      return res.status(404).json({ message: "Declaración no encontrada." });
    }

    const root = asObject(declaracion.datosJSON);
    const nested = asObject(root.datosJSON);
    const identificacion = asObject(root.identificacion || nested.identificacion);
    const ruc = String(identificacion.ruc || declaracion.contribuyente.ruc);
    const razonSocial = String(identificacion.razonSocial || declaracion.contribuyente.razonSocial);
    const formulario = declaracion.formulario.includes("103") ? "Formulario 103" : declaracion.formulario;
    const fechaPresentacion = String(root.fechaPresentacion || nested.fechaPresentacion || declaracion.fechaEnvio);

    return sendPdf(res, `Comprobante_${filenameSafe(formulario)}_${ruc}_${declaracion.id}.pdf`, (doc) => {
      pdfTitle(doc, "COMPROBANTE DE PRESENTACIÓN", formulario);
      pdfTable(doc, "DATOS DE LA DECLARACIÓN", [
        ["Número de adhesión", declaracion.numeroAdhesion],
        ["Formulario", formulario],
        ["RUC", ruc],
        ["Razón social", razonSocial],
        ["Período", periodoTalon(declaracion)],
        ["Fecha presentación", fechaHoraLocal(fechaPresentacion)],
        ["Estado", declaracion.estado],
        ["Valor pagado", money(declaracion.valorCancelado)],
      ]);

      doc
        .moveDown(1.2)
        .fontSize(8)
        .fillColor("#475569")
        .text("Este comprobante resume la declaración registrada en el sistema.", { align: "center" });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error generando comprobante de declaración.",
    });
  }
};

export const consultarFormulario107 = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;
    const { anio } = req.query;

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { ruc },
    });

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    return res.json({
      anio,
      empleadores: [
        {
          ruc: "0999999999001",
          razonSocial: "EMPRESA DEMO ECUADOR S.A.",
        },
        {
          ruc: "1799999999001",
          razonSocial: "CORPORACION TRIBUTARIA DEL ECUADOR",
        },
      ],
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error consultando formulario 107.",
    });
  }
};
