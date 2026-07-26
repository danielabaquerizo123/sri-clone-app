import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import {
  obtenerUsuarioAutenticado,
  subirFotoPerfil,
  eliminarFotoPerfil,
  obtenerPerfilContribuyente,
  obtenerOpcionesRuc,
  actualizarContribuyente,
  solicitarReaperturaRuc,
  previewReimpresionRuc,
  descargarPdfRuc,
} from "../controllers/contribuyente.controller";

const router = Router();

const uploadFotoPerfil = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
});

const handleFotoPerfilUpload = (req: Request, res: Response, next: NextFunction) => {
  uploadFotoPerfil.single("foto")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "La imagen no puede superar 2 MB."
            : "No se pudo leer la imagen seleccionada.",
      });
    }

    if (error) {
      return res.status(400).json({
        message: "No se pudo leer la imagen seleccionada.",
      });
    }

    return next();
  });
};

router.get("/me", obtenerUsuarioAutenticado);
router.post("/me/foto-perfil", handleFotoPerfilUpload, subirFotoPerfil);
router.delete("/me/foto-perfil", eliminarFotoPerfil);
router.get("/perfil/:ruc", obtenerPerfilContribuyente);
router.get("/:ruc/ruc/opciones", obtenerOpcionesRuc);
router.put("/:ruc/ruc/actualizar", actualizarContribuyente);
router.post("/:ruc/ruc/reapertura", solicitarReaperturaRuc);
router.get("/:ruc/ruc/reimpresion/preview", previewReimpresionRuc);
router.get("/:ruc/ruc/reimpresion/pdf", descargarPdfRuc);

export default router;
