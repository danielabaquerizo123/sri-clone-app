import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { ExcelLibroDiarioService } from "../src/services/contabilidad/excel-libro-diario.service";

type RowPatch = Record<number, unknown>;

const accounts = {
  gasto: { id: "5.01.01.01", codigo: "5.01.01.01", nombre: "COMPRAS INVENTARIO", activa: true, movimiento: true },
  gastoAgrupadora: { id: "5.01", codigo: "5.01", nombre: "GASTOS AGRUPADORA", activa: true, movimiento: false },
  ivaCompra: { id: "1.01.05.01", codigo: "1.01.05.01", nombre: "IVA COMPRAS", activa: true, movimiento: true },
  cxp: { id: "2.01.01.01", codigo: "2.01.01.01", nombre: "CUENTAS POR PAGAR PROVEEDORES", activa: true, movimiento: true },
  retFuentePagar: { id: "2.01.07.02", codigo: "2.01.07.02", nombre: "RETENCIONES FUENTE POR PAGAR", activa: true, movimiento: true },
  retIvaPagar: { id: "2.01.07.03", codigo: "2.01.07.03", nombre: "RETENCIONES IVA POR PAGAR", activa: true, movimiento: true },
  ingreso: { id: "4.01.01.01", codigo: "4.01.01.01", nombre: "VENTAS LOCALES", activa: true, movimiento: true },
  ivaVenta: { id: "2.01.07.01", codigo: "2.01.07.01", nombre: "IVA VENTAS", activa: true, movimiento: true },
  cxc: { id: "1.01.02.01", codigo: "1.01.02.01", nombre: "CUENTAS POR COBRAR CLIENTES", activa: true, movimiento: true },
};

function rules(baseAccount = accounts.gasto) {
  return [
    {
      id: "COMPRA_FACTURA_TEST",
      codigo: "COMPRA_FACTURA_TEST",
      descripcion: "Compra test",
      tipoOperacion: "COMPRA",
      tipoComprobante: "01",
      prioridad: 10,
      activa: true,
      cuentaBase: baseAccount,
      cuentaIva: accounts.ivaCompra,
      cuentaContrapartida: accounts.cxp,
    },
    {
      id: "NC_COMPRA_TEST",
      codigo: "NC_COMPRA_TEST",
      descripcion: "Nota credito compra test",
      tipoOperacion: "COMPRA",
      tipoComprobante: "04",
      prioridad: 20,
      activa: true,
      cuentaBase: baseAccount,
      cuentaIva: accounts.ivaCompra,
      cuentaContrapartida: accounts.cxp,
    },
    {
      id: "VENTA_FACTURA_TEST",
      codigo: "VENTA_FACTURA_TEST",
      descripcion: "Venta test",
      tipoOperacion: "VENTA",
      tipoComprobante: "18",
      prioridad: 10,
      activa: true,
      cuentaBase: accounts.ingreso,
      cuentaIva: accounts.ivaVenta,
      cuentaContrapartida: accounts.cxc,
    },
    {
      id: "NC_VENTA_TEST",
      codigo: "NC_VENTA_TEST",
      descripcion: "Nota credito venta test",
      tipoOperacion: "VENTA",
      tipoComprobante: "04",
      prioridad: 20,
      activa: true,
      cuentaBase: accounts.ingreso,
      cuentaIva: accounts.ivaVenta,
      cuentaContrapartida: accounts.cxc,
    },
  ];
}

function blankRow() {
  return Array.from({ length: 145 }, () => null);
}

function row(patch: RowPatch) {
  const result = blankRow();
  Object.entries(patch).forEach(([index, value]) => {
    result[Number(index)] = value;
  });
  return result;
}

function compra(overrides: RowPatch = {}) {
  return row({
    0: "1790012345001",
    2: "Proveedor Materiales S.A.",
    6: "01-Factura",
    7: "001",
    8: "001",
    9: "000000001",
    11: "15/04/2026",
    12: "15/04/2026",
    18: "Compra de materiales",
    19: "02-Costo o gasto",
    23: 100,
    25: 15,
    36: 115,
    43: "COMERCIO DE MATERIALES",
    93: "01-PAGO A RESIDENTE",
    94: "01-SIN UTILIZACION DEL SISTEMA FINANCIERO",
    ...overrides,
  });
}

