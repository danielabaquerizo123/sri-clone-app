import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AccountingEngine } from "../src/services/contabilidad/motor-contable";
import { ExcelLibroDiarioService } from "../src/services/contabilidad/motor-contable";
import { adaptCompra } from "../src/services/contabilidad/01-lectura/compra.adapter";
import {
  classifyAccountingDocument,
} from "../src/services/contabilidad/02-clasificacion/clasificador.service";
import { AccountingJournalValidatorService } from "../src/services/contabilidad/04-asientos/validador-cuadre.service";
import { AccountingRoleResolver } from "../src/services/contabilidad/03-cuentas/resolver-cuentas.service";
import type { JournalEntry } from "../src/services/contabilidad/contratos";

const root = join(__dirname, "..", "src", "services", "contabilidad");

function read(relative: string) {
  return readFileSync(join(root, relative), "utf8");
}

{
  const facade = read("04-asientos/preview-asientos.service.ts");
  assert.equal(facade.includes("../accounting-rule-map"), false);
  assert.equal(facade.includes("../accounting-rules"), false);
  assert.equal(facade.includes("../accounting-rule-resolver"), false);
  assert.equal(facade.includes("../account-mapper"), false);
  assert.equal(facade.includes("accounting-known-providers"), false);
}

{
  const applicationClassification = read("02-clasificacion/clasificador.service.ts");
  assert.equal(applicationClassification.includes("accounting-known-providers"), false);
  assert.equal(applicationClassification.includes("0921638813001"), false);
  assert.equal(applicationClassification.includes("1790012345001"), false);
  assert.equal(existsSync(join(root, "accounting-known-providers.json")), false);
}

{
  const first = classifyAccountingDocument({
    hojaOrigen: "COMPRAS",
    rucTercero: "0101010101001",
    tipoComprobante: "01",
    concepto: "Servicio profesional de asesoria",
  });
  const second = classifyAccountingDocument({
    hojaOrigen: "COMPRAS",
    rucTercero: "0202020202001",
    tipoComprobante: "01",
    concepto: "Servicio profesional de asesoria",
  });
  assert.equal(first.categoria, second.categoria);
  assert.equal(first.origen, second.origen);
  assert.equal(first.requiereRevision, second.requiereRevision);
}

{
  const event = {
    tipo: "DEVENGO_COMPRA" as const,
    rolesRequeridos: ["GASTO_COSTO_ACTIVO" as const],
    clasificacion: { categoria: "MANTENIMIENTO_REPARACIONES" },
  };
  const cuenta = { id: "cuenta-1", codigo: "5020208", nombre: "Cuenta inyectada", activa: true, movimiento: true };
  const resolution = new AccountingRoleResolver({
    configuraciones: [{ clave: "CATEGORIA:MANTENIMIENTO_REPARACIONES", activa: true, cuenta }],
  }).resolve({
    event: event as any,
    role: "GASTO_COSTO_ACTIVO",
    reglaContable: {
      codigo: "TEST",
      descripcion: "Regla inyectada",
      cuentaBase: cuenta,
    },
  });
  assert.equal(resolution.resolved, true);
  assert.equal(resolution.cuenta?.codigo, "5020208");
}

{
  const compra = adaptCompra({
    filaExcel: 9,
    establecimiento: "001",
    puntoEmision: "002",
    numeroSecuencial: "000000003",
    fechaEmision: "2026-04-01",
    noIdentificacion: "0999999999001",
    razonSocialProveedor: "Proveedor",
    comprobante: "04",
    valorRetenidoIva10: 1.25,
    valorRetenidoIva20: 2.5,
    codigoRetencionFuente1: "332",
    baseImponibleRetencionFuente1: 100,
    porcentajeRetencionFuente1: 1,
    valorRetenidoFuente1: 1,
    establecimientoModificado: "001",
    puntoEmisionModificado: "002",
    numeroSecuencialModificado: "000000001",
  });
  assert.equal(compra.tipoComprobante, "04");
  assert.equal(compra.datosRetencion?.totalRetenidoIva, 3.75);
  assert.equal(compra.datosRetencion?.totalRetenidoFuente, 1);
  assert.equal(compra.documentoModificado, "001-002-000000001");
}

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    numero: 1,
    fecha: "2026-04-01",
    glosa: "Prueba",
    descripcion: "Prueba",
    documentoOrigen: "001-001-000000001",
    hojaOrigen: "COMPRAS",
    filaOrigen: 1,
    lineas: [
      { cuentaId: "cuenta-gasto", codigo: "5020208", cuenta: "Gasto", descripcion: "Debe", debe: 100, haber: 0, orden: 1 },
      { cuentaId: "cuenta-cxp", codigo: "2010102", cuenta: "Cxp", descripcion: "Haber", debe: 0, haber: 100, orden: 2 },
    ],
    totalDebe: 100,
    totalHaber: 100,
    valido: true,
    errores: [],
    ...overrides,
  };
}

{
  const validator = new AccountingJournalValidatorService();
  const issues = validator.validate(entry({ totalDebe: 100, totalHaber: 99.98 }));
  assert.ok(issues.some((issue) => issue.codigo === "ASIENTO_DESCUADRADO"));
}

{
  const validator = new AccountingJournalValidatorService({
    accounts: [
      { id: "cuenta-gasto", codigo: "5020208", activa: true, movimiento: false },
      { id: "cuenta-cxp", codigo: "2010102", activa: true, movimiento: true },
    ],
  });
  const issues = validator.validate(entry());
  assert.ok(issues.some((issue) => issue.codigo === "CUENTA_AGRUPADORA"));
}

{
  assert.equal(typeof new AccountingEngine().process, "function");
  assert.equal(typeof new ExcelLibroDiarioService().process, "function");
}

console.log("accounting-legacy-cleanup.test.ts OK");
