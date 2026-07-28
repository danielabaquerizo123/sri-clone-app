import { decimal, MONEY_ZERO, money } from "./libro-mayor-saldos.service";
import type { LibroMayorFolio, LibroMayorRawMovement, LibroMayorValidationIssue, LibroMayorValidationResponse } from "./libro-mayor.types";

export class LibroMayorValidacionService {
  validateLines(lines: LibroMayorRawMovement[]): LibroMayorValidationIssue[] {
    const issues: LibroMayorValidationIssue[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const debe = decimal(line.debe);
      const haber = decimal(line.haber);

      if (seen.has(line.lineaId)) {
        issues.push({ tipo: "ERROR", lineaId: line.lineaId, mensaje: "Línea contable duplicada en el conjunto filtrado." });
      }
      seen.add(line.lineaId);

      if (!line.cuentaId || !line.codigoCuenta) {
        issues.push({ tipo: "ERROR", lineaId: line.lineaId, mensaje: "La línea contable no tiene cuenta válida." });
      }
      if (debe.greaterThan(MONEY_ZERO) && haber.greaterThan(MONEY_ZERO)) {
        issues.push({ tipo: "ERROR", lineaId: line.lineaId, mensaje: "La línea tiene Debe y Haber mayores que cero." });
      }
      if (debe.equals(MONEY_ZERO) && haber.equals(MONEY_ZERO)) {
        issues.push({ tipo: "ERROR", lineaId: line.lineaId, mensaje: "La línea tiene Debe y Haber en cero." });
      }
      if (debe.lessThan(MONEY_ZERO) || haber.lessThan(MONEY_ZERO)) {
        issues.push({ tipo: "ERROR", lineaId: line.lineaId, mensaje: "La línea contiene valores negativos." });
      }
    }

    return issues;
  }

  validateAgainstJournal(lines: LibroMayorRawMovement[], folios: LibroMayorFolio[]): LibroMayorValidationResponse {
    const issues = this.validateLines(lines);
    const linesByAccount = new Map<string, LibroMayorRawMovement[]>();
    const foliosByAccount = new Map<string, LibroMayorFolio>();

    for (const line of lines) {
      const accountLines = linesByAccount.get(line.codigoCuenta) || [];
      accountLines.push(line);
      linesByAccount.set(line.codigoCuenta, accountLines);
    }
    for (const folio of folios) {
      if (foliosByAccount.has(folio.codigoCuenta)) {
        issues.push({ tipo: "ERROR", cuentaId: folio.cuentaId, mensaje: "La cuenta tiene más de un folio en el Libro Mayor." });
      }
      foliosByAccount.set(folio.codigoCuenta, folio);
    }

    for (const [codigoCuenta, accountLines] of linesByAccount) {
      const folio = foliosByAccount.get(codigoCuenta);
      if (!folio) {
        issues.push({ tipo: "ERROR", mensaje: `La cuenta ${codigoCuenta} del Libro Diario no tiene folio en el Mayor.` });
        continue;
      }

      const expectedIds = new Set(accountLines.map((line) => line.lineaId));
      const actualIds = new Set(folio.movimientos.map((movement) => movement.lineaId));
      if (folio.movimientos.length !== accountLines.length || actualIds.size !== folio.movimientos.length || expectedIds.size !== actualIds.size || [...expectedIds].some((id) => !actualIds.has(id))) {
        issues.push({ tipo: "ERROR", cuentaId: folio.cuentaId, mensaje: "La cantidad de movimientos del Mayor no coincide con las líneas del Diario." });
      }

      for (const movement of folio.movimientos) {
        const source = accountLines.find((line) => line.lineaId === movement.lineaId);
        if (!source || movement.numeroAsiento !== String(source.numeroAsiento)) {
          issues.push({ tipo: "ERROR", cuentaId: folio.cuentaId, lineaId: movement.lineaId, mensaje: "El Mayor contiene una línea o número de asiento inexistente en el Diario." });
        }
      }

      const totalDebeDiario = accountLines.reduce((sum, line) => sum.plus(decimal(line.debe)), MONEY_ZERO);
      const totalHaberDiario = accountLines.reduce((sum, line) => sum.plus(decimal(line.haber)), MONEY_ZERO);
      if (!decimal(folio.totalDebe).equals(totalDebeDiario)) {
        issues.push({ tipo: "ERROR", cuentaId: folio.cuentaId, mensaje: "El total Debe del folio no coincide con el Libro Diario." });
      }
      if (!decimal(folio.totalHaber).equals(totalHaberDiario)) {
        issues.push({ tipo: "ERROR", cuentaId: folio.cuentaId, mensaje: "El total Haber del folio no coincide con el Libro Diario." });
      }
      if (!decimal(folio.saldoFinal).equals(totalDebeDiario.minus(totalHaberDiario))) {
        issues.push({ tipo: "ERROR", cuentaId: folio.cuentaId, mensaje: "El saldo final del folio no equivale a Debe menos Haber." });
      }
    }

    for (const folio of folios) {
      if (!linesByAccount.has(folio.codigoCuenta)) {
        issues.push({ tipo: "ERROR", cuentaId: folio.cuentaId, mensaje: "El Libro Mayor contiene un folio sin líneas en el Diario." });
      }
    }

    const debeDiario = lines.reduce((sum, line) => sum.plus(decimal(line.debe)), MONEY_ZERO);
    const haberDiario = lines.reduce((sum, line) => sum.plus(decimal(line.haber)), MONEY_ZERO);
    const debeMayor = folios.reduce((sum, folio) => sum.plus(decimal(folio.totalDebe)), MONEY_ZERO);
    const haberMayor = folios.reduce((sum, folio) => sum.plus(decimal(folio.totalHaber)), MONEY_ZERO);
    const diferenciaDebe = debeMayor.minus(debeDiario);
    const diferenciaHaber = haberMayor.minus(haberDiario);

    if (!diferenciaDebe.equals(MONEY_ZERO)) {
      issues.push({ tipo: "ERROR", mensaje: "El total Debe del Mayor no coincide con el Libro Diario filtrado." });
    }
    if (!diferenciaHaber.equals(MONEY_ZERO)) {
      issues.push({ tipo: "ERROR", mensaje: "El total Haber del Mayor no coincide con el Libro Diario filtrado." });
    }

    return {
      valido: issues.every((issue) => issue.tipo !== "ERROR"),
      issues,
      resumenGlobal: {
        totalDebeDiario: money(debeDiario),
        totalHaberDiario: money(haberDiario),
        totalDebeMayor: money(debeMayor),
        totalHaberMayor: money(haberMayor),
        diferenciaDebe: money(diferenciaDebe),
        diferenciaHaber: money(diferenciaHaber),
        totalMovimientos: lines.length,
      },
    };
  }
}
