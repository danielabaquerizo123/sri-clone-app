import { prisma as defaultPrisma } from "../../../lib/prisma";
import {
  JournalPreviewService,
  type JournalPreviewResult,
  type PreviewEntry,
} from "../04-asientos/preview-asientos.service";

type DbClient = typeof defaultPrisma;

export type JournalPersistenceErrorType =
  | "PREVIEW_NO_PERSISTIBLE"
  | "PENDIENTE_CLASIFICACION"
  | "PERIODO_CERRADO"
  | "CUENTA_INVALIDA"
  | "ASIENTO_DESCUADRADO"
  | "LINEA_INVALIDA"
  | "DUPLICADO_INTERNO"
  | "ERROR_BASE";

export type JournalPersistenceError = {
  tipo: JournalPersistenceErrorType;
  mensaje: string;
  hojaOrigen?: string;
  filaOrigen?: number;
  documentoOrigen?: string;
};

export class JournalPersistenceValidationError extends Error {
  constructor(public readonly errores: JournalPersistenceError[]) {
    super("El preview contable no es persistible.");
    this.name = "JournalPersistenceValidationError";
  }
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function entryKey(entry: Pick<PreviewEntry, "hojaOrigen" | "filaOrigen" | "documentoOrigen">) {
  return [entry.hojaOrigen || "", entry.filaOrigen || 0, entry.documentoOrigen || ""].join("|");
}

export function validatePreviewIsPersistible(preview: JournalPreviewResult): JournalPersistenceError[] {
  const errors: JournalPersistenceError[] = [];

  if (!preview.persistible) {
    errors.push({ tipo: "PREVIEW_NO_PERSISTIBLE", mensaje: "El preview no es persistible." });
  }
  for (const error of preview.errors || []) {
    errors.push({
      tipo: "PREVIEW_NO_PERSISTIBLE",
      mensaje: error.mensaje,
      hojaOrigen: error.hoja,
      filaOrigen: error.fila,
      documentoOrigen: error.documentoOrigen,
    });
  }
  for (const pending of preview.pendientesClasificacion || []) {
    errors.push({
      tipo: "PENDIENTE_CLASIFICACION",
      mensaje: `Documento pendiente de clasificación: ${pending.categoria}.`,
      hojaOrigen: pending.hojaOrigen,
      filaOrigen: pending.filaOrigen,
      documentoOrigen: pending.documentoOrigen,
    });
  }
  if (preview.periodo?.estado === "CERRADO") {
    errors.push({ tipo: "PERIODO_CERRADO", mensaje: "El periodo contable está cerrado." });
  }

  return errors;
}

export function validatePreviewEntries(entries: PreviewEntry[], accountsById: Map<string, any>): JournalPersistenceError[] {
  const errors: JournalPersistenceError[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const key = entryKey(entry);
    if (seen.has(key)) {
      errors.push({
        tipo: "DUPLICADO_INTERNO",
        mensaje: "El preview contiene documentos duplicados dentro del mismo lote.",
        hojaOrigen: entry.hojaOrigen,
        filaOrigen: entry.filaOrigen,
        documentoOrigen: entry.documentoOrigen,
      });
    }
    seen.add(key);

    if (entry.lineas.length < 2) {
      errors.push({
        tipo: "LINEA_INVALIDA",
        mensaje: "El asiento debe tener al menos dos líneas.",
        hojaOrigen: entry.hojaOrigen,
        filaOrigen: entry.filaOrigen,
        documentoOrigen: entry.documentoOrigen,
      });
    }

    for (const line of entry.lineas) {
      const account = line.cuentaId ? accountsById.get(line.cuentaId) : null;
      if (!account) {
        errors.push({
          tipo: "CUENTA_INVALIDA",
          mensaje: `La cuenta ${line.codigo || line.cuentaId || "SIN_CUENTA"} no existe.`,
          hojaOrigen: entry.hojaOrigen,
          filaOrigen: entry.filaOrigen,
          documentoOrigen: entry.documentoOrigen,
        });
      } else if (account.activa === false) {
        errors.push({
          tipo: "CUENTA_INVALIDA",
          mensaje: `La cuenta ${account.codigo || line.codigo} está inactiva.`,
          hojaOrigen: entry.hojaOrigen,
          filaOrigen: entry.filaOrigen,
          documentoOrigen: entry.documentoOrigen,
        });
      } else if (account.movimiento === false) {
        errors.push({
          tipo: "CUENTA_INVALIDA",
          mensaje: `La cuenta ${account.codigo || line.codigo} es agrupadora y no permite movimientos.`,
          hojaOrigen: entry.hojaOrigen,
          filaOrigen: entry.filaOrigen,
          documentoOrigen: entry.documentoOrigen,
        });
      }

      if (line.debe > 0 && line.haber > 0) {
        errors.push({
          tipo: "LINEA_INVALIDA",
          mensaje: "Una línea no puede tener Debe y Haber simultáneamente.",
          hojaOrigen: entry.hojaOrigen,
          filaOrigen: entry.filaOrigen,
          documentoOrigen: entry.documentoOrigen,
        });
      }
      if (line.debe === 0 && line.haber === 0) {
        errors.push({
          tipo: "LINEA_INVALIDA",
          mensaje: "Una línea no puede tener Debe y Haber en cero.",
          hojaOrigen: entry.hojaOrigen,
          filaOrigen: entry.filaOrigen,
          documentoOrigen: entry.documentoOrigen,
        });
      }
    }

    const totalDebe = money(entry.lineas.reduce((total, line) => total + line.debe, 0));
    const totalHaber = money(entry.lineas.reduce((total, line) => total + line.haber, 0));
    if (totalDebe !== totalHaber || money(entry.totalDebe) !== money(entry.totalHaber)) {
      errors.push({
        tipo: "ASIENTO_DESCUADRADO",
        mensaje: "El total Debe no coincide con el total Haber.",
        hojaOrigen: entry.hojaOrigen,
        filaOrigen: entry.filaOrigen,
        documentoOrigen: entry.documentoOrigen,
      });
    }
  }

  return errors;
}

export class JournalPersistenceService {
  constructor(
    private readonly previewService: Pick<JournalPreviewService, "buildFromAtsLote"> = new JournalPreviewService(),
    private readonly db: DbClient = defaultPrisma
  ) {}

