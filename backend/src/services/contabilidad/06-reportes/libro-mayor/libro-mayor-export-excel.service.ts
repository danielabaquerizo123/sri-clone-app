import * as XLSX from "xlsx";
import type { LibroMayorFolio, LibroMayorResponse } from "./libro-mayor.types";

function setWidths(sheet: XLSX.WorkSheet) {
  sheet["!cols"] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 58 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
  ];
}

export class LibroMayorExportExcelService {
  export(result: LibroMayorResponse): Buffer {
    const workbook = XLSX.utils.book_new();
    const rows: Array<Array<string | number>> = [
      [result.origen === "PREVIEW" ? "LIBRO MAYOR - BORRADOR" : "LIBRO MAYOR"],
      [`Estado: ${result.estadoReporte}`],
      [`Razón social: ${result.empresa.razonSocial}`],
      [`RUC: ${result.empresa.ruc}`],
      [`Periodo contable: ${periodLabel(result)}`],
      ["Moneda: Dólares (USD)"],
      [],
    ];
    for (const folio of result.folios) {
      appendFolioRows(rows, folio);
      rows.push([]);
      rows.push([]);
    }
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!freeze"] = { xSplit: 0, ySplit: 7 };
    setWidths(sheet);
    XLSX.utils.book_append_sheet(workbook, sheet, "Libro Mayor");

    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
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
      Number(movement.debe || 0),
      Number(movement.haber || 0),
      Number(movement.saldoDeudor || 0),
      Number(movement.saldoAcreedor || 0),
    ]);
  });
  rows.push([
    "",
    "",
    "TOTALES",
    Number(folio.totalDebe || 0),
    Number(folio.totalHaber || 0),
    Number(folio.saldoFinalDeudor || 0),
    Number(folio.saldoFinalAcreedor || 0),
  ]);
}

function periodLabel(result: LibroMayorResponse) {
  return [result.periodo.mes, result.periodo.anio].filter(Boolean).join("/");
}