function venta(overrides: RowPatch = {}) {
  return row({
    0: "0990012345001",
    2: "Cliente Uno",
    7: "18-Documentos autorizados",
    8: "16/04/2026",
    9: "001",
    10: "000000001",
    11: "Venta de producto",
    15: 200,
    17: 30,
    27: 230,
    31: "Venta local",
    34: "COMERCIO",
    53: "01-SIN UTILIZACION DEL SISTEMA FINANCIERO",
    ...overrides,
  });
}

function workbookBuffer(sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([...Array.from({ length: 6 }, blankRow), ...rows]), name);
  });
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function service(baseAccount = accounts.gasto) {
  return new ExcelLibroDiarioService({
    accounts: Object.values(accounts),
    rules: rules(baseAccount),
    classification: {
      reglasConcepto: [
        {
          id: "TEST_MATERIALES",
          categoria: "SUMINISTROS_MATERIALES",
          confianza: "ALTA",
          origen: "REGLA_CONCEPTO",
          motivos: ["Fixture de prueba: concepto con materiales."],
          match: (context: any) => String(context.conceptoNormalizado || "").includes("MATERIALES"),
        },
      ],
      reglasGenerales: [
        {
          id: "TEST_VENTA",
          categoria: "VENTA_BIENES",
          confianza: "ALTA",
          origen: "REGLA_GENERAL",
          requiereRevision: false,
          motivos: ["Fixture de prueba: venta local."],
          match: (context: any) => context.hoja === "VENTAS",
        },
      ],
    },
    accountConfigurations: [
      { clave: "CATEGORIA:SUMINISTROS_MATERIALES", activa: true, cuenta: baseAccount },
      { clave: "ROL:RETENCION_FUENTE_POR_PAGAR", activa: true, cuenta: accounts.retFuentePagar },
      { clave: "ROL:RETENCION_IVA_POR_PAGAR", activa: true, cuenta: accounts.retIvaPagar },
      { clave: "ROL:CUENTAS_POR_PAGAR_PROVEEDORES", activa: true, cuenta: accounts.cxp },
      { clave: "ROL:IVA_CREDITO_TRIBUTARIO", activa: true, cuenta: accounts.ivaCompra },
    ],
  });
}

function assertBalanced(result: ReturnType<ExcelLibroDiarioService["process"]>) {
  assert.equal(result.resumen.totalDebe, result.resumen.totalHaber);
  result.asientos.forEach((asiento) => {
    assert.equal(asiento.totalDebe, asiento.totalHaber);
    assert.ok(asiento.lineas.length >= 2);
    assert.equal(asiento.lineas.some((linea) => linea.codigo === "5.02.02.29"), false);
    assert.equal(asiento.lineas.some((linea) => linea.cuenta.includes("AJUSTE")), false);
  });
}

{
  const result = service().process(
    workbookBuffer({
      COMPRAS: [compra()],
      VENTAS: [venta()],
      GASTOSP: [blankRow()],
      PARAMETROS: [row({ 0: "x" })],
    }),
    "ats.xlsx"
  );

  assert.equal(result.message, "Excel ATS procesado por el módulo Contabilidad.");
  assert.deepEqual(result.resumen.hojasLeidas, ["COMPRAS", "VENTAS", "GASTOSP"]);
  assert.deepEqual(result.resumen.hojasIgnoradas, ["PARAMETROS"]);
  assert.equal(result.resumen.documentosLeidos, 2);
  assert.equal(result.resumen.asientos, 2);
  assert.deepEqual(result.resumen.tiposPagoCompras, { "01": 1 });
  assert.deepEqual(result.resumen.formasPagoCompras, { "01": 1 });
  assert.deepEqual(result.resumen.formasCobroVentas, { "01": 1 });
  assert.equal("formasPagoVentas" in result.resumen, false);
  assert.equal(result.warnings.filter((issue: any) => issue.codigo === "FORMA_PAGO_NO_PRUEBA_PAGO").length, 1);
  assert.equal(Array.isArray(result.libroDiario), true);
  assert.equal(Array.isArray(result.asientos), true);
  assert.equal(Array.isArray(result.issues), true);
  assert.equal(Array.isArray(result.warnings), true);
  assert.equal(Array.isArray(result.errors), true);
  assertBalanced(result);
  assert.ok(result.asientos[0].evidencias?.some((evidence: any) => evidence.campo === "tipoPago"));
  assert.ok(result.asientos[0].evidencias?.some((evidence: any) => evidence.campo === "formaPago1"));
  assert.ok(result.asientos.some((asiento: any) => asiento.evidencias?.some((evidence: any) => evidence.campo === "formaCobro1")));
}

