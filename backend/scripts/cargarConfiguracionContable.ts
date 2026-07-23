import "dotenv/config";
import fs from "fs";
import path from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

type TipoCuenta = "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO" | "COSTO";
type NaturalezaCuenta = "DEUDORA" | "ACREEDORA";
type TipoOperacion = "COMPRA" | "VENTA" | "GASTO";

type AccountConfigInput = {
  clave: string;
  codigoCuenta: string;
  descripcion?: string;
  tipoEsperado?: TipoCuenta;
  naturalezaEsperada?: NaturalezaCuenta;
  requiereMovimiento?: boolean;
  activa?: boolean;
};

type AccountInput = {
  codigo: string;
  nombre: string;
  parentCodigo?: string | null;
  tipo: TipoCuenta;
  naturaleza: NaturalezaCuenta;
  nivel: number;
  activa?: boolean;
  permiteMovimiento?: boolean;
};

type ClassificationRuleInput = {
  codigo: string;
  categoria: string;
  tipoOperacion: TipoOperacion;
  prioridad?: number;
  activa?: boolean;
  descripcion?: string;
  condiciones: Record<string, unknown>;
};

type AccountingConfigurationFile = {
  cuentas?: AccountInput[];
  roles?: AccountConfigInput[];
  categorias?: AccountConfigInput[];
  configuraciones?: AccountConfigInput[];
  reglasClasificacion?: ClassificationRuleInput[];
};

