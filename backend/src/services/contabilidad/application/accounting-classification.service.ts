import { prisma as defaultPrisma } from "../../../lib/prisma";

export type AccountingClassificationConfidence = "ALTA" | "MEDIA" | "BAJA";

export type AccountingClassificationOrigin =
  | "REGLA_PROVEEDOR"
  | "REGLA_ACTIVIDAD"
  | "REGLA_CONCEPTO"
  | "REGLA_SUSTENTO"
  | "REGLA_GENERAL"
  | "SIN_CLASIFICACION";

export type AccountingClassificationDocument = {
  hojaOrigen: "COMPRAS" | "VENTAS" | "GASTOS" | string;
  rucTercero?: string | null;
  razonSocial?: string | null;
  actividadEconomica?: string | null;
  concepto?: string | null;
  codigoSustento?: string | null;
  tipoComprobante?: string | null;
  tarifaIva?: number | string | null;
  codigoRetencion?: string | null;
  formaPago?: string | null;
  esNotaCredito?: boolean | null;
  esNotaDebito?: boolean | null;
  palabrasClave?: string[];
};

export type AccountingClassificationResult = {
  categoria: string;
  cuentaSugeridaCodigo?: string;
  reglaSugeridaId?: string;
  confianza: AccountingClassificationConfidence;
  origen: AccountingClassificationOrigin;
  requiereRevision: boolean;
  motivos: string[];
  evidencias: string[];
};

type TemporaryRule = {
  id: string;
  categoria: string;
  cuentaSugeridaCodigo?: string;
  reglaSugeridaId?: string;
  confianza: AccountingClassificationConfidence;
  origen: Exclude<AccountingClassificationOrigin, "SIN_CLASIFICACION">;
  requiereRevision?: boolean;
  motivos?: string[];
  match: (context: ClassificationContext) => boolean;
};

type KnownProviderConfig = {
  id: string;
  ruc: string;
  razonSocial?: string;
  actividadEconomica?: string;
  categoria: string;
  cuentaSugeridaCodigo?: string;
  reglaSugeridaId?: string;
  confianza: AccountingClassificationConfidence;
  origen: Exclude<AccountingClassificationOrigin, "SIN_CLASIFICACION">;
  requiereRevision?: boolean;
  motivos?: string[];
};

export type AccountingClassificationConfig = {
  reglasContablesExistentes?: AccountingRuleHint[];
  reglasEvidencia?: ClassificationEvidenceRule[];
  clasificacionesConfirmadas?: ClassificationEvidenceRule[];
  reglasProveedor?: TemporaryRule[];
  reglasActividad?: TemporaryRule[];
  reglasConcepto?: TemporaryRule[];
  reglasSustento?: TemporaryRule[];
  reglasGenerales?: TemporaryRule[];
};

/**
 * Regla declarativa inyectable. No contiene proveedores ni cuentas: la cuenta
 * se resuelve posteriormente desde la regla contable configurada.
 */
export type ClassificationEvidenceRule = {
  id: string;
  categoria: string;
  palabrasClave?: string[];
  actividades?: string[];
  codigosSustento?: string[];
  tiposComprobante?: string[];
  reglaContableCodigo?: string;
  prioridad?: number;
  confirmada?: boolean;
};

export const CLASSIFICATION_SCORES = {
  reglaConfigurada: 100,
  clasificacionConfirmada: 95,
  concepto: 80,
  actividad: 45,
  sustento: 30,
  comprobante: 10,
  ivaORetencion: 5,
  alta: 75,
  media: 45,
} as const;

export type AccountingRuleHint = {
  id?: string;
  codigo: string;
  descripcion: string;
  tipoOperacion: "COMPRA" | "VENTA" | "GASTO" | string;
  tipoComprobante?: string | null;
  codigoSustento?: string | null;
  tarifaIva?: number | string | null;
  formaPago?: string | null;
  activa?: boolean | null;
  prioridad?: number | null;
};

type ClassificationContext = AccountingClassificationDocument & {
  hoja: string;
  ruc: string;
  razon: string;
  actividad: string;
  conceptoNormalizado: string;
  codigoSustentoNormalizado: string;
  tipoComprobanteNormalizado: string;
  formaPagoNormalizada: string;
  codigoRetencionNormalizado: string;
  textoBusqueda: string;
};

type DbClient = typeof defaultPrisma;

