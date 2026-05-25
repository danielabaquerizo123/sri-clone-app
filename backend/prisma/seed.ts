import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const sriDate = (day: number, month: number, year: number) =>
  new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

async function main() {
  console.log("Iniciando el sembrado de datos (Seed)...");

  // Generamos el hash real de la clave demo
  const saltRounds = 10;
  const hashClaveDemo = await bcrypt.hash("sripassword2026", saltRounds);

  // Insertar el usuario demo respetando fielmente tu modelo Contribuyente
  const usuarioDemo = await prisma.contribuyente.upsert({
    where: { ruc: "1723456789001" },
    update: {},
    create: {
      ruc: "1723456789001",
      ciAdicional: null,
      clave: hashClaveDemo,
      razonSocial: "CONTRIBUYENTE DEMO SISTEMA S.A.",
      tipoContribuyente: "SOCIEDAD",
      estadoTributario: "AL DÍA",
      rol: "ADMIN"
    },
  });

  const obligacionesCalixto = [
    "1011 - DECLARACIÓN DE IMPUESTO A LA RENTA PERSONAS NATURALES",
    "2011 DECLARACION DE IVA",
    "1031 - DECLARACIÓN DE RETENCIONES EN LA FUENTE",
    "ANEXO TRANSACCIONAL SIMPLIFICADO",
  ].join(", ");

  const actividadesCalixto = [
    "G46201101 - VENTA AL POR MAYOR DE CEREALES (GRANOS).",
    "G46309501 - VENTA AL POR MAYOR DE BEBIDAS ALCOHÓLICAS, INCLUSO EL ENVASADO DE VINO A GRANEL SIN TRANSFORMACIÓN.",
    "G46412401 - VENTA AL POR MAYOR DE ARTÍCULOS DE BAZAR EN GENERAL.",
    "G46900002 - VENTA AL POR MAYOR DE OTROS PRODUCTOS DIVERSOS PARA EL CONSUMIDOR.",
    "G47110101 - VENTA AL POR MENOR DE GRAN VARIEDAD DE PRODUCTOS EN TIENDAS, ENTRE LOS QUE PREDOMINAN LOS PRODUCTOS ALIMENTICIOS, LAS BEBIDAS O EL TABACO.",
    "G47190001 - VENTA AL POR MENOR DE GRAN VARIEDAD DE PRODUCTOS ENTRE LOS QUE NO PREDOMINAN LOS PRODUCTOS ALIMENTICIOS.",
    "G47610301 - VENTA AL POR MENOR DE ARTÍCULOS DE PAPELERÍA.",
    "G47720101 - VENTA AL POR MENOR DE PRODUCTOS FARMACÉUTICOS.",
    "G47720502 - VENTA AL POR MENOR DE PAÑALES Y ARTÍCULOS DE USO PERSONAL.",
  ].join(" • ");

  const usuarioCalixto = await prisma.contribuyente.upsert({
    where: { ruc: "0602539041001" },
    update: {
      razonSocial: "GUAMAN GUALAN CALIXTO",
      tipoContribuyente: "PERSONA_NATURAL",
      estadoTributario: "AL DÍA",
      estadoRuc: "ACTIVO",
      regimen: "GENERAL",
      obligaciones: obligacionesCalixto,
      actividadesEconomicas: actividadesCalixto,
      establecimientosAbiertos: 6,
      establecimientosCerrados: 1,
      fechaRegistro: sriDate(11, 2, 1994),
      fechaInicioActividades: sriDate(26, 5, 2004),
      fechaCeseActividades: null,
      fechaReinicioActividades: sriDate(17, 2, 1994),
      fechaActualizacion: sriDate(12, 8, 2024),
      provincia: "GUAYAS",
      canton: "NARANJITO",
      parroquia: "NARANJITO",
      barrio: "CDLA JAVIER MARCOS",
      calle: "JAVIER MARCOS",
      numero: "7-0",
      interseccion: "MULTICOMERCIO",
      referencia: "A UNA CUADRA DEL COLEGIO NARANJITO",
      jurisdiccion: "ZONA 8 / GUAYAS / NARANJITO",
      email: "calixtoguaman@yahoo.com",
      telefonoDomicilio: "042720679",
      celular: "0989613983",
      artesano: "No registra",
      obligadoContabilidad: "SI",
      tipoAgenteRetencion: "PERSONAS NATURALES",
      agenteRetencion: "NO",
      contribuyenteEspecial: "SI",
      numerosRucAnteriores: "No registra",
      codigoVerificacion: "RCR1756996066720666",
      direccionIpEmision: "10.1.2.142",
    },
    create: {
      ruc: "0602539041001",
      ciAdicional: null,
      clave: hashClaveDemo,
      razonSocial: "GUAMAN GUALAN CALIXTO",
      tipoContribuyente: "PERSONA_NATURAL",
      estadoTributario: "AL DÍA",
      rol: "CONTADOR",
      estadoRuc: "ACTIVO",
      regimen: "GENERAL",
      obligaciones: obligacionesCalixto,
      actividadesEconomicas: actividadesCalixto,
      establecimientosAbiertos: 6,
      establecimientosCerrados: 1,
      fechaRegistro: sriDate(11, 2, 1994),
      fechaInicioActividades: sriDate(26, 5, 2004),
      fechaCeseActividades: null,
      fechaReinicioActividades: sriDate(17, 2, 1994),
      fechaActualizacion: sriDate(12, 8, 2024),
      provincia: "GUAYAS",
      canton: "NARANJITO",
      parroquia: "NARANJITO",
      barrio: "CDLA JAVIER MARCOS",
      calle: "JAVIER MARCOS",
      numero: "7-0",
      interseccion: "MULTICOMERCIO",
      referencia: "A UNA CUADRA DEL COLEGIO NARANJITO",
      jurisdiccion: "ZONA 8 / GUAYAS / NARANJITO",
      email: "calixtoguaman@yahoo.com",
      telefonoDomicilio: "042720679",
      celular: "0989613983",
      artesano: "No registra",
      obligadoContabilidad: "SI",
      tipoAgenteRetencion: "PERSONAS NATURALES",
      agenteRetencion: "NO",
      contribuyenteEspecial: "SI",
      numerosRucAnteriores: "No registra",
      codigoVerificacion: "RCR1756996066720666",
      direccionIpEmision: "10.1.2.142",
    },
  });

  console.log("¡Base de datos poblada con éxito!");
  console.log("Usuario Demo Creado:", usuarioDemo.ruc);
  console.log("Usuario RUC CALIXTO listo:", usuarioCalixto.ruc);
}

main()
  .catch((e) => {
    console.error("Error ejecutando el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
