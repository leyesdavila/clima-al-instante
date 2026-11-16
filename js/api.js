/**
 * api.js — Cliente de la API REST de Open-Meteo.
 *
 * Se usan dos servicios públicos (sin API key ni datos sensibles):
 *   1. Geocoding API  → busca ciudades por nombre y devuelve sus coordenadas.
 *   2. Forecast API   → devuelve el clima actual y el pronóstico diario.
 *
 * Documentación: https://open-meteo.com/en/docs
 *                https://open-meteo.com/en/docs/geocoding-api
 */

const URL_GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';
const URL_PRONOSTICO = 'https://api.open-meteo.com/v1/forecast';
const TIEMPO_LIMITE_MS = 10000;

/** Error propio para distinguir los tipos de falla y mostrar mensajes claros. */
export class ApiError extends Error {
  /**
   * @param {string} mensaje   Mensaje comprensible para el usuario.
   * @param {'red'|'tiempo'|'http'|'formato'} tipo
   * @param {number} [status]  Código HTTP, si lo hubo.
   */
  constructor(mensaje, tipo, status) {
    super(mensaje);
    this.name = 'ApiError';
    this.tipo = tipo;
    this.status = status;
  }
}

/** Traduce los códigos HTTP más comunes a un mensaje en español. */
function mensajePorStatus(status, razon) {
  if (status === 400) return `La solicitud no es válida${razon ? `: ${razon}` : '.'}`;
  if (status === 404) return 'El recurso solicitado no existe (404).';
  if (status === 429) return 'Se hicieron demasiadas consultas seguidas (429). Espera un momento e inténtalo de nuevo.';
  if (status >= 500) return `El servicio de Open-Meteo no está disponible en este momento (${status}).`;
  return `El servidor respondió con un error inesperado (${status}).`;
}

/**
 * Hace un GET con fetch + async/await, con tiempo límite y cancelación.
 * Devuelve el JSON ya convertido a objeto o lanza un ApiError.
 *
 * @param {string} url
 * @param {Record<string, string|number>} parametros  Query string.
 * @param {AbortSignal} [senalExterna]  Permite cancelar si el usuario hace otra búsqueda.
 */
async function obtenerJSON(url, parametros, senalExterna) {
  const consulta = new URLSearchParams(parametros);
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort('tiempo'), TIEMPO_LIMITE_MS);
  const alCancelar = () => controlador.abort('cancelado');
  senalExterna?.addEventListener('abort', alCancelar, { once: true });

  let respuesta;
  try {
    respuesta = await fetch(`${url}?${consulta}`, { signal: controlador.signal });
  } catch (err) {
    if (controlador.signal.aborted) {
      if (controlador.signal.reason === 'cancelado') throw err; // la UI lo ignora
      throw new ApiError('La consulta tardó demasiado. Revisa tu conexión e inténtalo de nuevo.', 'tiempo');
    }
    throw new ApiError('No fue posible conectarse con el servicio. Verifica tu conexión a Internet.', 'red');
  } finally {
    clearTimeout(temporizador);
    senalExterna?.removeEventListener('abort', alCancelar);
  }

  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    if (!respuesta.ok) throw new ApiError(mensajePorStatus(respuesta.status), 'http', respuesta.status);
    throw new ApiError('La respuesta del servidor no tiene un formato JSON válido.', 'formato', respuesta.status);
  }

  // Open-Meteo responde errores como { "error": true, "reason": "..." }
  if (!respuesta.ok || datos?.error) {
    throw new ApiError(mensajePorStatus(respuesta.status, datos?.reason), 'http', respuesta.status);
  }
  return datos;
}

/**
 * Busca ciudades por nombre.
 * Endpoint: GET /v1/search?name={texto}&count=10&language=es&format=json
 * @returns {Promise<Array<object>>} Lista de ciudades (vacía si no hay coincidencias).
 */
export async function buscarCiudades(nombre, senal) {
  const datos = await obtenerJSON(URL_GEOCODING, {
    name: nombre,
    count: 10,
    language: 'es',
    format: 'json',
  }, senal);
  // Cuando no hay coincidencias la API omite la propiedad "results".
  return Array.isArray(datos.results) ? datos.results : [];
}

/**
 * Obtiene el clima actual y el pronóstico de 7 días para unas coordenadas.
 * Endpoint: GET /v1/forecast?latitude=..&longitude=..&current=..&daily=..&timezone=auto
 * @param {{latitude:number, longitude:number}} ciudad
 * @param {'celsius'|'fahrenheit'} unidad
 */
export async function obtenerPronostico({ latitude, longitude }, unidad = 'celsius', senal) {
  return obtenerJSON(URL_PRONOSTICO, {
    latitude,
    longitude,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: 7,
    temperature_unit: unidad,
    wind_speed_unit: 'kmh',
  }, senal);
}
