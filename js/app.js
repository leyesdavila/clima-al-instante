/**
 * app.js — Punto de entrada. Conecta los eventos del usuario
 * (búsqueda, selección de ciudad, cambio de unidad) con la API y la UI.
 */
import { buscarCiudades, obtenerPronostico } from './api.js';
import * as ui from './ui.js';

const formulario = document.getElementById('form-busqueda');
const campo = document.getElementById('campo-ciudad');
const mensajeValidacion = document.getElementById('mensaje-validacion');
const botonBuscar = formulario.querySelector('button[type="submit"]');
const resultados = document.getElementById('resultados');
const detalle = document.getElementById('detalle');
const botonesUnidad = document.querySelectorAll('.unidades__btn');

/** Estado de la aplicación. */
const estado = {
  unidad: leerPreferencia('clima:unidad', 'celsius') === 'fahrenheit' ? 'fahrenheit' : 'celsius',
  ciudad: null,                 // ciudad seleccionada
  controladorBusqueda: null,    // AbortController de la búsqueda en curso
  controladorPronostico: null,  // AbortController del pronóstico en curso
};

/* ---------------- Utilidades ---------------- */

function leerPreferencia(clave, porDefecto) {
  try { return localStorage.getItem(clave) ?? porDefecto; } catch { return porDefecto; }
}
function guardarPreferencia(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch { /* modo privado: se ignora */ }
}
const esCancelacion = (err) => err?.name === 'AbortError' || err === 'cancelado';

/* ---------------- Búsqueda de ciudades ---------------- */

async function realizarBusqueda(texto) {
  const consulta = texto.trim();
  if (consulta.length < 2) {
    mensajeValidacion.textContent = 'Escribe al menos 2 letras para buscar.';
    campo.focus();
    return;
  }
  mensajeValidacion.textContent = '';

  // Si había una búsqueda en curso, se cancela para que no llegue tarde.
  estado.controladorBusqueda?.abort();
  const controlador = new AbortController();
  estado.controladorBusqueda = controlador;

  // Una búsqueda nueva descarta la ciudad anterior y su pronóstico pendiente.
  estado.controladorPronostico?.abort();
  estado.ciudad = null;
  ui.limpiar(detalle);
  ui.mostrarCargaResultados(resultados, `Buscando “${consulta}”…`);
  botonBuscar.disabled = true;

  try {
    const ciudades = await buscarCiudades(consulta, controlador.signal);
    if (ciudades.length === 0) {
      ui.mostrarVacio(resultados, `No encontramos ciudades llamadas “${consulta}”`,
        'Revisa la ortografía o prueba con otro nombre, por ejemplo “Monterrey” o “Buenos Aires”.');
      return;
    }
    ui.mostrarCiudades(resultados, ciudades, consulta, seleccionarCiudad);
    // Si solo hay un resultado, se abre directamente.
    if (ciudades.length === 1) seleccionarCiudad(ciudades[0], resultados.querySelector('.ciudad'));
  } catch (err) {
    if (esCancelacion(err)) return;
    console.error(err);
    ui.mostrarError(resultados, err.message, () => realizarBusqueda(consulta));
  } finally {
    if (estado.controladorBusqueda === controlador) botonBuscar.disabled = false;
  }
}

/* ---------------- Pronóstico de la ciudad elegida ---------------- */

async function seleccionarCiudad(ciudad, boton) {
  estado.ciudad = ciudad;
  ui.marcarSeleccionada(resultados, boton);
  await cargarPronostico();
  detalle.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function cargarPronostico() {
  const ciudad = estado.ciudad;
  if (!ciudad) return;

  estado.controladorPronostico?.abort();
  const controlador = new AbortController();
  estado.controladorPronostico = controlador;

  ui.mostrarCarga(detalle, `Consultando el clima de ${ciudad.name}…`);
  try {
    const datos = await obtenerPronostico(ciudad, estado.unidad, controlador.signal);
    ui.mostrarPronostico(detalle, ciudad, datos);
  } catch (err) {
    if (esCancelacion(err)) return;
    console.error(err);
    ui.mostrarError(detalle, err.message, cargarPronostico);
  }
}

/* ---------------- Cambio de unidad (°C / °F) ---------------- */

function aplicarUnidad(unidad) {
  estado.unidad = unidad;
  guardarPreferencia('clima:unidad', unidad);
  botonesUnidad.forEach((b) => {
    const activo = b.dataset.unidad === unidad;
    b.classList.toggle('activo', activo);
    b.setAttribute('aria-pressed', String(activo));
  });
}

/* ---------------- Eventos ---------------- */

formulario.addEventListener('submit', (e) => {
  e.preventDefault();
  realizarBusqueda(campo.value);
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    campo.value = chip.dataset.ciudad;
    realizarBusqueda(chip.dataset.ciudad);
  });
});

botonesUnidad.forEach((boton) => {
  boton.addEventListener('click', () => {
    if (boton.dataset.unidad === estado.unidad) return;
    aplicarUnidad(boton.dataset.unidad);
    cargarPronostico(); // vuelve a pedir los datos en la nueva unidad
  });
});

/* ---------------- Inicio ---------------- */
aplicarUnidad(estado.unidad);
ui.mostrarVacio(resultados, 'Busca una ciudad para empezar',
  'Escribe el nombre de cualquier ciudad del mundo o usa una de las búsquedas rápidas.', '🌎');
