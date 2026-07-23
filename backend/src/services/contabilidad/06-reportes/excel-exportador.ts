import * as XLSX from "xlsx";
import type { AccountingEngineResult } from "../contratos";
import type { PreviewEntry } from "../04-asientos/constructor-asiento.service";
import type { LibroMayorFolio, LibroMayorResponse } from "./libro-mayor/libro-mayor.types";

export class AccountingExcelExporter {
  prepare(_result: AccountingEngineResult): Buffer | null {
    return null;
  }

  exportLibroDiario(params: {
    ruc?: string;
    razonSocial?: string;
    periodo?: string;
    asientos: PreviewEntry[];
  }): Buffer {
    return this.exportReporteContable({
      ruc: params.ruc,
      razonSocial: params.razonSocial,
      periodo: params.periodo,
      asientos: params.asientos,
    });
  }

  exportReporteContable(params: {
    ruc?: string;
    razonSocial?: string;
    periodo?: string;
    asientos: PreviewEntry[];
    libroMayor?: LibroMayorResponse;
    warnings?: string[];
  }): Buffer {
    const workbook = XLSX.utils.book_new();
    appendResumenSheet(workbook, params);
    appendLibroDiarioSheet(workbook, params);
    if (params.libroMayor) {
      appendLibroMayorSheet(workbook, params.libroMayor);
    } else {
      appendEmptyLibroMayorSheet(workbook, params);
    }
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }
}

function appendResumenSheet(workbook: XLSX.WorkBook, params: {
  ruc?: string;
  razonSocial?: string;
  periodo?: string;
  asientos: PreviewEntry[];
  libroMayor?: LibroMayorResponse;
  warnings?: string[];
}) {
  const journalTotals = journalTotalsFromEntries(params.asientos);
  const mayor = params.libroMayor;
  const rows: Array<Array<string | number>> = [
    ["Reporte Contable"],
    ["RUC", params.ruc || mayor?.empresa.ruc || ""],
    ["Razón social", params.razonSocial || mayor?.empresa.razonSocial || ""],
    ["Periodo", params.periodo || periodLabel(mayor) || ""],
    ["Fecha y hora de generación", new Date().toISOString()],
    [],
    ["Cantidad de asientos", params.asientos.length],
    ["Cantidad de líneas del Libro Diario", journalTotals.lines],
    ["Cantidad de cuentas mayorizadas", mayor?.totalCuentas || 0],
    ["Total Debe", journalTotals.totalDebe],
    ["Total Haber", journalTotals.totalHaber],
    ["Estado", journalTotals.totalDebe === journalTotals.totalHaber ? "CUADRADO" : "NO CUADRADO"],
    [],
    ["Advertencias"],
    ...((params.warnings || []).length > 0 ? (params.warnings || []).map((warning) => [warning]) : [["Sin advertencias"]]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 34 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "Resumen");
}

function appendLibroDiarioSheet(workbook: XLSX.WorkBook, params: {
  ruc?: string;
  razonSocial?: string;
  periodo?: string;
  asientos: PreviewEntry[];
}) {
  const rows: Array<Array<string | number>> = [
    [params.razonSocial || "No disponible", "", "", "", "", "", "", ""],
    [`RUC: ${params.ruc || ""}`, "", "", "", "", "", "", ""],
    ["Libro Diario", "", "", "", "", "", "", ""],
    [`Periodo: ${params.periodo || ""}`, "", "", "", "", "", "", ""],
    ["Expresados en Dolares", "", "", "", "", "", "", ""],
    [],
    ["FECHA", "N.º ASIENTO", "DOCUMENTO", "GLOSA", "CODIGO", "CUENTA", "DEBE", "HABER"],
  ];
  let totalDebe = 0;
  let totalHaber = 0;

  params.asientos.forEach((entry, index) => {
    const asientoNumero = `AS-${index + 1}`;
    const lineas = Array.isArray(entry.lineas) ? entry.lineas : [];
    lineas.forEach((line) => {
      const debe = money(line.debe);
      const haber = money(line.haber);
      totalDebe = money(totalDebe + debe);
      totalHaber = money(totalHaber + haber);
      rows.push([
        String(entry.fecha || "").slice(0, 10),
        asientoNumero,
        String(entry.documentoOrigen || ""),
        "",
        line.codigo || "",
        line.cuenta || "",
        debe > 0 ? debe : "",
        haber > 0 ? haber : "",
      ]);
    });
    rows.push(["", asientoNumero, String(entry.documentoOrigen || ""), journalDescription(entry), "", "", "", ""]);
    rows.push([]);
  });

  rows.push(["", "", "", "TOTALES", "", "", totalDebe, totalHaber]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 58 },
    { wch: 18 },
    { wch: 48 },
    { wch: 14 },
    { wch: 14 },
  ];
  sheet["!autofilter"] = { ref: `A7:H${Math.max(rows.length, 7)}` };
  sheet["!freeze"] = { xSplit: 0, ySplit: 7 };
  XLSX.utils.book_append_sheet(workbook, sheet, "Libro Diario");
}

