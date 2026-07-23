import type { JournalEntry } from "../contratos";
import type { ValidationIssue } from "../contratos";

export type AccountingJournalValidatorAccount = {
  id?: string;
  codigo: string;
  activa: boolean;
  movimiento: boolean;
};

export type AccountingJournalValidatorOptions = {
  tolerance?: number;
  accounts?: AccountingJournalValidatorAccount[];
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function issue(entry: JournalEntry, codigo: string, mensaje: string, campo?: string): ValidationIssue {
  return {
    tipo: "ERROR",
    severidad: "BLOQUEANTE",
    codigo,
    hoja: entry.hojaOrigen,
    fila: entry.filaOrigen,
    campo,
    documentoOrigen: entry.documentoOrigen,
    mensaje,
  };
}

export class AccountingJournalValidatorService {
  private readonly tolerance: number;
  private readonly accountsById = new Map<string, AccountingJournalValidatorAccount>();
  private readonly accountsByCode = new Map<string, AccountingJournalValidatorAccount>();

  constructor(options: AccountingJournalValidatorOptions = {}) {
    this.tolerance = options.tolerance ?? 0.01;
    for (const account of options.accounts || []) {
      if (account.id) this.accountsById.set(account.id, account);
      this.accountsByCode.set(account.codigo, account);
    }
  }

  validate(entry: JournalEntry): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!entry.hojaOrigen || entry.filaOrigen <= 0 || !entry.documentoOrigen) {
      issues.push(issue(entry, "TRAZABILIDAD_INCOMPLETA", "El asiento no conserva trazabilidad ATS completa."));
    }

    if (entry.lineas.length < 2) {
      issues.push(issue(entry, "ASIENTO_SIN_LINEAS_MINIMAS", "El asiento debe tener al menos dos líneas."));
    }

    for (const line of entry.lineas) {
      const debe = roundMoney(Number(line.debe || 0));
      const haber = roundMoney(Number(line.haber || 0));

      if (debe > 0 && haber > 0) {
        issues.push(issue(entry, "LINEA_DEBE_HABER_SIMULTANEO", "Una línea no puede tener Debe y Haber simultáneamente.", line.codigo));
      }
      if (debe === 0 && haber === 0) {
        issues.push(issue(entry, "LINEA_EN_CERO", "Una línea no puede tener Debe y Haber en cero.", line.codigo));
      }
      if (debe < 0 || haber < 0) {
        issues.push(issue(entry, "LINEA_NEGATIVA", "Los importes de líneas deben ser positivos.", line.codigo));
      }

      const account = (line.cuentaId && this.accountsById.get(line.cuentaId)) || this.accountsByCode.get(line.codigo);
      if (account) {
        if (!account.activa) {
          issues.push(issue(entry, "CUENTA_INACTIVA", `La cuenta ${account.codigo} está inactiva.`, line.codigo));
        }
        if (!account.movimiento) {
          issues.push(issue(entry, "CUENTA_AGRUPADORA", `La cuenta ${account.codigo} es agrupadora y no permite movimientos.`, line.codigo));
        }
      }
    }

    const totalDebeLineas = roundMoney(entry.lineas.reduce((total, line) => total + Number(line.debe || 0), 0));
    const totalHaberLineas = roundMoney(entry.lineas.reduce((total, line) => total + Number(line.haber || 0), 0));
    const totalDebe = roundMoney(entry.totalDebe);
    const totalHaber = roundMoney(entry.totalHaber);

    if (Math.abs(totalDebeLineas - totalHaberLineas) > this.tolerance || Math.abs(totalDebe - totalHaber) > this.tolerance) {
      issues.push(issue(entry, "ASIENTO_DESCUADRADO", "El total Debe no coincide con el total Haber."));
    }
    if (Math.abs(totalDebeLineas - totalDebe) > this.tolerance || Math.abs(totalHaberLineas - totalHaber) > this.tolerance) {
      issues.push(issue(entry, "TOTALES_INCONSISTENTES", "Los totales del asiento no coinciden con la suma de sus líneas."));
    }

    return issues;
  }
}
