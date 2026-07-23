import type { LibroMayorRawMovement } from "./libro-mayor.types";

export type LibroMayorMovementGroup = {
  cuentaId: string;
  codigoCuenta: string;
  nombreCuenta: string;
  tipoCuenta: string;
  naturalezaCuenta: string;
  movimientos: LibroMayorRawMovement[];
};

export function compareAccountCode(left: string, right: string) {
  return String(left).localeCompare(String(right));
}

export class LibroMayorAgrupadorService {
  group(lines: LibroMayorRawMovement[]): LibroMayorMovementGroup[] {
    const groups = new Map<string, LibroMayorMovementGroup>();

    for (const line of lines) {
      const key = `${line.empresaId}|${line.periodoId}|${line.cuentaId}`;
      const group = groups.get(key) || {
        cuentaId: line.cuentaId,
        codigoCuenta: line.codigoCuenta,
        nombreCuenta: line.nombreCuenta,
        tipoCuenta: line.tipoCuenta,
        naturalezaCuenta: line.naturalezaCuenta,
        movimientos: [],
      };
      group.movimientos.push(line);
      groups.set(key, group);
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        movimientos: [...group.movimientos].sort(compareMovement),
      }))
      .sort((left, right) => compareAccountCode(left.codigoCuenta, right.codigoCuenta) || left.nombreCuenta.localeCompare(right.nombreCuenta));
  }
}

export function compareMovement(left: LibroMayorRawMovement, right: LibroMayorRawMovement) {
  return (
    left.fecha.getTime() - right.fecha.getTime() ||
    left.numeroAsiento - right.numeroAsiento ||
    left.orden - right.orden ||
    left.asientoCreatedAt.getTime() - right.asientoCreatedAt.getTime() ||
    left.lineaId.localeCompare(right.lineaId)
  );
}
