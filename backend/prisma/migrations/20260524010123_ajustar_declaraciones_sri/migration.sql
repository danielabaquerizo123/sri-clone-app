/*
  Warnings:

  - A unique constraint covering the columns `[numeroAdhesion]` on the table `Declaracion` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `numeroAdhesion` to the `Declaracion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipoImpuesto` to the `Declaracion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Declaracion" ADD COLUMN     "banco" TEXT,
ADD COLUMN     "baseImponible" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
ADD COLUMN     "emitioRetenciones" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'Procesada',
ADD COLUMN     "impuestoGenerado" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
ADD COLUMN     "linkFormulario" TEXT,
ADD COLUMN     "linkTalonResumen" TEXT,
ADD COLUMN     "numeroAdhesion" TEXT NOT NULL,
ADD COLUMN     "numeroCuenta" TEXT,
ADD COLUMN     "semestre" TEXT,
ADD COLUMN     "tieneEmpleados" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipoCuenta" TEXT,
ADD COLUMN     "tipoDeclaracion" TEXT NOT NULL DEFAULT 'Original',
ADD COLUMN     "tipoImpuesto" TEXT NOT NULL,
ADD COLUMN     "tipoPago" TEXT,
ADD COLUMN     "valorCancelado" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
ADD COLUMN     "valorRetenido" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
ADD COLUMN     "ventasPeriodo" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "datosJSON" SET DEFAULT '{}';

-- CreateIndex
CREATE UNIQUE INDEX "Declaracion_numeroAdhesion_key" ON "Declaracion"("numeroAdhesion");
