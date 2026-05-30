import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma";

function generarNumeroAdhesion() {
  return `ADH-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
}

const mesesMap: Record<string, string> = {
  "01": "Enero",
  "02": "Febrero",
  "03": "Marzo",
  "04": "Abril",
  "05": "Mayo",
  "06": "Junio",
  "07": "Julio",
  "08": "Agosto",
  "09": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre",
};

const retencionToCasillero: Record<string, { base: string; retenido?: string }> = {
  "302": { base: "302", retenido: "352" },
  "303": { base: "303", retenido: "353" },
  "304": { base: "304", retenido: "354" },
  "307": { base: "307", retenido: "357" },
  "308": { base: "308", retenido: "358" },
  "309": { base: "309", retenido: "359" },
  "311": { base: "311", retenido: "361" },
  "312": { base: "312", retenido: "362" },
  "322": { base: "322", retenido: "372" },
  "332": { base: "332" },
  "343": { base: "343", retenido: "393" },
  "344": { base: "344", retenido: "394" },
  "345": { base: "345", retenido: "395" },
  "346": { base: "346", retenido: "396" },
};

function n(value: unknown) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function add(casilleros: Record<string, number>, key: string, value: number) {
  casilleros[key] = round2((casilleros[key] || 0) + value);
}

function money(value: unknown) {
  return Number(value || 0).toFixed(2);
}

function fechaLocal(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-EC");
}

function filenameSafe(value: string) {
  return value.replace(/[^\w.-]+/g, "_");
}

function sendPdf(res: Response, filename: string, build: (doc: PDFKit.PDFDocument) => void) {
  const doc = new PDFDocument({ size: "A4", margin: 42 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  doc.on("end", () => {
    const pdf = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameSafe(filename)}"`);
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  });

  build(doc);
  doc.end();
}

function pdfTitle(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc
    .fontSize(10)
    .fillColor("#003565")
    .text("SERVICIO DE RENTAS INTERNAS", { align: "center" })
    .moveDown(0.35)
    .fontSize(17)
    .text(title, { align: "center" })
    .moveDown(0.25)
    .fontSize(11)
    .fillColor("#333333")
    .text(subtitle, { align: "center" })
    .moveDown(1);
}

function pdfKV(doc: PDFKit.PDFDocument, label: string, value: unknown) {
  doc.fontSize(9).fillColor("#666666").text(label.toUpperCase(), { continued: true });
  doc.fillColor("#111111").text(`  ${String(value ?? "-")}`);
}

function pdfTable(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: Array<[string, string | number]>,
  startX = 42,
  width = 511
) {
  doc.moveDown(0.8).fontSize(11).fillColor("#003565").text(title, startX);
  const labelWidth = Math.round(width * 0.68);
  const valueWidth = width - labelWidth;
  let y = doc.y + 6;

  rows.forEach(([label, value], index) => {
    const rowHeight = 22;
    doc
      .rect(startX, y, width, rowHeight)
      .fill(index % 2 === 0 ? "#f8fafc" : "#ffffff")
      .strokeColor("#d7dde6")
      .rect(startX, y, width, rowHeight)
      .stroke();

    doc
      .fontSize(8.5)
      .fillColor("#334155")
      .text(label, startX + 7, y + 7, { width: labelWidth - 14 })
      .fontSize(8.5)
      .fillColor("#111827")
      .text(String(value), startX + labelWidth + 7, y + 7, {
        width: valueWidth - 14,
        align: "right",
      });

    y += rowHeight;
  });

  doc.y = y + 4;
}

function getJsonCasilleros(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};

  const root = value as Record<string, unknown>;
  const datosJSON = root.datosJSON;

  if (datosJSON && typeof datosJSON === "object") {
    const nested = datosJSON as Record<string, unknown>;
    if (nested.casilleros && typeof nested.casilleros === "object") {
      return nested.casilleros as Record<string, number>;
    }
  }

  if (root.casilleros && typeof root.casilleros === "object") {
    return root.casilleros as Record<string, number>;
  }

  return {};
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function atsImportadoPorRuc(lote: { resumenJSON: unknown }, ruc: string) {
  const resumen = asObject(lote.resumenJSON);
  return asObject(resumen.contribuyenteAcceso).ruc === ruc;
}

