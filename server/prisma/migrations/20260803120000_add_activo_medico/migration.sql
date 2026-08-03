-- Habilitación de cuenta del profesional. Migración aditiva: `activo` nace en
-- true para TODAS las filas existentes (ningún profesional queda deshabilitado
-- por esta migración). Marcar `activo = false` deshabilita la cuenta sin borrar
-- datos (no puede iniciar sesión; su enlace /reservar/<slug> deja de aceptar
-- nuevos registros de clientes).
ALTER TABLE "Medico" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
