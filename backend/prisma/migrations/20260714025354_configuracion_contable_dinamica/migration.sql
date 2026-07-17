-- CreateTable
CREATE TABLE "ConfiguracionCuentaContable" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "cuentaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionCuentaContable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaClasificacionContable" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "tipoOperacion" "TipoOperacionContable" NOT NULL,
    "prioridad" INTEGER NOT NULL DEFAULT 100,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "condiciones" JSONB NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglaClasificacionContable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionCuentaContable_clave_key" ON "ConfiguracionCuentaContable"("clave");

-- CreateIndex
CREATE INDEX "ConfiguracionCuentaContable_cuentaId_idx" ON "ConfiguracionCuentaContable"("cuentaId");

-- CreateIndex
CREATE INDEX "ConfiguracionCuentaContable_activa_idx" ON "ConfiguracionCuentaContable"("activa");

-- CreateIndex
CREATE UNIQUE INDEX "ReglaClasificacionContable_codigo_key" ON "ReglaClasificacionContable"("codigo");

-- CreateIndex
CREATE INDEX "ReglaClasificacionContable_categoria_activa_prioridad_idx" ON "ReglaClasificacionContable"("categoria", "activa", "prioridad");

-- CreateIndex
CREATE INDEX "ReglaClasificacionContable_tipoOperacion_activa_prioridad_idx" ON "ReglaClasificacionContable"("tipoOperacion", "activa", "prioridad");

-- AddForeignKey
ALTER TABLE "ConfiguracionCuentaContable" ADD CONSTRAINT "ConfiguracionCuentaContable_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaContable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AsientoContable_contribuyenteId_atsLoteId_hojaOrigen_filaOrigen" RENAME TO "AsientoContable_contribuyenteId_atsLoteId_hojaOrigen_filaOr_key";

-- RenameIndex
ALTER INDEX "ReglaContable_tipoOperacion_tipoComprobante_codigoSustento_acti" RENAME TO "ReglaContable_tipoOperacion_tipoComprobante_codigoSustento__idx";
