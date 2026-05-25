import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const enviarAnexo = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;
    const { tipoAnexo, periodoFiscal, anio, mes, archivoNombre, datosJSON } = req.body;

    if (!tipoAnexo || !periodoFiscal || !anio) {
      return res.status(400).json({
        message: "Complete tipo de anexo, período fiscal y año.",
      });
    }

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { ruc },
    });

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    const anexo = await prisma.anexoTributario.create({
      data: {
        tipoAnexo,
        periodoFiscal,
        anio: Number(anio),
        mes: mes || null,
        archivoNombre: archivoNombre || null,
        datosJSON: datosJSON || {},
        contribuyenteId: contribuyente.id,
      },
    });

    return res.status(201).json({
      message: "Anexo enviado correctamente.",
      anexo,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error al enviar anexo.",
    });
  }
};

export const listarAnexos = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;

    const anexos = await prisma.anexoTributario.findMany({
      where: {
        contribuyente: {
          ruc,
        },
      },
      orderBy: {
        fechaEnvio: "desc",
      },
    });

    return res.json(anexos);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error al consultar anexos.",
    });
  }
};

export const crearGastoPersonal = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;
    const { anio, tipoGasto, proveedor, rucProveedor, valor } = req.body;

    if (!anio || !tipoGasto || !proveedor || !rucProveedor || valor === undefined) {
      return res.status(400).json({
        message: "Complete año, tipo de gasto, proveedor, RUC del proveedor y valor.",
      });
    }

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { ruc },
    });

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    const gasto = await prisma.gastoPersonal.create({
      data: {
        anio: Number(anio),
        tipoGasto,
        proveedor,
        rucProveedor,
        valor: Number(valor),
        contribuyenteId: contribuyente.id,
      },
    });

    return res.status(201).json({
      message: "Gasto personal registrado correctamente.",
      gasto,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error registrando gasto personal.",
    });
  }
};

export const crearBeneficiarioPension = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;
    const { tipoIdentificacion, identificacion, nombres, montoAnual } = req.body;

    if (!tipoIdentificacion || !identificacion || !nombres || montoAnual === undefined) {
      return res.status(400).json({
        message: "Complete tipo de identificación, identificación, nombres y monto anual.",
      });
    }

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { ruc },
    });

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    const beneficiario = await prisma.beneficiarioPension.create({
      data: {
        tipoIdentificacion,
        identificacion,
        nombres,
        montoAnual: Number(montoAnual),
        contribuyenteId: contribuyente.id,
      },
    });

    return res.status(201).json({
      message: "Beneficiario de pensión alimenticia registrado correctamente.",
      beneficiario,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error registrando beneficiario.",
    });
  }
};

export const crearCargaFamiliar = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;

    const periodoFiscal = Number(req.body.periodoFiscal ?? req.body.anio);
    const {
      tipoIdentificacion,
      identificacion,
      nombres,
      parentesco,
      condicionDiscapacidad,
      enfermedadCatastrofica,
      tipoPeriodo,
    } = req.body;

    if (
      !periodoFiscal ||
      !tipoIdentificacion ||
      !identificacion ||
      !nombres ||
      !parentesco ||
      !tipoPeriodo
    ) {
      return res.status(400).json({
        message: "Complete período fiscal, identificación, nombres, parentesco y tipo de período.",
      });
    }

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { ruc },
    });

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    const parentescoNormalizado = String(parentesco).toUpperCase();

    const estado =
      parentescoNormalizado.includes("PADRE") || parentescoNormalizado.includes("MADRE")
        ? "PENDIENTE"
        : "CONFIRMADO";

    const carga = await prisma.cargaFamiliar.create({
      data: {
        periodoFiscal,
        tipoIdentificacion,
        identificacion,
        nombres,
        parentesco,
        condicionDiscapacidad: condicionDiscapacidad || "NO",
        enfermedadCatastrofica: Boolean(enfermedadCatastrofica),
        estado,
        tipoPeriodo,
        contribuyenteId: contribuyente.id,
      },
    });

    return res.status(201).json({
      message: "Carga familiar registrada correctamente.",
      carga,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error registrando carga familiar.",
    });
  }
};