  async saveFromAtsLote(params: { ruc: string; loteId: string; estado?: string }) {
    const preview = await this.previewService.buildFromAtsLote(params.ruc, params.loteId);
    const preErrors = validatePreviewIsPersistible(preview);
    if (preErrors.length > 0) {
      throw new JournalPersistenceValidationError(preErrors);
    }
    const contribuyente = await (this.db as any).contribuyente.findUnique({ where: { ruc: params.ruc } });
    if (!contribuyente) {
      throw new JournalPersistenceValidationError([
        {
          tipo: "PREVIEW_NO_PERSISTIBLE",
          mensaje: "Contribuyente no encontrado para persistir el Libro Diario.",
        },
      ]);
    }

    const accountIds = [...new Set(preview.asientos.flatMap((entry) => entry.lineas.map((line) => line.cuentaId).filter(Boolean)))];
    const accounts = await (this.db as any).cuentaContable.findMany({ where: { id: { in: accountIds } } });
    const entryErrors = validatePreviewEntries(preview.asientos, new Map(accounts.map((account: any) => [account.id, account])));
    if (entryErrors.length > 0) {
      throw new JournalPersistenceValidationError(entryErrors);
    }

    const existing = await (this.db as any).asientoContable.findMany({
      where: {
        contribuyenteId: contribuyente.id,
        atsLoteId: preview.resumen.loteId,
        OR: preview.asientos.map((entry) => ({
          hojaOrigen: entry.hojaOrigen,
          filaOrigen: entry.filaOrigen,
          documentoOrigen: entry.documentoOrigen,
        })),
      },
    });
    const existingKeys = new Set(existing.map((item: any) => entryKey(item)));
    const toCreate = preview.asientos.filter((entry) => !existingKeys.has(entryKey(entry)));
    const omitted = preview.asientos.length - toCreate.length;
    let current: PreviewEntry | undefined;

    try {
      const created = await (this.db as any).$transaction(
        async (tx: any) => {
          const saved = [];
          for (const entry of toCreate) {
            current = entry;
            saved.push(
              await tx.asientoContable.create({
                data: {
                  contribuyenteId: contribuyente.id,
                  periodoId: preview.periodo.id,
                  atsLoteId: preview.resumen.loteId,
                  numero: entry.numero,
                  fecha: entry.fechaDate || new Date(entry.fecha),
                  descripcion: entry.descripcion,
                  documentoOrigen: entry.documentoOrigen,
                  hojaOrigen: entry.hojaOrigen,
                  filaOrigen: entry.filaOrigen,
                  estado: params.estado === "APROBADO" ? "APROBADO" : "BORRADOR",
                  lineas: {
                    create: entry.lineas.map((line) => ({
                      cuentaId: line.cuentaId,
                      descripcion: line.descripcion,
                      debe: line.debe,
                      haber: line.haber,
                      orden: line.orden,
                    })),
                  },
                },
              })
            );
          }
          return saved;
        },
        { maxWait: 5000, timeout: 20000 }
      );

      return {
        persistidos: created.length,
        omitidosDuplicados: omitted,
        fallidos: 0,
        asientos: created,
        errores: [],
        warnings: omitted > 0 ? [`${omitted} asiento(s) omitido(s) por duplicado.`] : [],
      };
    } catch (error) {
      return {
        persistidos: 0,
        omitidosDuplicados: omitted,
        fallidos: 1,
        asientos: [],
        errores: [
          {
            tipo: "ERROR_BASE",
            mensaje: error instanceof Error ? error.message : "Error de base al persistir asientos.",
            hojaOrigen: current?.hojaOrigen,
            filaOrigen: current?.filaOrigen,
            documentoOrigen: current?.documentoOrigen,
          },
        ],
        warnings: [],
      };
    }
  }
}