async function contribuyenteOperativoPorAts(rucAcceso: string, anio?: number, mes?: string) {
  const lotes = await prisma.atsLote.findMany({
    where: {
      ...(anio ? { anio } : {}),
      ...(mes ? { mes } : {}),
    },
    include: {
      contribuyente: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
  });

  return lotes.find((lote) => atsImportadoPorRuc(lote, rucAcceso))?.contribuyente || null;
}

async function contribuyenteParaConsulta(ruc: string, anio?: number, mes?: string) {
  const contribuyenteImportado = await contribuyenteOperativoPorAts(ruc, anio, mes);
  if (contribuyenteImportado) return contribuyenteImportado;

  return prisma.contribuyente.findUnique({
    where: { ruc },
  });
}

function previousMonth(anio: number, mesCodigo: string) {
  const mes = Number(mesCodigo);
  if (mes <= 1) {
    return { anio: anio - 1, mes: "Diciembre" };
  }

  const previousCode = String(mes - 1).padStart(2, "0");
  return { anio, mes: mesesMap[previousCode] || previousCode };
}

export const crearDeclaracion = async (req: Request, res: Response) => {
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

    const declaracion = await prisma.declaracion.create({
      data: {
        formulario: req.body.formulario,
        tipoImpuesto: req.body.tipoImpuesto,
        periodoFiscal: req.body.periodoFiscal,
        anio: Number(req.body.anio),
        mes: req.body.mes || null,
        semestre: req.body.semestre || null,

        ventasPeriodo: Boolean(req.body.ventasPeriodo),
        emitioRetenciones: Boolean(req.body.emitioRetenciones),
        tieneEmpleados: Boolean(req.body.tieneEmpleados),

        baseImponible: Number(req.body.baseImponible || 0),
        impuestoGenerado: Number(req.body.impuestoGenerado || 0),
        valorRetenido: Number(req.body.valorRetenido || 0),
        valorCancelado: Number(req.body.valorCancelado || 0),

        tipoPago: req.body.tipoPago || null,
        banco: req.body.banco || null,
        tipoCuenta: req.body.tipoCuenta || null,
        numeroCuenta: req.body.numeroCuenta || null,

        numeroAdhesion: generarNumeroAdhesion(),
        tipoDeclaracion: req.body.tipoDeclaracion || "Original",
        estado: "Procesada",

        linkFormulario: null,
        linkTalonResumen: null,

        datosJSON: req.body,

        contribuyenteId: contribuyente.id,
      },
    });

    return res.status(201).json({
      message: "Declaración registrada correctamente.",
      declaracion,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error registrando declaración.",
    });
  }
};

export const consultarDeclaraciones = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;
    const { tipoImpuesto, anioDesde, anioHasta, estado } = req.query;

    const lotesImportados = await prisma.atsLote.findMany({
      include: {
        contribuyente: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    const contribuyentesImportadosIds = lotesImportados
      .filter((lote) => atsImportadoPorRuc(lote, ruc))
      .map((lote) => lote.contribuyenteId);

    const declaraciones = await prisma.declaracion.findMany({
      where: {
        OR: [
          {
            contribuyente: {
              ruc,
            },
          },
          ...(contribuyentesImportadosIds.length
            ? [{ contribuyenteId: { in: contribuyentesImportadosIds } }]
            : []),
        ],
        ...(tipoImpuesto && tipoImpuesto !== "Todos"
          ? { tipoImpuesto: String(tipoImpuesto) }
          : {}),
        ...(estado && estado !== "Todas" ? { estado: String(estado) } : {}),
        ...(anioDesde && anioHasta
          ? {
              anio: {
                gte: Number(anioDesde),
                lte: Number(anioHasta),
              },
            }
          : {}),
      },
      orderBy: {
        fechaEnvio: "desc",
      },
    });

    return res.json(declaraciones);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error consultando declaraciones.",
    });
  }
};

