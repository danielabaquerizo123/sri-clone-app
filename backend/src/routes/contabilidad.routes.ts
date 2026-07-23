import { Router } from "express";
import multer from "multer";
import {
  consultarLibroDiario,
  consultarFolioLibroMayor,
  consultarLibroMayor,
  consultarLibroMayorPreview,
  exportarLibroDiarioPreviewExcel,
  exportarLibroMayorExcel,
  exportarLibroMayorPdf,
  exportarLibroMayorPreviewExcel,
  exportarLibroMayorPreviewPdf,
  generarAsientosDesdeAts,
  listarPlanCuentas,
  listarReglasContables,
  previsualizarLibroDiarioDesdeAts,
  procesarAtsContabilidad,
  procesarExcelLibroDiario,
  validarLibroMayor,
} from "../controllers/contabilidad.controller";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

router.get("/:ruc/plan-cuentas", listarPlanCuentas);
router.get("/:ruc/reglas", listarReglasContables);
router.post("/:ruc/ats/:loteId/previsualizar", previsualizarLibroDiarioDesdeAts);
router.post("/:ruc/ats/:loteId/generar-asientos", generarAsientosDesdeAts);
router.get("/:ruc/libro-diario", consultarLibroDiario);
router.post("/:ruc/libro-diario/preview/exportar/excel", exportarLibroDiarioPreviewExcel);
router.get("/:ruc/libro-mayor", consultarLibroMayor);
router.post("/:ruc/libro-mayor/preview", consultarLibroMayorPreview);
router.get("/:ruc/libro-mayor/validar", validarLibroMayor);
router.get("/:ruc/libro-mayor/exportar/excel", exportarLibroMayorExcel);
router.get("/:ruc/libro-mayor/exportar/pdf", exportarLibroMayorPdf);
router.post("/:ruc/libro-mayor/preview/exportar/excel", exportarLibroMayorPreviewExcel);
router.post("/:ruc/libro-mayor/preview/exportar/pdf", exportarLibroMayorPreviewPdf);
router.get("/:ruc/libro-mayor/cuentas/:cuentaId", consultarFolioLibroMayor);

router.post(
  "/:ruc/procesar-excel-libro-diario",
  upload.single("archivo"),
  procesarExcelLibroDiario
);

// Legacy: procesa un Excel en memoria sin persistir asientos.
router.post("/:ruc/procesar-ats", upload.single("archivo"), procesarAtsContabilidad);

export default router;
