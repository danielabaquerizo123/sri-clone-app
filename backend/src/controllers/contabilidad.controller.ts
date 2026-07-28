import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AccountingConfigurationError, AccountingEngine, ExcelLibroDiarioService, JournalPersistenceService, JournalPreviewService } from "../services/contabilidad/motor-contable";
import { LibroMayorService } from "../services/contabilidad/06-reportes/libro-mayor/libro-mayor.service";
import { LibroMayorExportExcelService } from "../services/contabilidad/06-reportes/libro-mayor/libro-mayor-export-excel.service";
import { LibroMayorExportPdfService } from "../services/contabilidad/06-reportes/libro-mayor/libro-mayor-export-pdf.service";
import { AccountingExcelExporter } from "../services/contabilidad/06-reportes/excel-exportador";
import { BalanceComprobacionService } from "../services/contabilidad/06-reportes/balance-comprobacion.generator";
import { EstadoResultadosService, RESULTADO_CATEGORIAS } from "../services/contabilidad/06-reportes/estado-resultados.generator";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";

function buildErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isValidationErrorWithDetails(error: unknown): error is Error & {
  errores: unknown[];
  warnings?: unknown[];
} {
  return error instanceof Error && Array.isArray((error as any).errores);
}

function isAccountingConfigurationError(error: unknown): error is AccountingConfigurationError {
  return error instanceof AccountingConfigurationError || (error instanceof Error && (error as any).code === "CONFIGURACION_CONTABLE_INCOMPLETA");
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
    loteId: typeof req.query.loteId === "string" ? req.query.loteId : undefined,
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
    if (isAccountingConfigurationError(error)) {
      return res.status(422).json({
        code: error.code,
        message: error.message,
      });
    }

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
    if (isAccountingConfigurationError(error)) {
      return res.status(422).json({
        code: error.code,
        message: error.message,
      });
    }

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

export const listarClasificacionesEstadoResultados = async (req: Request, res: Response) => {
  try {
    await findContribuyenteOrFail(req.params.ruc);
    const clasificaciones = await prisma.clasificacionEstadoResultados.findMany({
      include: { cuenta: true },
      orderBy: { cuenta: { codigo: "asc" } },
    });
    return res.status(200).json({ clasificaciones, categorias: RESULTADO_CATEGORIAS });
  } catch (error) {
    return res.status(500).json({ message: "Error consultando clasificaciones de Estado de Resultados.", error: buildErrorMessage(error) });
  }
};

export const guardarClasificacionEstadoResultados = async (req: Request, res: Response) => {
  try {
    await findContribuyenteOrFail(req.params.ruc);
    const cuentaId = typeof req.body?.cuentaId === "string" ? req.body.cuentaId : "";
    const categoria = typeof req.body?.categoria === "string" ? req.body.categoria : "";
    const activa = typeof req.body?.activa === "boolean" ? req.body.activa : true;
    if (!cuentaId || !RESULTADO_CATEGORIAS.includes(categoria as any)) {
      return res.status(400).json({ message: "Cuenta y categoría de Estado de Resultados son obligatorias." });
    }
    const cuenta = await prisma.cuentaContable.findUnique({ where: { id: cuentaId } });
    if (!cuenta) return res.status(404).json({ message: "Cuenta contable no encontrada." });
    const clasificacion = await prisma.clasificacionEstadoResultados.upsert({
      where: { cuentaId },
      create: { cuentaId, categoria: categoria as any, activa },
      update: { categoria: categoria as any, activa },
      include: { cuenta: true },
    });
    return res.status(200).json(clasificacion);
  } catch (error) {
    return res.status(500).json({ message: "Error guardando clasificación de Estado de Resultados.", error: buildErrorMessage(error) });
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

export const consultarBalanceComprobacion = async (req: Request, res: Response) => {
  try {
    const result = await new BalanceComprobacionService().generar(libroMayorParams(req));
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      message: "Error consultando Balance de Comprobación.",
      error: buildErrorMessage(error),
    });
  }
};

export const consultarBalanceComprobacionPreview = async (req: Request, res: Response) => {
  try {
    const result = new BalanceComprobacionService().generarDesdePreview(previewBody(req), libroMayorParams(req));
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      message: "Error generando Balance de Comprobación desde preview.",
      error: buildErrorMessage(error),
    });
  }
};

