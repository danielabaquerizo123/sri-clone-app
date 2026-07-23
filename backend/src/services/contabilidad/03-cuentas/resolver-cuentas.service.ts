import type {
  AccountingEvent,
  AccountingEventType,
} from "../04-asientos/generador-eventos.service";
import type { RequiredAccountRole } from "../contratos";
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

function canonicalRole(role: RequiredAccountRole): RequiredAccountRole {
  return role === "INGRESO" ? "INGRESO_VENTAS" : role;
}

function evidenceValue(event: AccountingEvent, fields: string[]) {
  for (const field of fields) {
    const value = String(event.evidencias.find((item) => item.campo === field)?.valor || "").trim();
    if (value) return value;
  }
  return "";
}

function paymentMethodCode(value: string) {
  const match = value.match(/\d+/);
  return match ? match[0].padStart(2, "0").slice(0, 2) : "";
}

function financialConfigurationKey(event: AccountingEvent) {
  const value = evidenceValue(event, ["formaPago1", "formaPago2", "formaCobro1", "formaCobro2"]);
  const code = paymentMethodCode(value);
  if (!code) return "ROL:CUENTA_FINANCIERA";
  return code === "01" ? "ROL:CUENTA_FINANCIERA_CAJA" : "ROL:CUENTA_FINANCIERA_BANCO";
}

function fromRule(input: AccountingRoleResolverInput): ResolvedAccount | null {
  const { event, role, reglaContable } = input;
  const normalizedRole = canonicalRole(role);
  if (!reglaContable) return null;

  if (isPurchaseEvent(event.tipo)) {
    if (normalizedRole === "GASTO_COSTO_ACTIVO") return reglaContable.cuentaBase || null;
    if (normalizedRole === "IVA_CREDITO_TRIBUTARIO") return reglaContable.cuentaIva || null;
    if (normalizedRole === "CUENTAS_POR_PAGAR_PROVEEDORES") return reglaContable.cuentaContrapartida || null;
  }

  if (isSaleEvent(event.tipo)) {
    if (normalizedRole === "INGRESO_VENTAS") return reglaContable.cuentaBase || null;
    if (normalizedRole === "IVA_POR_PAGAR") return reglaContable.cuentaIva || null;
    if (normalizedRole === "CUENTAS_POR_COBRAR_CLIENTES") return reglaContable.cuentaContrapartida || null;
  }

  if (event.tipo === "RETENCION_EMITIDA" && normalizedRole === "CUENTAS_POR_PAGAR_PROVEEDORES") {
    return reglaContable.cuentaContrapartida || null;
  }

  if (event.tipo === "RETENCION_RECIBIDA" && normalizedRole === "CUENTAS_POR_COBRAR_CLIENTES") {
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
  const normalizedRole = canonicalRole(role);
  if (normalizedRole === "GASTO_COSTO_ACTIVO") return { tipos: ["GASTO", "COSTO", "ACTIVO"], naturalezas: ["DEUDORA"] };
  if (normalizedRole.includes("POR_COBRAR") || normalizedRole === "IVA_CREDITO_TRIBUTARIO" || normalizedRole === "CUENTA_FINANCIERA") {
    return { tipos: ["ACTIVO"], naturalezas: ["DEUDORA"] };
  }
  if (normalizedRole.includes("POR_PAGAR") || normalizedRole === "IVA_POR_PAGAR") {
    return { tipos: ["PASIVO"], naturalezas: ["ACREEDORA"] };
  }
  if (normalizedRole === "INGRESO_VENTAS") return { tipos: ["INGRESO"], naturalezas: ["ACREEDORA"] };
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
    const role = canonicalRole(input.role);
    if (role === "CUENTA_FINANCIERA") {
      keys.push(financialConfigurationKey(input.event));
      return keys;
    }
    if (role === "GASTO_COSTO_ACTIVO" && input.event.clasificacion?.categoria) {
      const categoriaBase = input.event.clasificacion.categoriaBase;
      const destinoContable = input.event.clasificacion.destinoContable;
      if (categoriaBase && destinoContable && !input.event.clasificacion.requiereDecisionDestino) {
        keys.push(`CATEGORIA_DESTINO:${categoriaBase}:${destinoContable}`);
      }
      keys.push(`CATEGORIA:${input.event.clasificacion.categoria}`);
    }
    keys.push(`ROL:${role}`);
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
    const configured = this.findPreloadedConfiguration(input);
    if (configured) {
      return validateAccount(input.role, input.event, configured.cuenta, "CONFIGURACION_CUENTA");
    }

    const cuenta = fromRule(input);
    if (cuenta) {
      return validateAccount(input.role, input.event, cuenta);
    }

    return unresolved(
      input.role,
      input.event,
      `No existe ConfiguracionCuentaContable activa para ${this.configurationKeys(input).join(" o ")}.`
    );
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
