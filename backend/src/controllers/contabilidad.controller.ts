import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AccountingEngine } from "../services/contabilidad/accounting-engine";
import { JournalPersistenceService } from "../services/contabilidad/journal-persistence.service";
import { JournalPreviewService } from "../services/contabilidad/journal-preview.service";

function buildErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function toMoneyNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? Number(numberValue.toFixed(2)) : 0;
}

function formatLibroDiarioAsientos(asientos: any[]) {
  return asientos.map((asiento) => ({
    numero: asiento.numero,
    fecha:
      asiento.fecha instanceof Date
        ? asiento.fecha.toISOString().slice(0, 10)
        : String(asiento.fecha || "").slice(0, 10),
    glosa: asiento.descripcion,
    lineas: asiento.lineas.map((linea: any) => ({
      codigo: linea.cuenta.codigo,
      cuenta: linea.cuenta.nombre,
      debe: toMoneyNumber(linea.debe),
      haber: toMoneyNumber(linea.haber),
    })),
  }));
}

async function findContribuyenteOrFail(ruc: string) {
  const contribuyente = await prisma.contribuyente.findUnique({ where: { ruc } });

  if (!contribuyente) {
    throw new Error("Contribuyente no encontrado.");
  }

  return contribuyente;
}

export const procesarAtsContabilidad = (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Debe subir un archivo ATS en formato Excel." });
    }

    const engine = new AccountingEngine();
    const result = engine.process(req.file.buffer, req.file.originalname);

    return res.status(200).json({
      message: "ATS procesado por el módulo Contabilidad.",
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error procesando ATS en Contabilidad.",
      error: buildErrorMessage(error),
    });
  }
};

export const listarPlanCuentas = async (req: Request, res: Response) => {
  try {
    await findContribuyenteOrFail(req.params.ruc);

    const cuentas = await prisma.cuentaContable.findMany({
      orderBy: { codigo: "asc" },
    });

    return res.status(200).json({ cuentas });
  } catch (error) {
    return res.status(500).json({
      message: "Error consultando el plan de cuentas.",
      error: buildErrorMessage(error),
    });
  }
};

export const listarReglasContables = async (req: Request, res: Response) => {
  try {
    await findContribuyenteOrFail(req.params.ruc);

    const reglas = await prisma.reglaContable.findMany({
      include: {
        cuentaBase: true,
        cuentaIva: true,
        cuentaContrapartida: true,
      },
      orderBy: [{ tipoOperacion: "asc" }, { prioridad: "asc" }, { codigo: "asc" }],
    });

    return res.status(200).json({ reglas });
  } catch (error) {
    return res.status(500).json({
      message: "Error consultando reglas contables.",
      error: buildErrorMessage(error),
    });
  }
};

export const previsualizarLibroDiarioDesdeAts = async (req: Request, res: Response) => {
  try {
    const service = new JournalPreviewService();
    const result = await service.buildFromAtsLote(req.params.ruc, req.params.loteId);

    return res.status(200).json({
      message: "Vista previa del Libro Diario generada desde ATS persistido.",
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error generando vista previa del Libro Diario.",
      error: buildErrorMessage(error),
    });
  }
};

export const generarAsientosDesdeAts = async (req: Request, res: Response) => {
  try {
    const service = new JournalPersistenceService();
    const estado = req.body?.estado === "APROBADO" ? "APROBADO" : "BORRADOR";
    const result = await service.saveFromAtsLote({
      ruc: req.params.ruc,
      loteId: req.params.loteId,
      estado,
    });

    return res.status(201).json(result);
  } catch (error) {
    return res.status(500).json({
      message: "Error guardando asientos desde ATS.",
      error: buildErrorMessage(error),
    });
  }
};

export const consultarLibroDiario = async (req: Request, res: Response) => {
  try {
    const contribuyente = await findContribuyenteOrFail(req.params.ruc);
    const anio = req.query.anio ? Number(req.query.anio) : undefined;
    const mes = req.query.mes ? String(req.query.mes).padStart(2, "0") : undefined;

    const asientos = await prisma.asientoContable.findMany({
      where: {
        contribuyenteId: contribuyente.id,
        ...(anio || mes
          ? {
              periodo: {
                ...(anio ? { anio } : {}),
                ...(mes ? { mes } : {}),
              },
            }
          : {}),
      },
      include: {
        periodo: true,
        atsLote: {
          select: {
            id: true,
            nombreArchivo: true,
            anio: true,
            mes: true,
          },
        },
        lineas: {
          include: {
            cuenta: true,
          },
          orderBy: {
            orden: "asc",
          },
        },
      },
      orderBy: [{ fecha: "asc" }, { numero: "asc" }],
    });

    return res.status(200).json({
      ruc: contribuyente.ruc,
      razonSocial: contribuyente.razonSocial,
      filtros: { anio: anio || null, mes: mes || null },
      libroDiario: formatLibroDiarioAsientos(asientos),
      asientos,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error consultando Libro Diario.",
      error: buildErrorMessage(error),
    });
  }
};
