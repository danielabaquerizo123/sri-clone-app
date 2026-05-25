import { Request, Response } from "express";
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

  const rows = workbookData.contribuyentes?.rows || [];
  const joined = rows
    .map((row) => Object.values(row).join(" "))
    .join(" ")
    .toUpperCase();

  const yearMatch = joined.match(/\b(20\d{2})\b/);
  if (yearMatch) anio = Number(yearMatch[1]);

  for (const [nombreMes, numeroMes] of Object.entries(MESES)) {
    if (joined.includes(nombreMes)) {
      mes = numeroMes;
      break;
    }
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

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { ruc },
    });

    if (!contribuyente) {
      return res.status(404).json({ message: "Contribuyente no encontrado." });
    }

    const workbookData = readAtsWorkbook(req.file.buffer);
    const normalized = normalizeAtsWorkbook(workbookData);
    const periodo = getPeriodoFromWorkbookOrFile(workbookData, req.file.originalname);

    const issues: AtsIssue[] = [...normalized.issues];

    const lote = await prisma.atsLote.create({
      data: {
        nombreArchivo: req.file.originalname,
        rucInformante: contribuyente.ruc,
        razonSocial: contribuyente.razonSocial,
        anio: periodo.anio,
        mes: periodo.mes,
        estado: "PROCESANDO",
        erroresJSON: issues as any,
        resumenJSON: {
          ...normalized.resumen,
          periodo,
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
      ventasInsertadas,
      comprasInsertadas,
      anuladosInsertados,
      guiasInsertadas,
      errores: erroresFinales,
      advertencias: issues.filter((x) => x.tipo === "WARNING").length,
    };

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
