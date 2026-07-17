import assert from "node:assert/strict";
import {
  AccountingClassificationService,
  type AccountingClassificationDocument,
} from "../src/services/contabilidad/application/accounting-classification.service";

function compra(overrides: Partial<AccountingClassificationDocument> = {}): AccountingClassificationDocument {
  return {
    hojaOrigen: "COMPRAS",
    rucTercero: "0999999999001",
    razonSocial: "Proveedor de prueba",
    tipoComprobante: "01",
    codigoSustento: "",
    tarifaIva: 15,
    concepto: "",
    ...overrides,
  };
}

function venta(overrides: Partial<AccountingClassificationDocument> = {}): AccountingClassificationDocument {
  return {
    hojaOrigen: "VENTAS",
    rucTercero: "9999999999999",
    razonSocial: "Consumidor final",
    tipoComprobante: "18",
    tarifaIva: 15,
    concepto: "",
    ...overrides,
  };
}

const testService = new AccountingClassificationService({
  reglasConcepto: [
    {
      id: "TEST_SERVICIOS_PROFESIONALES",
      categoria: "SERVICIOS_PROFESIONALES",
      confianza: "ALTA",
      origen: "REGLA_CONCEPTO",
      requiereRevision: false,
      match: (context: any) => context.conceptoNormalizado.includes("SERVICIO PROFESIONAL"),
    },
    {
      id: "TEST_TELECOMUNICACIONES",
      categoria: "TELECOMUNICACIONES",
      confianza: "ALTA",
      origen: "REGLA_CONCEPTO",
      requiereRevision: false,
      match: (context: any) => context.conceptoNormalizado.includes("INTERNET"),
    },
    {
      id: "TEST_MANTENIMIENTO",
      categoria: "MANTENIMIENTO_REPARACIONES",
      confianza: "ALTA",
      origen: "REGLA_CONCEPTO",
      requiereRevision: false,
      match: (context: any) => context.conceptoNormalizado.includes("MANTENIMIENTO"),
    },
  ],
  reglasActividad: [
    {
      id: "TEST_TRANSPORTE",
      categoria: "TRANSPORTE_MOVILIZACION",
      confianza: "MEDIA",
      origen: "REGLA_ACTIVIDAD",
      requiereRevision: true,
      match: (context: any) => context.actividad.includes("TRANSPORTE"),
    },
    {
      id: "ACTIVIDAD_FERRETERIA_REVISION",
      categoria: "FERRETERIA_PENDIENTE_REVISION",
      confianza: "BAJA",
      origen: "REGLA_ACTIVIDAD",
      requiereRevision: true,
      motivos: [
        "No se clasifica como honorarios ni como gasto administrativo genérico.",
      ],
      match: (context: any) => context.actividad.includes("FERRETERIA"),
    },
  ],
  reglasSustento: [
    {
      id: "TEST_SUSTENTO_06",
      categoria: "PRESTACION_SERVICIOS_RECIBIDOS",
      confianza: "MEDIA",
      origen: "REGLA_SUSTENTO",
      requiereRevision: true,
      match: (context: any) => context.codigoSustentoNormalizado === "06",
    },
  ],
  reglasGenerales: [
    {
      id: "TEST_VENTA_BIENES",
      categoria: "VENTA_BIENES",
      confianza: "ALTA",
      origen: "REGLA_GENERAL",
      requiereRevision: false,
      match: (context: any) => context.hoja === "VENTAS" && context.conceptoNormalizado.includes("PRODUCTO"),
    },
    {
      id: "TEST_VENTA_SERVICIOS",
      categoria: "VENTA_SERVICIOS",
      confianza: "ALTA",
      origen: "REGLA_GENERAL",
      requiereRevision: false,
      match: (context: any) => context.hoja === "VENTAS" && context.conceptoNormalizado.includes("SERVICIO"),
    },
    {
      id: "TEST_NOTA_CREDITO",
      categoria: "NOTA_CREDITO",
      confianza: "MEDIA",
      origen: "REGLA_GENERAL",
      requiereRevision: true,
      match: (context: any) => context.tipoComprobanteNormalizado === "04",
    },
  ],
});

function classify(document: AccountingClassificationDocument) {
  return testService.classify(document);
}

{
  const result = classify(
    compra({
      rucTercero: "1790012345001",
      razonSocial: "Proveedor Profesional Demo",
      concepto: "Servicio profesional de asesoria",
    })
  );

  assert.equal(result.categoria, "SERVICIOS_PROFESIONALES");
  assert.equal(result.origen, "REGLA_CONCEPTO");
  assert.equal(result.confianza, "ALTA");
  assert.equal(result.requiereRevision, false);
}

