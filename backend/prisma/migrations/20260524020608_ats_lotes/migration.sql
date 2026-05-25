-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "atsLoteId" TEXT;

-- AlterTable
ALTER TABLE "ComprobanteAnulado" ADD COLUMN     "atsLoteId" TEXT;

-- AlterTable
ALTER TABLE "GuiaRemision" ADD COLUMN     "atsLoteId" TEXT;

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "atsLoteId" TEXT;

-- CreateTable
CREATE TABLE "AtsLote" (
    "id" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "rucInformante" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PROCESADO',
    "erroresJSON" JSONB NOT NULL DEFAULT '[]',
    "resumenJSON" JSONB NOT NULL DEFAULT '{}',
    "xmlGenerado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contribuyenteId" TEXT NOT NULL,

    CONSTRAINT "AtsLote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_atsLoteId_fkey" FOREIGN KEY ("atsLoteId") REFERENCES "AtsLote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_atsLoteId_fkey" FOREIGN KEY ("atsLoteId") REFERENCES "AtsLote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprobanteAnulado" ADD CONSTRAINT "ComprobanteAnulado_atsLoteId_fkey" FOREIGN KEY ("atsLoteId") REFERENCES "AtsLote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuiaRemision" ADD CONSTRAINT "GuiaRemision_atsLoteId_fkey" FOREIGN KEY ("atsLoteId") REFERENCES "AtsLote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtsLote" ADD CONSTRAINT "AtsLote_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "Contribuyente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
