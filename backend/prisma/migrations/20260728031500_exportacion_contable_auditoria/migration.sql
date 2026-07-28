CREATE TABLE "ExportacionContable" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loteId" TEXT NOT NULL,
    "ejecutorId" TEXT NOT NULL,

    CONSTRAINT "ExportacionContable_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExportacionContable_loteId_createdAt_idx" ON "ExportacionContable"("loteId", "createdAt");
CREATE INDEX "ExportacionContable_ejecutorId_createdAt_idx" ON "ExportacionContable"("ejecutorId", "createdAt");

ALTER TABLE "ExportacionContable" ADD CONSTRAINT "ExportacionContable_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "AtsLote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportacionContable" ADD CONSTRAINT "ExportacionContable_ejecutorId_fkey" FOREIGN KEY ("ejecutorId") REFERENCES "Contribuyente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
