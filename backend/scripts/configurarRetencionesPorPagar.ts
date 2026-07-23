import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runImportFromCli } from "./cargarConfiguracionContable";

runImportFromCli()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
