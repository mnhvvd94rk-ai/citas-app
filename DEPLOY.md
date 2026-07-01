# DEPLOY — Citas App

Guía paso a paso para desplegar el monorepo en producción:

- **Server** (Express + Prisma) → Railway o Render, con **PostgreSQL en Supabase**.
- **Client** (React + Vite PWA) → sitio estático en el mismo proveedor o en Vercel.

> El provider de Prisma ya es `postgresql` y `server/package.json` aplica las
> migraciones automáticamente en cada arranque (`prisma migrate deploy`).

---

## 0. Requisitos previos

- Repo subido a GitHub (monorepo con `client/` y `server/`).
- Cuenta en [Supabase](https://supabase.com), y en [Railway](https://railway.app) o [Render](https://render.com).
- (Opcional) Cuenta en [Vercel](https://vercel.com) para el client.

---

## 1. Base de datos: Supabase (PostgreSQL)

1. Crea un proyecto nuevo en Supabase y define una contraseña de base de datos.
2. Ve a **Project Settings → Database → Connection string → "Connection pooling"**.
3. Copia la cadena en modo **Transaction** (pooler). Tiene esta forma:
   ```
   postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
   - Host con `...pooler.supabase.com`, puerto **6543**, parámetro `pgbouncer=true`.
   - Sustituye `PASSWORD` por la contraseña de tu base.
4. Esta cadena será tu `DATABASE_URL` en el server.

> **Nota sobre migraciones:** `prisma migrate deploy` funciona contra el pooler.
> Si en el futuro corres `prisma migrate dev` (que necesita una conexión
> directa, no pooled), usa además la **Direct connection** (puerto 5432) en una
> variable `DIRECT_URL` y añade `directUrl = env("DIRECT_URL")` al datasource.
> Para el flujo de despliegue actual (`migrate deploy`) basta con `DATABASE_URL`.

---

## 2. Generar la primera migración (una sola vez)

Las migraciones de SQLite se borraron; hay que crear la migración inicial de
Postgres **una vez** desde tu máquina, apuntando a la base de Supabase, y
commitearla al repo (para que `migrate deploy` la aplique en cada despliegue):

```bash
cd server
# Exporta temporalmente la DATABASE_URL de Supabase (usa la DIRECT, puerto 5432,
# para migrate dev):
export DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres"
npx prisma migrate dev --name init_postgres
git add prisma/migrations && git commit -m "Migración inicial Postgres"
```

A partir de aquí, cada despliegue ejecuta `prisma migrate deploy` y aplica esta
migración (y las futuras) automáticamente.

---

## 3. Desplegar el SERVER

### Opción A — Railway

1. **New Project → Deploy from GitHub repo** y selecciona el repo.
2. En el servicio, **Settings → Root Directory** = `server`.
   - Railway detecta el `Procfile` (`web: npm start`). Build: `npm install`.
3. **Variables** (Settings → Variables): añade las del paso 5.
4. Deploy. El `start` corre `prisma migrate deploy && node src/index.js`.
5. Genera un dominio público en **Settings → Networking → Generate Domain**.

### Opción B — Render

1. **New → Web Service** y conecta el repo.
2. **Root Directory** = `server`.
3. **Build Command** = `npm install`
   **Start Command** = `npm start`
4. Añade las variables de entorno del paso 5.
5. Create Web Service. Render expone una URL `https://<servicio>.onrender.com`.

---

## 4. Variables de entorno del SERVER

Configura estas en Railway/Render (no se suben al repo; `.env` está en
`.gitignore`). Referencia: `server/.env.example`.

| Variable | Valor | Notas |
|---|---|---|
| `DATABASE_URL` | cadena pooling de Supabase | `...pooler.supabase.com:6543/...?pgbouncer=true` |
| `JWT_SECRET` | cadena aleatoria fuerte | genera con `openssl rand -hex 48` |
| `JWT_EXPIRES_IN` | `7d` | opcional (default 7d) |
| `PORT` | lo inyecta el proveedor | no lo fijes manualmente si el proveedor lo provee |
| `SMTP_HOST` | host SMTP | p.ej. SendGrid/SES; si se omiten, en dev usa Ethereal |
| `SMTP_PORT` | `587` o `465` | |
| `SMTP_USER` | usuario SMTP | |
| `SMTP_PASS` | contraseña/API key SMTP | |
| `VAPID_PUBLIC_KEY` | clave pública VAPID | generar con `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | clave privada VAPID | mantener secreta |
| `VAPID_SUBJECT` | `mailto:tu-correo@dominio` | |

> En producción **configura SMTP real**: sin `SMTP_*`, el server intentaría usar
> Ethereal (solo para pruebas, no entrega correos reales).

---

## 5. Desplegar el CLIENT (PWA estática)

El client es un build estático de Vite (`npm run build` → `client/dist/`).

### Opción A — Vercel (recomendado para el front)

1. **Add New → Project**, importa el repo.
2. **Root Directory** = `client`.
3. Framework preset: **Vite**. Build Command `npm run build`, Output `dist`.
4. **Environment Variables** → `VITE_API_URL` = URL pública del server
   (del paso 3), p.ej. `https://citas-server.up.railway.app`.
5. Deploy. Vercel sirve la PWA por HTTPS (requisito de Web Push y getUserMedia).

### Opción B — Static Site en Render

1. **New → Static Site**, conecta el repo.
2. **Root Directory** = `client`, **Build Command** = `npm run build`,
   **Publish Directory** = `dist`.
3. Añade `VITE_API_URL` en Environment.

### Opción C — Mismo proveedor que el server

Railway/Render también pueden servir `client/dist` como sitio estático en otro
servicio del mismo proyecto; el procedimiento es análogo (root `client`,
build `npm run build`, publish `dist`).

---

## 6. Conectar el CLIENT al SERVER

- El client lee la URL del backend desde `import.meta.env.VITE_API_URL`
  (ver `client/.env.example`). **Las variables `VITE_*` se inyectan en build**,
  así que define `VITE_API_URL` en el proveedor del client **antes** de buildear.
- En el código del front, usa esa base para las llamadas, p.ej.:
  ```js
  const API = import.meta.env.VITE_API_URL
  fetch(`${API}/auth/login-paciente`, { method: 'POST', /* ... */ })
  ```
- **CORS:** el server ya usa `cors()` abierto. Para endurecer, restringe el
  origen al dominio del client en `server/src/index.js`
  (`cors({ origin: 'https://tu-client...' })`).

---

## 7. Checklist post-despliegue

- [ ] `GET https://<server>/health` responde `{"status":"ok"}`.
- [ ] La migración inicial se aplicó (logs del server muestran `migrate deploy`).
- [ ] Registro/login de paciente y médico funcionan contra la DB de Supabase.
- [ ] El client carga por HTTPS y se puede **instalar** (manifest + service worker).
- [ ] `VITE_API_URL` apunta al server correcto (revisa la pestaña Network).
- [ ] SMTP real configurado (correos de anulación y resumen diario se entregan).
- [ ] Web Push: `VAPID_*` configuradas; el client pide permiso y suscribe.

---

## 8. Notas

- **Zona horaria del cron:** el resumen diario corre a las 06:00 *hora del
  servidor* (`node-cron`). Fija `TZ` en las variables del server (p.ej.
  `TZ=America/Mexico_City`) para alinear el "día" con la zona de la clínica.
- **Migraciones futuras:** desarrolla con `prisma migrate dev` localmente,
  commitea la carpeta `prisma/migrations`, y el despliegue las aplica con
  `prisma migrate deploy`.
- **Secretos:** nunca commitees `.env`. Rota `JWT_SECRET` y las claves VAPID si
  se filtran.
