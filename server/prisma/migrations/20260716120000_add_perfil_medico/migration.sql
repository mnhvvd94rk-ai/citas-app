-- Perfil editable del profesional, visible para el cliente: dirección/ubicación y
-- ficha biográfica corta. Ambos opcionales (nullable). Migración aditiva.
ALTER TABLE "Medico" ADD COLUMN "direccion" TEXT;
ALTER TABLE "Medico" ADD COLUMN "bio" TEXT;
