import sgMail from '@sendgrid/mail'

// Servicio de email transaccional del formulario de contacto, vía SendGrid.
// Requiere en el entorno: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, CONTACT_EMAIL_TO.

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function plantilla({ nombre, email, asunto, mensaje }) {
  const msgHtml = escapeHtml(mensaje).replace(/\n/g, '<br>')
  return `
  <div style="font-family:'Segoe UI',system-ui,sans-serif;max-width:600px;margin:0 auto;background:#f6f8fb;padding:0 0 24px">
    <div style="background:#1e3a5f;color:#fff;padding:20px 24px;border-radius:0 0 0 0">
      <h1 style="margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em">Kohtun</h1>
      <p style="margin:4px 0 0;color:#c9d6e6;font-size:13px">Nuevo mensaje de contacto</p>
    </div>
    <div style="padding:24px">
      <table style="width:100%;font-size:14px;color:#334155;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#64748b;width:90px">Nombre</td><td style="padding:4px 0;font-weight:600">${escapeHtml(nombre)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Email</td><td style="padding:4px 0;font-weight:600">${escapeHtml(email)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Asunto</td><td style="padding:4px 0;font-weight:600">${escapeHtml(asunto)}</td></tr>
      </table>
      <div style="margin-top:16px;border-left:4px solid #10b981;background:#fff;padding:16px;border-radius:8px;color:#0f172a;font-size:14px;line-height:1.6">
        ${msgHtml}
      </div>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin:8px 0 0">© 2026 Kohtun · Enviado desde el formulario de contacto</p>
  </div>`
}

/**
 * Envía el email del formulario de contacto al buzón configurado.
 * @returns {Promise<{ok:true}|{ok:false,error:string}>}
 */
export async function enviarEmailContacto({ nombre, email, asunto, mensaje }) {
  const { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, CONTACT_EMAIL_TO } = process.env
  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL || !CONTACT_EMAIL_TO) {
    return { ok: false, error: 'SendGrid no está configurado (faltan variables de entorno).' }
  }

  sgMail.setApiKey(SENDGRID_API_KEY)
  try {
    await sgMail.send({
      to: CONTACT_EMAIL_TO,
      from: SENDGRID_FROM_EMAIL, // debe ser un remitente verificado en SendGrid
      replyTo: { email, name: nombre },
      subject: `[Contacto Kohtun] ${asunto}`,
      text: `Nombre: ${nombre}\nEmail: ${email}\nAsunto: ${asunto}\n\n${mensaje}`,
      html: plantilla({ nombre, email, asunto, mensaje }),
    })
    return { ok: true }
  } catch (err) {
    const detalle = err?.response?.body?.errors?.[0]?.message || err.message
    console.error('[emailService] Error al enviar contacto:', detalle)
    return { ok: false, error: detalle }
  }
}

function plantillaActivacion({ nombre, link }) {
  return `
  <div style="font-family:'Segoe UI',system-ui,sans-serif;max-width:600px;margin:0 auto;background:#f6f8fb;padding:0 0 24px">
    <div style="background:#1e3a5f;color:#fff;padding:20px 24px">
      <h1 style="margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em">Kohtun</h1>
      <p style="margin:4px 0 0;color:#c9d6e6;font-size:13px">Activa tu cuenta</p>
    </div>
    <div style="padding:24px;color:#334155;font-size:14px;line-height:1.6">
      <p style="margin:0 0 12px">Hola${nombre ? ' ' + escapeHtml(nombre) : ''},</p>
      <p style="margin:0 0 16px">Tu profesional te ha añadido a Kohtun. Para acceder, crea tu propia contraseña activando tu cuenta:</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px;font-size:15px">Activar mi cuenta</a>
      </p>
      <p style="margin:0 0 8px;color:#64748b;font-size:13px">O copia este enlace en tu navegador:</p>
      <p style="margin:0;word-break:break-all;color:#1e3a5f;font-size:13px">${escapeHtml(link)}</p>
      <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Este enlace caduca en 24 horas. Si no esperabas este correo, puedes ignorarlo.</p>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin:8px 0 0">© 2026 Kohtun</p>
  </div>`
}

/**
 * Envía el email de activación de cuenta a un cliente importado.
 * @param {{ correo: string, nombre?: string, link: string }} params
 * @returns {Promise<{ok:true}|{ok:false,error:string}>}
 */
export async function enviarEmailActivacion({ correo, nombre, link }) {
  const { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL } = process.env
  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
    return { ok: false, error: 'SendGrid no está configurado (faltan variables de entorno).' }
  }

  sgMail.setApiKey(SENDGRID_API_KEY)
  try {
    await sgMail.send({
      to: correo,
      from: SENDGRID_FROM_EMAIL, // remitente verificado en SendGrid
      subject: 'Activa tu cuenta en Kohtun',
      text: `Hola${nombre ? ' ' + nombre : ''},\n\nTu profesional te ha añadido a Kohtun. Crea tu contraseña activando tu cuenta en este enlace (caduca en 24 h):\n${link}\n\nSi no esperabas este correo, puedes ignorarlo.`,
      html: plantillaActivacion({ nombre, link }),
    })
    return { ok: true }
  } catch (err) {
    const detalle = err?.response?.body?.errors?.[0]?.message || err.message
    console.error('[emailService] Error al enviar activación:', detalle)
    return { ok: false, error: detalle }
  }
}

export default { enviarEmailContacto, enviarEmailActivacion }
