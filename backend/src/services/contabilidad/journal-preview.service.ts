import { prisma } from "../../lib/prisma";
import {
  AccountingRuleNotFoundError,
  AccountingRuleResolver,
  type NormalizedAccountingRow,
} from "./accounting-rule-resolver";

type PreviewIssue = {
  tipo: "ERROR" | "WARNING" | "INFO";
  hoja: string;
  fila: number;
  campo: string;
  mensaje: string;
};

export type PreviewLine = {
  cuentaId: string;
  codigo: string;
  cuenta: string;
  descripcion: string;
  debe: number;
  haber: number;
  orden: number;
};

export type PreviewEntry = {
  numero: number;
  fecha: string;
  fechaDate: Date;
  glosa: string;
  descripcion: string;
  documentoOrigen: string;
  hojaOrigen: string;
  filaOrigen: number;
  reglaCodigo: string;
  lineas: PreviewLine[];
  totalDebe: number;
  totalHaber: number;
  valido: boolean;
  errores: string[];
};

export type JournalPreviewResult = {
  resumen: {
    ruc: string;
    razonSocial: string;
    loteId: string;
    periodo: string;
    asientosValidos: number;
    asientosPendientes: number;
    errores: number;
  };
  periodo: {
    id: string;
    anio: number;
    mes: string;
    estado: string;
  };
  asientos: PreviewEntry[];
  pendientes: Array<{
    hoja: string;
    fila: number;
    documentoOrigen: string;
    motivo: string;
  }>;
  issues: PreviewIssue[];
};

type SourceDocument = {
  hoja: "COMPRAS" | "VENTAS" | "GASTOS";
  fila: number;
  fecha: Date;
  documentoOrigen: string;
  tercero: string;
  identificacion: string;
  tipoComprobante: string;
  tipoComprobanteLabel: string;
  descripcion: string;
  glosa: string;
  row: NormalizedAccountingRow;
  base: number;
  iva: number;
  total: number;
};

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function moneyText(value: number) {
  return money(value).toFixed(2);
}

function absMoney(value: number) {
  return Math.abs(money(value));
}

function add(values: number[]) {
  return money(values.reduce((total, value) => total + value, 0));
}

function sameMoney(left: number, right: number) {
  return Math.abs(money(left) - money(right)) < 0.01;
}

function dateToIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function safeDate(value: unknown, fallback: Date) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function firstPositive(values: unknown[]) {
  return values.map(toNumber).find((value) => value > 0) || null;
}

function comprobanteLabel(code: unknown) {
  const text = String(code || "").padStart(2, "0");

  const labels: Record<string, string> = {
    "01": "Factura",
    "03": "Liquidacion de Compra",
    "04": "Nota de Credito",
    "05": "Nota de Debito",
    "18": "Factura",
  };

  return labels[text] || "Comprobante";
}

function buildGlosa(params: {
  tipoOperacion: "Compra" | "Venta" | "Gasto";
  tipoComprobante: string;
  tercero: string;
  identificacion: string;
}) {
  return `V. ${params.tipoOperacion} s/${params.tipoComprobante}-${comprobanteLabel(
    params.tipoComprobante
  )} a ${params.tercero || "SIN IDENTIFICAR"} (${params.identificacion || "SIN RUC"})`;
}

function compraDocument(compra: any): SourceDocument {
  const base = add([
    toNumber(compra.baseNoObjetoIva),
    toNumber(compra.baseExenta),
    toNumber(compra.baseTarifa0),
    toNumber(compra.baseGravableIva1),
    toNumber(compra.baseGravableIva2),
    toNumber(compra.baseGravableIva3),
    toNumber(compra.montoIceNoIncluido),
    toNumber(compra.montoOtros),
  ]);
  const iva = add([
    toNumber(compra.montoIva1),
    toNumber(compra.montoIva2),
    toNumber(compra.montoIva3),
  ]);
  const total = toNumber(compra.totalDocumento) || add([base, iva]);

  const tipoComprobante = String(compra.comprobante || "").padStart(2, "0");
  const tercero = String(compra.razonSocialProveedor || "").trim();
  const identificacion = String(compra.noIdentificacion || "").trim();

  return {
    hoja: "COMPRAS",
    fila: Number(compra.filaExcel || 0),
    fecha: safeDate(compra.fechaEmision || compra.fechaRegistro, new Date()),
    documentoOrigen: [compra.establecimiento, compra.puntoEmision, compra.numeroSecuencial]
      .filter(Boolean)
      .join("-"),
    tercero,
    identificacion,
    tipoComprobante,
    tipoComprobanteLabel: comprobanteLabel(tipoComprobante),
    descripcion: `Compra ${tercero}`.trim(),
    glosa: buildGlosa({
      tipoOperacion: "Compra",
      tipoComprobante,
      tercero,
      identificacion,
    }),
    row: {
      tipoOperacion: "COMPRA",
      tipoComprobante: tipoComprobante || null,
      codigoSustento: compra.codigoSustento || null,
      tarifaIva: firstPositive([
        compra.tarifaIva1Aplicada,
        compra.tarifaIva2Aplicada,
        compra.tarifaIva3Aplicada,
      ]),
      formaPago: compra.formaPago1 || compra.formaPago2 || null,
    },
    base: absMoney(base),
    iva: absMoney(iva),
    total: absMoney(total),
  };
}

