-- Throttle server-side de la activación directa por teléfono (ver
-- /auth/activacion-directa). Contador de intentos fallidos consecutivos de
-- confirmación de teléfono + momento del último intento. Tras alcanzar el máximo
-- (5), el servidor bloquea nuevos intentos durante una ventana de tiempo,
-- independientemente del límite visual del frontend. Se reinicia al acertar o al
-- expirar la ventana.
--
-- Migración ADITIVA: la columna del contador nace con default 0 (aplica a las
-- filas existentes sin tocarlas); la del timestamp es nullable (NULL = sin
-- intentos todavía). No se rellenan ni modifican datos reales.
ALTER TABLE "Usuario" ADD COLUMN "intentosActivacionFallidos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Usuario" ADD COLUMN "ultimoIntentoActivacion" TIMESTAMP(3);
