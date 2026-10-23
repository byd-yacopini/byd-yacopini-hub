// Tarjeta "Post venta" del Tablero General (index.html).
//
// Turnos del taller: salen de la agenda (Supabase, v_turnos_registro). Unidades con service próximo: salen de las
// entregas del CRM (Apps Script, acción postVentaLeer) y de los ingresos a servicio cargados en postventa.html.
// La regla del próximo service es la misma que usa postventa.html (calcular): 1 año desde el último service cargado
// o, si no hay, desde la entrega. Si cambia allá, cambiarla acá.
;(function () {
  'use strict'

  var APPS_URL = 'https://script.google.com/macros/s/AKfycbzTYBoM56BBMj2B-8hUG_MIuOh7r5qG4qq2sGlTRM-y6QyFm0XHqgE6XUG5OQB022iy/exec'
  var APPS_KEY = 'i4uH92SO1sFyNYi8PJ2dsGb9LDM-Xoq3'
  var SUPA_URL = 'https://mgicnwnvtfkrxmkmewnt.supabase.co'
  var SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1naWNud252dGZrcnhta21ld250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1Nzk5MDIsImV4cCI6MjEwNTE1NTkwMn0.GLWN_wI6Q_6Qu1EGi02oPNrL9wgTj-zbGsJCoIE-HQE'
  var TZ = 'America/Argentina/Mendoza'
  var CACHE = 'pvt-leer-v1'
  var REFRESCO_MS = 5 * 60 * 1000

  // Estados de la agenda: ya atendido (el service se cumplió), en el taller, por atender, y los que no cuentan.
  var CUMPLIDO = ['completado', 'entregado']
  var INGRESO = ['en_recepcion', 'en_proceso', 'completado', 'entregado']
  var POR_ATENDER = ['pendiente', 'confirmado', 'a_reprogramar']
  var NO_CUENTA = ['cancelado', 'no_show']
  var ES_SERVICE = /^service\b/i          // "Service mantenimiento" (no incluye "Servicio campaña")
  var ES_CONSULTA = /consulta|duda/i      // "Dudas o consultas": no es una unidad que ingresa al taller

  function $(id) { return document.getElementById(id) }
  function ponerNumero(id, v) { var e = $(id); if (e) e.textContent = v }
  function numAr(n) { return Math.round(n).toLocaleString('es-AR') }

  // Fecha de hoy (aaaa-mm-dd) y hora (minutos desde las 0) en Mendoza, sin depender de la zona de la PC.
  function ahoraAr() {
    var p = {}
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value })
    return { iso: p.year + '-' + p.month + '-' + p.day, min: (+p.hour % 24) * 60 + +p.minute, anio: +p.year, mes: +p.month, dia: +p.day }
  }
  function diaSemanaIso(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay() || 7 }   // 1 = lunes … 7 = domingo
  function dosDigitos(n) { return (n < 10 ? '0' : '') + n }

  function crearCliente() {
    if (window.__pvDb) return window.__pvDb
    if (!window.supabase) return null
    return window.supabase.createClient(SUPA_URL, SUPA_ANON)
  }

  // ------------------------------------------------------------ turnos (KPI 1, 2 y 5)
  function cargarTurnos(db, hoy) {
    var mes = hoy.anio + '-' + dosDigitos(hoy.mes)
    var sig = hoy.mes === 12 ? (hoy.anio + 1) + '-01' : hoy.anio + '-' + dosDigitos(hoy.mes + 1)
    var ultimo = new Date(Date.UTC(hoy.anio, hoy.mes, 0)).getUTCDate()
    function r(p) { return p.then(function (x) { if (x.error) throw x.error; return x.data }) }
    return Promise.all([
      r(db.from('v_turnos_registro').select('vin, inicio, estado, servicio')
        .gte('inicio', mes + '-01T00:00:00-03:00').lt('inicio', sig + '-01T00:00:00-03:00')),
      r(db.from('taller_config').select('horario').maybeSingle()),
      // Feriados del mes: si no se pueden leer, se cuenta el mes sin ellos.
      r(db.rpc('dias_disponibles', { p_desde: mes + '-01', p_hasta: mes + '-' + dosDigitos(ultimo), p_minutos: 60 })).catch(function () { return [] }),
    ]).then(function (x) { return { turnos: x[0] || [], horario: (x[1] && x[1].horario) || null, dias: x[2] || [] } })
  }

  function fechaLocal(inicio) {
    var p = {}
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(inicio)).forEach(function (x) { p[x.type] = x.value })
    return p.year + '-' + p.month + '-' + p.day
  }

  // Días del mes en que el taller abrió (tiene horario, no es feriado) hasta hoy. Hoy cuenta si ya hubo ingresos
  // o si ya pasó el horario de cierre; si no, el día todavía está en curso y bajaría el promedio.
  function diasHabiles(horario, feriados, hoy, ingresoHoy) {
    var n = 0
    for (var d = 1; d <= hoy.dia; d++) {
      var iso = hoy.anio + '-' + dosDigitos(hoy.mes) + '-' + dosDigitos(d)
      var franjas = horario ? (horario[String(diaSemanaIso(iso))] || []) : (diaSemanaIso(iso) <= 6 ? [{ hasta: '17:00' }] : [])
      if (!franjas.length || feriados[iso]) continue
      if (iso === hoy.iso) {
        var cierre = franjas.reduce(function (m, f) { var h = String(f.hasta || '17:00').split(':'); return Math.max(m, +h[0] * 60 + +h[1]) }, 0)
        if (!ingresoHoy && hoy.min < cierre) continue
      }
      n++
    }
    return n
  }

  function mostrarTurnos(d, hoy) {
    var cumplidosService = 0, cumplidosTotal = 0, vigentes = 0, porAtender = 0, atendidos = 0
    var ingresos = {}, ingresoHoy = false
    d.turnos.forEach(function (t) {
      if (NO_CUENTA.indexOf(t.estado) >= 0) return
      vigentes++
      if (POR_ATENDER.indexOf(t.estado) >= 0) porAtender++; else atendidos++
      if (CUMPLIDO.indexOf(t.estado) >= 0) { cumplidosTotal++; if (ES_SERVICE.test(t.servicio || '')) cumplidosService++ }
      if (INGRESO.indexOf(t.estado) >= 0 && !ES_CONSULTA.test(t.servicio || '')) {
        var dia = fechaLocal(t.inicio)
        ingresos[(t.vin || t.inicio) + '|' + dia] = 1        // una unidad cuenta una vez por día
        if (dia === hoy.iso) ingresoHoy = true
      }
    })
    var feriados = {}; d.dias.forEach(function (x) { if (x.feriado) feriados[x.fecha] = x.feriado })
    var unidades = Object.keys(ingresos).length
    var dias = diasHabiles(d.horario, feriados, hoy, ingresoHoy)

    ponerNumero('pvService', numAr(cumplidosService))
    ponerNumero('pvServiceSub', numAr(cumplidosTotal) + ' turnos cumplidos en total (todos los servicios)')
    ponerNumero('pvTurnos', numAr(vigentes))
    ponerNumero('pvTurnosSub', numAr(porAtender) + ' por atender · ' + numAr(atendidos) + ' ya atendidos')
    ponerNumero('pvPromedio', dias ? (unidades / dias).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–')
    ponerNumero('pvPromedioSub', numAr(unidades) + ' unidades en ' + numAr(dias) + (dias === 1 ? ' día hábil' : ' días hábiles'))
  }

  // ------------------------------------------------------------ unidades con service próximo (KPI 3 y 4)
  function fechaDeTexto(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''))
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null
  }
  function mostrarServices(j, hoy) {
    var hoyD = fechaDeTexto(hoy.iso), porVin = {}
    ;(j.servicios || []).forEach(function (s) {
      var v = String(s.vin || '').toUpperCase()
      if (!v || !s.fecha) return
      ;(porVin[v] = porVin[v] || []).push(s.fecha)
    })
    var c = { vencido: 0, p30: 0, p90: 0 }
    ;(j.filas || []).forEach(function (f) {
      var ent = fechaDeTexto(f.fecha)
      if (!ent) return
      var fechas = (porVin[String(f.vin || '').toUpperCase()] || []).sort()
      var base = fechas.length ? (fechaDeTexto(fechas[fechas.length - 1]) || ent) : ent
      var prox = new Date(Date.UTC(base.getUTCFullYear() + 1, base.getUTCMonth(), base.getUTCDate()))
      var dias = Math.round((prox - hoyD) / 86400000)
      if (dias < 0) c.vencido++
      else if (dias <= 30) c.p30++
      else if (dias <= 90) c.p90++
    })
    ponerNumero('pvP30', numAr(c.p30))
    ponerNumero('pvP30Sub', numAr(c.vencido) + ' más con el service ya vencido')
    ponerNumero('pvP90', numAr(c.p90))
    ponerNumero('pvP90Sub', numAr(c.p30 + c.p90) + ' en total dentro de los próximos 90 días')
  }

  function leerEntregas(db) {
    return db.auth.getSession().then(function (r) {
      var ses = r && r.data && r.data.session
      if (!ses) throw new Error('sin sesión')
      return fetch(APPS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ key: APPS_KEY, action: 'postVentaLeer', token: ses.access_token }) })
    }).then(function (r) { return r.json() }).then(function (j) {
      if (!j || j.error) throw new Error(j && j.error ? j.error : 'respuesta vacía')
      return j
    })
  }

  function avisar(texto) { var e = $('pvNota'); if (e) e.textContent = texto }
  function sinDatos(ids) { ids.forEach(function (id) { ponerNumero(id, '–') }) }

  var cargando = false
  function actualizar() {
    if (cargando || !$('pvService')) return
    var db = crearCliente()
    if (!db) return
    cargando = true
    var hoy = ahoraAr(), fallos = []
    var pTurnos = cargarTurnos(db, hoy).then(function (d) { mostrarTurnos(d, hoy) }).catch(function () {
      fallos.push('los turnos del taller (solo los ve Post venta y gerencia)')
      sinDatos(['pvService', 'pvTurnos', 'pvPromedio']); ponerNumero('pvServiceSub', ''); ponerNumero('pvTurnosSub', ''); ponerNumero('pvPromedioSub', '')
    })
    var cache = null
    try { cache = sessionStorage.getItem(CACHE) } catch (e) { /* sin almacenamiento */ }
    if (cache) { try { mostrarServices(JSON.parse(cache), hoy) } catch (e) { /* copia dañada */ } }   // se ve enseguida lo último que se leyó
    var pEntregas = leerEntregas(db).then(function (j) {
      mostrarServices(j, hoy)
      try { sessionStorage.setItem(CACHE, JSON.stringify({ filas: (j.filas || []).map(function (f) { return { vin: f.vin, fecha: f.fecha } }), servicios: (j.servicios || []).map(function (s) { return { vin: s.vin, fecha: s.fecha } }) })) } catch (e) { /* lleno */ }
    }).catch(function () {
      if (!cache) { fallos.push('las entregas del CRM'); sinDatos(['pvP30', 'pvP90']); ponerNumero('pvP30Sub', ''); ponerNumero('pvP90Sub', '') }
    })
    Promise.all([pTurnos, pEntregas]).then(function () {
      avisar(fallos.length ? 'No se pudieron leer ' + fallos.join(' ni ') + '.' : '')
      cargando = false
    })
  }

  function iniciar() {
    actualizar()
    setInterval(function () { if (!document.hidden) actualizar() }, REFRESCO_MS)
    // La pantalla del Tablero espera la puerta de acceso: cuando se abre, hay sesión y se pide de nuevo.
    new MutationObserver(function () { if (!document.body.classList.contains('gate-locked')) actualizar() })
      .observe(document.body, { attributes: true, attributeFilter: ['class'] })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar)
  else iniciar()
})()
