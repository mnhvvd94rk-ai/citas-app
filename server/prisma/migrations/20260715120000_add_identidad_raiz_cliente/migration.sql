-- Correo del cliente: de único global a único POR PROFESIONAL.
-- Permite que una misma persona tenga una cuenta por profesional con su correo
-- real (recordatorios por email en todas sus relaciones). El rechazo de "mismo
-- correo en el registro público con otro profesional" pasa a validarse a nivel de
-- aplicación (ver /auth/registro-paciente). Migración aditiva: no borra datos.
DROP INDEX "Usuario_correo_key";

-- Vínculo explícito entre las cuentas de una misma persona (identidad raíz).
ALTER TABLE "Usuario" ADD COLUMN "identidadRaizId" INTEGER;

-- CreateIndex
CREATE INDEX "Usuario_identidadRaizId_idx" ON "Usuario"("identidadRaizId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_profesionalId_key" ON "Usuario"("correo", "profesionalId");

-- AddForeignKey (auto-referencia a la cuenta raíz)
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_identidadRaizId_fkey" FOREIGN KEY ("identidadRaizId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
