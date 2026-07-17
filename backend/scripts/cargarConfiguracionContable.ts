import "dotenv/config";
import { prisma } from "../src/lib/prisma";

type AccountConfigSeed = {
  clave: string;
  codigoCuenta: string;
  descripcion: string;
  tipo: "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO" | "COSTO";
  naturaleza: "DEUDORA" | "ACREEDORA";
};

type ClassificationRuleSeed = {
  codigo: string;
  categoria: string;
  tipoOperacion: "COMPRA" | "VENTA" | "GASTO";
  prioridad: number;
  descripcion: string;
  condiciones: {
    origen: "REGLA_ACTIVIDAD" | "REGLA_CONCEPTO" | "REGLA_SUSTENTO" | "REGLA_GENERAL";
    confianza: "ALTA" | "MEDIA" | "BAJA";
    requiereRevision?: boolean;
    hojas?: string[];
    palabrasClave?: string[];
    actividades?: string[];
    codigosSustento?: string[];
    tiposComprobante?: string[];
    motivos?: string[];
  };
};

const accountConfigs: AccountConfigSeed[] = [
  {
    clave: "ROL:RETENCION_IVA_POR_COBRAR",
    codigoCuenta: "1010501",
    descripcion: "Retenciones de IVA por cobrar / crédito tributario IVA.",
    tipo: "ACTIVO",
    naturaleza: "DEUDORA",
  },
  {
    clave: "ROL:RETENCION_FUENTE_POR_COBRAR",
    codigoCuenta: "1010502",
    descripcion: "Retenciones en la fuente por cobrar / crédito tributario IR.",
    tipo: "ACTIVO",
    naturaleza: "DEUDORA",
  },
  {
    clave: "CATEGORIA:SUMINISTROS_MATERIALES",
    codigoCuenta: "5020228",
    descripcion: "Gastos administrativos por suministros y materiales.",
    tipo: "GASTO",
    naturaleza: "DEUDORA",
  },
  {
    clave: "CATEGORIA:MANTENIMIENTO_REPARACIONES",
    codigoCuenta: "5020208",
    descripcion: "Gastos administrativos por mantenimiento y reparaciones.",
    tipo: "GASTO",
    naturaleza: "DEUDORA",
  },
  {
    clave: "CATEGORIA:COMBUSTIBLE",
    codigoCuenta: "5020212",
    descripcion: "Gastos administrativos por combustibles.",
    tipo: "GASTO",
    naturaleza: "DEUDORA",
  },
  {
    clave: "CATEGORIA:TRANSPORTE",
    codigoCuenta: "5020215",
    descripcion: "Gastos administrativos por transporte.",
    tipo: "GASTO",
    naturaleza: "DEUDORA",
  },
  {
    clave: "CATEGORIA:HONORARIOS_PROFESIONALES",
    codigoCuenta: "5020205",
    descripcion: "Gastos administrativos por honorarios, comisiones y dietas a personas naturales.",
    tipo: "GASTO",
    naturaleza: "DEUDORA",
  },
  {
    clave: "CATEGORIA:ARRIENDOS",
    codigoCuenta: "5020209",
    descripcion: "Gastos administrativos por arrendamiento.",
    tipo: "GASTO",
    naturaleza: "DEUDORA",
  },
  {
    clave: "CATEGORIA:PUBLICIDAD",
    codigoCuenta: "5020211",
    descripcion: "Gastos administrativos por promoción y publicidad.",
    tipo: "GASTO",
    naturaleza: "DEUDORA",
  },
  {
    clave: "CATEGORIA:SEGUROS",
    codigoCuenta: "5020214",
    descripcion: "Gastos administrativos por seguros y reaseguros.",
    tipo: "GASTO",
    naturaleza: "DEUDORA",
  },
];

