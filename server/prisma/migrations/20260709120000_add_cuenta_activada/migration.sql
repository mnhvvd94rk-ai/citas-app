-- AlterTable: cuentas importadas requieren activación propia.
-- passwordHash pasa a nullable (los importados nacen sin contraseña).
ALTER TABLE "Usuario" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- cuentaActivada: true por defecto (clientes existentes y de registro propio
-- quedan activados); los importados se insertarán con false desde la app.
ALTER TABLE "Usuario" ADD COLUMN "cuentaActivada" BOOLEAN NOT NULL DEFAULT true;
