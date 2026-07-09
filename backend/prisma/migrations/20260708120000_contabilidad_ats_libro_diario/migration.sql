-- CreateEnum
CREATE TYPE "EstadoPeriodo" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoAsiento" AS ENUM ('BORRADOR', 'APROBADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO');

-- CreateEnum
CREATE TYPE "NaturalezaCuenta" AS ENUM ('DEUDORA', 'ACREEDORA');

-- CreateEnum
CREATE TYPE "TipoOperacionContable" AS ENUM ('COMPRA', 'VENTA', 'GASTO');

-- CreateEnum
CREATE TYPE "LadoMovimiento" AS ENUM ('DEBE', 'HABER');

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN "filaExcel" INTEGER;

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN "filaExcel" INTEGER;

-- CreateTable
CREATE TABLE "CuentaContable" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "naturaleza" "NaturalezaCuenta" NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "movimiento" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "parentCodigo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaContable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaContable" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipoOperacion" "TipoOperacionContable" NOT NULL,
    "tipoComprobante" TEXT,
    "codigoSustento" TEXT,
    "tarifaIva" DECIMAL(5,2),
    "formaPago" TEXT,
    "prioridad" INTEGER NOT NULL DEFAULT 100,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "cuentaBaseId" TEXT NOT NULL,
    "ladoBase" "LadoMovimiento" NOT NULL,
    "cuentaIvaId" TEXT,
    "ladoIva" "LadoMovimiento",
    "cuentaContrapartidaId" TEXT NOT NULL,
    "ladoContrapartida" "LadoMovimiento" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglaContable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodoContable" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" TEXT NOT NULL,
    "estado" "EstadoPeriodo" NOT NULL DEFAULT 'ABIERTO',
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "contribuyenteId" TEXT NOT NULL,

    CONSTRAINT "PeriodoContable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsientoContable" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "EstadoAsiento" NOT NULL DEFAULT 'BORRADOR',
    "origen" TEXT NOT NULL DEFAULT 'ATS',
    "documentoOrigen" TEXT,
    "hojaOrigen" TEXT,
    "filaOrigen" INTEGER,
    "reglaCodigo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contribuyenteId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "atsLoteId" TEXT,

    CONSTRAINT "AsientoContable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaAsiento" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "debe" DECIMAL(14,2) NOT NULL DEFAULT 0.0,
    "haber" DECIMAL(14,2) NOT NULL DEFAULT 0.0,
    "orden" INTEGER NOT NULL DEFAULT 1,
    "asientoId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,

    CONSTRAINT "LineaAsiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuentaContable_codigo_key" ON "CuentaContable"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ReglaContable_codigo_key" ON "ReglaContable"("codigo");

-- CreateIndex
CREATE INDEX "ReglaContable_tipoOperacion_tipoComprobante_codigoSustento_activa_prioridad_idx" ON "ReglaContable"("tipoOperacion", "tipoComprobante", "codigoSustento", "activa", "prioridad");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodoContable_contribuyenteId_anio_mes_key" ON "PeriodoContable"("contribuyenteId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "AsientoContable_contribuyenteId_atsLoteId_hojaOrigen_filaOrigen_documentoOrigen_key" ON "AsientoContable"("contribuyenteId", "atsLoteId", "hojaOrigen", "filaOrigen", "documentoOrigen");

-- CreateIndex
CREATE INDEX "AsientoContable_contribuyenteId_periodoId_estado_idx" ON "AsientoContable"("contribuyenteId", "periodoId", "estado");

-- CreateIndex
CREATE INDEX "LineaAsiento_asientoId_idx" ON "LineaAsiento"("asientoId");

-- CreateIndex
CREATE INDEX "LineaAsiento_cuentaId_idx" ON "LineaAsiento"("cuentaId");

-- AddForeignKey
ALTER TABLE "ReglaContable" ADD CONSTRAINT "ReglaContable_cuentaBaseId_fkey" FOREIGN KEY ("cuentaBaseId") REFERENCES "CuentaContable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaContable" ADD CONSTRAINT "ReglaContable_cuentaIvaId_fkey" FOREIGN KEY ("cuentaIvaId") REFERENCES "CuentaContable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaContable" ADD CONSTRAINT "ReglaContable_cuentaContrapartidaId_fkey" FOREIGN KEY ("cuentaContrapartidaId") REFERENCES "CuentaContable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodoContable" ADD CONSTRAINT "PeriodoContable_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "Contribuyente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsientoContable" ADD CONSTRAINT "AsientoContable_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "Contribuyente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsientoContable" ADD CONSTRAINT "AsientoContable_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoContable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsientoContable" ADD CONSTRAINT "AsientoContable_atsLoteId_fkey" FOREIGN KEY ("atsLoteId") REFERENCES "AtsLote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaAsiento" ADD CONSTRAINT "LineaAsiento_asientoId_fkey" FOREIGN KEY ("asientoId") REFERENCES "AsientoContable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaAsiento" ADD CONSTRAINT "LineaAsiento_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaContable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
