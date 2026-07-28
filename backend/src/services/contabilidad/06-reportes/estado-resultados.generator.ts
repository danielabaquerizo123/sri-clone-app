import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../../lib/prisma";
import { BalanceComprobacionService, type BalanceComprobacionResponse, type BalanceComprobacionRow } from "./balance-comprobacion.generator";
import { decimal, money, MONEY_ZERO } from "./libro-mayor/libro-mayor-saldos.service";
import type { JournalPreviewResult } from "../04-asientos/preview-asientos.service";
import type { LibroMayorParams } from "./libro-mayor/libro-mayor.types";

type DbClient = PrismaClient | typeof defaultPrisma;

export const RESULTADO_CATEGORIAS = [
  "INGRESO_OPERACIONAL",
  "OTRO_INGRESO",
  "COSTO_VENTAS",
  "GASTO_OPERACIONAL",
  "GASTO_ADMINISTRATIVO",
  "GASTO_VENTAS",
  "GASTO_FINANCIERO",
  "OTRO_GASTO",
  "PARTICIPACION_TRABAJADORES",
  "IMPUESTO_RENTA",
] as const;

export type CategoriaEstadoResultados = (typeof RESULTADO_CATEGORIAS)[number];
type CategoriaConTipo = Record<CategoriaEstadoResultados, "INGRESO" | "GASTO" | "COSTO">;

const TIPO_POR_CATEGORIA: CategoriaConTipo = {
  INGRESO_OPERACIONAL: "INGRESO",
  OTRO_INGRESO: "INGRESO",
  COSTO_VENTAS: "COSTO",
  GASTO_OPERACIONAL: "GASTO",
  GASTO_ADMINISTRATIVO: "GASTO",
  GASTO_VENTAS: "GASTO",
  GASTO_FINANCIERO: "GASTO",
  OTRO_GASTO: "GASTO",
  PARTICIPACION_TRABAJADORES: "GASTO",
  IMPUESTO_RENTA: "GASTO",
};

export type EstadoResultadosLinea = {
  cuentaId: string;
  codigo: string;
  cuenta: string;
  categoria: CategoriaEstadoResultados;
  valor: string;
};
export type CuentaPendienteEstadoResultados = { cuentaId: string; codigo: string; cuenta: string; tipo: string; saldo: string; motivo: "SIN_CLASIFICACION_ESTADO_RESULTADOS" };

export type EstadoResultadosResponse = {
  origen: BalanceComprobacionResponse["origen"];
  estadoReporte: string;
  empresa: BalanceComprobacionResponse["empresa"];
  periodo: BalanceComprobacionResponse["periodo"];
  fechaDesde: string | null;
  fechaHasta: string | null;
  moneda: "Dólares (USD)";
  lineas: EstadoResultadosLinea[];
  secciones: Record<CategoriaEstadoResultados, EstadoResultadosLinea[]>;
  totales: Record<CategoriaEstadoResultados, string> & {
    utilidadBruta: string;
    totalGastosOperacionales: string;
    utilidadOperacional: string;
    resultadoAntesParticipacionImpuestos: string;
    resultadoAntesImpuesto: string;
    resultadoNeto: string;
  };
  resultadoFinal: { etiqueta: "UTILIDAD NETA DEL EJERCICIO" | "PÉRDIDA NETA DEL EJERCICIO" | "RESULTADO DEL EJERCICIO"; valor: string };
  tipoResultado: "UTILIDAD" | "PERDIDA" | "CERO";
  costoVentasDisponible: boolean;
  resultadoDeterminado: boolean;
  completo: boolean;
  cuentasPendientes: CuentaPendienteEstadoResultados[];
  advertencias: string[];
};

export class EstadoResultadosService {
  constructor(
    private readonly balance = new BalanceComprobacionService(),
    private readonly db: DbClient = defaultPrisma
  ) {}

  async generar(params: LibroMayorParams): Promise<EstadoResultadosResponse> {
    return this.generarDesdeBalance(await this.balance.generar(params));
  }

  async generarDesdePreview(preview: JournalPreviewResult, params: Omit<LibroMayorParams, "ruc"> = {}): Promise<EstadoResultadosResponse> {
    return this.generarDesdeBalance(this.balance.generarDesdePreview(preview, params));
  }

