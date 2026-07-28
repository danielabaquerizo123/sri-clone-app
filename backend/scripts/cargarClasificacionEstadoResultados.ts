import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";

const categories = ["INGRESO_OPERACIONAL", "OTRO_INGRESO", "COSTO_VENTAS", "GASTO_OPERACIONAL", "GASTO_ADMINISTRATIVO", "GASTO_VENTAS", "GASTO_FINANCIERO", "OTRO_GASTO", "PARTICIPACION_TRABAJADORES", "IMPUESTO_RENTA"] as const;
type Category = (typeof categories)[number];
type Config = { clasificaciones: Array<{ codigoCuenta: string; categoriaEstadoResultados: Category }> };

function expectedType(category: Category) {
  if (category === "INGRESO_OPERACIONAL" || category === "OTRO_INGRESO") return "INGRESO";
  if (category === "COSTO_VENTAS") return "COSTO";
  return "GASTO";
}

async function main() {
  const file = path.resolve(process.cwd(), "configuracion-estado-resultados.json");
  const config = JSON.parse(fs.readFileSync(file, "utf8")) as Config;
  const stats = { revisadas: config.clasificaciones.length, creadas: 0, existentes: 0, omitidas: 0, invalidas: 0, pendientes: 0 };
  const seen = new Set<string>();
  for (const item of config.clasificaciones) {
    if (!categories.includes(item.categoriaEstadoResultados) || seen.has(item.codigoCuenta)) { stats.invalidas += 1; continue; }
    seen.add(item.codigoCuenta);
    const account = await prisma.cuentaContable.findUnique({ where: { codigo: item.codigoCuenta } });
    if (!account || !account.activa || !account.movimiento || account.tipo !== expectedType(item.categoriaEstadoResultados)) { stats.invalidas += 1; continue; }
    const existing = await prisma.clasificacionEstadoResultados.findUnique({ where: { cuentaId: account.id } });
    if (existing) { stats.existentes += 1; continue; }
    await prisma.clasificacionEstadoResultados.create({ data: { cuentaId: account.id, categoria: item.categoriaEstadoResultados } });
    stats.creadas += 1;
  }
  const eligible = await prisma.cuentaContable.count({ where: { activa: true, movimiento: true, tipo: { in: ["INGRESO", "GASTO", "COSTO"] } } });
  const classified = await prisma.clasificacionEstadoResultados.count();
  stats.pendientes = Math.max(eligible - classified, 0);
  console.log(JSON.stringify(stats));
  if (stats.invalidas) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
