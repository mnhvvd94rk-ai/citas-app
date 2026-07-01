-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "documentoIdentidad" TEXT NOT NULL,
    "fotoIdentidadUrl" TEXT,
    "firmaUrl" TEXT,
    "telefono" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'NUEVO',
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medico" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "especialidad" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "Medico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disponibilidad" (
    "id" SERIAL NOT NULL,
    "medicoId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,

    CONSTRAINT "Disponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cita" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "medicoId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "numeroSlots" INTEGER NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "motivoConsulta" TEXT,
    "notaAnulacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaPaciente" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "medicoId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaPaciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" SERIAL NOT NULL,
    "destinatarioId" INTEGER NOT NULL,
    "tipoDestinatario" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "estadoEnvio" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaEnvio" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_documentoIdentidad_key" ON "Usuario"("documentoIdentidad");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "Medico_correo_key" ON "Medico"("correo");

-- CreateIndex
CREATE INDEX "Disponibilidad_medicoId_fecha_idx" ON "Disponibilidad"("medicoId", "fecha");

-- CreateIndex
CREATE INDEX "Cita_medicoId_fecha_idx" ON "Cita"("medicoId", "fecha");

-- CreateIndex
CREATE INDEX "Cita_pacienteId_idx" ON "Cita"("pacienteId");

-- CreateIndex
CREATE INDEX "NotaPaciente_pacienteId_idx" ON "NotaPaciente"("pacienteId");

-- CreateIndex
CREATE INDEX "Notificacion_destinatarioId_tipoDestinatario_idx" ON "Notificacion"("destinatarioId", "tipoDestinatario");

-- AddForeignKey
ALTER TABLE "Disponibilidad" ADD CONSTRAINT "Disponibilidad_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaPaciente" ADD CONSTRAINT "NotaPaciente_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaPaciente" ADD CONSTRAINT "NotaPaciente_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
