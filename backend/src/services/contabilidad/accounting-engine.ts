import { readAtsWorkbook, type AtsWorkbookData } from "../ats/excel-reader";
import { normalizeAtsWorkbook } from "../ats/normalizer";
import { validateAtsForXml } from "../ats/validator";
import { AccountingRules } from "./accounting-rules";
import { ATSAdapter } from "./ats-adapter";
import { DocumentAnalyzer } from "./document-analyzer";
import type {
  AccountingJournalValidatorContract,
  AccountingRulesEngineContract,
  DocumentAnalyzerContract,
  AccountingEngineContract,
  AccountingLogger,
  IncomeStatementGeneratorContract,
  JournalGeneratorContract,
  LedgerGeneratorContract,
  TrialBalanceGeneratorContract,
} from "./interfaces";
import { IncomeStatementGenerator } from "./income-statement-generator";
import { JournalGenerator } from "./journal-generator";
import { AccountingJournalValidator } from "./journal-validator";
import { LedgerGenerator } from "./ledger-generator";
import { InMemoryAccountingLogger } from "./logger";
import { TrialBalanceGenerator } from "./trial-balance-generator";
import type {
  AccountingValidationError,
  AccountingEngineResult,
  AccountingPeriod,
  AccountingProcessStatus,
  JournalEntry,
  JournalVisualRow,
} from "./types";
import { requireExcelBuffer, requireOriginalFilename } from "./validators";

function getPeriodoFromWorkbook(workbookData: AtsWorkbookData, filename: string): AccountingPeriod {
  let anio = workbookData.informante.anio || 0;
  let mes = "00";
  const upperFilename = filename.toUpperCase();
  const fileMonth = upperFilename.match(/\b(0[1-9]|1[0-2])\b/);
  const fileYear = upperFilename.match(/\b(20\d{2})\b/);

  if (!anio && fileYear) {
    anio = Number(fileYear[1]);
  }

  if (fileMonth) {
    mes = fileMonth[1];
  }

  const rows = [
    ...(workbookData.ventas?.rows || []),
    ...(workbookData.compras?.rows || []),
  ];

  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = String(key)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const text = String(value ?? "").trim();

      if (normalizedKey.includes("mes declarado") && /^(0?[1-9]|1[0-2])$/.test(text)) {
        mes = text.padStart(2, "0");
      }

      if (normalizedKey.includes("periodo declarado")) {
        const match = text.match(/(0[1-9]|1[0-2])[\/-](20\d{2})/);
        if (match) {
          mes = match[1];
          anio = Number(match[2]);
        }
      }
    }
  }

  return { anio, mes };
}

function buildStatus(errorCount: number, issueCount: number): AccountingProcessStatus {
  if (errorCount > 0) return "INVALIDO";
  if (issueCount > 0) return "CON_OBSERVACIONES";
  return "VALIDO";
}

export class AccountingEngine implements AccountingEngineContract {
  constructor(
    private readonly logger: AccountingLogger = new InMemoryAccountingLogger(),
    private readonly documentAnalyzer: DocumentAnalyzerContract = new DocumentAnalyzer(),
    private readonly rulesEngine: AccountingRulesEngineContract = new AccountingRules(),
    private readonly journalGenerator: JournalGeneratorContract = new JournalGenerator(),
    private readonly journalValidator: AccountingJournalValidatorContract = new AccountingJournalValidator(),
    private readonly ledgerGenerator: LedgerGeneratorContract = new LedgerGenerator(),
    private readonly trialBalanceGenerator: TrialBalanceGeneratorContract = new TrialBalanceGenerator(),
    private readonly incomeStatementGenerator: IncomeStatementGeneratorContract = new IncomeStatementGenerator()
  ) {}

