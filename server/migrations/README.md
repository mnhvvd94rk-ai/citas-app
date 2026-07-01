# migrations/

Carpeta reservada para migraciones del proyecto.

> **Nota sobre Prisma:** Prisma genera y gestiona sus migraciones SQL bajo
> `server/prisma/migrations/` (su convención, junto al `schema.prisma`).
> Se crearán automáticamente la primera vez que definas modelos y ejecutes:
>
> ```bash
> npm run prisma:migrate
> ```
>
> Esta carpeta queda disponible por si se necesitan migraciones manuales o
> scripts de datos fuera del flujo de Prisma.
