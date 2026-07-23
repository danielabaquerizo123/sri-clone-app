import type { TrialBalanceGeneratorContract } from "../contratos";
import type { LedgerAccount, TrialBalanceRow } from "../contratos";
import { LibroMayorService } from "./libro-mayor/libro-mayor.service";
import { decimal, money, movementBalanceEffect, splitBalance, MONEY_ZERO } from "./libro-mayor/libro-mayor-saldos.service";
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

export class TrialBalanceGenerator implements TrialBalanceGeneratorContract {
  generate(_ledger: LedgerAccount[]): TrialBalanceRow[] {
    return [];
  }
}

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
  const totalDebe = decimal(folio.totalDebe);
  const totalHaber = decimal(folio.totalHaber);
  const saldo = movementBalanceEffect(totalDebe, totalHaber, folio.naturalezaCuenta);
  const balance = splitBalance(saldo, folio.naturalezaCuenta);

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
