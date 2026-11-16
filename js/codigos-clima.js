/**
 * codigos-clima.js — Traducción de los códigos WMO que devuelve Open-Meteo
 * en el campo "weather_code" a una descripción en español y un ícono.
 * Referencia: tabla "WMO Weather interpretation codes" en https://open-meteo.com/en/docs
 */
const CODIGOS = {
  0: ['Despejado', '☀️', '🌙'],
  1: ['Mayormente despejado', '🌤️', '🌙'],
  2: ['Parcialmente nublado', '⛅', '☁️'],
  3: ['Nublado', '☁️', '☁️'],
  45: ['Niebla', '🌫️'],
  48: ['Niebla con escarcha', '🌫️'],
  51: ['Llovizna ligera', '🌦️'],
  53: ['Llovizna moderada', '🌦️'],
  55: ['Llovizna intensa', '🌧️'],
  56: ['Llovizna helada ligera', '🌧️'],
  57: ['Llovizna helada intensa', '🌧️'],
  61: ['Lluvia ligera', '🌦️'],
  63: ['Lluvia moderada', '🌧️'],
  65: ['Lluvia intensa', '🌧️'],
  66: ['Lluvia helada ligera', '🌧️'],
  67: ['Lluvia helada intensa', '🌧️'],
  71: ['Nevada ligera', '🌨️'],
  73: ['Nevada moderada', '🌨️'],
  75: ['Nevada intensa', '❄️'],
  77: ['Granos de nieve', '🌨️'],
  80: ['Chubascos ligeros', '🌦️'],
  81: ['Chubascos moderados', '🌧️'],
  82: ['Chubascos violentos', '⛈️'],
  85: ['Chubascos de nieve ligeros', '🌨️'],
  86: ['Chubascos de nieve intensos', '❄️'],
  95: ['Tormenta eléctrica', '⛈️'],
  96: ['Tormenta con granizo ligero', '⛈️'],
  99: ['Tormenta con granizo intenso', '⛈️'],
};

/**
 * @param {number} codigo  Código WMO.
 * @param {boolean} [esDeDia=true]
 * @returns {{descripcion:string, icono:string}}
 */
export function interpretarCodigo(codigo, esDeDia = true) {
  const entrada = CODIGOS[codigo];
  if (!entrada) return { descripcion: 'Sin información', icono: '❔' };
  const [descripcion, iconoDia, iconoNoche] = entrada;
  return { descripcion, icono: !esDeDia && iconoNoche ? iconoNoche : iconoDia };
}