  process(buffer: Buffer, originalFilename: string): AccountingEngineResult {
    const safeBuffer = requireExcelBuffer(buffer);
    const safeFilename = requireOriginalFilename(originalFilename);

    try {
      this.logger.info({
        proceso: "CONTABILIDAD_ATS",
        mensaje: "Inicio de procesamiento ATS para Contabilidad.",
        fecha: "SIN_FECHA_SISTEMA",
      });

      const workbookData = readAtsWorkbook(safeBuffer);
      const normalized = normalizeAtsWorkbook(workbookData);
      const periodo = getPeriodoFromWorkbook(workbookData, safeFilename);
      const validation = validateAtsForXml({
        rucInformante: normalized.informante.rucInformante,
        razonSocial: normalized.informante.razonSocialInformante,
        anio: periodo.anio,
        mes: periodo.mes,
        compras: normalized.compras,
        ventas: normalized.ventas,
        anulados: normalized.anulados,
      });
      const accountingInput = new ATSAdapter(
        normalized,
        validation.issues,
        periodo
      ).adapt();

      const documents = this.documentAnalyzer.analyze(accountingInput);
      const ruleResults = this.rulesEngine.resolve(documents);
      const ruleDocumentIds = new Set(ruleResults.map((result) => result.document.id));
      const missingRuleIssues: AccountingValidationError[] = documents
        .filter((document) => !ruleDocumentIds.has(document.id))
        .map((document) => ({
          tipo: "ERROR",
          hoja: document.hoja,
          fila: document.fila,
          campo: "reglaContable",
          mensaje: `No existe una regla contable definida para el comprobante ${document.tipoDocumento}.`,
        }));
      const candidateJournal = this.journalGenerator.generate(ruleResults);
      const journalValidationIssues: AccountingValidationError[] = [];
      const libroDiario = candidateJournal.filter((entry) => {
        const errors = this.journalValidator.validate(entry);

        if (errors.length === 0) {
          return true;
        }

        errors.forEach((message) => {
          journalValidationIssues.push({
            tipo: "ERROR",
            hoja: entry.trazabilidad.hoja,
            fila: entry.trazabilidad.fila,
            campo: "asiento",
            mensaje: `${entry.documentoOrigen}: ${message}`,
          });
        });

        return false;
      });
      const libroDiarioFilas = buildJournalRows(libroDiario);
      const libroMayor = this.ledgerGenerator.generate(libroDiario);
      const balanceComprobacion = this.trialBalanceGenerator.generate(libroMayor);
      const estadoResultados = this.incomeStatementGenerator.generate(balanceComprobacion);
      const issues = [
        ...accountingInput.atsIssues,
        ...accountingInput.validationIssues,
        ...missingRuleIssues,
        ...journalValidationIssues,
      ];
      const errorCount = issues.filter((issue) => issue.tipo === "ERROR").length;
      const status = buildStatus(errorCount, issues.length);

      this.logger.info({
        proceso: "CONTABILIDAD_ATS",
        mensaje: "ATS normalizado y adaptado correctamente para Contabilidad.",
        fecha: "SIN_FECHA_SISTEMA",
      });

      return {
        resumen: {
          empresa: accountingInput.empresa,
          ruc: accountingInput.ruc,
          periodo: `${periodo.mes}/${periodo.anio || "SIN_ANIO"}`,
          compras: accountingInput.compras.length,
          ventas: accountingInput.ventas.length,
          gastos: 0,
          estado: status,
        },
        libroDiario,
        libroDiarioFilas,
        libroMayor,
        balanceComprobacion,
        estadoResultados,
        issues,
      };
    } catch (error) {
      this.logger.error({
        proceso: "CONTABILIDAD_ATS",
        mensaje: error instanceof Error ? error.message : String(error),
        fecha: "SIN_FECHA_SISTEMA",
      });

      throw error;
    }
  }
}

function buildJournalRows(entries: JournalEntry[]): JournalVisualRow[] {
  return entries.flatMap((entry) =>
    entry.movimientos.map((line) => ({
      asiento: entry.numero,
      fecha: entry.fecha,
      codigoCuenta: line.codigoCuenta,
      nombreCuenta: line.nombreCuenta,
      descripcion: line.descripcion,
      debe: line.debe === "0.00" ? "" : line.debe,
      haber: line.haber === "0.00" ? "" : line.haber,
    }))
  );
}
