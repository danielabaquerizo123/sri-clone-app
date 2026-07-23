import type {
  AccountingRetentionData,
  AccountingRetentionIva,
  AccountingRetentionSource,
} from "../contratos";

export function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function money(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? roundMoney(value) : 0;
  const raw = String(value).trim();
  const accountingNegative = /^\(.+\)$/.test(raw);
  const compact = raw.replace(/\s/g, "").replace(/^\((.+)\)$/, "$1");
  const normalized =
    compact.includes(",") && compact.includes(".")
      ? compact.replace(/,/g, "")
      : compact.includes(",")
        ? compact.replace(",", ".")
        : compact;
  const parsed = Number(normalized);
  const signedValue = accountingNegative ? -parsed : parsed;
  return Number.isFinite(signedValue) ? roundMoney(signedValue) : 0;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sum(values: number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}

export function dateValue(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
  }
  const raw = text(value);
  if (!raw) return new Date("Invalid Date");
  const isoLike = raw.includes("/") ? raw.split("/").reverse().join("-") : raw;
  return new Date(isoLike);
}

export function joinDocument(...parts: unknown[]): string {
  return parts.map(text).filter(Boolean).join("-");
}

export function buildRetentionData(params: {
  tipoEmision?: unknown;
  establecimiento?: unknown;
  puntoEmision?: unknown;
  secuencial?: unknown;
  autorizacion?: unknown;
  fechaEmision?: unknown;
  retencionesFuente?: AccountingRetentionSource[];
  retencionesIva?: AccountingRetentionIva[];
}): AccountingRetentionData | undefined {
  const retencionesFuente = (params.retencionesFuente || []).filter((item) => item.valor !== 0);
  const retencionesIva = (params.retencionesIva || []).filter((item) => item.valor !== 0);
  const hasHeader =
    text(params.tipoEmision) ||
    text(params.establecimiento) ||
    text(params.puntoEmision) ||
    text(params.secuencial) ||
    text(params.autorizacion) ||
    text(params.fechaEmision);

  if (!hasHeader && retencionesFuente.length === 0 && retencionesIva.length === 0) return undefined;

  return {
    tipoEmision: text(params.tipoEmision) || null,
    establecimiento: text(params.establecimiento) || null,
    puntoEmision: text(params.puntoEmision) || null,
    secuencial: text(params.secuencial) || null,
    autorizacion: text(params.autorizacion) || null,
    fechaEmision: text(params.fechaEmision) ? dateValue(params.fechaEmision) : null,
    retencionesFuente,
    retencionesIva,
    totalRetenidoFuente: sum(retencionesFuente.map((item) => item.valor)),
    totalRetenidoIva: sum(retencionesIva.map((item) => item.valor)),
  };
}

export function retentionSource(codigo: unknown, base: unknown, porcentaje: unknown, valor: unknown): AccountingRetentionSource | null {
  const amount = money(valor);
  if (amount === 0) return null;
  return {
    codigo: text(codigo) || null,
    base: money(base),
    porcentaje: text(porcentaje) ? money(porcentaje) : null,
    valor: amount,
  };
}

export function retentionIva(porcentaje: number, valor: unknown): AccountingRetentionIva | null {
  const amount = money(valor);
  if (amount === 0) return null;
  return { porcentaje, valor: amount };
}