  async generarDesdeBalance(balance: BalanceComprobacionResponse): Promise<EstadoResultadosResponse> {
    const cuentasBalance = new Set<string>();
    for (const fila of balance.filas) {
      if (cuentasBalance.has(fila.cuentaId)) throw new Error(`La cuenta ${fila.codigo} está duplicada en el Balance de Comprobación.`);
      cuentasBalance.add(fila.cuentaId);
    }
    const cuentas = await this.db.clasificacionEstadoResultados.findMany({
      where: { activa: true, cuentaId: { in: balance.filas.map((fila) => fila.cuentaId) } },
      select: { cuentaId: true, categoria: true },
    });
    const categorias = new Map(cuentas.map((cuenta) => [cuenta.cuentaId, cuenta.categoria as CategoriaEstadoResultados]));
    const advertencias: string[] = [];
    const cuentasPendientes: CuentaPendienteEstadoResultados[] = [];
    const lineas = balance.filas.flatMap((fila) => {
      const categoria = categorias.get(fila.cuentaId);
      if (!categoria) {
        if (["INGRESO", "GASTO", "COSTO"].includes(fila.tipoCuenta)) cuentasPendientes.push({ cuentaId: fila.cuentaId, codigo: fila.codigo, cuenta: fila.cuenta, tipo: fila.tipoCuenta, saldo: money(decimal(fila.deudor).minus(decimal(fila.acreedor))), motivo: "SIN_CLASIFICACION_ESTADO_RESULTADOS" });
        return [];
      }
      if (isZero(fila)) return [];
      if (fila.tipoCuenta !== TIPO_POR_CATEGORIA[categoria]) {
        advertencias.push(`La cuenta ${fila.codigo} tiene una clasificación de resultados incompatible con su tipo contable.`);
        return [];
      }
      if (TIPO_POR_CATEGORIA[categoria] === "INGRESO" ? decimal(fila.deudor).greaterThan(MONEY_ZERO) : decimal(fila.acreedor).greaterThan(MONEY_ZERO)) advertencias.push(`La cuenta ${fila.codigo} presenta un saldo contrario a su naturaleza esperada.`);
      return [{
        cuentaId: fila.cuentaId,
        codigo: fila.codigo,
        cuenta: fila.cuenta,
        categoria,
        valor: money(netValue(fila, categoria)),
      }];
    });

    const totals = Object.fromEntries(RESULTADO_CATEGORIAS.map((categoria) => [categoria, MONEY_ZERO])) as Record<CategoriaEstadoResultados, typeof MONEY_ZERO>;
    for (const linea of lineas) totals[linea.categoria] = totals[linea.categoria].plus(decimal(linea.valor));

    const costoDisponible = balance.filas.some((fila) => fila.tipoCuenta === "COSTO" && categorias.get(fila.cuentaId) === "COSTO_VENTAS");
    const utilidadBrutaCalculada = totals.INGRESO_OPERACIONAL.minus(totals.COSTO_VENTAS);
    const totalGastosOperacionales = totals.GASTO_OPERACIONAL.plus(totals.GASTO_ADMINISTRATIVO).plus(totals.GASTO_VENTAS);
    const utilidadOperacionalCalculada = utilidadBrutaCalculada.minus(totalGastosOperacionales);
    const resultadoAntesParticipacionImpuestosCalculado = utilidadOperacionalCalculada.plus(totals.OTRO_INGRESO).minus(totals.GASTO_FINANCIERO).minus(totals.OTRO_GASTO);
    const resultadoAntesImpuestoCalculado = resultadoAntesParticipacionImpuestosCalculado.minus(totals.PARTICIPACION_TRABAJADORES);
    const resultadoNetoCalculado = resultadoAntesImpuestoCalculado.minus(totals.IMPUESTO_RENTA);
    const resultadoDeterminado = costoDisponible;

    if (!costoDisponible) {
      advertencias.push("No se identificaron cuentas de costo de ventas en el Balance de Comprobación del período. No es posible determinar la utilidad bruta ni el resultado del ejercicio sin inventar valores.");
    }
    if (cuentasPendientes.length) advertencias.push("Estado de Resultados incompleto: existen cuentas pendientes de clasificación.");
    const secciones = Object.fromEntries(RESULTADO_CATEGORIAS.map((categoria) => [categoria, lineas.filter((linea) => linea.categoria === categoria)])) as Record<CategoriaEstadoResultados, EstadoResultadosLinea[]>;

    return {
      origen: balance.origen,
      estadoReporte: balance.estadoReporte,
      empresa: balance.empresa,
      periodo: balance.periodo,
      fechaDesde: balance.fechaDesde,
      fechaHasta: balance.fechaHasta,
      moneda: balance.moneda,
      lineas,
      secciones,
      totales: {
        ...Object.fromEntries(RESULTADO_CATEGORIAS.map((categoria) => [categoria, money(totals[categoria])])) as Record<CategoriaEstadoResultados, string>,
        utilidadBruta: money(utilidadBrutaCalculada),
        totalGastosOperacionales: money(totalGastosOperacionales),
        utilidadOperacional: money(utilidadOperacionalCalculada),
        resultadoAntesParticipacionImpuestos: money(resultadoAntesParticipacionImpuestosCalculado),
        resultadoAntesImpuesto: money(resultadoAntesImpuestoCalculado),
        resultadoNeto: money(resultadoNetoCalculado),
      },
      resultadoFinal: resultadoNetoCalculado.greaterThan(MONEY_ZERO)
        ? { etiqueta: "UTILIDAD NETA DEL EJERCICIO", valor: money(resultadoNetoCalculado) }
        : resultadoNetoCalculado.lessThan(MONEY_ZERO)
          ? { etiqueta: "PÉRDIDA NETA DEL EJERCICIO", valor: money(resultadoNetoCalculado.abs()) }
          : { etiqueta: "RESULTADO DEL EJERCICIO", valor: money(MONEY_ZERO) },
      tipoResultado: resultadoNetoCalculado.greaterThan(MONEY_ZERO) ? "UTILIDAD" : resultadoNetoCalculado.lessThan(MONEY_ZERO) ? "PERDIDA" : "CERO",
      costoVentasDisponible: costoDisponible,
      resultadoDeterminado,
      completo: cuentasPendientes.length === 0,
      cuentasPendientes,
      advertencias,
    };
  }
}

function isZero(fila: BalanceComprobacionRow) {
  return decimal(fila.deudor).equals(MONEY_ZERO) && decimal(fila.acreedor).equals(MONEY_ZERO);
}

function netValue(fila: BalanceComprobacionRow, categoria: CategoriaEstadoResultados) {
  const deudor = decimal(fila.deudor);
  const acreedor = decimal(fila.acreedor);
  return TIPO_POR_CATEGORIA[categoria] === "INGRESO" ? acreedor.minus(deudor) : deudor.minus(acreedor);
}