const classificationRules: ClassificationRuleSeed[] = [
  {
    codigo: "CONCEPTO_HONORARIOS_PROFESIONALES",
    categoria: "HONORARIOS_PROFESIONALES",
    tipoOperacion: "COMPRA",
    prioridad: 10,
    descripcion: "Clasifica compras con evidencia explícita de honorarios o servicios profesionales.",
    condiciones: {
      origen: "REGLA_CONCEPTO",
      confianza: "ALTA",
      hojas: ["COMPRAS", "GASTOS"],
      palabrasClave: ["honorarios", "servicio profesional", "servicios profesionales"],
      motivos: ["El concepto contiene evidencia de honorarios o servicios profesionales."],
    },
  },
  {
    codigo: "ACTIVIDAD_HONORARIOS_PROFESIONALES",
    categoria: "HONORARIOS_PROFESIONALES",
    tipoOperacion: "COMPRA",
    prioridad: 40,
    descripcion: "Clasifica actividad económica asociada a asesoría o consultoría profesional.",
    condiciones: {
      origen: "REGLA_ACTIVIDAD",
      confianza: "MEDIA",
      requiereRevision: true,
      hojas: ["COMPRAS", "GASTOS"],
      actividades: ["consultoria", "asesoria", "servicios profesionales"],
      motivos: ["La actividad económica sugiere servicios profesionales; requiere revisión si el concepto no es específico."],
    },
  },
  {
    codigo: "CONCEPTO_MANTENIMIENTO_REPARACIONES",
    categoria: "MANTENIMIENTO_REPARACIONES",
    tipoOperacion: "COMPRA",
    prioridad: 10,
    descripcion: "Clasifica compras con evidencia de mantenimiento o reparación.",
    condiciones: {
      origen: "REGLA_CONCEPTO",
      confianza: "ALTA",
      hojas: ["COMPRAS", "GASTOS"],
      palabrasClave: ["mantenimiento", "reparacion", "reparación", "taller"],
      motivos: ["El concepto contiene evidencia de mantenimiento o reparación."],
    },
  },
  {
    codigo: "CONCEPTO_SUMINISTROS_MATERIALES",
    categoria: "SUMINISTROS_MATERIALES",
    tipoOperacion: "COMPRA",
    prioridad: 15,
    descripcion: "Clasifica compras con evidencia de suministros, materiales o insumos.",
    condiciones: {
      origen: "REGLA_CONCEPTO",
      confianza: "ALTA",
      hojas: ["COMPRAS", "GASTOS"],
      palabrasClave: ["suministros", "materiales", "herramientas", "insumos", "repuesto"],
      motivos: ["El concepto contiene evidencia de suministros, materiales o insumos."],
    },
  },
  {
    codigo: "ACTIVIDAD_FERRETERIA_REVISION",
    categoria: "SUMINISTROS_MATERIALES",
    tipoOperacion: "COMPRA",
    prioridad: 80,
    descripcion: "Actividad ferretería: clasifica solo con revisión; no se trata como honorarios ni gasto genérico.",
    condiciones: {
      origen: "REGLA_ACTIVIDAD",
      confianza: "BAJA",
      requiereRevision: true,
      hojas: ["COMPRAS", "GASTOS"],
      actividades: ["ferreteria", "ferretería", "materiales de construccion", "materiales de construcción"],
      motivos: [
        "Actividad económica de ferretería detectada; requiere revisar concepto para confirmar destino contable.",
        "No se clasifica como honorarios ni como gasto administrativo genérico.",
      ],
    },
  },
  {
    codigo: "CONCEPTO_COMBUSTIBLE",
    categoria: "COMBUSTIBLE",
    tipoOperacion: "COMPRA",
    prioridad: 10,
    descripcion: "Clasifica compras de combustible.",
    condiciones: {
      origen: "REGLA_CONCEPTO",
      confianza: "ALTA",
      hojas: ["COMPRAS", "GASTOS"],
      palabrasClave: ["combustible", "gasolina", "diesel"],
      motivos: ["El concepto contiene evidencia de combustible."],
    },
  },
  {
    codigo: "CONCEPTO_TRANSPORTE",
    categoria: "TRANSPORTE",
    tipoOperacion: "COMPRA",
    prioridad: 10,
    descripcion: "Clasifica compras de transporte, flete o movilización.",
    condiciones: {
      origen: "REGLA_CONCEPTO",
      confianza: "ALTA",
      hojas: ["COMPRAS", "GASTOS"],
      palabrasClave: ["transporte", "movilizacion", "movilización", "flete"],
      motivos: ["El concepto contiene evidencia de transporte, flete o movilización."],
    },
  },
  {
    codigo: "CONCEPTO_ARRIENDOS",
    categoria: "ARRIENDOS",
    tipoOperacion: "COMPRA",
    prioridad: 10,
    descripcion: "Clasifica compras por arriendo o alquiler.",
    condiciones: {
      origen: "REGLA_CONCEPTO",
      confianza: "ALTA",
      hojas: ["COMPRAS", "GASTOS"],
      palabrasClave: ["arriendo", "alquiler", "arrendamiento"],
      motivos: ["El concepto contiene evidencia de arriendo o alquiler."],
    },
  },
  {
    codigo: "CONCEPTO_PUBLICIDAD",
    categoria: "PUBLICIDAD",
    tipoOperacion: "COMPRA",
    prioridad: 10,
    descripcion: "Clasifica compras de publicidad, marketing o propaganda.",
    condiciones: {
      origen: "REGLA_CONCEPTO",
      confianza: "ALTA",
      hojas: ["COMPRAS", "GASTOS"],
      palabrasClave: ["publicidad", "marketing", "propaganda", "promocion", "promoción"],
      motivos: ["El concepto contiene evidencia de publicidad o promoción."],
    },
  },
  {
    codigo: "CONCEPTO_SEGUROS",
    categoria: "SEGUROS",
    tipoOperacion: "COMPRA",
    prioridad: 10,
    descripcion: "Clasifica compras de seguros o pólizas.",
    condiciones: {
      origen: "REGLA_CONCEPTO",
      confianza: "ALTA",
      hojas: ["COMPRAS", "GASTOS"],
      palabrasClave: ["seguro", "seguros", "poliza", "póliza"],
      motivos: ["El concepto contiene evidencia de seguros o pólizas."],
    },
  },
  {
    codigo: "GENERAL_VENTA_COMPROBANTE_LOCAL",
    categoria: "VENTA_BIENES",
    tipoOperacion: "VENTA",
    prioridad: 100,
    descripcion: "Clasificación general de ventas locales por comprobante oficial.",
    condiciones: {
      origen: "REGLA_GENERAL",
      confianza: "ALTA",
      requiereRevision: false,
      hojas: ["VENTAS"],
      tiposComprobante: ["01", "18"],
      motivos: ["Venta local identificada por hoja VENTAS y tipo de comprobante oficial."],
    },
  },
  {
    codigo: "GENERAL_NOTA_CREDITO",
    categoria: "NOTA_CREDITO",
    tipoOperacion: "COMPRA",
    prioridad: 90,
    descripcion: "Identifica notas de crédito para revisión del reverso contable.",
    condiciones: {
      origen: "REGLA_GENERAL",
      confianza: "MEDIA",
      requiereRevision: true,
      hojas: ["COMPRAS", "GASTOS", "VENTAS"],
      tiposComprobante: ["04"],
      motivos: ["El comprobante corresponde a nota de crédito; revisar si reversa compra o venta."],
    },
  },
];

