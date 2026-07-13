-- Idioma preferido del profesional para sus notificaciones (recordatorios).
ALTER TABLE "Medico" ADD COLUMN     "idiomaPreferido" TEXT NOT NULL DEFAULT 'ES';
