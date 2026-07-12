import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { calcularFechaExpiracion } from "../lib/acceso";
import {
  calcularResetTokenExpires,
  calcularVerificationExpires,
  construirUrlResetPassword,
  construirUrlVerificacion,
  generarResetToken,
  generarVerificationToken,
} from "../lib/email-verificacion";
import { loginSchema, registerSchema } from "../schemas/auth.schema";
import {
  enviarCorreoRecuperacionPassword,
  enviarCorreoVerificacion,
} from "../services/email/resend.service";

const MENSAJE_RECUPERACION_GENERICO =
  "Si existe una cuenta asociada, enviaremos un correo con instrucciones para recuperar la contraseña.";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET no está definido en el entorno.");
  }

  return secret;
};

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

    if (!contribuyente.emailVerified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message:
          "Debe verificar su correo electrónico antes de iniciar sesión.",
        ruc: contribuyente.ruc,
        email: contribuyente.email,
      });
    }

    const token = jwt.sign(
      {
        id: contribuyente.id,
        ruc: contribuyente.ruc,
        rol: contribuyente.rol,
        tipoContribuyente: contribuyente.tipoContribuyente,
      },
      getJwtSecret(),
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
        activo: contribuyente.activo,
        fechaExpiracion: contribuyente.fechaExpiracion,
        emailVerified: contribuyente.emailVerified,
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
    const fechaRegistro = new Date();
    const fechaExpiracion = calcularFechaExpiracion(fechaRegistro);
    const verificationToken = generarVerificationToken();
    const verificationExpires = calcularVerificationExpires(fechaRegistro);

    const contribuyente = await prisma.contribuyente.create({
      data: {
        ruc: identificacion,
        clave: passwordHash,
        razonSocial,
        tipoContribuyente: input.tipoContribuyente,
        rol: "CONTRIBUYENTE",
        estadoRuc: "ACTIVO",
        estadoTributario: "AL DÍA",
        activo: true,
        fechaExpiracion,
        email,
        emailVerified: false,
        verificationToken,
        verificationExpires,
        celular: telefono,
        telefonoDomicilio: telefono,
        fechaRegistro,
        fechaInicioActividades: fechaRegistro,
        fechaActualizacion: fechaRegistro,
      },
      select: {
        id: true,
        ruc: true,
        razonSocial: true,
        tipoContribuyente: true,
        fechaExpiracion: true,
        email: true,
        verificationToken: true,
        celular: true,
        telefonoDomicilio: true,
      },
    });

    try {
      await enviarCorreoVerificacion({
        to: email,
        razonSocial,
        verificationUrl: construirUrlVerificacion(contribuyente.verificationToken!),
      });
    } catch (emailError) {
      console.error("Error enviando correo de verificación:", emailError);
      return res.status(201).json({
        ok: true,
        warning: "VERIFICATION_EMAIL_NOT_SENT",
        message:
          "Tu cuenta fue creada, pero no pudimos enviar el correo de verificación. Intenta reenviarlo antes de iniciar sesión.",
        usuario: {
          ruc: contribuyente.ruc,
          razonSocial: contribuyente.razonSocial,
          tipoContribuyente: contribuyente.tipoContribuyente,
          fechaExpiracion: contribuyente.fechaExpiracion,
          email: contribuyente.email,
          telefono: contribuyente.celular || contribuyente.telefonoDomicilio,
        },
      });
    }

    return res.status(201).json({
      ok: true,
      message:
        "Registro creado correctamente. Revise su correo electrónico para verificar la cuenta.",
      usuario: {
        ruc: contribuyente.ruc,
        razonSocial: contribuyente.razonSocial,
        tipoContribuyente: contribuyente.tipoContribuyente,
        fechaExpiracion: contribuyente.fechaExpiracion,
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

export const resendVerification = async (req: Request, res: Response) => {
  try {
    const rawIdentifier = String(req.body.email || req.body.ruc || "").trim();

    if (!rawIdentifier) {
      return res.status(400).json({
        message: "Ingrese el correo electrónico o RUC para reenviar la verificación.",
      });
    }

    const identifier = rawIdentifier.toLowerCase();
    const contribuyente = await prisma.contribuyente.findFirst({
      where: {
        OR: [{ email: identifier }, { ruc: rawIdentifier }],
      },
    });

    if (!contribuyente) {
      return res.status(404).json({
        message: "No se encontró una cuenta pendiente de verificación.",
      });
    }

    if (contribuyente.emailVerified) {
      return res.status(409).json({
        message: "Este correo ya se encuentra verificado. Puede iniciar sesión.",
      });
    }

    if (!contribuyente.email) {
      return res.status(400).json({
        message: "La cuenta no tiene un correo registrado para verificación.",
      });
    }

    const fechaActual = new Date();
    const verificationToken = generarVerificationToken();
    const verificationExpires = calcularVerificationExpires(fechaActual);

    const actualizado = await prisma.contribuyente.update({
      where: { id: contribuyente.id },
      data: {
        verificationToken,
        verificationExpires,
        fechaActualizacion: fechaActual,
      },
      select: {
        email: true,
        razonSocial: true,
        verificationToken: true,
      },
    });

    await enviarCorreoVerificacion({
      to: actualizado.email!,
      razonSocial: actualizado.razonSocial,
      verificationUrl: construirUrlVerificacion(actualizado.verificationToken!),
    });

    return res.json({
      ok: true,
      message: "Correo de verificación reenviado correctamente.",
    });
  } catch (error) {
    console.error("Error reenviando correo de verificación:", error);
    return res.status(500).json({
      message:
        "No se pudo reenviar el correo de verificación. Intente nuevamente.",
    });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const token = String(req.query.token || "").trim();

    if (!token) {
      return res.status(400).json({
        message: "Token de verificación requerido.",
      });
    }

    const contribuyente = await prisma.contribuyente.findFirst({
      where: { verificationToken: token },
    });

    if (!contribuyente) {
      return res.status(400).json({
        message: "El enlace de verificación no es válido.",
      });
    }

    if (
      contribuyente.verificationExpires &&
      new Date() > contribuyente.verificationExpires
    ) {
      return res.status(400).json({
        message:
          "El enlace de verificación ha vencido. Solicite un nuevo registro o contacte al administrador.",
      });
    }

    await prisma.contribuyente.update({
      where: { id: contribuyente.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpires: null,
        fechaActualizacion: new Date(),
      },
    });

    return res.json({
      ok: true,
      message: "Correo verificado correctamente. Ya puede iniciar sesión.",
    });
  } catch (error) {
    console.error("Error verificando correo:", error);
    return res.status(500).json({
      message: "No se pudo verificar el correo electrónico.",
    });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const rawIdentifier = String(req.body.email || req.body.ruc || "").trim();

    if (!rawIdentifier) {
      return res.status(400).json({
        message: "Ingrese el correo electrónico o RUC para recuperar la contraseña.",
      });
    }

    const identifier = rawIdentifier.toLowerCase();
    const contribuyente = await prisma.contribuyente.findFirst({
      where: {
        OR: [{ email: identifier }, { ruc: rawIdentifier }],
      },
    });

    if (!contribuyente || !contribuyente.email) {
      return res.json({
        ok: true,
        message: MENSAJE_RECUPERACION_GENERICO,
      });
    }

    const fechaActual = new Date();
    const resetToken = generarResetToken();
    const resetTokenExpires = calcularResetTokenExpires(fechaActual);

    const actualizado = await prisma.contribuyente.update({
      where: { id: contribuyente.id },
      data: {
        resetToken,
        resetTokenExpires,
        fechaActualizacion: fechaActual,
      },
      select: {
        email: true,
        razonSocial: true,
        resetToken: true,
      },
    });

    try {
      await enviarCorreoRecuperacionPassword({
        to: actualizado.email!,
        razonSocial: actualizado.razonSocial,
        resetUrl: construirUrlResetPassword(actualizado.resetToken!),
      });
    } catch (emailError) {
      console.error("Error enviando correo de recuperación:", emailError);
    }

    return res.json({
      ok: true,
      message: MENSAJE_RECUPERACION_GENERICO,
    });
  } catch (error) {
    console.error("Error solicitando recuperación de contraseña:", error);
    return res.status(500).json({
      message:
        "No se pudo procesar la solicitud de recuperación. Intente nuevamente.",
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const token = String(req.body.token || "").trim();
    const nuevaClave = String(req.body.nuevaClave || "");

    if (!token) {
      return res.status(400).json({
        message: "Token de recuperación requerido.",
      });
    }

    if (nuevaClave.length < 8) {
      return res.status(400).json({
        message: "La nueva contraseña debe tener mínimo 8 caracteres.",
      });
    }

    const contribuyente = await prisma.contribuyente.findFirst({
      where: { resetToken: token },
    });

    if (!contribuyente) {
      return res.status(400).json({
        message: "El enlace de recuperación no es válido o ya fue utilizado.",
      });
    }

    if (
      !contribuyente.resetTokenExpires ||
      new Date() > contribuyente.resetTokenExpires
    ) {
      await prisma.contribuyente.update({
        where: { id: contribuyente.id },
        data: {
          resetToken: null,
          resetTokenExpires: null,
          fechaActualizacion: new Date(),
        },
      });

      return res.status(400).json({
        message: "El enlace de recuperación ha vencido. Solicite uno nuevo.",
      });
    }

    const passwordHash = await bcrypt.hash(nuevaClave, 12);

    await prisma.contribuyente.update({
      where: { id: contribuyente.id },
      data: {
        clave: passwordHash,
        resetToken: null,
        resetTokenExpires: null,
        fechaActualizacion: new Date(),
      },
    });

    return res.json({
      ok: true,
      message: "Contraseña actualizada correctamente. Ya puede iniciar sesión.",
    });
  } catch (error) {
    console.error("Error restableciendo contraseña:", error);
    return res.status(500).json({
      message: "No se pudo actualizar la contraseña. Intente nuevamente.",
    });
  }
};
