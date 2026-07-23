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