type StoredClassificationConditions = {
  origen?: Exclude<AccountingClassificationOrigin, "SIN_CLASIFICACION">;
  confianza?: AccountingClassificationConfidence;
  requiereRevision?: boolean;
  hojas?: string[];
  palabrasClave?: string[];
  actividades?: string[];
  codigosSustento?: string[];
  tiposComprobante?: string[];
  motivos?: string[];
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeForMatch(value: unknown): string {
  return normalizeText(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function onlyDigits(value: unknown): string {
  return normalizeText(value).replace(/\D/g, "");
}

function normalizeCode(value: unknown, length?: number): string {
  const digits = onlyDigits(value);
  if (!digits) return "";
  return length ? digits.padStart(length, "0").slice(0, length) : digits;
}

function containsAny(text: string, words: string[]) {
  return words.some((word) => text.includes(normalizeForMatch(word)));
}

function isPurchase(context: ClassificationContext) {
  return context.hoja === "COMPRAS" || context.hoja === "GASTOS";
}

function isSale(context: ClassificationContext) {
  return context.hoja === "VENTAS";
}

function isCreditNote(context: ClassificationContext) {
  return Boolean(context.esNotaCredito) || context.tipoComprobanteNormalizado === "04";
}

function isDebitNote(context: ClassificationContext) {
  return Boolean(context.esNotaDebito) || context.tipoComprobanteNormalizado === "05";
}

function makeContext(document: AccountingClassificationDocument): ClassificationContext {
  const palabrasClave = (document.palabrasClave || []).map(normalizeForMatch).filter(Boolean);
  const hoja = normalizeForMatch(document.hojaOrigen);
  const ruc = onlyDigits(document.rucTercero);
  const razon = normalizeForMatch(document.razonSocial);
  const actividad = normalizeForMatch(document.actividadEconomica);
  const conceptoNormalizado = normalizeForMatch(document.concepto);
  const codigoSustentoNormalizado = normalizeCode(document.codigoSustento);
  const tipoComprobanteNormalizado = normalizeCode(document.tipoComprobante, 2);
  const formaPagoNormalizada = normalizeCode(document.formaPago);
  const codigoRetencionNormalizado = normalizeCode(document.codigoRetencion);

  return {
    ...document,
    hoja,
    ruc,
    razon,
    actividad,
    conceptoNormalizado,
    codigoSustentoNormalizado,
    tipoComprobanteNormalizado,
    formaPagoNormalizada,
    codigoRetencionNormalizado,
    textoBusqueda: [
      razon,
      actividad,
      conceptoNormalizado,
      codigoSustentoNormalizado,
      tipoComprobanteNormalizado,
      formaPagoNormalizada,
      codigoRetencionNormalizado,
      ...palabrasClave,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function noClassification(motivos: string[]): AccountingClassificationResult {
  return {
    categoria: "SIN_CLASIFICACION",
    confianza: "BAJA",
    origen: "SIN_CLASIFICACION",
    requiereRevision: true,
    motivos,
    evidencias: [],
  };
}

function confidenceScore(confidence: AccountingClassificationConfidence) {
  if (confidence === "ALTA") return 3;
  if (confidence === "MEDIA") return 2;
  return 1;
}

function originScore(origin: AccountingClassificationOrigin) {
  if (origin === "REGLA_PROVEEDOR") return 5;
  if (origin === "REGLA_ACTIVIDAD") return 4;
  if (origin === "REGLA_CONCEPTO") return 3;
  if (origin === "REGLA_SUSTENTO") return 2;
  if (origin === "REGLA_GENERAL") return 1;
  return 0;
}

function chooseBestRule(rules: TemporaryRule[]) {
  return [...rules].sort((left, right) => {
    const confidence = confidenceScore(right.confianza) - confidenceScore(left.confianza);
    if (confidence !== 0) return confidence;
    return originScore(right.origen) - originScore(left.origen);
  })[0];
}

function ruleEvidence(rule: TemporaryRule) {
  return `${rule.origen}: ${rule.categoria}`;
}

function applyRule(rule: TemporaryRule, matchedRules: TemporaryRule[] = [rule]): AccountingClassificationResult {
  const hasLowConfidenceEvidence = matchedRules.some((item) => item.confianza === "BAJA");
  const hasHighConfidenceEvidence = matchedRules.some((item) => item.confianza === "ALTA");
  const confianza =
    rule.confianza === "MEDIA" && hasHighConfidenceEvidence
      ? "ALTA"
      : rule.confianza === "ALTA" && hasLowConfidenceEvidence
        ? "MEDIA"
        : rule.confianza;
  const motivos = [
    ...(rule.motivos || [`Clasificado por ${rule.origen}.`]),
    ...matchedRules
      .filter((item) => item.id !== rule.id)
      .flatMap((item) => item.motivos || [`Evidencia adicional por ${item.origen}.`]),
  ];

  return {
    categoria: rule.categoria,
    cuentaSugeridaCodigo: rule.cuentaSugeridaCodigo,
    reglaSugeridaId: rule.reglaSugeridaId,
    confianza,
    origen: rule.origen,
    requiereRevision:
      rule.requiereRevision ?? (confianza !== "ALTA" || matchedRules.some((item) => item.requiereRevision)),
    motivos: [...new Set(motivos)],
    evidencias: [...new Set(matchedRules.map(ruleEvidence))],
  };
}

function findRule(rules: TemporaryRule[], context: ClassificationContext) {
  return rules.find((rule) => rule.match(context));
}

function sameOptional(ruleValue: unknown, documentValue: unknown) {
  const ruleText = normalizeText(ruleValue);
  if (!ruleText) return true;
  const documentText = normalizeText(documentValue);
  if (!documentText) return false;
  return normalizeForMatch(ruleText) === normalizeForMatch(documentText);
}

function sameCodeOptional(ruleValue: unknown, documentValue: unknown, length?: number) {
  const ruleCode = normalizeCode(ruleValue, length);
  if (!ruleCode) return true;
  const documentCode = normalizeCode(documentValue, length);
  if (!documentCode) return false;
  return ruleCode === documentCode;
}

function sameTarifaOptional(ruleValue: unknown, documentValue: unknown) {
  const ruleText = normalizeText(ruleValue);
  if (!ruleText) return true;
  const documentText = normalizeText(documentValue);
  if (!documentText) return false;
  return Number(ruleText).toFixed(2) === Number(documentText).toFixed(2);
}

function operationFromContext(context: ClassificationContext) {
  if (context.hoja === "VENTAS") return "VENTA";
  if (context.hoja === "GASTOS") return "GASTO";
  return "COMPRA";
}

function matchExistingAccountingRule(
  reglas: AccountingRuleHint[],
  context: ClassificationContext
): AccountingRuleHint | undefined {
  const operation = operationFromContext(context);

  return reglas
    .filter((rule) => rule.activa !== false)
    .filter((rule) => normalizeForMatch(rule.tipoOperacion) === operation)
    .filter((rule) => sameCodeOptional(rule.tipoComprobante, context.tipoComprobanteNormalizado, 2))
    .filter((rule) => sameCodeOptional(rule.codigoSustento, context.codigoSustentoNormalizado))
    .filter((rule) => sameOptional(rule.formaPago, context.formaPagoNormalizada))
    .filter((rule) => sameTarifaOptional(rule.tarifaIva, context.tarifaIva))
    .sort((left, right) => (left.prioridad ?? 100) - (right.prioridad ?? 100))[0];
}

function resultFromExistingAccountingRule(rule: AccountingRuleHint): AccountingClassificationResult {
  const hasSpecificSupport = Boolean(
    normalizeCode(rule.codigoSustento) || normalizeText(rule.tarifaIva) || normalizeText(rule.formaPago)
  );

  return {
    categoria: normalizeForMatch(rule.descripcion).replace(/\s+/g, "_") || "REGLA_CONTABLE_EXISTENTE",
    reglaSugeridaId: rule.codigo || rule.id,
    confianza: hasSpecificSupport ? "ALTA" : "BAJA",
    origen: hasSpecificSupport ? "REGLA_SUSTENTO" : "REGLA_GENERAL",
    requiereRevision: !hasSpecificSupport,
    motivos: [
      `Coincide con la regla contable existente ${rule.codigo}.`,
      "La regla existente sugiere el tratamiento contable final, pero esta capa aun no valida equivalencias de cuenta.",
    ],
    evidencias: [`REGLA_CONTABLE_EXISTENTE: ${rule.codigo}`],
  };
}

type StoredRuleRecord = {
  codigo: string;
  categoria: string;
  tipoOperacion: string;
  prioridad: number;
  activa: boolean;
  condiciones: unknown;
  descripcion?: string | null;
};

function asConditions(value: unknown): StoredClassificationConditions {
  return value && typeof value === "object" ? (value as StoredClassificationConditions) : {};
}

function operationMatches(rule: StoredRuleRecord, context: ClassificationContext) {
  return normalizeForMatch(rule.tipoOperacion) === operationFromContext(context);
}

function listMatches(text: string, values: string[] = []) {
  return values.length > 0 && containsAny(text, values);
}

function storedRuleMatches(rule: StoredRuleRecord, context: ClassificationContext) {
  const conditions = asConditions(rule.condiciones);
  if (!operationMatches(rule, context)) return false;
  if ((conditions.hojas || []).length > 0 && !(conditions.hojas || []).map(normalizeForMatch).includes(context.hoja)) return false;

  const checks = [
    listMatches(context.conceptoNormalizado, conditions.palabrasClave),
    listMatches(context.actividad, conditions.actividades),
    (conditions.codigosSustento || []).some((value) => normalizeCode(value) === context.codigoSustentoNormalizado),
    (conditions.tiposComprobante || []).some((value) => normalizeCode(value, 2) === context.tipoComprobanteNormalizado),
  ];

  return checks.some(Boolean);
}

function temporaryRuleFromStored(rule: StoredRuleRecord): TemporaryRule {
  const conditions = asConditions(rule.condiciones);
  return {
    id: rule.codigo,
    categoria: rule.categoria,
    confianza: conditions.confianza || "BAJA",
    origen: conditions.origen || "REGLA_GENERAL",
    requiereRevision: conditions.requiereRevision,
    motivos: conditions.motivos || [rule.descripcion || "Clasificado por regla configurable en base."],
    match: (context) => storedRuleMatches(rule, context),
  };
}

export async function loadClassificationConfigFromPrisma(db: DbClient = defaultPrisma): Promise<AccountingClassificationConfig> {
  const records = await db.reglaClasificacionContable.findMany({
    where: { activa: true },
    orderBy: [{ prioridad: "asc" }, { codigo: "asc" }],
  });
  return {
    reglasGenerales: records.map((record) =>
      temporaryRuleFromStored({
        codigo: record.codigo,
        categoria: record.categoria,
        tipoOperacion: record.tipoOperacion,
        prioridad: record.prioridad,
        activa: record.activa,
        condiciones: record.condiciones,
        descripcion: record.descripcion,
      })
    ),
  };
}

export class AccountingClassificationService {
  private readonly config: Required<AccountingClassificationConfig>;

  constructor(config: AccountingClassificationConfig = {}) {
    this.config = {
      reglasContablesExistentes: config.reglasContablesExistentes || [],
      reglasEvidencia: config.reglasEvidencia || [],
      clasificacionesConfirmadas: config.clasificacionesConfirmadas || [],
      reglasProveedor: config.reglasProveedor || [],
      reglasActividad: config.reglasActividad || [],
      reglasConcepto: config.reglasConcepto || [],
      reglasSustento: config.reglasSustento || [],
      reglasGenerales: config.reglasGenerales || [],
    };
  }

  classify(document: AccountingClassificationDocument): AccountingClassificationResult {
    const context = makeContext(document);
    const accountingRule = matchExistingAccountingRule(
      this.config.reglasContablesExistentes,
      context
    );
    // Una regla contable específica configurada prevalece sobre inferencias.
    if (accountingRule && (accountingRule.codigoSustento || accountingRule.tarifaIva || accountingRule.formaPago)) {
      return resultFromExistingAccountingRule(accountingRule);
    }
    const matchedRules = [
      ...this.config.reglasProveedor.filter((rule) => rule.match(context)),
      ...this.config.reglasActividad.filter((rule) => rule.match(context)),
      ...this.config.reglasConcepto.filter((rule) => rule.match(context)),
      ...this.config.reglasSustento.filter((rule) => rule.match(context)),
      ...this.config.reglasGenerales.filter((rule) => rule.match(context)),
    ];
    const ferreteriaPendiente = matchedRules.find((rule) => rule.id === "ACTIVIDAD_FERRETERIA_REVISION");
    if (ferreteriaPendiente && !context.conceptoNormalizado) {
      return applyRule(ferreteriaPendiente, [ferreteriaPendiente]);
    }

    const bestRule = chooseBestRule(matchedRules);

    if (bestRule) {
      return applyRule(bestRule, matchedRules);
    }

    if (accountingRule) {
      return resultFromExistingAccountingRule(accountingRule);
    }

    const motivos = [
      "No existe una regla temporal suficientemente precisa para clasificar este documento.",
    ];

    if (!context.ruc) motivos.push("El documento no incluye RUC/identificacion del tercero.");
    if (!context.conceptoNormalizado) motivos.push("El documento no incluye concepto util para clasificacion.");
    if (!context.codigoSustentoNormalizado && isPurchase(context)) {
      motivos.push("El documento no incluye codigo de sustento util para clasificacion.");
    }

    return noClassification(motivos);
  }
}

export function classifyAccountingDocument(
  document: AccountingClassificationDocument,
  config?: AccountingClassificationConfig
): AccountingClassificationResult {
  return new AccountingClassificationService(config).classify(document);
}
