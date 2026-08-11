-- Anuncios del profesional para sus propios clientes (ej. "Cerrado por
-- vacaciones", "Nueva promoción"). Se muestran en el dashboard del cliente.
--
-- Migración ADITIVA: crea una tabla nueva y su FK/índice. No toca ni rellena
-- ninguna fila ni columna existente. `activo` nace en true (soft-delete: el
-- profesional oculta un anuncio poniéndolo en false, sin borrar el registro).
-- (El drift de tipos TIMESTAMP(3) en otras tablas que reporta `migrate diff` se
--  omite a propósito: no forma parte de esta feature.)

-- CreateTable
CREATE TABLE "Anuncio" (
    "id" SERIAL NOT NULL,
    "medicoId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Anuncio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Anuncio_medicoId_activo_idx" ON "Anuncio"("medicoId", "activo");

-- AddForeignKey
ALTER TABLE "Anuncio" ADD CONSTRAINT "Anuncio_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
