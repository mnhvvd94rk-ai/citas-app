-- Suscripciones Web Push (tercer canal de recordatorios, junto a Email y WhatsApp).
-- Cada suscripción pertenece a un cliente (Usuario) o a un profesional (Medico).
CREATE TABLE "PushSubscription" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "clienteId" INTEGER,
    "profesionalId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_clienteId_idx" ON "PushSubscription"("clienteId");

-- CreateIndex
CREATE INDEX "PushSubscription_profesionalId_idx" ON "PushSubscription"("profesionalId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_profesionalId_fkey" FOREIGN KEY ("profesionalId") REFERENCES "Medico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
