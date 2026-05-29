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

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();

  return `${dd}/${mm}/${yyyy}`;
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
  const detalleAir: any[] = [];

  if (hasMoney(c.valorRetenido1)) {
    detalleAir.push({
      codRetAir: clean(c.codigoRetencion1 || "332"),
      baseImpAir: money(c.baseImponibleRet1),
      porcentajeAir: porcentajeAirValue(c.porcentajeRetencion1),
      valRetAir: money(c.valorRetenido1),
    });
  }

  if (hasMoney(c.valorRetenido2)) {
    detalleAir.push({
      codRetAir: clean(c.codigoRetencion2 || "332"),
      baseImpAir: money(c.baseImponibleRet2),
      porcentajeAir: porcentajeAirValue(c.porcentajeRetencion2),
      valRetAir: money(c.valorRetenido2),
    });
  }

  if (hasMoney(c.valorRetenido3)) {
    detalleAir.push({
      codRetAir: clean(c.codigoRetencion3 || "332"),
      baseImpAir: money(c.baseImponibleRet3),
      porcentajeAir: porcentajeAirValue(c.porcentajeRetencion3),
      valRetAir: money(c.valorRetenido3),
    });
  }

  if (detalleAir.length === 0) return undefined;

  return { detalleAir };
}

function buildFormasPago(formaPago1?: string | null, formaPago2?: string | null) {
  const formas = [formaPago1, formaPago2]
    .map((x) => clean(x))
    .filter(Boolean);

  if (formas.length === 0) return undefined;

  return {
    formaPago: formas,
  };
}

function buildCompra(c: any) {
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

    baseNoGraIva: money(c.baseNoObjetoIva),
    baseImponible: money(c.baseTarifa0),
    baseImpGrav: money(c.baseGravableIva1),
    baseImpExe: money(c.baseExenta),
    montoIce: money(c.montoIceNoIncluido),
    montoIva: money(c.montoIva1),

    valRetBien10: money(c.valRetBien10),
    valRetServ20: money(c.valRetServ20),
    valorRetBienes: money(c.valorRetencionIva30),
    valRetServ50: money(c.valorRetencionIva50),
    valorRetServicios: money(c.valorRetencionIva70),
    valRetServ100: money(c.valorRetencionIva100),
    valorRetencionNc: hasMoney(c.valorRetencionIvaEnNc)
      ? money(c.valorRetencionIvaEnNc)
      : undefined,
    totbasesImpReemb: money(c.totbasesImpReemb),

    pagoExterior: {
      pagoLocExt: "01",
      paisEfecPago: "NA",
      aplicConvDobTrib: "NA",
      pagExtSujRetNorLeg: "NA",
    },

    formasDePago: buildFormasPago(c.formaPago1, c.formaPago2),
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
  return removeUndefinedDeep({
    tpIdCliente: tipoIdCliente(v.noIdentificacion, v.codigoIdentif),
    idCliente: clean(v.noIdentificacion),
    parteRelVtas: siNo(v.parteRelacionada),
    tipoCliente: clean(v.tipoCliente) || undefined,
    denoCli: cleanTributaryName(v.razonSocialCliente, "CONSUMIDOR FINAL") || undefined,

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

    formasDePago: buildFormasPago(v.formaPago1, v.formaPago2),
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

  const totalVentas = data.ventas.reduce(
    (acc, venta) => acc + Number(venta.totalDocumento || 0),
    0
  );

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
