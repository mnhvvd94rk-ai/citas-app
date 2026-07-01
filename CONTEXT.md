# PWA de Gestión de Citas — Documento de Arranque para Claude Code

## 1. Objetivo
Construir una PWA (Progressive Web App) con dos sistemas/vistas:
- **Cliente/Paciente**: registro, verificación de identidad, firma digital, y reserva de citas.
- **Gestor/Médico**: configuración de horarios, aprobación/anulación de citas, notas de pacientes.

## 2. Stack sugerido
- Frontend: React + Vite, con plugin PWA (`vite-plugin-pwa`) para service worker, manifest, instalación e ícono.
- Backend: Node.js + Express (o Fastify), API REST.
- Base de datos: PostgreSQL (o SQLite para desarrollo inicial).
- Autenticación: JWT + bcrypt para contraseñas.
- Almacenamiento de archivos (foto identidad, firma): filesystem local en dev, S3 o equivalente en producción.
- Notificaciones:
  - Email: capa adapter genérica, implementación inicial con Nodemailer (luego swappeable a SendGrid/SES).
  - Push: Web Push API (estándar PWA, no requiere Firebase) usando `web-push` en Node.
  - SMS: adapter genérico, implementación inicial vacía/mock, lista para Twilio.
- Cron: `node-cron` para el resumen matutino del gestor.

## 3. Estructura de carpetas propuesta
```
/app-citas
  /client                 # React PWA
    /src
      /views
        /paciente
        /gestor
      /components
      /services           # llamadas a API
    manifest.json
    service-worker.js
  /server
    /src
      /models
      /routes
      /services
        notificationService.js   # capa adapter
        slotEngine.js            # motor de slots de 45 min
      /jobs
        dailySummary.js
    /migrations
```

## 4. Modelo de datos

**Usuario (paciente)**
- id, nombre, apellido, documento_identidad, foto_identidad_url, firma_url
- telefono, correo, password_hash
- estado: `nuevo` | `continuidad`
- fecha_registro

**Medico (gestor)**
- id, nombre, especialidad, correo, password_hash

**Disponibilidad**
- id, medico_id, fecha, hora_inicio, hora_fin
- (el motor de slots trocea esto en bloques de 45 min sin huecos)

**Cita**
- id, paciente_id, medico_id, slots (1 o 2 consecutivos), fecha, hora_inicio, hora_fin
- estado: `pendiente` | `confirmada` | `anulada` | `completada`
- motivo_consulta (solo si paciente es `nuevo`)
- nota_anulacion (si aplica)

**NotaPaciente**
- id, paciente_id, medico_id, texto, fecha (historial abierto, no ligado a una cita)

**Notificacion**
- id, destinatario_id, tipo: `anulacion` | `resumen_diario`
- canal: `email` | `sms` | `push`
- estado_envio, fecha_envio

## 5. Reglas de negocio (CONFIRMADAS)

1. **Slots de 45 min continuos**: el médico define rangos de disponibilidad; el sistema genera automáticamente slots de 45 min consecutivos sin huecos dentro de esos rangos.
2. **Paciente nuevo**: solo puede reservar 1 slot suelto. Debe indicar motivo de consulta. La cita queda en estado `pendiente` y **el slot se bloquea de inmediato** (reserva provisional) hasta que el médico apruebe o rechace.
3. **Paciente continuidad**: puede reservar 1 o 2 slots consecutivos (máx. 90 min). No requiere motivo de consulta ni aprobación previa — pasa directo a `confirmada`.
4. **Transición automática nuevo → continuidad**: el sistema marca al paciente como `continuidad` automáticamente en cuanto su primera cita pasa a estado `completada`. No es manual ni decidido por el paciente.
5. **Anulación**: el gestor puede anular cualquier cita; esto dispara notificación inmediata al paciente y libera el/los slot(s).
6. **Resumen diario al gestor**: job programado (ej. 6:00 am) que recopila las citas `confirmada` del día y notifica al gestor (email + push) con la lista.
7. **Notas de paciente**: texto libre que el gestor puede agregar en cualquier momento, visibles como historial continuo del paciente (no atadas a una cita puntual).

## 6. Flujo de registro del paciente (primera vez)
1. Captura de foto del documento de identidad con la cámara (`getUserMedia` / `<input capture="environment">` como fallback PWA).
2. OCR del documento — **requiere servicio externo** (Google Vision API, AWS Textract, o similar). No hay OCR nativo en navegador con buena precisión; documentar esto como dependencia externa a contratar/configurar con API key.
3. Autorrelleno de la ficha con los datos extraídos (editable por el usuario antes de confirmar).
4. Firma digital en canvas (táctil/mouse), exportada como imagen.
5. Aceptación de términos y condiciones (checkbox obligatorio).
6. Teléfono, correo, contraseña → creación de cuenta.

## 7. Flujo de reserva de cita
1. Login.
2. Selección de tipo: el sistema ya sabe si es `nuevo` o `continuidad` (no se pregunta al usuario, se lee de su estado).
3. Si `nuevo`: formulario de motivo de consulta → calendario con slots disponibles → reserva 1 slot → estado `pendiente`.
4. Si `continuidad`: calendario directo → reserva 1 o 2 slots consecutivos → estado `confirmada`.

## 8. Panel del gestor/médico
- CRUD de disponibilidad (rangos horarios por día).
- Vista de agenda (día/semana) con slots y su estado.
- Aprobar/rechazar citas `pendiente`.
- Anular/reprogramar citas `confirmada` (dispara notificación).
- Notas abiertas por paciente.
- Notificación push/email automática cada mañana con la agenda del día.

## 9. Notificaciones — capa de integración
Implementar `notificationService.js` como adapter con interfaz fija:
```js
notificationService.send({ tipo, canal, destinatario, payload })
```
Implementación inicial: Nodemailer para email, `web-push` para push (nativo PWA), mock/log para SMS. Esto permite cambiar de proveedor sin tocar el resto del sistema — solo se reemplaza la implementación interna del adapter.

## 10. PWA — requisitos técnicos específicos
- `manifest.json` con íconos, nombre, theme_color, display: `standalone`.
- Service worker con estrategia de caché (Workbox recomendado vía `vite-plugin-pwa`).
- Web Push requiere VAPID keys (generar con `web-push generate-vapid-keys`) y permiso explícito del usuario en el navegador.
- HTTPS obligatorio para `getUserMedia` y Web Push fuera de localhost.

## 11. Pendiente de definir antes de implementar
- Proveedor final de OCR para documento de identidad (API key y costos).
- Proveedor final de email/SMS en producción (se mantiene el adapter, solo se configura).
- Política de qué pasa si el paciente nuevo es rechazado: ¿puede volver a solicitar cita inmediatamente o hay un periodo de espera?
