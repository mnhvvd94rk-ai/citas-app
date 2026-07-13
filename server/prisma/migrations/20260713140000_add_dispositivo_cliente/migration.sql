-- Token de dispositivo (login semi-automático por profesional). Solo hash.
CREATE TABLE "DispositivoCliente" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "profesionalId" INTEGER NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUsoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispositivoCliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DispositivoCliente_tokenHash_key" ON "DispositivoCliente"("tokenHash");
CREATE INDEX "DispositivoCliente_clienteId_idx" ON "DispositivoCliente"("clienteId");
CREATE INDEX "DispositivoCliente_profesionalId_idx" ON "DispositivoCliente"("profesionalId");

ALTER TABLE "DispositivoCliente" ADD CONSTRAINT "DispositivoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DispositivoCliente" ADD CONSTRAINT "DispositivoCliente_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "Medico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
