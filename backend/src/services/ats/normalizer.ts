import type { AtsInformanteExcel } from "./excel-reader";

type ParsedSheet = {
  headers: string[];
  rows: Record<string, any>[];
};

type AtsWorkbookData = {
  informante: AtsInformanteExcel;
  contribuyentes: ParsedSheet;
  compras: ParsedSheet;
  ventas: ParsedSheet;
  anulados: ParsedSheet;
  guias: ParsedSheet;
};

export type AtsIssue = {
  tipo: "ERROR" | "WARNING" | "INFO";
  hoja: string;
  fila: number;
  campo?: string;
  mensaje: string;
};

export type AtsNormalizedData = {
  informante: AtsInformanteExcel;
  issues: AtsIssue[];
  ventas: any[];
  compras: any[];
  anulados: any[];
  guias: any[];
  resumen: {
    ventas: number;
    compras: number;
    anulados: number;
    guias: number;
    errores: number;
    advertencias: number;
  };
};

function clean(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r?\n|\r/g, " ").trim().replace(/\s+/g, " ");
}

export function cleanTributaryName(value: any, fallback = "NO IDENTIFICADO"): string {
  const text = clean(value)
    .replace(/Ñ/g, "N")
    .replace(/ñ/g, "n")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[+.,;:()[\]{}\/\\\-_'"*]/g, " ")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text || fallback;
}

function normalizeKey(value: string): string {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[%().:/\\"]/g, " ")
    .replace(/__/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function onlyDigits(value: any): string {
  return clean(value).replace(/\D/g, "");
}

function firstCode(value: any, length = 2): string {
  const match = clean(value).match(/\d+/);
  if (!match) return "";
  return match[0].padStart(length, "0").slice(0, length);
}

function paymentCode(value: any): string {
  const code = firstCode(value, 2);
  const validCodes = new Set(["01", "15", "16", "17", "18", "19", "20", "21"]);

  return validCodes.has(code) ? code : "";
}

function money(value: any): number {
  const raw = clean(value);
  if (!raw || raw === "-" || raw === "–" || raw === "—") return 0;

  let normalized = raw.replace(/\s/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(",", ".");
  }

  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return 0;

  return Number(num.toFixed(2));
}

function pad(value: any, length: number): string {
  const digits = onlyDigits(value);
  if (!digits) return "";
  return digits.padStart(length, "0");
}

function isValidId(value: string): boolean {
  const digits = onlyDigits(value);
  return digits.length === 10 || digits.length === 13 || digits === "9999999999999";
}

function getExcelRow(row: Record<string, any>, fallback: number): number {
  const n = Number(row.__filaExcel);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function get(row: Record<string, any>, keys: string[]): string {
  const rowKeys = Object.keys(row);

  for (const wanted of keys) {
    const wantedNorm = normalizeKey(wanted);

    const exact = rowKeys.find((key) => normalizeKey(key) === wantedNorm);
    if (exact) return clean(row[exact]);

    const partial = rowKeys.find((key) => {
      const keyNorm = normalizeKey(key);
      return keyNorm.includes(wantedNorm) || wantedNorm.includes(keyNorm);
    });

    if (partial) return clean(row[partial]);
  }

  return "";
}

function getByAny(row: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = get(row, [key]);
    if (value !== "") return value;
  }

  return "";
}

function hasAnyValue(row: Record<string, any>, keys: string[]): boolean {
  return keys.some((key) => get(row, [key]) !== "");
}

function issue(
  issues: AtsIssue[],
  tipo: AtsIssue["tipo"],
  hoja: string,
  fila: number,
  campo: string,
  mensaje: string
) {
  issues.push({ tipo, hoja, fila, campo, mensaje });
}

function isConsumerFinal(row: Record<string, any>): boolean {
  const joined = Object.values(row).join(" ").toUpperCase();
  return joined.includes("CONSUMIDOR FINAL") || joined.includes("9999999999999");
}

function hasMonetaryMovement(row: Record<string, any>) {
  const fields = [
    "Base Imponible NO Objeto de IVA",
    "Base Imponible EXENTA",
    "Base Imponible Tarifa 0%",
    "Base Imp. 1 Gravable IVA diferente de cero",
    "Monto-1 de I.V.A.",
    "Base Imp. 2 Gravable IVA Construcción",
    "Monto-2 de I.V.A.",
    "Base Imp. 3 Gravable IVA Especial",
    "Monto-3 de I.V.A.",
    "Monto de I.C.E. NO incluido en Base Imp.",
    "Monto Propina",
    "Monto de Propina",
    "Monto de IRBPNR",
    "Monto de IRBPNR y/o Otros",
    "Monto de OTROS",
    "Total del Documento",
    "Valor Descuentos",
    "Valor Descuentos (2)",
    "Otros Valores",
    "Suma de Devoluciones",
    "Ret. Fuente Base Imponible 1",
    "Ret. Fuente Valor Retenido 1",
    "Ret. Fuente Base Imponible 2",
    "Ret. Fuente Valor Retenido 2",
    "Ret. Fuente Base Imponible 3",
    "Ret. Fuente Valor Retenido 3",
    "Ret. IVA Base Imponible 10%",
    "Ret. IVA Valor Retenido 10%",
    "Ret. IVA Base Imponible 20%",
    "Ret. IVA Valor Retenido 20%",
    "Ret. IVA Base Imponible 30%",
    "Ret. IVA Valor Retenido 30%",
    "Ret. IVA Base Imponible 50%",
    "Ret. IVA Valor Retenido 50%",
    "Ret. IVA Base Imponible 70%",
    "Ret. IVA Valor Retenido 70%",
    "Ret. IVA Base Imponible 100%",
    "Ret. IVA Valor Retenido 100%",
    "Valor Retención IVA 30%",
    "Valor Retención IVA 50%",
    "Valor Retención IVA 70%",
    "Valor Retención IVA 100%",
    "Valor Retención IVA 100% Sector Publico",
    "Valor Retencion IVA en NC",
    "Total Retención IVA+Fte.",
  ];

  return fields.some((field) => money(get(row, [field])) > 0);
}

function normalizeParteRelacionada(value: any): string {
  return clean(value).toUpperCase() === "SI" ? "SI" : "NO";
}

function normalizeTipoEmision(value: any): string {
  const text = clean(value).toUpperCase();

  if (text === "E" || text.includes("ELECT")) return "ELECTRONICA";
  if (text === "F" || text.includes("FIS")) return "FISICA";

  return "ELECTRONICA";
}

function normalizeVentas(rows: Record<string, any>[], issues: AtsIssue[]) {
  const ventas: any[] = [];
  let previousDoc: any = null;

  rows.forEach((row, index) => {
    const fila = getExcelRow(row, index + 7);

    let noIdentificacion = onlyDigits(
      getByAny(row, [
        "No. de Identificacion",
        "No. de Identificación",
        "Identificacion",
        "Identificación",
      ])
    );

    let razonSocialCliente = getByAny(row, [
      "Razon Social Contribuyente",
      "Razón Social Contribuyente",
      "Razon Social Cliente",
      "Razón Social Cliente",
      "Cliente",
    ]);

    const codigoIdentifRaw = getByAny(row, [
      "Codig Identif.",
      "Codigo Identif.",
      "Código Identif.",
    ]);

    let tipoComprobante = firstCode(
      getByAny(row, ["Tipo de Comprobante", "Tipo Comprobante", "Comprobante"]),
      2
    );

    let codigoEstablecimiento = pad(
      getByAny(row, ["Codigo Establecimiento", "Código Establecimiento", "Establecimiento"]),
      3
    );

    let noDocumento = pad(
      getByAny(row, ["No. Documento", "No. Documento (Opcional)", "Documento", "Secuencial"]),
      9
    );

    const hasDocData = Boolean(
      noIdentificacion ||
        razonSocialCliente ||
        tipoComprobante ||
        codigoEstablecimiento ||
        noDocumento
    );

    const hasMoney = hasMonetaryMovement(row);

    if (!hasDocData && !hasMoney) return;

    if (
      (!hasDocData || (!tipoComprobante && !codigoEstablecimiento && !noDocumento)) &&
      hasMoney &&
      previousDoc
    ) {
      noIdentificacion = noIdentificacion || previousDoc.noIdentificacion;
      razonSocialCliente = razonSocialCliente || previousDoc.razonSocialCliente;
      tipoComprobante = tipoComprobante || previousDoc.tipoComprobante;
      codigoEstablecimiento = codigoEstablecimiento || previousDoc.codigoEstablecimiento;
      noDocumento = noDocumento || previousDoc.noDocumento;

      issue(
        issues,
        "INFO",
        "VENTAS",
        fila,
        "Documento",
        "Fila detalle heredó datos del documento anterior."
      );
    }

    if (!noIdentificacion && isConsumerFinal(row)) {
      noIdentificacion = "9999999999999";
      razonSocialCliente = "CONSUMIDOR FINAL";
    }

    if (!noIdentificacion || !isValidId(noIdentificacion) || !tipoComprobante) return;

    const venta = {
      filaExcel: fila,
      noIdentificacion,
      codigoIdentif:
        firstCode(codigoIdentifRaw, 2) ||
        (noIdentificacion === "9999999999999"
          ? "07"
          : noIdentificacion.length === 13
            ? "04"
            : "05"),
      razonSocialCliente:
        noIdentificacion === "9999999999999"
          ? "CONSUMIDOR FINAL"
          : cleanTributaryName(razonSocialCliente, "CONSUMIDOR FINAL"),
      tipoCliente: firstCode(getByAny(row, ["Tipo Cliente"]), 2),
      parteRelacionada: normalizeParteRelacionada(getByAny(row, ["Parte Relacionada"])),
      cantidadComprobantes: Number(onlyDigits(getByAny(row, ["Cantidad de Comprobantes", "Cantidad"])) || 1),
      tipoEmisionComprobante: normalizeTipoEmision(
        getByAny(row, ["Tipo de Emision del Comprobante", "Tipo de Emisión del Comprobante"])
      ),
      tipoComprobante,
      fechaEmision:
        getByAny(row, ["Fecha de Emisión", "Fecha Emision", "Fecha Emisión", "Fecha"]) ||
        previousDoc?.fechaEmision ||
        null,
      codigoEstablecimiento: codigoEstablecimiento || previousDoc?.codigoEstablecimiento || "001",
      noDocumento,
      conceptoVenta: getByAny(row, ["Concepto de la Venta", "Concepto de la Venta (Opcional)", "Concepto"]),

      baseNoObjetoIva: money(getByAny(row, ["Base Imponible NO Objeto de IVA", "Base NO Objeto de IVA"])),
      baseExenta: money(getByAny(row, ["Base Imponible EXENTA", "Base EXENTA"])),
      baseTarifa0: money(getByAny(row, ["Base Imponible Tarifa 0%", "Base Tarifa 0%"])),
      baseGravableIva1: money(getByAny(row, ["Base Imp. 1 Gravable IVA diferente de cero", "Base Imp 1 Gravable IVA diferente de cero"])),
      tarifaIva1Aplicada: money(getByAny(row, ["Tarifa1 de IVA aplicada"])) || 15,
      montoIva1: money(getByAny(row, ["Monto-1 de I.V.A.", "Monto-1 de IVA", "Monto 1 de IVA"])),
      baseGravableIva2: money(getByAny(row, ["Base Imp. 2 Gravable IVA Construcción", "Base Imp 2 Gravable IVA Construcción"])),
      tarifaIva2Aplicada: money(getByAny(row, ["Tarifa2 de IVA aplicada"])),
      montoIva2: money(getByAny(row, ["Monto-2 de I.V.A.", "Monto-2 de IVA", "Monto 2 de IVA"])),
      baseGravableIva3: money(getByAny(row, ["Base Imp. 3 Gravable IVA Especial", "Base Imp 3 Gravable IVA Especial"])),
      tarifaIva3Aplicada: money(getByAny(row, ["Tarifa3 de IVA aplicada"])),
      montoIva3: money(getByAny(row, ["Monto-3 de I.V.A.", "Monto-3 de IVA", "Monto 3 de IVA"])),

      montoIceNoIncluido: money(getByAny(row, ["Monto de I.C.E. NO incluido en Base Imp.", "Monto ICE NO incluido"])),
      montoIceIncluido: money(getByAny(row, ["Monto de I.C.E. incluido en Base Imp.", "Monto ICE incluido"])),
      montoPropina: money(getByAny(row, ["Monto Propina", "Monto de Propina"])),
      montoIrbpnrOtros: money(getByAny(row, ["Monto de IRBPNR y/o Otros", "Monto de IRBPNR", "Monto de OTROS"])),
      totalDocumento: money(getByAny(row, ["Total del Documento"])),
      valorDescuentos: money(getByAny(row, ["Valor Descuentos"])),
      totalSubsidios: money(getByAny(row, ["Total Subsidios"])),
      sumaDevoluciones: money(getByAny(row, ["Suma de Devoluciones"])),

      autocodigoVentas: getByAny(row, ["Autocodigo VENTAS"]),
      conceptoContableVenta: getByAny(row, ["Concepto Contable"]),
      numeroAsientoVenta: getByAny(row, ["Numero de Asiento", "Número de Asiento"]),
      estadoContableVenta: getByAny(row, ["Estado"]),
      tipoActividad: getByAny(row, ["Tipo de ACTIVIDAD", "Tipo de ACTIVIDAD (Opcional)"]),

      codigoForm104_1: money(getByAny(row, ["Código Form. (104) 1", "Codigo Form. (104) 1"])),
      codigoForm104_2: money(getByAny(row, ["Código Form. (104) 2", "Codigo Form. (104) 2"])),
      codigoForm104_3: money(getByAny(row, ["Código Form. (104) 3", "Codigo Form. (104) 3"])),

      tipoEmisionRetencion: normalizeTipoEmision(getByAny(row, ["Tipo de Emision de la Retencion Recibida"])),
      valorRetenidoIva: money(getByAny(row, ["Valor Retenido en IVA"])),
      valorRetenidoFuente: money(getByAny(row, ["Valor Retenido en la Fuente"])),
      valorRetenidoIsd: money(getByAny(row, ["Valor Retenido en ISD"])),
      noDocumentoRetencion: getByAny(row, ["No. Documento Retencion", "No. Documento Retencion (Opcional)"]),
      fechaRetencion: getByAny(row, ["Fecha Retencion", "Fecha Retencion (Opcional)"]) || null,
      noAutorizacionRetencion: getByAny(row, ["No. Autorizacion", "No. Autorizacion (Opcional)"]),

      retFuenteBaseImponible1: money(getByAny(row, ["Ret. Fuente Base Imponible 1"])),
      retFuenteValorRetenido1: money(getByAny(row, ["Ret. Fuente Valor Retenido 1"])),
      retFuenteBaseImponible2: money(getByAny(row, ["Ret. Fuente Base Imponible 2"])),
      retFuenteValorRetenido2: money(getByAny(row, ["Ret. Fuente Valor Retenido 2"])),
      retFuenteBaseImponible3: money(getByAny(row, ["Ret. Fuente Base Imponible 3"])),
      retFuenteValorRetenido3: money(getByAny(row, ["Ret. Fuente Valor Retenido 3"])),

      retIvaBase10: money(getByAny(row, ["Ret. IVA Base Imponible 10%"])),
      retIvaValor10: money(getByAny(row, ["Ret. IVA Valor Retenido 10%"])),
      retIvaBase20: money(getByAny(row, ["Ret. IVA Base Imponible 20%"])),
      retIvaValor20: money(getByAny(row, ["Ret. IVA Valor Retenido 20%"])),
      retIvaBase30: money(getByAny(row, ["Ret. IVA Base Imponible 30%"])),
      retIvaValor30: money(getByAny(row, ["Ret. IVA Valor Retenido 30%"])),
      retIvaBase50: money(getByAny(row, ["Ret. IVA Base Imponible 50%"])),
      retIvaValor50: money(getByAny(row, ["Ret. IVA Valor Retenido 50%"])),
      retIvaBase70: money(getByAny(row, ["Ret. IVA Base Imponible 70%"])),
      retIvaValor70: money(getByAny(row, ["Ret. IVA Valor Retenido 70%"])),
      retIvaBase100: money(getByAny(row, ["Ret. IVA Base Imponible 100%"])),
      retIvaValor100: money(getByAny(row, ["Ret. IVA Valor Retenido 100%"])),

      formaPago1: paymentCode(getByAny(row, ["Forma de COBRO 1"])),
      formaPago2: paymentCode(getByAny(row, ["Forma de COBRO 2"])),

      mesDeclarado: getByAny(row, ["Mes declarado"]),
      periodoDeclaradoForm104: getByAny(row, ["Periodo Declarado Form. 104", "Periodo Declarado Form104"]),
      form104_a: getByAny(row, ["Form.104_a"]),
      form104_b: getByAny(row, ["Form.104_b"]),
      form104_c: getByAny(row, ["Form.104_c"]),
      baseForm104_NoGravExenta: money(getByAny(row, ["Base_Form.104_Nograv/Exenta"])),
      ivaForm104_Base444: money(getByAny(row, ["IVA_Form.104 Base 444"])),
      ivaForm104_411_412_420_435: money(getByAny(row, ["IVA_Form.104_411/412/420/435"])),
      ivaForm104_413_414: money(getByAny(row, ["IVA_Form.104_413/414"])),

      codigoDocto: getByAny(row, ["Codigo Docto."]),
      claseDoctoElectronico: getByAny(row, ["Clase de Documento Electronico"]),
      estadoDoctoElectronico: getByAny(row, ["Estado Documento Electronico"]),
      campoBusqueda: getByAny(row, ["CAMPO BUSQUEDA"]),
      observaciones: getByAny(row, ["OBSERVACIONES", "Observaciones"]),
    };

    previousDoc = venta;
    ventas.push(venta);
  });

  return consolidateVentas(ventas, issues);
}

function consolidateVentas(ventas: any[], issues: AtsIssue[]) {
  const map = new Map<string, any>();

  const addMoney = (left: any, right: any) =>
    Number((Number(left || 0) + Number(right || 0)).toFixed(2));

  const mergeFormaPago = (target: any, source: any) => {
    const current = [target.formaPago1, target.formaPago2].filter(Boolean);
    const incoming = [source.formaPago1, source.formaPago2].filter(Boolean);
    const merged = Array.from(new Set([...current, ...incoming]));

    target.formaPago1 = merged[0] || "";
    target.formaPago2 = merged[1] || "";
  };

  ventas.forEach((venta) => {
    const isFinalConsumer =
      venta.codigoIdentif === "07" || venta.noIdentificacion === "9999999999999";

    const key = isFinalConsumer
      ? [
          venta.codigoIdentif,
          venta.noIdentificacion,
          venta.tipoComprobante,
          venta.codigoEstablecimiento,
        ].join("|")
      : [
          venta.noIdentificacion,
          venta.tipoComprobante,
          venta.codigoEstablecimiento,
          venta.noDocumento || venta.razonSocialCliente,
        ].join("|");

    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...venta,
        razonSocialCliente: isFinalConsumer ? "CONSUMIDOR FINAL" : venta.razonSocialCliente,
      });
      return;
    }

    existing.cantidadComprobantes += venta.cantidadComprobantes || 1;
    existing.baseNoObjetoIva = addMoney(existing.baseNoObjetoIva, venta.baseNoObjetoIva);
    existing.baseExenta = addMoney(existing.baseExenta, venta.baseExenta);
    existing.baseTarifa0 = addMoney(existing.baseTarifa0, venta.baseTarifa0);
    existing.baseGravableIva1 = addMoney(existing.baseGravableIva1, venta.baseGravableIva1);
    existing.montoIva1 = addMoney(existing.montoIva1, venta.montoIva1);
    existing.baseGravableIva2 = addMoney(existing.baseGravableIva2, venta.baseGravableIva2);
    existing.montoIva2 = addMoney(existing.montoIva2, venta.montoIva2);
    existing.baseGravableIva3 = addMoney(existing.baseGravableIva3, venta.baseGravableIva3);
    existing.montoIva3 = addMoney(existing.montoIva3, venta.montoIva3);
    existing.totalDocumento = addMoney(existing.totalDocumento, venta.totalDocumento);
    existing.valorRetenidoIva = addMoney(existing.valorRetenidoIva, venta.valorRetenidoIva);
    existing.valorRetenidoFuente = addMoney(existing.valorRetenidoFuente, venta.valorRetenidoFuente);
    mergeFormaPago(existing, venta);

    issue(
      issues,
      "INFO",
      "VENTAS",
      venta.filaExcel,
      "Consolidación",
      "Fila consolidada con otro detalle del mismo comprobante."
    );
  });

  return Array.from(map.values());
}

function normalizeCompras(rows: Record<string, any>[], issues: AtsIssue[]) {
  const compras: any[] = [];
  let previousDoc: any = null;

  rows.forEach((row, index) => {
    const fila = getExcelRow(row, index + 7);

    let noIdentificacion = onlyDigits(
      getByAny(row, ["No. de Identificacion", "No. de Identificación"])
    );

    let razonSocialProveedor = getByAny(row, [
      "Razon Social Contribuyente",
      "Razón Social Contribuyente",
      "Proveedor",
    ]);

    let comprobante = firstCode(getByAny(row, ["Tipo de Comprobante"]), 2);
    let establecimiento = pad(getByAny(row, ["Establecimiento"]), 3);
    let puntoEmision = pad(getByAny(row, ["Punto Emisión", "Punto Emision"]), 3);
    let numeroSecuencial = pad(getByAny(row, ["Numero Secuencial", "Número Secuencial"]), 9);
    let numeroAutorizacionSri = onlyDigits(
      getByAny(row, ["Numero Autorización S.R.I.", "Numero Autorizacion S.R.I."])
    );

    const hasDocData = Boolean(
      noIdentificacion || comprobante || establecimiento || puntoEmision || numeroSecuencial
    );

    const hasMoney = hasMonetaryMovement(row);

    if (!hasDocData && !hasMoney) return;

    if (
      (!hasDocData || (!establecimiento && !puntoEmision && !numeroSecuencial)) &&
      hasMoney &&
      previousDoc
    ) {
      noIdentificacion = noIdentificacion || previousDoc.noIdentificacion;
      razonSocialProveedor = razonSocialProveedor || previousDoc.razonSocialProveedor;
      comprobante = comprobante || previousDoc.comprobante;
      establecimiento = establecimiento || previousDoc.establecimiento;
      puntoEmision = puntoEmision || previousDoc.puntoEmision;
      numeroSecuencial = numeroSecuencial || previousDoc.numeroSecuencial;
      numeroAutorizacionSri = numeroAutorizacionSri || previousDoc.numeroAutorizacionSri;
    }

    if (!noIdentificacion || !isValidId(noIdentificacion)) return;
    if (!comprobante) return;
    if (!establecimiento || !puntoEmision || !numeroSecuencial) return;

    const compra = {
      filaExcel: fila,
      noIdentificacion,
      razonSocialProveedor: cleanTributaryName(razonSocialProveedor),
      comprobante,
      establecimiento,
      puntoEmision,
      numeroSecuencial,
      numeroAutorizacionSri,

      fechaEmision: getByAny(row, ["Fecha de Emisión"]) || previousDoc?.fechaEmision || null,
      fechaRegistro: getByAny(row, ["Fecha de Registro"]) || previousDoc?.fechaRegistro || null,

      codigoSustento: firstCode(getByAny(row, ["Codigo Sustento", "Código Sustento"]), 2) || "01",
      parteRelacionada: normalizeParteRelacionada(getByAny(row, ["Parte Relacionada"])),

      comprobanteModificado: firstCode(getByAny(row, ["Comprobante Modificado"]), 2),
      establecimientoModificado: pad(
        getByAny(row, ["Establecimiento__2", "Establecimiento Modificado"]),
        3
      ),
      puntoEmisionModificado: pad(
        getByAny(row, ["Punto Emisión__2", "Punto Emision__2", "Punto Emisión Modificado"]),
        3
      ),
      numeroSecuencialModificado: pad(
        getByAny(row, ["Numero Secuencial Modificado", "Número Secuencial Modificado"]),
        9
      ),
      numeroAutorizacionSriModificado: onlyDigits(
        getByAny(row, [
          "Numero Autorización S.R.I. Modificado",
          "Numero Autorizacion S.R.I. Modificado",
          "Numero Autorización SRI Modificado",
          "Numero Autorizacion SRI Modificado",
        ])
      ),

      baseNoObjetoIva: money(getByAny(row, ["Base Imponible NO Objeto de IVA"])),
      baseExenta: money(getByAny(row, ["Base Imponible EXENTA"])),
      baseTarifa0: money(getByAny(row, ["Base Imponible Tarifa 0%"])),
      baseGravableIva1: money(getByAny(row, ["Base Imp. 1 Gravable IVA diferente de cero"])),
      montoIva1: money(getByAny(row, ["Monto-1 de I.V.A."])),
      montoIceNoIncluido: money(getByAny(row, ["Monto de I.C.E. NO incluido en Base Imp."])),
      totalDocumento: money(getByAny(row, ["Total del Documento"])),

      establecimientoRet: pad(getByAny(row, ["Establecimiento Ret."]), 3),
      puntoEmisionRet: pad(getByAny(row, ["Punto Emisión Ret.", "Punto Emision Ret."]), 3),
      numeroSecuencialRet: pad(getByAny(row, ["Numero Secuencial Ret."]), 9),
      numeroAutorizacionSriRet: onlyDigits(
        getByAny(row, [
          "Numero Autorización S.R.I. Retención",
          "Numero Autorizacion S.R.I. Retencion",
          "Numero Autorización SRI Retención",
          "Numero Autorizacion SRI Retencion",
        ])
      ),

      fechaEmisionRet1:
        getByAny(row, [
          "Fecha de Emisión Ret.1",
          "Fecha de Emision Ret.1",
          "Fecha Emisión Ret.1",
          "Fecha Emision Ret.1",
          "Fecha de Emisión Retención",
          "Fecha de Emision Retencion",
          "Fecha Retención",
          "Fecha Retencion",
        ]) || null,

      codigoRetencion1: firstCode(getByAny(row, ["Código Retención 1"]), 3),
      baseImponibleRet1: money(getByAny(row, ["Ret. Fuente Base Imponible 1"])),
      porcentajeRetencion1: money(getByAny(row, ["Porcentaje Retención 1"])),
      valorRetenido1: money(getByAny(row, ["Ret. Fuente Valor Retenido 1"])),

      codigoRetencion2: firstCode(getByAny(row, ["Código Retención 2"]), 3),
      baseImponibleRet2: money(getByAny(row, ["Ret. Fuente Base Imponible 2"])),
      porcentajeRetencion2: money(getByAny(row, ["Porcentaje Retención 2"])),
      valorRetenido2: money(getByAny(row, ["Ret. Fuente Valor Retenido 2"])),

      codigoRetencion3: firstCode(getByAny(row, ["Código Retención 3"]), 3),
      baseImponibleRet3: money(getByAny(row, ["Ret. Fuente Base Imponible 3"])),
      porcentajeRetencion3: money(getByAny(row, ["Porcentaje Retención 3"])),
      valorRetenido3: money(getByAny(row, ["Ret. Fuente Valor Retenido 3"])),

      valorRetencionIva30: money(getByAny(row, ["Ret. IVA Valor Retenido 30%"])),
      valorRetencionIva50: money(getByAny(row, ["Ret. IVA Valor Retenido 50%"])),
      valorRetencionIva70: money(getByAny(row, ["Ret. IVA Valor Retenido 70%"])),
      valorRetencionIva100: money(getByAny(row, ["Ret. IVA Valor Retenido 100%"])),

      formaPago1: paymentCode(getByAny(row, ["Forma de PAGO 1"])),
      formaPago2: paymentCode(getByAny(row, ["Forma de PAGO 2"])),
    };

    previousDoc = compra;
    compras.push(compra);
  });

  return compras;
}

function normalizeAnulados(rows: Record<string, any>[]) {
  return rows
    .filter((row) =>
      hasAnyValue(row, [
        "Tipo de Comprobante",
        "No. Serie Secuencial Desde",
        "No. Serie Secuencial Hasta",
        "Numero Autorización S.R.I.",
        "Numero Autorizacion S.R.I.",
      ])
    )
    .map((row, index) => ({
      filaExcel: getExcelRow(row, index + 7),
      tipoComprobante: firstCode(getByAny(row, ["Tipo de Comprobante"]), 2),
      establecimiento: pad(getByAny(row, ["No. Serie Establecimiento"]), 3),
      puntoEmision: pad(getByAny(row, ["No. Serie Punto Emisión"]), 3),
      secuencialDesde: pad(getByAny(row, ["No. Serie Secuencial Desde"]), 9),
      secuencialHasta: pad(getByAny(row, ["No. Serie Secuencial Hasta"]), 9),
      numeroAutorizacionSri: onlyDigits(getByAny(row, ["Numero Autorización S.R.I."])),
    }));
}

function normalizeGuias(rows: Record<string, any>[]) {
  return rows.filter((row) =>
    hasAnyValue(row, ["No. de Identificacion Emisor", "Numero Secuencial"])
  );
}

export function normalizeAtsWorkbook(data: AtsWorkbookData): AtsNormalizedData {
  const issues: AtsIssue[] = [];

  const ventas = normalizeVentas(data.ventas.rows, issues);
  const compras = normalizeCompras(data.compras.rows, issues);
  const anulados = normalizeAnulados(data.anulados.rows);
  const guias = normalizeGuias(data.guias.rows);

  return {
    informante: {
      ...data.informante,
      razonSocialInformante: cleanTributaryName(data.informante.razonSocialInformante),
    },
    issues,
    ventas,
    compras,
    anulados,
    guias,
    resumen: {
      ventas: ventas.length,
      compras: compras.length,
      anulados: anulados.length,
      guias: guias.length,
      errores: issues.filter((x) => x.tipo === "ERROR").length,
      advertencias: issues.filter((x) => x.tipo === "WARNING").length,
    },
  };
}
