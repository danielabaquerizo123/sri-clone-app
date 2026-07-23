import assert from "assert";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { LibroMayorAgrupadorService } from "../src/services/contabilidad/06-reportes/libro-mayor/libro-mayor-agrupador.service";
import { LibroMayorSaldosService, money } from "../src/services/contabilidad/06-reportes/libro-mayor/libro-mayor-saldos.service";
import { LibroMayorValidacionService } from "../src/services/contabilidad/06-reportes/libro-mayor/libro-mayor-validacion.service";
import { AccountingExcelExporter } from "../src/services/contabilidad/06-reportes/excel-exportador";
import type { LibroMayorRawMovement, LibroMayorResponse } from "../src/services/contabilidad/06-reportes/libro-mayor/libro-mayor.types";

const date = (day: number) => new Date(Date.UTC(2030, 4, day, 12));
const created = (index: number) => new Date(Date.UTC(2030, 4, 1, 12, 0, index));

function line(overrides: Partial<LibroMayorRawMovement>): LibroMayorRawMovement {
  return {
    lineaId: overrides.lineaId || `line-${Math.random()}`,
    asientoId: overrides.asientoId || "entry",
    cuentaId: overrides.cuentaId || "account",
    codigoCuenta: overrides.codigoCuenta || "9.9.9",
    nombreCuenta: overrides.nombreCuenta || "Cuenta ficticia",
    tipoCuenta: overrides.tipoCuenta || "ACTIVO",
    naturalezaCuenta: overrides.naturalezaCuenta || "DEUDORA",
    fecha: overrides.fecha || date(1),
    numeroAsiento: overrides.numeroAsiento || 1,
    descripcion: overrides.descripcion || "Movimiento ficticio",
    orden: overrides.orden || 1,
    debe: overrides.debe ?? new Prisma.Decimal(0),
    haber: overrides.haber ?? new Prisma.Decimal(0),
    estadoAsiento: overrides.estadoAsiento || "APROBADO",
    periodoId: overrides.periodoId || "period",
    periodoAnio: overrides.periodoAnio || 2030,
    periodoMes: overrides.periodoMes || "05",
    empresaId: overrides.empresaId || "company",
    asientoCreatedAt: overrides.asientoCreatedAt || created(1),
  };
}

{
  const result = new LibroMayorSaldosService().calculateMovements(
    [
      line({ lineaId: "a", debe: new Prisma.Decimal("31.25"), haber: new Prisma.Decimal(0) }),
      line({ lineaId: "b", debe: new Prisma.Decimal("8.75"), haber: new Prisma.Decimal(0), orden: 2 }),
    ],
    new Prisma.Decimal(0)
  );
  assert.equal(result.totalDebe.toFixed(2), "40.00");
  assert.equal(result.totalHaber.toFixed(2), "0.00");
  assert.equal(result.movimientos.at(-1)?.saldoDeudor, "40.00");
}

{
  const result = new LibroMayorSaldosService().calculateMovements(
    [
      line({ lineaId: "a", debe: new Prisma.Decimal(0), haber: new Prisma.Decimal("13.10") }),
      line({ lineaId: "b", debe: new Prisma.Decimal(0), haber: new Prisma.Decimal("6.90"), orden: 2 }),
    ],
    new Prisma.Decimal(0)
  );
  assert.equal(result.saldoFinalAcreedor, "20.00");
  assert.equal(result.saldoFinalDeudor, "0.00");
}

{
  const result = new LibroMayorSaldosService().calculateMovements(
    [
      line({ lineaId: "a", debe: new Prisma.Decimal("15.00"), haber: new Prisma.Decimal(0) }),
      line({ lineaId: "b", debe: new Prisma.Decimal(0), haber: new Prisma.Decimal("35.50"), orden: 2 }),
      line({ lineaId: "c", debe: new Prisma.Decimal("25.50"), haber: new Prisma.Decimal(0), orden: 3 }),
    ],
    new Prisma.Decimal(0)
  );
  assert.equal(result.movimientos[1].saldoAcreedor, "20.50");
  assert.equal(result.saldoFinalDeudor, "5.00");
  assert.deepEqual(result.movimientos.map((movement) => [movement.saldoDeudor, movement.saldoAcreedor]), [
    ["15.00", "0.00"],
    ["0.00", "20.50"],
    ["5.00", "0.00"],
  ]);
}

