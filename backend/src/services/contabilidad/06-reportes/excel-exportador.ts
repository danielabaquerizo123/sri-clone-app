import * as XLSX from "xlsx-js-style";
import type { AccountingEngineResult } from "../contratos";
import type { PreviewEntry } from "../04-asientos/constructor-asiento.service";
import type { LibroMayorFolio, LibroMayorResponse } from "./libro-mayor/libro-mayor.types";
import type { BalanceComprobacionResponse } from "./balance-comprobacion.generator";
import type { EstadoResultadosResponse } from "./estado-resultados.generator";

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
    balanceComprobacion?: BalanceComprobacionResponse;
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
    if (params.balanceComprobacion) {
      appendBalanceComprobacionSheet(workbook, params.balanceComprobacion);
    }
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true }) as Buffer;
  }

  exportBalanceComprobacion(result: BalanceComprobacionResponse): Buffer {
    const workbook = XLSX.utils.book_new();
    appendBalanceComprobacionSheet(workbook, result);
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true }) as Buffer;
  }

  exportProcesosContables(params: {
    ruc?: string;
    razonSocial?: string;
    periodo?: string;
    asientos: PreviewEntry[];
    libroMayor: LibroMayorResponse;
    balanceComprobacion: BalanceComprobacionResponse;
    estadoResultados: EstadoResultadosResponse;
  }): Buffer {
    const workbook = XLSX.utils.book_new();
    appendLibroDiarioSheet(workbook, params);
    appendLibroMayorSheet(workbook, params.libroMayor);
    appendBalanceComprobacionSheet(workbook, params.balanceComprobacion, "Balance de Comprobación");
    appendEstadoResultadosSheet(workbook, params.estadoResultados);
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true }) as Buffer;
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
  const rows: Array<Array<string | number | Date>> = [
    [headerCompany(params), "", "", "", ""],
    ["Libro Diario", "", "", "", ""],
    [`Periodo: ${params.periodo || ""}`, "", "", "", ""],
    ["Expresados en Dólares", "", "", "", ""],
    ["", "", "", "", ""],
    ["FECHA", "CODIGO", "DETALLE", "DEBE", "HABER"],
  ];
  const merges: XLSX.Range[] = [
    mergeAcross(0),
    mergeAcross(1),
    mergeAcross(2),
    mergeAcross(3),
  ];
  const glosaRows: number[] = [];
  const numberRows: number[] = [];
  let totalDebe = 0;
  let totalHaber = 0;

  params.asientos.forEach((entry, index) => {
    const lineas = Array.isArray(entry.lineas) ? entry.lineas : [];
    numberRows.push(rows.length);
    rows.push([index + 1, "", "", "", ""]);

    lineas.forEach((line, lineIndex) => {
      const debe = money(line.debe);
      const haber = money(line.haber);
      totalDebe = money(totalDebe + debe);
      totalHaber = money(totalHaber + haber);
      rows.push([
        lineIndex === 0 ? journalDate(entry) : "",
        line.codigo || "",
        line.cuenta || "",
        debe > 0 ? debe : "",
        haber > 0 ? haber : "",
      ]);
    });
    glosaRows.push(rows.length);
    rows.push(["", "", journalDescription(entry), "", ""]);
    rows.push(["", "", "", "", ""]);
  });

  rows.push(["", "", "TOTALES", totalDebe, totalHaber]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 72 },
    { wch: 14 },
    { wch: 14 },
  ];
  sheet["!merges"] = [
    ...merges,
    ...glosaRows.map((row) => ({ s: { r: row, c: 2 }, e: { r: row, c: 4 } })),
  ];
  sheet["!freeze"] = { xSplit: 0, ySplit: 6 };
  applyLibroDiarioFormats(sheet, rows.length, glosaRows, numberRows);
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

