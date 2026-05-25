import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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

  console.log("¡Base de datos poblada con éxito!");
  console.log("Usuario Demo Creado:", usuarioDemo.ruc);
}

main()
  .catch((e) => {
    console.error("Error ejecutando el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });