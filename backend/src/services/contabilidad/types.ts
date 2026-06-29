import type { AtsIssue, AtsNormalizedData } from "../ats/normalizer";
import type { AtsValidationIssue } from "../ats/validator";

export type DecimalString = string;

export type AccountingPeriod = {
  anio: number;
  mes: string;
};

export type AccountingProcessStatus = "VALIDO" | "CON_OBSERVACIONES" | "INVALIDO";

export type AccountingAtsDocument = {
  source: "COMPRA" | "VENTA";
  filaExcel?: number;
  identificacion: string;
  razonSocial: string;
  tipoComprobante: string;
  numeroDocumento?: string;
  totalDocumento: DecimalString;
};

export type AccountingAtsInput = {
  empresa: string;
  ruc: string;
  periodo: AccountingPeriod;
  compras: AccountingAtsDocument[];
  ventas: AccountingAtsDocument[];
  atsIssues: AtsIssue[];
  validationIssues: AtsValidationIssue[];
  normalized: AtsNormalizedData;
};

export type AccountingSummary = {
  empresa: string;
  ruc: string;
  periodo: string;
  compras: number;
  ventas: number;
  gastos: number;
  estado: AccountingProcessStatus;
};

export type JournalEntry = {
  id: string;
  fecha: string;
  descripcion: string;
  lineas: JournalEntryLine[];
};

export type JournalEntryLine = {
  cuenta: string;
  descripcion: string;
  debe: DecimalString;
  haber: DecimalString;
};

export type LedgerAccount = {
  cuenta: string;
  descripcion: string;
  movimientos: JournalEntryLine[];
};

export type TrialBalanceRow = {
  cuenta: string;
  descripcion: string;
  debe: DecimalString;
  haber: DecimalString;
  saldo: DecimalString;
};

export type IncomeStatementRow = {
  cuenta: string;
  descripcion: string;
  valor: DecimalString;
};

export type AccountingEngineResult = {
  resumen: AccountingSummary;
  libroDiario: JournalEntry[];
  libroMayor: LedgerAccount[];
  balanceComprobacion: TrialBalanceRow[];
  estadoResultados: IncomeStatementRow[];
  issues: Array<AtsIssue | AtsValidationIssue>;
};

export type AccountingLogEntry = {
  factura?: string;
  fila?: number;
  hoja?: string;
  mensaje: string;
  fecha: string;
  proceso: string;
};
