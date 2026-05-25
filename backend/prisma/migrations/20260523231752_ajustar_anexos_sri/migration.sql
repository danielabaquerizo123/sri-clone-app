/*
  Warnings:

  - You are about to drop the column `parentesco` on the `BeneficiarioPension` table. All the data in the column will be lost.
  - You are about to drop the column `valorMensual` on the `BeneficiarioPension` table. All the data in the column will be lost.
  - You are about to drop the column `anio` on the `CargaFamiliar` table. All the data in the column will be lost.
  - Added the required column `tipoIdentificacion` to the `BeneficiarioPension` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodoFiscal` to the `CargaFamiliar` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipoIdentificacion` to the `CargaFamiliar` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BeneficiarioPension" DROP COLUMN "parentesco",
DROP COLUMN "valorMensual",
ADD COLUMN     "montoAnual" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
ADD COLUMN     "tipoIdentificacion" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CargaFamiliar" DROP COLUMN "anio",
ADD COLUMN     "condicionDiscapacidad" TEXT NOT NULL DEFAULT 'NO',
ADD COLUMN     "enfermedadCatastrofica" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "periodoFiscal" INTEGER NOT NULL,
ADD COLUMN     "tipoIdentificacion" TEXT NOT NULL;
