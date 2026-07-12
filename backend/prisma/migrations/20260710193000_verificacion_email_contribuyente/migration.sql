ALTER TABLE "Contribuyente"
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "verificationToken" TEXT,
ADD COLUMN "verificationExpires" TIMESTAMP(3);

UPDATE "Contribuyente"
SET "emailVerified" = true
WHERE "emailVerified" = false;
