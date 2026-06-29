import { readAtsWorkbook, type AtsWorkbookData } from "../ats/excel-reader";
import { normalizeAtsWorkbook } from "../ats/normalizer";
import { validateAtsForXml } from "../ats/validator";
import { ATSAdapter } from "./ats-adapter";
import type {
  AccountingEngineContract,
  AccountingLogger,
  IncomeStatementGeneratorContract,
  JournalGeneratorContract,
  LedgerGeneratorContract,
  TrialBalanceGeneratorContract,
} from "./interfaces";
import { IncomeStatementGenerator } from "./income-statement-generator";
import { JournalGenerator } from "./journal-generator";
import { LedgerGenerator } from "./ledger-generator";
import { InMemoryAccountingLogger } from "./logger";
import { TrialBalanceGenerator } from "./trial-balance-generator";
import type {
  AccountingEngineResult,
  AccountingPeriod,
  AccountingProcessStatus,
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
    private readonly journalGenerator: JournalGeneratorContract = new JournalGenerator(),
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

      const libroDiario = this.journalGenerator.generate(accountingInput);
      const libroMayor = this.ledgerGenerator.generate(libroDiario);
      const balanceComprobacion = this.trialBalanceGenerator.generate(libroMayor);
      const estadoResultados = this.incomeStatementGenerator.generate(balanceComprobacion);
      const issues = [...accountingInput.atsIssues, ...accountingInput.validationIssues];
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