export const consultarEstadoResultados = async (req: Request, res: Response) => {
  try {
    return res.status(200).json(await new EstadoResultadosService().generar(libroMayorParams(req)));
  } catch (error) {
    return res.status(500).json({ message: "Error consultando Estado de Resultados.", error: buildErrorMessage(error) });
  }
};

export const consultarEstadoResultadosPreview = async (req: Request, res: Response) => {
  try {
    return res.status(200).json(await new EstadoResultadosService().generarDesdePreview(previewBody(req), libroMayorParams(req)));
  } catch (error) {
    return res.status(500).json({ message: "Error consultando Estado de Resultados.", error: buildErrorMessage(error) });
  }
};

export const exportarProcesosContablesPreviewExcel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.contribuyenteAuth?.ruc !== req.params.ruc) {
      return res.status(403).json({ message: "No tiene acceso al contribuyente solicitado." });
    }
    const preview = previewBody(req) as any;
    const previewRuc = String(preview?.resumen?.ruc || preview?.ruc || "");
    if (previewRuc && previewRuc !== req.params.ruc) {
      return res.status(403).json({ message: "El Libro Diario no corresponde al contribuyente solicitado." });
    }
    const asientos = Array.isArray(preview?.libroDiario) ? preview.libroDiario : Array.isArray(preview?.asientos) ? preview.asientos : [];
    if (asientos.length === 0) return res.status(422).json({ message: "No existen procesos contables para exportar." });

    const libroMayor = new LibroMayorService().generarDesdePreview({ ...preview, asientos }, { page: 1, limit: Number.MAX_SAFE_INTEGER });
    if (libroMayor.folios.length === 0) return res.status(422).json({ message: "No se pudo generar el Libro Mayor para la exportación." });
    const balance = new BalanceComprobacionService().generarDesdeLibroMayor(libroMayor);
    const estadoResultados = await new EstadoResultadosService().generarDesdeBalance(balance);
    const periodo = String(preview?.resumen?.periodo || [libroMayor.periodo.anio, libroMayor.periodo.mes].filter(Boolean).join("-"));
    const filenamePeriod = periodo.replace(/[^0-9-]/g, "") || "periodo";
    const filenameRuc = req.params.ruc.replace(/[^0-9]/g, "");
    const buffer = new AccountingExcelExporter().exportProcesosContables({
      ruc: req.params.ruc,
      razonSocial: preview?.resumen?.razonSocial || libroMayor.empresa.razonSocial,
      periodo,
      asientos,
      libroMayor,
      balanceComprobacion: balance,
      estadoResultados,
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Procesos_Contables_${filenameRuc}_${filenamePeriod}.xlsx"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (error) {
    return res.status(500).json({ message: "No se pudo generar el archivo Excel. Intente nuevamente.", error: buildErrorMessage(error) });
  }
};

export const exportarBalanceComprobacionExcel = async (req: Request, res: Response) => {
  try {
    const result = await new BalanceComprobacionService().generar({
      ...libroMayorParams(req),
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
    });
    const buffer = new AccountingExcelExporter().exportBalanceComprobacion(result);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="balance-comprobacion-${req.params.ruc}.xlsx"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (error) {
    return res.status(500).json({
      message: "Error exportando Balance de Comprobación a Excel.",
      error: buildErrorMessage(error),
    });
  }
};

export const exportarBalanceComprobacionPreviewExcel = async (req: Request, res: Response) => {
  try {
    const result = new BalanceComprobacionService().generarDesdePreview(previewBody(req), {
      ...libroMayorParams(req),
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
    });
    const buffer = new AccountingExcelExporter().exportBalanceComprobacion(result);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="balance-comprobacion-borrador-${req.params.ruc}.xlsx"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (error) {
    return res.status(500).json({
      message: "Error exportando Balance de Comprobación preview a Excel.",
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
