-- CreateTable
CREATE TABLE "AnexoTributario" (
    "id" TEXT NOT NULL,
    "tipoAnexo" TEXT NOT NULL,
    "periodoFiscal" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'RECIBIDO',
    "archivoNombre" TEXT,
    "datosJSON" JSONB NOT NULL DEFAULT '{}',
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contribuyenteId" TEXT NOT NULL,

    CONSTRAINT "AnexoTributario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoPersonal" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "tipoGasto" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "rucProveedor" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contribuyenteId" TEXT NOT NULL,

    CONSTRAINT "GastoPersonal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargaFamiliar" (
    "id" TEXT NOT NULL,
    "identificacion" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "parentesco" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "tipoPeriodo" TEXT NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contribuyenteId" TEXT NOT NULL,

    CONSTRAINT "CargaFamiliar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeneficiarioPension" (
    "id" TEXT NOT NULL,
    "identificacion" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "parentesco" TEXT NOT NULL,
    "valorMensual" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contribuyenteId" TEXT NOT NULL,

    CONSTRAINT "BeneficiarioPension_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AnexoTributario" ADD CONSTRAINT "AnexoTributario_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "Contribuyente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoPersonal" ADD CONSTRAINT "GastoPersonal_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "Contribuyente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaFamiliar" ADD CONSTRAINT "CargaFamiliar_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "Contribuyente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficiarioPension" ADD CONSTRAINT "BeneficiarioPension_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "Contribuyente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
