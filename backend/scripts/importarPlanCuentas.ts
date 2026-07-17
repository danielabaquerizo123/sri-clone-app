import "dotenv/config";
import path from "path";
import * as XLSX from "xlsx";
import { prisma } from "../src/lib/prisma";

type SheetKind =
  | "ESTADO_SITUACION_FINANCIERA"
  | "ESTADO_RESULTADO_INTEGRAL"
  | "ESTADO_FLUJO_EFECTIVO"
  | "ESTADO_CAMBIOS_PATRIMONIO"
  | "DESCONOCIDA";

type RowKind =
  | "CUENTA_AGRUPADORA"
  | "CUENTA_MOVIMIENTO_CANDIDATA"
  | "RUBRO_PRESENTACION"
  | "RUBRO_PRESENTACION_AGRUPADOR"
  | "SUBTOTAL_RESULTADO"
  | "INDICADOR";

type ParsedPlanRow = {
  sheetName: string;
  sheetKind: SheetKind;
  rowNumber: number;
  codigo: string;
  nombre: string;
  signo: string;
  nivel: number;
  parentCodigo: string | null;
  hasChildren: boolean;
  kind: RowKind;
};

type ExistingAccount = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
  nivel: number;
  movimiento: boolean;
  activa: boolean;
  parentCodigo: string | null;
};

type ImportCandidate = ParsedPlanRow & {
  tipo: "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO" | "COSTO";
  naturaleza: "DEUDORA" | "ACREEDORA";
  movimiento: boolean;
  existing?: ExistingAccount;
  action: "CREATE" | "EXACT_MATCH" | "INCOMPATIBLE";
  reasons: string[];
};

const PLAN_PATH = path.join(process.cwd(), "tmp", "PLAN_CUENTAS.xlsx");
const DRY_RUN = process.argv.includes("--dry-run");

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeForMatch(value: unknown) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizeCode(value: unknown) {
  return normalizeText(value).replace(/[^\d]/g, "");
}

function sheetKindFromTitle(title: string): SheetKind {
  const normalized = normalizeForMatch(title);
  if (normalized.includes("SITUACION FINANCIERA")) return "ESTADO_SITUACION_FINANCIERA";
  if (normalized.includes("RESULTADO INTEGRAL")) return "ESTADO_RESULTADO_INTEGRAL";
  if (normalized.includes("FLUJO DE EFECTIVO")) return "ESTADO_FLUJO_EFECTIVO";
  if (normalized.includes("CAMBIOS EN EL PATRIMONIO")) return "ESTADO_CAMBIOS_PATRIMONIO";
  return "DESCONOCIDA";
}

function tipoFromCode(codigo: string): ImportCandidate["tipo"] | null {
  if (codigo.startsWith("1")) return "ACTIVO";
  if (codigo.startsWith("2")) return "PASIVO";
  if (codigo.startsWith("3")) return "PATRIMONIO";
  if (codigo.startsWith("4")) return "INGRESO";
  if (codigo.startsWith("5")) return "GASTO";
  if (codigo.startsWith("6")) return "COSTO";
  return null;
}

function naturalezaFromTipo(tipo: ImportCandidate["tipo"]): ImportCandidate["naturaleza"] {
  return tipo === "ACTIVO" || tipo === "GASTO" || tipo === "COSTO" ? "DEUDORA" : "ACREEDORA";
}

function isPresentationSheet(kind: SheetKind) {
  return kind === "ESTADO_FLUJO_EFECTIVO" || kind === "ESTADO_CAMBIOS_PATRIMONIO";
}

function hasPresentationName(nombre: string) {
  return /TOTAL|SUBTOTAL|RESULTADO|GANANCIA|P[ÉE]RDIDA|SALDO|INCREMENTO|DISMINUCI[ÓO]N|AJUSTE|FLUJOS|CLASES DE|PARTICIPACI[ÓO]N TRABAJADORES|IMPUESTO A LA RENTA CAUSADO/i.test(
    normalizeForMatch(nombre)
  );
}

function hasIndicatorName(nombre: string) {
  return /INDICADOR|VALOR RAZONABLE|DETERIORO|PROVISI[ÓO]N|VALUACI[ÓO]N/i.test(normalizeForMatch(nombre));
}

