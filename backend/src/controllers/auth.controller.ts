import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { loginSchema, registerSchema } from "../schemas/auth.schema";

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

export const register = async (req: Request, res: Response) => {
  try {
    const input = registerSchema.parse(req.body);
    const identificacion = input.identificacion.trim();
    const razonSocial = input.razonSocial.trim();
    const email = input.email.trim().toLowerCase();
    const telefono = input.telefono.trim();

    const existente = await prisma.contribuyente.findUnique({
      where: { ruc: identificacion },
      select: { id: true },
    });

    if (existente) {
      return res.status(409).json({
        message: "La identificación ingresada ya se encuentra registrada.",
      });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const contribuyente = await prisma.contribuyente.create({
      data: {
        ruc: identificacion,
        clave: passwordHash,
        razonSocial,
        tipoContribuyente: input.tipoContribuyente,
        rol: "CONTRIBUYENTE",
        estadoRuc: "ACTIVO",
        estadoTributario: "AL DÍA",
        email,
        celular: telefono,
        telefonoDomicilio: telefono,
        fechaRegistro: new Date(),
        fechaInicioActividades: new Date(),
        fechaActualizacion: new Date(),
      },
      select: {
        ruc: true,
        razonSocial: true,
        tipoContribuyente: true,
        email: true,
        celular: true,
        telefonoDomicilio: true,
      },
    });

    return res.status(201).json({
      ok: true,
      message: "Registro creado correctamente",
      usuario: {
        ruc: contribuyente.ruc,
        razonSocial: contribuyente.razonSocial,
        tipoContribuyente: contribuyente.tipoContribuyente,
        email: contribuyente.email,
        telefono: contribuyente.celular || contribuyente.telefonoDomicilio,
      },
    });
  } catch (error: any) {
    console.error("Error en registro:", error);

    if (error?.issues?.length) {
      return res.status(400).json({
        message: error.issues[0].message || "Datos inválidos para el registro.",
        issues: error.issues,
      });
    }

    return res.status(400).json({
      message: "Datos inválidos para el registro.",
    });
  }
};
