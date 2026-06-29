import { Router } from "express";
import multer from "multer";
import { procesarAtsContabilidad } from "../controllers/contabilidad.controller";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

router.post("/:ruc/procesar-ats", upload.single("archivo"), procesarAtsContabilidad);

export default router;
