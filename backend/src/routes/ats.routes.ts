import { Router } from "express";
import multer from "multer";
import {
  importarAtsExcel,
  consultarLoteAts,
  listarLotesAts,
  descargarXmlAts,
  descargarTalonResumenAts,
} from "../controllers/ats.controller";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

router.post("/:ruc/importar", upload.single("archivo"), importarAtsExcel);
router.get("/:ruc/lotes", listarLotesAts);
router.get("/lote/:loteId", consultarLoteAts);
router.get("/lote/:loteId/xml", descargarXmlAts);
router.get("/lote/:loteId/talon-resumen", descargarTalonResumenAts);

export default router;
