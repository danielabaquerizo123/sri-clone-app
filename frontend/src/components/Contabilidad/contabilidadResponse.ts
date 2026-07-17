export type ContabilidadIssue = {
  tipo: "ERROR" | "WARNING" | "INFO";
  hoja?: string;
  fila?: number;
  campo?: string;
  mensaje: string;
};

export type ContabilidadHoja = {
  nombre: string;
  filas: number;
  encabezados: string[];
};

export type LibroDiarioResponse = {
  message: string;
  resumen: {
    archivo: string;
    hojasLeidas: string[];
    hojasIgnoradas: string[];
    compras: number;
    ventas: number;
    gastos: number;
    asientos: number;
    totalDebe: number;
    totalHaber: number;
    errores: number;
    advertencias: number;
    tiposPagoCompras: Record<string, number>;
    formasPagoCompras: Record<string, number>;
    formasCobroVentas: Record<string, number>;
  };
  hojas: ContabilidadHoja[];
  libroDiario: unknown[];
  asientos: unknown[];
  issues: ContabilidadIssue[];
  warnings: unknown[];
  errors: unknown[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value).map((item) => String(item)).filter(Boolean);
}

function asNumber(value: unknown): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function asNumberRecord(value: unknown): Record<string, number> {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, item]) => [key, asNumber(item)] as const)
      .filter(([key]) => Boolean(key))
  );
}

function normalizeIssues(value: unknown): ContabilidadIssue[] {
  return asArray(value)
    .map((issue): ContabilidadIssue | null => {
      const record = asRecord(issue);
      const tipo = record.tipo === "ERROR" || record.tipo === "WARNING" || record.tipo === "INFO" ? record.tipo : null;
      const mensaje = typeof record.mensaje === "string" ? record.mensaje : "";

      if (!tipo || !mensaje) return null;

      return {
        tipo,
        hoja: typeof record.hoja === "string" ? record.hoja : undefined,
        fila: record.fila === undefined ? undefined : asNumber(record.fila),
        campo: typeof record.campo === "string" ? record.campo : undefined,
        mensaje,
      };
    })
    .filter((issue): issue is ContabilidadIssue => issue !== null);
}

function normalizeHojas(value: unknown): ContabilidadHoja[] {
  return asArray(value).map((hoja) => {
    const record = asRecord(hoja);
    return {
      nombre: String(record.nombre || ""),
      filas: asNumber(record.filas),
      encabezados: asStringArray(record.encabezados),
    };
  });
}

export function normalizeLibroDiarioResponse(data: unknown): LibroDiarioResponse {
  const record = asRecord(data);
  const resumen = asRecord(record.resumen);
  const hojas = normalizeHojas(record.hojas);
  const hojasLeidas = asStringArray(resumen.hojasLeidas);
  const hojasIgnoradas = asStringArray(resumen.hojasIgnoradas);
  const issues = normalizeIssues(record.issues);
  const warnings = asArray(record.warnings);
  const errors = asArray(record.errors);

  if (!record.resumen || typeof record.resumen !== "object") {
    throw new Error("La respuesta del servidor no tiene el resumen esperado.");
  }

  return {
    message: String(record.message || ""),
    resumen: {
      archivo: String(resumen.archivo || ""),
      hojasLeidas,
      hojasIgnoradas,
      compras: asNumber(resumen.compras),
      ventas: asNumber(resumen.ventas),
      gastos: asNumber(resumen.gastos),
      asientos: asNumber(resumen.asientos ?? resumen.asientosGenerados),
      totalDebe: asNumber(resumen.totalDebe),
      totalHaber: asNumber(resumen.totalHaber),
      errores: asNumber(resumen.errores || errors.length),
      advertencias: asNumber(resumen.advertencias || warnings.length),
      tiposPagoCompras: asNumberRecord(resumen.tiposPagoCompras),
      formasPagoCompras: asNumberRecord(resumen.formasPagoCompras),
      formasCobroVentas: asNumberRecord(resumen.formasCobroVentas),
    },
    hojas,
    libroDiario: asArray(record.libroDiario),
    asientos: asArray(record.asientos),
    issues,
    warnings,
    errors,
  };
}
