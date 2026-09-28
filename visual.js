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
