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

  // Lo que se vuelve a invertir para que quede como es: fotos, marcos, la
  // franja negra del logo y el selector que va sobre ella. La clase
  // .oscuro-fijo la usa la puerta de entrada, que ya es oscura; .tema-conserva
  // la pone el script de abajo en botones y etiquetas de color.
  var CONSERVA = [
    'img', 'video', 'picture', 'canvas', 'iframe', '[style*="url("]',
    '.topbar', '.app-topbar', '.header-calc', '.main-select-wrap', '.main-select-wrap ~ .tabs',
    '.oscuro-fijo', '.tema-conserva',
  ]
  var CONSERVA_SEL = CONSERVA.join(',')
  var enOscuro = function (lista) {
    return lista.map(function (x) { return 'html[data-tema="oscuro"] ' + x }).join(',')
  }
  // Adentro de algo que ya se volvió a invertir, no se invierte de nuevo.
  var anidados = []
  CONSERVA.forEach(function (p) { CONSERVA.forEach(function (h) { anidados.push(p + ' ' + h) }) })

  var estilo = document.createElement('style')
  estilo.textContent =
    '@media screen{' +
    // Se invierte al 90% y no al 100%: el negro puro sobre blanco puro, dado
    // vuelta, encandila.
    // El alto automático hace que el oscurecido cubra toda la página y no sólo
    // la primera pantalla (algunas páginas fijan html a height:100%).
    'html[data-tema="oscuro"]{filter:invert(.9) hue-rotate(180deg);height:auto !important;min-height:100%}' +
    // La página y lo que queda debajo de ella van del mismo gris: si no, en
    // oscuro se ve un rectángulo más claro del alto de la pantalla.
    'html[data-tema="oscuro"],html[data-tema="oscuro"] body{background:#f6f7f9 !important}' +
    enOscuro(CONSERVA) + '{filter:invert(1) hue-rotate(180deg)}' +
    enOscuro(anidados) + '{filter:none}' +
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

  // Botones, pastillas y etiquetas con fondo de color (el azul de "Aplicar", el
  // verde de un "Cumple", los íconos con degradé de las tarjetas): dados vuelta
  // quedan desteñidos y con el texto oscuro. Se los deja con su color de
  // siempre, que sobre fondo oscuro se lee bien. Blancos, grises y fondos
  // pastel sí se invierten: son los que hacen que la página sea oscura.
  function colorFuerte(r, g, b) {
    r /= 255; g /= 255; b /= 255
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
    if (max === min) return false
    var sat = (max - min) / (1 - Math.abs(2 * l - 1))
    return sat > 0.4 && l > 0.2 && l < 0.72
  }
  var RGB = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/g
  function hayColorFuerte(texto) {
    var m
    RGB.lastIndex = 0
    while ((m = RGB.exec(texto))) {
      if (m[4] !== undefined && +m[4] < 0.6) continue
      if (colorFuerte(+m[1], +m[2], +m[3])) return true
    }
    return false
  }
  // Un degradé cuenta sólo si es de color (los íconos de las tarjetas): los
  // botones blancos con un degradé apenas gris se invierten como el resto.
  function esAcento(el) {
    var cs = getComputedStyle(el)
    if (cs.backgroundImage && cs.backgroundImage.indexOf('gradient') !== -1 && hayColorFuerte(cs.backgroundImage)) return true
    return hayColorFuerte(cs.backgroundColor)
  }
  function marcar(raizEl) {
    if (!raizEl || raizEl.nodeType !== 1) return
    var lista = [raizEl].concat(Array.prototype.slice.call(raizEl.getElementsByTagName('*')))
    for (var i = 0; i < lista.length; i++) {
      var el = lista[i]
      if (el.id === 'bydBotonTema' || el instanceof SVGElement) continue
      if (el.parentElement && el.parentElement.closest(CONSERVA_SEL)) continue
      if (esAcento(el)) el.classList.add('tema-conserva')
    }
  }
  // Las páginas arman casi todo después de cargar (tarjetas, listas, gráficos),
  // así que se mira también lo que va apareciendo, de a tandas.
  var pendientes = []
  var programado = false
  function vigilar() {
    marcar(document.body)
    new MutationObserver(function (cambios) {
      cambios.forEach(function (c) {
        if (c.type === 'attributes') pendientes.push(c.target)
        else for (var i = 0; i < c.addedNodes.length; i++) pendientes.push(c.addedNodes[i])
      })
      if (programado) return
      programado = true
      requestAnimationFrame(function () {
        programado = false
        var tanda = pendientes; pendientes = []
        tanda.forEach(function (n) { if (n.isConnected) marcar(n) })
      })
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
  }
  if (document.body) vigilar()
  else document.addEventListener('DOMContentLoaded', vigilar)

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

  // El service worker del hub (sw.js) le agrega el botón al vuelo a las
  // páginas que regenera la sincronización. Antes sólo se instalaba al abrir
  // el Tablero; los vendedores entran directo a su panel y no lo tenían.
  try {
    if ('serviceWorker' in navigator && location.pathname.indexOf('/portal/') === -1) {
      navigator.serviceWorker.register('./sw.js').catch(function () {})
    }
  } catch (e) {}

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
