import * as XLSX from "xlsx";

type ParsedSheet = {
  headers: string[];
  rows: Record<string, any>[];
  sheetName?: string;
  headerRow?: number;
};

export type AtsInformanteExcel = {
  rucInformante: string;
  razonSocialInformante: string;
  anio?: number;
  periodicidad?: string;
  numEstabRuc?: string;
  hojaParametros?: string;
};

export type AtsWorkbookData = {
  informante: AtsInformanteExcel;
  contribuyentes: ParsedSheet;
  compras: ParsedSheet;
  ventas: ParsedSheet;
  anulados: ParsedSheet;
  guias: ParsedSheet;
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

function onlyDigits(value: any): string {
  return normalizeText(value).replace(/\D/g, "");
}

function pad(value: any, length: number): string {
  const digits = onlyDigits(value);
  if (!digits) return "";
  return digits.padStart(length, "0").slice(0, length);
}

function getMergedValue(sheet: XLSX.WorkSheet, row: number, col: number): string {
  const address = XLSX.utils.encode_cell({
    r: row - 1,
    c: col - 1,
  });

  const directValue = sheet[address]?.v;

  if (directValue !== undefined && directValue !== null && directValue !== "") {
    return normalizeText(directValue);
  }

  const merges = sheet["!merges"] || [];

  for (const merge of merges) {
    if (
      row - 1 >= merge.s.r &&
      row - 1 <= merge.e.r &&
      col - 1 >= merge.s.c &&
      col - 1 <= merge.e.c
    ) {
      const startCell = XLSX.utils.encode_cell(merge.s);
      return normalizeText(sheet[startCell]?.v);
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
    text.includes("DATOS INFORMACION ADICIONAL") ||
    text.includes("OTROS DATOS")
  );
}

function joinHeader(row5: string, row6: string): string {
  const h5 = normalizeText(row5);
  const h6 = normalizeText(row6);

  const clean5 = isNoiseHeader(h5) ? "" : h5;
  const clean6 = isNoiseHeader(h6) ? "" : h6;

  if (clean5 && clean6 && clean5.toUpperCase() !== clean6.toUpperCase()) {
    return normalizeText(`${clean5} ${clean6}`);
  }

  return normalizeText(clean5 || clean6 || h5 || h6);
}

function makeUniqueHeaders(headers: string[]): string[] {
  const counts = new Map<string, number>();

  return headers.map((header, index) => {
    const base = header || `COLUMNA_${index + 1}`;
    const count = counts.get(base) || 0;

    counts.set(base, count + 1);

    if (count === 0) return base;

    return `${base}__${count + 1}`;
  });
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

function buildHeaders(sheet: XLSX.WorkSheet, headerRow: number): string[] {
  const ref = sheet["!ref"];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const headers: string[] = [];

  for (let col = range.s.c + 1; col <= range.e.c + 1; col++) {
    const current = getMergedValue(sheet, headerRow, col);
    const next = getMergedValue(sheet, headerRow + 1, col);

    headers.push(joinHeaderCells([joinHeader(current, next)]));
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

function findHeaderRow(sheet: XLSX.WorkSheet, keywords: string[]): number {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true,
  }) as any[][];

  let best = { row: 5, score: 0 };

  rows.slice(0, 25).forEach((row, index) => {
    const score = scoreHeaderRow(row, keywords);
    if (score > best.score) {
      best = { row: index + 1, score };
    }
  });

  return best.score > 0 ? best.row : 5;
}

function parseDataRows(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  keywords: string[]
): ParsedSheet {
  const ref = sheet["!ref"];

  if (!ref) {
    return { headers: [], rows: [], sheetName };
  }

  const headerRow = findHeaderRow(sheet, keywords);
  const headers = buildHeaders(sheet, headerRow);
  const range = XLSX.utils.decode_range(ref);
  const rows: Record<string, any>[] = [];

  for (let rowNum = headerRow + 1; rowNum <= range.e.r + 1; rowNum++) {
    const rowData: Record<string, any> = {
      __filaExcel: rowNum,
    };

    headers.forEach((header, index) => {
      const cellAddress = XLSX.utils.encode_cell({
        r: rowNum - 1,
        c: index,
      });

      const value = sheet[cellAddress]?.v;
      rowData[header] = normalizeText(value);
    });

    if (!isEmptyRow(rowData)) {
      rows.push(rowData);
    }
  }

  return {
    headers,
    rows,
    sheetName,
    headerRow,
  };
}

function parseSimpleSheet(sheet: XLSX.WorkSheet, sheetName: string): ParsedSheet {
  const json = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  }) as Record<string, any>[];

  return {
    headers: json.length ? Object.keys(json[0]) : [],
    rows: json,
    sheetName,
  };
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

  return normalizeForMatch(
    rows
      .slice(0, 40)
      .map((row) => row.join(" "))
      .join(" ")
  );
}

function findSheetName(
  workbook: XLSX.WorkBook,
  preferredNames: string[],
  contentMarkers: string[]
) {
  const byName = workbook.SheetNames.find((name) => {
    const normalized = normalizeForMatch(name);
    return preferredNames.some((preferred) => normalized.includes(normalizeForMatch(preferred)));
  });

  if (byName) return byName;

  return workbook.SheetNames.find((name) => {
    const text = sheetText(workbook, name);
    return contentMarkers.some((marker) => text.includes(normalizeForMatch(marker)));
  });
}

function requireSheet(
  workbook: XLSX.WorkBook,
  preferredNames: string[],
  contentMarkers: string[],
  label: string
) {
  const name = findSheetName(workbook, preferredNames, contentMarkers);

  if (!name || !workbook.Sheets[name]) {
    throw new Error(`No se encontró la hoja equivalente a "${label}" en el archivo Excel.`);
  }

  return { name, sheet: workbook.Sheets[name] };
}

function getValueAfterLabel(rows: any[][], labels: string[]) {
  const wanted = labels.map(normalizeForMatch);

  for (const row of rows) {
    for (let col = 0; col < row.length; col++) {
      const cell = normalizeForMatch(row[col]);

      if (!cell) continue;

      const matches = wanted.some((label) => cell === label || cell.includes(label));
      if (!matches) continue;

      for (let next = col + 1; next < row.length; next++) {
        const value = normalizeText(row[next]);
        if (value && !value.startsWith("<==")) return value;
      }
    }
  }

  return "";
}

function parseInformante(sheet: XLSX.WorkSheet, sheetName: string): AtsInformanteExcel {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  }) as any[][];

  const rucInformante = onlyDigits(
    getValueAfterLabel(rows, ["No. de RUC", "RUC Informante"])
  );
  const razonSocialInformante = getValueAfterLabel(rows, [
    "Razon Social",
    "Razón Social",
    "Razon Social Informante",
  ]);
  const anioRaw = onlyDigits(getValueAfterLabel(rows, ["Periodo Contable:", "Periodo Contable"]));
  const periodicidad = getValueAfterLabel(rows, [
    "Tipo de Declaracion Formularios",
    "Tipo de Declaración Formularios",
    "Periodicidad",
  ]);
  const numEstabRuc = pad(
    getValueAfterLabel(rows, ["No. Establecimiento_1", "No. Establecimiento 1"]),
    3
  );

  return {
    rucInformante,
    razonSocialInformante,
    anio: anioRaw ? Number(anioRaw.slice(0, 4)) : undefined,
    periodicidad,
    numEstabRuc,
    hojaParametros: sheetName,
  };
}

