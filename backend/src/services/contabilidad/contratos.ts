export type AccountingClassificationConfidence = "ALTA" | "MEDIA" | "BAJA";

export type AccountingClassificationOrigin =
  | "REGLA_PROVEEDOR"
  | "REGLA_ACTIVIDAD"
  | "REGLA_CONCEPTO"
  | "REGLA_SUSTENTO"
  | "REGLA_GENERAL"
  | "SIN_CLASIFICACION";

export type AccountingClassification = {
  categoria: string;
  categoriaBase?: string | null;
  destinoContable?: string | null;
  confianzaCategoria?: AccountingClassificationConfidence;
  confianzaDestino?: AccountingClassificationConfidence;
  requiereDecisionDestino?: boolean;
  alternativasDestino?: string[];
  cuentaSugeridaCodigo?: string;
  reglaSugeridaId?: string;
  confianza: AccountingClassificationConfidence;
  origen: AccountingClassificationOrigin;
  requiereRevision: boolean;
  motivos: string[];
  evidencias: string[];
};

export const SIN_CLASIFICACION: AccountingClassification = {
  categoria: "SIN_CLASIFICACION",
  categoriaBase: null,
  destinoContable: null,
  confianzaCategoria: "BAJA",
  confianzaDestino: "BAJA",
  requiereDecisionDestino: false,
  alternativasDestino: [],
  confianza: "BAJA",
  origen: "SIN_CLASIFICACION",
  requiereRevision: true,
  motivos: ["Documento pendiente de clasificacion contable."],
  evidencias: [],
};

export type RequiredAccountRole =
  | "GASTO_COSTO_ACTIVO"
  | "IVA_CREDITO_TRIBUTARIO"
  | "CUENTAS_POR_PAGAR_PROVEEDORES"
  | "RETENCION_FUENTE_POR_PAGAR"
  | "RETENCION_IVA_POR_PAGAR"
  | "INGRESO"
  | "INGRESO_VENTAS"
  | "IVA_POR_PAGAR"
  | "CUENTAS_POR_COBRAR_CLIENTES"
  | "RETENCION_FUENTE_POR_COBRAR"
  | "RETENCION_IVA_POR_COBRAR"
  | "CUENTA_FINANCIERA";

export type AccountCandidate = {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  movimiento: boolean;
  tipo?: string | null;
  naturaleza?: string | null;
};

export type AccountResolutionOrigin =
  | "REGLA_CONTABLE"
  | "MAPEO_TEMPORAL"
  | "CLASIFICACION"
  | "SIN_RESOLVER";

export type ResolvedAccount = {
  role: RequiredAccountRole;
  resolved: boolean;
  cuenta?: AccountCandidate;
  origen: AccountResolutionOrigin;
  confianza: "ALTA" | "MEDIA" | "BAJA";
  requiereRevision: boolean;
  motivos: string[];
};

export type AccountingDocumentSource = "COMPRAS" | "VENTAS" | "GASTOS";
export type AccountingOperationType = "COMPRA" | "VENTA" | "GASTO";

export type AccountingDocumentEvidence = {
  campo: string;
  valor: string | number | boolean | null;
  origen: AccountingDocumentSource | string;
  descripcion: string;
};

export type AccountingRetentionSource = {
  codigo?: string | null;
  base: number;
  porcentaje?: number | null;
  valor: number;
};

export type AccountingRetentionIva = {
  porcentaje: number;
  valor: number;
};

export type AccountingRetentionData = {
  tipoEmision?: string | null;
  establecimiento?: string | null;
  puntoEmision?: string | null;
  secuencial?: string | null;
  autorizacion?: string | null;
  fechaEmision?: Date | null;
  retencionesFuente: AccountingRetentionSource[];
  retencionesIva: AccountingRetentionIva[];
  totalRetenidoFuente: number;
  totalRetenidoIva: number;
};

export type PaymentEvidence = {
  tipoPago?: string | null;
  formaPago1?: string | null;
  formaPago2?: string | null;
};

export type CollectionEvidence = {
  formaCobro1?: string | null;
  formaCobro2?: string | null;
};

