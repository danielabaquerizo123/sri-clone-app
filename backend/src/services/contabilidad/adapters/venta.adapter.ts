import type { AccountingDocument } from "../domain/accounting-document";
import { buildRetentionData, dateValue, joinDocument, money, retentionIva, retentionSource, sum, text } from "./adapter-utils";

export function adaptVenta(venta: Record<string, unknown>): AccountingDocument {
  // Prisma conserva los nombres heredados formaPago1/2 en Venta; se traducen al contrato de cobro.
  const formaCobro1 = text(venta.formaCobro1 ?? venta.formaPago1) || null;
  const formaCobro2 = text(venta.formaCobro2 ?? venta.formaPago2) || null;
  const retencionesFuente = [
    retentionSource(venta.codigoRetencionFuente1, venta.baseImponibleRetencionFuente1, venta.porcentajeRetencionFuente1, venta.valorRetenidoFuente1),
    retentionSource(venta.codigoRetencionFuente2, venta.baseImponibleRetencionFuente2, venta.porcentajeRetencionFuente2, venta.valorRetenidoFuente2),
    retentionSource(venta.codigoRetencionFuente3, venta.baseImponibleRetencionFuente3, venta.porcentajeRetencionFuente3, venta.valorRetenidoFuente3),
    retentionSource(venta.codigoRetencionFuente, venta.baseImponibleRetencionFuente, venta.porcentajeRetencionFuente, venta.valorRetenidoFuente),
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const retencionesIva = [
    retentionIva(10, venta.valorRetenidoIva10),
    retentionIva(20, venta.valorRetenidoIva20),
    retentionIva(30, venta.valorRetenidoIva30),
    retentionIva(50, venta.valorRetenidoIva50),
    retentionIva(70, venta.valorRetenidoIva70),
    retentionIva(100, venta.valorRetenidoIva100),
    retentionIva(0, venta.valorRetenidoIva),
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    hojaOrigen: "VENTAS",
    filaOrigen: Number(venta.filaExcel || 0),
    documentoOrigen: joinDocument(venta.codigoEstablecimiento, venta.noDocumento),
    fechaEmision: dateValue(venta.fechaEmision),
    identificacionTercero: text(venta.noIdentificacion),
    razonSocialTercero: text(venta.razonSocialCliente),
    tipoOperacion: "VENTA",
    tipoComprobante: text(venta.tipoComprobante) || null,
    baseNoObjeto: money(venta.baseNoObjetoIva),
    baseExenta: money(venta.baseExenta),
    baseTarifa0: money(venta.baseTarifa0),
    baseGravada: sum([money(venta.baseGravableIva1), money(venta.baseGravableIva2), money(venta.baseGravableIva3)]),
    iva: sum([money(venta.montoIva1), money(venta.montoIva2), money(venta.montoIva3)]),
    total: money(venta.totalDocumento),
    collectionEvidence: { formaCobro1, formaCobro2 },
    datosRetencion: buildRetentionData({
      fechaEmision: venta.fechaRetencion,
      secuencial: venta.noDocumentoRetencion,
      autorizacion: venta.noAutorizacionRetencion,
      retencionesFuente,
      retencionesIva,
    }),
    actividadEconomica: text(venta.tipoActividad) || null,
    concepto: text(venta.conceptoContableVenta || venta.conceptoVenta) || null,
    evidencias: [
      formaCobro1
        ? {
            campo: "formaCobro1",
            valor: formaCobro1,
            origen: "VENTAS",
            descripcion: "Forma de cobro 1 declarada; no prueba cobro efectivo por si sola.",
          }
        : null,
      formaCobro2
        ? {
            campo: "formaCobro2",
            valor: formaCobro2,
            origen: "VENTAS",
            descripcion: "Forma de cobro 2 declarada; no prueba cobro efectivo por si sola.",
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null),
    raw: venta,
  };
}
