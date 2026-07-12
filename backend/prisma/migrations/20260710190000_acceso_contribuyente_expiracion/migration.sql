ALTER TABLE "Contribuyente"
ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Contribuyente"
ADD COLUMN "fechaExpiracion" TIMESTAMP(3);

UPDATE "Contribuyente"
SET "fechaExpiracion" = CURRENT_TIMESTAMP + INTERVAL '4 months'
WHERE "fechaExpiracion" IS NULL;

ALTER TABLE "Contribuyente"
ALTER COLUMN "fechaExpiracion" SET NOT NULL;