function assertUsableAccount(account: Awaited<ReturnType<typeof prisma.cuentaContable.findUnique>>, seed: AccountConfigSeed) {
  if (!account) throw new Error(`No existe CuentaContable ${seed.codigoCuenta} para ${seed.clave}.`);
  if (!account.activa) throw new Error(`La cuenta ${account.codigo} está inactiva para ${seed.clave}.`);
  if (!account.movimiento) throw new Error(`La cuenta ${account.codigo} no es de movimiento para ${seed.clave}.`);
  if (account.tipo !== seed.tipo) {
    throw new Error(`La cuenta ${account.codigo} tiene tipo ${account.tipo}; se esperaba ${seed.tipo} para ${seed.clave}.`);
  }
  if (account.naturaleza !== seed.naturaleza) {
    throw new Error(`La cuenta ${account.codigo} tiene naturaleza ${account.naturaleza}; se esperaba ${seed.naturaleza} para ${seed.clave}.`);
  }
}

async function main() {
  const configuraciones = [];
  for (const seed of accountConfigs) {
    const account = await prisma.cuentaContable.findUnique({ where: { codigo: seed.codigoCuenta } });
    assertUsableAccount(account, seed);
    const record = await prisma.configuracionCuentaContable.upsert({
      where: { clave: seed.clave },
      update: {
        descripcion: seed.descripcion,
        activa: true,
        cuentaId: account!.id,
      },
      create: {
        clave: seed.clave,
        descripcion: seed.descripcion,
        activa: true,
        cuentaId: account!.id,
      },
      include: { cuenta: true },
    });
    configuraciones.push({
      clave: record.clave,
      cuenta: record.cuenta.codigo,
      nombre: record.cuenta.nombre,
    });
  }

  const reglas = [];
  for (const seed of classificationRules) {
    const record = await prisma.reglaClasificacionContable.upsert({
      where: { codigo: seed.codigo },
      update: {
        categoria: seed.categoria,
        tipoOperacion: seed.tipoOperacion,
        prioridad: seed.prioridad,
        activa: true,
        condiciones: seed.condiciones,
        descripcion: seed.descripcion,
      },
      create: {
        codigo: seed.codigo,
        categoria: seed.categoria,
        tipoOperacion: seed.tipoOperacion,
        prioridad: seed.prioridad,
        activa: true,
        condiciones: seed.condiciones,
        descripcion: seed.descripcion,
      },
    });
    reglas.push({
      codigo: record.codigo,
      categoria: record.categoria,
      tipoOperacion: record.tipoOperacion,
      prioridad: record.prioridad,
    });
  }

  console.log(
    JSON.stringify(
      {
        configuracionesInsertadasOActualizadas: configuraciones.length,
        reglasInsertadasOActualizadas: reglas.length,
        configuraciones,
        reglas,
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