{
  const result = new LibroMayorSaldosService().calculateMovements(
    [
      line({ lineaId: "a", debe: new Prisma.Decimal("7.77"), haber: new Prisma.Decimal(0) }),
      line({ lineaId: "b", debe: new Prisma.Decimal(0), haber: new Prisma.Decimal("7.77"), orden: 2 }),
    ],
    new Prisma.Decimal(0)
  );
  assert.equal(result.saldoFinalDeudor, "0.00");
  assert.equal(result.saldoFinalAcreedor, "0.00");
  assert.equal(money(result.saldoFinal), "0.00");
}

{
  const grouped = new LibroMayorAgrupadorService().group([
    line({ lineaId: "late", codigoCuenta: "1.10.2", fecha: date(2), numeroAsiento: 8, orden: 2, asientoCreatedAt: created(2), debe: new Prisma.Decimal(1) }),
    line({ lineaId: "early", cuentaId: "account-two", codigoCuenta: "1.2.10", fecha: date(1), numeroAsiento: 9, orden: 1, asientoCreatedAt: created(1), debe: new Prisma.Decimal(1) }),
    line({ lineaId: "middle", codigoCuenta: "1.10.2", fecha: date(2), numeroAsiento: 7, orden: 1, asientoCreatedAt: created(1), debe: new Prisma.Decimal(1) }),
  ]);
  assert.deepEqual(grouped.map((group) => group.codigoCuenta), ["1.10.2", "1.2.10"]);
  assert.deepEqual(grouped[0].movimientos.map((item) => item.lineaId), ["middle", "late"]);
}

{
  const lines = [
    line({ lineaId: "a", cuentaId: "one", debe: new Prisma.Decimal("11.11"), haber: new Prisma.Decimal(0) }),
    line({ lineaId: "b", cuentaId: "one", debe: new Prisma.Decimal(0), haber: new Prisma.Decimal("3.33"), orden: 2 }),
  ];
  const result = new LibroMayorSaldosService().calculateMovements(lines, new Prisma.Decimal("5.00"));
  const validation = new LibroMayorValidacionService().validateAgainstJournal(lines, [
    {
      folio: 1,
      cuentaId: "one",
      codigoCuenta: "9.9.9",
      nombreCuenta: "Cuenta ficticia",
      tipoCuenta: "ACTIVO",
      naturalezaCuenta: "DEUDORA",
      saldoAnterior: "5.00",
      saldoAnteriorDeudor: "5.00",
      saldoAnteriorAcreedor: "0.00",
      movimientos: result.movimientos,
      totalDebe: money(result.totalDebe),
      totalHaber: money(result.totalHaber),
      saldoFinal: money(result.saldoFinal),
      saldoFinalDeudor: result.saldoFinalDeudor,
      saldoFinalAcreedor: result.saldoFinalAcreedor,
    },
  ]);
  assert.equal(validation.valido, true);
  assert.equal(validation.resumenGlobal.diferenciaDebe, "0.00");
  assert.equal(validation.resumenGlobal.diferenciaHaber, "0.00");
}

{
  const lines = [
    line({ lineaId: "debit", cuentaId: "one", codigoCuenta: "1010101", debe: new Prisma.Decimal("100.00"), haber: new Prisma.Decimal(0) }),
    line({ lineaId: "credit", cuentaId: "one", codigoCuenta: "1010101", debe: new Prisma.Decimal(0), haber: new Prisma.Decimal("40.00"), orden: 2 }),
    line({ lineaId: "income", cuentaId: "two", codigoCuenta: "40101", debe: new Prisma.Decimal("40.00"), haber: new Prisma.Decimal("100.00"), orden: 3 }),
  ];
  const groups = new LibroMayorAgrupadorService().group(lines);
  const folios = groups.map((group, index) => {
    const result = new LibroMayorSaldosService().calculateMovements(group.movimientos, new Prisma.Decimal(0));
    return {
      folio: index + 1,
      cuentaId: group.cuentaId,
      codigoCuenta: group.codigoCuenta,
      nombreCuenta: group.nombreCuenta,
      tipoCuenta: group.tipoCuenta,
      naturalezaCuenta: group.naturalezaCuenta,
      saldoAnterior: "0.00",
      saldoAnteriorDeudor: "0.00",
      saldoAnteriorAcreedor: "0.00",
      movimientos: result.movimientos,
      totalDebe: money(result.totalDebe),
      totalHaber: money(result.totalHaber),
      saldoFinal: money(result.saldoFinal),
      saldoFinalDeudor: result.saldoFinalDeudor,
      saldoFinalAcreedor: result.saldoFinalAcreedor,
    };
  });
  const validation = new LibroMayorValidacionService().validateAgainstJournal(lines, folios);
  assert.deepEqual(folios.map((folio) => folio.codigoCuenta), ["1010101", "40101"]);
  assert.equal(folios[0].movimientos.length, 2);
  assert.equal(folios[1].movimientos.length, 1);
  assert.equal(folios[0].saldoFinalDeudor, "60.00");
  assert.equal(folios[0].saldoFinalAcreedor, "0.00");
  assert.equal(folios[1].saldoFinalDeudor, "0.00");
  assert.equal(folios[1].saldoFinalAcreedor, "60.00");
  assert.equal(validation.resumenGlobal.totalDebeDiario, "140.00");
  assert.equal(validation.resumenGlobal.totalDebeMayor, "140.00");
  assert.equal(validation.resumenGlobal.totalHaberDiario, "140.00");
  assert.equal(validation.resumenGlobal.totalHaberMayor, "140.00");
}

