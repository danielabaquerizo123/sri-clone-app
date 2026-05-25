import { Router } from "express";
import {
  obtenerPerfilContribuyente,
  obtenerOpcionesRuc,
  actualizarContribuyente,
  solicitarReaperturaRuc,
  previewReimpresionRuc,
  descargarPdfRuc,
} from "../controllers/contribuyente.controller";

const router = Router();

router.get("/perfil/:ruc", obtenerPerfilContribuyente);
router.get("/:ruc/ruc/opciones", obtenerOpcionesRuc);
router.put("/:ruc/ruc/actualizar", actualizarContribuyente);
router.post("/:ruc/ruc/reapertura", solicitarReaperturaRuc);
router.get("/:ruc/ruc/reimpresion/preview", previewReimpresionRuc);
router.get("/:ruc/ruc/reimpresion/pdf", descargarPdfRuc);

export default router;