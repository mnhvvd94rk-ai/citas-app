-- Cuenta "Pro" para negocios con varios empleados (ej. un spa con varias
-- masajistas) gestionados desde una sola cuenta de dueño. Migración ADITIVA:
-- `esNegocioPro` nace en false para TODAS las filas existentes → ningún
-- profesional actual (Raquel, Brenda, etc.) cambia de comportamiento ni ve UI
-- nueva. Las columnas `empleadoId` nacen NULL en las franjas y citas existentes,
-- por lo que el motor de slots se comporta exactamente igual que antes para las
-- cuentas normales.

-- 1) Flag de cuenta Pro en el profesional/dueño.
ALTER TABLE "Medico" ADD COLUMN "esNegocioPro" BOOLEAN NOT NULL DEFAULT false;

-- 2) Empleados del negocio (solo cuentas Pro). No se borra en duro: al
--    "eliminar" se marca activo=false (ver ruta DELETE /medicos/mis-empleados).
CREATE TABLE "Empleado" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "bio" TEXT,
    "fotoUrl" TEXT,
    "medicoId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Empleado_medicoId_idx" ON "Empleado"("medicoId");

ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_medicoId_fkey"
    FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Franja de disponibilidad asociable a un empleado (nullable).
ALTER TABLE "Disponibilidad" ADD COLUMN "empleadoId" INTEGER;

CREATE INDEX "Disponibilidad_empleadoId_idx" ON "Disponibilidad"("empleadoId");

ALTER TABLE "Disponibilidad" ADD CONSTRAINT "Disponibilidad_empleadoId_fkey"
    FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Empleado que atiende una cita (nullable). SET NULL para no perder la cita.
ALTER TABLE "Cita" ADD COLUMN "empleadoId" INTEGER;

CREATE INDEX "Cita_empleadoId_idx" ON "Cita"("empleadoId");

ALTER TABLE "Cita" ADD CONSTRAINT "Cita_empleadoId_fkey"
    FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
