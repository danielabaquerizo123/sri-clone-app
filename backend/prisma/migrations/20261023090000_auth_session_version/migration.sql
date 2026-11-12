-- Additive only. Existing sessions retain version 0 until a password reset.
ALTER TABLE "Contribuyente" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
