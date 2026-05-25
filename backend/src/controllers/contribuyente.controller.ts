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

const escapeHtml = (value?: string | number | null) =>
  String(value ?? "No registra")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const splitItems = (value?: string | null) =>
  String(value || "No registra")
    .split(/(?:\s*•\s*)|(?:\r?\n)|(?:,(?=\s*(?:\d{4}\s*-|ANEXO|G\d{8})))/)
    .map((item) => item.trim())
    .filter(Boolean);

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

const generarHtmlCertificadoSri = async (contribuyente: any) => {
  const codigo =
    contribuyente.codigoVerificacion || `RCR${contribuyente.ruc}${Date.now()}`;
  const fechaEmision = formatDateTime(new Date());
  const qr = await QRCode.toDataURL(
    `https://www.sri.gob.ec|RUC:${contribuyente.ruc}|CODIGO:${codigo}|RAZON:${contribuyente.razonSocial}`
  );

  const actividades = splitItems(contribuyente.actividadesEconomicas);
  const obligaciones = splitItems(contribuyente.obligaciones);

  const field = ([label, value]: any[]) => `
    <div class="field">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
    </div>
  `;

  const compactField = ([label, value]: any[]) => `
    <div class="compact-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;

  const listItem = (item: string) => `<li>${escapeHtml(item)}</li>`;

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body {
  margin: 0;
  color: #24364b;
  font-family: Arial, Helvetica, sans-serif;
  background: #ffffff;
}
.page {
  width: 210mm;
  height: 297mm;
  padding: 13mm 15mm 16mm;
  position: relative;
  page-break-after: always;
  background: #ffffff;
  overflow: hidden;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 3px solid #005fae;
  padding-bottom: 7mm;
  margin-bottom: 5mm;
}
.brand { display: flex; align-items: center; }
.logo {
  width: 24mm;
  height: 15mm;
  border: 2px solid #005fae;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #005fae;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0;
}
.header-title { margin-left: 5mm; }
.kicker {
  color: #005fae;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .7px;
  text-transform: uppercase;
}
h1 {
  margin: 1mm 0 0;
  color: #123d6c;
  font-size: 19px;
  line-height: 1.15;
}
h2 {
  margin: 0 0 3mm;
  color: #005fae;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  border-bottom: 1px solid #d9e6f2;
  padding-bottom: 1.8mm;
}
.top-right {
  max-width: 72mm;
  color: #6b7c8f;
  font-size: 9px;
  text-align: right;
  line-height: 1.4;
}
.identity {
  display: grid;
  grid-template-columns: 1fr 38mm;
  gap: 5mm;
  align-items: stretch;
  margin-bottom: 5mm;
}
.name-box {
  border-left: 4px solid #005fae;
  background: #f6f9fc;
  padding: 4mm 5mm;
}
.name {
  margin-top: 1mm;
  color: #152f4f;
  font-size: 17px;
  font-weight: 800;
  line-height: 1.2;
}
.status-box {
  border: 1px solid #c8d9ea;
  padding: 4mm;
  text-align: center;
}
.status-box span {
  display: block;
  color: #6b7c8f;
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
}
.status-box strong {
  display: block;
  margin-top: 1mm;
  color: #0b7a3a;
  font-size: 15px;
}
.section { margin-top: 4mm; }
.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2.8mm;
}
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2.8mm;
}
.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2.8mm;
}
.field {
  min-height: 14mm;
  border: 1px solid #dce7f1;
  background: #fbfdff;
  padding: 2.5mm 3mm;
}
.label {
  color: #697b8f;
  font-size: 7.7px;
  font-weight: 800;
  letter-spacing: .35px;
  text-transform: uppercase;
}
.value {
  margin-top: 1.2mm;
  color: #1f334a;
  font-size: 10px;
  font-weight: 800;
  line-height: 1.25;
}
.compact-field {
  display: flex;
  justify-content: space-between;
  gap: 3mm;
  border-bottom: 1px solid #e4edf6;
  padding: 1.6mm 0;
  font-size: 9.2px;
}
.compact-field span {
  color: #697b8f;
  font-weight: 700;
}
.compact-field strong {
  color: #1f334a;
  text-align: right;
}
.note {
  border-left: 3px solid #005fae;
  background: #f5f9fd;
  color: #40536a;
  font-size: 9.5px;
  line-height: 1.45;
  padding: 3mm 4mm;
}
.list {
  margin: 0;
  padding-left: 4.5mm;
}
.list li {
  margin-bottom: 1.6mm;
  color: #293d54;
  font-size: 9px;
  line-height: 1.25;
}
.activities li {
  margin-bottom: 1.05mm;
  font-size: 8.15px;
  line-height: 1.18;
}
.counts {
  display: grid;
  grid-template-columns: repeat(2, 42mm);
  gap: 4mm;
  margin-bottom: 5mm;
}
.count-card {
  border: 1px solid #c8d9ea;
  padding: 4mm;
}
.count-card span {
  color: #697b8f;
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
}
.count-card strong {
  display: block;
  margin-top: 1mm;
  color: #005fae;
  font-size: 24px;
  line-height: 1;
}
.qr-row {
  display: grid;
  grid-template-columns: 25mm 1fr;
  gap: 4mm;
  align-items: center;
}
.qr {
  width: 24mm;
  height: 24mm;
}
.signature-strip {
  margin-top: 5mm;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4mm;
}
.small-print {
  color: #53677d;
  font-size: 8.8px;
  line-height: 1.45;
}
.footer {
  position: absolute;
  bottom: 8mm;
  left: 15mm;
  right: 15mm;
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #d9e6f2;
  padding-top: 2.2mm;
  color: #64788e;
  font-size: 9px;
  font-weight: 700;
}
</style>
</head>
<body>
<section class="page">
  <div class="header">
    <div class="brand">
      <div class="logo">SRI</div>
      <div class="header-title">
        <div class="kicker">Servicio de Rentas Internas</div>
        <h1>Certificado Registro Único de Contribuyentes</h1>
      </div>
    </div>
    <div class="top-right">República del Ecuador<br />www.sri.gob.ec</div>
  </div>

  <div class="identity">
    <div class="name-box">
      <div class="label">Nombre / Razón social</div>
      <div class="name">${escapeHtml(contribuyente.razonSocial)}</div>
    </div>
    <div class="status-box">
      <span>Estado</span>
      <strong>${escapeHtml(contribuyente.estadoRuc)}</strong>
    </div>
  </div>

  <div class="section">
    <h2>Información del contribuyente</h2>
    <div class="grid-4">
      ${[
        ["Número RUC", contribuyente.ruc],
        ["Estado", contribuyente.estadoRuc],
        ["Régimen", contribuyente.regimen],
        ["Artesano", contribuyente.artesano],
      ].map(field).join("")}
    </div>
  </div>

  <div class="section">
    <h2>Fechas del registro</h2>
    <div class="grid-3">
      ${[
        ["Fecha de registro", formatDate(contribuyente.fechaRegistro)],
        ["Inicio de actividades", formatDate(contribuyente.fechaInicioActividades)],
        ["Cese de actividades", formatDate(contribuyente.fechaCeseActividades)],
        ["Reinicio de actividades", formatDate(contribuyente.fechaReinicioActividades)],
        ["Fecha de actualización", formatDate(contribuyente.fechaActualizacion)],
      ].map(field).join("")}
    </div>
  </div>

  <div class="section">
    <h2>Domicilio tributario</h2>
    <div class="grid-4">
      ${[
        ["Provincia", contribuyente.provincia],
        ["Cantón", contribuyente.canton],
        ["Parroquia", contribuyente.parroquia],
        ["Barrio", contribuyente.barrio],
        ["Calle", contribuyente.calle],
        ["Número", contribuyente.numero],
        ["Intersección", contribuyente.interseccion],
        ["Referencia", contribuyente.referencia],
      ].map(field).join("")}
    </div>
  </div>

  <div class="section">
    <h2>Ubicación geográfica y condición tributaria</h2>
    <div class="grid-2">
      <div>
        ${compactField(["Ubicación geográfica", contribuyente.jurisdiccion])}
        ${compactField(["Obligado a llevar contabilidad", contribuyente.obligadoContabilidad])}
        ${compactField(["Tipo Agente de retención", contribuyente.tipoAgenteRetencion])}
        ${compactField(["Agente de retención", contribuyente.agenteRetencion])}
      </div>
      <div>
        ${compactField(["Contribuyente especial", contribuyente.contribuyenteEspecial])}
        ${compactField(["Correo electrónico", contribuyente.email])}
        ${compactField(["Teléfono domicilio", contribuyente.telefonoDomicilio])}
        ${compactField(["Celular", contribuyente.celular])}
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Actividades económicas</h2>
    <ul class="list activities">${actividades.map(listItem).join("")}</ul>
  </div>

  <div class="footer"><div>1/2</div><div>www.sri.gob.ec</div></div>
</section>

<section class="page">
  <div class="header">
    <div class="brand">
      <div class="logo">SRI</div>
      <div class="header-title">
        <div class="kicker">Registro Único de Contribuyentes</div>
        <h1>Certificado Registro Único de Contribuyentes</h1>
      </div>
    </div>
    <div class="top-right">${escapeHtml(contribuyente.razonSocial)}<br />RUC ${escapeHtml(contribuyente.ruc)}</div>
  </div>

  <div class="section">
    <h2>Identificación</h2>
    <div class="grid-2">
      ${field(["Nombre / Razón social", contribuyente.razonSocial])}
      ${field(["Número RUC", contribuyente.ruc])}
    </div>
  </div>

  <div class="section">
    <h2>Establecimientos</h2>
    <div class="counts">
      <div class="count-card"><span>Abiertos</span><strong>${escapeHtml(contribuyente.establecimientosAbiertos)}</strong></div>
      <div class="count-card"><span>Cerrados</span><strong>${escapeHtml(contribuyente.establecimientosCerrados)}</strong></div>
    </div>
  </div>

  <div class="section">
    <h2>Obligaciones tributarias</h2>
    <ul class="list">${obligaciones.map(listItem).join("")}</ul>
    <div class="note">
      Las obligaciones tributarias reflejadas en este documento están sujetas a cambios. Revise periódicamente sus obligaciones tributarias en www.sri.gob.ec.
    </div>
  </div>

  <div class="section">
    <h2>Números del RUC anteriores</h2>
    ${field(["Números registrados", contribuyente.numerosRucAnteriores])}
  </div>

  <div class="section">
    <h2>Datos de emisión y validez</h2>
    <div class="qr-row">
      <img class="qr" src="${qr}" />
      <div>
        ${compactField(["Código de verificación", codigo])}
        ${compactField(["Fecha y hora de emisión", fechaEmision])}
        ${compactField(["Dirección IP", contribuyente.direccionIpEmision])}
      </div>
    </div>
  </div>

  <div class="signature-strip">
    <div class="note small-print">
      Este certificado es válido para los trámites tributarios y administrativos en los que sea requerido. Su autenticidad puede verificarse con el código de verificación impreso en este documento.
    </div>
    <div class="note small-print">
      La información contenida en este certificado corresponde a los datos registrados para el contribuyente al momento de la emisión.
    </div>
  </div>

  <div class="footer"><div>2/2</div><div>www.sri.gob.ec</div></div>
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

    const html = await generarHtmlCertificadoSri(contribuyente);

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
