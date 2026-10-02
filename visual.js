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
