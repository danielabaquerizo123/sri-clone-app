import type { Request, Response } from "express";
import { AccountingEngine } from "../services/contabilidad/accounting-engine";

function buildErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const procesarAtsContabilidad = (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Debe subir un archivo ATS en formato Excel." });
    }

    const engine = new AccountingEngine();
    const result = engine.process(req.file.buffer, req.file.originalname);

    return res.status(200).json({
      message: "ATS procesado por el módulo Contabilidad.",
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error procesando ATS en Contabilidad.",
      error: buildErrorMessage(error),
    });
  }
};
