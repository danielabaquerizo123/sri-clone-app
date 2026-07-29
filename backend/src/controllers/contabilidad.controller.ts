import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AccountingConfigurationError, AccountingEngine, ExcelLibroDiarioService, JournalPersistenceService, JournalPreviewService, persistAccountingAtsLoteFromExcel } from "../services/contabilidad/motor-contable";
import { LibroMayorService } from "../services/contabilidad/06-reportes/libro-mayor/libro-mayor.service";
import { LibroMayorExportExcelService } from "../services/contabilidad/06-reportes/libro-mayor/libro-mayor-export-excel.service";
import { LibroMayorExportPdfService } from "../services/contabilidad/06-reportes/libro-mayor/libro-mayor-export-pdf.service";
import { AccountingExcelExporter } from "../services/contabilidad/06-reportes/excel-exportador";
import { BalanceComprobacionService } from "../services/contabilidad/06-reportes/balance-comprobacion.generator";
import { EstadoResultadosService } from "../services/contabilidad/06-reportes/estado-resultados.generator";
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

export const ESTADOS_ATS_EXPORTABLES = ["PROCESADO_VALIDO", "XML_GENERADO"] as const;

export function isAtsLoteExportable(lote: { estado?: string | null } | null | undefined) {
  return Boolean(lote?.estado && (ESTADOS_ATS_EXPORTABLES as readonly string[]).includes(lote.estado));
}

function nombrePeriodoArchivo(mes: string, anio: number) {
  const meses: Record<string, string> = {
    "01": "Enero",
    "02": "Febrero",
    "03": "Marzo",
    "04": "Abril",
    "05": "Mayo",
    "06": "Junio",
    "07": "Julio",
    "08": "Agosto",
    "09": "Septiembre",
    "10": "Octubre",
    "11": "Noviembre",
    "12": "Diciembre",
  };
  const mesNormalizado = String(mes).padStart(2, "0");
  return `${meses[mesNormalizado] || mesNormalizado}_${anio}`;
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

export function exportLoteId(req: Request) {
  const loteId = req.body?.loteId;
  return typeof loteId === "string" && loteId.trim() ? loteId.trim() : null;
}

async function findExportableAtsLoteForResult(rucActivo: string, result: { resumen?: { ruc?: string }; periodo?: { anio?: number | null; mes?: string | null } }) {
  const contribuyente = await prisma.contribuyente.findUnique({ where: { ruc: rucActivo } });
  const rucInformante = String(result.resumen?.ruc || "").trim();
  const anio = Number(result.periodo?.anio);
  const rawMes = String(result.periodo?.mes || "").trim();
  if (!contribuyente || !rucInformante || !Number.isInteger(anio) || !rawMes) return null;
  const mes = rawMes.padStart(2, "0");

  const lotes = await prisma.atsLote.findMany({
    where: {
      rucInformante,
      anio,
      mes,
      estado: { in: [...ESTADOS_ATS_EXPORTABLES] },
    },
    select: {
      id: true,
      contribuyenteId: true,
      rucInformante: true,
      razonSocial: true,
      anio: true,
      mes: true,
      estado: true,
      resumenJSON: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return lotes.find((lote) => {
    if (lote.contribuyenteId === contribuyente.id) return true;
    const resumen = lote.resumenJSON && typeof lote.resumenJSON === "object" ? (lote.resumenJSON as Record<string, any>) : {};
    const acceso = resumen.contribuyenteAcceso && typeof resumen.contribuyenteAcceso === "object" ? resumen.contribuyenteAcceso : {};
    return sameText(acceso.ruc, rucActivo);
  }) || null;
}

function sameText(left: unknown, right: unknown) {
  return String(left || "").trim() === String(right || "").trim();
}

export function validateExportReportContext(params: {
  lote: { id: string; rucInformante: string; razonSocial: string; anio: number; mes: string };
  preview: any;
  libroMayor: any;
  balance: any;
  estadoResultados: any;
}) {
  const { lote, preview, libroMayor, balance, estadoResultados } = params;
  const samePeriod = (periodo: any) => Number(periodo?.anio) === lote.anio && String(periodo?.mes || "").padStart(2, "0") === String(lote.mes).padStart(2, "0");
  const sameCompany = (empresa: any) => sameText(empresa?.ruc, lote.rucInformante) && sameText(empresa?.razonSocial, lote.razonSocial);

  if (
    !sameText(preview?.resumen?.loteId, lote.id) ||
    !sameText(preview?.resumen?.ruc, lote.rucInformante) ||
    !sameText(preview?.resumen?.razonSocial, lote.razonSocial) ||
    !samePeriod(preview?.periodo) ||
    !sameCompany(libroMayor?.empresa) || !samePeriod(libroMayor?.periodo) ||
    !sameCompany(balance?.empresa) || !samePeriod(balance?.periodo) ||
    !sameCompany(estadoResultados?.empresa) || !samePeriod(estadoResultados?.periodo) ||
    balance?.moneda !== "Dólares (USD)" || estadoResultados?.moneda !== "Dólares (USD)"
  ) {
    throw new Error("Los reportes contables seleccionados no pertenecen al mismo lote ATS.");
  }
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
    const lote = await persistAccountingAtsLoteFromExcel({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      rucAcceso: req.params.ruc,
      result,
    }) || await findExportableAtsLoteForResult(req.params.ruc, result);

    return res.status(200).json({
      ...result,
      lote: lote
        ? {
            id: lote.id,
            rucInformante: lote.rucInformante,
            razonSocial: lote.razonSocial,
            anio: lote.anio,
            mes: lote.mes,
            estado: lote.estado,
          }
        : null,
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
    const loteId = exportLoteId(req);
    if (!loteId) return res.status(422).json({ message: "Debe seleccionar un lote ATS procesado para exportar." });
    const lote = await prisma.atsLote.findUnique({ where: { id: loteId } });
    if (!lote) return res.status(404).json({ message: "Lote ATS no encontrado." });
    if (!isAtsLoteExportable(lote)) {
      return res.status(422).json({ message: "El ATS aún no ha completado el procesamiento contable. Genere primero el Libro Diario." });
    }

    // The ATS lot, never the authenticated user, is the accounting identity.
    const preview = await new JournalPreviewService().buildFromAtsLote(lote.rucInformante, lote.id);
    const asientos = preview.asientos;
    if (asientos.length === 0) return res.status(422).json({ message: "No existen procesos contables para exportar." });

    const libroMayor = new LibroMayorService().generarDesdePreview(preview, { page: 1, limit: Number.MAX_SAFE_INTEGER });
    if (libroMayor.folios.length === 0) return res.status(422).json({ message: "No se pudo generar el Libro Mayor para la exportación." });
    const balance = new BalanceComprobacionService().generarDesdeLibroMayor(libroMayor);
    const estadoResultados = await new EstadoResultadosService().generarDesdeBalance(balance);
    validateExportReportContext({ lote, preview, libroMayor, balance, estadoResultados });
    const periodo = `${String(lote.mes).padStart(2, "0")}/${lote.anio}`;
    const filenamePeriod = nombrePeriodoArchivo(lote.mes, lote.anio);
    const buffer = new AccountingExcelExporter().exportProcesosContables({
      ruc: lote.rucInformante,
      razonSocial: lote.razonSocial,
      periodo,
      asientos,
      libroMayor,
      balanceComprobacion: balance,
      estadoResultados,
    });
    await prisma.exportacionContable.create({ data: { loteId: lote.id, ejecutorId: req.contribuyenteAuth!.id } });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Libro_Contable_${filenamePeriod}.xlsx"`);
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
