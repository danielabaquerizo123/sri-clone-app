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

export type AccountingDocumentKind =
  | "COMPRA"
  | "VENTA"
  | "NOTA_CREDITO_COMPRA"
  | "NOTA_CREDITO_VENTA"
  | "NOTA_DEBITO_COMPRA"
  | "NOTA_DEBITO_VENTA"
  | "LIQUIDACION_COMPRA"
  | "RETENCION"
  | "OTRO";

export type AccountingDocumentAnalysis = {
  id: string;
  source: "COMPRA" | "VENTA";
  kind: AccountingDocumentKind;
  hoja: string;
  fila: number;
  ruc: string;
  tipoDocumento: string;
  numeroDocumento: string;
  fecha: string;
  base: DecimalString;
  iva: DecimalString;
  total: DecimalString;
  raw: any;
};

export type AccountingRuleLine = {
  accountCode: string;
  accountName: string;
  side: "DEBE" | "HABER";
  amount: DecimalString;
  description: string;
};

export type AccountingRuleResult = {
  ruleId: string;
  description: string;
  document: AccountingDocumentAnalysis;
  lines: AccountingRuleLine[];
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
  numero: number;
  fecha: string;
  descripcion: string;
  documentoOrigen: string;
  trazabilidad: AccountingTraceability;
  movimientos: JournalEntryLine[];
  lineas: JournalEntryLine[];
};

export type JournalEntryLine = {
  cuenta: string;
  codigoCuenta: string;
  nombreCuenta: string;
  descripcion: string;
  debe: DecimalString;
  haber: DecimalString;
};

export type JournalVisualRow = {
  asiento: number;
  fecha: string;
  codigoCuenta: string;
  nombreCuenta: string;
  descripcion: string;
  debe: DecimalString;
  haber: DecimalString;
};

export type AccountingTraceability = {
  hoja: string;
  fila: number;
  numeroDocumento: string;
  fecha: string;
  ruc: string;
  tipoDocumento: string;
  reglaContable: string;
};

export type AccountingValidationError = {
  tipo: "ERROR";
  hoja: string;
  fila: number;
  campo: string;
  mensaje: string;
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
  libroDiarioFilas: JournalVisualRow[];
  libroMayor: LedgerAccount[];
  balanceComprobacion: TrialBalanceRow[];
  estadoResultados: IncomeStatementRow[];
  issues: Array<AtsIssue | AtsValidationIssue | AccountingValidationError>;
};

export type AccountingLogEntry = {
  factura?: string;
  fila?: number;
  hoja?: string;
  mensaje: string;
  fecha: string;
  proceso: string;
};
