import type { AtsNormalizedData } from "../ats/normalizer";
import type { AtsValidationIssue } from "../ats/validator";
import type { AtsAdapterContract } from "./interfaces";
import type { AccountingAtsDocument, AccountingAtsInput, AccountingPeriod } from "./types";

function decimalString(value: unknown): string {
  const text = String(value ?? "0").trim().replace(",", ".");
  const normalized = /^-?\d+(\.\d+)?$/.test(text) ? text : "0";
  const [integerPart, decimalPart = ""] = normalized.split(".");
  return `${integerPart}.${decimalPart.padEnd(2, "0").slice(0, 2)}`;
}

function buildCompraDocument(compra: any): AccountingAtsDocument {
  return {
    source: "COMPRA",
    filaExcel: compra.filaExcel,
    identificacion: String(compra.noIdentificacion || ""),
    razonSocial: String(compra.razonSocialProveedor || ""),
    tipoComprobante: String(compra.comprobante || ""),
    numeroDocumento: [
      compra.establecimiento,
      compra.puntoEmision,
      compra.numeroSecuencial,
    ].filter(Boolean).join("-"),
    totalDocumento: decimalString(compra.totalDocumento),
  };
}

function buildVentaDocument(venta: any): AccountingAtsDocument {
  return {
    source: "VENTA",
    filaExcel: venta.filaExcel,
    identificacion: String(venta.noIdentificacion || ""),
    razonSocial: String(venta.razonSocialCliente || ""),
    tipoComprobante: String(venta.tipoComprobante || ""),
    numeroDocumento: [
      venta.codigoEstablecimiento,
      venta.noDocumento,
    ].filter(Boolean).join("-"),
    totalDocumento: decimalString(venta.totalDocumento),
  };
}

export class ATSAdapter implements AtsAdapterContract {
  constructor(
    private readonly normalized: AtsNormalizedData,
    private readonly validationIssues: AtsValidationIssue[],
    private readonly periodo: AccountingPeriod
  ) {}

  adapt(): AccountingAtsInput {
    return {
      empresa: this.normalized.informante.razonSocialInformante,
      ruc: this.normalized.informante.rucInformante,
      periodo: this.periodo,
      compras: this.normalized.compras.map(buildCompraDocument),
      ventas: this.normalized.ventas.map(buildVentaDocument),
      atsIssues: this.normalized.issues,
      validationIssues: this.validationIssues,
      normalized: this.normalized,
    };
  }
}