{
  const mayor: LibroMayorResponse = {
    origen: "PREVIEW",
    estadoReporte: "NO_CONTABILIZADO",
    mensaje: "Fixture",
    empresa: { id: "preview", ruc: "1250531561", razonSocial: "Daniela Nicolle Baquerizo Mora" },
    periodo: { id: null, anio: 2026, mes: "04", estado: "NO_CONTABILIZADO" },
    fechaDesde: null,
    fechaHasta: null,
    incluirSaldoAnterior: false,
    totalCuentas: 1,
    totalFolios: 1,
    page: 1,
    limit: Number.MAX_SAFE_INTEGER,
    resumenGlobal: {
      totalDebeDiario: "100.00",
      totalHaberDiario: "100.00",
      totalDebeMayor: "100.00",
      totalHaberMayor: "100.00",
      diferenciaDebe: "0.00",
      diferenciaHaber: "0.00",
      totalMovimientos: 2,
    },
    folios: [
      {
        folio: 1,
        cuentaId: "cash",
        codigoCuenta: "1010101",
        nombreCuenta: "CAJA",
        tipoCuenta: "ACTIVO",
        naturalezaCuenta: "DEUDORA",
        saldoAnterior: "0.00",
        saldoAnteriorDeudor: "0.00",
        saldoAnteriorAcreedor: "0.00",
        movimientos: [
          { lineaId: "l1", asientoId: "a1", fecha: "2026-04-01", numeroAsiento: "1", descripcion: "Movimiento", debe: "100.00", haber: "0.00", saldoAcumulado: "100.00", saldoDeudor: "100.00", saldoAcreedor: "0.00" },
          { lineaId: "l2", asientoId: "a2", fecha: "2026-04-02", numeroAsiento: "2", descripcion: "Movimiento", debe: "0.00", haber: "100.00", saldoAcumulado: "0.00", saldoDeudor: "0.00", saldoAcreedor: "0.00" },
        ],
        totalDebe: "100.00",
        totalHaber: "100.00",
        saldoFinal: "0.00",
        saldoFinalDeudor: "0.00",
        saldoFinalAcreedor: "0.00",
      },
    ],
  };
  const buffer = new AccountingExcelExporter().exportReporteContable({
    ruc: "1250531561",
    razonSocial: "Daniela Nicolle Baquerizo Mora",
    periodo: "04/2026",
    libroMayor: mayor,
    asientos: [
      {
        numero: 1,
        fecha: "2026-04-01",
        glosa: "Movimiento",
        descripcion: "Movimiento",
        documentoOrigen: "001",
        hojaOrigen: "COMPRAS",
        filaOrigen: 1,
        lineas: [{ codigo: "1010101", cuenta: "CAJA", debe: 100, haber: 0, orden: 1 }],
        totalDebe: 100,
        totalHaber: 100,
        valido: true,
        errores: [],
      },
    ],
  });
  const workbook = XLSX.read(buffer, { type: "buffer" });
  assert.deepEqual(workbook.SheetNames, ["Resumen", "Libro Diario", "Libro Mayor"]);
  const mayorRows = XLSX.utils.sheet_to_json(workbook.Sheets["Libro Mayor"], { header: 1, raw: false }) as unknown[][];
  assert.equal(mayorRows.some((row) => row.includes("CÓDIGO Y DENOMINACIÓN DE LA CUENTA CONTABLE: 1010101 — CAJA")), true);
  assert.equal(mayorRows.some((row) => row.includes("TOTALES")), true);
  assert.equal(mayorRows.some((row) => String(row[0] || "").startsWith("PERIODO:")), false);
  assert.equal(workbook.SheetNames.filter((name) => name.includes("1010101")).length, 0);
}

console.log("libro-mayor.service.test.ts OK");
