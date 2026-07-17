import type { AccountingEvent } from "./accounting-event";
import type { ResolvedAccount } from "./account-role";
import type { JournalEntry } from "./journal-entry";
import type { ValidationIssue } from "./validation-issue";

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
  persistible: boolean;
  periodo: {
    id: string;
    anio: number;
    mes: string;
    estado: string;
  };
  asientos: JournalEntry[];
  eventos: AccountingEvent[];
  pendientesClasificacion?: AccountingEvent[];
  cuentasResueltas?: ResolvedAccount[];
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
};
