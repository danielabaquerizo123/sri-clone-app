import assert from "assert";
import XLSX from "xlsx";
import { exportLoteId, isAtsLoteExportable, validateExportReportContext } from "../src/controllers/contabilidad.controller";
import { requireAuth } from "../src/middlewares/auth.middleware";
import { AccountingExcelExporter } from "../src/services/contabilidad/06-reportes/excel-exportador";

const lote = { id: "lote-ats-1", rucInformante: "0917809451001", razonSocial: "GARCIA RODRIGUEZ CHARLES MILTON", anio: 2026, mes: "04" };
const empresa = { id: "ats-company", ruc: lote.rucInformante, razonSocial: lote.razonSocial };
const periodo = { id: "periodo-ats-1", anio: lote.anio, mes: lote.mes, estado: "ABIERTO" };
const preview = { resumen: { loteId: lote.id, ruc: lote.rucInformante, razonSocial: lote.razonSocial }, periodo, asientos: [] };
const libroMayor = { empresa, periodo, folios: [], resumenGlobal: {} };
const balance = { empresa, periodo, moneda: "Dólares (USD)", filas: [], resumen: {} };
const estadoResultados = { empresa, periodo, moneda: "Dólares (USD)", lineas: [], totales: {}, resultadoFinal: { etiqueta: "RESULTADO DEL EJERCICIO", valor: "0.00" }, advertencias: [] };

void (async () => {
  // A different authenticated RUC is intentionally absent from accounting context.
  assert.doesNotThrow(() => validateExportReportContext({ lote, preview, libroMayor, balance, estadoResultados }));
  assert.throws(() => validateExportReportContext({ lote, preview: { ...preview, resumen: { ...preview.resumen, loteId: "otro-lote" } }, libroMayor, balance, estadoResultados }), /mismo lote ATS/);
  assert.throws(() => validateExportReportContext({ lote, preview, libroMayor: { ...libroMayor, empresa: { ...empresa, ruc: "0999999999001" } }, balance, estadoResultados }), /mismo lote ATS/);
  assert.throws(() => validateExportReportContext({ lote, preview, libroMayor, balance: { ...balance, periodo: { ...periodo, mes: "05" } }, estadoResultados }), /mismo lote ATS/);
  assert.equal(exportLoteId({ body: {} } as any), null);
  assert.equal(exportLoteId({ body: { loteId: lote.id } } as any), lote.id);
  assert.equal(isAtsLoteExportable({ estado: "PROCESADO_VALIDO" }), true);
  assert.equal(isAtsLoteExportable({ estado: "XML_GENERADO" }), true);
  assert.equal(isAtsLoteExportable({ estado: "PROCESANDO" }), false);
  assert.equal(isAtsLoteExportable({ estado: "PROCESADO_CON_ERRORES" }), false);

  const workbook = XLSX.read(new AccountingExcelExporter().exportProcesosContables({
    ruc: lote.rucInformante,
    razonSocial: lote.razonSocial,
    periodo: "04/2026",
    asientos: [],
    libroMayor: { ...libroMayor, origen: "PREVIEW", estadoReporte: "NO_CONTABILIZADO", mensaje: "", fechaDesde: null, fechaHasta: null, page: 1, limit: 1 } as any,
    balanceComprobacion: { ...balance, origen: "PREVIEW", estadoReporte: "NO_CONTABILIZADO", mensaje: "", fechaDesde: null, fechaHasta: null } as any,
    estadoResultados: { ...estadoResultados, origen: "PREVIEW", estadoReporte: "NO_CONTABILIZADO", fechaDesde: null, fechaHasta: null, completo: true, cuentasPendientes: [] } as any,
  }), { type: "buffer" });
  const diario = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets["Libro Diario"], { header: 1 });
  const diarioText = JSON.stringify(diario);
  assert.ok(diarioText.includes(lote.rucInformante));
  assert.ok(diarioText.includes(lote.razonSocial));

  let status = 0;
  let nextCalled = false;
  await requireAuth({ header: () => undefined } as any, { status: (code: number) => { status = code; return { json: () => undefined }; } } as any, () => { nextCalled = true; });
  assert.equal(status, 401);
  assert.equal(nextCalled, false);
  console.log("procesos-contables-export.context.test.ts OK");
})();
