// Quién entró. Va en este archivo porque es el único que carga cada página del
// hub en el <head>, antes de pintar, incluidas las que regenera la
// sincronización (a esas se lo agrega sw.js).
//
// Se entra en index.html: cada uno con su cuenta (mail + código), y el gerente
// también con la clave de gerencia sola, que cuenta como Gerencia sin cuenta.
// Ahí se guarda en esta pestaña quién es y qué le toca ('bydAcceso'), y de eso salen
// las marcas viejas que leen las páginas de Nicolás (bydGateOk, bydVendorOk,
// bydVendorNombre, bydJefeOk). Acá, en cada página:
//
//   - Si la marca de la pestaña no es de la cuenta guardada en el teléfono
//     (o es de la clave de gerencia pero apareció una cuenta), se borran las
//     marcas y se manda a index.html, que vuelve a reconocer a la persona.
//   - Si coincide, se vuelven a escribir las marcas desde 'bydAcceso'. Así una
//     marca puesta a mano (por ejemplo, con la clave general que todavía piden
//     algunas páginas) no sobrevive al cambio de página.
//
// Esto ordena quién es quién en pantalla; los datos los sigue cuidando el
// permiso por fila de la base.
(function () {
  var URL_BASE = 'https://mgicnwnvtfkrxmkmewnt.supabase.co'
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1naWNud252dGZrcnhta21ld250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1Nzk5MDIsImV4cCI6MjEwNTE1NTkwMn0.GLWN_wI6Q_6Qu1EGi02oPNrL9wgTj-zbGsJCoIE-HQE'
  var CLAVE_CUENTA = 'sb-mgicnwnvtfkrxmkmewnt-auth-token' // la misma que usa el Portal
  var MARCAS = ['bydGateOk', 'bydVendorOk', 'bydVendorNombre', 'bydJefeOk']
  // Páginas que nunca pidieron nada para entrar: siguen abiertas.
  var ABIERTAS = /\/(fichas_tecnicas|ranking_vendedores|tablero_control)\.html$/

  var ruta = location.pathname
  if (ruta.indexOf('/portal/') !== -1) return // el Portal tiene su propio ingreso
  var carpeta = ruta.replace(/[^/]*$/, '')
  var esPuerta = /\/(index\.html)?$/.test(ruta)

  function cuentaGuardada() {
    try {
      var s = JSON.parse(localStorage.getItem(CLAVE_CUENTA) || 'null')
      if (s && s.user && s.user.id) return { id: s.user.id, token: s.access_token }
    } catch (e) {}
    return null
  }
  function leerAcceso() {
    try { return JSON.parse(sessionStorage.getItem('bydAcceso') || 'null') } catch (e) { return null }
  }
  function limpiar() {
    try {
      sessionStorage.removeItem('bydAcceso')
      MARCAS.forEach(function (m) { sessionStorage.removeItem(m) })
    } catch (e) {}
  }
  // { uid, tipo: 'gerencia' | 'vendedor' | 'jefe', nombre, clave? }
  function marcar(acceso) {
    limpiar()
    try {
      sessionStorage.setItem('bydAcceso', JSON.stringify(acceso))
      if (acceso.tipo === 'gerencia') sessionStorage.setItem('bydGateOk', '1')
      else {
        sessionStorage.setItem('bydVendorOk', '1')
        sessionStorage.setItem('bydVendorNombre', acceso.nombre)
        if (acceso.tipo === 'jefe') sessionStorage.setItem('bydJefeOk', '1')
      }
    } catch (e) {}
  }
  function irAEntrar(volver) {
    var destino = carpeta + 'index.html'
    var pagina = ruta.slice(carpeta.length)
    if (volver && pagina && !esPuerta) destino += '?volver=' + encodeURIComponent(pagina)
    // Adentro de un marco (la solapa Calidad) se manda la página de afuera.
    var ventana = window
    try { if (window.top.location.origin === location.origin) ventana = window.top } catch (e) {}
    ventana.location.replace(destino)
  }
  // Cierra la cuenta en este teléfono, no sólo en la pestaña: si no, el que
  // agarra el teléfono después entra con la cuenta del anterior.
  function olvidarCuenta(fin) {
    var cuenta = cuentaGuardada()
    try { localStorage.removeItem(CLAVE_CUENTA) } catch (e) {}
    if (!cuenta || !cuenta.token) { fin(); return }
    var listo = false
    var terminar = function () { if (!listo) { listo = true; fin() } }
    setTimeout(terminar, 2500) // sin conexión no se queda colgado
    fetch(URL_BASE + '/auth/v1/logout?scope=local', {
      method: 'POST',
      headers: { apikey: ANON, Authorization: 'Bearer ' + cuenta.token },
    }).then(terminar, terminar)
  }
  function salir() {
    limpiar()
    olvidarCuenta(function () { irAEntrar(false) })
  }
  window.bydAcceso = { cuenta: cuentaGuardada, leer: leerAcceso, marcar: marcar, limpiar: limpiar, salir: salir, olvidarCuenta: olvidarCuenta }

  // Los botones "Salir" de los paneles de Ventas y del Jefe sólo borraban las
  // marcas de la pestaña. Se los toma antes que su propio código.
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('#logoutBtn')
    if (!b) return
    e.preventDefault()
    e.stopImmediatePropagation()
    salir()
  }, true)

  var cuenta = cuentaGuardada()
  var acceso = leerAcceso()
  var vale = acceso && (acceso.clave ? !cuenta : cuenta && acceso.uid === cuenta.id)
  if (vale) { marcar(acceso); return }
  limpiar()
  if (esPuerta || ABIERTAS.test(ruta)) return
  // Se tapa la página mientras se va, para que no asome su puerta vieja.
  document.documentElement.style.visibility = 'hidden'
  irAEntrar(true)
})();

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

  // Sin zoom al tocar. En el iPhone, tocar un campo con letra de menos de
  // 16px agranda la página sola y queda corrida; el doble toque rápido hace lo
  // mismo. Se fija la escala en 1 y se apaga el zoom por doble toque. Pellizcar
  // para agrandar sigue andando en el iPhone.
  try {
    var vp = document.querySelector('meta[name="viewport"]')
    if (!vp) {
      vp = document.createElement('meta')
      vp.name = 'viewport'
      vp.content = 'width=device-width, initial-scale=1'
      document.head.appendChild(vp)
    }
    if (!/maximum-scale/.test(vp.content)) vp.content += ', maximum-scale=1'
  } catch (e) {}

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
    'html{touch-action:manipulation;-webkit-text-size-adjust:100%}' +
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

  // Los íconos de color de las fichas de números (visual.js) viajan con este
  // archivo, que ya está en todas las páginas del hub.
  var vis = document.createElement('script')
  vis.src = 'visual.js'
  document.head.appendChild(vis)

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