function parseWorkbook(): ParsedPlanRow[] {
  const workbook = XLSX.readFile(PLAN_PATH, { cellDates: false });
  const preliminary: Array<Omit<ParsedPlanRow, "parentCodigo" | "hasChildren" | "kind">> = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });

    let title = "";
    let sheetKind: SheetKind = "DESCONOCIDA";

    rows.forEach((row, index) => {
      const firstCell = normalizeText(row[0]);
      if (
        firstCell &&
        !/^C[ÓO]DIGO$/i.test(normalizeForMatch(firstCell)) &&
        !/^PLAN DE CUENTAS$/i.test(normalizeForMatch(firstCell)) &&
        !/^\d/.test(firstCell)
      ) {
        title = firstCell;
        sheetKind = sheetKindFromTitle(title);
      }

      const codigo = normalizeCode(row[0]);
      const nombre = normalizeText(row[1]);
      const signo = normalizeForMatch(row[2]);
      if (!codigo || !nombre || !/^\d+$/.test(codigo)) return;

      preliminary.push({
        sheetName,
        sheetKind,
        rowNumber: index + 1,
        codigo,
        nombre,
        signo,
        nivel: codigo.length,
      });
    });
  }

  const codes = new Set(preliminary.map((row) => row.codigo));
  const findParent = (codigo: string) => {
    for (let length = codigo.length - 1; length >= 1; length -= 1) {
      const candidate = codigo.slice(0, length);
      if (codes.has(candidate)) return candidate;
    }
    return null;
  };

  return preliminary.map((row) => {
    const hasChildren = preliminary.some((candidate) => candidate.codigo !== row.codigo && candidate.codigo.startsWith(row.codigo));
    const kind: RowKind = (() => {
      if (isPresentationSheet(row.sheetKind)) return hasChildren ? "RUBRO_PRESENTACION_AGRUPADOR" : "RUBRO_PRESENTACION";
      if (hasIndicatorName(row.nombre)) return hasChildren ? "RUBRO_PRESENTACION_AGRUPADOR" : "INDICADOR";
      if (hasPresentationName(row.nombre)) return hasChildren ? "RUBRO_PRESENTACION_AGRUPADOR" : "SUBTOTAL_RESULTADO";
      if (hasChildren) return "CUENTA_AGRUPADORA";
      if (row.codigo.length <= 4) return "RUBRO_PRESENTACION";
      return "CUENTA_MOVIMIENTO_CANDIDATA";
    })();

    return {
      ...row,
      parentCodigo: findParent(row.codigo),
      hasChildren,
      kind,
    };
  });
}

function summarizeDuplicates(rows: ParsedPlanRow[]) {
  const byCode = new Map<string, ParsedPlanRow[]>();
  rows.forEach((row) => byCode.set(row.codigo, [...(byCode.get(row.codigo) || []), row]));

  return [...byCode.entries()]
    .filter(([, matches]) => matches.length > 1)
    .map(([codigo, matches]) => ({
      codigo,
      count: matches.length,
      sheets: [...new Set(matches.map((row) => row.sheetName))],
      names: [...new Set(matches.map((row) => row.nombre))],
      signs: [...new Set(matches.map((row) => row.signo))],
      rows: matches.map((row) => `${row.sheetName}:${row.rowNumber}`),
    }));
}

function buildCandidate(row: ParsedPlanRow, existingByCode: Map<string, ExistingAccount>): ImportCandidate | null {
  if (row.kind === "RUBRO_PRESENTACION" || row.kind === "RUBRO_PRESENTACION_AGRUPADOR" || row.kind === "SUBTOTAL_RESULTADO" || row.kind === "INDICADOR") {
    return null;
  }

  const tipo = tipoFromCode(row.codigo);
  if (!tipo) return null;

  const existing = existingByCode.get(row.codigo);
  const movimiento = row.kind === "CUENTA_MOVIMIENTO_CANDIDATA";
  const naturaleza = naturalezaFromTipo(tipo);
  const reasons: string[] = [];
  let action: ImportCandidate["action"] = existing ? "EXACT_MATCH" : "CREATE";

  if (existing) {
    if (normalizeForMatch(existing.nombre) !== normalizeForMatch(row.nombre)) {
      reasons.push(`Nombre distinto: base="${existing.nombre}", plan="${row.nombre}".`);
    }
    if (existing.tipo !== tipo) {
      reasons.push(`Tipo distinto: base="${existing.tipo}", plan="${tipo}".`);
    }
    if (existing.naturaleza !== naturaleza) {
      reasons.push(`Naturaleza distinta: base="${existing.naturaleza}", propuesta="${naturaleza}".`);
    }
    if (existing.movimiento !== movimiento) {
      reasons.push(`Movimiento distinto: base="${existing.movimiento}", plan="${movimiento}".`);
    }
    if (reasons.length) action = "INCOMPATIBLE";
  }

  return {
    ...row,
    tipo,
    naturaleza,
    movimiento,
    existing,
    action,
    reasons,
  };
}

