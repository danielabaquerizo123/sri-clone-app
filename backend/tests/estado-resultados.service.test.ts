import assert from "assert";
import { EstadoResultadosService, type CategoriaEstadoResultados } from "../src/services/contabilidad/06-reportes/estado-resultados.generator";

type Account = { id: string; codigo: string; cuenta: string; tipoCuenta: string; deudor: string; acreedor: string; categoria?: CategoriaEstadoResultados };

function balance(ingreso: string, includeCost = true) {
  const accounts: Account[] = [
    { id: "income", codigo: "income", cuenta: "Income", tipoCuenta: "INGRESO", deudor: "0.00", acreedor: ingreso, categoria: "INGRESO_OPERACIONAL" },
    { id: "other-income", codigo: "other-income", cuenta: "Other income", tipoCuenta: "INGRESO", deudor: "2.00", acreedor: "5.00", categoria: "OTRO_INGRESO" },
    { id: "operational", codigo: "operational", cuenta: "Operational", tipoCuenta: "GASTO", deudor: "3.00", acreedor: "0.00", categoria: "GASTO_OPERACIONAL" },
    { id: "admin", codigo: "admin", cuenta: "Admin", tipoCuenta: "GASTO", deudor: "20.00", acreedor: "0.00", categoria: "GASTO_ADMINISTRATIVO" },
    { id: "sales", codigo: "sales", cuenta: "Sales", tipoCuenta: "GASTO", deudor: "2.00", acreedor: "0.00", categoria: "GASTO_VENTAS" },
    { id: "financial", codigo: "financial", cuenta: "Financial", tipoCuenta: "GASTO", deudor: "5.00", acreedor: "0.00", categoria: "GASTO_FINANCIERO" },
    { id: "other-expense", codigo: "other-expense", cuenta: "Other expense", tipoCuenta: "GASTO", deudor: "4.00", acreedor: "0.00", categoria: "OTRO_GASTO" },
    { id: "participation", codigo: "participation", cuenta: "Participation", tipoCuenta: "GASTO", deudor: "10.00", acreedor: "0.00", categoria: "PARTICIPACION_TRABAJADORES" },
    { id: "tax", codigo: "tax", cuenta: "Tax", tipoCuenta: "GASTO", deudor: "10.00", acreedor: "0.00", categoria: "IMPUESTO_RENTA" },
    { id: "asset", codigo: "asset", cuenta: "Asset", tipoCuenta: "ACTIVO", deudor: "999.00", acreedor: "0.00", categoria: undefined },
  ];
  if (includeCost) accounts.push({ id: "cost", codigo: "cost", cuenta: "Cost", tipoCuenta: "COSTO", deudor: "40.00", acreedor: "0.00", categoria: "COSTO_VENTAS" });
  return {
    origen: "PREVIEW" as const,
    estadoReporte: "NO_CONTABILIZADO",
    mensaje: "",
    empresa: { id: "company", ruc: "ruc", razonSocial: "company" },
    periodo: { id: null, anio: 2030, mes: "01", estado: null },
    fechaDesde: null,
    fechaHasta: null,
    moneda: "Dólares (USD)" as const,
    filas: accounts.map((account, index) => ({ numero: index + 1, cuentaId: account.id, cuenta: account.cuenta, codigo: account.codigo, tipoCuenta: account.tipoCuenta, naturalezaCuenta: "", debe: account.deudor, haber: account.acreedor, deudor: account.deudor, acreedor: account.acreedor })),
    resumen: { totalCuentas: accounts.length, totalDebe: "0.00", totalHaber: "0.00", totalDeudor: "0.00", totalAcreedor: "0.00", diferenciaSumas: "0.00", diferenciaSaldos: "0.00", cuadradoSumas: true, cuadradoSaldos: true },
    classifications: accounts.flatMap((account) => account.categoria ? [{ cuentaId: account.id, categoria: account.categoria }] : []),
  };
}

async function resultFrom(input: ReturnType<typeof balance>) {
  const db = { clasificacionEstadoResultados: { findMany: async () => input.classifications } };
  return new EstadoResultadosService(undefined, db as any).generarDesdeBalance(input);
}

void (async () => {
  assert.equal((await resultFrom(balance("120.00"))).totales.resultadoNeto, "29.00");
  assert.equal((await resultFrom(balance("120.00"))).costoVentasDisponible, true);
  assert.equal((await resultFrom(balance("120.00"))).resultadoDeterminado, true);
  assert.equal((await resultFrom(balance("20.00"))).resultadoFinal.etiqueta, "PÉRDIDA NETA DEL EJERCICIO");
  assert.equal((await resultFrom(balance("91.00"))).resultadoFinal.valor, "0.00");
  assert.equal((await resultFrom(balance("120.00"))).lineas.some((line) => line.cuentaId === "asset"), false);
  const resultWithoutCost = await resultFrom(balance("120.00", false));
  assert.equal(resultWithoutCost.costoVentasDisponible, false);
  assert.equal(resultWithoutCost.resultadoDeterminado, false);
  assert.equal(resultWithoutCost.advertencias.includes("No se identificaron cuentas de costo de ventas en el Balance de Comprobación del período. No es posible determinar la utilidad bruta ni el resultado del ejercicio sin inventar valores."), true);
  await assert.rejects(() => resultFrom({ ...balance("120.00"), filas: [...balance("120.00").filas, balance("120.00").filas[0]] }), /duplicada/);
  console.log("estado-resultados.service.test.ts OK");
})();
