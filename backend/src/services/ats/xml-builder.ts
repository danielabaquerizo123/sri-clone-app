import { XMLBuilder } from "fast-xml-parser";
import { cleanTributaryName } from "./normalizer";

type AtsXmlInput = {
  rucInformante: string;
  razonSocial: string;
  anio: number;
  mes: string;
  numEstabRuc?: string;
  compras: any[];
  ventas: any[];
  anulados: any[];
};

function clean(value: any): string {
  const text = String(value ?? "").trim();
  if (text === "000" || text === "000000000") return "";
  return text;
}

function money(value: any): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num < 0) return "0.00";
  return num.toFixed(2);
}

function moneyAbs(value: any): string {
  const num = Math.abs(Number(value ?? 0));
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function firstMoney(...values: any[]): any {
  return values.find((value) => Number(value ?? 0) !== 0) ?? 0;
}

function sumMoney(...values: any[]): number {
  const total = values.reduce((acc, value) => acc + Number(value ?? 0), 0);
  return Number.isFinite(total) ? Number(total.toFixed(2)) : 0;
}

function porcentajeAirValue(value: any): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num <= 0) return "0.00";
  if (num > 0 && num < 1) return (num * 100).toFixed(2);
  return num.toFixed(2);
}

function integer(value: any): string {
  const raw = String(value ?? "").replace(/\D/g, "");
  return raw || "0";
}

function pad(value: any, length: number): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(length, "0");
}

function dateDDMMYYYY(value: any): string {
  if (!value) return "";

  const formatParts = (day: number, month: number, year: number) => {
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return "";
    }

    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    const yyyy = String(year).padStart(4, "0");

    return `${dd}/${mm}/${yyyy}`;
  };

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";

    return formatParts(value.getUTCDate(), value.getUTCMonth() + 1, value.getUTCFullYear());
  }

  const raw = clean(value);

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);

    if (serial > 20000 && serial < 90000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const date = new Date(excelEpoch + Math.floor(serial) * 86400000);

      return formatParts(date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCFullYear());
    }
  }

  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    return formatParts(Number(dmy[1]), Number(dmy[2]), Number(dmy[3]));
  }

  const ymd = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) {
    return formatParts(Number(ymd[3]), Number(ymd[2]), Number(ymd[1]));
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";

  return formatParts(date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCFullYear());
}

function mesToNumber(mes: string): string {
  const raw = clean(mes).toUpperCase();

  const meses: Record<string, string> = {
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

  if (/^(0[1-9]|1[0-2])$/.test(raw)) return raw;
  return meses[raw] || "01";
}

function tipoIdProveedor(id: string): string {
  const digits = clean(id);

  if (digits === "9999999999999") return "07";
  if (digits.length === 13) return "01";
  if (digits.length === 10) return "02";

  return "03";
}

function tipoIdCliente(id: string, codigoIdentif?: string): string {
  const code = clean(codigoIdentif);
  if (code) return code;

  const digits = clean(id);

  if (digits === "9999999999999") return "07";
  if (digits.length === 13) return "04";
  if (digits.length === 10) return "05";

  return "06";
}

function siNo(value: any): "SI" | "NO" {
  const text = clean(value).toUpperCase();
  return text === "SI" ? "SI" : "NO";
}

function tipoEmision(value: any): "E" | "F" {
  const text = clean(value).toUpperCase();

  if (text === "E" || text.includes("ELECT")) return "E";
  if (text === "F" || text.includes("FIS")) return "F";

  return "E";
}

function hasValue(value: any): boolean {
  return clean(value) !== "";
}

function hasMoney(value: any): boolean {
  return Number(value ?? 0) > 0;
}

function ventaBaseAts(v: any): number {
  const total =
    Number(v.baseNoObjetoIva || 0) +
    Number(v.baseExenta || 0) +
    Number(v.baseTarifa0 || 0) +
    Number(v.baseGravableIva1 || 0) +
    Number(v.baseGravableIva2 || 0) +
    Number(v.baseGravableIva3 || 0);

  return Number.isFinite(total) ? Number(total.toFixed(2)) : 0;
}

function compraTotalFormaPago(c: any): number {
  const total =
    Number(c.baseNoObjetoIva || 0) +
    Number(c.baseExenta || 0) +
    Number(c.baseTarifa0 || 0) +
    Number(c.baseGravableIva1 || 0) +
    Number(c.baseGravableIva2 || 0) +
    Number(c.baseGravableIva3 || 0) +
    Number(c.montoIva1 || 0) +
    Number(c.montoIva2 || 0) +
    Number(c.montoIva3 || 0) +
    Number(c.montoIceNoIncluido || 0);

  return Number.isFinite(total) ? Number(total.toFixed(2)) : 0;
}

function ventaTotalFormaPago(v: any): number {
  const total =
    ventaBaseAts(v) +
    Number(v.montoIva1 || 0) +
    Number(v.montoIva2 || 0) +
    Number(v.montoIva3 || 0) +
    Number(v.montoIceNoIncluido || 0);

  return Number.isFinite(total) ? Number(total.toFixed(2)) : 0;
}

function removeUndefinedDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep).filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    const output: Record<string, any> = {};

    for (const [key, child] of Object.entries(value)) {
      const cleaned = removeUndefinedDeep(child);

      if (cleaned !== undefined && cleaned !== null && cleaned !== "") {
        output[key] = cleaned;
      }
    }

    return Object.keys(output).length > 0 ? output : undefined;
  }

  return value === undefined || value === null || value === "" ? undefined : value;
}

