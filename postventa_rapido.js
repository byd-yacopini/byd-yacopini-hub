// Post venta abre al instante la segunda vez.
//
// Leer las entregas del Apps Script tarda varios segundos. Esto se carga en el
// <head> de postventa.html, antes que el código de la página, y envuelve el
// fetch: la respuesta de "postVentaLeer" se guarda en esta pestaña
// (sessionStorage, se borra al cerrarla) y la próxima vez se muestra lo
// guardado enseguida mientras se pide lo nuevo; cuando llega, se redibuja.
;(function () {
  'use strict'
  var CLAVE = 'pv-entregas-v1'
  var original = window.fetch
  if (!original) return

  function leer() { try { return sessionStorage.getItem(CLAVE) } catch (e) { return null } }
  function guardar(texto) { try { sessionStorage.setItem(CLAVE, texto) } catch (e) { /* lleno o bloqueado */ } }

  window.fetch = function (url, opciones) {
    var esLectura = false
    try {
      esLectura = typeof url === 'string' && url.indexOf('script.google.com') >= 0 &&
        opciones && typeof opciones.body === 'string' && opciones.body.indexOf('"action":"postVentaLeer"') >= 0
    } catch (e) { esLectura = false }
    if (!esLectura) return original.apply(this, arguments)

    var red = original.apply(this, arguments).then(function (r) {
      return r.clone().text().then(function (texto) {
        try { var j = JSON.parse(texto); if (j && j.filas && !j.error) guardar(texto) } catch (e) { /* no era JSON */ }
        return r
      })
    })
    var guardado = leer()
    if (!guardado) return red

    // Lo nuevo, cuando llegue, reemplaza a lo guardado.
    red.then(function (r) { return r.clone().json() }).then(function (j) {
      if (j && j.filas && !j.error && window.__postventa && window.__postventa.mostrar) window.__postventa.mostrar(j)
    }).catch(function () { /* queda lo guardado */ })
    return Promise.resolve(new Response(guardado, { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }
})()
