import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AccountingEngine, ExcelLibroDiarioService, JournalPersistenceService, JournalPreviewService } from "../services/contabilidad/motor-contable";
import { LibroMayorService } from "../services/contabilidad/06-reportes/libro-mayor/libro-mayor.service";
import { LibroMayorExportExcelService } from "../services/contabilidad/06-reportes/libro-mayor/libro-mayor-export-excel.service";
import { LibroMayorExportPdfService } from "../services/contabilidad/06-reportes/libro-mayor/libro-mayor-export-pdf.service";
import { AccountingExcelExporter } from "../services/contabilidad/06-reportes/excel-exportador";

function buildErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isValidationErrorWithDetails(error: unknown): error is Error & {
  errores: unknown[];
  warnings?: unknown[];
} {
  return error instanceof Error && Array.isArray((error as any).errores);
}

function toMoneyNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? Number(numberValue.toFixed(2)) : 0;
}

function numberQuery(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function booleanQuery(value: unknown) {
  return value === true || value === "true" || value === "1" || value === "SI";
}

function libroMayorParams(req: Request) {
  return {
    ruc: req.params.ruc,
    periodoId: typeof req.query.periodoId === "string" ? req.query.periodoId : undefined,
    fechaDesde: typeof req.query.fechaDesde === "string" ? req.query.fechaDesde : undefined,
    fechaHasta: typeof req.query.fechaHasta === "string" ? req.query.fechaHasta : undefined,
    cuentaDesde: typeof req.query.cuentaDesde === "string" ? req.query.cuentaDesde : undefined,
    cuentaHasta: typeof req.query.cuentaHasta === "string" ? req.query.cuentaHasta : undefined,
    cuentaId: typeof req.query.cuentaId === "string" ? req.query.cuentaId : undefined,
    busqueda: typeof req.query.busqueda === "string" ? req.query.busqueda : undefined,
    incluirSaldoAnterior: booleanQuery(req.query.incluirSaldoAnterior),
    incluirCuentasSinMovimiento: booleanQuery(req.query.incluirCuentasSinMovimiento),
    page: numberQuery(req.query.page),
    limit: numberQuery(req.query.limit),
  };
}

function previewBody(req: Request) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  return (body as any).preview || body;
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

export const procesarAtsContabilidad = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Debe subir un archivo ATS en formato Excel." });
    }

    const engine = new AccountingEngine();
    const result = await engine.process(req.file.buffer, req.file.originalname);

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

export const procesarExcelLibroDiario = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Debe subir un archivo Excel ATS." });
    }

    const service = new ExcelLibroDiarioService();
    const result = await service.processAsync(req.file.buffer, req.file.originalname);

    return res.status(200).json({
      ...result,
      resumen: {
        ...result.resumen,
        ruc: result.resumen.ruc || "",
        razonSocial: result.resumen.razonSocial || "No disponible",
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error generando Libro Diario desde Excel ATS.",
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
    if (isValidationErrorWithDetails(error)) {
      return res.status(400).json({
        message: error.message,
        errores: error.errores,
        warnings: error.warnings || [],
      });
    }

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

export const exportarLibroDiarioPreviewExcel = async (req: Request, res: Response) => {
  try {
    const preview = previewBody(req) as any;
    const asientos = Array.isArray(preview?.libroDiario)
      ? preview.libroDiario
      : Array.isArray(preview?.asientos)
        ? preview.asientos
        : [];
    const libroMayor = new LibroMayorService().generarDesdePreview(
      {
        ...preview,
        asientos,
      },
      {
        page: 1,
        limit: Number.MAX_SAFE_INTEGER,
      }
    );
    const buffer = new AccountingExcelExporter().exportReporteContable({
      ruc: preview?.resumen?.ruc || preview?.ruc || "",
      razonSocial: preview?.resumen?.razonSocial || preview?.razonSocial,
      periodo: preview?.resumen?.periodo || preview?.periodo,
      asientos,
      libroMayor,
      warnings: Array.isArray(preview?.warnings)
        ? preview.warnings.map((warning: any) => String(warning?.mensaje || warning)).filter(Boolean)
        : [],
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Reporte_Contable_${req.params.ruc}.xlsx"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (error) {
    return res.status(500).json({
      message: "Error exportando Libro Diario preview a Excel.",
      error: buildErrorMessage(error),
    });
  }
};

export const consultarLibroMayor = async (req: Request, res: Response) => {
  try {
    const result = await new LibroMayorService().generar(libroMayorParams(req));
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      message: "Error consultando Libro Mayor.",
      error: buildErrorMessage(error),
    });
  }
};

export const consultarLibroMayorPreview = async (req: Request, res: Response) => {
  try {
    const result = new LibroMayorService().generarDesdePreview(previewBody(req), libroMayorParams(req));
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      message: "Error generando Libro Mayor desde preview.",
      error: buildErrorMessage(error),
    });
  }
};

export const consultarFolioLibroMayor = async (req: Request, res: Response) => {
  try {
    const result = await new LibroMayorService().generarFolio({
      ...libroMayorParams(req),
      cuentaId: req.params.cuentaId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      message: "Error consultando folio de Libro Mayor.",
      error: buildErrorMessage(error),
    });
  }
};

export const validarLibroMayor = async (req: Request, res: Response) => {
  try {
    const result = await new LibroMayorService().validar(libroMayorParams(req));
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      message: "Error validando Libro Mayor.",
      error: buildErrorMessage(error),
    });
  }
};

export const exportarLibroMayorExcel = async (req: Request, res: Response) => {
  try {
    const result = await new LibroMayorService().generar({
      ...libroMayorParams(req),
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
    });
    const buffer = new LibroMayorExportExcelService().export(result);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="libro-mayor-${req.params.ruc}.xlsx"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (error) {
    return res.status(500).json({
      message: "Error exportando Libro Mayor a Excel.",
      error: buildErrorMessage(error),
    });
  }
};

export const exportarLibroMayorPreviewExcel = async (req: Request, res: Response) => {
  try {
    const result = new LibroMayorService().generarDesdePreview(previewBody(req), {
      ...libroMayorParams(req),
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
    });
    const buffer = new LibroMayorExportExcelService().export(result);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="libro-mayor-borrador-${req.params.ruc}.xlsx"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (error) {
    return res.status(500).json({
      message: "Error exportando Libro Mayor preview a Excel.",
      error: buildErrorMessage(error),
    });
  }
};

export const exportarLibroMayorPdf = async (req: Request, res: Response) => {
  try {
    const result = await new LibroMayorService().generar({
      ...libroMayorParams(req),
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
    });
    const buffer = await new LibroMayorExportPdfService().export(result);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="libro-mayor-${req.params.ruc}.pdf"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (error) {
    return res.status(500).json({
      message: "Error exportando Libro Mayor a PDF.",
      error: buildErrorMessage(error),
    });
  }
};

export const exportarLibroMayorPreviewPdf = async (req: Request, res: Response) => {
  try {
    const result = new LibroMayorService().generarDesdePreview(previewBody(req), {
      ...libroMayorParams(req),
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
    });
    const buffer = await new LibroMayorExportPdfService().export(result);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="libro-mayor-borrador-${req.params.ruc}.pdf"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (error) {
    return res.status(500).json({
      message: "Error exportando Libro Mayor preview a PDF.",
      error: buildErrorMessage(error),
    });
  }
};
