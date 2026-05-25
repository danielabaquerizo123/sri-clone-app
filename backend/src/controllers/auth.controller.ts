import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { loginSchema } from "../schemas/auth.schema";

export const login = async (req: Request, res: Response) => {
  try {
    const { ruc, ciAdicional, clave } = loginSchema.parse(req.body);

    const rucLimpio = ruc.trim();
    const ciAdicionalLimpio = ciAdicional?.trim();

    const contribuyente = ciAdicionalLimpio
      ? await prisma.contribuyente.findFirst({
          where: {
            ruc: rucLimpio,
            ciAdicional: ciAdicionalLimpio,
          },
        })
      : await prisma.contribuyente.findUnique({
          where: {
            ruc: rucLimpio,
          },
        });

    if (!contribuyente) {
      return res.status(401).json({
        message:
          "Las credenciales ingresadas son incorrectas o el usuario no está registrado.",
      });
    }

    let claveValida = false;

    const pareceHashBcrypt =
      contribuyente.clave.startsWith("$2a$") ||
      contribuyente.clave.startsWith("$2b$") ||
      contribuyente.clave.startsWith("$2y$");

    if (pareceHashBcrypt) {
      claveValida = await bcrypt.compare(clave, contribuyente.clave);
    } else {
      claveValida = clave === contribuyente.clave;
    }

    if (!claveValida) {
      return res.status(401).json({
        message: "Las credenciales ingresadas son incorrectas.",
      });
    }

    const token = jwt.sign(
      {
        id: contribuyente.id,
        ruc: contribuyente.ruc,
        rol: contribuyente.rol,
        tipoContribuyente: contribuyente.tipoContribuyente,
      },
      process.env.JWT_SECRET || "secreto_sri_2026",
      { expiresIn: "4h" }
    );

    return res.status(200).json({
      message: "Inicio de sesión correcto",
      token,
      user: {
        id: contribuyente.id,
        ruc: contribuyente.ruc,
        ciAdicional: contribuyente.ciAdicional,
        razonSocial: contribuyente.razonSocial,
        rol: contribuyente.rol,
        tipoContribuyente: contribuyente.tipoContribuyente,
        estadoTributario: contribuyente.estadoTributario,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);

    return res.status(400).json({
      message: "Datos inválidos para iniciar sesión.",
    });
  }
};