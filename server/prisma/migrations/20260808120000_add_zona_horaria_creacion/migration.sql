-- Modelo "Google Calendar" de zona horaria: cada Disponibilidad y cada Cita ancla
-- su propia zona horaria en el momento de crearse. El motor de recordatorios usa
-- SIEMPRE la zona guardada en el registro (no la zona actual del profesional), de
-- modo que una cita ya agendada nunca se mueve de hora aunque el profesional viaje.
--
-- Migración ADITIVA: columnas nullable. Las filas existentes nacen con NULL; el
-- motor cae entonces a la zona del médico (o al default). No se rellena ninguna
-- fila existente aquí (no se tocan datos reales); solo las creadas a partir de
-- ahora llevan su zona anclada.
ALTER TABLE "Disponibilidad" ADD COLUMN "zonaHorariaCreacion" TEXT;
ALTER TABLE "Cita" ADD COLUMN "zonaHorariaCreacion" TEXT;
