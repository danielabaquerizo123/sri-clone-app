import { XMLParser } from "fast-xml-parser";

type AtsResumenInput = {
  compras: any[];
  ventas: any[];
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function safeNumber(value: any, fallback = 0) {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : fallback;
}

function absRound2(value: number) {
  return round2(Math.abs(value));
}

function arrayOf<T = any>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function tipoCompra(compra: any) {
  return clean(compra.comprobante ?? compra.tipoComprobante).padStart(2, "0");
}

function compraBaseGravada(compra: any) {
  return (
    safeNumber(compra.baseGravableIva1 ?? compra.baseImpGrav) +
    safeNumber(compra.baseGravableIva2) +
    safeNumber(compra.baseGravableIva3)
  );
}

function compraIva(compra: any) {
  return (
    safeNumber(compra.montoIva1 ?? compra.montoIva) +
    safeNumber(compra.montoIva2) +
    safeNumber(compra.montoIva3)
  );
}

function compraBase0(compra: any) {
  return safeNumber(compra.baseTarifa0 ?? compra.baseImponible);
}

function compraBaseNoObjeto(compra: any) {
  return safeNumber(compra.baseNoObjetoIva ?? compra.baseNoGraIva);
}

function compraTotalizar(compras: any[]) {
  return compras.reduce(
    (acc, compra) => {
      acc.count += 1;
      acc.base0 = round2(acc.base0 + compraBase0(compra));
      acc.baseGravada = round2(acc.baseGravada + compraBaseGravada(compra));
      acc.baseNoObjeto = round2(acc.baseNoObjeto + compraBaseNoObjeto(compra));
      acc.iva = round2(acc.iva + compraIva(compra));
      return acc;
    },
    { count: 0, base0: 0, baseGravada: 0, baseNoObjeto: 0, iva: 0 }
  );
}

function compraTotalizarAbsoluto(compras: any[]) {
  const raw = compraTotalizar(compras);

  return {
    count: raw.count,
    base0: absRound2(raw.base0),
    baseGravada: absRound2(raw.baseGravada),
    baseNoObjeto: absRound2(raw.baseNoObjeto),
    iva: absRound2(raw.iva),
  };
}

function ventaBaseGravada(venta: any) {
  return (
    safeNumber(venta.baseGravableIva1 ?? venta.baseImpGrav) +
    safeNumber(venta.baseGravableIva2) +
    safeNumber(venta.baseGravableIva3)
  );
}

function ventaIva(venta: any) {
  return (
    safeNumber(venta.montoIva1 ?? venta.montoIva) +
    safeNumber(venta.montoIva2) +
    safeNumber(venta.montoIva3)
  );
}

function ventaBase0(venta: any) {
  return safeNumber(venta.baseTarifa0 ?? venta.baseImponible);
}

function ventaBaseNoObjeto(venta: any) {
  return safeNumber(venta.baseNoObjetoIva ?? venta.baseNoGraIva) + safeNumber(venta.baseExenta);
}

function retencionesFuenteCompras(compras: any[]) {
  const grupos = new Map<string, { codigo: string; registros: number; base: number; valor: number }>();
  const baseRetencion = (compra: any, index: number) =>
    safeNumber(compra[`baseImponibleRetencion${index}`] ?? compra[`baseImponibleRet${index}`]);

  for (const compra of compras.filter((c) => tipoCompra(c) !== "04")) {
    const airs = arrayOf(compra.air?.detalleAir);

    if (airs.length > 0) {
      for (const air of airs) {
        const codigo = clean(air.codRetAir);
        const base = safeNumber(air.baseImpAir);
        const valor = safeNumber(air.valRetAir);
        if (!codigo || base <= 0) continue;
        const current = grupos.get(codigo) || { codigo, registros: 0, base: 0, valor: 0 };
        current.registros += 1;
        current.base = round2(current.base + base);
        current.valor = round2(current.valor + valor);
        grupos.set(codigo, current);
      }
      continue;
    }

    for (const index of [1, 2, 3]) {
      const codigo = clean(compra[`codigoRetencion${index}`]);
      const base = baseRetencion(compra, index);
      const valor = safeNumber(compra[`valorRetenido${index}`]);
      if (!codigo || base <= 0) continue;
      const current = grupos.get(codigo) || { codigo, registros: 0, base: 0, valor: 0 };
      current.registros += 1;
      current.base = round2(current.base + base);
      current.valor = round2(current.valor + valor);
      grupos.set(codigo, current);
    }
  }

  const detalle = Array.from(grupos.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const total = detalle.reduce(
    (acc, item) => ({
      base: round2(acc.base + item.base),
      valor: round2(acc.valor + item.valor),
    }),
    { base: 0, valor: 0 }
  );

  return { detalle, total };
}

function retencionesIvaCompras(compras: any[]) {
  const resumen = compras.reduce(
    (acc, compra) => {
      acc.iva10 = round2(acc.iva10 + safeNumber(compra.valRetBien10) + safeNumber(compra.valorRetencionIva10));
      acc.iva20 = round2(acc.iva20 + safeNumber(compra.valRetServ20) + safeNumber(compra.valorRetencionIva20));
      acc.iva30 = round2(acc.iva30 + safeNumber(compra.valorRetBienes) + safeNumber(compra.valorRetencionIva30));
      acc.iva50 = round2(acc.iva50 + safeNumber(compra.valRetServ50) + safeNumber(compra.valorRetencionIva50));
      acc.iva70 = round2(acc.iva70 + safeNumber(compra.valorRetServicios) + safeNumber(compra.valorRetencionIva70));
      acc.iva100 = round2(
        acc.iva100 +
          safeNumber(compra.valRetServ100) +
          safeNumber(compra.valorRetencionIva100) +
          safeNumber(compra.valorRetencionIva100SectorPublico) +
          safeNumber(compra.liqImpRetIva100SectorPublico)
      );
      acc.ivaNc = round2(acc.ivaNc + safeNumber(compra.valorRetencionNc) + safeNumber(compra.valorRetencionIvaEnNc));
      return acc;
    },
    { iva10: 0, iva20: 0, iva30: 0, iva50: 0, iva70: 0, iva100: 0, ivaNc: 0 }
  );

  return {
    ...resumen,
    total: round2(
      resumen.iva10 +
        resumen.iva20 +
        resumen.iva30 +
        resumen.iva50 +
        resumen.iva70 +
        resumen.iva100 +
        resumen.ivaNc
    ),
  };
}

export function buildAtsResumen(data: AtsResumenInput) {
  const facturasRows = data.compras.filter((c) => tipoCompra(c) === "01");
  const notasCreditoRows = data.compras.filter((c) => tipoCompra(c) === "04");
  const facturas = compraTotalizar(facturasRows);
  const notasCredito = compraTotalizarAbsoluto(notasCreditoRows);
  const retencionesFuente = retencionesFuenteCompras(data.compras);
  const retencionesIva = retencionesIvaCompras(data.compras);

  return {
    compras: {
      facturas,
      notasCredito,
      total: {
        count: facturas.count + notasCredito.count,
        base0: round2(facturas.base0 - notasCredito.base0),
        baseGravada: round2(facturas.baseGravada - notasCredito.baseGravada),
        baseNoObjeto: round2(facturas.baseNoObjeto - notasCredito.baseNoObjeto),
        iva: round2(facturas.iva - notasCredito.iva),
      },
    },
    ventas: {
      documentos: data.ventas.length,
      base0: round2(data.ventas.reduce((acc, v) => acc + ventaBase0(v), 0)),
      baseGravada: round2(data.ventas.reduce((acc, v) => acc + ventaBaseGravada(v), 0)),
      baseNoObjeto: round2(data.ventas.reduce((acc, v) => acc + ventaBaseNoObjeto(v), 0)),
      iva: round2(data.ventas.reduce((acc, v) => acc + ventaIva(v), 0)),
      retIva: round2(data.ventas.reduce((acc, v) => acc + safeNumber(v.valorRetenidoIva ?? v.valorRetIva), 0)),
      retFuente: round2(data.ventas.reduce((acc, v) => acc + safeNumber(v.valorRetenidoFuente ?? v.valorRetRenta), 0)),
    },
    retenciones: {
      renta: retencionesFuente,
      iva: retencionesIva,
    },
  };
}

export function buildAtsResumenFromXml(xml: string) {
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
  const iva = parsed?.iva || {};

  return buildAtsResumen({
    compras: arrayOf(iva.compras?.detalleCompras),
    ventas: arrayOf(iva.ventas?.detalleVentas),
  });
}
