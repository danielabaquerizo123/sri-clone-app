import * as XLSX from "xlsx";

type ParsedSheet = {
  label: "COMPRAS" | "VENTAS" | "GASTOS";
  sheetName: string;
  headerRow: number;
  headers: string[];
  rows: Record<string, any>[];
};

type LibroDiarioIssue = {
  tipo: "ERROR" | "WARNING" | "INFO";
  hoja: string;
  fila: number;
  campo: string;
  mensaje: string;
};

type LibroDiarioLine = {
  codigo: string;
  cuenta: string;
  debe: number;
  haber: number;
};

type LibroDiarioEntry = {
  numero: number;
  fecha: string;
  glosa: string;
  lineas: LibroDiarioLine[];
};

type SourceDocument = {
  hoja: "COMPRAS" | "VENTAS" | "GASTOS";
  fila: number;
  fecha: string;
  tipoComprobante: string;
  tipoComprobanteLabel: string;
  tercero: string;
  identificacion: string;
  documento: string;
  base: number;
  iva: number;
  total: number;
};

const ACCOUNTS = {
  bancos: { codigo: "1.01.01.03", cuenta: "Bancos" },
  cuentasPorCobrar: { codigo: "1.01.02.01", cuenta: "Cuentas por Cobrar Clientes" },
  ivaCompras: { codigo: "1.01.05.01", cuenta: "IVA Compras" },
  proveedores: { codigo: "2.01.01.01", cuenta: "Cuentas por Pagar Proveedores" },
  ivaVentas: { codigo: "2.01.07.01", cuenta: "IVA Ventas" },
  ventas: { codigo: "4.01.01.01", cuenta: "Ventas Locales" },
  gastos: { codigo: "5.02.02.29", cuenta: "Gastos Administrativos" },
};

