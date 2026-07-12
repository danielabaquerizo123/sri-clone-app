import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export type AuthenticatedContribuyente = {
  id: string;
  ruc: string;
  rol: "ADMIN" | "CONTADOR" | "CONTRIBUYENTE";
  tipoContribuyente: "PERSONA_NATURAL" | "SOCIEDAD";
  activo: boolean;
  fechaExpiracion: Date;
};

export type AuthenticatedRequest = Request & {
  contribuyenteAuth?: AuthenticatedContribuyente;
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET no está definido en el entorno.");
  }

  return secret;
};

const isValidAuthPayload = (
  payload: string | JwtPayload
): payload is JwtPayload & AuthenticatedContribuyente => {
  return (
    typeof payload !== "string" &&
    typeof payload.id === "string" &&
    typeof payload.ruc === "string" &&
    typeof payload.rol === "string" &&
    typeof payload.tipoContribuyente === "string"
  );
};

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Token de autenticación requerido.",
      });
    }

    const token = authHeader.slice("Bearer ".length).trim();

    if (!token) {
      return res.status(401).json({
        message: "Token de autenticación requerido.",
      });
    }

    const payload = jwt.verify(token, getJwtSecret());

    if (!isValidAuthPayload(payload)) {
      return res.status(401).json({
        message: "Token de autenticación inválido.",
      });
    }

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        ruc: true,
        rol: true,
        tipoContribuyente: true,
        activo: true,
        fechaExpiracion: true,
      },
    });

    if (!contribuyente) {
      return res.status(401).json({
        message: "El contribuyente autenticado ya no existe.",
      });
    }

    if (!contribuyente.activo) {
      return res.status(403).json({
        code: "ACCESS_DISABLED",
        message: "El acceso del contribuyente está desactivado.",
      });
    }

    if (new Date() > contribuyente.fechaExpiracion) {
      return res.status(403).json({
        code: "ACCESS_EXPIRED",
        message:
          "El acceso del contribuyente ha vencido. Contacte al administrador para reactivarlo.",
      });
    }

    req.contribuyenteAuth = contribuyente;

    return next();
  } catch (error) {
    if (error instanceof Error && error.message.includes("JWT_SECRET")) {
      return res.status(500).json({
        message: error.message,
      });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        message: "La sesión ha expirado. Inicie sesión nuevamente.",
      });
    }

    return res.status(401).json({
      message: "Token de autenticación inválido.",
    });
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.contribuyenteAuth?.rol !== "ADMIN") {
    return res.status(403).json({
      message: "Acceso permitido solo para administradores.",
    });
  }

  return next();
};