function ventaDocument(venta: any): SourceDocument {
  const base = add([
    toNumber(venta.baseNoObjetoIva),
    toNumber(venta.baseExenta),
    toNumber(venta.baseTarifa0),
    toNumber(venta.baseGravableIva1),
    toNumber(venta.baseGravableIva2),
    toNumber(venta.baseGravableIva3),
    toNumber(venta.montoIceNoIncluido),
    toNumber(venta.montoIceIncluido),
    toNumber(venta.montoIrbpnrOtros),
  ]);
  const iva = add([
    toNumber(venta.montoIva1),
    toNumber(venta.montoIva2),
    toNumber(venta.montoIva3),
  ]);
  const total = toNumber(venta.totalDocumento) || add([base, iva]);

  const tipoComprobante = String(venta.tipoComprobante || "").padStart(2, "0");
  const tercero = String(venta.razonSocialCliente || "").trim();
  const identificacion = String(venta.noIdentificacion || "").trim();

  return {
    hoja: "VENTAS",
    fila: Number(venta.filaExcel || 0),
    fecha: safeDate(venta.fechaEmision, new Date()),
    documentoOrigen: [venta.codigoEstablecimiento, venta.noDocumento].filter(Boolean).join("-"),
    tercero,
    identificacion,
    tipoComprobante,
    tipoComprobanteLabel: comprobanteLabel(tipoComprobante),
    descripcion: `Venta ${tercero}`.trim(),
    glosa: buildGlosa({
      tipoOperacion: "Venta",
      tipoComprobante,
      tercero,
      identificacion,
    }),
    row: {
      tipoOperacion: "VENTA",
      tipoComprobante: tipoComprobante || null,
      tarifaIva: firstPositive([
        venta.tarifaIva1Aplicada,
        venta.tarifaIva2Aplicada,
        venta.tarifaIva3Aplicada,
      ]),
      formaPago: venta.formaPago1 || venta.formaPago2 || null,
    },
    base: absMoney(base),
    iva: absMoney(iva),
    total: absMoney(total),
  };
}

function lineFromAccount(params: {
  cuenta: any;
  side: "DEBE" | "HABER";
  amount: number;
  descripcion: string;
  orden: number;
}): PreviewLine | null {
  if (params.amount <= 0) return null;

  return {
    cuentaId: params.cuenta.id,
    codigo: params.cuenta.codigo,
    cuenta: params.cuenta.nombre,
    descripcion: params.descripcion,
    debe: params.side === "DEBE" ? money(params.amount) : 0,
    haber: params.side === "HABER" ? money(params.amount) : 0,
    orden: params.orden,
  };
}

function validateEntry(entry: PreviewEntry, periodoEstado: string) {
  const errors: string[] = [];

  if (periodoEstado !== "ABIERTO") {
    errors.push("El período contable está cerrado.");
  }

  if (entry.lineas.length < 2) {
    errors.push("El asiento debe contener al menos dos líneas.");
  }

  const debe = add(entry.lineas.map((line) => line.debe));
  const haber = add(entry.lineas.map((line) => line.haber));

  if (!sameMoney(debe, haber)) {
    errors.push("Debe y Haber no son iguales.");
  }

  for (const line of entry.lineas) {
    const debeLine = toNumber(line.debe);
    const haberLine = toNumber(line.haber);

    if (debeLine < 0 || haberLine < 0) {
      errors.push("Los valores contables no pueden ser negativos.");
    }

    if (debeLine > 0 && haberLine > 0) {
      errors.push(`La cuenta ${line.codigo} tiene Debe y Haber simultáneamente.`);
    }
  }

  return errors;
}

export class JournalPreviewService {
  constructor(private readonly ruleResolver = new AccountingRuleResolver()) {}