export const consultarFormulario103 = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;
    const { anio, mes } = req.query;

    if (!anio || !mes) {
      return res.status(400).json({
        message: "Debe enviar anio y mes.",
      });
    }

    const mesCodigo = String(mes).padStart(2, "0");
    const mesTexto = mesesMap[mesCodigo] || String(mes);

    const contribuyente = await contribuyenteParaConsulta(ruc, Number(anio), mesCodigo);

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    const fechaDesde = new Date(Number(anio), Number(mesCodigo) - 1, 1);
    const fechaHasta = new Date(Number(anio), Number(mesCodigo), 1);

    const compras = await prisma.compra.findMany({
      where: {
        contribuyenteId: contribuyente.id,
        OR: [
          {
            periodoDeclaradoEn103: mesTexto,
          },
          {
            periodoDeclaradoEn103: mesCodigo,
          },
          {
            fechaEmisionRet1: {
              gte: fechaDesde,
              lt: fechaHasta,
            },
          },
          {
            fechaRegistro: {
              gte: fechaDesde,
              lt: fechaHasta,
            },
          },
        ],
      },
    });

    const casilleros: Record<string, number> = {
      "302": 0,
      "352": 0,
      "303": 0,
      "353": 0,
      "304": 0,
      "354": 0,
      "307": 0,
      "357": 0,
      "308": 0,
      "358": 0,
      "309": 0,
      "359": 0,
      "311": 0,
      "361": 0,
      "312": 0,
      "362": 0,
      "322": 0,
      "372": 0,
      "332": 0,
      "343": 0,
      "393": 0,
      "344": 0,
      "394": 0,
      "345": 0,
      "395": 0,
      "346": 0,
      "396": 0,
      "349": 0,
      "399": 0,
      "497": 0,
      "498": 0,
      "499": 0,
      "902": 0,
      "903": 0,
      "904": 0,
      "999": 0,
    };

    let comprasConRetencion = 0;
    let comprasSinRetencion = 0;
    let comprasSinRetencionExcluidas = 0;
    let retencionesLeidas = 0;
    const codigosNoMapeados: string[] = [];

    for (const compra of compras) {
      const retenciones = [
        {
          codigo: compra.codigoRetencion1,
          base: n(compra.baseImponibleRet1),
          valor: n(compra.valorRetenido1),
        },
        {
          codigo: compra.codigoRetencion2,
          base: n(compra.baseImponibleRet2),
          valor: n(compra.valorRetenido2),
        },
        {
          codigo: compra.codigoRetencion3,
          base: n(compra.baseImponibleRet3),
          valor: n(compra.valorRetenido3),
        },
      ].filter((ret) => ret.codigo && (ret.base > 0 || ret.valor > 0));

      if (retenciones.length === 0) {
        comprasSinRetencion += 1;
        comprasSinRetencionExcluidas += 1;
        continue;
      }

      comprasConRetencion += 1;

      for (const ret of retenciones) {
        retencionesLeidas += 1;

        const codigo = String(ret.codigo);
        const map = retencionToCasillero[codigo];

        if (!map) {
          if (!codigosNoMapeados.includes(codigo)) {
            codigosNoMapeados.push(codigo);
          }

          add(casilleros, "346", ret.base);
          add(casilleros, "396", ret.valor);
          continue;
        }

        add(casilleros, map.base, ret.base);
        if (map.retenido) {
          add(casilleros, map.retenido, ret.valor);
        }
      }
    }

    const basesPais = [
      "302",
      "303",
      "304",
      "307",
      "308",
      "309",
      "311",
      "312",
      "322",
      "332",
      "343",
      "344",
      "345",
      "346",
    ];

    const retenidosPais = [
      "352",
      "353",
      "354",
      "357",
      "358",
      "359",
      "361",
      "362",
      "372",
      "393",
      "394",
      "395",
      "396",
    ];

    casilleros["349"] = round2(
      basesPais.reduce((acc, key) => acc + (casilleros[key] || 0), 0)
    );

    casilleros["399"] = round2(
      retenidosPais.reduce((acc, key) => acc + (casilleros[key] || 0), 0)
    );

    casilleros["499"] = round2(casilleros["399"] + casilleros["498"]);
    casilleros["902"] = casilleros["499"];
    casilleros["999"] = round2(casilleros["902"] + casilleros["903"] + casilleros["904"]);

    return res.json({
      ruc: contribuyente.ruc,
      razonSocial: contribuyente.razonSocial,
      anio: Number(anio),
      mes: mesCodigo,
      mesTexto,
      resumen: {
        comprasLeidas: compras.length,
        comprasConRetencion,
        comprasSinRetencion,
        comprasSinRetencionExcluidas,
        retencionesLeidas,
        codigosNoMapeados,
      },
      casilleros,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error consultando Formulario 103.",
    });
  }
};

