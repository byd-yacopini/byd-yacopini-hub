// Íconos de color para las fichas de números del hub.
//
// Las páginas son de Nicolás y no se reescriben: este archivo lo carga tema.js
// (que ya está en todas) y le pone a cada ficha (.kpi) un ícono según lo que
// dice su etiqueta: "Leads", "Entregas", "Stock"… Si una etiqueta no se
// reconoce, la ficha queda como estaba.
(function () {
  var S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
  var ICONOS = {
    personas: S + '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3 3 0 010 5.6M21 20c0-2.6-1.6-4.5-4-5.2"/></svg>',
    documento: S + '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>',
    auto: S + '<path d="M3 17v-3.5L5.2 8h13.6L21 13.5V17z"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/></svg>',
    caja: S + '<path d="M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/></svg>',
    volante: S + '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M3.5 10.5l6 1M20.5 10.5l-6 1M12 14.5V21"/></svg>',
    etiqueta: S + '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>',
    porcentaje: S + '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></svg>',
    barras: S + '<path d="M5 20V11M11 20V5M17 20v-6M3 20h18"/></svg>',
    dolar: S + '<path d="M12 2.5v19M16.5 7c0-1.7-2-3-4.5-3S7.5 5.3 7.5 7s1.8 2.8 4.5 3.5 4.5 1.8 4.5 3.8-2 3.2-4.5 3.2-4.5-1.3-4.5-3"/></svg>',
    reloj: S + '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    check: S + '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.5"/></svg>',
  }
  var AZUL = '#2166ab', VIOLETA = '#6b4fc9', VERDE = '#2f9e5f', AMBAR = '#d97a06', ROJO = '#c62851', CIAN = '#0e8a9e'

  // El orden importa: la primera palabra que aparece gana ("Test drives /
  // clientes presenciales" es un test drive, no un cliente).
  var REGLAS = [
    ['test drive', 'volante', CIAN],
    ['conversion', 'porcentaje', VIOLETA],
    ['lead', 'personas', AZUL],
    ['solicitud', 'documento', VIOLETA],
    ['entrega', 'auto', VERDE],
    ['sin pagar', 'dolar', ROJO],
    ['esperando', 'reloj', AMBAR],
    ['arribad', 'check', VERDE],
    ['stock', 'caja', AMBAR],
    ['tasacion', 'etiqueta', AMBAR],
    ['utilidad', 'dolar', VERDE],
    ['promedio', 'barras', AZUL],
    ['venta', 'auto', VERDE],
    ['objetivo', 'barras', AZUL],
  ]

  var normal = function (t) {
    return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  }

  function adornar(kpi) {
    if (kpi.getAttribute('data-ico')) return
    var etiqueta = kpi.querySelector('.l')
    if (!etiqueta) return
    var texto = normal(etiqueta.textContent)
    for (var i = 0; i < REGLAS.length; i++) {
      if (texto.indexOf(REGLAS[i][0]) === -1) continue
      var ico = document.createElement('span')
      ico.className = 'kpi-ico'
      ico.setAttribute('aria-hidden', 'true')
      ico.style.setProperty('--c', REGLAS[i][2])
      ico.innerHTML = ICONOS[REGLAS[i][1]]
      kpi.insertBefore(ico, kpi.firstChild)
      kpi.setAttribute('data-ico', REGLAS[i][1])
      return
    }
    kpi.setAttribute('data-ico', 'no')
  }

  function recorrer(raiz) {
    if (!raiz || !raiz.querySelectorAll) return
    if (raiz.classList && raiz.classList.contains('kpi')) adornar(raiz)
    var lista = raiz.querySelectorAll('.kpi')
    for (var i = 0; i < lista.length; i++) adornar(lista[i])
  }

  // El estilo del ícono va acá y no en estilo.css: así también se ve bien en
  // las páginas que no cargan la hoja común.
  var css = document.createElement('style')
  css.textContent =
    '.kpi-ico{display:flex;align-items:center;justify-content:center;width:34px;height:34px;' +
    'border-radius:11px;margin-bottom:10px;color:var(--c);' +
    'background:color-mix(in srgb,var(--c) 13%,#fff)}' +
    '.kpi-ico svg{width:18px;height:18px;display:block}' +
    '.tabla-desliza{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}' +
    '@media print{.kpi-ico{display:none}.tabla-desliza{overflow:visible}}'
  document.head.appendChild(css)

  // Tablas más anchas que la pantalla (el gestor de precios, la calculadora
  // de comisiones): en vez de que se corra la página entera de costado, que
  // en el celular se ve como un zoom que no se va, la tabla se desplaza sola
  // adentro de una caja del ancho de la pantalla.
  function contenerTablas() {
    var tablas = document.querySelectorAll('table')
    for (var i = 0; i < tablas.length; i++) {
      var t = tablas[i]
      var padre = t.parentElement
      if (!padre || padre.classList.contains('tabla-desliza')) continue
      var ancho = document.documentElement.clientWidth
      if (t.getBoundingClientRect().right <= ancho + 2) continue
      var caja = document.createElement('div')
      caja.className = 'tabla-desliza'
      padre.insertBefore(caja, t)
      caja.appendChild(t)
    }
  }
  var tablasProgramadas = false
  function programarTablas() {
    if (tablasProgramadas) return
    tablasProgramadas = true
    setTimeout(function () { tablasProgramadas = false; contenerTablas() }, 300)
  }
  window.addEventListener('resize', programarTablas)

  function arrancar() {
    programarTablas()
    recorrer(document.body)
    // Algunas fichas se arman cuando llegan los datos.
    new MutationObserver(function (cambios) {
      for (var i = 0; i < cambios.length; i++) {
        var nuevos = cambios[i].addedNodes
        for (var j = 0; j < nuevos.length; j++) if (nuevos[j].nodeType === 1) recorrer(nuevos[j])
      }
      programarTablas()
    }).observe(document.body, { childList: true, subtree: true })
  }
  if (document.body) arrancar()
  else document.addEventListener('DOMContentLoaded', arrancar)
})()

