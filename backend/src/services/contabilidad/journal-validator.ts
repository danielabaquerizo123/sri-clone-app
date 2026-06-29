import { addMoney, isNegative, isZero, moneyFrom } from "./decimal";
import type { AccountingJournalValidatorContract } from "./interfaces";
import type { JournalEntry } from "./types";

function validDate(value: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value);
}

function validAccount(value: string): boolean {
  return /^\d+(\.\d+)+$/.test(value);
}

export class AccountingJournalValidator implements AccountingJournalValidatorContract {
  validate(entry: JournalEntry): string[] {
    const errors: string[] = [];

    if (!validDate(entry.fecha)) {
      errors.push("Fecha inválida.");
    }

    if (!entry.documentoOrigen) {
      errors.push("Documento origen vacío.");
    }

    if (entry.movimientos.length < 2) {
      errors.push("El asiento debe contener al menos dos movimientos.");
    }

    const debe = addMoney(entry.movimientos.map((line) => moneyFrom(line.debe)));
    const haber = addMoney(entry.movimientos.map((line) => moneyFrom(line.haber)));

    if (debe !== haber) {
      errors.push("Debe y Haber no son iguales.");
    }

    entry.movimientos.forEach((line) => {
      const debeLine = moneyFrom(line.debe);
      const haberLine = moneyFrom(line.haber);

      if (!validAccount(line.codigoCuenta)) {
        errors.push(`Cuenta contable inválida: ${line.codigoCuenta}.`);
      }

      if (isNegative(debeLine) || isNegative(haberLine)) {
        errors.push("Ningún valor del asiento puede ser negativo.");
      }

      if (!isZero(debeLine) && !isZero(haberLine)) {
        errors.push("Un movimiento no puede tener Debe y Haber simultáneamente.");
      }
    });

    return errors;
  }
}
