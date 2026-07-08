-- AlterTable: modalidad de la cita + enlace de videoconferencia (Jitsi Meet).
ALTER TABLE "Cita" ADD COLUMN "tipoCita" TEXT NOT NULL DEFAULT 'PRESENCIAL';
ALTER TABLE "Cita" ADD COLUMN "enlaceVideoconferencia" TEXT;
