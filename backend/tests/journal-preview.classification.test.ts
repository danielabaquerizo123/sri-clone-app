import assert from "node:assert/strict";
import {
  shouldHoldForClassification,
  validatePreviewEntryForTest,
  validateResolvedRuleAccounts,
  type PreviewEntry,
} from "../src/services/contabilidad/journal-preview.service";

function validEntry(overrides: Partial<PreviewEntry> = {}): PreviewEntry {
  return {
    numero: 1,
    fecha: "2026-04-01",
    fechaDate: new Date("2026-04-01T00:00:00.000Z"),
    glosa: "Asiento de prueba",
    descripcion: "Asiento de prueba",
    documentoOrigen: "001-001-000000001",
    hojaOrigen: "COMPRAS",
    filaOrigen: 10,
    reglaCodigo: "REG_TEST",
    lineas: [
      {
        cuentaId: "cuenta-base",
        codigo: "5.02.02.08",
        cuenta: "Mantenimiento",
        descripcion: "Base",
        debe: 100,
        haber: 0,
        orden: 1,
      },
      {
        cuentaId: "cuenta-contrapartida",
        codigo: "2.01.01.01",
        cuenta: "Proveedores",
        descripcion: "Contrapartida",
        debe: 0,
        haber: 100,
        orden: 2,
      },
    ],
    totalDebe: 100,
    totalHaber: 100,
    valido: true,
    errores: [],
    advertencias: [],
    ...overrides,
  };
}

{
  const classification = {
    categoria: "SERVICIOS_PROFESIONALES",
    confianza: "ALTA" as const,
    origen: "REGLA_CONCEPTO" as const,
    requiereRevision: false,
    motivos: [],
    evidencias: [],
  };

  assert.equal(classification.categoria, "SERVICIOS_PROFESIONALES");
  assert.equal(shouldHoldForClassification(classification), false);
}

{
  const classification = {
    categoria: "VENTA_BIENES",
    confianza: "ALTA" as const,
    origen: "REGLA_GENERAL" as const,
    requiereRevision: false,
    motivos: [],
    evidencias: [],
  };

  assert.equal(classification.categoria, "VENTA_BIENES");
  assert.equal(shouldHoldForClassification(classification), false);
}

{
  const classification = {
    categoria: "SIN_CLASIFICACION",
    confianza: "BAJA" as const,
    origen: "SIN_CLASIFICACION" as const,
    requiereRevision: true,
    motivos: [],
    evidencias: [],
  };

  assert.equal(classification.origen, "SIN_CLASIFICACION");
  assert.equal(shouldHoldForClassification(classification), true);
}

{
  const classification = {
    categoria: "PRESTACION_SERVICIOS_RECIBIDOS",
    confianza: "MEDIA" as const,
    origen: "REGLA_SUSTENTO" as const,
    requiereRevision: false,
    motivos: [],
    evidencias: [],
  };

  assert.equal(classification.categoria, "PRESTACION_SERVICIOS_RECIBIDOS");
  assert.equal(shouldHoldForClassification(classification), false);
}

{
  const errors = validateResolvedRuleAccounts({
    codigo: "REG_AGRUPADORA",
    cuentaBase: { codigo: "5", activa: true, movimiento: false },
    cuentaContrapartida: { codigo: "2.01.01.01", activa: true, movimiento: true },
  });

  assert.ok(errors.some((message) => message.includes("agrupadora")));
}

{
  const errors = validateResolvedRuleAccounts({
    codigo: "REG_INACTIVA",
    cuentaBase: { codigo: "5.02.02.08", activa: false, movimiento: true },
    cuentaContrapartida: { codigo: "2.01.01.01", activa: true, movimiento: true },
  });

  assert.ok(errors.some((message) => message.includes("inactiva")));
}

{
  const errors = validateResolvedRuleAccounts({
    codigo: "REG_SIN_CUENTA",
    cuentaBase: null,
    cuentaContrapartida: { codigo: "2.01.01.01", activa: true, movimiento: true },
  });

  assert.ok(errors.some((message) => message.includes("no existe")));
}

{
  const errors = validatePreviewEntryForTest(
    validEntry({
      lineas: [
        {
          cuentaId: "cuenta-base",
          codigo: "5.02.02.08",
          cuenta: "Mantenimiento",
          descripcion: "Base",
          debe: 100,
          haber: 0,
          orden: 1,
        },
        {
          cuentaId: "cuenta-contrapartida",
          codigo: "2.01.01.01",
          cuenta: "Proveedores",
          descripcion: "Contrapartida",
          debe: 0,
          haber: 90,
          orden: 2,
        },
      ],
      totalDebe: 100,
      totalHaber: 90,
    })
  );

  assert.ok(errors.includes("Debe y Haber no son iguales."));
}

{
  const lituma = {
    categoria: "SIN_CLASIFICACION",
    confianza: "BAJA" as const,
    origen: "SIN_CLASIFICACION" as const,
    requiereRevision: true,
    motivos: [],
    evidencias: [],
  };

  assert.equal(lituma.categoria, "SIN_CLASIFICACION");
  assert.equal(shouldHoldForClassification(lituma), true);
}

{
  const lituma = {
    categoria: "MANTENIMIENTO_REPARACIONES",
    confianza: "ALTA" as const,
    origen: "REGLA_CONCEPTO" as const,
    requiereRevision: false,
    motivos: [],
    evidencias: ["REGLA_ACTIVIDAD: FERRETERIA", "REGLA_CONCEPTO: MANTENIMIENTO"],
  };

  assert.equal(lituma.categoria, "MANTENIMIENTO_REPARACIONES");
  assert.ok(lituma.evidencias.some((item) => item.includes("FERRETERIA")));
  assert.ok(lituma.evidencias.some((item) => item.includes("MANTENIMIENTO")));
  assert.equal(shouldHoldForClassification(lituma), false);
}

console.log("journal-preview classification tests passed");
