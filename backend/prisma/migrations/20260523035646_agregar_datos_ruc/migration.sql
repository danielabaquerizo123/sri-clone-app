-- AlterTable
ALTER TABLE "Contribuyente" ADD COLUMN     "actividadesEconomicas" TEXT NOT NULL DEFAULT 'NO REGISTRA',
ADD COLUMN     "establecimientosAbiertos" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "establecimientosCerrados" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "estadoRuc" TEXT NOT NULL DEFAULT 'ACTIVO',
ADD COLUMN     "obligaciones" TEXT NOT NULL DEFAULT 'NINGUNA',
ADD COLUMN     "regimen" TEXT NOT NULL DEFAULT 'GENERAL';
