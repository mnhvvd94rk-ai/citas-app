// i18n de mensajes de API que el usuario ve directamente (errores/validación de las
// rutas del profesional). Se eligen por `req.lang` (cabecera X-Lang que envía el
// frontend con el idioma activo de la UI; ver langMiddleware). Fallback: ES.
//
// Alcance actual: rutas del PROFESIONAL (agenda/citas/disponibilidad/perfil/notas/
// clientes). Los mensajes de cara al cliente (auth/registro/activación) se
// traducirán en una fase posterior.

export const IDIOMAS = ['ES', 'EN', 'FR']

const MESSAGES = {
  ES: {
    'error.datosInvalidos': 'Datos inválidos',
    'error.sinProfesional': 'Tu cuenta no está vinculada a ningún profesional.',
    'error.profesionalNoEncontrado': 'Profesional no encontrado',
    'error.enlaceNoEncontrado': 'Enlace de registro no encontrado',
    'error.enlaceVacio': 'El enlace no puede quedar vacío',
    'error.slugYaEditado': 'Tu enlace ya se editó una vez y no puede volver a cambiarse.',
    'error.slugOcupado': 'Ese enlace ya está en uso. Elige otro.',
    'error.fechaObligatoria': 'fecha es obligatoria (YYYY-MM-DD)',
    'error.mesObligatorio': 'mes es obligatorio (YYYY-MM)',
    'error.pacienteNoEncontrado': 'Paciente no encontrado',
    'error.noReservarProfesional': 'No puedes reservar con este profesional.',
    'error.motivoRequerido': 'Un paciente nuevo debe indicar el motivo de consulta',
    'error.clienteNoEncontrado': 'Cliente no encontrado',
    'error.clienteAjeno': 'Este cliente no te pertenece',
    'error.horaTardia': 'La hora es demasiado tarde para esa duración.',
    'error.horarioSolapado': 'Ese horario se solapa con otra cita existente.',
    'error.idInvalido': 'id inválido',
    'error.pacienteIdInvalido': 'pacienteId inválido',
    'error.citaNoEncontrada': 'Cita no encontrada',
    'error.citaAjena': 'Esta cita no te pertenece',
    'error.soloCancelar': 'Solo puedes cancelar citas PENDIENTE o CONFIRMADA (estado actual: {estado})',
    'error.soloAprobar': 'Solo se pueden aprobar citas PENDIENTE (estado actual: {estado})',
    'error.soloAnular': 'Solo se pueden anular citas PENDIENTE o CONFIRMADA (estado actual: {estado})',
    'error.soloCompletar': 'Solo se pueden completar citas CONFIRMADA (estado actual: {estado})',
    'error.dispNoEncontrada': 'Disponibilidad no encontrada',
    'error.dispAjena': 'Esta disponibilidad no te pertenece',
    'error.dispConCitas':
      'No se puede eliminar: hay {ocupados} slot(s) con citas activas (PENDIENTE o CONFIRMADA) dentro de este rango.',
    'error.clienteConCitas': 'Este cliente tiene citas pendientes. Cancélalas primero.',
  },
  EN: {
    'error.datosInvalidos': 'Invalid data',
    'error.sinProfesional': 'Your account is not linked to any professional.',
    'error.profesionalNoEncontrado': 'Professional not found',
    'error.enlaceNoEncontrado': 'Registration link not found',
    'error.enlaceVacio': 'The link cannot be empty',
    'error.slugYaEditado': 'Your link was already changed once and cannot be changed again.',
    'error.slugOcupado': 'That link is already in use. Choose another one.',
    'error.fechaObligatoria': 'date is required (YYYY-MM-DD)',
    'error.mesObligatorio': 'month is required (YYYY-MM)',
    'error.pacienteNoEncontrado': 'Patient not found',
    'error.noReservarProfesional': 'You cannot book with this professional.',
    'error.motivoRequerido': 'A new patient must state the reason for the visit',
    'error.clienteNoEncontrado': 'Client not found',
    'error.clienteAjeno': 'This client does not belong to you',
    'error.horaTardia': 'The time is too late for that duration.',
    'error.horarioSolapado': 'That time overlaps with an existing appointment.',
    'error.idInvalido': 'invalid id',
    'error.pacienteIdInvalido': 'invalid pacienteId',
    'error.citaNoEncontrada': 'Appointment not found',
    'error.citaAjena': 'This appointment does not belong to you',
    'error.soloCancelar': 'You can only cancel PENDING or CONFIRMED appointments (current status: {estado})',
    'error.soloAprobar': 'Only PENDING appointments can be approved (current status: {estado})',
    'error.soloAnular': 'Only PENDING or CONFIRMED appointments can be cancelled (current status: {estado})',
    'error.soloCompletar': 'Only CONFIRMED appointments can be completed (current status: {estado})',
    'error.dispNoEncontrada': 'Availability not found',
    'error.dispAjena': 'This availability does not belong to you',
    'error.dispConCitas':
      'Cannot delete: there are {ocupados} slot(s) with active appointments (PENDING or CONFIRMED) within this range.',
    'error.clienteConCitas': 'This client has pending appointments. Cancel them first.',
  },
  FR: {
    'error.datosInvalidos': 'Données invalides',
    'error.sinProfesional': "Votre compte n'est lié à aucun professionnel.",
    'error.profesionalNoEncontrado': 'Professionnel introuvable',
    'error.enlaceNoEncontrado': "Lien d'inscription introuvable",
    'error.enlaceVacio': 'Le lien ne peut pas être vide',
    'error.slugYaEditado': 'Votre lien a déjà été modifié une fois et ne peut plus être changé.',
    'error.slugOcupado': 'Ce lien est déjà utilisé. Choisissez-en un autre.',
    'error.fechaObligatoria': 'la date est obligatoire (AAAA-MM-JJ)',
    'error.mesObligatorio': 'le mois est obligatoire (AAAA-MM)',
    'error.pacienteNoEncontrado': 'Patient introuvable',
    'error.noReservarProfesional': 'Vous ne pouvez pas réserver avec ce professionnel.',
    'error.motivoRequerido': 'Un nouveau patient doit indiquer le motif de la consultation',
    'error.clienteNoEncontrado': 'Client introuvable',
    'error.clienteAjeno': 'Ce client ne vous appartient pas',
    'error.horaTardia': "L'heure est trop tardive pour cette durée.",
    'error.horarioSolapado': 'Cet horaire chevauche un rendez-vous existant.',
    'error.idInvalido': 'id invalide',
    'error.pacienteIdInvalido': 'pacienteId invalide',
    'error.citaNoEncontrada': 'Rendez-vous introuvable',
    'error.citaAjena': 'Ce rendez-vous ne vous appartient pas',
    'error.soloCancelar':
      'Vous ne pouvez annuler que des rendez-vous EN ATTENTE ou CONFIRMÉS (statut actuel : {estado})',
    'error.soloAprobar': 'Seuls les rendez-vous EN ATTENTE peuvent être approuvés (statut actuel : {estado})',
    'error.soloAnular':
      'Seuls les rendez-vous EN ATTENTE ou CONFIRMÉS peuvent être annulés (statut actuel : {estado})',
    'error.soloCompletar': 'Seuls les rendez-vous CONFIRMÉS peuvent être terminés (statut actuel : {estado})',
    'error.dispNoEncontrada': 'Disponibilité introuvable',
    'error.dispAjena': 'Cette disponibilité ne vous appartient pas',
    'error.dispConCitas':
      'Suppression impossible : il y a {ocupados} créneau(x) avec des rendez-vous actifs (EN ATTENTE ou CONFIRMÉS) dans cette plage.',
    'error.clienteConCitas': 'Ce client a des rendez-vous en attente. Annulez-les d’abord.',
  },
}

/**
 * Traduce una clave de mensaje al idioma dado (fallback ES → clave). Soporta
 * interpolación de {vars}. Se usa en las rutas como `tr(req.lang, 'error.xxx')`.
 */
export function tr(lang, key, vars) {
  const table = MESSAGES[lang] || MESSAGES.ES
  let msg = table[key] ?? MESSAGES.ES[key] ?? key
  if (vars) msg = msg.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`))
  return msg
}