  async buildFromAtsLote(ruc: string, loteId: string): Promise<JournalPreviewResult> {
    const contribuyente = await prisma.contribuyente.findUnique({ where: { ruc } });

    if (!contribuyente) {
      throw new Error("Contribuyente no encontrado.");
    }

    const lote = await prisma.atsLote.findFirst({
      where: {
        id: loteId,
        contribuyenteId: contribuyente.id,
      },
      include: {
        compras: true,
        ventas: true,
      },
    });

    if (!lote) {
      throw new Error("Lote ATS no encontrado para el contribuyente indicado.");
    }

    const periodo = await prisma.periodoContable.upsert({
      where: {
        contribuyenteId_anio_mes: {
          contribuyenteId: contribuyente.id,
          anio: lote.anio,
          mes: lote.mes,
        },
      },
      update: {},
      create: {
        contribuyenteId: contribuyente.id,
        anio: lote.anio,
        mes: lote.mes,
        estado: "ABIERTO",
      },
    });

    const lastAsiento = await prisma.asientoContable.findFirst({
      where: {
        contribuyenteId: contribuyente.id,
        periodoId: periodo.id,
      },
      orderBy: { numero: "desc" },
    });

    let nextNumber = (lastAsiento?.numero || 0) + 1;
    const documents = [
      ...lote.compras.map(compraDocument),
      ...lote.ventas.map(ventaDocument),
    ].sort((left, right) => {
      const byDate = left.fecha.getTime() - right.fecha.getTime();
      if (byDate !== 0) return byDate;
      return left.fila - right.fila;
    });

    const asientos: PreviewEntry[] = [];
    const pendientes: JournalPreviewResult["pendientes"] = [];
    const issues: PreviewIssue[] = [];

    for (const document of documents) {
      try {
        const rule = await this.ruleResolver.resolve(document.row);
        const total = document.total || add([document.base, document.iva]);
        const lineas = [
          lineFromAccount({
            cuenta: rule.cuentaBase,
            side: rule.ladoBase as "DEBE" | "HABER",
            amount: document.base,
            descripcion: `${document.descripcion} base ${document.documentoOrigen}`,
            orden: 1,
          }),
          rule.cuentaIva && rule.ladoIva
            ? lineFromAccount({
                cuenta: rule.cuentaIva,
                side: rule.ladoIva as "DEBE" | "HABER",
                amount: document.iva,
                descripcion: `${document.descripcion} IVA ${document.documentoOrigen}`,
                orden: 2,
              })
            : null,
          lineFromAccount({
            cuenta: rule.cuentaContrapartida,
            side: rule.ladoContrapartida as "DEBE" | "HABER",
            amount: total,
            descripcion: `${document.descripcion} contrapartida ${document.documentoOrigen}`,
            orden: 3,
          }),
        ].filter((line): line is PreviewLine => Boolean(line));

        const missingMovementAccounts = [
          rule.cuentaBase,
          rule.cuentaIva,
          rule.cuentaContrapartida,
        ].filter(
          (cuenta): cuenta is NonNullable<typeof cuenta> =>
            Boolean(cuenta && (!cuenta.activa || !cuenta.movimiento))
        );

        const totalDebe = add(lineas.map((line) => line.debe));
        const totalHaber = add(lineas.map((line) => line.haber));
        const entry: PreviewEntry = {
          numero: nextNumber++,
          fecha: dateToIsoDate(document.fecha),
          fechaDate: document.fecha,
          glosa: document.glosa,
          descripcion: document.descripcion,
          documentoOrigen: document.documentoOrigen,
          hojaOrigen: document.hoja,
          filaOrigen: document.fila,
          reglaCodigo: rule.codigo,
          lineas,
          totalDebe,
          totalHaber,
          valido: true,
          errores: [],
        };

        const errors = validateEntry(entry, periodo.estado);

        missingMovementAccounts.forEach((cuenta) => {
          errors.push(`La cuenta ${cuenta.codigo} no está activa o no es de movimiento.`);
        });

        entry.errores = errors;
        entry.valido = errors.length === 0;
        asientos.push(entry);

        errors.forEach((message) => {
          issues.push({
            tipo: "ERROR",
            hoja: document.hoja,
            fila: document.fila,
            campo: "asiento",
            mensaje: message,
          });
        });
      } catch (error) {
        const message =
          error instanceof AccountingRuleNotFoundError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error);

        pendientes.push({
          hoja: document.hoja,
          fila: document.fila,
          documentoOrigen: document.documentoOrigen,
          motivo: message,
        });
        issues.push({
          tipo: "ERROR",
          hoja: document.hoja,
          fila: document.fila,
          campo: "reglaContable",
          mensaje: message,
        });
      }
    }

    return {
      resumen: {
        ruc: contribuyente.ruc,
        razonSocial: contribuyente.razonSocial,
        loteId: lote.id,
        periodo: `${lote.mes}/${lote.anio}`,
        asientosValidos: asientos.filter((entry) => entry.valido).length,
        asientosPendientes: pendientes.length + asientos.filter((entry) => !entry.valido).length,
        errores: issues.filter((issue) => issue.tipo === "ERROR").length,
      },
      periodo: {
        id: periodo.id,
        anio: periodo.anio,
        mes: periodo.mes,
        estado: periodo.estado,
      },
      asientos,
      pendientes,
      issues,
    };
  }
}
