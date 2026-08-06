-- BUG 1 (zona horaria de recordatorios) y BUG 2 (herencia de idioma).
-- Migración ADITIVA:
--
-- 1) Medico.zonaHoraria: zona IANA del negocio. El motor de notificaciones la usa
--    para convertir la hora "de pared" de la cita al instante UTC real. Todas las
--    filas existentes nacen con el default 'Europe/Brussels'; los profesionales
--    fuera de esa zona (ej. México) se corrigen aparte con su zona real (no en
--    esta migración) para no asumir la zona equivocada.
ALTER TABLE "Medico" ADD COLUMN "zonaHoraria" TEXT NOT NULL DEFAULT 'Europe/Brussels';

-- 2) Usuario.idiomaPreferidoExplicito: distingue un idioma elegido a propósito de
--    uno heredado/por defecto. Las filas existentes nacen en false → son las que
--    la acción "aplicar mi idioma a mis clientes" del profesional puede corregir
--    en lote (p. ej. los clientes de Raquel que quedaron en ES por defecto).
ALTER TABLE "Usuario" ADD COLUMN "idiomaPreferidoExplicito" BOOLEAN NOT NULL DEFAULT false;
