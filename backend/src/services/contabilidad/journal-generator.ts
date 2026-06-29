import type { JournalGeneratorContract } from "./interfaces";
import type { AccountingRuleResult, JournalEntry } from "./types";

export class JournalGenerator implements JournalGeneratorContract {
  generate(ruleResults: AccountingRuleResult[]): JournalEntry[] {
    return ruleResults.map((ruleResult, index) => {
      const numero = index + 1;
      const movimientos = ruleResult.lines.map((line) => ({
        cuenta: line.accountCode,
        codigoCuenta: line.accountCode,
        nombreCuenta: line.accountName,
        descripcion: line.description,
        debe: line.side === "DEBE" ? line.amount : "0.00",
        haber: line.side === "HABER" ? line.amount : "0.00",
      }));

      return {
        id: `${String(numero).padStart(6, "0")}-${ruleResult.document.id}`,
        numero,
        fecha: ruleResult.document.fecha,
        descripcion: ruleResult.description,
        documentoOrigen: ruleResult.document.numeroDocumento,
        trazabilidad: {
          hoja: ruleResult.document.hoja,
          fila: ruleResult.document.fila,
          numeroDocumento: ruleResult.document.numeroDocumento,
          fecha: ruleResult.document.fecha,
          ruc: ruleResult.document.ruc,
          tipoDocumento: ruleResult.document.tipoDocumento,
          reglaContable: ruleResult.ruleId,
        },
        movimientos,
        lineas: movimientos,
      };
    });
  }
}
