import type { AccountingEventType } from "./accounting-event";
import type { RequiredAccountRole } from "./account-role";

export type JournalLine = {
  cuentaId?: string;
  codigo: string;
  cuenta: string;
  descripcion: string;
  debe: number;
  haber: number;
  orden: number;
  role?: RequiredAccountRole;
};

export type JournalEntry = {
  idTemporal?: string;
  accountingEventId?: string;
  tipoEvento?: AccountingEventType;
  numero: number;
  fecha: string;
  fechaDate?: Date;
  glosa: string;
  descripcion: string;
  documentoOrigen: string;
  hojaOrigen: string;
  filaOrigen: number;
  lineas: JournalLine[];
  totalDebe: number;
  totalHaber: number;
  valido: boolean;
  errores: string[];
};