function buildAir(c: any) {
  if (clean(c.comprobante) === "04") return undefined;

  const detalleAir: any[] = [];
  const baseRetencion = (index: number) =>
    firstMoney(
      c[`baseImponibleRetencion${index}`],
      c[`baseImponibleRet${index}`],
      c[`retFuenteBaseImponible${index}`]
    );

  const valorRetenido1 = firstMoney(c.valorRetenido1, c.retFuenteValorRetenido1);
  const valorRetenido2 = firstMoney(c.valorRetenido2, c.retFuenteValorRetenido2);
  const valorRetenido3 = firstMoney(c.valorRetenido3, c.retFuenteValorRetenido3);

  if (clean(c.codigoRetencion1) && hasMoney(baseRetencion(1))) {
    detalleAir.push({
      codRetAir: clean(c.codigoRetencion1),
      baseImpAir: money(baseRetencion(1)),
      porcentajeAir: porcentajeAirValue(c.porcentajeRetencion1),
      valRetAir: money(valorRetenido1),
    });
  }

  if (clean(c.codigoRetencion2) && hasMoney(baseRetencion(2))) {
    detalleAir.push({
      codRetAir: clean(c.codigoRetencion2),
      baseImpAir: money(baseRetencion(2)),
      porcentajeAir: porcentajeAirValue(c.porcentajeRetencion2),
      valRetAir: money(valorRetenido2),
    });
  }

  if (clean(c.codigoRetencion3) && hasMoney(baseRetencion(3))) {
    detalleAir.push({
      codRetAir: clean(c.codigoRetencion3),
      baseImpAir: money(baseRetencion(3)),
      porcentajeAir: porcentajeAirValue(c.porcentajeRetencion3),
      valRetAir: money(valorRetenido3),
    });
  }

  if (detalleAir.length === 0) return undefined;

  return { detalleAir };
}

function buildFormasPago(
  totalOperacion: number,
  formaPago1?: string | null,
  formaPago2?: string | null
) {
  if (totalOperacion <= 500) return undefined;

  const validCodes = new Set(["01", "15", "16", "17", "18", "19", "20", "21"]);
  const formas = [formaPago1, formaPago2]
    .map((x) => clean(x))
    .filter((x) => validCodes.has(x));

  if (formas.length === 0) return undefined;

  return {
    formaPago: formas,
  };
}

const VALID_ATS_PAYMENT_CODES = new Set(["01", "15", "16", "17", "18", "19", "20", "21"]);
const CLIENT_ID_TYPES_WITH_CONDITIONAL_NAME = new Set(["06"]);

function cleanPaymentCodes(formaPago1?: string | null, formaPago2?: string | null) {
  return [formaPago1, formaPago2]
    .map((x) => clean(x))
    .filter((x) => VALID_ATS_PAYMENT_CODES.has(x));
}

function ventaRequiresClientName(tpIdCliente: string): boolean {
  // Regla ATS ventas: tipoCliente y denoCli se informan solo para identificación pasaporte/exterior.
  return CLIENT_ID_TYPES_WITH_CONDITIONAL_NAME.has(tpIdCliente);
}