function normalizeText(value: any): string {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/\r?\n|\r/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeForMatch(value: any): string {
  return normalizeText(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function normalizeKey(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[%().:/\\"]/g, " ")
    .replace(/__/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function onlyDigits(value: any): string {
  return normalizeText(value).replace(/\D/g, "");
}

function firstCode(value: any, length = 2): string {
  const match = normalizeText(value).match(/\d+/);
  if (!match) return "";
  return match[0].padStart(length, "0").slice(0, length);
}

function pad(value: any, length: number): string {
  const digits = onlyDigits(value);
  if (!digits) return "";
  return digits.padStart(length, "0").slice(0, length);
}

function money(value: any): number {
  const raw = normalizeText(value);
  if (!raw || raw === "-" || raw === "–" || raw === "—") return 0;

  let normalized = raw.replace(/\s/g, "");
  const parenthesizedNegative = /^\(.+\)$/.test(normalized);

  if (parenthesizedNegative) {
    normalized = `-${normalized.slice(1, -1)}`;
  }

  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(",", ".");
  }

  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue)) return 0;

  return Math.round(Math.abs(numberValue) * 100) / 100;
}

function add(values: number[]) {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
}

function getMergedValue(sheet: XLSX.WorkSheet, row: number, col: number): string {
  const address = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  const directValue = sheet[address]?.v;

  if (directValue !== undefined && directValue !== null && directValue !== "") {
    return normalizeText(directValue);
  }

  for (const merge of sheet["!merges"] || []) {
    if (
      row - 1 >= merge.s.r &&
      row - 1 <= merge.e.r &&
      col - 1 >= merge.s.c &&
      col - 1 <= merge.e.c
    ) {
      return normalizeText(sheet[XLSX.utils.encode_cell(merge.s)]?.v);
    }
  }

  return "";
}

function isNoiseHeader(value: string): boolean {
  const text = normalizeText(value).toUpperCase();

  return (
    !text ||
    text === "-" ||
    text === "–" ||
    text === "—" ||
    text === "(OPCIONAL)" ||
    text.includes("OBLIGATORIO") ||
    text.includes("REGISTROS") ||
    text.includes("DETALLE DE") ||
    text.includes("RETENCIONES DE IMPUESTO") ||
    text.includes("RETENCIONES AL IMPUESTO") ||
    text.includes("INFORMACION") ||
    text.includes("INFORMACIÓN") ||
    text.includes("CONTABILIZACION") ||
    text.includes("CONTABILIZACIÓN") ||
    text.includes("DATOS CONFIGURACION") ||
    text.includes("DATOS SRI") ||
    text.includes("DATOS CONTRIBUYENTE") ||
    text.includes("OTROS DATOS")
  );
}

function joinHeaderCells(parts: string[]): string {
  const cleaned = parts
    .map((part) => normalizeText(part))
    .filter((part) => part && !isNoiseHeader(part));

  if (cleaned.length === 0) {
    return normalizeText(parts.find(Boolean) || "");
  }

  return normalizeText(cleaned.join(" "));
}

function makeUniqueHeaders(headers: string[]): string[] {
  const counts = new Map<string, number>();

  return headers.map((header, index) => {
    const base = header || `COLUMNA_${index + 1}`;
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}__${count + 1}`;
  });
}

function scoreHeaderRow(values: any[], keywords: string[]) {
  const normalizedCells = values.map(normalizeForMatch);
  const joined = normalizedCells.join(" ");

  return keywords.reduce((score, keyword) => {
    const wanted = normalizeForMatch(keyword);
    if (!wanted) return score;

    if (normalizedCells.some((cell) => cell === wanted || cell.includes(wanted))) {
      return score + 2;
    }

    return joined.includes(wanted) ? score + 1 : score;
  }, 0);
}

function findHeaderRow(sheet: XLSX.WorkSheet, keywords: string[]) {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true,
  }) as any[][];

  let best = { row: 1, score: 0 };

  rows.slice(0, 30).forEach((row, index) => {
    const score = scoreHeaderRow(row, keywords);
    if (score > best.score) {
      best = { row: index + 1, score };
    }
  });

  return best.score > 0 ? best.row : 1;
}

function buildHeaders(sheet: XLSX.WorkSheet, headerRow: number): string[] {
  const ref = sheet["!ref"];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const headers: string[] = [];

  for (let col = range.s.c + 1; col <= range.e.c + 1; col++) {
    const current = getMergedValue(sheet, headerRow, col);
    const next = getMergedValue(sheet, headerRow + 1, col);
    headers.push(joinHeaderCells([current, next]));
  }

  return makeUniqueHeaders(headers);
}

function isEmptyRow(row: Record<string, any>) {
  return Object.entries(row).every(
    ([key, value]) =>
      key.startsWith("__") ||
      value === null ||
      value === undefined ||
      String(value).trim() === ""
  );
}

function parseDataRows(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  label: "COMPRAS" | "VENTAS" | "GASTOS",
  keywords: string[]
): ParsedSheet {
  const ref = sheet["!ref"];

  if (!ref) {
    return { label, sheetName, headerRow: 0, headers: [], rows: [] };
  }

  const headerRow = findHeaderRow(sheet, keywords);
  const headers = buildHeaders(sheet, headerRow);
  const range = XLSX.utils.decode_range(ref);
  const rows: Record<string, any>[] = [];

  for (let rowNum = headerRow + 1; rowNum <= range.e.r + 1; rowNum++) {
    const rowData: Record<string, any> = { __filaExcel: rowNum };

    headers.forEach((header, index) => {
      const cellAddress = XLSX.utils.encode_cell({ r: rowNum - 1, c: index });
      rowData[header] = normalizeText(sheet[cellAddress]?.v);
    });

    if (!isEmptyRow(rowData)) {
      rows.push(rowData);
    }
  }

  return { label, sheetName, headerRow, headers, rows };
}

function sheetText(workbook: XLSX.WorkBook, name: string): string {
  const sheet = workbook.Sheets[name];
  if (!sheet) return "";

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  }) as any[][];

  return normalizeForMatch(rows.slice(0, 40).map((row) => row.join(" ")).join(" "));
}

function findSheetName(workbook: XLSX.WorkBook, preferredNames: string[], markers: string[]) {
  const byName = workbook.SheetNames.find((name) => {
    const normalized = normalizeForMatch(name);
    return preferredNames.some((preferred) => normalized === normalizeForMatch(preferred));
  });

  if (byName) return byName;

  return workbook.SheetNames.find((name) => {
    const text = sheetText(workbook, name);
    return markers.some((marker) => text.includes(normalizeForMatch(marker)));
  });
}

function get(row: Record<string, any>, keys: string[]): string {
  const rowKeys = Object.keys(row);

  for (const wanted of keys) {
    const wantedNorm = normalizeKey(wanted);
    const exact = rowKeys.find((key) => normalizeKey(key) === wantedNorm);
    if (exact) return normalizeText(row[exact]);

    const partial = rowKeys.find((key) => {
      const keyNorm = normalizeKey(key);
      return keyNorm.includes(wantedNorm) || wantedNorm.includes(keyNorm);
    });
    if (partial) return normalizeText(row[partial]);
  }

  return "";
}

function comprobanteLabel(code: string) {
  const labels: Record<string, string> = {
    "01": "Factura",
    "03": "Liquidacion de Compra",
    "04": "Nota de Credito",
    "05": "Nota de Debito",
    "18": "Factura",
  };

  return labels[code] || "Comprobante";
}

function parseDate(value: string): string {
  const raw = normalizeText(value);
  if (!raw) return new Date().toISOString().slice(0, 10);

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      return new Date(excelEpoch.getTime() + serial * 86400000).toISOString().slice(0, 10);
    }
  }

  const parts = raw.split(/[/-]/).map((part) => part.trim());
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (/^\d{1,2}$/.test(day) && /^\d{1,2}$/.test(month) && /^\d{4}$/.test(year)) {
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function hasMovement(document: SourceDocument) {
  return document.base > 0 || document.iva > 0 || document.total > 0;
}

function compraFromRow(row: Record<string, any>, hoja: "COMPRAS" | "GASTOS"): SourceDocument {
  const tipoComprobante = firstCode(get(row, ["Tipo de Comprobante", "Comprobante"]), 2) || "01";
  const base = add([
    money(get(row, ["Base Imponible NO Objeto de IVA", "Base NO Objeto de IVA"])),
    money(get(row, ["Base Imponible EXENTA", "Base EXENTA"])),
    money(get(row, ["Base Imponible Tarifa 0%", "Base Tarifa 0%"])),
    money(get(row, ["Base Imp. 1 Gravable IVA diferente de cero"])),
    money(get(row, ["Base Imp. 2 Gravable IVA Construcción", "Base Imp. 2 Gravable IVA Construccion"])),
    money(get(row, ["Base Imp. 3 Gravable IVA Especial"])),
    money(get(row, ["Monto de I.C.E. NO incluido en Base Imp.", "Monto ICE NO incluido"])),
    money(get(row, ["Monto de OTROS", "Monto Otros", "Otros Valores"])),
  ]);
  const iva = add([
    money(get(row, ["Monto-1 de I.V.A.", "Monto-1 de IVA"])),
    money(get(row, ["Monto-2 de I.V.A.", "Monto-2 de IVA"])),
    money(get(row, ["Monto-3 de I.V.A.", "Monto-3 de IVA"])),
  ]);
  const total = money(get(row, ["Total del Documento", "Total Documento", "Total"])) || add([base, iva]);
  const establecimiento = pad(get(row, ["Establecimiento", "Codigo Establecimiento"]), 3);
  const puntoEmision = pad(get(row, ["Punto Emisión", "Punto Emision"]), 3);
  const secuencial = pad(get(row, ["Numero Secuencial", "Número Secuencial", "No. Documento"]), 9);

  return {
    hoja,
    fila: Number(row.__filaExcel || 0),
    fecha: parseDate(get(row, ["Fecha de Emisión", "Fecha de Emision", "Fecha de Registro", "Fecha"])),
    tipoComprobante,
    tipoComprobanteLabel: comprobanteLabel(tipoComprobante),
    tercero:
      get(row, [
        "Razon Social Contribuyente",
        "Razón Social Contribuyente",
        "Razon Social Proveedor",
        "Proveedor",
        "Detalle",
      ]) || "SIN IDENTIFICAR",
    identificacion: onlyDigits(get(row, ["No. de Identificacion", "No. de Identificación", "Identificacion"])),
    documento: [establecimiento, puntoEmision, secuencial].filter(Boolean).join("-"),
    base,
    iva,
    total,
  };
}

function ventaFromRow(row: Record<string, any>): SourceDocument {
  const tipoComprobante = firstCode(get(row, ["Tipo de Comprobante", "Tipo Comprobante", "Comprobante"]), 2) || "18";
  const base = add([
    money(get(row, ["Base Imponible NO Objeto de IVA", "Base NO Objeto de IVA"])),
    money(get(row, ["Base Imponible EXENTA", "Base EXENTA"])),
    money(get(row, ["Base Imponible Tarifa 0%", "Base Tarifa 0%"])),
    money(get(row, ["Base Imp. 1 Gravable IVA diferente de cero"])),
    money(get(row, ["Base Imp. 2 Gravable IVA Construcción", "Base Imp. 2 Gravable IVA Construccion"])),
    money(get(row, ["Base Imp. 3 Gravable IVA Especial"])),
    money(get(row, ["Monto de I.C.E. NO incluido en Base Imp.", "Monto ICE NO incluido"])),
    money(get(row, ["Monto de I.C.E. incluido en Base Imp.", "Monto ICE incluido"])),
    money(get(row, ["Monto de IRBPNR y/o Otros", "Monto de IRBPNR", "Monto de OTROS"])),
  ]);
  const iva = add([
    money(get(row, ["Monto-1 de I.V.A.", "Monto-1 de IVA"])),
    money(get(row, ["Monto-2 de I.V.A.", "Monto-2 de IVA"])),
    money(get(row, ["Monto-3 de I.V.A.", "Monto-3 de IVA"])),
  ]);
  const total = money(get(row, ["Total del Documento", "Total Documento", "Total"])) || add([base, iva]);
  const establecimiento = pad(get(row, ["Codigo Establecimiento", "Código Establecimiento", "Establecimiento"]), 3);
  const documento = pad(get(row, ["No. Documento", "No. Documento (Opcional)", "Documento", "Secuencial"]), 9);

  return {
    hoja: "VENTAS",
    fila: Number(row.__filaExcel || 0),
    fecha: parseDate(get(row, ["Fecha de Emisión", "Fecha Emision", "Fecha"])),
    tipoComprobante,
    tipoComprobanteLabel: comprobanteLabel(tipoComprobante),
    tercero:
      get(row, [
        "Razon Social Contribuyente",
        "Razón Social Contribuyente",
        "Razon Social Cliente",
        "Cliente",
      ]) || "CONSUMIDOR FINAL",
    identificacion: onlyDigits(get(row, ["No. de Identificacion", "No. de Identificación", "Identificacion"])) || "9999999999999",
    documento: [establecimiento, documento].filter(Boolean).join("-"),
    base,
    iva,
    total,
  };
}

function line(account: { codigo: string; cuenta: string }, side: "DEBE" | "HABER", amount: number): LibroDiarioLine | null {
  if (amount <= 0) return null;

  return {
    codigo: account.codigo,
    cuenta: account.cuenta,
    debe: side === "DEBE" ? amount : 0,
    haber: side === "HABER" ? amount : 0,
  };
}

function glosa(document: SourceDocument, prefix: string) {
  return `V. ${prefix} s/${document.tipoComprobante}-${document.tipoComprobanteLabel} a ${document.tercero} (${document.identificacion || "SIN RUC"})`;
}

function compraEntries(document: SourceDocument, nextNumber: () => number): LibroDiarioEntry[] {
  const compra = [
    line(ACCOUNTS.gastos, "DEBE", document.base),
    line(ACCOUNTS.ivaCompras, "DEBE", document.iva),
    line(ACCOUNTS.proveedores, "HABER", document.total),
  ].filter((item): item is LibroDiarioLine => Boolean(item));
  const pago = [
    line(ACCOUNTS.proveedores, "DEBE", document.total),
    line(ACCOUNTS.bancos, "HABER", document.total),
  ].filter((item): item is LibroDiarioLine => Boolean(item));

  return [
    {
      numero: nextNumber(),
      fecha: document.fecha,
      glosa: glosa(document, document.hoja === "GASTOS" ? "Gasto" : "Compra"),
      lineas: compra,
    },
    {
      numero: nextNumber(),
      fecha: document.fecha,
      glosa: glosa(document, document.hoja === "GASTOS" ? "Pago Gasto" : "Pago Compra"),
      lineas: pago,
    },
  ];
}

function ventaEntry(document: SourceDocument, nextNumber: () => number): LibroDiarioEntry {
  const lines = [
    line(ACCOUNTS.cuentasPorCobrar, "DEBE", document.total),
    line(ACCOUNTS.ventas, "HABER", document.base),
    line(ACCOUNTS.ivaVentas, "HABER", document.iva),
  ].filter((item): item is LibroDiarioLine => Boolean(item));

  return {
    numero: nextNumber(),
    fecha: document.fecha,
    glosa: glosa(document, "Venta"),
    lineas: lines,
  };
}

function validateEntry(entry: LibroDiarioEntry): string[] {
  const debe = add(entry.lineas.map((item) => item.debe));
  const haber = add(entry.lineas.map((item) => item.haber));
  const errors: string[] = [];

  if (entry.lineas.length < 2) {
    errors.push("El asiento debe contener al menos dos líneas.");
  }

  if (Math.abs(debe - haber) >= 0.01) {
    errors.push("Debe y Haber no son iguales.");
  }

  entry.lineas.forEach((item) => {
    if (item.debe < 0 || item.haber < 0) {
      errors.push("Los valores no pueden ser negativos.");
    }
  });

  return errors;
}

export class ExcelLibroDiarioService {
  process(buffer: Buffer, filename: string) {
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
      raw: false,
    });
    const issues: LibroDiarioIssue[] = [];
    const comprasName = findSheetName(workbook, ["COMPRAS"], ["DETALLE DE COMPRAS"]);
    const ventasName = findSheetName(workbook, ["VENTAS"], ["DETALLE DE VENTAS"]);
    const gastosName = findSheetName(workbook, ["GASTOS", "GASTOSP"], []);
    const recognizedSheetNames = new Set(
      [comprasName, ventasName, gastosName].filter((name): name is string => Boolean(name))
    );
    const ignoredSheets = workbook.SheetNames.filter((name) => !recognizedSheetNames.has(name));

    const sheets: ParsedSheet[] = [];

    if (comprasName) {
      sheets.push(
        parseDataRows(workbook.Sheets[comprasName], comprasName, "COMPRAS", [
          "No. de Identificacion",
          "Razon Social Contribuyente",
          "Tipo de Comprobante",
          "Numero Secuencial",
        ])
      );
    } else {
      issues.push({
        tipo: "WARNING",
        hoja: "COMPRAS",
        fila: 0,
        campo: "Hoja",
        mensaje: "No se encontró la pestaña COMPRAS.",
      });
    }

    if (ventasName) {
      sheets.push(
        parseDataRows(workbook.Sheets[ventasName], ventasName, "VENTAS", [
          "No. de Identificacion",
          "Razon Social Contribuyente",
          "Tipo de Comprobante",
          "Fecha de Emisión",
        ])
      );
    } else {
      issues.push({
        tipo: "WARNING",
        hoja: "VENTAS",
        fila: 0,
        campo: "Hoja",
        mensaje: "No se encontró la pestaña VENTAS.",
      });
    }

    if (gastosName) {
      sheets.push(
        parseDataRows(workbook.Sheets[gastosName], gastosName, "GASTOS", [
          "No. de Identificacion",
          "Razon Social Contribuyente",
          "Tipo de Comprobante",
          "Total",
        ])
      );
    } else {
      issues.push({
        tipo: "WARNING",
        hoja: "GASTOS",
        fila: 0,
        campo: "Hoja",
        mensaje: "No se encontró la pestaña GASTOS.",
      });
    }

    if (sheets.length === 0) {
      throw new Error("El archivo no contiene pestañas COMPRAS, VENTAS o GASTOS.");
    }

    const documents = sheets.flatMap((sheet) => {
      const hoja = sheet.label;

      return sheet.rows
        .map((row) => {
          if (hoja === "VENTAS") return ventaFromRow(row);
          return compraFromRow(row, hoja);
        })
        .filter((document) => {
          const valid = hasMovement(document);
          if (!valid) {
            issues.push({
              tipo: "INFO",
              hoja: document.hoja,
              fila: document.fila,
              campo: "Valores",
              mensaje: "Fila omitida porque no tiene movimiento contable.",
            });
          }
          return valid;
        });
    });

    let numero = 0;
    const nextNumber = () => {
      numero += 1;
      return numero;
    };
    const asientos = documents.flatMap((document) =>
      document.hoja === "VENTAS" ? [ventaEntry(document, nextNumber)] : compraEntries(document, nextNumber)
    );

    asientos.forEach((entry) => {
      validateEntry(entry).forEach((message) => {
        issues.push({
          tipo: "ERROR",
          hoja: "LIBRO_DIARIO",
          fila: entry.numero,
          campo: "Asiento",
          mensaje: `Asiento ${entry.numero}: ${message}`,
        });
      });
    });

    const totalDebe = add(asientos.flatMap((entry) => entry.lineas.map((item) => item.debe)));
    const totalHaber = add(asientos.flatMap((entry) => entry.lineas.map((item) => item.haber)));

    return {
      message: "Libro Diario generado desde Excel ATS para Contabilidad.",
      resumen: {
        archivo: filename,
        hojasLeidas: sheets.map((sheet) => sheet.label),
        hojasIgnoradas: ignoredSheets,
        compras: documents.filter((document) => document.hoja === "COMPRAS").length,
        ventas: documents.filter((document) => document.hoja === "VENTAS").length,
        gastos: documents.filter((document) => document.hoja === "GASTOS").length,
        asientos: asientos.length,
        totalDebe,
        totalHaber,
        errores: issues.filter((issue) => issue.tipo === "ERROR").length,
        advertencias: issues.filter((issue) => issue.tipo === "WARNING").length,
      },
      libroDiario: asientos,
      asientos,
      issues,
    };
  }
}
