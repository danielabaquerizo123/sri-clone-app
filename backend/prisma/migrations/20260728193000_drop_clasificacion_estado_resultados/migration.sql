-- DropForeignKey
ALTER TABLE "ClasificacionEstadoResultados" DROP CONSTRAINT "ClasificacionEstadoResultados_cuentaId_fkey";

-- DropTable
DROP TABLE "ClasificacionEstadoResultados";

-- DropEnum
DROP TYPE "CategoriaEstadoResultados";
