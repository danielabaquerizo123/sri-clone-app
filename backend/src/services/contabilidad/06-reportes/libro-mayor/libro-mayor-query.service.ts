import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../../../lib/prisma";
import { compareAccountCode } from "./libro-mayor-agrupador.service";
import { decimal, MONEY_ZERO } from "./libro-mayor-saldos.service";
import type { LibroMayorParams, LibroMayorRawMovement } from "./libro-mayor.types";

type DbClient = PrismaClient | typeof defaultPrisma;

const VALID_ENTRY_STATES = ["BORRADOR", "APROBADO"] as const;
const DEFAULT_LIMIT = Number.MAX_SAFE_INTEGER;
const MAX_LIMIT = Number.MAX_SAFE_INTEGER;

function dateFromParam(value: string | undefined, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setUTCHours(23, 59, 59, 999);
  return date;
}

function containsText(value: string | undefined) {
  const text = String(value || "").trim();
  return text ? text : undefined;
}

function pageNumber(value: number | undefined) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 1;
}

function limitNumber(value: number | undefined) {
  if (!Number.isInteger(value) || Number(value) <= 0) return DEFAULT_LIMIT;
  return Math.min(Number(value), MAX_LIMIT);
}

export class LibroMayorQueryService {
  constructor(private readonly db: DbClient = defaultPrisma) {}

  async findCompany(ruc: string) {
    const empresa = await this.db.contribuyente.findUnique({ where: { ruc } });
    if (!empresa) throw new Error("Contribuyente no encontrado.");
    return empresa;
  }

  async findMovements(params: LibroMayorParams): Promise<{
    empresa: Awaited<ReturnType<LibroMayorQueryService["findCompany"]>>;
    periodo: { id: string | null; anio: number | null; mes: string | null; estado: string | null };
    fechaDesde: Date | undefined;
    fechaHasta: Date | undefined;
    page: number;
    limit: number;
    movements: LibroMayorRawMovement[];
  }> {
    const empresa = await this.findCompany(params.ruc);
    const fechaDesde = dateFromParam(params.fechaDesde);
    const fechaHasta = dateFromParam(params.fechaHasta, true);
    const page = pageNumber(params.page);
    const limit = limitNumber(params.limit);
    const busqueda = containsText(params.busqueda);

    const where: Prisma.LineaAsientoWhereInput = {
      asiento: {
        contribuyenteId: empresa.id,
        estado: { in: [...VALID_ENTRY_STATES] },
        ...(params.periodoId ? { periodoId: params.periodoId } : {}),
        ...(fechaDesde || fechaHasta
          ? {
              fecha: {
                ...(fechaDesde ? { gte: fechaDesde } : {}),
                ...(fechaHasta ? { lte: fechaHasta } : {}),
              },
            }
          : {}),
      },
      ...(params.cuentaId ? { cuentaId: params.cuentaId } : {}),
      ...(busqueda
        ? {
            cuenta: {
              OR: [
                { codigo: { contains: busqueda, mode: "insensitive" } },
                { nombre: { contains: busqueda, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const rows = await this.db.lineaAsiento.findMany({
      where,
      include: {
        cuenta: true,
        asiento: {
          include: { periodo: true },
        },
      },
    });

    const filtered = rows
      .filter((row) => !params.cuentaDesde || compareAccountCode(row.cuenta.codigo, params.cuentaDesde) >= 0)
      .filter((row) => !params.cuentaHasta || compareAccountCode(row.cuenta.codigo, params.cuentaHasta) <= 0)
      .map((row): LibroMayorRawMovement => ({
        lineaId: row.id,
        asientoId: row.asientoId,
        cuentaId: row.cuentaId,
        codigoCuenta: row.cuenta.codigo,
        nombreCuenta: row.cuenta.nombre,
        tipoCuenta: row.cuenta.tipo,
        naturalezaCuenta: row.cuenta.naturaleza,
        fecha: row.asiento.fecha,
        numeroAsiento: row.asiento.numero,
        descripcion: row.asiento.descripcion,
        orden: row.orden,
        debe: row.debe,
        haber: row.haber,
        estadoAsiento: row.asiento.estado,
        periodoId: row.asiento.periodoId,
        periodoAnio: row.asiento.periodo.anio,
        periodoMes: row.asiento.periodo.mes,
        empresaId: row.asiento.contribuyenteId,
        asientoCreatedAt: row.asiento.createdAt,
      }));

    const firstPeriod = filtered[0];
    return {
      empresa,
      periodo: firstPeriod
        ? {
            id: firstPeriod.periodoId,
            anio: firstPeriod.periodoAnio,
            mes: firstPeriod.periodoMes,
            estado: null,
          }
        : { id: params.periodoId || null, anio: null, mes: null, estado: null },
      fechaDesde,
      fechaHasta,
      page,
      limit,
      movements: filtered,
    };
  }

  async previousBalances(params: LibroMayorParams, cuentaIds: string[]) {
    if (!params.incluirSaldoAnterior || cuentaIds.length === 0 || !params.fechaDesde) {
      return new Map<string, Prisma.Decimal>();
    }

    const empresa = await this.findCompany(params.ruc);
    const fechaDesde = dateFromParam(params.fechaDesde);
    if (!fechaDesde) return new Map<string, Prisma.Decimal>();

    const rows = await this.db.lineaAsiento.findMany({
      where: {
        cuentaId: { in: cuentaIds },
        asiento: {
          contribuyenteId: empresa.id,
          estado: { in: [...VALID_ENTRY_STATES] },
          fecha: { lt: fechaDesde },
        },
      },
      select: {
        cuentaId: true,
        debe: true,
        haber: true,
      },
    });

    const balances = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      const current = balances.get(row.cuentaId) || MONEY_ZERO;
      balances.set(row.cuentaId, current.plus(decimal(row.debe)).minus(decimal(row.haber)));
    }
    return balances;
  }
}
