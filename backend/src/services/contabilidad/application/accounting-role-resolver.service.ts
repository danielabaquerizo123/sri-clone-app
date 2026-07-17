import type {
  AccountingEvent,
  AccountingEventType,
  RequiredAccountRole,
} from "./accounting-event-generator.service";
import { prisma as defaultPrisma } from "../../../lib/prisma";

export type ResolvedAccount = {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  movimiento: boolean;
  tipo?: string | null;
  naturaleza?: string | null;
};

export type RoleResolutionOrigin =
  | "REGLA_CONTABLE"
  | "CONFIGURACION_CUENTA"
  | "CLASIFICACION"
  | "SIN_RESOLVER";

export type AccountingRoleResolution = {
  role: RequiredAccountRole;
  resolved: boolean;
  cuenta?: ResolvedAccount;
  origen: RoleResolutionOrigin;
  confianza: "ALTA" | "MEDIA" | "BAJA";
  requiereRevision: boolean;
  motivos: string[];
};

export type AccountingRuleAccountHint = {
  id?: string;
  codigo: string;
  descripcion: string;
  cuentaBase?: ResolvedAccount | null;
  cuentaIva?: ResolvedAccount | null;
  cuentaContrapartida?: ResolvedAccount | null;
};

export type AccountingRoleResolverInput = {
  event: AccountingEvent;
  role: RequiredAccountRole;
  reglaContable?: AccountingRuleAccountHint | null;
  cuentasDisponibles?: ResolvedAccount[];
};

export type AccountConfigurationRecord = {
  clave: string;
  activa: boolean;
  cuenta: ResolvedAccount;
};

type DbClient = typeof defaultPrisma;

function isPurchaseEvent(type: AccountingEventType) {
  return (
    type === "DEVENGO_COMPRA" ||
    type === "NOTA_CREDITO_COMPRA" ||
    type === "NOTA_DEBITO_COMPRA"
  );
}

function isSaleEvent(type: AccountingEventType) {
  return (
    type === "DEVENGO_VENTA" ||
    type === "NOTA_CREDITO_VENTA" ||
    type === "NOTA_DEBITO_VENTA"
  );
}

function fromRule(input: AccountingRoleResolverInput): ResolvedAccount | null {
  const { event, role, reglaContable } = input;
  if (!reglaContable) return null;

  if (isPurchaseEvent(event.tipo)) {
    if (role === "GASTO_COSTO_ACTIVO") return reglaContable.cuentaBase || null;
    if (role === "IVA_CREDITO_TRIBUTARIO") return reglaContable.cuentaIva || null;
    if (role === "CUENTAS_POR_PAGAR_PROVEEDORES") return reglaContable.cuentaContrapartida || null;
  }

  if (isSaleEvent(event.tipo)) {
    if (role === "INGRESO") return reglaContable.cuentaBase || null;
    if (role === "IVA_POR_PAGAR") return reglaContable.cuentaIva || null;
    if (role === "CUENTAS_POR_COBRAR_CLIENTES") return reglaContable.cuentaContrapartida || null;
  }

  if (event.tipo === "RETENCION_EMITIDA" && role === "CUENTAS_POR_PAGAR_PROVEEDORES") {
    return reglaContable.cuentaContrapartida || null;
  }

  if (event.tipo === "RETENCION_RECIBIDA" && role === "CUENTAS_POR_COBRAR_CLIENTES") {
    return reglaContable.cuentaContrapartida || null;
  }

  return null;
}

function unresolved(role: RequiredAccountRole, event: AccountingEvent, reason: string): AccountingRoleResolution {
  return {
    role,
    resolved: false,
    origen: "SIN_RESOLVER",
    confianza: "BAJA",
    requiereRevision: true,
    motivos: [
      reason,
      `No se inventa cuenta para ${role} en evento ${event.tipo}.`,
    ],
  };
}

function invalidAccount(
  role: RequiredAccountRole,
  event: AccountingEvent,
  cuenta: ResolvedAccount,
  reason: string,
  origen: RoleResolutionOrigin = "REGLA_CONTABLE"
): AccountingRoleResolution {
  return {
    role,
    resolved: false,
    cuenta,
    origen,
    confianza: "BAJA",
    requiereRevision: true,
    motivos: [reason, `La cuenta ${cuenta.codigo} no puede usarse en ${event.tipo}.`],
  };
}

function expectedAccount(role: RequiredAccountRole, event: AccountingEvent) {
  if (role === "GASTO_COSTO_ACTIVO") return { tipos: ["GASTO", "COSTO", "ACTIVO"], naturalezas: ["DEUDORA"] };
  if (role.includes("POR_COBRAR") || role === "IVA_CREDITO_TRIBUTARIO" || role === "CUENTA_FINANCIERA") {
    return { tipos: ["ACTIVO"], naturalezas: ["DEUDORA"] };
  }
  if (role.includes("POR_PAGAR") || role === "IVA_POR_PAGAR") {
    return { tipos: ["PASIVO"], naturalezas: ["ACREEDORA"] };
  }
  if (role === "INGRESO") return { tipos: ["INGRESO"], naturalezas: ["ACREEDORA"] };
  if (event.tipo.includes("COMPRA")) return { tipos: ["GASTO", "COSTO", "ACTIVO"], naturalezas: ["DEUDORA"] };
  return null;
}