export type AccountingDocument = {
  hojaOrigen: AccountingDocumentSource;
  filaOrigen: number;
  documentoOrigen: string;
  fechaEmision: Date;
  fechaRegistro?: Date | null;
  identificacionTercero: string;
  razonSocialTercero: string;
  tipoOperacion: AccountingOperationType;
  tipoComprobante: string | null;
  codigoSustento?: string | null;
  baseNoObjeto?: number;
  baseExenta?: number;
  baseTarifa0?: number;
  baseGravada?: number;
  iva?: number;
  total?: number;
  paymentEvidence?: PaymentEvidence;
  collectionEvidence?: CollectionEvidence;
  datosRetencion?: AccountingRetentionData;
  clasificacion?: AccountingClassification;
  actividadEconomica?: string | null;
  concepto?: string | null;
  documentoModificado?: string | null;
  autorizacionModificada?: string | null;
  evidencias?: AccountingDocumentEvidence[];
  raw?: unknown;
};

export type AccountingEventType =
  | "DEVENGO_COMPRA"
  | "DEVENGO_VENTA"
  | "PAGO_PROVEEDOR"
  | "COBRO_CLIENTE"
  | "RETENCION_EMITIDA"
  | "RETENCION_RECIBIDA"
  | "NOTA_CREDITO_COMPRA"
  | "NOTA_CREDITO_VENTA"
  | "NOTA_DEBITO_COMPRA"
  | "NOTA_DEBITO_VENTA";

export type AccountingEventStatus =
  | "GENERABLE"
  | "PENDIENTE_EVIDENCIA"
  | "PENDIENTE_CLASIFICACION"
  | "NO_APLICA";

export type AccountingEvidence = AccountingDocumentEvidence;

export type AccountingEventAmounts = {
  base: number;
  iva: number;
  totalDocumento: number;
  retencionFuente: number;
  retencionIva: number;
  netoPagadoOCobrado: number;
  saldoPendiente: number;
};

export type AccountingEvent = {
  idTemporal: string;
  tipo: AccountingEventType;
  estado: AccountingEventStatus;
  fecha: Date;
  fechaRetencion?: Date | null;
  hojaOrigen: string;
  filaOrigen: number;
  documentoOrigen: string;
  tercero: { identificacion: string; razonSocial: string };
  montos: AccountingEventAmounts;
  rolesRequeridos: RequiredAccountRole[];
  clasificacion?: AccountingClassification;
  evidencias: AccountingEvidence[];
  motivos: string[];
  requiereRevision: boolean;
  eventoRelacionadoId?: string;
};

