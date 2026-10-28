# Primer Congreso de Innovación en Minería · InnoMining ISEE UNSA 2026

Organiza ISEE UNSA (Student Chapter); sede anfitriona: Universidad Nacional de San Agustín de Arequipa. 18 y 19 de noviembre de 2026, Arequipa, ingreso gratuito. "InnoMining · ISEE UNSA" es la línea pequeña (kicker) sobre el título; en el hero se destaca "Primer" en cobre.

Sitio estático hecho con [Astro](https://astro.build). Incluye el congreso, ponentes confirmados (sin días ni horarios) y el concurso **INNOMINING** (Concurso de Investigación y Soluciones en Voladura, ruta `/reto/`), con dos registros: asistencia (todo público) y postulación de equipos (estudiantes y egresados UNSA).

## Cómo correr

```bash
npm install
npm run dev      # servidor local en http://localhost:4321
npm run build    # genera el sitio estático en dist/
npm run preview  # sirve dist/ para revisarlo
```

## Cómo editar el contenido

El contenido vive en `src/data/`:

- `site.json`: nombre del evento (`name`), marca pequeña (`kicker`, `brand`, `year`), concurso (`retoName`, `retoFullName`), empresas con su logo (`empresas`: nombre, alt, ruta del logo y proporciones; si falta el archivo se muestra el nombre en texto), opciones de desafío del formulario (`desafios`), enlace del grupo de WhatsApp (`whatsapp`), fechas, sede, navegación, correo de contacto y `formsEndpoint`.
- `programa.json`: borrador del programa (la página `/programa/` solo muestra "se publicará próximamente").
- `ponentes.json`: ponentes confirmados (título, nombre, cargo, organización, foto WebP en `public/img/ponentes/` y logo). Sin foto, la tarjeta muestra un monograma con las iniciales. No poner días ni horarios.
- `reto.json`: INNOMINING (resumen, qué harán los equipos, importancia, reconocimiento, entregables, requisitos y etapas).

- `imagenes.json`: todas las imágenes del sitio (clave → ruta + texto alternativo). Ver "Cambiar imágenes".

Las páginas están en `src/pages/`, los componentes compartidos (cabecera, pie, banner, acordeón) en `src/components/`, los estilos en `src/styles/global.css` y la lógica de formularios en `src/scripts/forms.js`.

## Estilo

Ingeniería formal y editorial: esquinas rectas (radios de 2–4 px), reglas finas, etiquetas en mayúsculas con marcador cuadrado, sin pastillas. Fondos oscuros (`#121315`) y blancos, acento granate (`#5E151D`) y cobre (`#C5A45D`) como detalle. Tipografía única Archivo Variable (titulares, texto y etiquetas en mayúsculas con tracking), autoalojada con `@fontsource-variable/archivo`. El wordmark INNOMINING usa "INNO" en cobre y "MINING" en blanco (clases `.wordmark` y `.wordmark__inno`). Los colores y tamaños son tokens en `:root` de `src/styles/global.css`.

## Logo de la UNSA (institución anfitriona)

La cabecera, el pie y `/organizacion/` muestran el logo de la UNSA a la derecha del de ISEE UNSA (separado por una línea vertical fina) **solo si existe** `public/brand/unsa-logo.png` (se comprueba con `fs.existsSync` al compilar). Si el archivo no está, no se muestra nada ni queda hueco.

Para añadirlo o reemplazarlo:

1. Usa el logo oficial autorizado, en PNG (o SVG convertido a PNG) con **fondo transparente**, de unos **200 px de alto** (p. ej. 206 × 256).
2. Guárdalo exactamente como `public/brand/unsa-logo.png`.
3. Si cambian sus proporciones, actualiza `width`/`height` en `src/components/Header.astro` y `src/components/Footer.astro`.
4. Ejecuta `npm run build`.

ISEE UNSA va primero porque es el organizador; la UNSA figura como sede anfitriona.

## Cambiar imágenes

Las imágenes viven en `public/img/fotos/` y se registran en `src/data/imagenes.json`. Para reemplazar una, sobrescribe el archivo con el mismo nombre (o cambia la ruta y el `alt` en el JSON); no hay que tocar las páginas.

| Clave | Archivo | Tamaño recomendado | Uso |
| --- | --- | --- | --- |
| `hero` | `hero.jpg` | 1920 × 900 | Portada, a todo el ancho |
| `congreso`, `reto`, `ponentes` | `card-congreso.jpg`, `card-reto.jpg`, `card-ponentes.jpg` | 800 × 600 | Tarjetas de la portada |
| `banner` | `banner.jpg` | 1920 × 420 | Franja de las páginas internas |

- Formato JPG o WebP, **máximo ~250 KB por imagen** (calidad 75–80 suele bastar).
- Si cambias las proporciones, actualiza `width` y `height` en el JSON para evitar saltos de diseño.
- El `alt` del banner está vacío a propósito (es decorativo); en las demás, describe la foto.
- La foto de origen es `public/brand/foto-original.webp`; los recortes se hicieron evitando las marcas de agua de las esquinas.

La portada usa solo la foto `hero.jpg` con velo oscuro y una entrada suave (acercamiento lento de la foto y textos en cascada); no hay video ni pantalla de introducción.

## Grupo de WhatsApp

El enlace del grupo oficial está en `site.json` (`whatsapp`). Se usa en el botón flotante de todas las páginas (`src/components/WhatsAppFlotante.astro`), en el bloque destacado de `/inscripciones/` (`WhatsAppBloque.astro`) y en el mensaje de registro exitoso de ambos formularios (atributo `data-whatsapp` del formulario, leído por `forms.js`). Para cambiarlo, edita solo `site.json`. Es un enlace normal (`target="_blank" rel="noopener"`): la CSP de `public/_headers` no necesita cambios.

## Conectar los formularios a una hoja de Google

1. Crea una hoja de cálculo nueva en Google Sheets (por ejemplo, "Inscripciones ISEE UNSA 2026").
2. Abre **Extensiones > Apps Script**.
3. Borra el contenido del editor y pega todo el archivo `apps-script/Code.gs`. Guarda.
4. Pulsa **Implementar > Nueva implementación**, tipo **Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier persona**.
5. Autoriza los permisos cuando Google lo pida y copia la **URL de la aplicación web** (termina en `/exec`).
6. Pega esa URL en `src/data/site.json`, en el campo `formsEndpoint`.
7. Ejecuta `npm run build` y publica de nuevo.
8. Prueba enviando un registro de cada formulario: deben aparecer las hojas "Asistencia" e "InnoMining equipos" con marca de tiempo.

### Columnas de cada hoja

La primera fila se escribe sola en el primer registro. Si una hoja ya existía con otras columnas (versión anterior del formulario), el script no mezcla datos: escribe en una hoja nueva "Asistencia v2" o "InnoMining equipos v2".

**Asistencia** (formulario de asistencia, todo público):

| # | Columna | Obligatorio | Validación |
| --- | --- | --- | --- |
| 1 | Marca de tiempo | automática | fecha y hora del registro |
| 2 | Nombre completo | sí | máx. 120 caracteres |
| 3 | Correo electrónico | sí | formato de correo |
| 4 | Número de celular | sí | 9 dígitos que empiezan con 9 (con o sin +51) o internacional con + y 8–15 dígitos; se ignoran espacios, guiones y paréntesis |
| 5 | Tipo de asistente | sí | Estudiante, Egresado, Docente, Profesional de la industria u Otro |
| 6 | Carrera | sí | máx. 120 caracteres |
| 7 | Institución | sí | máx. 150 caracteres |
| 8 | Año o semestre | solo si Tipo = Estudiante | en otro caso se guarda vacío |
| 9 | Consentimiento | sí | `si` |

**InnoMining equipos** (inscripción de equipos al concurso INNOMINING, página `/reto/inscripcion/`; formulario `innomining`, 36 columnas):

| # | Columna | Obligatorio | Validación |
| --- | --- | --- | --- |
| 1 | Marca de tiempo | automática | fecha y hora del registro |
| 2 | Equipo | sí | máx. 80 caracteres |
| 3 | Título de la propuesta | sí | máx. 200 caracteres |
| 4 | Línea temática | sí | una de las 9 líneas de `LINEAS` (= `lineas` en `src/data/reto.json`) |
| 5–10 | I1 Apellidos y nombres, I1 Carrera, I1 Carrera (otra), I1 Ciclo o condición, I1 Código UNSA, I1 Correo institucional | sí (Carrera (otra) solo si Carrera = Otra) | Carrera en `CARRERAS`; Ciclo en `CICLOS` (4.º a 10.º semestre o Egresado); correo con formato válido (se recomienda @unsa.edu.pe, no se exige) |
| 11 | Celular del coordinador (I1) | sí | igual que el celular de asistencia |
| 12–29 | Las mismas 6 columnas para I2, I3 e I4 | sí | igual que I1 |
| 30 | Docente asesor | sí | máx. 120 caracteres |
| 31 | Correo del docente asesor | sí | formato de correo |
| 32 | Problema u oportunidad | sí | máx. 200 palabras |
| 33 | Solución propuesta | sí | máx. 250 palabras |
| 34 | Acepta las bases | sí | `si` |
| 35 | Declaración de originalidad (Anexo 2) | sí | `si` |
| 36 | Consentimiento de datos | sí | `si` |

Además, el servidor rechaza el equipo si no hay al menos 3 carreras distintas (cada "Otra" cuenta según el texto escrito), si ningún integrante es de Ingeniería de Minas o si dos integrantes repiten el código UNSA. Son las mismas reglas que valida `src/scripts/forms.js` en el navegador.

La antigua hoja "Reto" (postulación previa, ya retirada del sitio) deja de recibir registros; se puede conservar o borrar a mano.

Notas:

- El script no contiene credenciales; escribe en la hoja a la que está vinculado.
- `Code.gs` valida con listas blancas (`TIPOS_ASISTENTE`, `LINEAS`, `CARRERAS`, `CICLOS`). Si cambias opciones en `inscripciones.astro` o `lineas`, `carreras` o `ciclos` en `src/data/reto.json`, actualiza esas listas y crea una nueva versión de la implementación.
- Anti-abuso: honeypot `contacto_alterno`, rechazo de envíos en menos de 3 s desde la carga (`t_carga`), deduplicación por `id_envio` y por correo+formulario (6 h) y límite global por minuto, con `CacheService`.
- **Redespliegue obligatorio tras cambiar `Code.gs`** (por ejemplo, para activar el formulario `innomining`): pega el archivo completo en el editor de Apps Script, guarda y ve a **Implementar → Gestionar implementaciones → Editar (lápiz) → Versión: Nueva versión → Implementar**. La URL se mantiene, así que `formsEndpoint` no cambia. Mientras no se redespliegue, el servidor responde "Formulario desconocido" a las inscripciones de equipos.
- Mientras `formsEndpoint` esté vacío, los formularios muestran un mensaje de "modo de prueba" y no envían nada.
- Los datos personales se envían solo al endpoint; no se guardan en el navegador ni en la URL.
- La hoja contiene datos personales: limita quién puede verla y define cuánto tiempo se conserva.

## Contenido por confirmar

- Aliados o auspiciadores: solo con autorización formal de uso de nombre y logo.
- Bases de INNOMINING: desafíos, reglamento, criterios de evaluación, premios y plazos ("se compartirán próximamente"). Hasta entonces la postulación es una pre-inscripción.
- Jurado de INNOMINING.
- Programa y horarios (los ponentes ya están publicados, sin horarios). Foto de Ing. Dino Yancachajlla Tito (hoy monograma).
- Logos de auspiciadores e instituciones, con autorización de uso.
- Sede específica, aforo y modalidad de ingreso.
- Certificación: si habrá, tipo y requisitos de asistencia.
- Correo de contacto oficial (hoy `contacto@por-confirmar.pe` en `site.json`).

## Créditos de imágenes


- Foto del área de Ingenierías de la UNSA (página de la hackatón): Carlos Zanabria Angulo, Wikimedia Commons, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Fachada_ingenier%C3%ADas.jpg
- Foto de Giancarlo Pinto: proporcionada por el organizador.
Fotos de ponentes (recortadas en cuadrado y convertidas a WebP 400 × 400; se muestran en círculo, sin quitar el fondo):

- Ruth Escobar Juárez: Freeport-McMoRan, https://www.fcx.com/freeport-features/112624
- Dr. Bernardo Ramón de la Gala Velásquez: recorte de la foto de la Lista 4 publicada por El Búho, https://elbuho.pe/wp-content/uploads/2026/08/LISTA-4.png (respaldo: retrato oficial de la UNSA, https://www.unsa.edu.pe/vicerrector-de-investigacion/, en `bernardo-de-la-gala-oficial.webp`).
- Ing. Néstor Alonso Delgado Ponce: foto de perfil de LinkedIn, https://pe.linkedin.com/in/nestor-delgado-ponce-0a1511118
- Ing. Dino Yancachajlla Tito: sin foto (monograma).

Logos (`public/img/logos/`, optimizados con svgo; colores y proporciones sin cambios):

- Enaex: https://www.enaex.com (logo de cabecera del sitio oficial).
- Sociedad Minera Cerro Verde: https://www.cerroverde.pe (versiones color y blanca).
- Anglo American: https://www.angloamerican.com (versiones color y blanca; "Quellaveco" va como leyenda de texto).
- ISEE: https://isee.org (logo de cabecera; baja resolución, usar a menos de 80 px de alto).
- Escudo UNSA: `public/brand/unsa-logo.png` (ya existente).

Las marcas pertenecen a sus titulares; se usan solo para identificar a las organizaciones participantes.

## Cabeceras de seguridad

`public/_headers` define las cabeceras HTTP (CSP, nosniff, Referrer-Policy, Permissions-Policy, etc.) y la caché de `/_astro/*`. Es el formato de Netlify y Cloudflare Pages; si el hosting es otro, replica esas cabeceras en su configuración. La CSP permite `connect-src` hacia `script.google.com` y `script.googleusercontent.com` para el envío de formularios.

## Aviso de privacidad (pendiente)

`src/pages/privacidad.astro` es un **borrador pendiente de revisión legal** (Ley 29733). Falta confirmar el plazo de conservación y el correo para ejercer derechos ARCO (marcados con `.pendiente`). No abrir inscripciones sin completarlo y revisarlo.

## Verificaciones antes de publicar

- Revisión legal del aviso de privacidad y de las casillas de consentimiento.
- Completar plazo de conservación y correo ARCO; correo de contacto oficial en `site.json` y `organizacion.astro`.
- Desplegar `Code.gs` con la última versión y poner `formsEndpoint`; probar ambos formularios (hojas "Asistencia" e "InnoMining equipos").
- Confirmar que la hoja de Sheets tiene acceso restringido.
- Actualizar el dominio en `robots.txt`, `astro.config.mjs` y metadatos.
- Confirmar programa, horarios, ponentes y respaldo académico de la UNSA; retirar los avisos `.pendiente` correspondientes.
- Verificar las cabeceras de `public/_headers` en producción.
