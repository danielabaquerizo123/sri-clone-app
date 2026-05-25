import { Router } from "express";
import {
  crearDeclaracion,
  consultarDeclaraciones,
  consultarFormulario103,
  consultarFormulario104,
  consultarFormulario107,
} from "../controllers/declaracion.controller";

const router = Router();

router.post("/:ruc/crear", crearDeclaracion);
router.get("/:ruc/consultar", consultarDeclaraciones);
router.get("/:ruc/formulario103", consultarFormulario103);
router.get("/:ruc/formulario104", consultarFormulario104);
router.get("/:ruc/formulario107", consultarFormulario107);

export default router;