function appendBalanceComprobacionSheet(workbook: XLSX.WorkBook, result: BalanceComprobacionResponse, sheetName = "Balance Comprobacion") {
  const rows: Array<Array<string | number>> = [
    [result.empresa.razonSocial || "No disponible", "", "", "", "", "", ""],
    [`RUC: ${result.empresa.ruc || ""}`, "", "", "", "", "", ""],
    ["Balance de Comprobación", "", "", "", "", "", ""],
    [`Periodo: ${periodLabelFromBalance(result)}`, "", "", "", "", "", ""],
    ["Expresado en Dólares", "", "", "", "", "", ""],
    [],
    ["N°", "Cuenta", "Código", "Sumas", "", "Saldos", ""],
    ["", "", "", "Debe", "Haber", "Deudor", "Acreedor"],
  ];

  result.filas.forEach((row) => {
    rows.push([
      row.numero,
      row.cuenta,
      row.codigo,
      moneyOrBlank(row.debe),
      moneyOrBlank(row.haber),
      moneyOrBlank(row.deudor),
      moneyOrBlank(row.acreedor),
    ]);
  });

  rows.push([
    "",
    "TOTALES",
    "",
    money(result.resumen.totalDebe),
    money(result.resumen.totalHaber),
    money(result.resumen.totalDeudor),
    money(result.resumen.totalAcreedor),
  ]);
  rows.push([]);
  rows.push(["Verificación sumas", result.resumen.cuadradoSumas ? "CUADRADO" : "NO CUADRADO", "", "", "", "", ""]);
  rows.push(["Verificación saldos", result.resumen.cuadradoSaldos ? "CUADRADO" : "NO CUADRADO", "", "", "", "", ""]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 8 },
    { wch: 52 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ];
  sheet["!autofilter"] = { ref: `A8:G${Math.max(rows.length - 4, 8)}` };
  sheet["!freeze"] = { xSplit: 0, ySplit: 8 };
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
}

function appendEstadoResultadosSheet(workbook: XLSX.WorkBook, result: EstadoResultadosResponse) {
  const rows: Array<Array<string | number>> = [
    [result.empresa.razonSocial, "", ""],
    [`RUC: ${result.empresa.ruc}`, "", ""],
    ["Estado de Resultados", "", ""],
    [`Periodo: ${[result.periodo.mes, result.periodo.anio].filter(Boolean).join("/")}`, "", ""],
    ["Expresado en Dólares", "", ""],
    [],
    ["Código", "Detalle", "Valor"],
  ];
  result.lineas.forEach((linea) => rows.push([linea.codigo, linea.cuenta, money(linea.valor)]));
  rows.push([]);
  rows.push(["", "Utilidad bruta", estadoResultadosMoney(result, result.totales.utilidadBruta)]);
  rows.push(["", "Total gastos operacionales", money(result.totales.totalGastosOperacionales)]);
  rows.push(["", "Utilidad operacional", estadoResultadosMoney(result, result.totales.utilidadOperacional)]);
  rows.push(["", "Resultado antes de impuesto", estadoResultadosMoney(result, result.totales.resultadoAntesImpuesto)]);
  rows.push(["", result.resultadoFinal.etiqueta, estadoResultadosMoney(result, result.resultadoFinal.valor)]);
  result.advertencias.forEach((advertencia) => rows.push(["", advertencia, ""]));

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 18 }, { wch: 62 }, { wch: 18 }];
  sheet["!freeze"] = { xSplit: 0, ySplit: 7 };
  XLSX.utils.book_append_sheet(workbook, sheet, "Estado de Resultados");
}

function estadoResultadosMoney(result: EstadoResultadosResponse, value: unknown) {
  return result.resultadoDeterminado === false ? "No determinado" : money(value);
}

function headerCompany(params: { ruc?: string; razonSocial?: string }) {
  const razonSocial = String(params.razonSocial || "No disponible").trim();
  const ruc = String(params.ruc || "").trim();
  return ruc ? `${razonSocial} - RUC ${ruc}` : razonSocial;
}

function mergeAcross(row: number): XLSX.Range {
  return { s: { r: row, c: 0 }, e: { r: row, c: 4 } };
}

