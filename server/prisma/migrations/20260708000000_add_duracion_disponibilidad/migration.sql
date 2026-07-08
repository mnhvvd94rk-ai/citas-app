-- AlterTable: la duración del bloque (en minutos) con que se trocea cada
-- franja de disponibilidad. Default 45 para las franjas ya existentes.
ALTER TABLE "Disponibilidad" ADD COLUMN "duracionMinutos" INTEGER NOT NULL DEFAULT 45;