async function main() {
  const rows = parseWorkbook();
  const duplicates = summarizeDuplicates(rows);
  const conflictName = duplicates.filter((item) => item.names.length > 1);
  const conflictSign = duplicates.filter((item) => item.signs.length > 1);
  const existingAccounts = (await prisma.cuentaContable.findMany()) as ExistingAccount[];
  const existingByCode = new Map(existingAccounts.map((account) => [account.codigo, account]));
  const candidates = rows
    .map((row) => buildCandidate(row, existingByCode))
    .filter((row): row is ImportCandidate => Boolean(row));
  const omitted = rows.filter((row) => !candidates.some((candidate) => candidate.codigo === row.codigo));
  const criticalConflicts = [
    ...conflictName.map((item) => `Código ${item.codigo} con nombres diferentes.`),
    ...conflictSign.map((item) => `Código ${item.codigo} con signos diferentes.`),
  ];

  const summary = {
    modo: DRY_RUN ? "DRY_RUN" : "IMPORT",
    archivo: PLAN_PATH,
    filasLeidas: rows.length,
    cuentasCandidatas: candidates.length,
    agrupadoras: rows.filter((row) => row.kind === "CUENTA_AGRUPADORA").length,
    movimientoCandidatas: rows.filter((row) => row.kind === "CUENTA_MOVIMIENTO_CANDIDATA").length,
    presentacion: rows.filter((row) => row.kind === "RUBRO_PRESENTACION" || row.kind === "RUBRO_PRESENTACION_AGRUPADOR").length,
    subtotalesIndicadoresResultados: rows.filter((row) => row.kind === "SUBTOTAL_RESULTADO" || row.kind === "INDICADOR").length,
    nuevas: candidates.filter((row) => row.action === "CREATE").length,
    coincidentes: candidates.filter((row) => row.action === "EXACT_MATCH").length,
    incompatibles: candidates.filter((row) => row.action === "INCOMPATIBLE").length,
    conflictos: duplicates.length,
    omitidas: omitted.length,
    errores: criticalConflicts.length,
  };

  const report = {
    summary,
    duplicates,
    conflictName,
    conflictSign,
    incompatibles: candidates
      .filter((row) => row.action === "INCOMPATIBLE")
      .map((row) => ({
        codigo: row.codigo,
        nombre: row.nombre,
        signo: row.signo,
        existente: row.existing,
        razones: row.reasons,
      })),
    omitidasPorTipo: {
      presentacion: omitted.filter((row) => row.kind === "RUBRO_PRESENTACION" || row.kind === "RUBRO_PRESENTACION_AGRUPADOR").length,
      subtotales: omitted.filter((row) => row.kind === "SUBTOTAL_RESULTADO").length,
      indicadores: omitted.filter((row) => row.kind === "INDICADOR").length,
      tipoNoCompatible: omitted.filter((row) => !tipoFromCode(row.codigo) && !isPresentationSheet(row.sheetKind)).length,
    },
    muestraNuevas: candidates
      .filter((row) => row.action === "CREATE")
      .slice(0, 30)
      .map((row) => ({
        codigo: row.codigo,
        nombre: row.nombre,
        tipo: row.tipo,
        naturaleza: row.naturaleza,
        movimiento: row.movimiento,
        parentCodigo: row.parentCodigo,
        signo: row.signo,
        hoja: row.sheetKind,
      })),
  };

  console.log(JSON.stringify(report, null, 2));

  if (DRY_RUN) return;
  if (criticalConflicts.length > 0) {
    throw new Error(`Importación detenida por conflictos críticos: ${criticalConflicts.join(" ")}`);
  }

  const writableCandidates = candidates.filter((row) => row.action === "CREATE");
  await prisma.$transaction(
    writableCandidates.map((row) =>
      prisma.cuentaContable.create({
        data: {
          codigo: row.codigo,
          nombre: row.nombre,
          tipo: row.tipo,
          naturaleza: row.naturaleza,
          nivel: row.nivel,
          movimiento: row.movimiento,
          activa: true,
          parentCodigo: row.parentCodigo,
        },
      })
    )
  );

  console.log(
    JSON.stringify(
      {
        importadas: writableCandidates.length,
        omitidasExistentes: candidates.filter((row) => row.action === "EXACT_MATCH").length,
        incompatibles: candidates.filter((row) => row.action === "INCOMPATIBLE").length,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
