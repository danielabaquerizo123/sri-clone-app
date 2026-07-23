import assert from "node:assert/strict";
import {
  JournalPersistenceService,
  JournalPersistenceValidationError,
  validatePreviewEntries,
  validatePreviewIsPersistible,
} from "../src/services/contabilidad/motor-contable";
import type { JournalPreviewResult, PreviewEntry } from "../src/services/contabilidad/motor-contable";

function entry(overrides: Partial<PreviewEntry> = {}): PreviewEntry {
  return {
    numero: 1,
    fecha: "2026-04-01",
    fechaDate: new Date("2026-04-01T00:00:00.000Z"),
    glosa: "Compra prueba",
    descripcion: "Compra prueba",
    documentoOrigen: "001-001-000000001",
    hojaOrigen: "COMPRAS",
    filaOrigen: 10,
    reglaCodigo: "REG_COMPRA",
    lineas: [
      {
        cuentaId: "cuenta-gasto",
        codigo: "5020208",
        cuenta: "Mantenimiento",
        descripcion: "Base",
        debe: 100,
        haber: 0,
        orden: 1,
      },
      {
        cuentaId: "cuenta-proveedor",
        codigo: "2010102",
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

function preview(overrides: Partial<JournalPreviewResult> = {}): JournalPreviewResult {
  return {
    resumen: {
      ruc: "1250531510",
      razonSocial: "Daniela Baquerizo",
      loteId: "lote-1",
      periodo: "04/2026",
      asientosValidos: 1,
      asientosPendientes: 0,
      errores: 0,
    },
    resumenClasificacion: {
      totalDocumentos: 1,
      clasificadosAutomaticamente: 1,
      pendientesRevision: 0,
      sinClasificacion: 0,
      confianzaAlta: 1,
      confianzaMedia: 0,
      confianzaBaja: 0,
    },
    persistible: true,
    periodo: {
      id: "periodo-1",
      anio: 2026,
      mes: "04",
      estado: "ABIERTO",
    },
    asientos: [entry()],
    pendientes: [],
    issues: [],
    warnings: [],
    errors: [],
    pendientesClasificacion: [],
    ...overrides,
  };
}

function fakeDb(options: {
  existingKeys?: string[];
  accounts?: any[];
  failTransactionAt?: number;
  failCreateAt?: number;
} = {}) {
  const saved: any[] = [];
  let transactionCount = 0;
  let createCount = 0;
  const existingKeys = new Set(options.existingKeys || []);
  const accounts =
    options.accounts ||
    [
      { id: "cuenta-gasto", codigo: "5020208", activa: true, movimiento: true },
      { id: "cuenta-proveedor", codigo: "2010102", activa: true, movimiento: true },
    ];

  return {
    saved,
    db: {
      contribuyente: {
        findUnique: async () => ({ id: "contribuyente-1", ruc: "1250531510" }),
      },
      cuentaContable: {
        findMany: async () => accounts,
      },
      asientoContable: {
        findMany: async () =>
          [...existingKeys].map((key) => {
            const [hojaOrigen, filaOrigen, documentoOrigen] = key.split("|");
            return {
              hojaOrigen,
              filaOrigen: Number(filaOrigen),
              documentoOrigen,
            };
          }),
        create: (args: any) => ({ createArgs: args }),
      },
      $transaction: async (operations: any) => {
        transactionCount += 1;
        if (options.failTransactionAt === transactionCount) {
          throw new Error(`Fallo transaccional grupo ${transactionCount}`);
        }
        if (typeof operations === "function") {
          const savedSnapshot = [...saved];
          const existingSnapshot = new Set(existingKeys);
          const tx = {
            asientoContable: {
              create: async (args: any) => {
                createCount += 1;
                if (options.failCreateAt === createCount) {
                  throw new Error(`Fallo creando asiento ${createCount}`);
                }
                const created = args.data;
                saved.push(created);
                existingKeys.add(
                  [created.hojaOrigen || "", created.filaOrigen || 0, created.documentoOrigen || ""].join("|")
                );
                return created;
              },
            },
          };

          try {
            return await operations(tx);
          } catch (error) {
            saved.splice(0, saved.length, ...savedSnapshot);
            existingKeys.clear();
            existingSnapshot.forEach((key) => existingKeys.add(key));
            throw error;
          }
        }

        const created = operations.map((operation) => operation.createArgs.data);
        saved.push(...created);
        created.forEach((item) => {
          existingKeys.add([item.hojaOrigen || "", item.filaOrigen || 0, item.documentoOrigen || ""].join("|"));
        });
        return created;
      },
    },
  };
}

async function saveWithPreview(result: JournalPreviewResult, dbOptions = {}) {
  const previewService = {
    buildFromAtsLote: async () => result,
  };
  const { db, saved } = fakeDb(dbOptions);
  const service = new JournalPersistenceService(previewService as any, db as any);
  return {
    saved,
    result: await service.saveFromAtsLote({ ruc: "1250531510", loteId: "lote-1" }),
  };
}

async function main() {
{
  const { result } = await saveWithPreview(preview());
  assert.equal(result.persistidos, 1);
  assert.equal(result.fallidos, 0);
}

{
  await assert.rejects(
    () => saveWithPreview(preview({ persistible: false })),
    (error) => error instanceof JournalPersistenceValidationError && error.errores.length > 0
  );
}

{
  await assert.rejects(
    () =>
      saveWithPreview(
        preview({
          persistible: false,
          pendientesClasificacion: [
            {
              hojaOrigen: "COMPRAS",
              filaOrigen: 10,
              documentoOrigen: "001-001-000000001",
              tercero: "Proveedor",
              categoria: "SIN_CLASIFICACION",
              confianza: "BAJA",
              origen: "SIN_CLASIFICACION",
              motivos: ["Sin clasificación"],
              evidencias: [],
            },
          ],
        })
      ),
    (error) =>
      error instanceof JournalPersistenceValidationError &&
      error.errores.some((item) => item.mensaje.includes("pendiente de clasificación"))
  );
}

{
  const errors = validatePreviewIsPersistible(
    preview({
      persistible: false,
      errors: [
        {
          tipo: "ERROR",
          hoja: "COMPRAS",
          fila: 10,
          campo: "asiento",
          mensaje: "Debe y Haber no son iguales.",
        },
      ],
    })
  );
  assert.ok(errors.some((item) => item.mensaje.includes("Debe y Haber")));
}

{
  const errors = validatePreviewEntries([entry()], new Map());
  assert.ok(errors.some((item) => item.tipo === "CUENTA_INVALIDA" && item.mensaje.includes("no existe")));
}

{
  const errors = validatePreviewEntries(
    [entry()],
    new Map([
      ["cuenta-gasto", { id: "cuenta-gasto", codigo: "5020208", activa: false, movimiento: true }],
      ["cuenta-proveedor", { id: "cuenta-proveedor", codigo: "2010102", activa: true, movimiento: true }],
    ])
  );
  assert.ok(errors.some((item) => item.mensaje.includes("inactiva")));
}

{
  const errors = validatePreviewEntries(
    [entry()],
    new Map([
      ["cuenta-gasto", { id: "cuenta-gasto", codigo: "5020208", activa: true, movimiento: false }],
      ["cuenta-proveedor", { id: "cuenta-proveedor", codigo: "2010102", activa: true, movimiento: true }],
    ])
  );
  assert.ok(errors.some((item) => item.mensaje.includes("agrupadora")));
}

{
  const errors = validatePreviewIsPersistible(
    preview({
      periodo: { id: "periodo-1", anio: 2026, mes: "04", estado: "CERRADO" },
    })
  );
  assert.ok(errors.some((item) => item.tipo === "PERIODO_CERRADO"));
}

{
  const bad = entry({
    lineas: [
      { ...entry().lineas[0], debe: 100 },
      { ...entry().lineas[1], haber: 90 },
    ],
    totalDebe: 100,
    totalHaber: 90,
  });
  const errors = validatePreviewEntries(
    [bad],
    new Map([
      ["cuenta-gasto", { id: "cuenta-gasto", codigo: "5020208", activa: true, movimiento: true }],
      ["cuenta-proveedor", { id: "cuenta-proveedor", codigo: "2010102", activa: true, movimiento: true }],
    ])
  );
  assert.ok(errors.some((item) => item.mensaje.includes("total Debe")));
}

{
  const bad = entry({
    lineas: [
      { ...entry().lineas[0], debe: 100, haber: 20 },
      { ...entry().lineas[1], haber: 80 },
      { ...entry().lineas[1], debe: 0, haber: 0, orden: 3 },
    ],
    totalDebe: 100,
    totalHaber: 100,
  });
  const errors = validatePreviewEntries(
    [bad],
    new Map([
      ["cuenta-gasto", { id: "cuenta-gasto", codigo: "5020208", activa: true, movimiento: true }],
      ["cuenta-proveedor", { id: "cuenta-proveedor", codigo: "2010102", activa: true, movimiento: true }],
    ])
  );
  assert.ok(errors.some((item) => item.mensaje.includes("simultáneamente")));
  assert.ok(errors.some((item) => item.mensaje.includes("en cero")));
}

{
  const { result } = await saveWithPreview(preview(), {
    existingKeys: ["COMPRAS|10|001-001-000000001"],
  });
  assert.equal(result.persistidos, 0);
  assert.equal(result.omitidosDuplicados, 1);
}

{
  const second = entry({
    numero: 2,
    filaOrigen: 11,
    documentoOrigen: "001-001-000000002",
  });
  const { result } = await saveWithPreview(
    preview({
      asientos: [entry(), second],
      resumen: { ...preview().resumen, asientosValidos: 2 },
      resumenClasificacion: { ...preview().resumenClasificacion, totalDocumentos: 2, clasificadosAutomaticamente: 2 },
    })
  );
  assert.equal(result.persistidos, 2);
}

{
  const second = entry({
    numero: 2,
    filaOrigen: 11,
    documentoOrigen: "001-001-000000002",
  });
  const fake = fakeDb({ failCreateAt: 2 });
  const previewService = { buildFromAtsLote: async () => preview({ asientos: [entry(), second] }) };
  const service = new JournalPersistenceService(previewService as any, fake.db as any);
  const result = await service.saveFromAtsLote({ ruc: "1250531510", loteId: "lote-1" });
  assert.equal(result.persistidos, 0);
  assert.equal(result.fallidos, 1);
  assert.equal(fake.saved.length, 0);
}

{
  const entries = Array.from({ length: 105 }, (_, index) =>
    entry({
      numero: index + 1,
      filaOrigen: index + 10,
      documentoOrigen: `001-001-${String(index + 1).padStart(9, "0")}`,
    })
  );
  const fake = fakeDb({ failCreateAt: 101 });
  const previewService = {
    buildFromAtsLote: async () =>
      preview({
        asientos: entries,
        resumen: { ...preview().resumen, asientosValidos: entries.length },
        resumenClasificacion: {
          ...preview().resumenClasificacion,
          totalDocumentos: entries.length,
          clasificadosAutomaticamente: entries.length,
        },
      }),
  };
  const service = new JournalPersistenceService(previewService as any, fake.db as any);
  const result = await service.saveFromAtsLote({ ruc: "1250531510", loteId: "lote-1" });
  assert.equal(result.persistidos, 0);
  assert.equal(result.fallidos, 1);
  assert.equal(fake.saved.length, 0);
  assert.equal(result.errores[0]?.filaOrigen, 110);
}

{
  const fake = fakeDb();
  await assert.rejects(
    async () => {
      const previewService = { buildFromAtsLote: async () => preview({ persistible: false }) };
      const service = new JournalPersistenceService(previewService as any, fake.db as any);
      await service.saveFromAtsLote({ ruc: "1250531510", loteId: "lote-1" });
    },
    JournalPersistenceValidationError
  );
  assert.equal(fake.saved.length, 0);
}

{
  const previewService = { buildFromAtsLote: async () => preview() };
  const { db } = fakeDb();
  const service = new JournalPersistenceService(previewService as any, db as any);
  const first = await service.saveFromAtsLote({ ruc: "1250531510", loteId: "lote-1" });
  const second = await service.saveFromAtsLote({ ruc: "1250531510", loteId: "lote-1" });
  assert.equal(first.persistidos, 1);
  assert.equal(second.persistidos, 0);
  assert.equal(second.omitidosDuplicados, 1);
}

console.log("journal-persistence.service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
