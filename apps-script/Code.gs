/**
 * Registro de inscripciones - Congreso de Innovación en Minería (BLASTING DAYS 2026), ISEE UNSA.
 * Script vinculado a una hoja de cálculo (Extensiones > Apps Script).
 * No contiene credenciales: escribe en la hoja a la que está vinculado.
 * Implementar como aplicación web: ejecutar como "Yo", acceso "Cualquier persona".
 *
 * Las listas de valores permitidos (TIPOS_ASISTENTE, CONDICIONES, DESAFIOS...) deben
 * coincidir con las opciones de src/pages/inscripciones.astro. DESAFIOS sale de
 * "desafios" en src/data/site.json (concurso INNOMINING).
 */

var MAX_LEN = 500;
var MAX_TOTAL = 8000;       // caracteres sumados de todos los valores
var MAX_BODY = 20000;       // tamaño máximo del cuerpo crudo
var MIN_SEGUNDOS = 3;       // un envío más rápido se considera automatizado
var VENTANA_DEDUP_S = 6 * 60 * 60; // 6 horas (máximo de CacheService)
var LIMITE_POR_MINUTO = 30; // envíos globales aceptados por minuto

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
var TEL_RE = /^[0-9+()\-.\s]{6,25}$/;
var URL_RE = /^https?:\/\/\S+$/;
// Celular: 9 dígitos de Perú que empiezan con 9 (con o sin +51) o internacional con + y 8-15 dígitos.
// Se valida tras quitar espacios, guiones, puntos y paréntesis (igual que src/scripts/forms.js).
var CEL_RE = /^(?:(?:\+?51)?9\d{8}|\+\d{8,15})$/;

var TIPOS_ASISTENTE = ['Estudiante', 'Egresado', 'Docente', 'Profesional de la industria', 'Otro'];
var CONDICIONES = ['Estudiante', 'Egresado'];
var SI_NO = ['si', 'no'];
var DESAFIOS = [
  'Por definir (los desafíos se publicarán con las bases)'
];

// Cada campo: [clave, encabezado, obligatorio, longitudMaxima, tipo, valoresPermitidos]
function integrante_(n) {
  var p = 'i' + n + '_', e = 'I' + n + ' ';
  return [
    [p + 'nombre', e + 'Nombre', true, 120],
    [p + 'correo', e + 'Correo', true, 160, 'email'],
    [p + 'carrera', e + 'Carrera', true, 120],
    [p + 'condicion', e + 'Condición', true, 20, 'enum', CONDICIONES],
    [p + 'codigo', e + 'Código/año', true, 30]
  ];
}