// Compartir fichas técnicas (fichas_tecnicas.html, la regenera la
// sincronización de Nicolás y no se puede tocar).
//
// Los PDF pesan de 3 a 16 MB. El botón original bajaba el archivo entero sin
// avisar nada y recién ahí abría el compartir del teléfono: con datos móviles
// tardaba varios segundos, el iPhone ya no aceptaba abrir el compartir porque
// "pasó mucho desde el toque" y no pasaba nada o salía una descarga rara.
//
// Acá se toma el botón antes que su propio código: se muestra el avance y,
// cuando la ficha llega, un botón para compartirla (un toque nuevo, que el
// teléfono sí acepta) y otro para guardarla. La ficha queda guardada en el
// teléfono, así que la segunda vez se comparte en el acto.
// (El punto y coma de adelante hace falta: el bloque de arriba termina en
// "})()" y sin él se leerían como una sola llamada.)
;(function () {
  if (!/fichas_tecnicas\.html$/.test(location.pathname)) return

  var CACHE = 'byd-fichas-v1'
  var listas = {} // url -> Blob ya bajado

  // Si el almacenamiento del navegador no contesta enseguida (pasa en modo
  // privado y en algunos navegadores), se baja la ficha igual: guardarla es
  // una ayuda, no un paso obligatorio.
  function guardada(url) {
    if (!('caches' in window)) return Promise.resolve(null)
    var buscar = caches.open(CACHE)
      .then(function (c) { return c.match(url) })
      .then(function (r) { return r ? r.blob() : null })
      .catch(function () { return null })
    var espera = new Promise(function (listo) { setTimeout(function () { listo(null) }, 800) })
    return Promise.race([buscar, espera])
  }

  // Baja el PDF contando los bytes para mostrar el porcentaje.
  function bajar(url, avance) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status)
      var total = Number(res.headers.get('content-length')) || 0
      if (!res.body || !res.body.getReader) return res.blob()
      var lector = res.body.getReader()
      var partes = []
      var recibidos = 0
      return (function leer() {
        return lector.read().then(function (r) {
          if (r.done) return new Blob(partes, { type: 'application/pdf' })
          partes.push(r.value)
          recibidos += r.value.length
          avance(recibidos, total)
          return leer()
        })
      })()
    }).then(function (blob) {
      try {
        if ('caches' in window) {
          caches.open(CACHE).then(function (c) {
            c.put(url, new Response(blob, { headers: { 'Content-Type': 'application/pdf' } }))
          }).catch(function () {})
        }
      } catch (e) {}
      return blob
    })
  }

  function guardarArchivo(blob, nombre) {
    var a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = nombre
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(function () { URL.revokeObjectURL(a.href) }, 60000)
  }

  function compartir(blob, nombre) {
    var archivo = new File([blob], nombre, { type: 'application/pdf' })
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [archivo] })) {
      navigator.share({ files: [archivo] }).catch(function (err) {
        if (err && err.name === 'AbortError') return
        guardarArchivo(blob, nombre)
      })
      return
    }
    guardarArchivo(blob, nombre)
  }

  // ---- la ventanita de abajo
  var css = document.createElement('style')
  css.textContent =
    '#fichaHoja{position:fixed;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:1000000;' +
    'max-width:420px;margin:0 auto;background:#1b1c1e;color:#fff;border-radius:16px;padding:14px 16px;' +
    'font-family:Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);display:none}' +
    '#fichaHoja.ver{display:block}' +
    '#fichaHoja .t{font-size:14px;font-weight:700;margin:0 0 4px}' +
    '#fichaHoja .s{font-size:12px;opacity:.75;margin:0}' +
    '#fichaHoja .barra{height:6px;border-radius:99px;background:rgba(255,255,255,.15);margin-top:10px;overflow:hidden}' +
    '#fichaHoja .barra i{display:block;height:100%;width:0;background:#3b9fe8;border-radius:99px;transition:width .2s}' +
    '#fichaHoja .acc{display:flex;gap:8px;margin-top:12px}' +
    '#fichaHoja .acc button{flex:1;padding:11px;border-radius:999px;border:0;font:700 14px Inter,system-ui,sans-serif;cursor:pointer}' +
    '#fichaHoja .si{background:linear-gradient(90deg,#3b9fe8,#2166ab);color:#fff}' +
    '#fichaHoja .no{background:rgba(255,255,255,.12);color:#fff}'
  document.head.appendChild(css)

  var hoja = document.createElement('div')
  hoja.id = 'fichaHoja'
  // Ya es oscura: el modo oscuro de tema.js no la da vuelta.
  hoja.className = 'tema-conserva'
  hoja.setAttribute('role', 'status')
  var pedido = 0 // el último toque; uno cancelado o viejo no muestra nada

  function mostrar(html) {
    if (!hoja.isConnected) document.body.appendChild(hoja)
    hoja.innerHTML = html
    hoja.classList.add('ver')
  }
  function cerrar() { hoja.classList.remove('ver'); pedido++ }
  var mb = function (n) { return (n / 1048576).toFixed(1).replace('.', ',') + ' MB' }
  var esc = function (t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] })
  }

  function ofrecer(blob, nombre, titulo) {
    mostrar(
      '<p class="t">' + esc(titulo) + ' está lista</p>' +
      '<p class="s">' + mb(blob.size) + '</p>' +
      '<div class="acc"><button type="button" class="no" data-a="guardar">Guardar</button>' +
      '<button type="button" class="si" data-a="compartir">Compartir</button></div>'
    )
    hoja.querySelector('[data-a="compartir"]').onclick = function () { cerrar(); compartir(blob, nombre) }
    hoja.querySelector('[data-a="guardar"]').onclick = function () { cerrar(); guardarArchivo(blob, nombre) }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ficha-btn.compartir')
    if (!btn) return
    e.preventDefault()
    e.stopImmediatePropagation()

    var titulo = btn.dataset.nombre || 'La ficha'
    var nombre = titulo + '.pdf'
    var url = new URL(btn.dataset.url, location.href).href

    // Ya bajada: se comparte con este mismo toque.
    if (listas[url]) { compartir(listas[url], nombre); return }

    var este = ++pedido
    mostrar(
      '<p class="t">Bajando ' + esc(titulo) + '…</p><p class="s" id="fichaAvance">Un momento</p>' +
      '<div class="barra"><i id="fichaBarra"></i></div>' +
      '<div class="acc"><button type="button" class="no" data-a="cancelar">Cancelar</button></div>'
    )
    hoja.querySelector('[data-a="cancelar"]').onclick = cerrar

    guardada(url)
      .then(function (blob) {
        return blob || bajar(url, function (rec, total) {
          if (este !== pedido) return
          var av = document.getElementById('fichaAvance')
          var barra = document.getElementById('fichaBarra')
          if (av) av.textContent = total ? mb(rec) + ' de ' + mb(total) : mb(rec)
          if (barra && total) barra.style.width = Math.round((rec / total) * 100) + '%'
        })
      })
      .then(function (blob) {
        listas[url] = blob
        if (este === pedido) ofrecer(blob, nombre, titulo)
      })
      .catch(function () {
        if (este !== pedido) return
        mostrar(
          '<p class="t">No se pudo bajar la ficha</p><p class="s">Revisá la conexión y probá de nuevo.</p>' +
          '<div class="acc"><button type="button" class="no" data-a="cerrar">Cerrar</button></div>'
        )
        hoja.querySelector('[data-a="cerrar"]').onclick = cerrar
      })
  }, true)

  // Las que ya se bajaron alguna vez quedan listas en memoria al abrir la
  // página: así Compartir abre el compartir del teléfono en el mismo toque.
  if ('caches' in window) {
    caches.open(CACHE).then(function (c) {
      return c.keys().then(function (claves) {
        claves.forEach(function (req) {
          c.match(req).then(function (r) { return r && r.blob() }).then(function (b) { if (b) listas[req.url] = b })
        })
      })
    }).catch(function () {})
  }
})()

