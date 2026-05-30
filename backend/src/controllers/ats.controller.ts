import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma";
import { readAtsWorkbook } from "../services/ats/excel-reader";
import { normalizeAtsWorkbook, type AtsIssue } from "../services/ats/normalizer";
import { buildAtsXml } from "../services/ats/xml-builder";

const MESES: Record<string, string> = {
  ENERO: "01",
  FEBRERO: "02",
  MARZO: "03",
  ABRIL: "04",
  MAYO: "05",
  JUNIO: "06",
  JULIO: "07",
  AGOSTO: "08",
  SEPTIEMBRE: "09",
  SETIEMBRE: "09",
  OCTUBRE: "10",
  NOVIEMBRE: "11",
  DICIEMBRE: "12",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function buildErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function toDate(value: any): Date {
  if (!value) return new Date();

  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const raw = String(value).trim();

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + serial * 86400000);
      return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    }
  }

  const parts = raw.split(/[\/\-]/);
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900) {
      return new Date(y, m - 1, d);
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function inferPeriodoFromFilename(filename: string) {
  const upper = filename.toUpperCase();

  let anio = new Date().getFullYear();
  let mes = "01";

  const yearMatch = upper.match(/\b(20\d{2})\b/);
  if (yearMatch) anio = Number(yearMatch[1]);

  for (const [nombreMes, numeroMes] of Object.entries(MESES)) {
    if (upper.includes(nombreMes)) {
      mes = numeroMes;
      break;
    }
  }

  return { anio, mes };
}

function getPeriodoFromWorkbookOrFile(
  workbookData: ReturnType<typeof readAtsWorkbook>,
  filename: string
) {
  const fromFile = inferPeriodoFromFilename(filename);

  let anio = fromFile.anio;
  let mes = fromFile.mes;

  const transactionalRows = [
    ...(workbookData.ventas?.rows || []),
    ...(workbookData.compras?.rows || []),
  ];

  for (const row of transactionalRows) {
    for (const [key, value] of Object.entries(row)) {
      const keyNormalized = String(key)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (keyNormalized.includes("mes declarado")) {
        const mesValue = String(value ?? "").trim();

        if (/^(0?[1-9]|1[0-2])$/.test(mesValue)) {
          mes = mesValue.padStart(2, "0");
          break;
        }
      }

      if (keyNormalized.includes("periodo declarado")) {
        const periodo = String(value ?? "").trim();
        const match = periodo.match(/(0[1-9]|1[0-2])[\/\-](20\d{2})/);

        if (match) {
          mes = match[1];
          anio = Number(match[2]);
          break;
        }
      }
    }
  }

  if (workbookData.informante?.anio) {
    anio = workbookData.informante.anio;
  }

  return { anio, mes };
}

function safeString(value: any, fallback = "") {
  const text = clean(value);
  return text || fallback;
}

function safeNullableString(value: any) {
  const text = clean(value);
  return text || null;
}

function safeNumber(value: any, fallback = 0) {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : fallback;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function pdfMoney(value: unknown) {
  return Number(value || 0).toFixed(2);
}

function pdfInt(value: unknown) {
  return String(Number(value || 0));
}

function filenameSafe(value: string) {
  return value.replace(/[^\w.-]+/g, "_");
}

function fechaLocal(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-EC");
}

function sendPdf(res: Response, filename: string, build: (doc: PDFKit.PDFDocument) => void) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
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

function compraBaseGravada(compra: any) {
  return (
    safeNumber(compra.baseGravableIva1) +
    safeNumber(compra.baseGravableIva2) +
    safeNumber(compra.baseGravableIva3)
  );
}

function compraIva(compra: any) {
  return safeNumber(compra.montoIva1) + safeNumber(compra.montoIva2) + safeNumber(compra.montoIva3);
}

function ventaBaseGravada(venta: any) {
  return (
    safeNumber(venta.baseGravableIva1) +
    safeNumber(venta.baseGravableIva2) +
    safeNumber(venta.baseGravableIva3)
  );
}

function ventaIva(venta: any) {
  return safeNumber(venta.montoIva1) + safeNumber(venta.montoIva2) + safeNumber(venta.montoIva3);
}

function comprasResumen(compras: any[]) {
  const facturas = compras.filter((c) => c.comprobante !== "04").length;
  const notasCredito = compras.filter((c) => c.comprobante === "04").length;

  return {
    facturas,
    notasCredito,
    base0: round2(compras.reduce((acc, c) => acc + safeNumber(c.baseTarifa0), 0)),
    baseGravada: round2(compras.reduce((acc, c) => acc + compraBaseGravada(c), 0)),
    baseNoObjeto: round2(compras.reduce((acc, c) => acc + safeNumber(c.baseNoObjetoIva), 0)),
    iva: round2(compras.reduce((acc, c) => acc + compraIva(c), 0)),
    retIva: round2(
      compras.reduce(
        (acc, c) =>
          acc +
          safeNumber(c.valorRetencionIva30) +
          safeNumber(c.valorRetencionIva50) +
          safeNumber(c.valorRetencionIva70) +
          safeNumber(c.valorRetencionIva100) +
          safeNumber(c.valorRetencionIva100SectorPublico) +
          safeNumber(c.liqImpSumatoriaRetIva),
        0
      )
    ),
  };
}

function ventasResumen(ventas: any[]) {
  return {
    documentos: ventas.reduce((acc, v) => acc + Number(v.cantidadComprobantes || 1), 0),
    base0: round2(ventas.reduce((acc, v) => acc + safeNumber(v.baseTarifa0), 0)),
    baseGravada: round2(ventas.reduce((acc, v) => acc + ventaBaseGravada(v), 0)),
    baseNoObjeto: round2(ventas.reduce((acc, v) => acc + safeNumber(v.baseNoObjetoIva), 0)),
    iva: round2(ventas.reduce((acc, v) => acc + ventaIva(v), 0)),
    retIva: round2(ventas.reduce((acc, v) => acc + safeNumber(v.valorRetenidoIva), 0)),
    retFuente: round2(ventas.reduce((acc, v) => acc + safeNumber(v.valorRetenidoFuente), 0)),
  };
}

function pdfTable(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: Array<[string, string | number]>,
  startX = 42,
  width = 511
) {
  doc.moveDown(0.55).fontSize(10).fillColor("#003565").text(title, startX);
  const labelWidth = Math.round(width * 0.68);
  const valueWidth = width - labelWidth;
  let y = doc.y + 5;

  rows.forEach(([label, value], index) => {
    const rowHeight = 20;
    doc
      .rect(startX, y, width, rowHeight)
      .fill(index % 2 === 0 ? "#f8fafc" : "#ffffff")
      .strokeColor("#d7dde6")
      .rect(startX, y, width, rowHeight)
      .stroke();

    doc
      .fontSize(8)
      .fillColor("#334155")
      .text(label, startX + 7, y + 6, { width: labelWidth - 14 })
      .fillColor("#111827")
      .text(String(value), startX + labelWidth + 7, y + 6, {
        width: valueWidth - 14,
        align: "right",
      });

    y += rowHeight;
  });

  doc.y = y + 2;
}

function jsonObject(value: any): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getIssuesFromLote(value: any): AtsIssue[] {
  return Array.isArray(value) ? (value as AtsIssue[]) : [];
}

function buildImportIssue(
  hoja: string,
  fila: number,
  campo: string,
  error: unknown
): AtsIssue {
  return {
    tipo: "ERROR",
    hoja,
    fila,
    campo,
    mensaje: buildErrorMessage(error),
  };
}

function sanitizeVenta(v: any, contribuyenteId: string, atsLoteId: string) {
  return {
    noIdentificacion: safeString(v.noIdentificacion, "9999999999999"),
    codigoIdentif: safeString(v.codigoIdentif, "07"),
    razonSocialCliente: safeString(v.razonSocialCliente, "CONSUMIDOR FINAL"),
    tipoCliente: safeNullableString(v.tipoCliente),
    parteRelacionada: safeString(v.parteRelacionada, "NO"),

    cantidadComprobantes: safeNumber(v.cantidadComprobantes, 1),
    tipoEmisionComprobante: safeString(v.tipoEmisionComprobante, "ELECTRONICA"),
    tipoComprobante: safeString(v.tipoComprobante, "18"),
    fechaEmision: toDate(v.fechaEmision),
    codigoEstablecimiento: safeString(v.codigoEstablecimiento, "001"),
    noDocumento: safeNullableString(v.noDocumento),
    conceptoVenta: safeNullableString(v.conceptoVenta),

    baseNoObjetoIva: safeNumber(v.baseNoObjetoIva),
    baseExenta: safeNumber(v.baseExenta),
    baseTarifa0: safeNumber(v.baseTarifa0),
    baseGravableIva1: safeNumber(v.baseGravableIva1),
    tarifaIva1Aplicada: safeNumber(v.tarifaIva1Aplicada, 15),
    montoIva1: safeNumber(v.montoIva1),
    baseGravableIva2: safeNumber(v.baseGravableIva2),
    tarifaIva2Aplicada: safeNumber(v.tarifaIva2Aplicada),
    montoIva2: safeNumber(v.montoIva2),
    baseGravableIva3: safeNumber(v.baseGravableIva3),
    tarifaIva3Aplicada: safeNumber(v.tarifaIva3Aplicada),
    montoIva3: safeNumber(v.montoIva3),

    montoIceNoIncluido: safeNumber(v.montoIceNoIncluido),
    montoIceIncluido: safeNumber(v.montoIceIncluido),
    montoPropina: safeNumber(v.montoPropina),
    montoIrbpnrOtros: safeNumber(v.montoIrbpnrOtros),
    totalDocumento: safeNumber(v.totalDocumento),
    valorDescuentos: safeNumber(v.valorDescuentos),
    totalSubsidios: safeNumber(v.totalSubsidios),
    sumaDevoluciones: safeNumber(v.sumaDevoluciones),

    autocodigoVentas: safeNullableString(v.autocodigoVentas),
    conceptoContableVenta: safeNullableString(v.conceptoContableVenta),
    numeroAsientoVenta: safeNullableString(v.numeroAsientoVenta),
    estadoContableVenta: safeNullableString(v.estadoContableVenta),
    tipoActividad: safeNullableString(v.tipoActividad),

    codigoForm104_1: safeNumber(v.codigoForm104_1),
    codigoForm104_2: safeNumber(v.codigoForm104_2),
    codigoForm104_3: safeNumber(v.codigoForm104_3),
    mesDeclarado: safeNullableString(v.mesDeclarado),
    periodoDeclaradoForm104: safeNullableString(v.periodoDeclaradoForm104),
    form104_a: safeNullableString(v.form104_a),
    form104_b: safeNullableString(v.form104_b),
    form104_c: safeNullableString(v.form104_c),
    baseForm104_NoGravExenta: safeNumber(v.baseForm104_NoGravExenta),
    ivaForm104_Base444: safeNumber(v.ivaForm104_Base444),
    ivaForm104_411_412_420_435: safeNumber(v.ivaForm104_411_412_420_435),
    ivaForm104_413_414: safeNumber(v.ivaForm104_413_414),

    tipoEmisionRetencion: safeNullableString(v.tipoEmisionRetencion),
    valorRetenidoIva: safeNumber(v.valorRetenidoIva),
    valorRetenidoFuente: safeNumber(v.valorRetenidoFuente),
    valorRetenidoIsd: safeNumber(v.valorRetenidoIsd),
    noDocumentoRetencion: safeNullableString(v.noDocumentoRetencion),
    fechaRetencion: v.fechaRetencion ? toDate(v.fechaRetencion) : null,
    noAutorizacionRetencion: safeNullableString(v.noAutorizacionRetencion),

    retFuenteBaseImponible1: safeNumber(v.retFuenteBaseImponible1),
    retFuenteValorRetenido1: safeNumber(v.retFuenteValorRetenido1),
    retFuenteBaseImponible2: safeNumber(v.retFuenteBaseImponible2),
    retFuenteValorRetenido2: safeNumber(v.retFuenteValorRetenido2),
    retFuenteBaseImponible3: safeNumber(v.retFuenteBaseImponible3),
    retFuenteValorRetenido3: safeNumber(v.retFuenteValorRetenido3),

    retIvaBase10: safeNumber(v.retIvaBase10),
    retIvaValor10: safeNumber(v.retIvaValor10),
    retIvaBase20: safeNumber(v.retIvaBase20),
    retIvaValor20: safeNumber(v.retIvaValor20),
    retIvaBase30: safeNumber(v.retIvaBase30),
    retIvaValor30: safeNumber(v.retIvaValor30),
    retIvaBase50: safeNumber(v.retIvaBase50),
    retIvaValor50: safeNumber(v.retIvaValor50),
    retIvaBase70: safeNumber(v.retIvaBase70),
    retIvaValor70: safeNumber(v.retIvaValor70),
    retIvaBase100: safeNumber(v.retIvaBase100),
    retIvaValor100: safeNumber(v.retIvaValor100),

    conceptoContableRetencion: safeNullableString(v.conceptoContableRetencion),
    numeroAsientoRetencion: safeNullableString(v.numeroAsientoRetencion),
    estadoContableRetencion: safeNullableString(v.estadoContableRetencion),

    codigoDocto: safeNullableString(v.codigoDocto),
    claseDoctoElectronico: safeNullableString(v.claseDoctoElectronico),
    estadoDoctoElectronico: safeNullableString(v.estadoDoctoElectronico),
    campoBusqueda: safeNullableString(v.campoBusqueda),
    observaciones: safeNullableString(v.observaciones),

    formaPago1: safeNullableString(v.formaPago1),
    formaPago2: safeNullableString(v.formaPago2),

    contribuyenteId,
    atsLoteId,
  };
}

function sanitizeCompra(c: any, contribuyenteId: string, atsLoteId: string) {
  return {
    noIdentificacion: safeString(c.noIdentificacion),
    razonSocialProveedor: safeString(c.razonSocialProveedor, "SIN RAZÓN SOCIAL"),
    tipoProveedor: safeNullableString(c.tipoProveedor),
    parteRelacionada: safeString(c.parteRelacionada, "NO"),
    validacionIdentificacion: safeNullableString(c.validacionIdentificacion),

    tipoEmisionComprobante: safeNullableString(c.tipoEmisionComprobante),
    comprobante: safeString(c.comprobante),
    establecimiento: safeString(c.establecimiento, "001"),
    puntoEmision: safeString(c.puntoEmision, "001"),
    numeroSecuencial: safeString(c.numeroSecuencial, "000000000"),
    numeroAutorizacionSri: safeString(c.numeroAutorizacionSri),
    fechaEmision: toDate(c.fechaEmision),
    fechaRegistro: toDate(c.fechaRegistro),
    codigoSustento: safeString(c.codigoSustento, "01"),
    conceptoCompra: safeNullableString(c.conceptoCompra),

    comprobanteModificado: safeNullableString(c.comprobanteModificado),
    establecimientoModificado: safeNullableString(c.establecimientoModificado),
    puntoEmisionModificado: safeNullableString(c.puntoEmisionModificado),
    numeroSecuencialModificado: safeNullableString(c.numeroSecuencialModificado),
    numeroAutorizacionSriModificado: safeNullableString(c.numeroAutorizacionSriModificado),

    baseNoObjetoIva: safeNumber(c.baseNoObjetoIva),
    baseExenta: safeNumber(c.baseExenta),
    baseTarifa0: safeNumber(c.baseTarifa0),
    baseGravableIva1: safeNumber(c.baseGravableIva1),
    tarifaIva1Aplicada: safeNumber(c.tarifaIva1Aplicada, 15),
    montoIva1: safeNumber(c.montoIva1),
    baseGravableIva2: safeNumber(c.baseGravableIva2),
    tarifaIva2Aplicada: safeNumber(c.tarifaIva2Aplicada),
    montoIva2: safeNumber(c.montoIva2),
    baseGravableIva3: safeNumber(c.baseGravableIva3),
    tarifaIva3Aplicada: safeNumber(c.tarifaIva3Aplicada),
    montoIva3: safeNumber(c.montoIva3),

    montoIceNoIncluido: safeNumber(c.montoIceNoIncluido),
    montoIceIncluido: safeNumber(c.montoIceIncluido),
    montoPropina: safeNumber(c.montoPropina),
    montoIrbpnr: safeNumber(c.montoIrbpnr),
    montoOtros: safeNumber(c.montoOtros),
    totalDocumento: safeNumber(c.totalDocumento),
    valorDescuentos2: safeNumber(c.valorDescuentos2),
    otrosValores: safeNumber(c.otrosValores),
    sumaDevoluciones: safeNumber(c.sumaDevoluciones),

    establecimientoRet: safeNullableString(c.establecimientoRet),
    puntoEmisionRet: safeNullableString(c.puntoEmisionRet),
    numeroSecuencialRet: safeNullableString(c.numeroSecuencialRet),
    numeroAutorizacionSriRet: safeNullableString(c.numeroAutorizacionSriRet),
    fechaEmisionRet1: c.fechaEmisionRet1 ? toDate(c.fechaEmisionRet1) : null,

    codigoRetencion1: safeNullableString(c.codigoRetencion1),
    baseImponibleRet1: safeNumber(c.baseImponibleRet1),
    porcentajeRetencion1: safeNumber(c.porcentajeRetencion1),
    valorRetenido1: safeNumber(c.valorRetenido1),
    codigoRetencion2: safeNullableString(c.codigoRetencion2),
    baseImponibleRet2: safeNumber(c.baseImponibleRet2),
    porcentajeRetencion2: safeNumber(c.porcentajeRetencion2),
    valorRetenido2: safeNumber(c.valorRetenido2),
    codigoRetencion3: safeNullableString(c.codigoRetencion3),
    baseImponibleRet3: safeNumber(c.baseImponibleRet3),
    porcentajeRetencion3: safeNumber(c.porcentajeRetencion3),
    valorRetenido3: safeNumber(c.valorRetenido3),

    valorRetencionIva30: safeNumber(c.valorRetencionIva30),
    valorRetencionIva50: safeNumber(c.valorRetencionIva50),
    valorRetencionIva70: safeNumber(c.valorRetencionIva70),
    valorRetencionIva100: safeNumber(c.valorRetencionIva100),
    valorRetencionIva100SectorPublico: safeNumber(c.valorRetencionIva100SectorPublico),
    valorRetencionIvaEnNc: safeNumber(c.valorRetencionIvaEnNc),
    totalRetencionIvaFte: safeNumber(c.totalRetencionIvaFte),

    tipoPago: safeNullableString(c.tipoPago),
    formaPago1: safeNullableString(c.formaPago1),
    formaPago2: safeNullableString(c.formaPago2),

    contribuyenteId,
    atsLoteId,
  };
}

function sanitizeAnulado(a: any, contribuyenteId: string, atsLoteId: string) {
  return {
    tipoComprobante: safeString(a.tipoComprobante),
    establecimiento: safeString(a.establecimiento, "001"),
    puntoEmision: safeString(a.puntoEmision, "001"),
    secuencialDesde: safeString(a.secuencialDesde),
    secuencialHasta: safeString(a.secuencialHasta),
    numeroAutorizacionSri: safeString(a.numeroAutorizacionSri),
    tipoEmisionComprobante: safeString(a.tipoEmisionComprobante, "ELECTRONICA"),
    fechaRegistroAnulacion: toDate(a.fechaRegistroAnulacion),
    periodoDeclaradoForm104: safeNullableString(a.periodoDeclaradoForm104),
    observaciones: safeNullableString(a.observaciones),
    contribuyenteId,
    atsLoteId,
  };
}

function sanitizeGuia(g: any, contribuyenteId: string, atsLoteId: string) {
  return {
    noIdentificacionEmisor: safeString(g.noIdentificacionEmisor),
    razonSocialEmisor: safeString(g.razonSocialEmisor, "SIN RAZÓN SOCIAL"),
    tipoDocumento: safeString(g.tipoDocumento),
    comprobante: safeString(g.comprobante),
    establecimiento: safeString(g.establecimiento, "001"),
    puntoEmision: safeString(g.puntoEmision, "001"),
    numeroSecuencial: safeString(g.numeroSecuencial),
    numeroAutorizacionSri: safeString(g.numeroAutorizacionSri),
    noIdentificacionTransportista: safeString(g.noIdentificacionTransportista),
    razonSocialTransportista: safeString(g.razonSocialTransportista, "SIN RAZÓN SOCIAL"),
    noPlaca: safeString(g.noPlaca),
    fechaInicioTransporte: toDate(g.fechaInicioTransporte),
    fechaFinTransporte: toDate(g.fechaFinTransporte),
    direccionPartida: safeString(g.direccionPartida, "SIN DIRECCIÓN"),
    noIdentificacionDestinatario: safeString(g.noIdentificacionDestinatario),
    razonSocialDestinatario: safeString(g.razonSocialDestinatario, "SIN RAZÓN SOCIAL"),
    noDocumentoAduaneroUnico: safeNullableString(g.noDocumentoAduaneroUnico),
    direccionDestinatario: safeString(g.direccionDestinatario, "SIN DIRECCIÓN"),
    ruta: safeString(g.ruta, "SIN RUTA"),
    motivoTraslado: safeString(g.motivoTraslado, "SIN MOTIVO"),
    comprobanteSustento: safeNullableString(g.comprobanteSustento),
    numeroDocumentoSustento: safeNullableString(g.numeroDocumentoSustento),
    fechaEmisionDocumentoSustento: g.fechaEmisionDocumentoSustento
      ? toDate(g.fechaEmisionDocumentoSustento)
      : null,
    numeroAutorizacionSriSustento: safeNullableString(g.numeroAutorizacionSriSustento),
    observaciones: safeNullableString(g.observaciones),
    codigoAutomatico: safeNullableString(g.codigoAutomatico),
    contribuyenteId,
    atsLoteId,
  };
}

async function findOrCreateInformante(rucInformante: string, razonSocialInformante: string) {
  const temporalHash = await bcrypt.hash(`ats-${rucInformante}-${Date.now()}`, 10);

  return prisma.contribuyente.upsert({
    where: { ruc: rucInformante },
    update: {
      razonSocial: razonSocialInformante,
      estadoRuc: "ACTIVO",
      regimen: "GENERAL",
      estadoTributario: "AL DÍA",
    },
    create: {
      ruc: rucInformante,
      clave: temporalHash,
      razonSocial: razonSocialInformante,
      estadoRuc: "ACTIVO",
      regimen: "GENERAL",
      estadoTributario: "AL DÍA",
      tipoContribuyente: "PERSONA_NATURAL",
      rol: "CONTADOR",
    },
  });
}

function buildFormulario103Data(params: {
  contribuyente: { ruc: string; razonSocial: string };
  anio: number;
  mes: string;
  periodicidad?: string;
  resumen: Record<string, any>;
  compras: any[];
}) {
  const casilleros: Record<string, number> = {};
  const add = (key: string, value: number) => {
    casilleros[key] = round2((casilleros[key] || 0) + value);
  };

  for (const compra of params.compras) {
    add("349", safeNumber(compra.baseImponibleRet1) + safeNumber(compra.baseImponibleRet2) + safeNumber(compra.baseImponibleRet3));
    add("399", safeNumber(compra.valorRetenido1) + safeNumber(compra.valorRetenido2) + safeNumber(compra.valorRetenido3));
  }

  casilleros["499"] = round2(casilleros["399"] || 0);
  casilleros["902"] = casilleros["499"];
  casilleros["999"] = casilleros["902"];

  return {
    identificacion: {
      ruc: params.contribuyente.ruc,
      razonSocial: params.contribuyente.razonSocial,
      anio: params.anio,
      mes: params.mes,
      periodicidad: params.periodicidad || "MENSUAL",
    },
    resumen: params.resumen,
    casilleros,
  };
}

function buildFormulario104Data(params: {
  contribuyente: { ruc: string; razonSocial: string };
  anio: number;
  mes: string;
  periodicidad?: string;
  resumen: Record<string, any>;
  ventas: any[];
  compras: any[];
}) {
  const casilleros: Record<string, number> = {
    "401": 0,
    "402": 0,
    "403": 0,
    "431": 0,
    "500": 0,
    "501": 0,
    "507": 0,
    "531": 0,
    "532": 0,
    "609": 0,
    "731": 0,
    "902": 0,
    "999": 0,
  };

  const add = (key: string, value: number) => {
    casilleros[key] = round2((casilleros[key] || 0) + value);
  };

  for (const venta of params.ventas) {
    add("401", safeNumber(venta.baseGravableIva1) + safeNumber(venta.baseGravableIva2) + safeNumber(venta.baseGravableIva3));
    add("402", safeNumber(venta.montoIva1) + safeNumber(venta.montoIva2) + safeNumber(venta.montoIva3));
    add("403", safeNumber(venta.baseTarifa0));
    add("431", safeNumber(venta.baseNoObjetoIva) + safeNumber(venta.baseExenta));
    add("609", safeNumber(venta.valorRetenidoIva));
  }

  for (const compra of params.compras) {
    add("500", safeNumber(compra.baseGravableIva1) + safeNumber(compra.baseGravableIva2) + safeNumber(compra.baseGravableIva3));
    add("501", safeNumber(compra.montoIva1) + safeNumber(compra.montoIva2) + safeNumber(compra.montoIva3));
    add("507", safeNumber(compra.baseTarifa0));
    add("531", safeNumber(compra.baseNoObjetoIva));
    add("532", safeNumber(compra.baseExenta));
    add(
      "731",
      safeNumber(compra.valorRetencionIva30) +
        safeNumber(compra.valorRetencionIva50) +
        safeNumber(compra.valorRetencionIva70) +
        safeNumber(compra.valorRetencionIva100) +
        safeNumber(compra.valorRetencionIva100SectorPublico)
    );
  }

  casilleros["902"] = Math.max(round2(casilleros["402"] - casilleros["501"] - casilleros["609"]), 0);
  casilleros["999"] = casilleros["902"];

  return {
    identificacion: {
      ruc: params.contribuyente.ruc,
      razonSocial: params.contribuyente.razonSocial,
      anio: params.anio,
      mes: params.mes,
      periodicidad: params.periodicidad || "MENSUAL",
    },
    resumen: params.resumen,
    casilleros,
  };
}

async function upsertDeclaracionDesdeAts(params: {
  contribuyenteId: string;
  formulario: string;
  tipoImpuesto: string;
  periodoFiscal: string;
  anio: number;
  mes: string;
  datosJSON: Record<string, any>;
  baseImponible: number;
  impuestoGenerado: number;
  valorRetenido: number;
  valorCancelado: number;
}) {
  const existing = await prisma.declaracion.findFirst({
    where: {
      contribuyenteId: params.contribuyenteId,
      formulario: params.formulario,
      anio: params.anio,
      mes: params.mes,
      tipoDeclaracion: "Original",
    },
  });

  const data = {
    formulario: params.formulario,
    tipoImpuesto: params.tipoImpuesto,
    periodoFiscal: params.periodoFiscal,
    anio: params.anio,
    mes: params.mes,
    semestre: null,
    ventasPeriodo: Boolean(params.datosJSON.resumen?.ventasLeidas),
    emitioRetenciones: params.valorRetenido > 0,
    tieneEmpleados: false,
    baseImponible: params.baseImponible,
    impuestoGenerado: params.impuestoGenerado,
    valorRetenido: params.valorRetenido,
    valorCancelado: params.valorCancelado,
    tipoDeclaracion: "Original",
    estado: "Borrador",
    linkFormulario: null,
    linkTalonResumen: null,
    datosJSON: params.datosJSON as any,
    contribuyenteId: params.contribuyenteId,
  };

  if (existing) {
    return prisma.declaracion.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.declaracion.create({
    data: {
      ...data,
      numeroAdhesion: generarNumeroAdhesion(),
    },
  });
}

function generarNumeroAdhesion() {
  return `ATS-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
}

async function insertOneByOne<T>(
  items: T[],
  hoja: string,
  issues: AtsIssue[],
  callback: (item: T) => Promise<any>
) {
  let inserted = 0;

  for (const item of items as any[]) {
    try {
      await callback(item);
      inserted++;
    } catch (error) {
      issues.push(
        buildImportIssue(hoja, Number(item.filaExcel || 0), "Base de datos", error)
      );
    }
  }

  return inserted;
}

export const importarAtsExcel = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "Debe subir un archivo Excel." });
    }

    const contribuyenteAcceso = await prisma.contribuyente.findUnique({
      where: { ruc },
    });

    if (!contribuyenteAcceso) {
      return res.status(404).json({ message: "Contribuyente no encontrado." });
    }

    const workbookData = readAtsWorkbook(req.file.buffer);
    const normalized = normalizeAtsWorkbook(workbookData);
    const periodo = getPeriodoFromWorkbookOrFile(workbookData, req.file.originalname);

    const issues: AtsIssue[] = [...normalized.issues];
    const informante = normalized.informante;

    if (!informante.rucInformante || !informante.razonSocialInformante) {
      return res.status(400).json({
        message: "No se pudo identificar el contribuyente informante en la hoja de parámetros.",
      });
    }

    const contribuyente = await findOrCreateInformante(
      informante.rucInformante,
      informante.razonSocialInformante
    );

    const lote = await prisma.atsLote.create({
      data: {
        nombreArchivo: req.file.originalname,
        rucInformante: informante.rucInformante,
        razonSocial: informante.razonSocialInformante,
        anio: periodo.anio,
        mes: periodo.mes,
        estado: "PROCESANDO",
        erroresJSON: issues as any,
        resumenJSON: {
          ...normalized.resumen,
          periodo,
          informante,
          contribuyenteAcceso: {
            ruc: contribuyenteAcceso.ruc,
            razonSocial: contribuyenteAcceso.razonSocial,
          },
        } as any,
        contribuyenteId: contribuyente.id,
      },
    });

    const ventasInsertadas = await insertOneByOne(
      normalized.ventas,
      "VENTAS",
      issues,
      async (v: any) =>
        prisma.venta.create({
          data: sanitizeVenta(v, contribuyente.id, lote.id),
        })
    );

    const comprasInsertadas = await insertOneByOne(
      normalized.compras,
      "COMPRAS",
      issues,
      async (c: any) =>
        prisma.compra.create({
          data: sanitizeCompra(c, contribuyente.id, lote.id),
        })
    );

    const anuladosInsertados = await insertOneByOne(
      normalized.anulados,
      "ANULADOS",
      issues,
      async (a: any) =>
        prisma.comprobanteAnulado.create({
          data: sanitizeAnulado(a, contribuyente.id, lote.id),
        })
    );

    const guiasInsertadas = await insertOneByOne(
      normalized.guias,
      "GUIAS",
      issues,
      async (g: any) =>
        prisma.guiaRemision.create({
          data: sanitizeGuia(g, contribuyente.id, lote.id),
        })
    );

    const erroresFinales = issues.filter((x) => x.tipo === "ERROR").length;

    const resumenFinal = {
      ...normalized.resumen,
      periodo,
      informante,
      contribuyenteDetectado: {
        ruc: informante.rucInformante,
        razonSocial: informante.razonSocialInformante,
        id: contribuyente.id,
      },
      contribuyenteAcceso: {
        ruc: contribuyenteAcceso.ruc,
        razonSocial: contribuyenteAcceso.razonSocial,
      },
      ventasLeidas: normalized.ventas.length,
      comprasLeidas: normalized.compras.length,
      anuladosLeidos: normalized.anulados.length,
      guiasLeidas: normalized.guias.length,
      ventasInsertadas,
      comprasInsertadas,
      anuladosInsertados,
      guiasInsertadas,
      errores: erroresFinales,
      advertencias: issues.filter((x) => x.tipo === "WARNING").length,
    };

    const declaracion103JSON = buildFormulario103Data({
      contribuyente,
      anio: periodo.anio,
      mes: periodo.mes,
      periodicidad: informante.periodicidad,
      resumen: resumenFinal,
      compras: normalized.compras,
    });

    const declaracion104JSON = buildFormulario104Data({
      contribuyente,
      anio: periodo.anio,
      mes: periodo.mes,
      periodicidad: informante.periodicidad,
      resumen: resumenFinal,
      ventas: normalized.ventas,
      compras: normalized.compras,
    });

    await Promise.all([
      upsertDeclaracionDesdeAts({
        contribuyenteId: contribuyente.id,
        formulario: "Formulario 103 - Retenciones en la Fuente",
        tipoImpuesto: "Retenciones en la Fuente",
        periodoFiscal: informante.periodicidad || "MENSUAL",
        anio: periodo.anio,
        mes: periodo.mes,
        datosJSON: declaracion103JSON,
        baseImponible: safeNumber(declaracion103JSON.casilleros["349"]),
        impuestoGenerado: 0,
        valorRetenido: safeNumber(declaracion103JSON.casilleros["399"]),
        valorCancelado: safeNumber(declaracion103JSON.casilleros["999"]),
      }),
      upsertDeclaracionDesdeAts({
        contribuyenteId: contribuyente.id,
        formulario: "Formulario 104 - IVA",
        tipoImpuesto: "Impuesto al Valor Agregado (IVA)",
        periodoFiscal: informante.periodicidad || "MENSUAL",
        anio: periodo.anio,
        mes: periodo.mes,
        datosJSON: declaracion104JSON,
        baseImponible: safeNumber(declaracion104JSON.casilleros["401"]) + safeNumber(declaracion104JSON.casilleros["403"]),
        impuestoGenerado: safeNumber(declaracion104JSON.casilleros["402"]),
        valorRetenido: safeNumber(declaracion104JSON.casilleros["609"]) + safeNumber(declaracion104JSON.casilleros["731"]),
        valorCancelado: safeNumber(declaracion104JSON.casilleros["999"]),
      }),
    ]);

    await prisma.atsLote.update({
      where: { id: lote.id },
      data: {
        estado: erroresFinales > 0 ? "PROCESADO_CON_ERRORES" : "PROCESADO_VALIDO",
        erroresJSON: issues as any,
        resumenJSON: resumenFinal as any,
      },
    });

    const loteCompleto = await prisma.atsLote.findUnique({
      where: { id: lote.id },
      include: {
        ventas: true,
        compras: true,
        anulados: true,
        guias: true,
      },
    });

    return res.status(201).json({
      message: "Archivo ATS procesado correctamente.",
      lote: loteCompleto,
      contribuyenteDetectado: resumenFinal.contribuyenteDetectado,
      issues,
      resumen: resumenFinal,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error procesando archivo ATS.",
      error: buildErrorMessage(error),
    });
  }
};

export const consultarLoteAts = async (req: Request, res: Response) => {
  try {
    const { loteId } = req.params;

    const lote = await prisma.atsLote.findUnique({
      where: { id: loteId },
      include: {
        ventas: true,
        compras: true,
        anulados: true,
        guias: true,
      },
    });

    if (!lote) {
      return res.status(404).json({ message: "Lote ATS no encontrado." });
    }

    return res.json(lote);
  } catch (error) {
    return res.status(500).json({
      message: "Error consultando lote ATS.",
      error: buildErrorMessage(error),
    });
  }
};

export const listarLotesAts = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;

    const lotes = await prisma.atsLote.findMany({
      where: {
        contribuyente: {
          ruc,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json(lotes);
  } catch (error) {
    return res.status(500).json({
      message: "Error listando lotes ATS.",
      error: buildErrorMessage(error),
    });
  }
};

export const descargarXmlAts = async (req: Request, res: Response) => {
  try {
    const { loteId } = req.params;

    const lote = await prisma.atsLote.findUnique({
      where: { id: loteId },
      include: {
        ventas: true,
        compras: true,
        anulados: true,
        guias: true,
      },
    });

    if (!lote) {
      return res.status(404).json({ message: "Lote ATS no encontrado." });
    }

    const issues = getIssuesFromLote(lote.erroresJSON);
    const errores = issues.filter((x) => x.tipo === "ERROR");

    if (errores.length > 0) {
      return res.status(409).json({
        message: "No se puede generar XML porque el lote tiene errores bloqueantes.",
        errores,
      });
    }

    const xml = buildAtsXml({
      rucInformante: lote.rucInformante,
      razonSocial: lote.razonSocial,
      anio: lote.anio,
      mes: lote.mes,
      numEstabRuc: jsonObject(lote.resumenJSON).informante?.numEstabRuc,
      compras: lote.compras,
      ventas: lote.ventas,
      anulados: lote.anulados,
    });

    await prisma.atsLote.update({
      where: { id: lote.id },
      data: {
        estado: "XML_GENERADO",
        xmlGenerado: xml,
      },
    });

    const mes = String(lote.mes).padStart(2, "0");
    const filename = `ATS_${lote.rucInformante}_${mes}${lote.anio}.xml`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.send(xml);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error generando XML ATS.",
      error: buildErrorMessage(error),
    });
  }
};

export const descargarTalonResumenAts = async (req: Request, res: Response) => {
  try {
    const { loteId } = req.params;

    const lote = await prisma.atsLote.findUnique({
      where: { id: loteId },
      include: {
        ventas: true,
        compras: true,
        anulados: true,
        guias: true,
      },
    });

    if (!lote) {
      return res.status(404).json({ message: "Lote ATS no encontrado." });
    }

    const compras = comprasResumen(lote.compras);
    const ventas = ventasResumen(lote.ventas);
    const periodo = `${String(lote.mes).padStart(2, "0")}/${lote.anio}`;
    const resumen = jsonObject(lote.resumenJSON);
    const acceso = jsonObject(resumen.contribuyenteAcceso);

    return sendPdf(res, `Talon_Resumen_ATS_${lote.rucInformante}_${periodo.replace("/", "")}.pdf`, (doc) => {
      doc
        .roundedRect(42, 34, 64, 34, 4)
        .fill("#003565")
        .fillColor("#ffffff")
        .fontSize(17)
        .text("SRI", 42, 42, { width: 64, align: "center" });

      doc
        .fontSize(10)
        .fillColor("#003565")
        .text("SERVICIO DE RENTAS INTERNAS", 118, 36, { align: "center" })
        .moveDown(0.2)
        .fontSize(18)
        .text("TALÓN RESUMEN", { align: "center" })
        .fontSize(12)
        .fillColor("#111827")
        .text("ANEXO TRANSACCIONAL", { align: "center" });

      doc.moveDown(1.2);
      pdfTable(doc, "DATOS DEL CONTRIBUYENTE", [
        ["Nombre contribuyente", lote.razonSocial],
        ["RUC", lote.rucInformante],
        ["Período", periodo],
        ["Fecha de generación", fechaLocal(new Date())],
        ["Lote ATS", lote.id],
        ["Usuario de acceso", acceso.ruc ? `${acceso.ruc} - ${acceso.razonSocial || ""}` : "-"],
      ]);

      pdfTable(doc, "COMPRAS", [
        ["Facturas", pdfInt(compras.facturas)],
        ["Notas de crédito", pdfInt(compras.notasCredito)],
        ["BI tarifa 0%", pdfMoney(compras.base0)],
        ["BI tarifa diferente 0%", pdfMoney(compras.baseGravada)],
        ["BI No Objeto IVA", pdfMoney(compras.baseNoObjeto)],
        ["Valor IVA", pdfMoney(compras.iva)],
      ]);

      pdfTable(doc, "VENTAS", [
        ["Documentos autorizados", pdfInt(ventas.documentos)],
        ["BI tarifa 0%", pdfMoney(ventas.base0)],
        ["BI tarifa diferente 0%", pdfMoney(ventas.baseGravada)],
        ["BI No Objeto IVA", pdfMoney(ventas.baseNoObjeto)],
        ["Valor IVA", pdfMoney(ventas.iva)],
      ]);

      pdfTable(doc, "RETENCION EN LA FUENTE DE IVA", [
        ["Retención IVA compras", pdfMoney(compras.retIva)],
        ["Retenciones que le efectuaron en ventas", pdfMoney(ventas.retIva)],
      ]);

      pdfTable(doc, "RESUMEN DE RETENCIONES QUE LE EFECTUARON EN EL PERIODO", [
        ["Retenciones de IVA", pdfMoney(ventas.retIva)],
        ["Retenciones en la fuente", pdfMoney(ventas.retFuente)],
        ["Total retenciones efectuadas", pdfMoney(round2(ventas.retIva + ventas.retFuente))],
      ]);

      doc
        .moveDown(0.8)
        .fontSize(8.2)
        .fillColor("#334155")
        .text(
          "Declaro que la información contenida en este anexo corresponde a los datos transaccionales registrados para el período indicado y fue generada desde el lote ATS importado en el sistema.",
          { align: "justify" }
        );

      const y = Math.max(doc.y + 34, 700);
      doc
        .strokeColor("#111827")
        .moveTo(88, y)
        .lineTo(245, y)
        .stroke()
        .moveTo(350, y)
        .lineTo(507, y)
        .stroke()
        .fontSize(8.5)
        .fillColor("#111827")
        .text("Firma del contador", 88, y + 8, { width: 157, align: "center" })
        .text("Firma del representante legal", 350, y + 8, { width: 157, align: "center" });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error generando talón resumen ATS.",
      error: buildErrorMessage(error),
    });
  }
};
