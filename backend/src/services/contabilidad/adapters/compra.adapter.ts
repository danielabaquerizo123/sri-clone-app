import type { AccountingDocument } from "../domain/accounting-document";
import { buildRetentionData, dateValue, joinDocument, money, retentionIva, retentionSource, sum, text } from "./adapter-utils";

export function adaptCompra(compra: Record<string, unknown>): AccountingDocument {
  const retencionesFuente = [
    retentionSource(compra.codigoRetencionFuente1, compra.baseImponibleRetencionFuente1, compra.porcentajeRetencionFuente1, compra.valorRetenidoFuente1),
    retentionSource(compra.codigoRetencionFuente2, compra.baseImponibleRetencionFuente2, compra.porcentajeRetencionFuente2, compra.valorRetenidoFuente2),
    retentionSource(compra.codigoRetencionFuente3, compra.baseImponibleRetencionFuente3, compra.porcentajeRetencionFuente3, compra.valorRetenidoFuente3),
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const retencionesIva = [
    retentionIva(10, compra.valorRetenidoIva10),
    retentionIva(20, compra.valorRetenidoIva20),
    retentionIva(30, compra.valorRetenidoIva30),
    retentionIva(50, compra.valorRetenidoIva50),
    retentionIva(70, compra.valorRetenidoIva70),
    retentionIva(100, compra.valorRetenidoIva100),
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    hojaOrigen: "COMPRAS",
    filaOrigen: Number(compra.filaExcel || 0),
    documentoOrigen: joinDocument(compra.establecimiento, compra.puntoEmision, compra.numeroSecuencial),
    fechaEmision: dateValue(compra.fechaEmision),
    fechaRegistro: text(compra.fechaRegistro) ? dateValue(compra.fechaRegistro) : null,
    identificacionTercero: text(compra.noIdentificacion),
    razonSocialTercero: text(compra.razonSocialProveedor),
    tipoOperacion: "COMPRA",
    tipoComprobante: text(compra.comprobante) || null,
    codigoSustento: text(compra.codigoSustento) || null,
    baseNoObjeto: money(compra.baseNoObjetoIva),
    baseExenta: money(compra.baseExenta),
    baseTarifa0: money(compra.baseTarifa0),
    baseGravada: sum([money(compra.baseGravableIva1), money(compra.baseGravableIva2), money(compra.baseGravableIva3)]),
    iva: sum([money(compra.montoIva1), money(compra.montoIva2), money(compra.montoIva3)]),
    total: money(compra.totalDocumento),
    paymentEvidence: {
      tipoPago: text(compra.tipoPago) || null,
      formaPago1: text(compra.formaPago1) || null,
      formaPago2: text(compra.formaPago2) || null,
    },
    datosRetencion: buildRetentionData({
      fechaEmision: compra.fechaEmisionRet1,
      establecimiento: compra.establecimientoRet,
      puntoEmision: compra.puntoEmisionRet,
      secuencial: compra.numeroSecuencialRet,
      autorizacion: compra.numeroAutorizacionSriRet,
      retencionesFuente,
      retencionesIva,
    }),
    actividadEconomica: text(compra.tipoActividad) || null,
    concepto: text(compra.conceptoContableCompra || compra.conceptoCompra || compra.observaciones) || null,
    documentoModificado:
      joinDocument(compra.establecimientoModificado, compra.puntoEmisionModificado, compra.numeroSecuencialModificado) || null,
    autorizacionModificada: text(compra.numeroAutorizacionSriModificado) || null,
    evidencias: [
      text(compra.tipoPago)
        ? {
            campo: "tipoPago",
            valor: text(compra.tipoPago),
            origen: "COMPRAS",
            descripcion: "Tipo de pago tributario declarado en Datos de Pagos de Facturas Compras.",
          }
        : null,
      text(compra.formaPago1)
        ? {
            campo: "formaPago1",
            valor: text(compra.formaPago1),
            origen: "COMPRAS",
            descripcion: "Forma de pago 1 declarada; no prueba pago efectivo por si sola.",
          }
        : null,
      text(compra.formaPago2)
        ? {
            campo: "formaPago2",
            valor: text(compra.formaPago2),
            origen: "COMPRAS",
            descripcion: "Forma de pago 2 declarada; no prueba pago efectivo por si sola.",
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null),
    raw: compra,
  };
}
