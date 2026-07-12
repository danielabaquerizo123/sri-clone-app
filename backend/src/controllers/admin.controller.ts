import { Response } from "express";
import { prisma } from "../lib/prisma";
import {
  calcularDiasRestantes,
  calcularEstadoAcceso,
  calcularFechaExpiracion,
} from "../lib/acceso";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const mapContribuyenteAcceso = (contribuyente: {
  fechaExpiracion: Date;
  activo: boolean;
}) => ({
  estadoAcceso: calcularEstadoAcceso(
    contribuyente.activo,
    contribuyente.fechaExpiracion
  ),
  diasRestantes: calcularDiasRestantes(contribuyente.fechaExpiracion),
});

const parseFechaExpiracionManual = (value: unknown) => {
  if (typeof value !== "string") {
    throw new Error("La fecha de expiración debe tener formato YYYY-MM-DD.");
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new Error("La fecha de expiración debe tener formato YYYY-MM-DD.");
  }

  const [, year, month, day] = match;
  const selectedDate = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    selectedDate.getFullYear() !== Number(year) ||
    selectedDate.getMonth() !== Number(month) - 1 ||
    selectedDate.getDate() !== Number(day)
  ) {
    throw new Error("La fecha de expiración no es válida.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selectedDate <= today) {
    throw new Error("La fecha de expiración debe ser una fecha futura.");
  }

  return selectedDate;
};

export const listarContribuyentesAdmin = async (
  _req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const contribuyentes = await prisma.contribuyente.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        ruc: true,
        razonSocial: true,
        email: true,
        rol: true,
        tipoContribuyente: true,
        estadoTributario: true,
        estadoRuc: true,
        activo: true,
        fechaExpiracion: true,
        fechaRegistro: true,
        createdAt: true,
      },
    });

    return res.json(
      contribuyentes.map((contribuyente) => ({
        ...contribuyente,
        ...mapContribuyenteAcceso(contribuyente),
      }))
    );
  } catch (error) {
    console.error("Error listando contribuyentes admin:", error);
    return res.status(500).json({
      message: "No se pudo listar los contribuyentes.",
    });
  }
};

export const reactivarContribuyenteAdmin = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const contribuyente = await prisma.contribuyente.update({
      where: { id: req.params.id },
      data: {
        activo: true,
        fechaExpiracion: calcularFechaExpiracion(),
        fechaActualizacion: new Date(),
      },
    });

    return res.json({
      message: "Contribuyente reactivado correctamente.",
      contribuyente: {
        ...contribuyente,
        ...mapContribuyenteAcceso(contribuyente),
      },
    });
  } catch (error) {
    console.error("Error reactivando contribuyente:", error);
    return res.status(404).json({
      message: "No se pudo reactivar el contribuyente solicitado.",
    });
  }
};

export const editarVigenciaContribuyenteAdmin = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    let fechaExpiracion: Date;

    try {
      fechaExpiracion = parseFechaExpiracionManual(req.body?.fechaExpiracion);
    } catch (validationError) {
      return res.status(400).json({
        message:
          validationError instanceof Error
            ? validationError.message
            : "La fecha de expiración no es válida.",
      });
    }

    const contribuyente = await prisma.contribuyente.update({
      where: { id: req.params.id },
      data: {
        fechaExpiracion,
        fechaActualizacion: new Date(),
      },
    });

    return res.json({
      message: "Vigencia actualizada correctamente.",
      contribuyente: {
        ...contribuyente,
        ...mapContribuyenteAcceso(contribuyente),
      },
    });
  } catch (error) {
    console.error("Error editando vigencia de contribuyente:", error);
    return res.status(404).json({
      message: "No se pudo actualizar la vigencia del contribuyente solicitado.",
    });
  }
};

export const desactivarContribuyenteAdmin = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const contribuyente = await prisma.contribuyente.update({
      where: { id: req.params.id },
      data: {
        activo: false,
        fechaActualizacion: new Date(),
      },
    });

    return res.json({
      message: "Contribuyente desactivado correctamente.",
      contribuyente: {
        ...contribuyente,
        ...mapContribuyenteAcceso(contribuyente),
      },
    });
  } catch (error) {
    console.error("Error desactivando contribuyente:", error);
    return res.status(404).json({
      message: "No se pudo desactivar el contribuyente solicitado.",
    });
  }
};