export type JournalLine = {
  cuentaId?: string;
  codigo: string;
  cuenta: string;
  tipoCuenta?: string | null;
  naturalezaCuenta?: string | null;
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

export type ValidationIssueType = "ERROR" | "WARNING" | "INFO";
export type ValidationIssueSeverity = "CRITICO" | "BLOQUEANTE" | "OBSERVACION" | "INFORMATIVO";

export type ValidationIssue = {
  tipo: ValidationIssueType;
  severidad?: ValidationIssueSeverity;
  codigo?: string;
  hoja?: string;
  fila?: number;
  campo?: string;
  documentoOrigen?: string;
  mensaje: string;
};

export type JournalPreviewResult = {
  resumen: { ruc: string; razonSocial: string; loteId: string; periodo: string; asientosValidos: number; asientosPendientes: number; errores: number };
  persistible: boolean;
  periodo: { id: string; anio: number; mes: string; estado: string };
  asientos: JournalEntry[];
  eventos: AccountingEvent[];
  pendientesClasificacion?: AccountingEvent[];
  cuentasResueltas?: ResolvedAccount[];
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
};

export type DecimalString = string;
export type AccountingPeriod = { anio: number; mes: string };
export type AccountingProcessStatus = "VALIDO" | "CON_OBSERVACIONES" | "INVALIDO";
export type AccountingDocumentKind = "COMPRA" | "VENTA" | "NOTA_CREDITO_COMPRA" | "NOTA_CREDITO_VENTA" | "NOTA_DEBITO_COMPRA" | "NOTA_DEBITO_VENTA" | "LIQUIDACION_COMPRA" | "RETENCION" | "OTRO";
export type AccountingAtsDocument = { source: "COMPRA" | "VENTA"; filaExcel?: number; identificacion: string; razonSocial: string; tipoComprobante: string; numeroDocumento?: string; totalDocumento: DecimalString };
export type AccountingDocumentAnalysis = { id: string; source: "COMPRA" | "VENTA"; kind: AccountingDocumentKind; hoja: string; fila: number; ruc: string; tipoDocumento: string; numeroDocumento: string; fecha: string; base: DecimalString; iva: DecimalString; total: DecimalString; raw: any };
export type AccountingRuleLine = { accountCode: string; accountName: string; side: "DEBE" | "HABER"; amount: DecimalString; description: string };
export type AccountingRuleResult = { ruleId: string; description: string; document: AccountingDocumentAnalysis; lines: AccountingRuleLine[] };
export type AccountingAtsInput = { empresa: string; ruc: string; periodo: AccountingPeriod; compras: AccountingAtsDocument[]; ventas: AccountingAtsDocument[]; atsIssues: unknown[]; validationIssues: unknown[]; normalized: unknown };
export type AccountingSummary = { empresa: string; ruc: string; periodo: string; compras: number; ventas: number; gastos: number; estado: AccountingProcessStatus };
export type JournalVisualRow = { asiento: number; fecha: string; codigoCuenta: string; nombreCuenta: string; descripcion: string; debe: DecimalString; haber: DecimalString };
export type AccountingTraceability = { hoja: string; fila: number; numeroDocumento: string; fecha: string; ruc: string; tipoDocumento: string; reglaContable: string };
export type AccountingValidationError = { tipo: "ERROR"; hoja: string; fila: number; campo: string; mensaje: string };
export type LedgerAccount = { cuenta: string; descripcion: string; movimientos: JournalLine[] };
export type TrialBalanceRow = { cuenta: string; descripcion: string; debe: DecimalString; haber: DecimalString; saldo: DecimalString };
export type IncomeStatementRow = { cuenta: string; descripcion: string; valor: DecimalString };
export type AccountingEngineResult = { resumen: AccountingSummary; libroDiario: JournalEntry[]; libroDiarioFilas: JournalVisualRow[]; libroMayor: LedgerAccount[]; balanceComprobacion: TrialBalanceRow[]; estadoResultados: IncomeStatementRow[]; issues: Array<unknown | AccountingValidationError> };
export type AccountingLogEntry = { factura?: string; fila?: number; hoja?: string; mensaje: string; fecha: string; proceso: string };

export interface AccountingLogger { info(entry: AccountingLogEntry): void; error(entry: AccountingLogEntry): void; list(): AccountingLogEntry[]; }
export interface AtsAdapterContract { adapt(): AccountingAtsInput; }
export interface JournalGeneratorContract { generate(ruleResults: AccountingRuleResult[]): JournalEntry[]; }
export interface DocumentAnalyzerContract { analyze(input: AccountingAtsInput): AccountingDocumentAnalysis[]; }
export interface AccountingRulesEngineContract { resolve(documents: AccountingDocumentAnalysis[]): AccountingRuleResult[]; }
export interface AccountingJournalValidatorContract { validate(entry: JournalEntry): string[]; }
export interface LedgerGeneratorContract { generate(journal: JournalEntry[]): LedgerAccount[]; }
export interface TrialBalanceGeneratorContract { generate(ledger: LedgerAccount[]): TrialBalanceRow[]; }
export interface IncomeStatementGeneratorContract { generate(trialBalance: TrialBalanceRow[]): IncomeStatementRow[]; }
export interface AccountingEngineContract { process(buffer: Buffer, originalFilename: string): AccountingEngineResult; }
export type AccountReadPort = { findActiveAccounts(): Promise<AccountCandidate[]>; findByIds(ids: string[]): Promise<AccountCandidate[]> };
export type AccountingRuleAccountHint = { id?: string; codigo: string; descripcion: string; tipoOperacion: "COMPRA" | "VENTA" | "GASTO" | string; tipoComprobante?: string | null; codigoSustento?: string | null; tarifaIva?: number | string | null; formaPago?: string | null; cuentaBase?: AccountCandidate | null; cuentaIva?: AccountCandidate | null; cuentaContrapartida?: AccountCandidate | null };
export type RuleReadPort = { findActiveRules(): Promise<AccountingRuleAccountHint[]> };
export type AtsReadPort = { readByLoteId(params: { ruc: string; loteId: string }): Promise<AccountingDocument[]> };
export type JournalWritePort = { save(entries: JournalEntry[]): Promise<{ persistidos: number; asientos: unknown[] }> };
export type ClassificationRulePort = { classify(document: AccountingDocument): AccountingClassification };