export const consultarFormulario104 = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;
    const { anio, mes, semestre } = req.query;

    if (!anio || (!mes && !semestre)) {
      return res.status(400).json({
        message: "Debe seleccionar el período fiscal.",
      });
    }

    const anioNumero = Number(anio);
    const mesCodigo = mes ? String(mes).padStart(2, "0") : "";
    const mesTexto = mesCodigo ? mesesMap[mesCodigo] || String(mes) : null;
    const semestreTexto = semestre ? String(semestre) : null;

    const contribuyente = await contribuyenteParaConsulta(ruc, Number(anio), mesCodigo);

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    const fechaDesde = mesCodigo
      ? new Date(anioNumero, Number(mesCodigo) - 1, 1)
      : semestreTexto === "Primer Semestre"
      ? new Date(anioNumero, 0, 1)
      : new Date(anioNumero, 6, 1);

    const fechaHasta = mesCodigo
      ? new Date(anioNumero, Number(mesCodigo), 1)
      : semestreTexto === "Primer Semestre"
      ? new Date(anioNumero, 6, 1)
      : new Date(anioNumero + 1, 0, 1);

    const periodoFiltros = [
      ...(mesTexto ? [{ periodoDeclaradoForm104: mesTexto }, { periodoDeclaradoForm104: mesCodigo }] : []),
      ...(semestreTexto ? [{ periodoDeclaradoForm104: semestreTexto }] : []),
    ];

    const [ventas, compras] = await Promise.all([
      prisma.venta.findMany({
        where: {
          contribuyenteId: contribuyente.id,
          OR: [
            ...periodoFiltros,
            {
              fechaEmision: {
                gte: fechaDesde,
                lt: fechaHasta,
              },
            },
          ],
        },
      }),
      prisma.compra.findMany({
        where: {
          contribuyenteId: contribuyente.id,
          OR: [
            ...periodoFiltros,
            {
              fechaRegistro: {
                gte: fechaDesde,
                lt: fechaHasta,
              },
            },
          ],
        },
      }),
    ]);

    const casilleros: Record<string, number> = {
      "401": 0,
      "402": 0,
      "403": 0,
      "404": 0,
      "405": 0,
      "406": 0,
      "407": 0,
      "408": 0,
      "429": 0,
      "431": 0,
      "500": 0,
      "501": 0,
      "502": 0,
      "507": 0,
      "531": 0,
      "532": 0,
      "563": 0,
      "564": 0,
      "601": 0,
      "602": 0,
      "603": 0,
      "604": 0,
      "605": 0,
      "606": 0,
      "607": 0,
      "608": 0,
      "609": 0,
      "615": 0,
      "617": 0,
      "721": 0,
      "723": 0,
      "725": 0,
      "727": 0,
      "729": 0,
      "731": 0,
      "800": 0,
      "902": 0,
      "903": 0,
      "904": 0,
      "999": 0,
    };

    for (const venta of ventas) {
      add(
        casilleros,
        "401",
        n(venta.baseGravableIva1) + n(venta.baseGravableIva2) + n(venta.baseGravableIva3)
      );
      add(casilleros, "402", n(venta.montoIva1) + n(venta.montoIva2) + n(venta.montoIva3));
      add(casilleros, "403", n(venta.baseTarifa0));
      add(casilleros, "431", n(venta.baseNoObjetoIva) + n(venta.baseExenta));
      add(casilleros, "609", n(venta.valorRetenidoIva));
    }

    for (const compra of compras) {
      const baseGravada =
        n(compra.baseGravableIva1) + n(compra.baseGravableIva2) + n(compra.baseGravableIva3);
      const ivaCompras = n(compra.montoIva1) + n(compra.montoIva2) + n(compra.montoIva3);
      const creditoTributario = n(compra.liqImpIvaCreditoTributario);

      add(casilleros, "500", baseGravada);
      add(casilleros, "501", creditoTributario > 0 ? creditoTributario : ivaCompras);
      add(casilleros, "507", n(compra.baseTarifa0));
      add(casilleros, "531", n(compra.baseNoObjetoIva));
      add(casilleros, "532", n(compra.baseExenta));
      add(casilleros, "721", n(compra.valorRetencionIva30));
      add(casilleros, "723", n(compra.valorRetencionIva50));
      add(casilleros, "725", n(compra.valorRetencionIva70));
      add(casilleros, "727", n(compra.valorRetencionIva100));
      add(casilleros, "729", n(compra.valorRetencionIva100SectorPublico));

      const totalRetenidoIva = n(compra.totalRetencionIvaFte);
      add(
        casilleros,
        "731",
        totalRetenidoIva > 0
          ? totalRetenidoIva
          : n(compra.valorRetencionIva30) +
              n(compra.valorRetencionIva50) +
              n(compra.valorRetencionIva70) +
              n(compra.valorRetencionIva100) +
              n(compra.valorRetencionIva100SectorPublico) +
              n(compra.liqImpSumatoriaRetIva)
      );
    }

    if (mesCodigo) {
      const anterior = previousMonth(anioNumero, mesCodigo);

      const declaracionAnterior = await prisma.declaracion.findFirst({
        where: {
          contribuyenteId: contribuyente.id,
          formulario: {
            contains: "104",
            mode: "insensitive",
          },
          anio: anterior.anio,
          mes: anterior.mes,
        },
        orderBy: {
          fechaEnvio: "desc",
        },
      });

      const casillerosAnteriores = getJsonCasilleros(declaracionAnterior?.datosJSON);
      casilleros["605"] = n(casillerosAnteriores["615"] ?? casillerosAnteriores[615] ?? 0);
      casilleros["606"] = n(casillerosAnteriores["617"] ?? casillerosAnteriores[617] ?? 0);
    }

    const totalVentas =
      casilleros["401"] +
      casilleros["403"] +
      casilleros["405"] +
      casilleros["407"] +
      casilleros["408"] +
      casilleros["431"];
    const ventasConDerecho = casilleros["401"] + casilleros["405"] + casilleros["407"] + casilleros["408"];

    casilleros["429"] = round2(casilleros["402"] + casilleros["404"] + casilleros["406"]);
    casilleros["563"] = totalVentas > 0 ? round2((ventasConDerecho / totalVentas) * 100) : 0;
    casilleros["564"] = round2(casilleros["501"] * (casilleros["563"] / 100));
    casilleros["602"] = casilleros["564"];

    const creditoDisponible = round2(casilleros["564"] + casilleros["605"] + casilleros["606"] + casilleros["609"]);
    casilleros["601"] = Math.max(round2(casilleros["429"] - casilleros["564"]), 0);
    casilleros["902"] = Math.max(round2(casilleros["429"] - creditoDisponible), 0);

    const saldoCompras = Math.max(round2(casilleros["564"] + casilleros["605"] - casilleros["429"]), 0);
    const impuestoLuegoCreditoCompras = Math.max(round2(casilleros["429"] - casilleros["564"] - casilleros["605"]), 0);
    const saldoRetenciones = Math.max(
      round2(casilleros["606"] + casilleros["609"] - impuestoLuegoCreditoCompras),
      0
    );

    casilleros["615"] = saldoCompras;
    casilleros["617"] = saldoRetenciones;
    casilleros["999"] = round2(casilleros["902"] + casilleros["903"] + casilleros["904"]);

    return res.json({
      ruc: contribuyente.ruc,
      razonSocial: contribuyente.razonSocial,
      anio: anioNumero,
      mes: mesCodigo || null,
      mesTexto,
      semestre: semestreTexto,
      resumen: {
        ventasLeidas: ventas.length,
        comprasLeidas: compras.length,
        requiereRevision: ["403/405", "407", "408", "502", "603", "604", "607", "608", "800"],
      },
      casilleros,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error consultando Formulario 104.",
    });
  }
};

