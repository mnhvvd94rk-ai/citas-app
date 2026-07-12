-- Enlace público de registro del profesional: slug único + marca de edición única.
ALTER TABLE "Medico" ADD COLUMN     "slug" TEXT,
ADD COLUMN     "slugEditado" BOOLEAN NOT NULL DEFAULT false;

-- Vínculo cliente → profesional (cada profesional tiene sus propios clientes).
ALTER TABLE "Usuario" ADD COLUMN     "profesionalId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Medico_slug_key" ON "Medico"("slug");

-- CreateIndex
CREATE INDEX "Usuario_profesionalId_idx" ON "Usuario"("profesionalId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "Medico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
