// Modo claro u oscuro para las páginas del hub.
//
// Cada página lo carga en el <head>, justo después de estilo.css, sin defer:
// así el tema se aplica antes de pintar y quien eligió el oscuro no ve un
// relámpago blanco al abrir cada pantalla.
//
// Las páginas tienen cientos de colores escritos a mano, uno por uno. En vez
// de reescribirlos todos, el modo oscuro invierte la página entera y gira el
// tono media vuelta: el blanco pasa a gris muy oscuro, el texto negro a claro,
// y el azul, el verde y el rojo siguen siendo azul, verde y rojo. Las fotos y
// la franja negra del logo se vuelven a invertir para que queden como son.
//
// La preferencia se comparte con el Portal de Calidad, que vive en el mismo
// dominio y lee la misma clave: cambiarlo en una app lo cambia en la otra.
(function () {
  var CLAVE = 'byd-tema'
  var raiz = document.documentElement

  function leer() {
    try { return localStorage.getItem(CLAVE) === 'oscuro' ? 'oscuro' : 'claro' } catch (e) { return 'claro' }
  }
  function aplicar(tema) {
    if (tema === 'oscuro') raiz.setAttribute('data-tema', 'oscuro')
    else raiz.removeAttribute('data-tema')
    var b = document.getElementById('bydBotonTema')
    if (b) pintarBoton(b, tema)
  }

  var estilo = document.createElement('style')
  estilo.textContent =
    '@media screen{' +
    // Se invierte al 90% y no al 100%: el negro puro sobre blanco puro, dado
    // vuelta, encandila.
    'html[data-tema="oscuro"]{filter:invert(.9) hue-rotate(180deg);background:#fff}' +
    'html[data-tema="oscuro"] img,html[data-tema="oscuro"] video,html[data-tema="oscuro"] picture,' +
    'html[data-tema="oscuro"] canvas,html[data-tema="oscuro"] iframe,' +
    'html[data-tema="oscuro"] [style*="background-image"],' +
    'html[data-tema="oscuro"] .topbar,html[data-tema="oscuro"] .app-topbar,html[data-tema="oscuro"] .header-calc,' +
    // Lo que ya es oscuro de por sí (la puerta de entrada del hub) se marca
    // con esta clase y queda como está.
    'html[data-tema="oscuro"] .oscuro-fijo' +
    '{filter:invert(1) hue-rotate(180deg)}' +
    // Adentro de algo que ya se volvió a invertir, no se invierte de nuevo.
    'html[data-tema="oscuro"] .topbar img,html[data-tema="oscuro"] .app-topbar img,html[data-tema="oscuro"] .header-calc img{filter:none}' +
    '#bydBotonTema{position:fixed;right:14px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:999997;' +
    'width:40px;height:40px;border-radius:50%;border:1px solid #e3e6ea;background:#fff;color:#5c6167;' +
    'display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;opacity:.8;' +
    'box-shadow:0 2px 8px rgba(27,28,30,.10);transition:opacity .15s}' +
    '#bydBotonTema:hover,#bydBotonTema:focus-visible{opacity:1}' +
    '#bydBotonTema svg{width:18px;height:18px}' +
    '}' +
    '@media print{#bydBotonTema{display:none}}'
  document.head.appendChild(estilo)

  aplicar(leer())

  var LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'
  var SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'

  function pintarBoton(b, tema) {
    var otro = tema === 'oscuro' ? 'claro' : 'oscuro'
    b.innerHTML = tema === 'oscuro' ? SOL : LUNA
    b.setAttribute('aria-label', 'Pasar a modo ' + otro)
    b.title = 'Modo ' + otro
  }

  // Si se cambia en otra pestaña, en el Portal o en la página de afuera (la
  // solapa Calidad va adentro de un marco), esta se acomoda sola.
  window.addEventListener('storage', function (e) { if (e.key === CLAVE) aplicar(leer()) })
  window.addEventListener('message', function (e) {
    if (e.origin === location.origin && e.data && e.data.tipo === 'byd-tema') aplicar(leer())
  })

  // Adentro de un marco no va botón: ya lo tiene la página de afuera.
  if (window.top !== window.self) return

  function ponerBoton() {
    if (document.getElementById('bydBotonTema')) return
    var b = document.createElement('button')
    b.type = 'button'
    b.id = 'bydBotonTema'
    pintarBoton(b, leer())
    b.addEventListener('click', function () {
      var nuevo = leer() === 'oscuro' ? 'claro' : 'oscuro'
      try { localStorage.setItem(CLAVE, nuevo) } catch (e) {}
      aplicar(nuevo)
      // El evento 'storage' no llega a los marcos de esta misma página en
      // todos los navegadores: se les avisa a mano.
      var marcos = document.getElementsByTagName('iframe')
      for (var i = 0; i < marcos.length; i++) {
        try { marcos[i].contentWindow.postMessage({ tipo: 'byd-tema' }, location.origin) } catch (e) {}
      }
    })
    document.body.appendChild(b)
  }
  if (document.body) ponerBoton()
  else document.addEventListener('DOMContentLoaded', ponerBoton)
})()
