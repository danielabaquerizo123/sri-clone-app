import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const parentCode = "2010701";

const childAccounts = [
  {
    codigo: "201070101",
    nombre: "RETENCIONES EN LA FUENTE DE IMPUESTO A LA RENTA POR PAGAR",
    parentCodigo: parentCode,
    tipo: "PASIVO" as const,
    naturaleza: "ACREEDORA" as const,
    nivel: 9,
  },
  {
    codigo: "201070102",
    nombre: "RETENCIONES DE IVA POR PAGAR",
    parentCodigo: parentCode,
    tipo: "PASIVO" as const,
    naturaleza: "ACREEDORA" as const,
    nivel: 9,
  },
];

const roleConfigs = [
  {
    clave: "ROL:RETENCION_FUENTE_POR_PAGAR",
    codigoCuenta: "201070101",
    descripcion: "Retenciones en la fuente de impuesto a la renta por pagar.",
  },
  {
    clave: "ROL:RETENCION_IVA_POR_PAGAR",
    codigoCuenta: "201070102",
    descripcion: "Retenciones de IVA por pagar.",
  },
  {
    clave: "ROL:CUENTAS_POR_PAGAR_PROVEEDORES",
    codigoCuenta: "201030102",
    descripcion: "Cuentas por pagar a proveedores locales.",
  },
  {
    clave: "ROL:IVA_CREDITO_TRIBUTARIO",
    codigoCuenta: "1010501",
    descripcion: "IVA crédito tributario recuperable en compras.",
  },
];

function assertAccountShape(account: NonNullable<Awaited<ReturnType<typeof prisma.cuentaContable.findUnique>>>) {
  if (!account.activa) throw new Error(`La cuenta ${account.codigo} está inactiva.`);
  if (!account.movimiento) throw new Error(`La cuenta ${account.codigo} no permite movimientos.`);
  if (account.tipo !== "PASIVO") throw new Error(`La cuenta ${account.codigo} debe ser PASIVO.`);
  if (account.naturaleza !== "ACREEDORA") throw new Error(`La cuenta ${account.codigo} debe ser ACREEDORA.`);
}

async function assertParentCanBecomeGroup() {
  const parent = await prisma.cuentaContable.findUnique({ where: { codigo: parentCode } });
  if (!parent) throw new Error(`No existe la cuenta padre ${parentCode}.`);
  if (!parent.activa) throw new Error(`La cuenta padre ${parentCode} está inactiva.`);
  if (parent.tipo !== "PASIVO" || parent.naturaleza !== "ACREEDORA") {
    throw new Error(`La cuenta padre ${parentCode} no tiene tipo/naturaleza compatible.`);
  }

  const [lineas, reglas, configuraciones] = await Promise.all([
    prisma.lineaAsiento.count({ where: { cuentaId: parent.id } }),
    prisma.reglaContable.count({
      where: {
        OR: [
          { cuentaBaseId: parent.id },
          { cuentaIvaId: parent.id },
          { cuentaContrapartidaId: parent.id },
        ],
      },
    }),
    prisma.configuracionCuentaContable.count({ where: { cuentaId: parent.id } }),
  ]);

  if (lineas > 0 || reglas > 0 || configuraciones > 0) {
    throw new Error(
      `La cuenta ${parentCode} tiene uso histórico o configuración activa: lineas=${lineas}, reglas=${reglas}, configuraciones=${configuraciones}.`
    );
  }
}

async function upsertChildAccounts() {
  const result = [];

  await prisma.cuentaContable.update({
    where: { codigo: parentCode },
    data: { movimiento: false, activa: true },
  });

  for (const account of childAccounts) {
    const existing = await prisma.cuentaContable.findUnique({ where: { codigo: account.codigo } });
    if (existing) {
      if (
        existing.nombre !== account.nombre ||
        existing.parentCodigo !== account.parentCodigo ||
        existing.tipo !== account.tipo ||
        existing.naturaleza !== account.naturaleza
      ) {
        throw new Error(`La cuenta ${account.codigo} existe con datos incompatibles.`);
      }
      assertAccountShape(existing);
    }

    const record = await prisma.cuentaContable.upsert({
      where: { codigo: account.codigo },
      update: {
        nombre: account.nombre,
        parentCodigo: account.parentCodigo,
        tipo: account.tipo,
        naturaleza: account.naturaleza,
        nivel: account.nivel,
        activa: true,
        movimiento: true,
      },
      create: {
        codigo: account.codigo,
        nombre: account.nombre,
        parentCodigo: account.parentCodigo,
        tipo: account.tipo,
        naturaleza: account.naturaleza,
        nivel: account.nivel,
        activa: true,
        movimiento: true,
      },
    });
    result.push(record);
  }

  return result;
}

async function assertConfigAccount(codigo: string) {
  const account = await prisma.cuentaContable.findUnique({ where: { codigo } });
  if (!account) throw new Error(`No existe cuenta ${codigo} para configurar rol.`);
  if (!account.activa) throw new Error(`La cuenta ${codigo} está inactiva.`);
  if (!account.movimiento) throw new Error(`La cuenta ${codigo} es agrupadora.`);
  return account;
}

async function upsertRoleConfigs() {
  const result = [];
  for (const config of roleConfigs) {
    const account = await assertConfigAccount(config.codigoCuenta);
    const record = await prisma.configuracionCuentaContable.upsert({
      where: { clave: config.clave },
      update: {
        descripcion: config.descripcion,
        activa: true,
        cuentaId: account.id,
      },
      create: {
        clave: config.clave,
        descripcion: config.descripcion,
        activa: true,
        cuentaId: account.id,
      },
      include: { cuenta: true },
    });
    result.push(record);
  }
  return result;
}

async function main() {
  await assertParentCanBecomeGroup();
  const cuentas = await upsertChildAccounts();
  const configuraciones = await upsertRoleConfigs();

  console.log(
    JSON.stringify(
      {
        parent: parentCode,
        cuentas: cuentas.map((cuenta) => ({
          id: cuenta.id,
          codigo: cuenta.codigo,
          nombre: cuenta.nombre,
          parentCodigo: cuenta.parentCodigo,
          nivel: cuenta.nivel,
          tipo: cuenta.tipo,
          naturaleza: cuenta.naturaleza,
          activa: cuenta.activa,
          movimiento: cuenta.movimiento,
        })),
        configuraciones: configuraciones.map((config) => ({
          clave: config.clave,
          cuentaId: config.cuentaId,
          codigo: config.cuenta.codigo,
          nombre: config.cuenta.nombre,
        })),
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