function buildFormasCobroVenta(v: any) {
  const totalOperacion = ventaTotalFormaPago(v);
  const formas = cleanPaymentCodes(v.formaPago1, v.formaPago2);

  if (formas.length > 0) {
    return {
      formaPago: formas,
    };
  }

  const fallback = totalOperacion <= 500 ? "01" : "20";

  console.info(
    `[ATS][VENTAS] Forma de cobro no informada o inválida. ` +
      `Se aplicó fallback ${fallback} para fila ${v.filaExcel || "-"}, ` +
      `cliente ${clean(v.noIdentificacion) || "-"}, total ${money(totalOperacion)}.`
  );

  return {
    formaPago: [fallback],
  };
}

function buildCompra(c: any) {
  const isNotaCredito = clean(c.comprobante) === "04";
  const compraMoney = isNotaCredito ? moneyAbs : money;
  const baseImpGrav = sumMoney(c.baseGravableIva1, c.baseGravableIva2, c.baseGravableIva3);
  const montoIva = sumMoney(c.montoIva1, c.montoIva2, c.montoIva3);
  const valorRetIva30 = firstMoney(c.valorRetencionIva30, c.retIvaValor30);
  const valorRetIva50 = firstMoney(c.valorRetencionIva50, c.retIvaValor50);
  const valorRetIva70 = firstMoney(c.valorRetencionIva70, c.retIvaValor70);
  const valorRetIva100 = firstMoney(c.valorRetencionIva100, c.retIvaValor100);
  const valorRetIvaNc = firstMoney(c.valorRetencionIvaEnNc, c.valorRetencionNc);
  const retencionTieneDatos =
    hasValue(c.establecimientoRet) &&
    hasValue(c.puntoEmisionRet) &&
    hasValue(c.numeroSecuencialRet) &&
    hasValue(c.numeroAutorizacionSriRet);

  const documentoModificadoTieneDatos =
    hasValue(c.comprobanteModificado) &&
    hasValue(c.establecimientoModificado) &&
    hasValue(c.puntoEmisionModificado) &&
    hasValue(c.numeroSecuencialModificado) &&
    hasValue(c.numeroAutorizacionSriModificado);

  return removeUndefinedDeep({
    codSustento: clean(c.codigoSustento || "01"),
    tpIdProv: tipoIdProveedor(c.noIdentificacion),
    idProv: clean(c.noIdentificacion),
    tipoComprobante: clean(c.comprobante),
    tipoProv: clean(c.tipoProveedor) || undefined,
    denoProv: cleanTributaryName(c.razonSocialProveedor) || undefined,
    parteRel: siNo(c.parteRelacionada),

    fechaRegistro: dateDDMMYYYY(c.fechaRegistro),
    establecimiento: pad(c.establecimiento, 3),
    puntoEmision: pad(c.puntoEmision, 3),
    secuencial: pad(c.numeroSecuencial, 9),
    fechaEmision: dateDDMMYYYY(c.fechaEmision),
    autorizacion: clean(c.numeroAutorizacionSri),

    baseNoGraIva: compraMoney(c.baseNoObjetoIva),
    baseImponible: compraMoney(c.baseTarifa0),
    baseImpGrav: compraMoney(baseImpGrav),
    baseImpExe: compraMoney(c.baseExenta),
    montoIce: compraMoney(c.montoIceNoIncluido),
    montoIva: compraMoney(montoIva),

    valRetBien10: money(firstMoney(c.valRetBien10, c.valorRetencionIva10)),
    valRetServ20: money(firstMoney(c.valRetServ20, c.valorRetencionIva20)),
    valorRetBienes: money(valorRetIva30),
    valRetServ50: money(valorRetIva50),
    valorRetServicios: money(valorRetIva70),
    valRetServ100: money(valorRetIva100),
    valorRetencionNc: hasMoney(valorRetIvaNc)
      ? money(valorRetIvaNc)
      : undefined,
    totbasesImpReemb: money(c.totbasesImpReemb),

    pagoExterior: {
      pagoLocExt: "01",
      paisEfecPago: "NA",
      aplicConvDobTrib: "NA",
      pagExtSujRetNorLeg: "NA",
    },

    formasDePago: buildFormasPago(compraTotalFormaPago(c), c.formaPago1, c.formaPago2),
    air: buildAir(c),

    estabRetencion1: retencionTieneDatos ? pad(c.establecimientoRet, 3) : undefined,
    ptoEmiRetencion1: retencionTieneDatos ? pad(c.puntoEmisionRet, 3) : undefined,
    secRetencion1: retencionTieneDatos ? pad(c.numeroSecuencialRet, 9) : undefined,
    autRetencion1: retencionTieneDatos ? clean(c.numeroAutorizacionSriRet) : undefined,
    fechaEmiRet1:
      retencionTieneDatos && c.fechaEmisionRet1
        ? dateDDMMYYYY(c.fechaEmisionRet1)
        : undefined,

    docModificado: documentoModificadoTieneDatos ? clean(c.comprobanteModificado) : undefined,
    estabModificado: documentoModificadoTieneDatos
      ? pad(c.establecimientoModificado, 3)
      : undefined,
    ptoEmiModificado: documentoModificadoTieneDatos
      ? pad(c.puntoEmisionModificado, 3)
      : undefined,
    secModificado: documentoModificadoTieneDatos
      ? pad(c.numeroSecuencialModificado, 9)
      : undefined,
    autModificado: documentoModificadoTieneDatos
      ? clean(c.numeroAutorizacionSriModificado)
      : undefined,
  });
}