function validateAccount(
  role: RequiredAccountRole,
  event: AccountingEvent,
  cuenta: ResolvedAccount,
  origen: RoleResolutionOrigin = "REGLA_CONTABLE"
) {
  if (!cuenta.activa) {
    return invalidAccount(role, event, cuenta, `La cuenta ${cuenta.codigo} está inactiva.`, origen);
  }

  if (!cuenta.movimiento) {
    return invalidAccount(role, event, cuenta, `La cuenta ${cuenta.codigo} es agrupadora y no permite movimientos.`, origen);
  }

  const expected = expectedAccount(role, event);
  if (expected && cuenta.tipo && !expected.tipos.includes(cuenta.tipo)) {
    return invalidAccount(
      role,
      event,
      cuenta,
      `La cuenta ${cuenta.codigo} tiene tipo ${cuenta.tipo}; no es compatible con ${role}.`,
      origen
    );
  }
  if (expected && cuenta.naturaleza && !expected.naturalezas.includes(cuenta.naturaleza)) {
    return invalidAccount(
      role,
      event,
      cuenta,
      `La cuenta ${cuenta.codigo} tiene naturaleza ${cuenta.naturaleza}; no es compatible con ${role}.`,
      origen
    );
  }

  return {
    role,
    resolved: true,
    cuenta,
    origen,
    confianza: "ALTA" as const,
    requiereRevision: false,
    motivos: [
      origen === "CONFIGURACION_CUENTA"
        ? `Rol ${role} resuelto desde ConfiguracionCuentaContable.`
        : `Rol ${role} resuelto desde la regla contable.`,
    ],
  };
}

export class AccountingRoleResolver {
  constructor(
    private readonly options: {
      db?: DbClient;
      configuraciones?: AccountConfigurationRecord[];
    } = {}
  ) {}

  private configurationKeys(input: AccountingRoleResolverInput) {
    const keys: string[] = [];
    if (input.role === "GASTO_COSTO_ACTIVO" && input.event.clasificacion?.categoria) {
      keys.push(`CATEGORIA:${input.event.clasificacion.categoria}`);
    }
    keys.push(`ROL:${input.role}`);
    return keys;
  }

  private findPreloadedConfiguration(input: AccountingRoleResolverInput) {
    const keys = this.configurationKeys(input);
    return this.options.configuraciones?.find((config) => config.activa && keys.includes(config.clave)) || null;
  }

  private async findDbConfiguration(input: AccountingRoleResolverInput) {
    const keys = this.configurationKeys(input);
    const record = await (this.options.db || defaultPrisma).configuracionCuentaContable.findFirst({
      where: {
        activa: true,
        clave: { in: keys },
      },
      include: { cuenta: true },
      orderBy: { clave: "asc" },
    });
    if (!record) return null;
    return {
      clave: record.clave,
      activa: record.activa,
      cuenta: record.cuenta,
    } satisfies AccountConfigurationRecord;
  }

  resolve(input: AccountingRoleResolverInput): AccountingRoleResolution {
    if (
      input.event.tipo === "PAGO_PROVEEDOR" ||
      input.event.tipo === "COBRO_CLIENTE" ||
      input.role === "CUENTA_FINANCIERA"
    ) {
      return unresolved(
        input.role,
        input.event,
        "Los pagos/cobros pendientes no se resuelven automaticamente sin evidencia de tesoreria."
      );
    }

    const configured = this.findPreloadedConfiguration(input);
    if (configured) {
      return validateAccount(input.role, input.event, configured.cuenta, "CONFIGURACION_CUENTA");
    }

    if (input.role === "GASTO_COSTO_ACTIVO" || input.role.startsWith("RETENCION_")) {
      return unresolved(
        input.role,
        input.event,
        `No existe ConfiguracionCuentaContable activa para ${this.configurationKeys(input).join(" o ")}.`
      );
    }

    const cuenta = fromRule(input);
    if (!cuenta) {
      return unresolved(input.role, input.event, `No existe cuenta proveniente de ReglaContable para el rol ${input.role}.`);
    }

    return validateAccount(input.role, input.event, cuenta);
  }

  resolveMany(input: Omit<AccountingRoleResolverInput, "role">): AccountingRoleResolution[] {
    return input.event.rolesRequeridos.map((role) =>
      this.resolve({
        ...input,
        role,
      })
    );
  }

  async resolveAsync(input: AccountingRoleResolverInput): Promise<AccountingRoleResolution> {
    const configured = await this.findDbConfiguration(input);
    if (configured) {
      return validateAccount(input.role, input.event, configured.cuenta, "CONFIGURACION_CUENTA");
    }
    return this.resolve(input);
  }

  async resolveManyAsync(input: Omit<AccountingRoleResolverInput, "role">): Promise<AccountingRoleResolution[]> {
    const resolutions: AccountingRoleResolution[] = [];
    for (const role of input.event.rolesRequeridos) {
      resolutions.push(await this.resolveAsync({ ...input, role }));
    }
    return resolutions;
  }
}

export async function loadAccountConfigurationsFromPrisma(db: DbClient = defaultPrisma): Promise<AccountConfigurationRecord[]> {
  const records = await db.configuracionCuentaContable.findMany({
    where: { activa: true },
    include: { cuenta: true },
  });
  return records.map((record) => ({
    clave: record.clave,
    activa: record.activa,
    cuenta: record.cuenta,
  }));
}