var ESQUEMAS = {
  Asistencia: {
    formulario: 'asistencia',
    clave_correo: 'correo',
    campos: [
      ['nombre', 'Nombre completo', true, 120],
      ['correo', 'Correo electrónico', true, 160, 'email'],
      ['celular', 'Número de celular', true, 25, 'cel'],
      ['tipo', 'Tipo de asistente', true, 40, 'enum', TIPOS_ASISTENTE],
      ['carrera', 'Carrera', true, 120],
      ['institucion', 'Institución', true, 150],
      // Obligatorio solo si Tipo de asistente = Estudiante; en otro caso se guarda vacío.
      ['anio_semestre', 'Año o semestre', false, 30, 'solo_si', ['tipo', 'Estudiante']],
      ['consentimiento', 'Consentimiento', true, 2, 'si']
    ]
  },
  Reto: {
    formulario: 'reto',
    clave_correo: 'i1_correo',
    campos: [['equipo', 'Equipo', true, 80]]
      .concat(integrante_(1), integrante_(2), integrante_(3), integrante_(4), [
        ['vinculo_unsa', 'Vínculo UNSA', true, 500],
        ['perfil_minero', 'Perfil minero', true, 2, 'enum', SI_NO],
        ['docente_tutor', 'Docente tutor', false, 200],
        ['desafio', 'Desafío', true, 100, 'enum', DESAFIOS],
        ['enlace_documentos', 'Enlace documentos', false, 300, 'url'],
        ['acepta_bases', 'Pre-inscripción sujeta a bases', true, 2, 'si'],
        ['consentimiento', 'Consentimiento', true, 2, 'si'],
        ['autorizacion_equipo', 'Autorización del equipo', true, 2, 'si']
      ])
  }
};

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return salida_({ ok: false, error: 'Solicitud vacía.' });
    if (e.postData.contents.length > MAX_BODY) return salida_({ ok: false, error: 'Solicitud demasiado grande.' });

    var datos;
    try { datos = JSON.parse(e.postData.contents); }
    catch (err) { return salida_({ ok: false, error: 'Formato no válido.' }); }
    if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) {
      return salida_({ ok: false, error: 'Formato no válido.' });
    }

    // Honeypot: se descarta en silencio.
    if (datos.contacto_alterno) return salida_({ ok: true });

    var hoja = null;
    for (var nombre in ESQUEMAS) {
      if (ESQUEMAS[nombre].formulario === datos.formulario) hoja = nombre;
    }
    if (!hoja) return salida_({ ok: false, error: 'Formulario desconocido.' });

    // Tiempo mínimo desde la carga de la página (diferencias negativas por
    // reloj desajustado del cliente no se rechazan).
    var t = Number(datos.t_carga);
    if (!isFinite(t) || t <= 0) return salida_({ ok: false, error: 'Solicitud no válida.' });
    var transcurrido = Date.now() - t;
    if (transcurrido >= 0 && transcurrido < MIN_SEGUNDOS * 1000) {
      return salida_({ ok: false, error: 'Envío demasiado rápido. Inténtalo de nuevo.' });
    }

    var idEnvio = String(datos.id_envio == null ? '' : datos.id_envio);
    if (!/^[A-Za-z0-9-]{8,64}$/.test(idEnvio)) return salida_({ ok: false, error: 'Solicitud no válida.' });

    var esquema = ESQUEMAS[hoja];
    var fila = [new Date()];
    var total = 0;
    var correoClave = '';
    for (var i = 0; i < esquema.campos.length; i++) {
      var c = esquema.campos[i];
      var bruto = datos[c[0]];
      if (bruto != null && typeof bruto !== 'string' && typeof bruto !== 'number') {
        return salida_({ ok: false, error: 'Campo no válido: ' + c[1] + '.' });
      }
      var v = bruto == null ? '' : String(bruto).trim();
      if (c[4] === 'solo_si') {
        var aplica = String(datos[c[5][0]] == null ? '' : datos[c[5][0]]).trim() === c[5][1];
        if (!aplica) v = '';
        else if (v === '') return salida_({ ok: false, error: 'Falta el campo: ' + c[1] + '.' });
      }
      if (c[2] && v === '') return salida_({ ok: false, error: 'Falta el campo: ' + c[1] + '.' });
      if (v.length > Math.min(c[3] || MAX_LEN, MAX_LEN)) return salida_({ ok: false, error: 'Campo demasiado largo: ' + c[1] + '.' });
      total += v.length;
      if (total > MAX_TOTAL) return salida_({ ok: false, error: 'Solicitud demasiado grande.' });
      if (v !== '') {
        if (c[4] === 'email' && !EMAIL_RE.test(v)) return salida_({ ok: false, error: 'Correo no válido: ' + c[1] + '.' });
        if (c[4] === 'tel' && !TEL_RE.test(v)) return salida_({ ok: false, error: 'Teléfono no válido.' });
        if (c[4] === 'cel' && !CEL_RE.test(v.replace(/[\s\-().]/g, ''))) return salida_({ ok: false, error: 'Número de celular no válido.' });
        if (c[4] === 'url' && !URL_RE.test(v)) return salida_({ ok: false, error: 'Enlace no válido.' });
        if (c[4] === 'si' && v !== 'si') return salida_({ ok: false, error: 'Falta aceptar: ' + c[1] + '.' });
        if (c[4] === 'enum' && c[5].indexOf(v) === -1) return salida_({ ok: false, error: 'Valor no válido: ' + c[1] + '.' });
      }
      if (c[0] === esquema.clave_correo) correoClave = v.toLowerCase();
      fila.push(neutralizar_(v));
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var cache = CacheService.getScriptCache();
      var kId = 'id:' + idEnvio;
      var kCorreo = 'co:' + hash_(esquema.formulario + '|' + correoClave);
      // Duplicados: se responde éxito sin escribir otra fila.
      if (cache.get(kId) || cache.get(kCorreo)) return salida_({ ok: true });

      // Contador global por minuto.
      var kMin = 'rl:' + Math.floor(Date.now() / 60000);
      var cuenta = Number(cache.get(kMin)) || 0;
      if (cuenta >= LIMITE_POR_MINUTO) {
        return salida_({ ok: false, error: 'Hay muchas solicitudes en este momento. Inténtalo en unos minutos.' });
      }
      cache.put(kMin, String(cuenta + 1), 120);

      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var cab = ['Marca de tiempo'];
      for (var j = 0; j < esquema.campos.length; j++) cab.push(esquema.campos[j][1]);
      var sh = ss.getSheetByName(hoja);
      // Si la hoja existe con otras columnas (versión anterior del formulario), no se mezclan
      // datos: se escribe en "<hoja> v2" con los encabezados actuales.
      if (sh && sh.getLastRow() > 0) {
        var actual = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].join('|');
        if (actual !== cab.join('|')) sh = ss.getSheetByName(hoja + ' v2') || ss.insertSheet(hoja + ' v2');
      }
      if (!sh) sh = ss.insertSheet(hoja);
      if (sh.getLastRow() === 0) {
        sh.appendRow(cab);
        sh.setFrozenRows(1);
      }
      // Texto plano en las columnas de datos (todas menos la marca de tiempo).
      sh.getRange(sh.getLastRow() + 1, 2, 1, fila.length - 1).setNumberFormat('@');
      sh.appendRow(fila);

      cache.put(kId, '1', VENTANA_DEDUP_S);
      cache.put(kCorreo, '1', VENTANA_DEDUP_S);
    } finally {
      lock.releaseLock();
    }
    return salida_({ ok: true });
  } catch (err) {
    // Sin datos personales: solo el mensaje técnico.
    console.error('doPost: ' + (err && err.message ? err.message : 'error desconocido'));
    return salida_({ ok: false, error: 'No se pudo registrar. Inténtalo de nuevo.' });
  }
}

// Quita caracteres de control y evita que una celda se interprete como fórmula.
function neutralizar_(v) {
  var limpio = String(v).replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').trim();
  return /^[\s=+\-@]/.test(limpio) ? "'" + limpio : limpio;
}

function hash_(texto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes);
}

function salida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