{
  const result = service().process(workbookBuffer({ COMPRAS: [compra({ 22: 63.96, 23: null, 25: null, 36: 63.96 })] }), "compra-0.xlsx");
  assert.equal(result.resumen.asientos, 1);
  assert.equal(result.asientos[0].totalDebe, 63.96);
  assertBalanced(result);
}

{
  const result = service().process(workbookBuffer({ COMPRAS: [compra({ 94: "20-OTROS CON UTILIZACION DEL SISTEMA FINANCIERO" })] }), "compra-pago-20.xlsx");
  assert.deepEqual(result.resumen.formasPagoCompras, { "20": 1 });
  assert.equal(result.asientos.some((asiento) => asiento.tipoEvento === "PAGO_PROVEEDOR"), false);
  assert.equal(result.asientos.some((asiento) => asiento.lineas.some((linea) => linea.codigo.includes("BANC"))), false);
  assert.ok(result.asientos[0].evidencias?.some((evidence: any) => evidence.valor === "20-OTROS CON UTILIZACION DEL SISTEMA FINANCIERO"));
}

{
  const result = service().process(workbookBuffer({ VENTAS: [venta({ 53: "20-OTROS CON UTILIZACION DEL SISTEMA FINANCIERO" })] }), "venta-cobro-20.xlsx");
  assert.deepEqual(result.resumen.formasCobroVentas, { "20": 1 });
  assert.equal(result.asientos.some((asiento) => asiento.tipoEvento === "COBRO_CLIENTE"), false);
  assert.equal(result.asientos.some((asiento) => asiento.lineas.some((linea) => linea.codigo.includes("BANC"))), false);
  assert.ok(result.asientos[0].evidencias?.some((evidence: any) => evidence.valor === "20-OTROS CON UTILIZACION DEL SISTEMA FINANCIERO"));
}

{
  const result = service().process(workbookBuffer({ COMPRAS: [compra({ 57: "332", 58: 100, 59: "1.75%", 60: 1.75 })] }), "ret-fuente.xlsx");
  assert.equal(result.resumen.asientos, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.asientos.some((asiento) => asiento.tipoEvento === "RETENCION_EMITIDA"), false);
  assert.ok(result.asientos[0].lineas.some((linea) => linea.codigo === accounts.retFuentePagar.codigo && linea.haber === 1.75));
}

{
  const result = service().process(workbookBuffer({ COMPRAS: [compra({ 82: 4.5 })] }), "ret-iva.xlsx");
  assert.equal(result.resumen.asientos, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.asientos.some((asiento) => asiento.tipoEvento === "RETENCION_EMITIDA"), false);
  assert.ok(result.asientos[0].lineas.some((linea) => linea.codigo === accounts.retIvaPagar.codigo && linea.haber === 4.5));
}

{
  const result = service().process(workbookBuffer({ COMPRAS: [compra({ 60: 1.75, 82: 4.5 })] }), "ret-ambas.xlsx");
  assert.equal(result.resumen.asientos, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.asientos.some((asiento) => asiento.tipoEvento === "RETENCION_EMITIDA"), false);
  assert.ok(result.asientos[0].lineas.some((linea) => linea.codigo === accounts.retFuentePagar.codigo && linea.haber === 1.75));
  assert.ok(result.asientos[0].lineas.some((linea) => linea.codigo === accounts.retIvaPagar.codigo && linea.haber === 4.5));
}

{
  const result = service().process(workbookBuffer({ COMPRAS: [compra({ 60: 200, 82: 50 })] }), "ret-exceso.xlsx");
  assert.equal(result.resumen.asientos, 0);
  assert.ok(result.errors.some((issue) => issue.codigo === "RETENCIONES_SUPERAN_TOTAL"));
}

{
  const result = service().process(workbookBuffer({ VENTAS: [venta({ 43: 5, 44: 10, 46: "001-001-9", 47: "17/04/2026" })] }), "venta-ret.xlsx");
  assert.equal(result.resumen.asientos, 1);
  assert.ok(result.errors.some((issue) => issue.codigo === "ROL_SIN_RESOLVER" && issue.campo === "RETENCION_FUENTE_POR_COBRAR"));
}

