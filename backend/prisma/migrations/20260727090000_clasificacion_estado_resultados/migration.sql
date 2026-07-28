-- CreateEnum
CREATE TYPE "CategoriaEstadoResultados" AS ENUM (
    'INGRESO_OPERACIONAL',
    'OTRO_INGRESO',
    'COSTO_VENTAS',
    'GASTO_OPERACIONAL',
    'GASTO_ADMINISTRATIVO',
    'GASTO_VENTAS',
    'GASTO_FINANCIERO',
    'OTRO_GASTO',
    'PARTICIPACION_TRABAJADORES',
    'IMPUESTO_RENTA'
);

-- CreateTable
CREATE TABLE "ClasificacionEstadoResultados" (
    "id" TEXT NOT NULL,
    "categoria" "CategoriaEstadoResultados" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "cuentaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClasificacionEstadoResultados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClasificacionEstadoResultados_cuentaId_key" ON "ClasificacionEstadoResultados"("cuentaId");

-- CreateIndex
CREATE INDEX "ClasificacionEstadoResultados_categoria_activa_idx" ON "ClasificacionEstadoResultados"("categoria", "activa");

-- AddForeignKey
ALTER TABLE "ClasificacionEstadoResultados" ADD CONSTRAINT "ClasificacionEstadoResultados_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaContable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