function journalDate(entry: PreviewEntry) {
  const raw = (entry as any).fechaDate || entry.fecha;
  if (typeof entry.fecha === "string") {
    const match = entry.fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${Number(match[3])}/${Number(match[2])}/${match[1]}`;
  }

  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return String(entry.fecha || "");
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
}

function applyLibroDiarioFormats(
  sheet: XLSX.WorkSheet,
  rowCount: number,
  glosaRows: number[],
  numberRows: number[]
) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || `A1:E${rowCount}`);
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[address];
      if (!cell) continue;
      (cell as any).s = {
        ...(cell as any).s,
        font: { color: { rgb: "000000" } },
        fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };
    }
  }

  for (let row = 0; row <= 3; row += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
    if (!cell) continue;
    (cell as any).s = {
      ...(cell as any).s,
      font: { bold: row === 1, italic: row !== 1, sz: row === 1 ? 14 : 12, color: { rgb: "000000" } },
      alignment: { horizontal: "center" },
    };
  }

  for (let col = 0; col <= 4; col += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 5, c: col })];
    if (!cell) continue;
    (cell as any).s = {
      ...(cell as any).s,
      font: { bold: true, color: { rgb: "000000" } },
      alignment: { horizontal: "center" },
    };
  }

  numberRows.forEach((row) => {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
    if (!cell) return;
    (cell as any).s = {
      ...(cell as any).s,
      font: { bold: true, color: { rgb: "000000" } },
      alignment: { horizontal: "right" },
    };
  });

  glosaRows.forEach((row) => {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: 2 })];
    if (!cell) return;
    (cell as any).s = {
      ...(cell as any).s,
      font: { italic: true, color: { rgb: "000000" } },
    };
  });

  for (let row = 6; row < rowCount; row += 1) {
    const dateCell = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
    if (dateCell?.t === "d") {
      dateCell.z = "d/m/yyyy";
    }
    for (const col of [3, 4]) {
      const moneyCell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (moneyCell?.t === "n") {
        moneyCell.z = '"$" #,##0.00';
      }
    }
  }
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

function moneyOrBlank(value: unknown) {
  const amount = money(value);
  return amount > 0 ? amount : "";
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

function periodLabelFromBalance(result: BalanceComprobacionResponse) {
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
  const tipo = evidenceValue(entry, "tipoComprobante");
  const tipoDocumento = tipo ? `${tipo}-${tipoComprobanteLabel(tipo)}` : String(entry.documentoOrigen || "").trim();

  if (entry.tipoEvento === "PAGO_PROVEEDOR") {
    return journalGlosa("V. Pago Compra", tipoDocumento, thirdParty);
  }
  if (entry.tipoEvento === "DEVENGO_COMPRA" || entry.tipoEvento === "NOTA_CREDITO_COMPRA" || entry.tipoEvento === "NOTA_DEBITO_COMPRA") {
    return journalGlosa("V. Compra", tipoDocumento, thirdParty);
  }
  if (entry.tipoEvento === "COBRO_CLIENTE") {
    return ["V. Cobro Venta a", thirdParty].filter(Boolean).join(" ");
  }
  if (entry.tipoEvento === "DEVENGO_VENTA" || entry.tipoEvento === "NOTA_CREDITO_VENTA" || entry.tipoEvento === "NOTA_DEBITO_VENTA") {
    return ["V. Venta a", thirdParty].filter(Boolean).join(" ");
  }

  return entry.glosa || entry.descripcion || "";
}

function journalGlosa(prefix: string, tipoDocumento: string, thirdParty: string) {
  const source = tipoDocumento ? `s/${tipoDocumento}` : "";
  return [prefix, source, thirdParty ? "a" : "", thirdParty].filter(Boolean).join(" ");
}

function tipoComprobanteLabel(tipo: string) {
  const normalized = tipo.trim();
  const labels: Record<string, string> = {
    "01": "Factura",
    "03": "Liquidación de compra",
    "04": "Nota de crédito",
    "05": "Nota de débito",
    "07": "Comprobante de retención",
  };
  return labels[normalized] || "Comprobante";
}
