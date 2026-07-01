import { PrismaClient } from '@prisma/client'

// Cliente Prisma compartido. Importar desde aquí en services/jobs.
export const prisma = new PrismaClient()
