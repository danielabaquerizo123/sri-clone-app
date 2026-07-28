import { Prisma } from "@prisma/client";
import type { LibroMayorMovimiento, LibroMayorRawMovement } from "./libro-mayor.types";

export const MONEY_ZERO = new Prisma.Decimal(0);

export function decimal(value: unknown): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(String(value ?? "0"));
}

export function money(value: Prisma.Decimal): string {
  return value.toDecimalPlaces(2).toFixed(2);
}

export function isZero(value: Prisma.Decimal) {
  return value.equals(MONEY_ZERO);
}

export function movementBalanceEffect(debe: unknown, haber: unknown, _naturalezaCuenta?: unknown) {
  const debit = decimal(debe);
  const credit = decimal(haber);
  return debit.minus(credit);
}

export function splitBalance(value: Prisma.Decimal, _naturalezaCuenta?: unknown) {
  if (value.greaterThan(MONEY_ZERO)) {
    return { deudor: money(value), acreedor: "0.00" };
  }
  if (value.lessThan(MONEY_ZERO)) {
    return { deudor: "0.00", acreedor: money(value.abs()) };
  }
  return { deudor: "0.00", acreedor: "0.00" };
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export class LibroMayorSaldosService {
  calculateMovements(lines: LibroMayorRawMovement[], saldoInicial: Prisma.Decimal) {
    let saldo = saldoInicial;
    let totalDebe = MONEY_ZERO;
    let totalHaber = MONEY_ZERO;

    const movimientos: LibroMayorMovimiento[] = lines.map((line) => {
      const debe = decimal(line.debe);
      const haber = decimal(line.haber);
      totalDebe = totalDebe.plus(debe);
      totalHaber = totalHaber.plus(haber);
      saldo = saldo.plus(movementBalanceEffect(debe, haber));
      const balance = splitBalance(saldo);
      return {
        lineaId: line.lineaId,
        asientoId: line.asientoId,
        fecha: isoDate(line.fecha),
        numeroAsiento: String(line.numeroAsiento),
        descripcion: line.descripcion,
        debe: money(debe),
        haber: money(haber),
        saldoAcumulado: money(saldo),
        saldoDeudor: balance.deudor,
        saldoAcreedor: balance.acreedor,
      };
    });

    const saldoFinal = saldoInicial.plus(lines.reduce(
      (acc, line) => acc.plus(movementBalanceEffect(line.debe, line.haber)),
      MONEY_ZERO
    ));
    const saldoAnteriorBalance = splitBalance(saldoInicial);
    const saldoFinalBalance = splitBalance(saldoFinal);

    return {
      movimientos,
      totalDebe,
      totalHaber,
      saldoFinal,
      saldoAnterior: saldoInicial,
      saldoAnteriorDeudor: saldoAnteriorBalance.deudor,
      saldoAnteriorAcreedor: saldoAnteriorBalance.acreedor,
      saldoFinalDeudor: saldoFinalBalance.deudor,
      saldoFinalAcreedor: saldoFinalBalance.acreedor,
    };
  }
}