{
  const result = service().process(workbookBuffer({ COMPRAS: [compra({ 6: "04-Nota de credito", 23: -100, 25: -15, 36: -115 })] }), "nc-compra.xlsx");
  assert.equal(result.resumen.asientos, 1);
  assert.equal(result.asientos[0].tipoEvento, "NOTA_CREDITO_COMPRA");
  assert.ok(result.asientos[0].lineas.some((linea) => linea.codigo === accounts.cxp.codigo && linea.debe === 115));
}

{
  const result = service().process(workbookBuffer({ VENTAS: [venta({ 7: "04-Nota de credito", 15: -200, 17: -30, 27: -230 })] }), "nc-venta.xlsx");
  assert.equal(result.resumen.asientos, 1);
  assert.equal(result.asientos[0].tipoEvento, "NOTA_CREDITO_VENTA");
  assert.ok(result.asientos[0].lineas.some((linea) => linea.codigo === accounts.cxc.codigo && linea.haber === 230));
}

{
  const result = service().process(workbookBuffer({ COMPRAS: [compra({ 23: null, 25: null, 22: 42, 36: 42, 94: "01-SIN SISTEMA FINANCIERO" })] }), "ups-sin-iva.xlsx");
  assert.equal(result.resumen.asientos, 1);
  assert.equal(result.asientos[0].lineas.some((linea) => linea.codigo === accounts.ivaCompra.codigo), false);
  assert.equal(result.asientos[0].lineas.some((linea) => linea.codigo.includes("BANC")), false);
}

{
  const result = service().process(
    workbookBuffer({
      COMPRAS: [compra({ 0: "0921638813001", 2: "LITUMA RAMIREZ RUTH ELSA", 18: "", 43: "FERRETERIA" })],
    }),
    "lituma.xlsx"
  );
  assert.equal(result.resumen.asientos, 0);
  assert.ok(result.issues.some((issue) => issue.codigo === "PENDIENTE_CLASIFICACION"));
}

{
  const result = service(accounts.gastoAgrupadora).process(workbookBuffer({ COMPRAS: [compra()] }), "agrupadora.xlsx");
  assert.equal(result.resumen.asientos, 0);
  assert.ok(result.errors.some((issue) => issue.mensaje.includes("agrupadora")));
}

{
  const result = service().process(workbookBuffer({ PARAMETROS: [row({ 0: "x" })] }), "sin-ats.xlsx");
  assert.deepEqual(result.resumen.hojasLeidas, []);
  assert.equal(result.resumen.advertencias, 1);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.errors.length, 0);
}

{
  const result = service().process(workbookBuffer({ COMPRAS: [compra()], VENTAS: [venta(), venta({ 10: "000000002", 27: 115, 15: 100, 17: 15 })] }), "mixto.xlsx");
  assert.equal(result.resumen.documentosLeidos, 3);
  assert.equal(result.resumen.asientos, 3);
  assertBalanced(result);
}

{
  const result = service().process(workbookBuffer({ COMPRAS: [compra({ 18: "", 19: "", 43: "" })] }), "sin-clasificacion.xlsx");
  assert.equal(result.resumen.asientos, 0);
  assert.ok(result.issues.some((issue) => issue.codigo === "ROL_SIN_RESOLVER" || issue.codigo === "PENDIENTE_CLASIFICACION"));
}

{
  const result = service().process(workbookBuffer({ COMPRAS: [compra()] }), "solo-compras.xlsx");
  assert.equal(result.resumen.asientos, 1);
  assertBalanced(result);
}

{
  const realAts = path.join(process.cwd(), "tmp", "2026 PlantillaATS CHARLES ABRIL 2026 (1).xlsx");
  assert.equal(fs.existsSync(realAts), true);
  const result = service().process(fs.readFileSync(realAts), realAts);
  assert.ok(result.resumen.documentosLeidos > 0);
  assert.ok(result.resumen.asientos > 0);
  assert.equal(result.resumen.totalDebe, result.resumen.totalHaber);
  assert.equal(result.asientos.some((asiento) => asiento.lineas.some((linea) => linea.codigo === "5.02.02.29")), false);
  assert.equal(Array.isArray(result.issues), true);
  assert.equal(Array.isArray(result.warnings), true);
  assert.equal(Array.isArray(result.errors), true);
}

console.log("contabilidad-excel-response.test.ts OK");
