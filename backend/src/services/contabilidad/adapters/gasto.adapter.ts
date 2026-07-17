import type { AccountingDocument } from "../domain/accounting-document";
import { dateValue, joinDocument, money, sum, text } from "./adapter-utils";

export function adaptGasto(gasto: Record<string, unknown>): AccountingDocument {
  return {
    hojaOrigen: "GASTOS",
    filaOrigen: Number(gasto.filaExcel || 0),
    documentoOrigen: text(gasto.documentoOrigen) || joinDocument(gasto.establecimiento, gasto.puntoEmision, gasto.numeroSecuencial),
    fechaEmision: dateValue(gasto.fechaEmision),
    identificacionTercero: text(gasto.noIdentificacion || gasto.rucProveedor),
    razonSocialTercero: text(gasto.razonSocialProveedor || gasto.proveedor),
    tipoOperacion: "GASTO",
    tipoComprobante: text(gasto.comprobante || gasto.tipoComprobante) || null,
    codigoSustento: text(gasto.codigoSustento) || null,
    baseNoObjeto: money(gasto.baseNoObjetoIva),
    baseExenta: money(gasto.baseExenta),
    baseTarifa0: money(gasto.baseTarifa0),
    baseGravada: sum([money(gasto.baseGravableIva1), money(gasto.baseGravableIva2), money(gasto.baseGravableIva3)]),
    iva: sum([money(gasto.montoIva1), money(gasto.montoIva2), money(gasto.montoIva3)]),
    total: money(gasto.totalDocumento || gasto.valor),
    paymentEvidence: {
      formaPago1: text(gasto.formaPago1 || gasto.formaPago) || null,
      formaPago2: text(gasto.formaPago2) || null,
    },
    actividadEconomica: text(gasto.tipoActividad) || null,
    concepto: text(gasto.conceptoContableGasto || gasto.conceptoGasto || gasto.concepto) || null,
    raw: gasto,
  };
}