function buildVenta(v: any) {
  const tpIdCliente = tipoIdCliente(v.noIdentificacion, v.codigoIdentif);
  const emitClientName = ventaRequiresClientName(tpIdCliente);

  return removeUndefinedDeep({
    tpIdCliente,
    idCliente: clean(v.noIdentificacion),
    parteRelVtas: siNo(v.parteRelacionada),
    tipoCliente: emitClientName ? clean(v.tipoCliente) || undefined : undefined,
    denoCli: emitClientName
      ? cleanTributaryName(v.razonSocialCliente, "CONSUMIDOR FINAL") || undefined
      : undefined,

    tipoComprobante: clean(v.tipoComprobante),
    tipoEmision: tipoEmision(v.tipoEmisionComprobante),
    numeroComprobantes: integer(v.cantidadComprobantes || 1),

    baseNoGraIva: money(v.baseNoObjetoIva),
    baseImponible: money(v.baseTarifa0),
    baseImpGrav: money(v.baseGravableIva1),
    montoIva: money(v.montoIva1),
    montoIce: hasMoney(v.montoIceNoIncluido) ? money(v.montoIceNoIncluido) : undefined,

    valorRetIva: money(v.valorRetenidoIva),
    valorRetRenta: money(v.valorRetenidoFuente),

    formasDePago: buildFormasCobroVenta(v),
  });
}

function buildAnulado(a: any) {
  return removeUndefinedDeep({
    tipoComprobante: clean(a.tipoComprobante),
    establecimiento: pad(a.establecimiento, 3),
    puntoEmision: pad(a.puntoEmision, 3),
    secuencialInicio: pad(a.secuencialDesde, 9),
    secuencialFin: pad(a.secuencialHasta, 9),
    autorizacion: clean(a.numeroAutorizacionSri),
  });
}

export function buildAtsXml(data: AtsXmlInput): string {
  const mes = mesToNumber(data.mes);

  const totalVentas = data.ventas.reduce((acc, venta) => acc + ventaBaseAts(venta), 0);

  const compras = data.compras.map(buildCompra).filter(Boolean);
  const ventas = data.ventas.map(buildVenta).filter(Boolean);

  const anulados = data.anulados
    .map(buildAnulado)
    .filter(
      (a) =>
        a &&
        a.tipoComprobante &&
        a.establecimiento &&
        a.puntoEmision &&
        a.secuencialInicio &&
        a.secuencialFin &&
        a.autorizacion
    );

  const iva = removeUndefinedDeep({
    TipoIDInformante: "R",
    IdInformante: clean(data.rucInformante),
    razonSocial: cleanTributaryName(data.razonSocial),
    Anio: String(data.anio),
    Mes: mes,
    numEstabRuc: pad(data.numEstabRuc || "001", 3),
    totalVentas: money(totalVentas),
    codigoOperativo: "IVA",

    compras:
      compras.length > 0
        ? {
            detalleCompras: compras,
          }
        : undefined,

    ventas:
      ventas.length > 0
        ? {
            detalleVentas: ventas,
          }
        : undefined,

    ventasEstablecimiento:
      ventas.length > 0
        ? {
            ventaEst: [
              {
                codEstab: pad(data.numEstabRuc || "001", 3),
                ventasEstab: money(totalVentas),
                ivaComp: "0.00",
              },
            ],
          }
        : undefined,

    anulados:
      anulados.length > 0
        ? {
            detalleAnulados: anulados,
          }
        : undefined,
  });

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    suppressEmptyNode: false,
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build({ iva })}`;
}