{
  const result = classify(
    compra({
      actividadEconomica: "Transporte de carga pesada por carretera",
    })
  );

  assert.equal(result.categoria, "TRANSPORTE_MOVILIZACION");
  assert.equal(result.origen, "REGLA_ACTIVIDAD");
  assert.equal(result.confianza, "MEDIA");
}

{
  const result = classify(
    compra({
      concepto: "Servicio mensual de internet corporativo",
    })
  );

  assert.equal(result.categoria, "TELECOMUNICACIONES");
  assert.equal(result.origen, "REGLA_CONCEPTO");
  assert.equal(result.confianza, "ALTA");
}

{
  const result = classify(
    compra({
      codigoSustento: "06",
    })
  );

  assert.equal(result.categoria, "PRESTACION_SERVICIOS_RECIBIDOS");
  assert.equal(result.origen, "REGLA_SUSTENTO");
  assert.equal(result.requiereRevision, true);
}

{
  const result = classify(
    venta({
      concepto: "Venta de producto terminado",
    })
  );

  assert.equal(result.categoria, "VENTA_BIENES");
  assert.equal(result.origen, "REGLA_GENERAL");
}

{
  const result = classify(
    venta({
      concepto: "Servicio de asesoria tributaria",
    })
  );

  assert.equal(result.categoria, "VENTA_SERVICIOS");
  assert.equal(result.origen, "REGLA_GENERAL");
}

{
  const result = classify(
    compra({
      tipoComprobante: "04",
      concepto: "Nota de credito proveedor",
    })
  );

  assert.equal(result.categoria, "NOTA_CREDITO");
  assert.equal(result.origen, "REGLA_GENERAL");
  assert.equal(result.requiereRevision, true);
}

{
  const result = classify(
    compra({
      concepto: "",
      codigoSustento: "",
      rucTercero: "",
      razonSocial: "",
    })
  );

  assert.equal(result.categoria, "SIN_CLASIFICACION");
  assert.equal(result.origen, "SIN_CLASIFICACION");
  assert.equal(result.confianza, "BAJA");
  assert.equal(result.requiereRevision, true);
  assert.ok(result.motivos.length >= 2);
}

{
  const result = classify(
    compra({
      rucTercero: "0921638813001",
      razonSocial: "LITUMA RAMIREZ RUTH ELSA",
      actividadEconomica: "Venta al por menor de articulos de ferreteria",
      concepto: "",
    })
  );

  assert.equal(result.categoria, "FERRETERIA_PENDIENTE_REVISION");
  assert.equal(result.origen, "REGLA_ACTIVIDAD");
  assert.equal(result.confianza, "BAJA");
  assert.equal(result.requiereRevision, true);
  assert.ok(!result.categoria.includes("HONORARIO"));
  assert.ok(!result.categoria.includes("ADMINISTRATIVO"));
}

{
  const result = classify(
    compra({
      rucTercero: "0921638813001",
      razonSocial: "LITUMA RAMIREZ RUTH ELSA",
      actividadEconomica: "Venta al por menor de articulos de ferreteria",
      concepto: "Compra de materiales y herramientas para mantenimiento",
    })
  );

  assert.equal(result.categoria, "MANTENIMIENTO_REPARACIONES");
  assert.equal(result.origen, "REGLA_CONCEPTO");
  assert.notEqual(result.categoria, "SERVICIOS_PROFESIONALES");
}

{
  const service = new AccountingClassificationService({
    reglasContablesExistentes: [
      {
        codigo: "REG_COMPRA_SUSTENTO_99",
        descripcion: "Compra con sustento especial",
        tipoOperacion: "COMPRA",
        tipoComprobante: "01",
        codigoSustento: "99",
        activa: true,
        prioridad: 1,
      },
    ],
    reglasProveedor: [],
    reglasActividad: [],
    reglasConcepto: [],
    reglasSustento: [],
    reglasGenerales: [],
  });

  const result = service.classify(compra({ codigoSustento: "99", tipoComprobante: "01" }));

  assert.equal(result.reglaSugeridaId, "REG_COMPRA_SUSTENTO_99");
  assert.equal(result.origen, "REGLA_SUSTENTO");
  assert.equal(result.requiereRevision, false);
}

console.log("accounting-classification.service tests passed");