function argValue(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireConfigPath() {
  const file = argValue("archivo");
  if (!file) {
    throw new Error("Debe indicar la ruta del archivo externo: --archivo=ruta/configuracion-contable.json");
  }
  return path.resolve(process.cwd(), file);
}

function readConfigFile(filePath: string): AccountingConfigurationFile {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as AccountingConfigurationFile;
  return {
    cuentas: parsed.cuentas || [],
    roles: parsed.roles || [],
    categorias: parsed.categorias || [],
    configuraciones: parsed.configuraciones || [],
    reglasClasificacion: parsed.reglasClasificacion || [],
  };
}

function assertNonEmpty(value: unknown, field: string) {
  if (!String(value ?? "").trim()) throw new Error(`Campo obligatorio vacío: ${field}.`);
}

function assertAccountConfigShape(config: AccountConfigInput) {
  assertNonEmpty(config.clave, "clave");
  assertNonEmpty(config.codigoCuenta, `codigoCuenta para ${config.clave}`);
}

function assertClassificationRuleShape(rule: ClassificationRuleInput) {
  assertNonEmpty(rule.codigo, "codigo de regla");
  assertNonEmpty(rule.categoria, `categoria para ${rule.codigo}`);
  assertNonEmpty(rule.tipoOperacion, `tipoOperacion para ${rule.codigo}`);
  if (!rule.condiciones || typeof rule.condiciones !== "object") {
    throw new Error(`La regla ${rule.codigo} debe incluir condiciones JSON.`);
  }
}

function assertAccountShape(account: AccountInput) {
  assertNonEmpty(account.codigo, "codigo de cuenta");
  assertNonEmpty(account.nombre, `nombre para ${account.codigo}`);
  assertNonEmpty(account.tipo, `tipo para ${account.codigo}`);
  assertNonEmpty(account.naturaleza, `naturaleza para ${account.codigo}`);
  if (!Number.isInteger(account.nivel) || account.nivel <= 0) {
    throw new Error(`La cuenta ${account.codigo} debe declarar nivel entero positivo.`);
  }
}

async function validateParent(tx: Prisma.TransactionClient, account: AccountInput) {
  if (!account.parentCodigo) return;
  const parent = await tx.cuentaContable.findUnique({ where: { codigo: account.parentCodigo } });
  if (!parent) throw new Error(`No existe la cuenta padre ${account.parentCodigo} para ${account.codigo}.`);
  if (!parent.activa) throw new Error(`La cuenta padre ${account.parentCodigo} está inactiva.`);
  if (parent.tipo !== account.tipo || parent.naturaleza !== account.naturaleza) {
    throw new Error(`La cuenta padre ${account.parentCodigo} no es compatible con ${account.codigo}.`);
  }
}

async function upsertAccounts(tx: Prisma.TransactionClient, accounts: AccountInput[]) {
  const result = [];
  for (const account of accounts) {
    assertAccountShape(account);
    await validateParent(tx, account);
    const existing = await tx.cuentaContable.findUnique({ where: { codigo: account.codigo } });
    if (existing && (existing.tipo !== account.tipo || existing.naturaleza !== account.naturaleza)) {
      throw new Error(`La cuenta ${account.codigo} existe con tipo o naturaleza incompatible.`);
    }
    const record = await tx.cuentaContable.upsert({
      where: { codigo: account.codigo },
      update: {
        nombre: account.nombre,
        parentCodigo: account.parentCodigo ?? null,
        tipo: account.tipo,
        naturaleza: account.naturaleza,
        nivel: account.nivel,
        activa: account.activa ?? true,
        movimiento: account.permiteMovimiento ?? true,
      },
      create: {
        codigo: account.codigo,
        nombre: account.nombre,
        parentCodigo: account.parentCodigo ?? null,
        tipo: account.tipo,
        naturaleza: account.naturaleza,
        nivel: account.nivel,
        activa: account.activa ?? true,
        movimiento: account.permiteMovimiento ?? true,
      },
    });
    result.push(record);
  }
  return result;
}

async function assertUsableAccount(tx: Prisma.TransactionClient, config: AccountConfigInput) {
  const account = await tx.cuentaContable.findUnique({ where: { codigo: config.codigoCuenta } });
  if (!account) throw new Error(`No existe CuentaContable ${config.codigoCuenta} para ${config.clave}.`);
  if (!account.activa) throw new Error(`La cuenta ${account.codigo} está inactiva para ${config.clave}.`);
  if ((config.requiereMovimiento ?? true) && !account.movimiento) {
    throw new Error(`La cuenta ${account.codigo} no permite movimientos para ${config.clave}.`);
  }
  if (config.tipoEsperado && account.tipo !== config.tipoEsperado) {
    throw new Error(`La cuenta ${account.codigo} tiene tipo ${account.tipo}; se esperaba ${config.tipoEsperado} para ${config.clave}.`);
  }
  if (config.naturalezaEsperada && account.naturaleza !== config.naturalezaEsperada) {
    throw new Error(`La cuenta ${account.codigo} tiene naturaleza ${account.naturaleza}; se esperaba ${config.naturalezaEsperada} para ${config.clave}.`);
  }
  return account;
}

async function upsertAccountConfigurations(tx: Prisma.TransactionClient, configs: AccountConfigInput[]) {
  const result = [];
  for (const config of configs) {
    assertAccountConfigShape(config);
    const account = await assertUsableAccount(tx, config);
    const record = await tx.configuracionCuentaContable.upsert({
      where: { clave: config.clave },
      update: {
        descripcion: config.descripcion,
        activa: config.activa ?? true,
        cuentaId: account.id,
      },
      create: {
        clave: config.clave,
        descripcion: config.descripcion,
        activa: config.activa ?? true,
        cuentaId: account.id,
      },
      include: { cuenta: true },
    });
    result.push(record);
  }
  return result;
}

async function upsertClassificationRules(tx: Prisma.TransactionClient, rules: ClassificationRuleInput[]) {
  const result = [];
  for (const rule of rules) {
    assertClassificationRuleShape(rule);
    const record = await tx.reglaClasificacionContable.upsert({
      where: { codigo: rule.codigo },
      update: {
        categoria: rule.categoria,
        tipoOperacion: rule.tipoOperacion,
        prioridad: rule.prioridad ?? 100,
        activa: rule.activa ?? true,
        condiciones: rule.condiciones,
        descripcion: rule.descripcion,
      },
      create: {
        codigo: rule.codigo,
        categoria: rule.categoria,
        tipoOperacion: rule.tipoOperacion,
        prioridad: rule.prioridad ?? 100,
        activa: rule.activa ?? true,
        condiciones: rule.condiciones,
        descripcion: rule.descripcion,
      },
    });
    result.push(record);
  }
  return result;
}

export async function importAccountingConfiguration(filePath: string) {
  const config = readConfigFile(filePath);
  const accountConfigs = [
    ...(config.roles || []),
    ...(config.categorias || []),
    ...(config.configuraciones || []),
  ];

  return prisma.$transaction(async (tx) => {
    const cuentas = await upsertAccounts(tx, config.cuentas || []);
    const configuraciones = await upsertAccountConfigurations(tx, accountConfigs);
    const reglas = await upsertClassificationRules(tx, config.reglasClasificacion || []);
    return {
      archivo: filePath,
      cuentasInsertadasOActualizadas: cuentas.length,
      configuracionesInsertadasOActualizadas: configuraciones.length,
      reglasClasificacionInsertadasOActualizadas: reglas.length,
      cuentas: cuentas.map((cuenta) => ({
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        parentCodigo: cuenta.parentCodigo,
        nivel: cuenta.nivel,
        tipo: cuenta.tipo,
        naturaleza: cuenta.naturaleza,
        activa: cuenta.activa,
        permiteMovimiento: cuenta.movimiento,
      })),
      configuraciones: configuraciones.map((record) => ({
        clave: record.clave,
        cuenta: record.cuenta.codigo,
        nombre: record.cuenta.nombre,
        activa: record.activa,
      })),
      reglas: reglas.map((rule) => ({
        codigo: rule.codigo,
        categoria: rule.categoria,
        tipoOperacion: rule.tipoOperacion,
        prioridad: rule.prioridad,
        activa: rule.activa,
      })),
    };
  });
}

export async function runImportFromCli() {
  const filePath = requireConfigPath();
  const result = await importAccountingConfiguration(filePath);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  runImportFromCli()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
