import { Request, Response } from "express";
import puppeteer from "puppeteer";
import QRCode from "qrcode";
import { prisma } from "../lib/prisma";

const formatDate = (value?: Date | string | null) => {
  if (!value) return "No registra";

  return new Date(value).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateTime = (value?: Date | string | null) => {
  const date = value ? new Date(value) : new Date();

  return date.toLocaleString("es-EC", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const obtenerPerfilContribuyente = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { ruc },
      include: {
        _count: {
          select: {
            declaraciones: true,
            ventas: true,
            compras: true,
            anulados: true,
            guias: true,
            proveedores: true,
          },
        },
      },
    });

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    return res.json(contribuyente);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error al obtener perfil.",
    });
  }
};

export const obtenerOpcionesRuc = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { ruc },
      select: {
        ruc: true,
        razonSocial: true,
        tipoContribuyente: true,
        estadoRuc: true,
        regimen: true,
      },
    });

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    return res.json({
      contribuyente,
      opciones: {
        inscripcion: true,
        actualizacion: true,
        reapertura: true,
        reimpresion: true,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error al consultar opciones RUC.",
    });
  }
};

export const actualizarContribuyente = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;

    const actualizado = await prisma.contribuyente.update({
      where: { ruc },
      data: {
        razonSocial: req.body.razonSocial,
        estadoTributario: req.body.estadoTributario,
        estadoRuc: req.body.estadoRuc,
        regimen: req.body.regimen,
        obligaciones: req.body.obligaciones,
        actividadesEconomicas: req.body.actividadesEconomicas,

        establecimientosAbiertos: Number(req.body.establecimientosAbiertos ?? 0),
        establecimientosCerrados: Number(req.body.establecimientosCerrados ?? 0),

        provincia: req.body.provincia,
        canton: req.body.canton,
        parroquia: req.body.parroquia,
        barrio: req.body.barrio,
        calle: req.body.calle,
        numero: req.body.numero,
        interseccion: req.body.interseccion,
        referencia: req.body.referencia,
        jurisdiccion: req.body.jurisdiccion,

        email: req.body.email,
        telefonoDomicilio: req.body.telefonoDomicilio,
        celular: req.body.celular,

        artesano: req.body.artesano,
        obligadoContabilidad: req.body.obligadoContabilidad,
        tipoAgenteRetencion: req.body.tipoAgenteRetencion,
        agenteRetencion: req.body.agenteRetencion,
        contribuyenteEspecial: req.body.contribuyenteEspecial,

        numerosRucAnteriores: req.body.numerosRucAnteriores,

        fechaActualizacion: new Date(),
      },
    });

    return res.json({
      message: "Datos actualizados correctamente.",
      contribuyente: actualizado,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error al actualizar RUC.",
    });
  }
};

export const solicitarReaperturaRuc = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { ruc },
    });

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    if (contribuyente.estadoRuc.toUpperCase() === "ACTIVO") {
      return res.status(409).json({
        message: "No procede reapertura porque el RUC ya está ACTIVO.",
      });
    }

    const actualizado = await prisma.contribuyente.update({
      where: { ruc },
      data: {
        estadoRuc: "ACTIVO",
        fechaReinicioActividades: new Date(),
        fechaActualizacion: new Date(),
      },
    });

    return res.json({
      message: "Reapertura procesada correctamente.",
      contribuyente: actualizado,
      motivo: req.body.motivo,
      observaciones: req.body.observaciones,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error al procesar reapertura.",
    });
  }
};

export const previewReimpresionRuc = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { ruc },
    });

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    return res.json({
      tipoDocumento: "REIMPRESION_RUC",
      fechaEmision: new Date().toISOString(),
      codigoVerificacion:
        contribuyente.codigoVerificacion || `RCR${Date.now()}`,
      contribuyente,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error al generar vista previa.",
    });
  }
};

const generarHtmlCertificado = async (contribuyente: any) => {
  const codigo =
    contribuyente.codigoVerificacion || `RCR${contribuyente.ruc}${Date.now()}`;

  const qr = await QRCode.toDataURL(
    `RUC:${contribuyente.ruc}|CODIGO:${codigo}|RAZON:${contribuyente.razonSocial}`
  );

  const actividades = String(contribuyente.actividadesEconomicas || "No registra")
    .split("•")
    .map((x: string) => x.trim())
    .filter(Boolean);

  const obligaciones = String(contribuyente.obligaciones || "No registra")
    .split(",")
    .map((x: string) => x.trim())
    .filter(Boolean);

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
@page {
  size: A4;
  margin: 0;
}

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
}

.page {
  width: 210mm;
  height: 297mm;
  padding: 18mm;
  box-sizing: border-box;
  position: relative;
  page-break-after: always;
}

.header {
  display: flex;
  justify-content: space-between;
  border-bottom: 4px solid #005fae;
  padding-bottom: 10px;
}

.logo {
  font-size: 30px;
  font-weight: 900;
  color: #005fae;
}

.section {
  margin-top: 16px;
}

.label {
  font-size: 10px;
  color: gray;
}

.value {
  font-size: 13px;
  font-weight: bold;
}

.footer {
  position: absolute;
  bottom: 15mm;
  left: 18mm;
  right: 18mm;
  display: flex;
  justify-content: space-between;
}

.qr {
  width: 130px;
}
</style>
</head>
<body>

<section class="page">
<div class="header">
<div>
<div class="logo">SRI</div>
<h2>Registro Único de Contribuyentes</h2>
</div>
<div>www.sri.gob.ec</div>
</div>

<div class="section">
<div class="label">Razón social</div>
<div class="value">${contribuyente.razonSocial}</div>
</div>

<div class="section">
<div class="label">RUC</div>
<div class="value">${contribuyente.ruc}</div>
</div>

<div class="section">
<div class="label">Estado</div>
<div class="value">${contribuyente.estadoRuc}</div>
</div>

<div class="section">
<div class="label">Régimen</div>
<div class="value">${contribuyente.regimen}</div>
</div>

<div class="section">
<div class="label">Actividades económicas</div>
<ul>
${actividades.map((a: string) => `<li>${a}</li>`).join("")}
</ul>
</div>

<div class="footer">
<div>1/2</div>
<div>www.sri.gob.ec</div>
</div>
</section>

<section class="page">
<div class="header">
<div>
<div class="logo">SRI</div>
<h2>Obligaciones tributarias</h2>
</div>
</div>

<ul>
${obligaciones.map((o: string) => `<li>${o}</li>`).join("")}
</ul>

<div class="section">
<img class="qr" src="${qr}" />
</div>

<div class="section">
<div class="label">Código verificación</div>
<div class="value">${codigo}</div>
</div>

<div class="section">
<div class="label">Fecha emisión</div>
<div class="value">${formatDateTime(new Date())}</div>
</div>

<div class="footer">
<div>2/2</div>
<div>www.sri.gob.ec</div>
</div>
</section>

</body>
</html>
`;
};

export const descargarPdfRuc = async (req: Request, res: Response) => {
  let browser;

  try {
    const { ruc } = req.params;

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { ruc },
    });

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    const html = await generarHtmlCertificado(contribuyente);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "load",
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    await browser.close();

    const pdfBuffer = Buffer.from(pdf);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="RUC-${contribuyente.ruc}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);

  } catch (error) {
    console.error(error);

    if (browser) {
      await browser.close();
    }

    return res.status(500).json({
      message: "Error al generar PDF del RUC.",
    });
  }
};
