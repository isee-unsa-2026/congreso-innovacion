// Validación y envío de formularios de inscripción. Sin dependencias.
// No guarda datos personales en localStorage ni en la URL.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TEL = /^[0-9+()\-.\s]{6,25}$/;
// Celular: 9 dígitos de Perú que empiezan con 9 (con o sin +51) o número internacional con + y 8-15 dígitos.
// Debe coincidir con CEL_RE en apps-script/Code.gs.
const CEL = /^(?:(?:\+?51)?9\d{8}|\+\d{8,15})$/;
const normalizarCel = (v) => v.replace(/[\s\-().]/g, '');
const MAX_POR_DEFECTO = 300;

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
    return campo.tagName === 'SELECT' ? 'Selecciona una opción.' : 'Este campo es obligatorio.';
  }
  if (valor === '') return '';
  const max = Number(campo.getAttribute('maxlength')) || MAX_POR_DEFECTO;
  if (valor.length > max) return `Máximo ${max} caracteres.`;
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
      camposDe(form).forEach((c) => marcar(c, ''));
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
      const n = total === 1 ? 'Hay 1 campo con error' : `Hay ${total} campos con error`;
      mostrar('error', `${n}. Empieza por: ${etiquetaDe(primero)}.`);
      primero.focus();
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
  });
}

document.querySelectorAll('form[data-form]').forEach(iniciar);