export const descargarDeclaracionPdf = async (req: Request, res: Response) => {
  try {
    const { declaracionId } = req.params;

    const declaracion = await prisma.declaracion.findUnique({
      where: { id: declaracionId },
      include: { contribuyente: true },
    });

    if (!declaracion) {
      return res.status(404).json({ message: "Declaración no encontrada." });
    }

    const root = asObject(declaracion.datosJSON);
    const nested = asObject(root.datosJSON);
    const identificacion = asObject(root.identificacion || nested.identificacion);
    const resumen = asObject(root.resumen || nested.resumen);
    const casilleros = getJsonCasilleros(declaracion.datosJSON);
    const formulario = declaracion.formulario.includes("104") ? "104" : declaracion.formulario.includes("103") ? "103" : "";

    return sendPdf(
      res,
      `Formulario_${formulario || "Declaracion"}_${declaracion.contribuyente.ruc}_${declaracion.id}.pdf`,
      (doc) => {
        pdfTitle(
          doc,
          `FORMULARIO ${formulario || ""}`.trim(),
          declaracion.formulario
        );

        pdfKV(doc, "RUC", identificacion.ruc || declaracion.contribuyente.ruc);
        pdfKV(doc, "Razón social", identificacion.razonSocial || declaracion.contribuyente.razonSocial);
        pdfKV(doc, "Período", `${declaracion.mes || declaracion.semestre || "-"} / ${declaracion.anio}`);
        pdfKV(doc, "Número de adhesión", declaracion.numeroAdhesion);
        pdfKV(doc, "Estado", declaracion.estado);
        pdfKV(doc, "Fecha de generación", fechaLocal(new Date()));

        const rows = Object.entries(casilleros)
          .filter(([, value]) => Number(value || 0) !== 0)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([key, value]) => [`Casillero ${key}`, money(value)] as [string, string]);

        pdfTable(
          doc,
          "VALORES DECLARADOS",
          rows.length ? rows : [["Sin valores calculados", "0.00"]]
        );

        pdfTable(doc, "RESUMEN", [
          ["Base imponible", money(declaracion.baseImponible)],
          ["Impuesto generado", money(declaracion.impuestoGenerado)],
          ["Valor retenido", money(declaracion.valorRetenido)],
          ["Valor cancelado", money(declaracion.valorCancelado)],
          ["Registros leídos", String(resumen.comprasLeidas || resumen.ventasLeidas || "-")],
        ]);

        doc
          .moveDown(1.2)
          .fontSize(8)
          .fillColor("#475569")
          .text(
            "Documento generado dinámicamente a partir de la declaración almacenada en el sistema.",
            { align: "center" }
          );
      }
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error generando PDF de declaración.",
    });
  }
};

export const consultarFormulario107 = async (req: Request, res: Response) => {
  try {
    const { ruc } = req.params;
    const { anio } = req.query;

    const contribuyente = await prisma.contribuyente.findUnique({
      where: { ruc },
    });

    if (!contribuyente) {
      return res.status(404).json({
        message: "Contribuyente no encontrado.",
      });
    }

    return res.json({
      anio,
      empleadores: [
        {
          ruc: "0999999999001",
          razonSocial: "EMPRESA DEMO ECUADOR S.A.",
        },
        {
          ruc: "1799999999001",
          razonSocial: "CORPORACION TRIBUTARIA DEL ECUADOR",
        },
      ],
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error consultando formulario 107.",
    });
  }
};
