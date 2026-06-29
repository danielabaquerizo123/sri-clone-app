import { addMoney, formatMoney, moneyFrom } from "./decimal";
import type { DocumentAnalyzerContract } from "./interfaces";
import type {
  AccountingAtsInput,
  AccountingDocumentAnalysis,
  AccountingDocumentKind,
} from "./types";

function firstText(values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }

  return "";
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      String(value.getDate()).padStart(2, "0"),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getFullYear()),
    ].join("/");
  }

  const raw = String(value ?? "").trim();
  const parts = raw.split(/[/-]/).map((part) => part.trim());

  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (/^\d{1,2}$/.test(day) && /^\d{1,2}$/.test(month) && /^\d{4}$/.test(year)) {
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
  }

  return raw;
}

function compraKind(comprobante: string): AccountingDocumentKind {
  if (comprobante === "04") return "NOTA_CREDITO_COMPRA";
  if (comprobante === "05") return "NOTA_DEBITO_COMPRA";
  if (comprobante === "03") return "LIQUIDACION_COMPRA";
  if (comprobante === "07") return "RETENCION";
  if (comprobante === "01") return "COMPRA";
  return "OTRO";
}

function ventaKind(comprobante: string): AccountingDocumentKind {
  if (comprobante === "04") return "NOTA_CREDITO_VENTA";
  if (comprobante === "05") return "NOTA_DEBITO_VENTA";
  if (comprobante === "18" || comprobante === "01") return "VENTA";
  return "OTRO";
}

function compraBase(compra: any) {
  return addMoney([
    moneyFrom(compra.baseNoObjetoIva),
    moneyFrom(compra.baseExenta),
    moneyFrom(compra.baseTarifa0),
    moneyFrom(compra.baseGravableIva1),
    moneyFrom(compra.baseGravableIva2),
    moneyFrom(compra.baseGravableIva3),
    moneyFrom(compra.montoIceNoIncluido),
  ]);
}

function compraIva(compra: any) {
  return addMoney([
    moneyFrom(compra.montoIva1),
    moneyFrom(compra.montoIva2),
    moneyFrom(compra.montoIva3),
  ]);
}

function ventaBase(venta: any) {
  return addMoney([
    moneyFrom(venta.baseNoObjetoIva),
    moneyFrom(venta.baseExenta),
    moneyFrom(venta.baseTarifa0),
    moneyFrom(venta.baseGravableIva1),
    moneyFrom(venta.baseGravableIva2),
    moneyFrom(venta.baseGravableIva3),
    moneyFrom(venta.montoIceNoIncluido),
    moneyFrom(venta.montoIceIncluido),
    moneyFrom(venta.montoIrbpnrOtros),
  ]);
}

function ventaIva(venta: any) {
  return addMoney([
    moneyFrom(venta.montoIva1),
    moneyFrom(venta.montoIva2),
    moneyFrom(venta.montoIva3),
  ]);
}

function compraNumero(compra: any): string {
  return [compra.establecimiento, compra.puntoEmision, compra.numeroSecuencial]
    .filter(Boolean)
    .join("-");
}

function ventaNumero(venta: any): string {
  return [venta.codigoEstablecimiento, venta.noDocumento].filter(Boolean).join("-");
}

export class DocumentAnalyzer implements DocumentAnalyzerContract {
  analyze(input: AccountingAtsInput): AccountingDocumentAnalysis[] {
    const compras = input.normalized.compras.map((compra: any, index) => ({
      id: `COMPRA-${String(compra.filaExcel || index + 1).padStart(6, "0")}`,
      source: "COMPRA" as const,
      kind: compraKind(String(compra.comprobante || "")),
      hoja: "COMPRAS",
      fila: Number(compra.filaExcel || index + 1),
      ruc: String(compra.noIdentificacion || ""),
      tipoDocumento: String(compra.comprobante || ""),
      numeroDocumento: compraNumero(compra),
      fecha: normalizeDate(firstText([compra.fechaEmision, compra.fechaRegistro])),
      base: formatMoney(compraBase(compra)),
      iva: formatMoney(compraIva(compra)),
      total: formatMoney(moneyFrom(compra.totalDocumento)),
      raw: compra,
    }));

    const ventas = input.normalized.ventas.map((venta: any, index) => ({
      id: `VENTA-${String(venta.filaExcel || index + 1).padStart(6, "0")}`,
      source: "VENTA" as const,
      kind: ventaKind(String(venta.tipoComprobante || "")),
      hoja: "VENTAS",
      fila: Number(venta.filaExcel || index + 1),
      ruc: String(venta.noIdentificacion || ""),
      tipoDocumento: String(venta.tipoComprobante || ""),
      numeroDocumento: ventaNumero(venta),
      fecha: normalizeDate(venta.fechaEmision),
      base: formatMoney(ventaBase(venta)),
      iva: formatMoney(ventaIva(venta)),
      total: formatMoney(moneyFrom(venta.totalDocumento)),
      raw: venta,
    }));

    return [...compras, ...ventas].sort((left, right) =>
      [
        left.fecha.localeCompare(right.fecha),
        left.hoja.localeCompare(right.hoja),
        left.fila - right.fila,
        left.numeroDocumento.localeCompare(right.numeroDocumento),
      ].find((result) => result !== 0) || 0
    );
  }
}