export function readAtsWorkbook(buffer: Buffer): AtsWorkbookData {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    raw: false,
  });

  const parametros = requireSheet(
    workbook,
    ["PARAMETROS", "PARAMETRO", "CONFIGURACION"],
    ["Configuracion y datos de la Empresa", "Configuración y datos de la Empresa"],
    "PARAMETROS"
  );
  const contribuyentes = requireSheet(
    workbook,
    ["CONTRIBUYENTES"],
    ["LISTADO DE CONTRIBUYENTES"],
    "Contribuyentes"
  );
  const compras = requireSheet(workbook, ["COMPRAS"], ["DETALLE DE COMPRAS"], "Compras");
  const ventas = requireSheet(workbook, ["VENTAS"], ["DETALLE DE VENTAS"], "Ventas");
  const anulados = requireSheet(
    workbook,
    ["ANULADOS"],
    ["DETALLE DE COMPROBANTES ANULADOS"],
    "Anulados"
  );
  const guias = requireSheet(
    workbook,
    ["GUIAS", "GUÍAS"],
    ["DETALLE DE GUIAS DE REMISION", "DETALLE DE GUÍAS DE REMISIÓN"],
    "Guias"
  );

  return {
    informante: parseInformante(parametros.sheet, parametros.name),
    contribuyentes: parseSimpleSheet(contribuyentes.sheet, contribuyentes.name),
    compras: parseDataRows(compras.sheet, compras.name, [
      "No. de Identificacion",
      "Razon Social Contribuyente",
      "Comprobante",
      "Numero Secuencial",
    ]),
    ventas: parseDataRows(ventas.sheet, ventas.name, [
      "No. de Identificacion",
      "Razon Social Contribuyente",
      "Tipo de Comprobante",
      "Fecha de Emisión",
    ]),
    anulados: parseDataRows(anulados.sheet, anulados.name, [
      "Tipo de Comprobante",
      "No. Serie Establecimiento",
      "No. Serie Secuencial Desde",
    ]),
    guias: parseDataRows(guias.sheet, guias.name, [
      "No. de Identificacion Emisor",
      "Razon Social Contribuyente Emisor",
      "Numero Secuencial",
    ]),
  };
}
