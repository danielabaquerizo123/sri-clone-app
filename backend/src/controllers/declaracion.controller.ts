import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma";

function generarNumeroAdhesion() {
  return `ADH-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
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
  "499": "Total retenciones",
  "890": "Pago previo",
  "897": "Interés por mora",
  "898": "Multa",
  "899": "Total impuesto a pagar",
  "902": "Impuesto causado",
  "903": "Interés",
  "904": "Multa",
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

    const declaracion = await prisma.declaracion.create({
      data: {
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

        numeroAdhesion: generarNumeroAdhesion(),
        tipoDeclaracion: req.body.tipoDeclaracion || "Original",
        estado: "Procesada",

        linkFormulario: null,
        linkTalonResumen: null,

        datosJSON: req.body,

        contribuyenteId: contribuyente.id,
      },
    });

    return res.status(201).json({
      message: "Declaración registrada correctamente.",
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

    const contribuyente = await contribuyenteParaConsulta(ruc, Number(anio), mesCodigo);

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    const fechaDesde = new Date(Number(anio), Number(mesCodigo) - 1, 1);
    const fechaHasta = new Date(Number(anio), Number(mesCodigo), 1);

    const compras = await prisma.compra.findMany({
      where: {
        contribuyenteId: contribuyente.id,
        OR: [
          {
            periodoDeclaradoEn103: mesTexto,
          },
          {
            periodoDeclaradoEn103: mesCodigo,
          },
          {
            fechaEmisionRet1: {
              gte: fechaDesde,
              lt: fechaHasta,
            },
          },
          {
            fechaRegistro: {
              gte: fechaDesde,
              lt: fechaHasta,
            },
          },
        ],
      },
    });

    const casilleros: Record<string, number> = {
      "302": 0,
      "352": 0,
      "303": 0,
      "353": 0,
      "304": 0,
      "354": 0,
      "307": 0,
      "357": 0,
      "308": 0,
      "358": 0,
      "309": 0,
      "359": 0,
      "311": 0,
      "361": 0,
      "312": 0,
      "362": 0,
      "314": 0,
      "364": 0,
      "322": 0,
      "372": 0,
      "323": 0,
      "373": 0,
      "325": 0,
      "375": 0,
      "332": 0,
      "343": 0,
      "393": 0,
      "344": 0,
      "394": 0,
      "345": 0,
      "395": 0,
      "346": 0,
      "396": 0,
      "349": 0,
      "399": 0,
      "497": 0,
      "498": 0,
      "499": 0,
      "890": 0,
      "897": 0,
      "898": 0,
      "899": 0,
      "902": 0,
      "903": 0,
      "904": 0,
      "999": 0,
    };

    let comprasConRetencion = 0;
    let comprasSinRetencion = 0;
    let comprasSinRetencionExcluidas = 0;
    let retencionesLeidas = 0;
    const codigosNoMapeados: string[] = [];

    for (const compra of compras) {
      const retenciones = [
        {
          codigo: compra.codigoRetencion1,
          base: n(compra.baseImponibleRet1),
          valor: n(compra.valorRetenido1),
        },
        {
          codigo: compra.codigoRetencion2,
          base: n(compra.baseImponibleRet2),
          valor: n(compra.valorRetenido2),
        },
        {
          codigo: compra.codigoRetencion3,
          base: n(compra.baseImponibleRet3),
          valor: n(compra.valorRetenido3),
        },
      ].filter((ret) => ret.codigo && (ret.base > 0 || ret.valor > 0));

      if (retenciones.length === 0) {
        comprasSinRetencion += 1;
        comprasSinRetencionExcluidas += 1;
        continue;
      }

      comprasConRetencion += 1;

      for (const ret of retenciones) {
        retencionesLeidas += 1;

        const codigo = String(ret.codigo);
        const map = retencionToCasillero[codigo];

        if (!map) {
          if (!codigosNoMapeados.includes(codigo)) {
            codigosNoMapeados.push(codigo);
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

    casilleros["349"] = round2(
      basesPais.reduce((acc, key) => acc + (casilleros[key] || 0), 0)
    );

    casilleros["399"] = round2(
      retenidosPais.reduce((acc, key) => acc + (casilleros[key] || 0), 0)
    );

    casilleros["499"] = round2(casilleros["399"] + casilleros["498"]);
    casilleros["902"] = casilleros["499"];
    casilleros["999"] = round2(casilleros["902"] + casilleros["903"] + casilleros["904"]);

    return res.json({
      ruc: contribuyente.ruc,
      razonSocial: contribuyente.razonSocial,
      anio: Number(anio),
      mes: mesCodigo,
      mesTexto,
      resumen: {
        comprasLeidas: compras.length,
        comprasConRetencion,
        comprasSinRetencion,
        comprasSinRetencionExcluidas,
        retencionesLeidas,
        codigosNoMapeados,
      },
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
