export const TipoComprobanteSRI = {
  FACTURA: "01",
  NOTA_CREDITO: "04",
  NOTA_DEBITO: "05",
  COMPROBANTE_VENTA: "18",
} as const;

export type TipoComprobanteSRI = (typeof TipoComprobanteSRI)[keyof typeof TipoComprobanteSRI];

export const TiposComprobanteVentaSRI = [
  TipoComprobanteSRI.COMPROBANTE_VENTA,
  TipoComprobanteSRI.FACTURA,
] as const;

export const TiposComprobanteCompraSRI = [
  TipoComprobanteSRI.FACTURA,
] as const;
