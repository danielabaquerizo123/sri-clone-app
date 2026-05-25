import { Router } from "express";
import {
  enviarAnexo,
  listarAnexos,
  crearGastoPersonal,
  crearBeneficiarioPension,
  crearCargaFamiliar,
} from "../controllers/anexo.controller";

const router = Router();

router.post("/:ruc/enviar", enviarAnexo);
router.get("/:ruc/consultar", listarAnexos);
router.post("/:ruc/gastos-personales", crearGastoPersonal);
router.post("/:ruc/beneficiario-pension", crearBeneficiarioPension);
router.post("/:ruc/cargas-familiares", crearCargaFamiliar);

export default router;