function appendLibroMayorSheet(workbook: XLSX.WorkBook, result: LibroMayorResponse) {
  const rows: Array<Array<string | number>> = [
    ["Libro Mayor"],
    [`Periodo contable: ${periodLabel(result)}`],
    [`RUC: ${result.empresa.ruc}`],
    [`Razón social: ${result.empresa.razonSocial}`],
    ["Moneda: Dólares (USD)"],
    [],
  ];

  result.folios.forEach((folio) => {
    appendFolioRows(rows, folio);
    rows.push([]);
    rows.push([]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 14 },
    { wch: 16 },
    { wch: 58 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
  ];
  sheet["!freeze"] = { xSplit: 0, ySplit: 6 };
  XLSX.utils.book_append_sheet(workbook, sheet, "Libro Mayor");
}

function appendEmptyLibroMayorSheet(workbook: XLSX.WorkBook, params: { ruc?: string; razonSocial?: string; periodo?: string }) {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Libro Mayor"],
    [`Periodo: ${params.periodo || ""}`],
    [`RUC: ${params.ruc || ""}`],
    [`Razón social: ${params.razonSocial || ""}`],
    ["Moneda: Dólares (USD)"],
    [],
    ["No existe un Libro Diario generado para este lote y periodo. Genere primero el Libro Diario para consultar el Libro Mayor."],
  ]);
  sheet["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "Libro Mayor");
}

function appendFolioRows(rows: Array<Array<string | number>>, folio: LibroMayorFolio) {
  rows.push([`CÓDIGO Y DENOMINACIÓN DE LA CUENTA CONTABLE: ${folio.codigoCuenta} — ${folio.nombreCuenta}`]);
  rows.push([]);
  rows.push(["FECHA", "N.º ASIENTO", "GLOSA DE LA OPERACIÓN", "MOVIMIENTOS", "", "SALDOS", ""]);
  rows.push(["", "", "", "DEBE", "HABER", "DEUDOR", "ACREEDOR"]);
  folio.movimientos.forEach((movement) => {
    rows.push([
      movement.fecha,
      movement.numeroAsiento ? `AS-${movement.numeroAsiento}` : "",
      movement.descripcion,
      money(movement.debe),
      money(movement.haber),
      money(movement.saldoDeudor),
      money(movement.saldoAcreedor),
    ]);
  });
  rows.push([
    "",
    "",
    "TOTALES",
    money(folio.totalDebe),
    money(folio.totalHaber),
    money(folio.saldoFinalDeudor),
    money(folio.saldoFinalAcreedor),
  ]);
}

function money(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? Math.round((numberValue + Number.EPSILON) * 100) / 100 : 0;
}

function journalTotalsFromEntries(asientos: PreviewEntry[]) {
  return asientos.reduce(
    (acc, entry) => {
      const lineas = Array.isArray(entry.lineas) ? entry.lineas : [];
      acc.lines += lineas.length;
      lineas.forEach((line) => {
        acc.totalDebe = money(acc.totalDebe + money(line.debe));
        acc.totalHaber = money(acc.totalHaber + money(line.haber));
      });
      return acc;
    },
    { lines: 0, totalDebe: 0, totalHaber: 0 }
  );
}

function periodLabel(result?: LibroMayorResponse) {
  if (!result) return "";
  return [result.periodo.mes, result.periodo.anio].filter(Boolean).join("/");
}

function evidenceValue(entry: PreviewEntry, field: string) {
  const evidencias = Array.isArray(entry.evidencias) ? entry.evidencias : [];
  const found = evidencias.find((item: any) => item?.campo === field);
  return String((found as any)?.valor || "").trim();
}

function tercero(entry: PreviewEntry) {
  const value = (entry as any).tercero;
  if (!value || typeof value !== "object") return "";
  const razonSocial = String(value.razonSocial || "").trim();
  const identificacion = String(value.identificacion || "").trim();
  return razonSocial && identificacion ? `${razonSocial} (${identificacion})` : razonSocial || identificacion;
}

function journalDescription(entry: PreviewEntry) {
  const thirdParty = tercero(entry);
  const document = String(entry.documentoOrigen || "").trim();
  const tipo = evidenceValue(entry, "tipoComprobante");
  const tipoDocumento = tipo ? `${tipo} ${document}` : document;

  if (entry.tipoEvento === "PAGO_PROVEEDOR") {
    return ["V. Pago Compra s/", tipoDocumento, thirdParty ? "a" : "", thirdParty].filter(Boolean).join(" ");
  }
  if (entry.tipoEvento === "DEVENGO_COMPRA" || entry.tipoEvento === "NOTA_CREDITO_COMPRA" || entry.tipoEvento === "NOTA_DEBITO_COMPRA") {
    return ["V. Compra s/", tipoDocumento, thirdParty ? "a" : "", thirdParty].filter(Boolean).join(" ");
  }
  if (entry.tipoEvento === "COBRO_CLIENTE") {
    return ["V. Cobro Venta a", thirdParty].filter(Boolean).join(" ");
  }
  if (entry.tipoEvento === "DEVENGO_VENTA" || entry.tipoEvento === "NOTA_CREDITO_VENTA" || entry.tipoEvento === "NOTA_DEBITO_VENTA") {
    return ["V. Venta a", thirdParty].filter(Boolean).join(" ");
  }

  return entry.glosa || entry.descripcion || "";
}
