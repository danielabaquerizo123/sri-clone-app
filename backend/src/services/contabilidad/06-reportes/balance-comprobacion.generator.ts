import { LibroMayorService } from "./libro-mayor/libro-mayor.service";
import { decimal, money, splitBalance, MONEY_ZERO } from "./libro-mayor/libro-mayor-saldos.service";
import type { JournalPreviewResult } from "../04-asientos/preview-asientos.service";
import type { LibroMayorFolio, LibroMayorParams, LibroMayorResponse } from "./libro-mayor/libro-mayor.types";

export type BalanceComprobacionRow = {
  numero: number;
  cuentaId: string;
  cuenta: string;
  codigo: string;
  tipoCuenta: string;
  naturalezaCuenta: string;
  debe: string;
  haber: string;
  deudor: string;
  acreedor: string;
};

export type BalanceComprobacionResponse = {
  origen: LibroMayorResponse["origen"];
  estadoReporte: string;
  mensaje: string;
  empresa: LibroMayorResponse["empresa"];
  periodo: LibroMayorResponse["periodo"];
  fechaDesde: string | null;
  fechaHasta: string | null;
  moneda: "Dólares (USD)";
  filas: BalanceComprobacionRow[];
  resumen: {
    totalCuentas: number;
    totalDebe: string;
    totalHaber: string;
    totalDeudor: string;
    totalAcreedor: string;
    diferenciaSumas: string;
    diferenciaSaldos: string;
    cuadradoSumas: boolean;
    cuadradoSaldos: boolean;
  };
};

export class BalanceComprobacionService {
  constructor(private readonly libroMayor = new LibroMayorService()) {}

  async generar(params: LibroMayorParams): Promise<BalanceComprobacionResponse> {
    const libroMayor = await this.libroMayor.generar({ ...params, page: 1, limit: Number.MAX_SAFE_INTEGER });
    return this.generarDesdeLibroMayor(libroMayor);
  }

  generarDesdePreview(preview: JournalPreviewResult, params: Omit<LibroMayorParams, "ruc"> = {}): BalanceComprobacionResponse {
    const libroMayor = this.libroMayor.generarDesdePreview(preview, {
      ...params,
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
    });
    return this.generarDesdeLibroMayor(libroMayor);
  }

  generarDesdeLibroMayor(libroMayor: LibroMayorResponse): BalanceComprobacionResponse {
    validateLibroMayor(libroMayor);
    const filas = libroMayor.folios.map((folio, index) => rowFromFolio(folio, index + 1));
    const totalDebe = filas.reduce((sum, row) => sum.plus(decimal(row.debe)), MONEY_ZERO);
    const totalHaber = filas.reduce((sum, row) => sum.plus(decimal(row.haber)), MONEY_ZERO);
    const totalDeudor = filas.reduce((sum, row) => sum.plus(decimal(row.deudor)), MONEY_ZERO);
    const totalAcreedor = filas.reduce((sum, row) => sum.plus(decimal(row.acreedor)), MONEY_ZERO);
    const diferenciaSumas = totalDebe.minus(totalHaber).abs();
    const diferenciaSaldos = totalDeudor.minus(totalAcreedor).abs();

    return {
      origen: libroMayor.origen,
      estadoReporte: libroMayor.estadoReporte,
      mensaje: "Balance de Comprobación generado desde el Libro Mayor.",
      empresa: libroMayor.empresa,
      periodo: libroMayor.periodo,
      fechaDesde: libroMayor.fechaDesde,
      fechaHasta: libroMayor.fechaHasta,
      moneda: "Dólares (USD)",
      filas,
      resumen: {
        totalCuentas: filas.length,
        totalDebe: money(totalDebe),
        totalHaber: money(totalHaber),
        totalDeudor: money(totalDeudor),
        totalAcreedor: money(totalAcreedor),
        diferenciaSumas: money(diferenciaSumas),
        diferenciaSaldos: money(diferenciaSaldos),
        cuadradoSumas: diferenciaSumas.equals(MONEY_ZERO),
        cuadradoSaldos: diferenciaSaldos.equals(MONEY_ZERO),
      },
    };
  }
}

function rowFromFolio(folio: LibroMayorFolio, numero: number): BalanceComprobacionRow {
  const totalDebe = folio.movimientos.reduce((sum, movimiento) => sum.plus(decimal(movimiento.debe)), MONEY_ZERO);
  const totalHaber = folio.movimientos.reduce((sum, movimiento) => sum.plus(decimal(movimiento.haber)), MONEY_ZERO);
  const saldo = totalDebe.minus(totalHaber);
  const balance = splitBalance(saldo);

  return {
    numero,
    cuentaId: folio.cuentaId,
    cuenta: folio.nombreCuenta,
    codigo: folio.codigoCuenta,
    tipoCuenta: folio.tipoCuenta,
    naturalezaCuenta: folio.naturalezaCuenta,
    debe: money(totalDebe),
    haber: money(totalHaber),
    deudor: balance.deudor,
    acreedor: balance.acreedor,
  };
}

function validateLibroMayor(libroMayor: LibroMayorResponse) {
  const foliosPorCuenta = new Set<string>();
  let totalDebe = MONEY_ZERO;
  let totalHaber = MONEY_ZERO;

  for (const folio of libroMayor.folios) {
    if (foliosPorCuenta.has(folio.codigoCuenta)) {
      throw new Error(`El Libro Mayor contiene más de un folio para la cuenta ${folio.codigoCuenta}.`);
    }
    foliosPorCuenta.add(folio.codigoCuenta);

    const debeMovimientos = folio.movimientos.reduce((sum, movimiento) => sum.plus(decimal(movimiento.debe)), MONEY_ZERO);
    const haberMovimientos = folio.movimientos.reduce((sum, movimiento) => sum.plus(decimal(movimiento.haber)), MONEY_ZERO);
    const saldoMovimientos = debeMovimientos.minus(haberMovimientos);

    if (!decimal(folio.totalDebe).equals(debeMovimientos) || !decimal(folio.totalHaber).equals(haberMovimientos)) {
      throw new Error(`Las sumas del folio ${folio.codigoCuenta} no coinciden con sus movimientos.`);
    }
    if (!decimal(folio.saldoFinal).equals(saldoMovimientos)) {
      throw new Error(`El saldo final del folio ${folio.codigoCuenta} no coincide con Debe menos Haber.`);
    }

    totalDebe = totalDebe.plus(debeMovimientos);
    totalHaber = totalHaber.plus(haberMovimientos);
  }

  if (!totalDebe.equals(decimal(libroMayor.resumenGlobal.totalDebeMayor)) || !totalHaber.equals(decimal(libroMayor.resumenGlobal.totalHaberMayor))) {
    throw new Error("Las sumas del Balance no coinciden con los totales del Libro Mayor.");
  }
  if (!totalDebe.equals(decimal(libroMayor.resumenGlobal.totalDebeDiario)) || !totalHaber.equals(decimal(libroMayor.resumenGlobal.totalHaberDiario))) {
    throw new Error("Las sumas del Balance no coinciden con los totales del Libro Diario.");
  }
}