// Fichas Técnicas más prolijas (pedido de Lucía, 15/10).
//
// fichas_tecnicas.html y calculadora_carga.html las regenera la sincronización
// de Nicolás: no se reescriben, se les suma esta hoja de estilos encima. Va
// todo dentro de @media screen, así que imprimir sale igual que siempre. Si
// este archivo no carga, las páginas se ven como antes.
;(function () {
  var ruta = location.pathname
  var esFichas = /fichas_tecnicas\.html$/.test(ruta)
  var esCarga = /calculadora_carga\.html$/.test(ruta)
  if (!esFichas && !esCarga) return

  if (!document.querySelector('link[href*="family=Inter"]')) {
    var fuente = document.createElement('link')
    fuente.rel = 'stylesheet'
    fuente.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
    document.head.appendChild(fuente)
  }

  // Estilo de la referencia que mandó Lucía: fondo grafito, tarjetas oscuras
  // muy redondeadas, pastillas blancas con la activa en celeste y botones
  // redondos. El celeste es claro: lo que va encima siempre en tinta oscura.
  var FONDO = '#121418', PANEL = '#1e2228', PANEL2 = '#272c33', BORDE = 'rgba(255,255,255,.07)'
  var TINTA = '#f4f5f6', SUAVE = '#a3a9b1', TENUE = '#6f767f', LIMA = '#ccf656', SOBRE = '#1b1c1e'
  // Celeste BYD para lo principal (Lucía, 15/10); el lima, sólo en detalles
  // chicos: el "BYD" de cada ficha y el VS.
  var CELESTE = '#45b6f7'
  var FLECHA = 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23a3a9b1%27 stroke-width=%272.2%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E")'

  var css =
    '@media screen{' +
    // La página ya es oscura: el modo oscuro del hub (tema.js, que invierte
    // todo) acá no hace nada, si no la daría vuelta a clara.
    'html[data-tema][data-tema],html[data-tema][data-tema] *{filter:none !important}' +
    'html[data-tema][data-tema],html[data-tema][data-tema] body{background:' + FONDO + ' !important}' +
    'html.embebido[data-tema][data-tema],html.embebido[data-tema][data-tema] body{background:transparent !important}' +
    'html{background:' + FONDO + '}' +
    'body{background:' + FONDO + ';color:' + TINTA + ';font-family:Inter,"Segoe UI",Arial,sans-serif;-webkit-font-smoothing:antialiased}' +
    'body.embebido{background:transparent}' +
    '.app-topbar{background:' + FONDO + ';border-bottom:1px solid ' + BORDE + '}' +

    // Título
    '.title-block{padding:28px 20px 16px}' +
    '.title-block h1{font-size:30px;font-weight:500;letter-spacing:-.03em;color:' + TINTA + ';margin:0 0 6px}' +
    '.title-block p{font-size:13.5px;color:' + SUAVE + '}' +

    // Volver: botón redondo blanco
    '#hubBackBtn{background:#fff !important;color:' + SOBRE + ' !important;box-shadow:0 6px 18px rgba(0,0,0,.45) !important}' +

    // Solapas: pastilla blanca, la activa en celeste
    '.tabs-switch{display:flex;flex-wrap:nowrap;gap:2px;margin:4px 20px 22px;padding:5px;background:#fff;border-radius:999px;max-width:560px;box-shadow:0 0 0 4px ' + PANEL + '}' +
    '.tab-btn{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;gap:7px;border:0;background:transparent;border-radius:999px;' +
    'padding:10px 12px;font-family:inherit;font-size:13px;font-weight:600;color:#5c6167;white-space:nowrap;transition:background .15s,color .15s}' +
    '.tab-btn svg{width:16px;height:16px;flex:none}' +
    '.tab-btn:hover{color:' + SOBRE + ';background:#f0f2f5}' +
    '.tab-btn.active,.tab-btn.active:hover{background:' + CELESTE + ';color:' + SOBRE + '}' +
    '.tab-btn .corto{display:none}' +
    '@media (max-width:520px){.tab-btn .largo{display:none}.tab-btn .corto{display:inline}.tab-btn{padding:10px 8px}}' +

    // Fichas
    '.fichas-cuenta{display:flex;align-items:center;gap:8px;margin:0 20px 4px;font-size:14px;font-weight:500;color:' + TINTA + '}' +
    '.fichas-cuenta b{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#fff;color:' + SOBRE + ';font-size:11px;font-weight:700}' +
    '.ficha-grid{gap:14px;padding:12px 20px 24px}' +
    '.ficha-card{border:1px solid ' + BORDE + ';border-radius:22px;background:' + PANEL + ';box-shadow:0 18px 40px -22px rgba(0,0,0,.9);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}' +
    '.ficha-card:hover{transform:translateY(-3px);border-color:rgba(69,182,247,.45);box-shadow:0 22px 44px -20px rgba(0,0,0,.95),0 0 0 4px rgba(69,182,247,.06)}' +
    '.ficha-btn.ver{box-shadow:0 8px 20px -10px rgba(69,182,247,.7)}' +
    '.tab-btn.active{box-shadow:0 6px 16px -8px rgba(40,150,220,.8)}' +
    '.carga-hero{box-shadow:0 16px 36px -18px rgba(69,182,247,.55)}' +
    '.escenario,.compare-selectors,.compare-table tbody tr{box-shadow:0 18px 40px -24px rgba(0,0,0,.9)}' +
    '.ficha-cover{position:relative;margin:8px 8px 0;border-radius:16px;background:' + PANEL2 + '}' +
    '.ficha-cover img{transition:transform .4s ease}' +
    '.ficha-card:hover .ficha-cover img{transform:scale(1.04)}' +
    '.ficha-cover::after{content:"PDF";position:absolute;top:8px;right:8px;padding:3px 9px;border-radius:999px;background:rgba(18,20,24,.78);' +
    'color:' + TINTA + ';font:700 10px/1.4 Inter,sans-serif;letter-spacing:.08em}' +
    '.ficha-info{padding:12px 12px 14px}' +
    '.ficha-nombre{min-height:0;margin-bottom:12px;font-size:15px;font-weight:600;letter-spacing:-.01em;line-height:1.25;color:' + TINTA + '}' +
    '.ficha-nombre .marca{display:block;margin-bottom:3px;font-size:10.5px;font-weight:700;letter-spacing:.12em;color:' + LIMA + '}' +
    '.ficha-actions{gap:6px}' +
    '.ficha-btn{display:flex;align-items:center;justify-content:center;gap:6px;border-radius:999px;padding:9px 8px;font-family:inherit;font-size:12.5px;font-weight:600;transition:filter .15s,background .15s}' +
    '.ficha-btn svg{width:15px;height:15px;flex:none}' +
    '.ficha-btn.ver{background:' + CELESTE + ';color:' + SOBRE + '}' +
    '.ficha-btn.ver:hover{filter:brightness(1.05)}' +
    '.ficha-btn.compartir{border:1px solid rgba(255,255,255,.14);background:transparent;color:' + TINTA + '}' +
    '.ficha-btn.compartir:hover{background:' + PANEL2 + '}' +

    // Selectores (Comparar y Calculadora)
    '.compare-selectors{position:relative;gap:40px;margin:0 20px 16px;padding:16px !important;background:' + PANEL + ';border:1px solid ' + BORDE + ';border-radius:22px}' +
    '.carga-wrap .compare-selectors{margin:0 0 14px;gap:12px}' +
    '.compare-select-group label{font-size:10.5px;letter-spacing:.1em;color:' + TENUE + '}' +
    '.compare-select-group select{-webkit-appearance:none;appearance:none;padding:12px 36px 12px 16px;border:1px solid ' + BORDE + ';border-radius:999px;' +
    'background:' + PANEL2 + ' ' + FLECHA + ' no-repeat right 12px center/16px;font-size:14px;font-weight:600;color:' + TINTA + ';cursor:pointer}' +
    '.compare-select-group select:focus{outline:none;border-color:' + CELESTE + '}' +
    '.compare-select-group select option,.compare-select-group select optgroup{background:' + PANEL + ';color:' + TINTA + '}' +
    '#compareContent .compare-select-group label::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}' +
    '#compareContent .compare-select-group:first-child label::before{background:' + CELESTE + '}' +
    '#compareContent .compare-select-group:nth-child(2) label::before{background:#fff}' +
    '.compare-vs{position:absolute;left:50%;top:61px;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:50%;background:' + LIMA + ';color:' + SOBRE + ';' +
    'display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;letter-spacing:.04em;box-shadow:0 0 0 4px ' + PANEL + '}' +

    // Comparativa (rehecha el 15/10 porque la tabla de tres columnas quedaba
    // apretada en el celular). La tabla la arma la página de Nicolás; acá
    // sólo se cambia cómo se ve: arriba los dos modelos como pastillas que
    // quedan fijas al bajar, y cada característica en su propia tarjeta con
    // el nombre chiquito arriba y los dos valores lado a lado.
    '.compare-table-wrap{margin:0 20px 28px;padding:0 !important;overflow:visible !important;background:transparent;max-width:760px}' +
    '.compare-table,.compare-table thead,.compare-table tbody{display:block;width:100%}' +
    '.compare-table{border:0;background:transparent;box-shadow:none;border-radius:0;color:' + TINTA + '}' +
    // Encabezado: las dos pastillas, pegadas arriba al bajar
    '.compare-table thead{position:sticky;top:0;z-index:3;padding:10px 0;background:' + FONDO + '}' +
    '.compare-table thead tr{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
    '.compare-table thead th{display:flex;align-items:center;gap:8px;min-width:0;padding:12px 14px;border:0;border-radius:16px;box-shadow:none;' +
    'font-size:14px;font-weight:700;line-height:1.2;letter-spacing:-.01em;text-transform:none;overflow-wrap:anywhere}' +
    '.compare-table thead th:first-child{display:none}' +
    '.compare-table thead th:nth-child(2){background:' + CELESTE + ';color:' + SOBRE + '}' +
    '.compare-table thead th:nth-child(3){background:#fff;color:' + SOBRE + '}' +
    '.compare-table thead th::before{content:"A";flex:none;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;' +
    'background:' + SOBRE + ';color:#fff;font-size:10px;font-weight:800}' +
    '.compare-table thead th:nth-child(3)::before{content:"B"}' +
    // Cada característica, una tarjeta
    '.compare-table tbody{display:grid;gap:8px;margin-top:4px}' +
    '.compare-table tbody tr{display:grid;grid-template-columns:1fr 1fr;column-gap:8px;row-gap:6px;padding:12px 14px 14px;border:1px solid ' + BORDE + ';' +
    'border-radius:18px;background:' + PANEL + ';transition:border-color .15s}' +
    '.compare-table tbody tr:hover{background:' + PANEL + ';border-color:rgba(69,182,247,.4)}' +
    '.compare-table tbody th,.compare-table tbody td{display:block;padding:0;border:0;background:transparent;text-align:left;overflow-wrap:anywhere}' +
    '.compare-table tbody th{grid-column:1/-1;color:' + TENUE + ';font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;white-space:normal}' +
    '.compare-table tbody td{position:relative;padding-left:12px;color:' + TINTA + ';font-size:15px;font-weight:600;line-height:1.3;font-variant-numeric:tabular-nums}' +
    '.compare-table tbody td::before{content:"";position:absolute;left:0;top:3px;bottom:3px;width:3px;border-radius:3px;background:' + CELESTE + '}' +
    '.compare-table tbody td:last-child::before{background:#fff}' +
    // Selectores apilados en el celular, con el VS al costado
    '@media (max-width:520px){' +
    '#compareContent .compare-selectors{flex-direction:column;gap:26px;padding:14px !important}' +
    '.compare-vs{top:50%;left:auto;right:28px;transform:translateY(-50%)}' +
    '.compare-table tbody td{font-size:14px}' +
    '}' +
    '.compare-row-moto td{font-weight:700}' +
    '.compare-empty{margin:0 20px;border-radius:22px;background:' + PANEL + ';color:' + SUAVE + '}' +

    // Calculadora de carga
    '.carga-chips{gap:6px}' +
    '.carga-chip{border:1px solid ' + BORDE + ';border-radius:999px;padding:6px 12px;background:' + PANEL + ';font-size:12px;font-weight:600;color:' + TINTA + '}' +
    '.carga-chip.si{background:rgba(69,182,247,.14);border-color:rgba(69,182,247,.35);color:' + CELESTE + '}' +
    '.carga-chip.no{background:rgba(214,72,58,.15);border-color:rgba(214,72,58,.35);color:#ff8a7d}' +
    '.carga-aviso{border-radius:16px;background:rgba(181,124,23,.16);border-color:rgba(181,124,23,.4);color:#f0c46a}' +
    '.carga-aviso.error{background:rgba(214,72,58,.15);border-color:rgba(214,72,58,.35);color:#ff8a7d}' +
    '.carga-hero{border-radius:24px;padding:20px 22px;background:' + CELESTE + ';color:' + SOBRE + '}' +
    '.carga-hero .c,.carga-hero .kw span{color:rgba(27,28,30,.7)}' +
    '.carga-hero .kw b{font-size:36px;font-weight:700;letter-spacing:-.02em}' +
    '.carga-leyenda{font-weight:500;color:' + SUAVE + '}' +
    '.carga-leyenda i{border-radius:50%}' +
    '.carga-leyenda span:nth-child(1) i{background:#ff6b5b !important}' +
    '.carga-leyenda span:nth-child(2) i{background:#fff !important}' +
    '.carga-leyenda span:nth-child(3) i{background:' + CELESTE + ' !important}' +
    '.escenario{border:1px solid ' + BORDE + ' !important;border-radius:22px;padding:16px 18px;background:' + PANEL + '}' +
    '.esc-rojo{--esc:#ff6b5b}.esc-azul{--esc:#ffffff}.esc-verde{--esc:' + CELESTE + '}' +
    '.escenario .tiempo b{color:var(--esc) !important;font-weight:700}' +
    '.escenario .esc-barra>div,.escenario .pista>div{background:var(--esc) !important}' +
    '.esc-top .desde{font-size:10.5px;letter-spacing:.1em;color:' + TENUE + '}' +
    '.esc-top .desde b{font-size:28px;font-weight:600;letter-spacing:-.02em;color:' + TINTA + '}' +
    '.esc-top .tiempo span,.esc-bateria{color:' + TENUE + '}' +
    '.esc-barra{height:10px;border-radius:999px;background:' + PANEL2 + '}' +
    '.esc-barra>div{border-radius:999px}' +
    '.esc-bateria .pista{height:6px;border-radius:999px;background:' + PANEL2 + '}' +
    '.carga-nota{color:' + TENUE + '}' +

    // Entrada al abrir: título, solapas y fichas suben una detrás de la otra.
    // Relleno "backwards": al terminar no queda ningún transform puesto.
    '@keyframes fichas-entrar{from{opacity:0;transform:translateY(16px)}}' +
    '@media (prefers-reduced-motion:no-preference){' +
    '.title-block,.tabs-switch,.fichas-cuenta,.ficha-card,.compare-selectors,.compare-table-wrap,.carga-hero,.escenario{animation:fichas-entrar .55s cubic-bezier(.2,.8,.2,1) backwards}' +
    '.tabs-switch{animation-delay:.06s}.fichas-cuenta{animation-delay:.1s}' +
    '.ficha-card:nth-child(1){animation-delay:.14s}.ficha-card:nth-child(2){animation-delay:.19s}' +
    '.ficha-card:nth-child(3){animation-delay:.24s}.ficha-card:nth-child(4){animation-delay:.29s}' +
    '.ficha-card:nth-child(5){animation-delay:.34s}.ficha-card:nth-child(6){animation-delay:.39s}' +
    '.ficha-card:nth-child(n+7){animation-delay:.44s}' +
    '.compare-table-wrap{animation-delay:.08s}' +
    '.escenario:nth-of-type(2){animation-delay:.06s}.escenario:nth-of-type(3){animation-delay:.12s}' +
    '}' +
    '}'

  var hoja = document.createElement('style')
  hoja.id = 'fichasLindas'
  hoja.textContent = css
  document.head.appendChild(hoja)

  if (!esFichas) return

  var S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  var ICONOS = {
    fichas: S + '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h4"/></svg>',
    comparar: S + '<path d="M8 4v16M16 4v16M4 8h4M16 16h4"/></svg>',
    carga: S + '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
    ver: S + '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    compartir: S + '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/></svg>',
  }
  var CORTO = { fichas: 'Fichas', comparar: 'Comparar', carga: 'Carga' }

  function adornar() {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(function (b) {
      if (b.getAttribute('data-lindo')) return
      var clave = b.getAttribute('data-tab')
      var largo = document.createElement('span')
      largo.className = 'largo'
      largo.textContent = b.textContent.trim()
      var corto = document.createElement('span')
      corto.className = 'corto'
      corto.textContent = CORTO[clave] || largo.textContent
      b.innerHTML = ICONOS[clave] || ''
      b.appendChild(largo)
      b.appendChild(corto)
      b.setAttribute('data-lindo', '1')
    })

    var grilla = document.querySelector('#view-fichas .ficha-grid')
    if (grilla && !document.querySelector('.fichas-cuenta')) {
      var n = grilla.querySelectorAll('.ficha-card').length
      if (n) {
        var cuenta = document.createElement('p')
        cuenta.className = 'fichas-cuenta'
        cuenta.innerHTML = 'Modelos <b>' + n + '</b>'
        grilla.parentNode.insertBefore(cuenta, grilla)
      }
    }

    // "BYD - ATTO 2" → la marca chiquita arriba y el modelo grande.
    document.querySelectorAll('.ficha-nombre').forEach(function (el) {
      if (el.getAttribute('data-lindo')) return
      var m = /^\s*BYD[\s\-–·]*(.+)$/i.exec(el.textContent)
      if (m) {
        el.innerHTML = '<span class="marca">BYD</span>'
        el.appendChild(document.createTextNode(m[1].replace(/-/g, ' ').trim()))
      }
      el.setAttribute('data-lindo', '1')
    })

    document.querySelectorAll('.ficha-btn').forEach(function (b) {
      if (b.getAttribute('data-lindo')) return
      var tipo = b.classList.contains('ver') ? 'ver' : b.classList.contains('compartir') ? 'compartir' : ''
      if (tipo) b.insertAdjacentHTML('afterbegin', ICONOS[tipo])
      b.setAttribute('data-lindo', '1')
    })

    var sel = document.querySelector('#compareContent .compare-selectors')
    if (sel && !sel.querySelector('.compare-vs')) {
      var vs = document.createElement('span')
      vs.className = 'compare-vs'
      vs.setAttribute('aria-hidden', 'true')
      vs.textContent = 'VS'
      sel.appendChild(vs)
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', adornar)
  else adornar()
})()

// ── Tortas en 3D (15/10, Lucía: "gráficos más copados, más 3D") ──────────
// Las páginas pintan cada torta como un degradé cónico en el estilo del
// .pie-chart. Acá se lee ese degradé y se dibuja encima una dona inclinada en
// SVG, con tapa en degradé, costado con espesor y sombra en el piso. El
// degradé queda en el estilo (estilo.css lo apaga con la clase torta3d): el
// PDF del Tablero lo sigue usando, y cuando lo cambia por transparente la
// dona 3D se saca sola y vuelve al terminar.
// Los colores viejos de las tortas se cambian por los del Portal, en la
// torta y en los puntitos de su leyenda, así coinciden.
;(function () {
  var NUEVO = {
    '#1565d8': '#2f7fe6', '#388e3c': '#22a06b', '#d89614': '#f08a1c', '#6a3fa0': '#7b5cf0',
    '#c0392b': '#e0457b', '#0e7c86': '#0b8577', '#b8860b': '#e0b000', '#5b7f9e': '#5aa8ff',
    '#8c8c8c': '#9aa3ad', '#d46a6a': '#f06f9e', '#3e8e7e': '#2cc2a0', '#9b59b6': '#b06ae8',
    '#1a1a1a': '#4d6cf2', '#1b3b6f': '#2f7fe6', '#d4a017': '#f08a1c', '#17a398': '#0b8577'
  }
  function color(c) { return NUEVO[String(c).trim().toLowerCase()] || String(c).trim() }
  // Aclara (cuanto > 0) u oscurece un color. Se calcula acá y no con
  // color-mix() porque el PDF (html2canvas) no lo entiende.
  function tono(c, cuanto) {
    var m = /^#([0-9a-f]{6})$/i.exec(c)
    if (!m) return c
    var n = parseInt(m[1], 16), destino = cuanto > 0 ? 255 : 0, k = Math.abs(cuanto) / 100
    return '#' + [16, 8, 0].map(function (sh) {
      var v = (n >> sh) & 255
      return ('0' + Math.round(v + (destino - v) * k).toString(16)).slice(-2)
    }).join('')
  }

  var ANCHO = 240, CX = 120, RX = 108, RY = 62, HUECO = 0.58, ESPESOR = 20, AIRE = 6
  var CY = RY + AIRE, ALTO = CY + RY + ESPESOR + AIRE
  var NS = 'http://www.w3.org/2000/svg'
  var cuenta = 0

  function punto(rx, ry, a, bajar) {
    return (CX + rx * Math.cos(a)).toFixed(2) + ' ' + (CY + ry * Math.sin(a) + (bajar || 0)).toFixed(2)
  }
  // Partido al medio: ningún arco pasa de media vuelta, y una sola porción
  // (la vuelta entera) también se dibuja.
  function arco(rx, ry, desde, hasta, sentido, bajar) {
    var m = (desde + hasta) / 2, fin = sentido ? hasta : desde
    return 'A ' + rx + ' ' + ry + ' 0 0 ' + sentido + ' ' + punto(rx, ry, m, bajar) +
      ' A ' + rx + ' ' + ry + ' 0 0 ' + sentido + ' ' + punto(rx, ry, fin, bajar)
  }
  function tapa(d, h) {
    var irx = RX * HUECO, iry = RY * HUECO
    return 'M ' + punto(RX, RY, d) + ' ' + arco(RX, RY, d, h, 1) + ' L ' + punto(irx, iry, h) + ' ' + arco(irx, iry, d, h, 0) + ' Z'
  }
  function pared(rx, ry, d, h) {
    return 'M ' + punto(rx, ry, d) + ' ' + arco(rx, ry, d, h, 1) + ' L ' + punto(rx, ry, h, ESPESOR) + ' ' + arco(rx, ry, d, h, 0, ESPESOR) + ' Z'
  }
  function recortar(d, h, min, max) {
    var a = Math.max(d, min), b = Math.min(h, max)
    return b - a > 0.001 ? [a, b] : null
  }

  // Chrome devuelve el degradé reescrito: colores en rgb() y cada tramo
  // partido en dos puntos ("rgb(…) 0deg, rgb(…) 144deg"). Safari lo deja como
  // se escribió ("#hex 0deg 144deg"). Un tramo es un par de puntos seguidos
  // del mismo color, y así valen las dos formas.
  function leer(el) {
    var bg = el.style.background || el.style.backgroundImage || ''
    var m = /conic-gradient\((.*)\)\s*$/.exec(bg)
    if (!m) return null
    var puntos = []
    m[1].split(/,(?![^(]*\))/).forEach(function (t) {
      var p = /^(.*?)((?:\s+-?[\d.]+deg){1,2})$/.exec(t.trim())
      if (!p) return
      var c = p[1].trim(), rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c)
      if (rgb) c = '#' + [1, 2, 3].map(function (k) { return ('0' + (+rgb[k]).toString(16)).slice(-2) }).join('')
      p[2].trim().split(/\s+/).forEach(function (g) { puntos.push({ c: c.toLowerCase(), g: parseFloat(g) }) })
    })
    var tramos = []
    for (var i = 0; i + 1 < puntos.length; i++) {
      if (puntos[i].c === puntos[i + 1].c && puntos[i + 1].g > puntos[i].g)
        tramos.push({ color: color(puntos[i].c), desde: puntos[i].g, hasta: puntos[i + 1].g })
    }
    return tramos.length ? tramos : null
  }

  function dibujar(el, tramos) {
    var id = 'torta3d' + (++cuenta)
    var INI = -Math.PI / 2, RAD = Math.PI / 180
    var ps = tramos.map(function (t) { return { c: t.color, d: INI + t.desde * RAD, h: INI + t.hasta * RAD } })
      .filter(function (p) { return p.h - p.d > 0.0001 })
    var defs = ps.map(function (p, i) {
      return '<linearGradient id="' + id + 'p' + i + '" x1="0" y1="0" x2="0.35" y2="1">' +
        '<stop offset="0%" style="stop-color:' + tono(p.c, 38) + '"/><stop offset="100%" style="stop-color:' + p.c + '"/></linearGradient>'
    }).join('') +
      '<radialGradient id="' + id + 'piso"><stop offset="0%" stop-color="#000" stop-opacity=".16"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient>'
    var adentro = '', afuera = '', tapas = ''
    ps.forEach(function (p, i) {
      [recortar(p.d, p.h, -Math.PI / 2, 0), recortar(p.d, p.h, Math.PI, 1.5 * Math.PI)].forEach(function (r) {
        if (r) adentro += '<path d="' + pared(RX * HUECO, RY * HUECO, r[0], r[1]) + '" style="fill:' + tono(p.c, -45) + '"/>'
      })
      var f = recortar(p.d, p.h, 0, Math.PI)
      if (f) afuera += '<path d="' + pared(RX, RY, f[0], f[1]) + '" style="fill:' + tono(p.c, -30) + ';stroke:' + tono(p.c, -38) + '" stroke-width=".6"/>'
      tapas += '<path class="tapa" d="' + tapa(p.d, p.h) + '" fill="url(#' + id + 'p' + i + ')" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>'
    })
    var svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('class', 'torta3d-svg')
    svg.setAttribute('viewBox', '0 0 ' + ANCHO + ' ' + ALTO)
    svg.setAttribute('aria-hidden', 'true')
    svg.innerHTML = '<defs>' + defs + '</defs>' +
      '<ellipse cx="' + CX + '" cy="' + (CY + ESPESOR + 10) + '" rx="' + (RX * 1.02) + '" ry="' + (RY * 0.85) + '" fill="url(#' + id + 'piso)"/>' +
      adentro + afuera + tapas
    return svg
  }

  function repintar(el) {
    // La leyenda se repasa siempre: la página puede rearmarla sin cambiar la torta.
    var leyenda = el.parentNode && el.parentNode.querySelector('.pie-legend')
    if (leyenda) Array.prototype.forEach.call(leyenda.querySelectorAll('.dot'), function (dot) {
      var c = dot.style.backgroundColor
      var hex = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(c)
      if (hex) c = '#' + [1, 2, 3].map(function (k) { return ('0' + (+hex[k]).toString(16)).slice(-2) }).join('')
      var n = NUEVO[c.toLowerCase()]
      if (n) dot.style.background = n
    })

    var bg = el.style.background || el.style.backgroundImage || ''
    if (el._torta3d === bg) return
    el._torta3d = bg
    var viejo = el.querySelector(':scope > svg.torta3d-svg')
    if (viejo) el.removeChild(viejo)
    var tramos = leer(el)
    if (!tramos) { el.classList.remove('torta3d'); return }
    el.classList.add('torta3d')
    el.appendChild(dibujar(el, tramos))
  }

  // El PDF del Tablero (index.html) pide la dona para ponerla en lugar del
  // degradé cónico, que html2canvas no sabe dibujar.
  window.bydTorta3d = function (el) {
    var tramos = leer(el)
    return tramos ? dibujar(el, tramos) : null
  }

  // Se mira cada cambio: las páginas vuelven a pintar las tortas al cambiar
  // de mes, de vendedor o de solapa. El observador corre antes de que el PDF
  // empiece a capturar, así nunca salen la torta plana y la 3D juntas.
  function revisar() { Array.prototype.forEach.call(document.querySelectorAll('.pie-chart'), repintar) }
  function arrancar() {
    revisar()
    new MutationObserver(revisar).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar)
  else arrancar()
})()

// ── Lista de precios en PDF (12/11, Lucía) ─────────────────────────────────
// lista_precios.html (Gerencia y jefe) y lista_precios_vendedores.html las
// regenera la sincronización de Nicolás y no se tocan: el botón se agrega
// desde acá. El PDF se arma en el momento con los mismos datos que guarda
// Gerencia en su Configuración (el Apps Script de Nicolás, sólo lectura), así
// que siempre sale con lo último guardado y con su fecha de vigencia, aunque
// la página todavía no se haya regenerado.
//
// Es el mismo PDF para todos y se puede pasar a cualquiera del equipo: lleva
// sólo las columnas que Gerencia habilitó para ventas y nunca el piso de
// gerencia.
;(function () {
  if (!/lista_precios(_vendedores)?\.html$/.test(location.pathname)) return

  var API = 'https://script.google.com/macros/s/AKfycbzTYBoM56BBMj2B-8hUG_MIuOh7r5qG4qq2sGlTRM-y6QyFm0XHqgE6XUG5OQB022iy/exec'
  var LLAVE = 'i4uH92SO1sFyNYi8PJ2dsGb9LDM-Xoq3'
  var JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'

  function api(accion) {
    return fetch(API + '?key=' + encodeURIComponent(LLAVE) + '&action=' + accion, { cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (d) { if (d && d.error) throw new Error(d.error); return d })
  }
  function cargarJsPDF() {
    if (window.jspdf) return Promise.resolve()
    return new Promise(function (listo, mal) {
      var s = document.createElement('script')
      s.src = JSPDF
      s.onload = function () { listo() }
      s.onerror = function () { mal(new Error('no se pudo cargar el generador de PDF')) }
      document.head.appendChild(s)
    })
  }

  // Mismas cuentas que la página de Gerencia.
  function lleno(m) { return (m.lista || 0) + (m.flete || 0) + (m.patentamiento || 0) }
  function promWeb(m) { return (lleno(m) + (m.web || 0)) / 2 }
  function pisoVenta(m) { return (m.pisoGerencia || 0) + 300 }
  function promPiso(m) { return ((m.web || 0) + pisoVenta(m)) / 2 }
  function usd(n) {
    if (n === null || n === undefined || isNaN(n)) return '—'
    return 'USD ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }
  function dos(n) { return ('0' + n).slice(-2) }
  // Fecha y hora de Mendoza, sin depender de la zona del teléfono.
  function ahora() {
    try {
      var p = {}
      new Intl.DateTimeFormat('es-AR', {
        timeZone: 'America/Argentina/Mendoza', day: '2-digit', month: '2-digit',
        year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value })
      return p.day + '/' + p.month + '/' + p.year + ' ' + p.hour + ':' + p.minute
    } catch (e) {
      var d = new Date()
      return dos(d.getDate()) + '/' + dos(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + dos(d.getHours()) + ':' + dos(d.getMinutes())
    }
  }

  // Colores de la página de Nicolás.
  var C = {
    negro: [10, 10, 10], tinta: [27, 28, 30], gris: [120, 126, 133], tenue: [150, 156, 162],
    linea: [226, 229, 232], fondo: [244, 245, 246], cabeza: [248, 249, 250],
    ev: [21, 101, 216], dm: [56, 142, 60],
    llenoF: [232, 245, 233], llenoT: [46, 125, 50],
    webF: [255, 246, 224], webT: [166, 112, 0],
    pisoF: [253, 236, 234], pisoT: [192, 57, 43]
  }

  function armar(datos, ocultos) {
    var cfg = datos.config || {}
    var vigencia = String(datos.vigencia || '').trim() || 'sin fecha cargada'
    var generado = ahora()

    // Columnas de autos: las mismas que Gerencia habilitó para ventas.
    var cols = [{ titulo: 'MODELO', peso: 2.3, izq: true, modelo: true }]
    if (cfg.lista !== false) cols.push({ titulo: 'LISTA', valor: function (m) { return m.lista }, fuerte: true })
    if (cfg.composicion !== false) {
      cols.push({ titulo: 'FLETE', valor: function (m) { return m.flete }, suave: true })
      cols.push({ titulo: 'PATENTAM.', valor: function (m) { return m.patentamiento }, suave: true })
    }
    if (cfg.lleno !== false) cols.push({ titulo: 'LLENO', valor: lleno, fondo: C.llenoF, color: C.llenoT, fuerte: true })
    if (cfg.promWeb) cols.push({ titulo: 'PROM. WEB', valor: promWeb })
    if (cfg.web) cols.push({ titulo: 'WEB', valor: function (m) { return m.web }, fondo: C.webF, color: C.webT, fuerte: true })
    if (cfg.promPiso) cols.push({ titulo: 'PROM. PISO', valor: promPiso })
    if (cfg.pisoVenta) cols.push({ titulo: 'PISO VENTA', valor: pisoVenta, fondo: C.pisoF, color: C.pisoT, fuerte: true })

    // Con muchas columnas los números no entran parados: la hoja va apaisada.
    var apaisada = cols.length > 7
    var pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: apaisada ? 'landscape' : 'portrait' })
    var AN = apaisada ? 297 : 210, AL = apaisada ? 210 : 297, MX = 12, ANCHO = AN - MX * 2
    var y = 0

    function rect(x, yy, w, h, color) {
      pdf.setFillColor(color[0], color[1], color[2])
      pdf.rect(x, yy, w, h, 'F')
    }
    function linea(yy) {
      pdf.setDrawColor(C.linea[0], C.linea[1], C.linea[2])
      pdf.setLineWidth(0.25)
      pdf.line(MX, yy, AN - MX, yy)
    }
    function fuente(negrita, tam) {
      pdf.setFont('helvetica', negrita ? 'bold' : 'normal')
      pdf.setFontSize(tam)
    }
    function texto(t, x, yy, op) {
      op = op || {}
      fuente(op.negrita, op.tam || 9)
      var c = op.color || C.tinta
      pdf.setTextColor(c[0], c[1], c[2])
      var o = { align: op.alinear || 'left' }
      // Con espaciado, jsPDF no corre el texto alineado a la derecha: sólo a la izquierda.
      if (op.espacio && o.align === 'left') o.charSpace = op.espacio
      if (op.max) o.maxWidth = op.max
      pdf.text(String(t), x, yy, o)
    }
    function repartir(columnas) {
      var total = columnas.reduce(function (s, c) { return s + (c.peso || 1) }, 0)
      var x = MX
      columnas.forEach(function (c) { c.x = x; c.w = ANCHO * (c.peso || 1) / total; x += c.w })
    }
    // Tamaño de letra para que el valor entre en su columna sin cortarse.
    function tamQueEntra(t, negrita, tam, ancho) {
      fuente(negrita, tam)
      while (tam > 6 && pdf.getTextWidth(String(t)) > ancho) { tam -= 0.25; fuente(negrita, tam) }
      return tam
    }
    repartir(cols)

    // Encabezado negro y referencias, en la primera hoja.
    rect(0, 0, AN, 34, C.negro)
    texto('BYD  |  YACOPINI', MX, 10, { negrita: true, tam: 8, color: [200, 200, 200], espacio: 0.6 })
    texto('Lista de Precios', MX, 21, { negrita: true, tam: 22, color: [255, 255, 255] })
    texto('Valores de referencia para el equipo de ventas. Uso interno — no distribuir fuera del concesionario.', MX, 28.5, { tam: 8.5, color: [205, 205, 205] })
    texto('VIGENCIA', AN - MX, 10, { negrita: true, tam: 7, color: [170, 170, 170], alinear: 'right', espacio: 0.6 })
    texto(vigencia, AN - MX, 16.5, { negrita: true, tam: 11, color: [255, 255, 255], alinear: 'right' })
    y = 34
    rect(0, y, AN, 10, C.fondo)
    var refs = [['EV — 100% eléctrico', C.ev, true], ['DM — Híbrido enchufable', C.dm, true]]
    cols.forEach(function (c) {
      if (c.titulo === 'LLENO') refs.push(['Precio Lleno', C.llenoT])
      if (c.titulo === 'WEB') refs.push(['Precio Web', C.webT])
      if (c.titulo === 'PISO VENTA') refs.push(['Piso de Venta', C.pisoT])
    })
    var rx = MX
    refs.forEach(function (r) {
      var c = r[1]
      if (r[2]) rect(rx, y + 3.7, 2.6, 2.6, c)
      else { pdf.setDrawColor(c[0], c[1], c[2]); pdf.setLineWidth(0.35); pdf.rect(rx, y + 3.7, 2.6, 2.6, 'S') }
      texto(r[0], rx + 4, y + 6, { tam: 7.5, color: C.gris })
      fuente(false, 7.5)
      rx += 4 + pdf.getTextWidth(r[0]) + 7
    })
    y += 17

    function lugar(alto) {
      if (y + alto <= AL - 16) return false
      pdf.addPage()
      y = 14
      return true
    }

    function tituloSeccion(pill, colorPill, titulo) {
      lugar(30) // título + cabeza + al menos una fila
      fuente(true, 8)
      var w = pdf.getTextWidth(pill) + 8
      pdf.setFillColor(colorPill[0], colorPill[1], colorPill[2])
      pdf.roundedRect(MX, y, w, 6, 3, 3, 'F')
      texto(pill, MX + w / 2, y + 4.2, { negrita: true, tam: 8, color: [255, 255, 255], alinear: 'center' })
      texto(titulo, MX + w + 3, y + 4.2, { tam: 9.5, color: C.gris })
      fuente(false, 9.5)
      var fin = MX + w + 3 + pdf.getTextWidth(titulo) + 3
      pdf.setDrawColor(C.linea[0], C.linea[1], C.linea[2])
      pdf.setLineWidth(0.3)
      pdf.line(fin, y + 3, AN - MX, y + 3)
      y += 9
    }

    function cabezaTabla(columnas) {
      rect(MX, y, ANCHO, 7, C.cabeza)
      columnas.forEach(function (c) {
        if (c.fondo) rect(c.x, y, c.w, 7, c.fondo)
        texto(c.titulo, c.izq ? c.x + 3 : c.x + c.w - 2.5, y + 4.6, {
          negrita: true, tam: 6.5, color: c.color || C.gris, alinear: c.izq ? 'left' : 'right', espacio: 0.3
        })
      })
      linea(y + 7)
      y += 7
    }

    function tablaModelos(modelos, esEV) {
      var colorCat = esEV ? C.ev : C.dm
      tituloSeccion(esEV ? 'EV' : 'DM', colorCat, esEV ? 'Eléctricos' : 'Híbridos enchufables')
      cabezaTabla(cols)
      var FILA = 11.5
      modelos.forEach(function (m) {
        if (lugar(FILA)) cabezaTabla(cols)
        cols.forEach(function (c) {
          if (c.fondo) rect(c.x, y, c.w, FILA, c.fondo)
          if (c.modelo) {
            fuente(true, 9.5)
            var nombre = pdf.splitTextToSize(String(m.nombre || ''), c.w - 5)[0] || ''
            texto(nombre, c.x + 3, y + 5, { negrita: true, tam: 9.5 })
            texto('• ' + (esEV ? 'ELÉCTRICO' : 'HÍBRIDO'), c.x + 3, y + 9, { negrita: true, tam: 6.5, color: colorCat, espacio: 0.2 })
            return
          }
          var monto = usd(c.valor(m))
          texto(monto, c.x + c.w - 2.5, y + 7, {
            negrita: !!c.fuerte, tam: tamQueEntra(monto, !!c.fuerte, c.fuerte ? 9.5 : 8.5, c.w - 4),
            color: c.color || (c.suave ? C.tenue : C.tinta), alinear: 'right'
          })
        })
        rect(MX, y, 1, FILA, colorCat) // franja de color a la izquierda
        linea(y + FILA)
        y += FILA
      })
      y += 8
    }

    function tablaSimple(pill, colorPill, titulo, columnas, filas) {
      tituloSeccion(pill, colorPill, titulo)
      repartir(columnas)
      cabezaTabla(columnas)
      filas.forEach(function (f, i) {
        fuente(false, 8.5)
        var primera = pdf.splitTextToSize(String(f[0] == null ? '' : f[0]), columnas[0].w - 5)
        var alto = Math.max(8, primera.length * 3.8 + 4.2)
        if (lugar(alto)) cabezaTabla(columnas)
        if (i % 2) rect(MX, y, ANCHO, alto, [250, 250, 251])
        columnas.forEach(function (c, j) {
          if (c.fondo) rect(c.x, y, c.w, alto, c.fondo)
          if (j === 0) {
            fuente(false, 8.5)
            pdf.setTextColor(C.tinta[0], C.tinta[1], C.tinta[2])
            pdf.text(primera, c.x + 3, y + 5.2)
            return
          }
          var v = String(f[j] == null ? '' : f[j])
          texto(v, c.izq ? c.x + 2 : c.x + c.w - 2.5, y + 5.2, {
            negrita: !!c.fuerte, tam: tamQueEntra(v, !!c.fuerte, 8.5, c.w - 4),
            color: c.color || C.tinta, alinear: c.izq ? 'left' : 'right'
          })
        })
        linea(y + alto)
        y += alto
      })
      y += 8
    }

    var modelos = datos.modelos || []
    var ev = modelos.filter(function (m) { return String(m.categoria).toUpperCase() === 'EV' })
    var dm = modelos.filter(function (m) { return String(m.categoria).toUpperCase() !== 'EV' })
    if (ev.length) tablaModelos(ev, true)
    if (dm.length) tablaModelos(dm, false)

    // Unidades en promoción: sólo si Gerencia las muestra a ventas, sin las
    // que ocultó.
    var promos = (datos.promos || []).filter(function (p) { return ocultos.indexOf(p.vin) === -1 })
    if (cfg.promociones && promos.length) {
      tablaSimple('PROMO', C.pisoT, 'Unidades en promoción', [
        { titulo: 'MODELO', peso: 2, izq: true }, { titulo: 'VIN', peso: 1.7, izq: true },
        { titulo: 'COLOR', peso: 1.1, izq: true },
        { titulo: 'LLENO', fondo: C.llenoF, color: C.llenoT, fuerte: true }, { titulo: 'WEB' },
        { titulo: 'PISO' }, { titulo: 'PROMO', fuerte: true }, { titulo: 'AHORRO', color: C.llenoT }
      ], promos.map(function (p) { return [p.nombre, p.vin, p.color, p.lleno, p.web, p.piso, p.promo, p.ahorro] }))
    }

    var acc = datos.accesorios || []
    if (acc.length) {
      tablaSimple('ACC', C.negro, 'Accesorios', [
        { titulo: 'ACCESORIO', peso: 4, izq: true }, { titulo: 'PRECIO', fuerte: true }
      ], acc.map(function (a) { return [a.nombre, a.precio] }))
    }

    lugar(12)
    texto('Precios en dólares estadounidenses. Lleno = lista + flete + patentamiento. Ante consultas de precio fuera de estos valores, contactar a gerencia.', MX, y, { tam: 7.5, color: C.gris, max: ANCHO })

    // Marca de agua y pie en todas las hojas.
    var hojas = pdf.getNumberOfPages()
    for (var h = 1; h <= hojas; h++) {
      pdf.setPage(h)
      var suave = pdf.GState ? new pdf.GState({ opacity: 0.07 }) : null
      if (suave) { pdf.saveGraphicsState(); pdf.setGState(suave); pdf.setTextColor(0, 0, 0) }
      else pdf.setTextColor(236, 236, 236)
      fuente(true, 20)
      for (var fy = 40, n = 0; fy < AL + 60; fy += 46, n++) {
        for (var fx = -40 + (n % 2) * 45; fx < AN; fx += 100) {
          pdf.text('USO INTERNO · BYD YACOPINI', fx, fy, { angle: 28 })
        }
      }
      if (suave) pdf.restoreGraphicsState()
      pdf.setDrawColor(C.linea[0], C.linea[1], C.linea[2])
      pdf.setLineWidth(0.3)
      pdf.line(MX, AL - 11, AN - MX, AL - 11)
      texto('BYD Yacopini · Lista de precios · Vigencia: ' + vigencia + ' · Generado el ' + generado, MX, AL - 6.5, { tam: 7, color: C.gris })
      texto('Hoja ' + h + ' de ' + hojas, AN - MX, AL - 6.5, { tam: 7, color: C.gris, alinear: 'right' })
    }

    pdf.save('Lista de precios BYD Yacopini - vigencia ' + vigencia.replace(/[\\/:*?"<>|]/g, '-') + '.pdf')
  }
  // Para probarlo fuera del navegador.
  window.__bydArmarListaPdf = armar

  function boton() {
    if (document.getElementById('bydPdfPrecios')) return
    var bloque = document.querySelector('.title-block')
    if (!bloque) return
    var caja = document.createElement('div')
    caja.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px'
    var b = document.createElement('button')
    b.id = 'bydPdfPrecios'
    b.type = 'button'
    b.style.cssText = 'display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:999px;border:0;background:#0A0A0A;color:#fff;font-family:inherit;font-size:13.5px;font-weight:700;line-height:1;cursor:pointer'
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg><span>Descargar PDF</span>'
    var aviso = document.createElement('span')
    aviso.style.cssText = 'font-size:12px;color:#6b7178;line-height:1.4'
    aviso.textContent = 'Sale con los precios y la vigencia guardados en este momento.'
    caja.appendChild(b)
    caja.appendChild(aviso)
    bloque.appendChild(caja)

    var ocupado = false
    b.addEventListener('click', function () {
      if (ocupado) return
      ocupado = true
      b.disabled = true
      b.style.opacity = '0.6'
      b.lastChild.textContent = 'Armando el PDF…'
      aviso.style.color = '#6b7178'
      aviso.textContent = 'Trayendo los últimos precios…'
      var ocultos = api('getVinsOcultos').then(function (d) { return (d && d.vins) || [] }, function () { return [] })
      Promise.all([api('listarListaPrecios'), ocultos, cargarJsPDF()])
        .then(function (r) {
          if (!r[0] || !r[0].modelos || !r[0].modelos.length) throw new Error('la lista vino vacía')
          armar(r[0], r[1])
          aviso.textContent = 'Listo: PDF con vigencia ' + (r[0].vigencia || 'sin fecha') + '.'
        })
        .catch(function (e) {
          aviso.style.color = '#c0392b'
          aviso.textContent = 'No se pudo armar el PDF (' + ((e && e.message) || 'sin conexión') + '). Revisá la conexión y probá de nuevo.'
        })
        .then(function () {
          ocupado = false
          b.disabled = false
          b.style.opacity = ''
          b.lastChild.textContent = 'Descargar PDF'
        })
    })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boton)
  else boton()
})()
