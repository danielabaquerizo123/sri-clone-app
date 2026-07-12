import { Router } from "express";
import {
  desactivarContribuyenteAdmin,
  editarVigenciaContribuyenteAdmin,
  listarContribuyentesAdmin,
  reactivarContribuyenteAdmin,
} from "../controllers/admin.controller";
import { requireAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAdmin);

router.get("/contribuyentes", listarContribuyentesAdmin);
router.patch("/contribuyentes/:id/reactivar", reactivarContribuyenteAdmin);
router.patch("/contribuyentes/:id/vigencia", editarVigenciaContribuyenteAdmin);
router.patch("/contribuyentes/:id/desactivar", desactivarContribuyenteAdmin);

export default router;
