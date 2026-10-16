// Validación y envío de formularios de inscripción. Sin dependencias.
// No guarda datos personales en localStorage ni en la URL.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TEL = /^[0-9+()\-.\s]{6,25}$/;
// Celular: 9 dígitos de Perú que empiezan con 9 (con o sin +51) o número internacional con + y 8-15 dígitos.
// Debe coincidir con CEL_RE en apps-script/Code.gs.
const CEL = /^(?:(?:\+?51)?9\d{8}|\+\d{8,15})$/;
const normalizarCel = (v) => v.replace(/[\s\-().]/g, '');
const MAX_POR_DEFECTO = 300;

// Debe coincidir con contarPalabras_ en apps-script/Code.gs.
function contarPalabras(texto) {
  const t = String(texto || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

// Contador visible de palabras: <p class="contador" id="{id}-contador"> junto a un campo con data-max-palabras.
function iniciarContadores(form) {
  const campos = [...form.querySelectorAll('[data-max-palabras]')];
  const actualizar = (c) => {
    const el = form.querySelector('#' + CSS.escape(c.id + '-contador'));
    if (!el) return;
    const max = Number(c.dataset.maxPalabras);
    const n = contarPalabras(c.value);
    el.textContent = `${n} / ${max} palabras`;
    el.classList.toggle('contador--excede', n > max);
  };
  campos.forEach((c) => {
    c.addEventListener('input', () => actualizar(c));
    actualizar(c);
  });
  return () => campos.forEach(actualizar);
}

// Aviso no bloqueante: data-dominio-recomendado="unsa.edu.pe" y <p class="advertencia" id="{id}-aviso" hidden>.
function avisarDominio(campo) {
  const dominio = campo.dataset && campo.dataset.dominioRecomendado;
  if (!dominio) return;
  const el = campo.form.querySelector('#' + CSS.escape(campo.id + '-aviso'));
  if (!el) return;
  const v = campo.value.trim().toLowerCase();
  const mostrar = EMAIL.test(v) && !v.endsWith('@' + dominio);
  el.textContent = mostrar ? `Recomendado: usa el correo institucional @${dominio}. Puedes continuar con este.` : '';
  el.hidden = !mostrar;
}

// Reglas de conformación del equipo (data-reglas="innomining"). Deben coincidir con validarInnomining_ en Code.gs.
const MINAS = 'Ingeniería de Minas';
function claveCarrera(form, n) {
  const sel = form.elements.namedItem(`i${n}_carrera`);
  const v = sel ? sel.value.trim() : '';
  if (v !== 'Otra') return v;
  const otra = form.elements.namedItem(`i${n}_carrera_otra`);
  return 'Otra:' + (otra ? otra.value.trim().toLowerCase().replace(/\s+/g, ' ') : '');
}
function reglasInnomining(form) {
  const claves = [1, 2, 3, 4].map((n) => claveCarrera(form, n));
  const primera = form.elements.namedItem('i1_carrera');
  if (new Set(claves).size < 3) {
    return { campo: primera, mensaje: 'El equipo debe tener integrantes de al menos 3 carreras distintas.' };
  }
  if (!claves.includes(MINAS)) {
    return { campo: primera, mensaje: `Al menos un integrante debe ser de ${MINAS}.` };
  }
  const codigos = [1, 2, 3, 4].map((n) => (form.elements.namedItem(`i${n}_codigo`) || {}).value?.trim().toLowerCase());
  if (new Set(codigos).size < 4) {
    return { campo: form.elements.namedItem('i1_codigo'), mensaje: 'Cada integrante debe tener un código UNSA distinto: una persona solo puede integrar un equipo.' };
  }
  return null;
}
const REGLAS = { innomining: reglasInnomining };

function grupoRadio(campo) {
  return [...campo.form.querySelectorAll(`input[type="radio"][name="${CSS.escape(campo.name)}"]`)];
}

function errorEl(campo) {
  let el = campo.form.querySelector('#' + CSS.escape(campo.id + '-error'));
  if (!el && campo.type === 'radio') {
    const fs = campo.closest('fieldset');
    el = fs && fs.querySelector('.error');
  }
  return el;
}

function describir(campo, el, mostrar) {
  const ids = new Set((campo.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  if (mostrar) ids.add(el.id); else ids.delete(el.id);
  if (ids.size) campo.setAttribute('aria-describedby', [...ids].join(' '));
  else campo.removeAttribute('aria-describedby');
}

function marcar(campo, mensaje) {
  const grupo = campo.type === 'radio' ? grupoRadio(campo) : [campo];
  const el = errorEl(campo);
  grupo.forEach((c) => {
    if (mensaje) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
    if (el) describir(c, el, !!mensaje);
  });
  if (el) {
    el.textContent = mensaje || '';
    el.hidden = !mensaje;
  }
}

function validarCampo(campo) {
  if (campo.type === 'radio') {
    const g = grupoRadio(campo);
    return g.some((r) => r.required) && !g.some((r) => r.checked) ? 'Selecciona una opción.' : '';
  }
  if (campo.type === 'checkbox') {
    return campo.required && !campo.checked ? 'Debes aceptar este punto para continuar.' : '';
  }
  const valor = campo.value.trim();
  if (campo.required && valor === '') {
    return campo.tagName === 'SELECT' ? 'Selecciona una opción.' : 'Completa este campo.';
  }
  if (valor === '') return '';
  const max = Number(campo.getAttribute('maxlength')) || MAX_POR_DEFECTO;
  if (valor.length > max) return `Máximo ${max} caracteres.`;
  const maxPalabras = Number(campo.dataset.maxPalabras) || 0;
  if (maxPalabras && contarPalabras(valor) > maxPalabras) {
    return `Máximo ${maxPalabras} palabras (llevas ${contarPalabras(valor)}).`;
  }
  if (campo.type === 'email' && !EMAIL.test(valor)) return 'Escribe un correo válido, por ejemplo nombre@dominio.com.';
  if (campo.dataset.validar === 'celular') {
    return CEL.test(normalizarCel(valor)) ? '' : 'Escribe un celular válido: 9 dígitos que empiecen con 9 (p. ej. 987 654 321) o un número con + y código de país.';
  }
  if (campo.type === 'tel' && !TEL.test(valor)) return 'Escribe un teléfono válido con números, espacios o +.';
  if (campo.type === 'url') {
    try {
      const u = new URL(valor);
      if (!/^https?:$/.test(u.protocol)) throw new Error('protocolo');
    } catch {
      return 'Escribe un enlace válido que empiece con https://';
    }
  }
  return '';
}

// Los campos ocultos por una condición quedan deshabilitados: no se validan ni se envían.
function camposDe(form) {
  return [...form.querySelectorAll('input, select, textarea')].filter(
    (c) => !c.closest('.trampa') && !c.disabled
  );
}

// Campos condicionales: <div data-si-campo="tipo" data-si-valor="Estudiante" hidden> se muestra,
// habilita y vuelve obligatorio solo cuando el campo indicado tiene ese valor.
function iniciarCondicionales(form) {
  const bloques = [...form.querySelectorAll('[data-si-campo]')];
  if (!bloques.length) return () => {};
  const aplicar = () => {
    bloques.forEach((b) => {
      const control = form.elements.namedItem(b.dataset.siCampo);
      const visible = !!control && control.value === b.dataset.siValor;
      b.hidden = !visible;
      b.querySelectorAll('input, select, textarea').forEach((c) => {
        c.disabled = !visible;
        c.required = visible;
        if (visible) c.setAttribute('aria-required', 'true'); else c.removeAttribute('aria-required');
        if (!visible) { c.value = ''; marcar(c, ''); }
      });
    });
  };
  form.addEventListener('change', (ev) => {
    if (bloques.some((b) => ev.target.name === b.dataset.siCampo)) aplicar();
  });
  aplicar();
  return aplicar;
}

function etiquetaDe(campo) {
  const fs = campo.closest('fieldset');
  const leg = fs && fs.querySelector('legend');
  let el = null;
  if (campo.type === 'radio') {
    return leg ? leg.textContent.replace(/\s*\*\s*$/, '').trim() : campo.name;
  }
  el = campo.form.querySelector(`label[for="${CSS.escape(campo.id)}"]`);
  const t = el ? el.textContent.replace(/\s*\*\s*$/, '').trim() : campo.name;
  return fs && leg && fs.classList.contains('integrante') ? `${leg.textContent.trim()}: ${t}` : t;
}

function validarForm(form) {
  let primero = null;
  let total = 0;
  const vistos = new Set();
  camposDe(form).forEach((c) => {
    if (c.type === 'radio') {
      if (vistos.has(c.name)) return;
      vistos.add(c.name);
    }
    const msg = validarCampo(c);
    marcar(c, msg);
    if (msg) total += 1;
    if (msg && !primero) primero = c;
  });
  return { primero, total };
}

function recolectar(form, meta) {
  const datos = { formulario: form.dataset.form, id_envio: meta.id, t_carga: meta.t };
  new FormData(form).forEach((v, k) => {
    datos[k] = typeof v === 'string' ? v.trim() : '';
  });
  return datos;
}

function iniciar(form) {
  const estado = form.querySelector('[data-estado]');
  const boton = form.querySelector('button[type="submit"]');
  const etiquetaBoton = boton.textContent;
  let enviando = false;
  const nuevoId = () =>
    (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  const meta = { id: nuevoId(), t: Date.now() };
  const aplicarCondicionales = iniciarCondicionales(form);
  const actualizarContadores = iniciarContadores(form);
  const regla = REGLAS[form.dataset.reglas];
  const errorEquipo = form.querySelector('[data-error-equipo]');
  const marcarEquipo = (mensaje) => {
    if (!errorEquipo) return;
    errorEquipo.textContent = mensaje || '';
    errorEquipo.hidden = !mensaje;
  };

  // Éxito: mensaje + invitación al grupo oficial de WhatsApp (enlace en data-whatsapp).
  function mostrarExito() {
    mostrar('ok', 'Registro recibido. ¡Gracias!', false);
    const wa = (form.dataset.whatsapp || '').trim();
    if (!/^https:\/\/chat\.whatsapp\.com\//.test(wa)) return;
    const p = document.createElement('p');
    p.className = 'estado__wa';
    p.textContent = 'Únete al grupo de WhatsApp del congreso para recibir avisos, novedades y las bases.';
    const a = document.createElement('a');
    a.className = 'btn btn--wa';
    a.href = wa;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Unirme al grupo de WhatsApp';
    const sr = document.createElement('span');
    sr.className = 'sr';
    sr.textContent = ' (se abre en una pestaña nueva)';
    a.append(sr);
    estado.append(p, a);
    // Enlace secundario a Instagram (data-instagram y data-instagram-user).
    const ig = (form.dataset.instagram || '').trim();
    if (!/^https:\/\/www\.instagram\.com\//.test(ig)) return;
    const pi = document.createElement('p');
    pi.className = 'estado__ig';
    const ai = document.createElement('a');
    ai.href = ig;
    ai.target = '_blank';
    ai.rel = 'noopener';
    ai.textContent = `Síguenos también en Instagram (${form.dataset.instagramUser || ''})`;
    const sri = document.createElement('span');
    sri.className = 'sr';
    sri.textContent = ' (se abre en una pestaña nueva)';
    ai.append(sri);
    pi.append(ai);
    estado.append(pi);
  }

  function mostrar(tipo, texto, reintentar) {
    estado.className = 'estado' + (tipo ? ' estado--' + tipo : '');
    estado.textContent = '';
    // Éxito y errores fatales se anuncian como alerta y reciben el foco.
    const fuerte = tipo === 'ok' || (tipo === 'error' && reintentar !== undefined);
    if (fuerte) estado.setAttribute('role', 'alert'); else estado.setAttribute('role', 'status');
    const p = document.createElement('p');
    p.textContent = texto;
    estado.append(p);
    if (reintentar) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn--sec';
      b.textContent = 'Reintentar envío';
      b.addEventListener('click', () => enviar());
      estado.append(b);
    }
    if (fuerte) estado.focus();
  }

  function limpiarEstado() {
    estado.textContent = '';
    estado.className = 'estado-region';
    estado.setAttribute('role', 'status');
  }

  function bloquear(si) {
    enviando = si;
    boton.setAttribute('aria-disabled', String(si));
    boton.textContent = si ? 'Enviando…' : etiquetaBoton;
    form.setAttribute('aria-busy', String(si));
  }

  async function enviar() {
    if (enviando) return;
    const endpoint = (form.dataset.endpoint || '').trim();
    if (!endpoint) {
      mostrar(
        'error',
        'Modo de prueba: el formulario aún no está conectado a la hoja de registro. Tus datos no se han enviado ni guardado. Inténtalo más adelante.',
        false
      );
      return;
    }
    bloquear(true);
    mostrar('', 'Enviando tu registro…');
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(recolectar(form, meta)),
        redirect: 'follow',
      });
      if (!resp.ok) throw new Error('http ' + resp.status);
      const json = await resp.json();
      if (!json || json.ok !== true) {
        mostrar('error', (json && json.error) || 'El servidor no pudo registrar los datos.', true);
        return;
      }
      form.reset();
      aplicarCondicionales();
      actualizarContadores();
      marcarEquipo('');
      camposDe(form).forEach((c) => { marcar(c, ''); avisarDominio(c); });
      meta.id = nuevoId();
      meta.t = Date.now();
      mostrarExito();
    } catch (e) {
      mostrar('error', 'No pudimos enviar el formulario. Revisa tu conexión e inténtalo de nuevo. Tus datos siguen en el formulario.', true);
    } finally {
      bloquear(false);
    }
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (enviando) return;
    // Honeypot: un bot rellenó el campo; se simula recepción sin enviar.
    const trampa = form.querySelector('.trampa input');
    if (trampa && trampa.value !== '') {
      mostrarExito();
      return;
    }
    const { primero, total } = validarForm(form);
    if (primero) {
      marcarEquipo('');
      const n = total === 1 ? 'Hay 1 campo con error' : `Hay ${total} campos con error`;
      mostrar('error', `${n}. Empieza por: ${etiquetaDe(primero)}.`);
      primero.focus();
      return;
    }
    const fallo = regla && regla(form);
    marcarEquipo(fallo ? fallo.mensaje : '');
    if (fallo) {
      mostrar('error', fallo.mensaje);
      if (fallo.campo) fallo.campo.focus();
      return;
    }
    limpiarEstado();
    enviar();
  });

  const revalidar = (ev) => {
    const c = ev.target;
    if (c.matches && c.matches('input, select, textarea') && !c.closest('.trampa')
        && c.getAttribute('aria-invalid') === 'true') {
      marcar(c, validarCampo(c));
    }
  };
  form.addEventListener('input', revalidar);
  form.addEventListener('change', revalidar);
  form.addEventListener('focusout', (ev) => {
    const c = ev.target;
    if (c.matches && c.matches('input:not([type="radio"]):not([type="checkbox"]), select, textarea')
        && !c.closest('.trampa') && c.value.trim() !== '') {
      marcar(c, validarCampo(c));
    }
    if (c.matches && c.matches('input[type="email"]')) avisarDominio(c);
  });
}

document.querySelectorAll('form[data-form]').forEach(iniciar);
