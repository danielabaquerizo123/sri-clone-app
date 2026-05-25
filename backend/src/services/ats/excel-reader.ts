import * as XLSX from "xlsx";

type ParsedSheet = {
  headers: string[];
  rows: Record<string, any>[];
};

type AtsWorkbookData = {
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

function buildHeaders(sheet: XLSX.WorkSheet): string[] {
  const ref = sheet["!ref"];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const headers: string[] = [];

  for (let col = range.s.c + 1; col <= range.e.c + 1; col++) {
    const row5 = getMergedValue(sheet, 5, col);
    const row6 = getMergedValue(sheet, 6, col);

    headers.push(joinHeader(row5, row6));
  }

  return makeUniqueHeaders(headers);
}

function isEmptyRow(row: Record<string, any>) {
  return Object.values(row).every(
    (value) =>
      value === null ||
      value === undefined ||
      String(value).trim() === ""
  );
}

function parseDataRows(sheet: XLSX.WorkSheet): ParsedSheet {
  const ref = sheet["!ref"];

  if (!ref) {
    return { headers: [], rows: [] };
  }

  const headers = buildHeaders(sheet);
  const range = XLSX.utils.decode_range(ref);
  const rows: Record<string, any>[] = [];

  for (let rowNum = 7; rowNum <= range.e.r + 1; rowNum++) {
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
  };
}

function parseSimpleSheet(sheet: XLSX.WorkSheet): ParsedSheet {
  const json = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  }) as Record<string, any>[];

  return {
    headers: json.length ? Object.keys(json[0]) : [],
    rows: json,
  };
}

function getSheet(workbook: XLSX.WorkBook, name: string) {
  const sheet = workbook.Sheets[name];

  if (!sheet) {
    throw new Error(`No se encontró la hoja "${name}" en el archivo Excel.`);
  }

  return sheet;
}

export function readAtsWorkbook(buffer: Buffer): AtsWorkbookData {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    raw: false,
  });

  return {
    contribuyentes: parseSimpleSheet(getSheet(workbook, "Contribuyentes")),
    compras: parseDataRows(getSheet(workbook, "COMPRAS")),
    ventas: parseDataRows(getSheet(workbook, "VENTAS")),
    anulados: parseDataRows(getSheet(workbook, "ANULADOS")),
    guias: parseDataRows(getSheet(workbook, "GUIAS")),
  };
}