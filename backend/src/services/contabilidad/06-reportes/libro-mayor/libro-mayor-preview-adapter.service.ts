import type { PreviewEntry } from "../../04-asientos/preview-asientos.service";
import type { LibroMayorEmpresa, LibroMayorPeriodo, MovimientoMayorSource } from "./libro-mayor.types";

type PreviewLike = {
  resumen?: {
    ruc?: string;
    razonSocial?: string;
    periodo?: string;
    moneda?: string;
    loteId?: string;
  };
  periodo?: {
    id?: string;
    anio?: number;
    mes?: string;
    estado?: string;
  };
  asientos?: PreviewEntry[];
  libroDiario?: PreviewEntry[];
};

function entryDate(entry: PreviewEntry) {
  const raw = (entry as any).fechaDate || entry.fecha;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function accountName(line: any) {
  return String(line.nombre || line.cuenta || line.nombreCuenta || line.codigo || line.cuentaId || "");
}

function accountMetadata(entry: PreviewEntry, line: any) {
  const resolutions = Array.isArray((entry as any).rolesResueltos) ? (entry as any).rolesResueltos : [];
  const found = resolutions.find((resolution: any) => {
    const cuenta = resolution?.cuenta || {};
    return (
      String(cuenta.id || "") === String(line.cuentaId || "") ||
      String(cuenta.codigo || "") === String(line.codigo || line.codigoCuenta || "")
    );
  });
  const cuenta = found?.cuenta || {};
  return {
    tipoCuenta: String(line.tipoCuenta || cuenta.tipo || ""),
    naturalezaCuenta: String(line.naturalezaCuenta || cuenta.naturaleza || ""),
  };
}

function periodFromSummary(value: unknown) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return { anio: null as number | null, mes: null as string | null };
  return { anio: Number(match[1]), mes: match[2].padStart(2, "0") };
}

export class LibroMayorPreviewAdapterService {
  adapt(preview: PreviewLike): {
    empresa: LibroMayorEmpresa;
    periodo: LibroMayorPeriodo;
    movements: MovimientoMayorSource[];
  } {
    const summaryPeriod = periodFromSummary(preview.resumen?.periodo);
    const periodoAnio = preview.periodo?.anio ?? summaryPeriod.anio;
    const periodoMes = preview.periodo?.mes ?? summaryPeriod.mes;
    const entries = Array.isArray(preview.asientos) && preview.asientos.length > 0
      ? preview.asientos
      : Array.isArray(preview.libroDiario)
        ? preview.libroDiario
        : [];

    return {
      empresa: {
        id: "preview",
        ruc: String(preview.resumen?.ruc || ""),
        razonSocial: String(preview.resumen?.razonSocial || "No disponible"),
      },
      periodo: {
        id: preview.periodo?.id || null,
        anio: periodoAnio,
        mes: periodoMes,
        estado: preview.periodo?.estado || "NO_CONTABILIZADO",
      },
      movements: entries.flatMap((entry, entryIndex) => {
        const fecha = entryDate(entry);
        const numeroAsiento = Number(entry.numero || entryIndex + 1);
        const asientoId = String((entry as any).id || entry.idTemporalEvento || `preview-asiento-${entryIndex + 1}`);
        return (entry.lineas || []).map((line: any, lineIndex: number): MovimientoMayorSource => {
          const metadata = accountMetadata(entry, line);
          return {
            lineaId: String(line.id || `${asientoId}-linea-${lineIndex + 1}`),
            asientoId,
            cuentaId: String(line.cuentaId || line.codigo || `preview-cuenta-${lineIndex + 1}`),
            codigoCuenta: String(line.codigo || line.codigoCuenta || ""),
            nombreCuenta: accountName(line),
            tipoCuenta: metadata.tipoCuenta,
            naturalezaCuenta: metadata.naturalezaCuenta,
            fecha,
            numeroAsiento,
            descripcion: String(entry.descripcion ?? entry.glosa ?? ""),
            orden: Number(line.orden || lineIndex + 1),
            debe: line.debe ?? 0,
            haber: line.haber ?? 0,
            estadoAsiento: "PREVIEW",
            periodoId: preview.periodo?.id || "preview",
            periodoAnio: periodoAnio || 0,
            periodoMes: periodoMes || "",
            empresaId: "preview",
            asientoCreatedAt: fecha,
          };
        });
      }),
    };
  }
}
