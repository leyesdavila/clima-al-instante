/**
 * ui.js — Componentes de la interfaz creados dinámicamente en el DOM.
 * Todos los datos que vienen de la API se insertan con textContent
 * (nunca con innerHTML) para evitar inyección de HTML.
 */
import { interpretarCodigo } from './codigos-clima.js';

const fmtNumero = new Intl.NumberFormat('es-MX');

/** Crea un elemento con clase y texto opcionales. */
function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

/** Convierte un código de país ISO (MX) a su emoji de bandera (🇲🇽). */
function bandera(codigoPais) {
  if (!codigoPais || codigoPais.length !== 2) return '🌍';
  return String.fromCodePoint(...[...codigoPais.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

function reemplazar(contenedor, ...hijos) {
  contenedor.replaceChildren(...hijos);
}

/* ------------------------------------------------------------------ */
/* Estados genéricos: carga, vacío, error                              */
/* ------------------------------------------------------------------ */

/** Estado de carga para la lista de ciudades: tarjetas "esqueleto". */
export function mostrarCargaResultados(contenedor, texto) {
  contenedor.setAttribute('aria-busy', 'true');
  const titulo = crear('h2', 'seccion-titulo', texto);
  const lista = crear('ul', 'esqueleto');
  lista.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 4; i++) lista.append(crear('li'));
  reemplazar(contenedor, titulo, lista);
}

/** Estado de carga con spinner (para el pronóstico). */
export function mostrarCarga(contenedor, texto) {
  contenedor.setAttribute('aria-busy', 'true');
  const caja = crear('div', 'estado cargando');
  caja.setAttribute('role', 'status');
  caja.append(crear('span', 'spinner'), crear('span', '', texto));
  reemplazar(contenedor, caja);
}

/** Estado vacío: la consulta fue exitosa pero no hubo datos. */
export function mostrarVacio(contenedor, titulo, detalle, icono = '🔎') {
  contenedor.setAttribute('aria-busy', 'false');
  const caja = crear('div', 'estado estado--vacio');
  caja.append(
    crear('span', 'estado__icono', icono),
    crear('p', 'estado__titulo', titulo),
    crear('p', '', detalle),
  );
  reemplazar(contenedor, caja);
}

/** Estado de error con botón para reintentar. */
export function mostrarError(contenedor, mensaje, alReintentar) {
  contenedor.setAttribute('aria-busy', 'false');
  const caja = crear('div', 'estado estado--error');
  caja.setAttribute('role', 'alert');
  caja.append(
    crear('span', 'estado__icono', '⚠️'),
    crear('p', 'estado__titulo', 'Algo salió mal'),
    crear('p', '', mensaje),
  );
  if (alReintentar) {
    const boton = crear('button', 'btn btn--secundario', 'Reintentar');
    boton.type = 'button';
    boton.addEventListener('click', alReintentar);
    caja.append(boton);
  }
  reemplazar(contenedor, caja);
}

export function limpiar(contenedor) {
  contenedor.setAttribute('aria-busy', 'false');
  contenedor.replaceChildren();
}

/* ------------------------------------------------------------------ */
/* Componente: lista de ciudades encontradas                           */
/* ------------------------------------------------------------------ */

/**
 * @param {HTMLElement} contenedor
 * @param {Array<object>} ciudades  Resultados de la Geocoding API.
 * @param {(ciudad:object, boton:HTMLButtonElement) => void} alSeleccionar
 */
export function mostrarCiudades(contenedor, ciudades, consulta, alSeleccionar) {
  contenedor.setAttribute('aria-busy', 'false');
  const plantilla = document.getElementById('tpl-ciudad');
  const titulo = crear('h2', 'seccion-titulo',
    `${ciudades.length} ${ciudades.length === 1 ? 'resultado' : 'resultados'} para “${consulta}”. Elige una ciudad:`);
  const lista = crear('ul', 'lista-ciudades');

  for (const ciudad of ciudades) {
    const nodo = plantilla.content.cloneNode(true);
    const boton = nodo.querySelector('.ciudad');
    nodo.querySelector('.ciudad__bandera').textContent = bandera(ciudad.country_code);
    nodo.querySelector('.ciudad__nombre').textContent = ciudad.name;
    nodo.querySelector('.ciudad__region').textContent =
      [ciudad.admin1, ciudad.country].filter(Boolean).join(', ') || 'Región desconocida';
    nodo.querySelector('.ciudad__poblacion').textContent =
      ciudad.population ? `${fmtNumero.format(ciudad.population)} hab.` : '';
    boton.addEventListener('click', () => alSeleccionar(ciudad, boton));
    lista.append(nodo);
  }
  reemplazar(contenedor, titulo, lista);
}

export function marcarSeleccionada(contenedor, boton) {
  contenedor.querySelectorAll('.ciudad.seleccionada').forEach((b) => b.classList.remove('seleccionada'));
  boton?.classList.add('seleccionada');
}

/* ------------------------------------------------------------------ */
/* Componente: clima actual + pronóstico de 7 días                     */
/* ------------------------------------------------------------------ */

/**
 * @param {HTMLElement} contenedor
 * @param {object} ciudad  Ciudad elegida (Geocoding API).
 * @param {object} datos   Respuesta de la Forecast API.
 */
export function mostrarPronostico(contenedor, ciudad, datos) {
  contenedor.setAttribute('aria-busy', 'false');
  const { current: actual, current_units: u, daily: diario, daily_units: ud } = datos;

  if (!actual || !diario?.time?.length) {
    mostrarVacio(contenedor, 'Sin datos de pronóstico', 'Open-Meteo no devolvió información para esta ubicación.');
    return;
  }

  /* --- Tarjeta de clima actual --- */
  const { descripcion, icono } = interpretarCodigo(actual.weather_code, actual.is_day === 1);
  const tarjeta = crear('article', 'actual');
  const textos = crear('div');
  const horaLocal = new Date(actual.time).toLocaleString('es-MX', {
    weekday: 'long', hour: '2-digit', minute: '2-digit',
  });
  textos.append(
    crear('h2', 'actual__lugar', `${bandera(ciudad.country_code)} ${ciudad.name}`),
    crear('p', 'actual__sub', `${[ciudad.admin1, ciudad.country].filter(Boolean).join(', ')} · Hora local: ${horaLocal}`),
    crear('p', 'actual__temp', `${Math.round(actual.temperature_2m)}${u.temperature_2m}`),
    crear('p', 'actual__desc', descripcion),
  );

  const metricas = crear('ul', 'metricas');
  const datosMetricas = [
    ['Sensación térmica', `${Math.round(actual.apparent_temperature)}${u.apparent_temperature}`],
    ['Humedad', `${actual.relative_humidity_2m}${u.relative_humidity_2m}`],
    ['Viento', `${actual.wind_speed_10m} ${u.wind_speed_10m}`],
    ['Precipitación', `${actual.precipitation} ${u.precipitation}`],
  ];
  for (const [nombre, valor] of datosMetricas) {
    const li = crear('li', 'metrica');
    li.append(crear('span', '', nombre), crear('strong', '', valor));
    metricas.append(li);
  }
  tarjeta.append(crear('div', 'actual__icono', icono), textos, metricas);

  /* --- Pronóstico de 7 días --- */
  const seccion = crear('section', 'pronostico');
  seccion.append(crear('h2', 'seccion-titulo', 'Pronóstico de 7 días'));
  const lista = crear('ul', 'lista-dias');
  const plantilla = document.getElementById('tpl-dia');

  diario.time.forEach((fecha, i) => {
    const nodo = plantilla.content.cloneNode(true);
    // Se agrega T12:00 para que la fecha no se recorra un día por la zona horaria.
    const dia = new Date(`${fecha}T12:00:00`);
    const nombreDia = i === 0 ? 'Hoy' : dia.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
    const info = interpretarCodigo(diario.weather_code[i]);
    nodo.querySelector('.dia__nombre').textContent = nombreDia;
    nodo.querySelector('.dia__icono').textContent = info.icono;
    nodo.querySelector('.dia__desc').textContent = info.descripcion;
    nodo.querySelector('.dia__max').textContent = `${Math.round(diario.temperature_2m_max[i])}°`;
    nodo.querySelector('.dia__min').textContent = `${Math.round(diario.temperature_2m_min[i])}°`;
    const lluvia = diario.precipitation_probability_max?.[i];
    nodo.querySelector('.dia__lluvia').textContent =
      lluvia === null || lluvia === undefined ? '' : `💧 ${lluvia}${ud.precipitation_probability_max}`;
    lista.append(nodo);
  });
  seccion.append(lista);

  reemplazar(contenedor, tarjeta, seccion);
}
