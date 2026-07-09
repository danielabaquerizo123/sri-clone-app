import { prisma } from "../../lib/prisma";
import { JournalPreviewService, type PreviewEntry } from "./journal-preview.service";

type PersistStatus = "BORRADOR" | "APROBADO";

function duplicateKey(entry: {
  hojaOrigen: string | null;
  filaOrigen: number | null;
  documentoOrigen: string | null;
}) {
  return [entry.hojaOrigen || "", entry.filaOrigen || 0, entry.documentoOrigen || ""].join("|");
}

export class JournalPersistenceService {
  constructor(private readonly previewService = new JournalPreviewService()) {}

  async saveFromAtsLote(params: {
    ruc: string;
    loteId: string;
    estado?: PersistStatus;
  }) {
    const estado = params.estado === "APROBADO" ? "APROBADO" : "BORRADOR";
    const preview = await this.previewService.buildFromAtsLote(params.ruc, params.loteId);

    if (preview.periodo.estado !== "ABIERTO") {
      throw new Error("No se pueden guardar asientos en un período cerrado.");
    }

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { ruc: params.ruc },
    });

    if (!contribuyente) {
      throw new Error("Contribuyente no encontrado.");
    }

    const existing = await prisma.asientoContable.findMany({
      where: {
        contribuyenteId: contribuyente.id,
        atsLoteId: params.loteId,
        estado: {
          not: "ANULADO",
        },
      },
      select: {
        hojaOrigen: true,
        filaOrigen: true,
        documentoOrigen: true,
      },
    });
    const existingKeys = new Set(existing.map(duplicateKey));
    const validEntries = preview.asientos.filter((entry) => entry.valido);
    const entriesToSave = validEntries.filter((entry) => !existingKeys.has(duplicateKey(entry)));

    const saved = await prisma.$transaction(
      entriesToSave.map((entry) =>
        prisma.asientoContable.create({
          data: {
            numero: entry.numero,
            fecha: entry.fechaDate,
            descripcion: entry.glosa,
            estado,
            origen: "ATS",
            documentoOrigen: entry.documentoOrigen,
            hojaOrigen: entry.hojaOrigen,
            filaOrigen: entry.filaOrigen || null,
            reglaCodigo: entry.reglaCodigo,
            contribuyenteId: contribuyente.id,
            periodoId: preview.periodo.id,
            atsLoteId: params.loteId,
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
          include: {
            lineas: {
              include: {
                cuenta: true,
              },
              orderBy: {
                orden: "asc",
              },
            },
          },
        })
      )
    );

    return {
      message: "Asientos generados desde ATS.",
      estado,
      loteId: params.loteId,
      periodo: preview.periodo,
      guardados: saved.length,
      omitidosDuplicados: validEntries.length - entriesToSave.length,
      pendientes: preview.pendientes.length + preview.asientos.filter((entry) => !entry.valido).length,
      asientos: saved,
      issues: preview.issues,
    };
  }
}
