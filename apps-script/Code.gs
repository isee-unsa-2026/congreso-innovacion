/**
 * Registro de inscripciones - Congreso de Innovación en Minería (BLASTING DAYS 2026), ISEE UNSA.
 * Script vinculado a una hoja de cálculo (Extensiones > Apps Script).
 * No contiene credenciales: escribe en la hoja a la que está vinculado.
 * Implementar como aplicación web: ejecutar como "Yo", acceso "Cualquier persona".
 *
 * Formularios: "asistencia" (src/pages/inscripciones.astro, hoja "Asistencia") e
 * "innomining" (src/pages/reto/inscripcion.astro, hoja "InnoMining equipos").
 * Las listas de valores permitidos deben coincidir con las opciones de esas páginas:
 * TIPOS_ASISTENTE con inscripciones.astro; LINEAS, CARRERAS y CICLOS con "lineas",
 * "carreras" y "ciclos" de src/data/reto.json (bases oficiales de InnoMining).
 */

var MAX_LEN = 2400;       // tope por campo (los resúmenes de InnoMining son los más largos)
var MAX_TOTAL = 12000;      // caracteres sumados de todos los valores
var MAX_BODY = 30000;       // tamaño máximo del cuerpo crudo
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
var LINEAS = [
  'Optimización de la fragmentación y del diseño y desempeño de las voladuras',
  'Seguridad en operaciones de perforación y voladura',
  'Instrumentación, sensores, monitoreo y automatización',
  'Digitalización, inteligencia artificial, análisis de datos y modelos predictivos',
  'Control de vibraciones, ruido, polvo, gases y otros impactos ambientales',
  'Productividad, costos y eficiencia operacional',
  'Geología y geomecánica aplicadas al comportamiento del macizo rocoso',
  'Relación entre la fragmentación y los procesos posteriores: carguío, acarreo, chancado y molienda',
  'Otras líneas relacionadas con la minería, previa aceptación del Comité Organizador'
];
var CARRERAS = [
  'Ingeniería de Minas', 'Ingeniería Geológica', 'Ingeniería Geofísica', 'Ingeniería Metalúrgica',
  'Ingeniería de Materiales', 'Ingeniería Química', 'Ingeniería Mecánica', 'Ingeniería Eléctrica',
  'Ingeniería Electrónica', 'Ingeniería de Sistemas', 'Ciencia de la Computación', 'Ingeniería Industrial',
  'Ingeniería Ambiental', 'Ingeniería Civil', 'Ingeniería Sanitaria', 'Física', 'Química', 'Matemáticas', 'Otra'
];
var CICLOS = ['4.º semestre', '5.º semestre', '6.º semestre', '7.º semestre', '8.º semestre',
  '9.º semestre', '10.º semestre', 'Egresado'];
var MINAS = 'Ingeniería de Minas';

// Cada campo: [clave, encabezado, obligatorio, longitudMaxima, tipo, valoresPermitidos]
// Tipos: email, tel, cel, url, si, enum, solo_si [campo, valor], palabras [máximo].
function integrante_(n) {
  var p = 'i' + n + '_', e = 'I' + n + ' ';
  return [
    [p + 'nombre', e + 'Apellidos y nombres', true, 120],
    [p + 'carrera', e + 'Carrera', true, 60, 'enum', CARRERAS],
    [p + 'carrera_otra', e + 'Carrera (otra)', false, 120, 'solo_si', [p + 'carrera', 'Otra']],
    [p + 'ciclo', e + 'Ciclo o condición', true, 20, 'enum', CICLOS],
    [p + 'codigo', e + 'Código UNSA', true, 20],
    [p + 'correo', e + 'Correo institucional', true, 160, 'email']
  ];
}

function contarPalabras_(texto) {
  var t = String(texto || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

// Reglas de conformación (bases, sección 4.2). Igual que reglasInnomining en src/scripts/forms.js.
function validarInnomining_(v) {
  var carreras = {}, codigos = {}, nCarreras = 0, nCodigos = 0, hayMinas = false;
  for (var n = 1; n <= 4; n++) {
    var c = v['i' + n + '_carrera'];
    var clave = c === 'Otra' ? 'Otra:' + v['i' + n + '_carrera_otra'].toLowerCase().replace(/\s+/g, ' ') : c;
    if (!carreras[clave]) { carreras[clave] = true; nCarreras++; }
    if (c === MINAS) hayMinas = true;
    var cod = v['i' + n + '_codigo'].toLowerCase();
    if (!codigos[cod]) { codigos[cod] = true; nCodigos++; }
  }
  if (nCarreras < 3) return 'El equipo debe tener integrantes de al menos 3 carreras distintas.';
  if (!hayMinas) return 'Al menos un integrante debe ser de ' + MINAS + '.';
  if (nCodigos < 4) return 'Cada integrante debe tener un código UNSA distinto.';
  return '';
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
  'InnoMining equipos': {
    formulario: 'innomining',
    clave_correo: 'i1_correo',
    validar: validarInnomining_,
    campos: [
      ['equipo', 'Equipo', true, 80],
      ['titulo', 'Título de la propuesta', true, 200],
      ['linea', 'Línea temática', true, 120, 'enum', LINEAS]
    ].concat(integrante_(1), [['coord_celular', 'Celular del coordinador (I1)', true, 25, 'cel']],
      integrante_(2), integrante_(3), integrante_(4), [
      ['docente_nombre', 'Docente asesor', true, 120],
      ['docente_correo', 'Correo del docente asesor', true, 160, 'email'],
      ['problema', 'Problema u oportunidad', true, 2000, 'palabras', 200],
      ['solucion', 'Solución propuesta', true, 2400, 'palabras', 250],
      ['acepta_bases', 'Acepta las bases', true, 2, 'si'],
      ['originalidad', 'Declaración de originalidad (Anexo 2)', true, 2, 'si'],
      ['consentimiento', 'Consentimiento de datos', true, 2, 'si']
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
    var valores = {};
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
        if (c[4] === 'palabras' && contarPalabras_(v) > c[5]) return salida_({ ok: false, error: c[1] + ': máximo ' + c[5] + ' palabras.' });
      }
      valores[c[0]] = v;
      if (c[0] === esquema.clave_correo) correoClave = v.toLowerCase();
      fila.push(neutralizar_(v));
    }

    if (esquema.validar) {
      var errorEquipo = esquema.validar(valores);
      if (errorEquipo) return salida_({ ok: false, error: errorEquipo });
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
