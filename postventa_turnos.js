// Agenda de turnos de postventa, adentro de postventa.html (la página de
// Nicolás). Vive en un archivo aparte para tocar lo mínimo su página: él sólo
// tiene que cargar este script y exponer las unidades (el botón "Agregar turno" lo pone este script).
//
// Los turnos se guardan en Supabase (migraciones 0033 y 0034 del Portal). Las
// reglas las pone la base: hasta 2 turnos a la vez, no en feriados, cancelar
// libera el lugar, reprogramar mueve el mismo turno, todo queda registrado.
// Acá sólo se muestra y se piden las cosas.
//
// Para probar sin base: window.__turnosFalso = { api } antes de cargar esto.
;(function () {
  'use strict'

  var SUPA_URL = 'https://mgicnwnvtfkrxmkmewnt.supabase.co'
  var SUPA_ANON =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1naWNud252dGZrcnhta21ld250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1Nzk5MDIsImV4cCI6MjEwNTE1NTkwMn0.GLWN_wI6Q_6Qu1EGi02oPNrL9wgTj-zbGsJCoIE-HQE'
  var TZ = 'America/Argentina/Mendoza'
  var DURACIONES = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480]

  var ETIQUETA_ESTADO = {
    pendiente: 'Pendiente',
    confirmado: 'Confirmado',
    en_recepcion: 'En recepción',
    en_proceso: 'En proceso',
    completado: 'Cumplido',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
    no_show: 'No vino',
    a_reprogramar: 'A reprogramar',
  }

  // ------------------------------------------------------------ utilidades
  function $(sel, raiz) { return (raiz || document).querySelector(sel) }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)) }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  function titulo(s) {
    return String(s || '').trim().toLowerCase().replace(/(^|[\s'-])(\S)/g, function (m, a, b) { return a + b.toUpperCase() })
  }
  var fmtF = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
  var fmtH = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
  var fmtSem = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'short' })
  var fmtISO = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
  function fecha(d) { return fmtF.format(new Date(d)) }
  function hora(d) { return fmtH.format(new Date(d)) }
  // "vie 16/10"
  function diaCorto(d) { var x = new Date(d); return fmtSem.format(x).replace('.', '') + ' ' + fecha(x).slice(0, 5) }
  function isoDia(d) { return fmtISO.format(new Date(d)) }          // "2026-12-09" en Mendoza
  function hoyISO() { return isoDia(new Date()) }
  function sumarDias(iso, n) {
    var p = iso.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n))
    return d.toISOString().slice(0, 10)
  }
  function fechaDeISO(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0] }
  function duracionTexto(min) {
    if (min < 60) return min + ' min'
    var h = Math.floor(min / 60), m = min % 60
    return h + (h === 1 ? ' hora' : ' horas') + (m ? ' ' + m + ' min' : '')
  }

  // Igual que telefonoParaWhatsapp de src/lib/turnos.ts (con tests allá).
  function telefonoWa(tel, car) {
    car = car || '261'
    var d = String(tel || '').replace(/\D/g, '')
    if (!d) return null
    if (d.indexOf('00') === 0) d = d.slice(2)
    if (d.indexOf('54') === 0) { d = d.slice(2); if (d.charAt(0) === '9') d = d.slice(1) }
    if (d.charAt(0) === '0') d = d.slice(1)
    if (d.length <= 9) { if (d.indexOf('15') === 0) d = d.slice(2); d = car + d }
    else {
      for (var largo = 2; largo <= 4; largo++) {
        if (d.length === 12 && d.substr(largo, 2) === '15') { d = d.slice(0, largo) + d.slice(largo + 2); break }
      }
    }
    return d.length === 10 ? '549' + d : null
  }
  function armarMensaje(plantilla, datos) {
    return String(plantilla || '')
      .replace(/\{(\w+)\}/g, function (_, k) { return datos[k] ? String(datos[k]).trim() : '' })
      .replace(/\(\s*\)/g, '').replace(/[ \t]{2,}/g, ' ').replace(/ ([,.?!])/g, '$1').trim()
  }
  function linkWa(tel, texto) {
    var n = telefonoWa(tel)
    return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto) : null
  }

  function textoError(e) {
    var m = (e && (e.message || e.details || e.hint)) || String(e || '')
    if (/failed to fetch|networkerror|load failed/i.test(m)) return 'No hay conexión. Revisá internet y probá de nuevo.'
    if (/row-level security|permission denied/i.test(m)) return 'No tenés permiso para hacer esto.'
    if (/jwt|session/i.test(m)) return 'Tu sesión venció. Volvé a entrar al hub.'
    if (/could not find|does not exist|schema cache/i.test(m)) return 'Falta actualizar la base de datos (migraciones 0033 y 0034).'
    if (/turnos_tecnico_sin_superponer/.test(m)) return 'Ese técnico ya tiene otro turno en ese horario.'
    if (/vehiculos_patente_idx/.test(m)) return 'Ya hay otro vehículo cargado con esa patente.'
    if (/vehiculos_vin_idx/.test(m)) return 'Ya hay otro vehículo cargado con ese chasis.'
    return m || 'Ocurrió un error. Probá de nuevo.'
  }

  // ------------------------------------------------------------- datos
  function crearApi() {
    if (window.__turnosFalso) return window.__turnosFalso.api
    var db = window.supabase.createClient(SUPA_URL, SUPA_ANON)
    function r(p) { return p.then(function (x) { if (x.error) throw x.error; return x.data }) }
    return {
      sesion: function () {
        return db.auth.getSession().then(function (x) {
          var s = x.data && x.data.session
          if (!s) return null
          return r(db.from('perfiles').select('id, nombre, rol, activo').eq('id', s.user.id).maybeSingle())
        })
      },
      config: function () { return r(db.from('taller_config').select('*').maybeSingle()) },
      servicios: function () {
        return r(db.from('servicios').select('id, nombre, duracion_minutos, color, orden').eq('activo', true).order('orden'))
      },
      turnos: function (desde, hasta) {
        return r(db.from('v_turnos_registro').select('*').gte('inicio', desde).lt('inicio', hasta).order('inicio'))
      },
      proximosPorVin: function () {
        return r(db.from('v_turnos_registro').select('id, vin, inicio, estado, servicio')
          .gte('inicio', new Date().toISOString()).in('estado', ['pendiente', 'confirmado']).not('vin', 'is', null))
      },
      dias: function (desde, hasta, minutos) {
        return r(db.rpc('dias_disponibles', { p_desde: desde, p_hasta: hasta, p_minutos: minutos }))
      },
      libres: function (dia, minutos, excluir) {
        return r(db.rpc('horarios_libres', { p_fecha: dia, p_minutos: minutos, p_excluir: excluir || null }))
      },
      darTurno: function (d) {
        return r(db.rpc('dar_turno', {
          p_cliente: d.cliente, p_vehiculo: d.vehiculo, p_servicio: d.servicio, p_inicio: d.inicio,
          p_minutos: d.minutos, p_origen: d.origen, p_observaciones: d.observaciones,
        }))
      },
      reprogramar: function (id, inicio, minutos) {
        return r(db.rpc('reprogramar_turno', { p_turno: id, p_inicio: inicio, p_minutos: minutos }))
      },
      cambiarEstado: function (id, estado, motivo) {
        var cambios = { estado: estado }
        if (motivo != null) cambios.motivo_cancelacion = motivo
        return r(db.from('turnos').update(cambios).eq('id', id).select('id'))
      },
      buscarVehiculos: function (q) {
        var t = q.replace(/[^\p{L}\p{N} ]/gu, '').trim()
        if (t.length < 2) return Promise.resolve([])
        var compacto = t.replace(/\s/g, '').toUpperCase()
        return r(db.from('vehiculos')
          .select('id, vin, patente, modelo_texto, fecha_entrega, titular_nombre, titular_apellido, cliente:clientes(id, nombre, apellido, telefono)')
          .or('patente.ilike.*' + compacto + '*,vin.ilike.*' + compacto + '*,titular_apellido.ilike.*' + t + '*,titular_nombre.ilike.*' + t + '*')
          .limit(8))
      },
    }
  }

  // ------------------------------------------------------------- estado
  var api = null
  var S = {
    perfil: null,
    puedeEditar: false,
    config: null,
    servicios: [],
    cal: null,
    verCancelados: false,
    proximos: {},      // vin → turno próximo
    disponibles: {},   // 'YYYY-MM-DD' → { libres, feriado }
  }

  // ------------------------------------------------------------- estilos
  // Estilo: el mismo del hub y el Portal. Claro, tarjetas blancas redondeadas
  // con sombra suave, lo activo en celeste BYD con texto oscuro.
  var CSS = [
    '#pt-agenda,#pt-registro,.pt-tabs,.pt-fondo{--pt-acento:#45b6f7;--pt-acento-suave:#e7f6fe;--pt-acento-osc:#0b6fa8;--pt-tinta:#16181d;--pt-gris:#5c6167;--pt-tenue:#8b9096;--pt-linea:#eceef2;--pt-campo:#f4f6f8;--pt-ok:#2f9e5f;--pt-mal:#d6483a;--pt-alerta:#b57c17;--pt-sombra:0 1px 2px rgba(16,24,40,.04),0 8px 24px rgba(16,24,40,.07)}',
    '.pt-oculto{display:none!important}',

    /* solapas */
    '.pt-tabs{display:inline-flex;gap:4px;margin:0 0 18px;padding:4px;background:#fff;border-radius:999px;box-shadow:var(--pt-sombra);max-width:100%;overflow-x:auto}',
    '.pt-tab{padding:9px 18px;border-radius:999px;border:0;background:transparent;font:inherit;font-size:13.5px;font-weight:700;color:var(--pt-gris);cursor:pointer;white-space:nowrap;transition:background .15s,color .15s}',
    '.pt-tab:hover{color:var(--pt-tinta)}',
    '.pt-tab.on{background:var(--pt-acento);color:var(--pt-tinta);box-shadow:0 4px 12px rgba(69,182,247,.35)}',
    '@media(max-width:520px){.pt-tabs{display:flex}.pt-tab{flex:1;padding:9px 10px;font-size:12.5px}}',

    /* botones */
    '.pt-barra{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px}',
    '.pt-barra .pt-esp{flex:1}',
    '.pt-btn{padding:10px 16px;border-radius:999px;border:1px solid var(--pt-linea);background:#fff;color:var(--pt-tinta);font:inherit;font-weight:700;font-size:13px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:7px;transition:transform .12s,box-shadow .12s,background .12s}',
    '.pt-btn:hover{box-shadow:0 4px 12px rgba(16,24,40,.08)}',
    '.pt-btn:active{transform:translateY(1px)}',
    '.pt-btn:disabled{opacity:.5;cursor:default;box-shadow:none}',
    '.pt-btn.prim{background:var(--pt-acento);border-color:var(--pt-acento);color:var(--pt-tinta);box-shadow:0 6px 16px rgba(69,182,247,.35)}',
    '.pt-btn.prim:hover{box-shadow:0 8px 20px rgba(69,182,247,.45)}',
    '.pt-btn.ok{background:var(--pt-ok);border-color:var(--pt-ok);color:#fff}',
    '.pt-btn.mal{color:var(--pt-mal);border-color:#f3d0cb;background:#fff}',
    '.pt-btn.wa{background:#1fa855;border-color:#1fa855;color:#fff}',
    '.pt-btn .pt-mas{font-size:18px;line-height:0;font-weight:800}',
    '.pt-chk{font-size:12.5px;color:var(--pt-gris);display:inline-flex;gap:7px;align-items:center;cursor:pointer;user-select:none}',
    '.pt-chk input{accent-color:var(--pt-acento);width:16px;height:16px}',

    /* resumen arriba del calendario */
    '.pt-resumen{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 14px}',
    '@media(max-width:720px){.pt-resumen{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '.pt-res-k{background:#fff;border-radius:18px;padding:14px 16px;box-shadow:var(--pt-sombra);display:flex;gap:12px;align-items:center;min-width:0}',
    '.pt-res-k .ico{flex:none;width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--pt-acento-suave);color:var(--pt-acento-osc)}',
    '.pt-res-k .ico svg{width:19px;height:19px}',
    '.pt-res-k .n{font-size:24px;font-weight:800;color:var(--pt-tinta);line-height:1.05;font-variant-numeric:tabular-nums}',
    '.pt-res-k .l{font-size:11.5px;font-weight:600;color:var(--pt-gris);margin-top:2px;line-height:1.3}',
    '.pt-res-k.dest{background:linear-gradient(135deg,#5cc3fa,#45b6f7 55%,#2aa3ec);box-shadow:0 10px 24px rgba(69,182,247,.35)}',
    '.pt-res-k.dest .ico{background:rgba(255,255,255,.45);color:var(--pt-tinta)}',
    '.pt-res-k.dest .l{color:#10324a}',
    '.pt-res-k.alerta .ico{background:#fff4dc;color:var(--pt-alerta)}',
    '.pt-res-k.ok .ico{background:#e3f5ea;color:var(--pt-ok)}',

    /* tarjeta del calendario */
    '.pt-cal{background:#fff;border-radius:22px;padding:18px 18px 12px;box-shadow:var(--pt-sombra)}',
    '@media(max-width:720px){.pt-cal{padding:12px 8px 8px;border-radius:18px}}',
    '.pt-cal-cab{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 14px}',
    '.pt-cal-nav{display:flex;gap:6px;align-items:center}',
    '.pt-redondo{width:38px;height:38px;border-radius:50%;border:1px solid var(--pt-linea);background:#fff;font-size:20px;line-height:1;color:var(--pt-tinta);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0 0 2px}',
    '.pt-redondo:hover{background:var(--pt-campo)}',
    '.pt-hoy{height:38px;padding:0 16px;border-radius:999px;border:1px solid var(--pt-linea);background:#fff;font:inherit;font-size:13px;font-weight:700;color:var(--pt-tinta);cursor:pointer}',
    '.pt-hoy:hover{background:var(--pt-campo)}',
    '.pt-cal-titulo{flex:1;min-width:160px;font-size:21px;font-weight:800;color:var(--pt-tinta);letter-spacing:-.2px;line-height:1.15}',
    '.pt-cal-titulo small{display:block;font-size:12.5px;font-weight:600;color:var(--pt-tenue);letter-spacing:0;margin-top:2px}',
    '.pt-vistas{display:inline-flex;padding:4px;background:var(--pt-campo);border-radius:999px;gap:2px}',
    '.pt-vistas button{border:0;background:transparent;padding:7px 14px;border-radius:999px;font:inherit;font-size:12.5px;font-weight:700;color:var(--pt-gris);cursor:pointer}',
    '.pt-vistas button.on{background:#fff;color:var(--pt-tinta);box-shadow:0 2px 6px rgba(16,24,40,.1)}',
    '@media(max-width:720px){.pt-cal-titulo{order:-1;flex-basis:100%;font-size:18px}.pt-vistas{margin-left:auto}.pt-vistas button{padding:7px 10px}}',

    /* FullCalendar por dentro */
    '.pt-cal .fc{--fc-border-color:#eef0f3;--fc-today-bg-color:rgba(69,182,247,.06);--fc-now-indicator-color:#d6483a;--fc-non-business-color:rgba(244,246,248,.75);--fc-highlight-color:rgba(69,182,247,.16);--fc-page-bg-color:#fff;--fc-neutral-bg-color:#f7f8fa;--fc-list-event-hover-bg-color:#f2f9ff;font-size:13px;color:var(--pt-tinta)}',
    '.pt-cal .fc-theme-standard .fc-scrollgrid{border:0}',
    '.pt-cal .fc-theme-standard td,.pt-cal .fc-theme-standard th{border-color:#eef0f3}',
    '.pt-cal .fc .fc-col-header-cell{border:0;padding:4px 0 8px;vertical-align:top}',
    '.pt-cal .fc .fc-col-header-cell-cushion{padding:0;display:block;text-decoration:none;color:inherit}',
    '.pt-dh{display:flex;flex-direction:column;align-items:center;gap:3px}',
    '.pt-dh-sem{font-size:10.5px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:var(--pt-tenue)}',
    '.pt-dh-num{font-size:20px;font-weight:800;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--pt-tinta)}',
    '.pt-dh.hoy .pt-dh-sem{color:var(--pt-acento-osc)}',
    '.pt-dh.hoy .pt-dh-num{background:var(--pt-acento);box-shadow:0 4px 12px rgba(69,182,247,.4)}',
    '.pt-dh.pasado .pt-dh-num{color:var(--pt-tenue)}',
    '.pt-cal .fc .fc-timegrid-slot{height:2.7em}',
    '.pt-cal .fc .fc-timegrid-slot-minor{border-top-style:dotted;border-top-color:#f1f2f5}',
    '.pt-cal .fc .fc-timegrid-slot-label{border:0;vertical-align:top}',
    '.pt-cal .fc .fc-timegrid-slot-label-cushion{font-size:11px;font-weight:700;color:var(--pt-tenue);padding:2px 10px 0 0}',
    '.pt-cal .fc .fc-timegrid-axis{border:0}',
    '.pt-cal .fc .fc-timegrid-col.fc-day-today{background:rgba(69,182,247,.05)}',
    '.pt-cal .fc .fc-timegrid-now-indicator-line{border-width:2px 0 0}',
    '.pt-cal .fc .fc-timegrid-now-indicator-arrow{border-width:6px 0 6px 7px;border-top-color:transparent;border-bottom-color:transparent}',
    '.pt-cal .fc .fc-non-business{background:repeating-linear-gradient(135deg,#f6f7f9,#f6f7f9 6px,#fbfbfc 6px,#fbfbfc 12px)}',
    '.pt-cal .fc .fc-highlight{border-radius:10px}',

    /* turnos */
    '.pt-cal .fc .fc-timegrid-event{border:0!important;border-radius:12px;background:var(--bg,#e7f6fe)!important;box-shadow:inset 4px 0 0 var(--c,#45b6f7),0 1px 2px rgba(16,24,40,.06),0 4px 12px rgba(16,24,40,.06);overflow:hidden;transition:transform .12s,box-shadow .12s}',
    '.pt-cal .fc .fc-timegrid-event:hover{transform:translateY(-1px);box-shadow:inset 4px 0 0 var(--c,#45b6f7),0 8px 20px rgba(16,24,40,.12);z-index:5}',
    '.pt-cal .fc .fc-timegrid-event-harness-inset .fc-timegrid-event{box-shadow:inset 4px 0 0 var(--c,#45b6f7),0 0 0 2px #fff,0 4px 12px rgba(16,24,40,.08)}',
    '.pt-cal .fc .fc-timegrid-event .fc-event-main{padding:5px 7px 5px 11px;color:var(--pt-tinta)}',
    '.pt-ev{display:flex;flex-direction:column;gap:1px;min-width:0;line-height:1.25}',
    '.pt-ev-top{display:flex;align-items:center;gap:6px;justify-content:space-between}',
    '.pt-ev-hora{font-size:10.5px;font-weight:700;color:var(--pt-gris);white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.pt-ev-nom{font-size:12.5px;font-weight:800;color:var(--pt-tinta);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pt-ev-serv{font-size:11px;font-weight:600;color:var(--pt-gris);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pt-ev.corto{flex-direction:row;align-items:center;gap:6px}',
    '.pt-ev.corto .pt-ev-top{flex:none}',
    '.pt-est{flex:none;display:inline-flex;align-items:center;gap:4px;font-size:9.5px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:#fff;color:var(--pt-gris);white-space:nowrap}',
    '.pt-est:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}',
    '.pt-est.pendiente{color:var(--pt-alerta);background:#fff6e3}',
    '.pt-est.confirmado{color:var(--pt-ok);background:#e6f6ec}',
    '.pt-est.completado{color:#fff;background:var(--pt-ok)}',
    '.pt-est.completado:before{content:"✓";width:auto;height:auto;background:none;font-size:10px}',
    '.pt-est.no_show,.pt-est.cancelado{color:var(--pt-mal);background:#fdecea}',
    '.pt-punto{flex:none;width:8px;height:8px;border-radius:50%;background:var(--pt-alerta);box-shadow:0 0 0 2px #fff}',
    '.pt-punto.confirmado,.pt-punto.completado{background:var(--pt-ok)}.pt-punto.no_show,.pt-punto.cancelado{background:var(--pt-mal)}',
    '.pt-cal .fc .ev-completado{opacity:.62}',
    '.pt-cal .fc .ev-cancelado,.pt-cal .fc .ev-no_show,.pt-cal .fc .ev-a_reprogramar{opacity:.5}',
    '.pt-cal .fc .ev-cancelado .pt-ev-nom{text-decoration:line-through}',
    '.pt-cal .fc .fc-event-mirror{opacity:.85}',

    /* vista mes */
    '.pt-cal .fc .fc-daygrid-day-frame{min-height:96px;padding:2px}',
    '.pt-cal .fc .fc-daygrid-day-top{flex-direction:row}',
    '.pt-cal .fc .fc-daygrid-day-number{font-size:13px;font-weight:800;color:var(--pt-tinta);padding:6px 8px;text-decoration:none}',
    '.pt-cal .fc .fc-day-other .fc-daygrid-day-number{color:#c3c7cc}',
    '.pt-cal .fc .fc-day-today .fc-daygrid-day-number{background:var(--pt-acento);border-radius:999px;margin:3px;padding:3px 9px;box-shadow:0 3px 10px rgba(69,182,247,.4)}',
    '.pt-cal .fc .fc-daygrid-day.fc-day-today{background:rgba(69,182,247,.05)}',
    '.pt-cal .fc .fc-daygrid-event{border-radius:8px;border:0;padding:2px 6px;margin:1px 4px 2px;background:var(--bg,#e7f6fe)!important}',
    '.pt-cal .fc .fc-daygrid-event:hover{filter:brightness(.97)}',
    '.pt-mes-ev{display:flex;align-items:center;gap:5px;min-width:0;font-size:11.5px;color:var(--pt-tinta)}',
    '.pt-mes-ev i{flex:none;width:7px;height:7px;border-radius:50%;background:var(--c,#45b6f7)}',
    '.pt-mes-ev b{font-weight:800;font-variant-numeric:tabular-nums}',
    '.pt-mes-ev span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.pt-cal .fc .fc-daygrid-more-link{font-size:11px;font-weight:700;color:var(--pt-acento-osc);margin-left:6px}',

    /* disponibilidad */
    '.pt-disp{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;color:var(--pt-gris);margin:0 6px 4px;white-space:nowrap}',
    '.pt-disp .barra{flex:1;min-width:24px;height:5px;border-radius:999px;background:#eef0f3;overflow:hidden;box-shadow:inset 0 1px 2px rgba(16,24,40,.08)}',
    '.pt-disp .barra i{display:block;height:100%;border-radius:999px;background:linear-gradient(180deg,#6fd39b,#2f9e5f)}',
    '.pt-disp.poco .barra i{background:linear-gradient(180deg,#f3c46a,#b57c17)}',
    '.pt-disp.lleno{color:var(--pt-mal)}.pt-disp.fer{color:var(--pt-tenue)}',
    '.pt-dh .pt-disp{margin:2px 0 0;justify-content:center;width:100%;max-width:120px}',
    '.pt-dh .pt-disp .barra{max-width:54px}',

    /* lista */
    '.pt-cal .fc .fc-list{border:0}',
    '.pt-cal .fc .fc-list-day-cushion{background:#f7f8fa;padding:10px 14px}',
    '.pt-cal .fc .fc-list-day-text,.pt-cal .fc .fc-list-day-side-text{font-weight:800;color:var(--pt-tinta);text-decoration:none;text-transform:capitalize}',
    '.pt-cal .fc .fc-list-event td{padding:11px 14px}',
    '.pt-cal .fc .fc-list-event-time{font-weight:700;color:var(--pt-gris);font-variant-numeric:tabular-nums}',
    '.pt-cal .fc .fc-list-event-dot{border-color:var(--c,#45b6f7)}',
    '.pt-lista-ev{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.pt-lista-ev b{font-weight:800}.pt-lista-ev span{color:var(--pt-gris)}',
    '.pt-cal .fc .fc-list-empty{background:#fff;color:var(--pt-tenue);font-weight:600}',

    /* leyenda */
    '.pt-leyenda{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 0}',
    '.pt-leyenda span{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--pt-gris);background:#fff;border-radius:999px;padding:6px 11px;box-shadow:var(--pt-sombra)}',
    '.pt-leyenda i{width:9px;height:9px;border-radius:50%}',

    /* ventanas */
    '.pt-fondo{position:fixed;inset:0;background:rgba(16,24,40,.42);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:100000;display:flex;align-items:flex-end;justify-content:center;animation:pt-aparece .15s ease-out}',
    '@media(min-width:720px){.pt-fondo{align-items:center}}',
    '@keyframes pt-aparece{from{opacity:0}to{opacity:1}}',
    '@keyframes pt-sube{from{transform:translateY(16px);opacity:.6}to{transform:none;opacity:1}}',
    '.pt-modal{position:relative;background:#fff;width:100%;max-width:580px;max-height:92vh;overflow:auto;border-radius:24px 24px 0 0;padding:22px 22px 24px;box-shadow:0 24px 60px rgba(16,24,40,.28);animation:pt-sube .18s ease-out;color:var(--pt-tinta)}',
    '@media(min-width:720px){.pt-modal{border-radius:24px}}',
    '.pt-cinta{position:absolute;left:0;right:0;top:0;height:6px;background:var(--c,#45b6f7)}',
    '.pt-modal h2{font-size:20px;font-weight:800;margin:0 0 4px;color:var(--pt-tinta);letter-spacing:-.2px}',
    '.pt-modal .pt-sub{font-size:13px;color:var(--pt-gris);margin:0 0 16px;line-height:1.5}',
    '.pt-cerrar{float:right;border:0;background:var(--pt-campo);width:36px;height:36px;border-radius:50%;font-size:19px;cursor:pointer;color:var(--pt-gris);margin:-4px -4px 0 8px}',
    '.pt-cerrar:hover{background:#e8ebef;color:var(--pt-tinta)}',
    '.pt-grilla{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px}',
    '.pt-grilla .ancho{grid-column:1/-1}',
    '@media(max-width:520px){.pt-grilla{grid-template-columns:1fr}}',
    '.pt-campo label{display:block;font-size:12px;font-weight:700;color:var(--pt-gris);margin:0 0 5px}',
    '.pt-campo input,.pt-campo select,.pt-campo textarea{width:100%;font:inherit;font-size:15px;padding:11px 13px;border:1.5px solid transparent;border-radius:14px;background:var(--pt-campo);color:var(--pt-tinta);box-sizing:border-box;transition:border-color .12s,box-shadow .12s,background .12s;outline:none}',
    '.pt-campo input:focus,.pt-campo select:focus,.pt-campo textarea:focus{background:#fff;border-color:var(--pt-acento);box-shadow:0 0 0 4px rgba(69,182,247,.18)}',
    '.pt-campo textarea{min-height:70px;resize:vertical}',
    '.pt-campo .pt-ayuda{font-size:11.5px;color:var(--pt-tenue);margin-top:4px}',
    '.pt-campo.error input,.pt-campo.error select{border-color:var(--pt-mal);background:#fff}',
    '.pt-campo .pt-err{font-size:11.5px;font-weight:600;color:var(--pt-mal);margin-top:4px}',
    '.pt-seccion{display:flex;align-items:center;gap:10px;font-size:11px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;color:var(--pt-tenue);margin:20px 0 10px}',
    '.pt-seccion:after{content:"";flex:1;height:1px;background:var(--pt-linea)}',
    '.pt-chips{display:flex;flex-wrap:wrap;gap:7px}',
    '.pt-chip{display:inline-flex;flex-direction:column;align-items:center;min-width:64px;padding:8px 11px;border-radius:14px;border:1.5px solid var(--pt-linea);background:#fff;font:inherit;font-size:14px;font-weight:800;cursor:pointer;color:var(--pt-tinta);line-height:1.15;transition:border-color .12s,background .12s,transform .1s}',
    '.pt-chip:hover{border-color:var(--pt-acento)}',
    '.pt-chip small{font-size:10.5px;font-weight:700;color:var(--pt-ok);margin:2px 0 0}',
    '.pt-chip small.uno{color:var(--pt-alerta)}',
    '.pt-chip.on{background:var(--pt-acento);border-color:var(--pt-acento);color:var(--pt-tinta);box-shadow:0 6px 14px rgba(69,182,247,.35);transform:translateY(-1px)}',
    '.pt-chip.on small{color:#10324a}',
    '.pt-vacio{font-size:13px;color:var(--pt-tenue);padding:6px 0}',
    '.pt-resultados{border-radius:14px;margin-top:8px;max-height:230px;overflow:auto;box-shadow:0 8px 24px rgba(16,24,40,.12);background:#fff}',
    '.pt-res{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--pt-linea);background:#fff;padding:10px 13px;font:inherit;font-size:13px;cursor:pointer}',
    '.pt-res:last-child{border-bottom:0}',
    '.pt-res:hover{background:var(--pt-acento-suave)}.pt-res b{color:var(--pt-tinta)}.pt-res span{display:block;font-size:11.5px;color:var(--pt-gris);margin-top:1px}',
    '.pt-acciones{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}',
    '.pt-datos{display:grid;grid-template-columns:auto 1fr;gap:9px 16px;font-size:14px;margin:4px 0;padding:14px 16px;background:var(--pt-campo);border-radius:16px}',
    '.pt-datos dt{color:var(--pt-tenue);font-weight:700;font-size:12px;padding-top:2px}.pt-datos dd{margin:0;overflow-wrap:anywhere;font-weight:600}',
    '.pt-estado{display:inline-block;font-size:11.5px;font-weight:800;padding:3px 10px;border-radius:999px;background:#fff6e3;color:#7a5a00}',
    '.pt-estado.completado,.pt-estado.confirmado{background:#e3f5ea;color:#145c37}.pt-estado.cancelado,.pt-estado.no_show{background:#fbeaea;color:#8a2020}',
    '.pt-aviso{background:var(--pt-acento-suave);color:#0b4f78;font-size:13px;border-radius:14px;padding:11px 14px;margin:0 0 14px;line-height:1.5}',
    '.pt-aviso.mal{background:#fdecea;color:#8a2020}',
    '.pt-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:var(--pt-tinta,#16181d);color:#fff;padding:12px 18px;border-radius:14px;font-size:13.5px;font-weight:600;z-index:100001;max-width:92vw;box-shadow:0 10px 30px rgba(0,0,0,.3);animation:pt-sube .18s ease-out}',
    '.pt-toast.mal{background:#8a2020}',

    /* registro */
    '.pt-tabla-caja{background:#fff;border-radius:20px;overflow:auto;box-shadow:var(--pt-sombra)}',
    '.pt-tabla{width:100%;border-collapse:collapse;font-size:12.5px;min-width:820px}',
    '.pt-tabla th{text-align:left;font-size:10.5px;letter-spacing:.8px;text-transform:uppercase;color:var(--pt-tenue);padding:12px 12px;border-bottom:1px solid var(--pt-linea);white-space:nowrap;font-weight:800}',
    '.pt-tabla td{padding:10px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top}',
    '.pt-tabla tbody tr{cursor:pointer}.pt-tabla tbody tr:hover{background:#f6fbff}',
    '.pt-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}',
    '@media(max-width:720px){.pt-kpis{grid-template-columns:repeat(2,1fr)}}',
    '.pt-kpi{background:#fff;border-radius:18px;padding:14px 16px;box-shadow:var(--pt-sombra)}',
    '.pt-kpi:first-child{background:linear-gradient(135deg,#5cc3fa,#45b6f7 55%,#2aa3ec);box-shadow:0 10px 24px rgba(69,182,247,.35)}',
    '.pt-kpi .n{font-size:26px;font-weight:800;color:var(--pt-tinta);line-height:1.1}.pt-kpi .l{font-size:11.5px;font-weight:600;color:var(--pt-gris);margin-top:2px}',
    '.pt-kpi:first-child .l{color:#10324a}',
    '#pt-registro .pt-campo input,#pt-registro .pt-campo select{background:#fff;box-shadow:var(--pt-sombra)}',

    /* vista rápida: hoy y próximos */
    '.pt-rapida{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 14px;align-items:start}',
    '.pt-r-lista{max-height:236px;overflow-y:auto;overscroll-behavior:contain}',
    '@media(max-width:820px){.pt-rapida{grid-template-columns:1fr}}',
    '.pt-r-caja{background:#fff;border-radius:20px;padding:14px 14px 8px;box-shadow:var(--pt-sombra);min-width:0}',
    '.pt-r-cab{display:flex;align-items:baseline;gap:8px;padding:0 4px 8px}',
    '.pt-r-cab b{font-size:15px;font-weight:800;color:var(--pt-tinta)}.pt-r-cab span{font-size:12px;font-weight:600;color:var(--pt-tenue)}',
    '.pt-r-fila{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:0;background:transparent;padding:9px 6px;border-radius:12px;font:inherit;cursor:pointer;border-top:1px solid var(--pt-linea)}',
    '.pt-r-fila:hover{background:#f6fbff}',
    '.pt-r-hora{flex:none;min-width:58px;padding:6px 8px;border-radius:10px;background:var(--pt-campo);box-shadow:inset 3px 0 0 var(--c,#45b6f7);font-size:13px;font-weight:800;color:var(--pt-tinta);text-align:center;font-variant-numeric:tabular-nums;line-height:1.15}',
    '.pt-r-hora small{display:block;font-size:10px;font-weight:700;color:var(--pt-tenue);text-transform:capitalize}',
    '.pt-r-txt{flex:1;min-width:0;display:flex;flex-direction:column}',
    '.pt-r-txt b{font-size:13.5px;font-weight:800;color:var(--pt-tinta);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pt-r-txt span{font-size:12px;color:var(--pt-gris);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pt-r-vacio{font-size:13px;color:var(--pt-tenue);padding:12px 6px 10px;border-top:1px solid var(--pt-linea)}',

    /* tarjetas de unidades */
    '.pt-turno-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;background:#e3f5ea;color:#145c37;white-space:nowrap}',
    '.pt-turno-pill:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}',
    '.btn-turno{padding:8px 14px;border-radius:10px;border:0;background:var(--pt-acento,#45b6f7);color:#16181d;font-weight:800;font-size:12.5px;font-family:inherit;cursor:pointer;box-shadow:0 4px 12px rgba(69,182,247,.35)}',
    '.btn-turno{--pt-acento:#45b6f7}',
  ].join('')

  function ponerEstilos() {
    var s = document.createElement('style')
    s.textContent = CSS
    document.head.appendChild(s)
  }

  // ------------------------------------------------------------ avisos
  function toast(texto, mal) {
    var t = document.createElement('div')
    t.className = 'pt-toast' + (mal ? ' mal' : '')
    t.textContent = texto
    document.body.appendChild(t)
    setTimeout(function () { t.remove() }, mal ? 6000 : 3500)
  }

  function modal(html) {
    var fondo = document.createElement('div')
    fondo.className = 'pt-fondo'
    fondo.innerHTML = '<div class="pt-modal" role="dialog" aria-modal="true"><button class="pt-cerrar" type="button" aria-label="Cerrar">×</button>' + html + '</div>'
    function cerrar() { fondo.remove(); document.removeEventListener('keydown', tecla) }
    function tecla(e) { if (e.key === 'Escape') cerrar() }
    fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar() })
    $('.pt-cerrar', fondo).addEventListener('click', cerrar)
    document.addEventListener('keydown', tecla)
    document.body.appendChild(fondo)
    return { el: $('.pt-modal', fondo), cerrar: cerrar }
  }

  // ------------------------------------------------------ armar la página
  var SECCIONES = {}

  function armarSolapas() {
    var wrap = $('.wrap')
    if (!wrap) return false
    // Lo que ya tenía la página (lista de unidades) queda en la solapa 1.
    var unidades = document.createElement('div')
    unidades.id = 'pt-unidades'
    while (wrap.firstChild) unidades.appendChild(wrap.firstChild)

    var tabs = document.createElement('div')
    tabs.className = 'pt-tabs'
    tabs.innerHTML =
      '<button type="button" class="pt-tab on" data-s="unidades">Unidades y services</button>' +
      '<button type="button" class="pt-tab" data-s="agenda">Agenda de turnos</button>' +
      '<button type="button" class="pt-tab" data-s="registro">Registro</button>'

    var agenda = document.createElement('div')
    agenda.id = 'pt-agenda'
    agenda.className = 'pt-oculto'
    agenda.innerHTML =
      '<div class="pt-barra"><div><h1 style="margin:0">Agenda de turnos</h1>' +
      '<p class="sub" style="margin:2px 0 0">Tocá un horario libre para dar un turno, o un turno para ver sus datos y cambiarlo.</p></div>' +
      '<span class="pt-esp"></span><button type="button" class="pt-btn prim" id="pt-nuevo"><span class="pt-mas">+</span> Nuevo turno</button></div>' +
      '<div id="pt-aviso-agenda"></div>' +
      '<div class="pt-resumen" id="pt-resumen"></div>' +
      '<div class="pt-rapida" id="pt-rapida"></div>' +
      '<div class="pt-cal" id="pt-cal-caja">' +
      '<div class="pt-cal-cab">' +
      '<div class="pt-cal-nav"><button type="button" class="pt-redondo" data-nav="prev" aria-label="Anterior">‹</button>' +
      '<button type="button" class="pt-redondo" data-nav="next" aria-label="Siguiente">›</button>' +
      '<button type="button" class="pt-hoy" data-nav="today">Hoy</button></div>' +
      '<div class="pt-cal-titulo" id="pt-cal-titulo"></div>' +
      '<div class="pt-vistas" id="pt-vistas"><button type="button" data-v="dayGridMonth">Mes</button><button type="button" data-v="timeGridWeek">Semana</button>' +
      '<button type="button" data-v="timeGridDay">Día</button><button type="button" data-v="listWeek">Lista</button></div>' +
      '</div>' +
      '<div id="pt-calendario"></div></div>' +
      '<div class="pt-barra" style="margin-top:14px"><div class="pt-leyenda" id="pt-leyenda" style="margin:0"></div><span class="pt-esp"></span>' +
      '<label class="pt-chk"><input type="checkbox" id="pt-cancelados"> Ver cancelados</label></div>'

    var registro = document.createElement('div')
    registro.id = 'pt-registro'
    registro.className = 'pt-oculto'
    registro.innerHTML =
      '<h1>Registro de turnos</h1>' +
      '<p class="sub">Todos los turnos con sus datos: persona, servicio, día, hora y cómo terminó.</p>' +
      '<div class="pt-barra">' +
      '<div class="pt-campo"><input type="month" id="pt-mes"></div>' +
      '<div class="pt-campo"><select id="pt-f-estado"><option value="">Todos los estados</option></select></div>' +
      '<div class="pt-campo" style="flex:1 1 200px"><input type="search" id="pt-f-buscar" placeholder="Buscar titular, patente, chasis o teléfono"></div>' +
      '<button type="button" class="pt-btn" id="pt-bajar">Bajar Excel (CSV)</button></div>' +
      '<div class="pt-kpis" id="pt-reg-kpis"></div>' +
      '<div id="pt-reg-tabla"></div>'

    wrap.appendChild(tabs)
    wrap.appendChild(unidades)
    wrap.appendChild(agenda)
    wrap.appendChild(registro)
    SECCIONES = { unidades: unidades, agenda: agenda, registro: registro }

    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.pt-tab'); if (!b) return
      mostrarSeccion(b.dataset.s)
    })
    return true
  }

  function mostrarSeccion(s) {
    $$('.pt-tab').forEach(function (b) { b.classList.toggle('on', b.dataset.s === s) })
    Object.keys(SECCIONES).forEach(function (k) { SECCIONES[k].classList.toggle('pt-oculto', k !== s) })
    try { sessionStorage.setItem('pt-seccion', s) } catch (e) { /* sin almacenamiento */ }
    if (s === 'agenda') abrirAgenda()
    if (s === 'registro') cargarRegistro()
  }

  // ------------------------------------------------------------ agenda
  function horarioCalendario() {
    var h = (S.config && S.config.horario) || {}
    var negocio = [], min = '23:59', max = '00:00', ocultos = []
    for (var iso = 1; iso <= 7; iso++) {
      var franjas = h[String(iso)] || []
      var dow = iso % 7
      if (!franjas.length) ocultos.push(dow)
      franjas.forEach(function (f) {
        negocio.push({ daysOfWeek: [dow], startTime: f.desde, endTime: f.hasta })
        if (f.desde < min) min = f.desde
        if (f.hasta > max) max = f.hasta
      })
    }
    if (!negocio.length) { min = '08:00'; max = '18:00' }
    return { negocio: negocio, min: min + ':00', max: max + ':00', ocultos: ocultos }
  }

  var VISTAS_TITULO = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
  // Por número de día (0 = domingo): en la vista mes FullCalendar pasa la fecha en UTC
  // y con Intl se corría un día.
  var SEM_CORTA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  var ESTADO_CORTO = {
    pendiente: 'Sin confirmar', confirmado: 'Confirmado', completado: 'Cumplido', no_show: 'No vino',
    cancelado: 'Cancelado', a_reprogramar: 'Reprogramar', en_recepcion: 'Recepción', en_proceso: 'En proceso', entregado: 'Entregado',
  }

  function tinte(hex, alfa) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '')
    if (!m) return 'rgba(69,182,247,' + alfa + ')'
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + alfa + ')'
  }
  function colorDe(t) { return t.estado === 'no_show' ? '#d6483a' : (t.color || '#45b6f7') }
  function nombreCorto(t) { return titulo(t.cliente_apellido) + ', ' + titulo(String(t.cliente_nombre || '').split(' ')[0]) }
  function badge(estado) { return '<span class="pt-est ' + estado + '">' + esc(ESTADO_CORTO[estado] || estado) + '</span>' }

  function abrirAgenda() {
    cargarResumen()
    if (S.cal) { S.cal.updateSize(); return }
    if (!S.perfil) {
      $('#pt-aviso-agenda').innerHTML = '<div class="pt-aviso mal">Para ver la agenda tenés que entrar al hub con tu mail y tu código.</div>'
      $('#pt-cal-caja').classList.add('pt-oculto'); $('#pt-nuevo').classList.add('pt-oculto')
      return
    }
    if (!S.config) {
      $('#pt-aviso-agenda').innerHTML = '<div class="pt-aviso mal">La agenda todavía no está habilitada para tu cuenta. Pedile a Calidad que te active como <b>Asesor de servicio</b> (da turnos) o <b>Técnico de taller</b> (sólo mira).</div>'
      $('#pt-cal-caja').classList.add('pt-oculto'); $('#pt-nuevo').classList.add('pt-oculto')
      return
    }
    if (!S.puedeEditar) {
      $('#pt-aviso-agenda').innerHTML = '<div class="pt-aviso">Estás viendo la agenda en modo consulta: los turnos los da postventa.</div>'
      $('#pt-nuevo').classList.add('pt-oculto')
    }
    if (!window.FullCalendar) {
      $('#pt-aviso-agenda').innerHTML = '<div class="pt-aviso mal">No se pudo cargar el calendario. Revisá internet y recargá la página.</div>'
      return
    }
    var hc = horarioCalendario()
    var celu = window.matchMedia('(max-width: 720px)').matches
    S.cal = new FullCalendar.Calendar($('#pt-calendario'), {
      locale: 'es',
      initialView: celu ? 'timeGridDay' : 'timeGridWeek',
      headerToolbar: false,
      firstDay: 1,
      allDaySlot: false,
      nowIndicator: true,
      slotDuration: '00:30:00',
      slotMinTime: hc.min,
      slotMaxTime: hc.max,
      hiddenDays: hc.ocultos.length < 7 ? hc.ocultos : [],
      businessHours: hc.negocio,
      height: 'auto',
      expandRows: true,
      eventMaxStack: 3,
      slotEventOverlap: false,
      dayMaxEvents: 3,
      noEventsContent: 'No hay turnos en estos días.',
      slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      selectable: S.puedeEditar,
      selectMirror: true,
      editable: S.puedeEditar,
      eventDurationEditable: S.puedeEditar,
      events: traerEventos,
      datesSet: function () { actualizarCabecera(); pintarDisponibilidad() },
      dayHeaderContent: function (arg) {
        var sem = SEM_CORTA[arg.dow]
        if (arg.view.type === 'dayGridMonth') return { html: '<div class="pt-dh"><span class="pt-dh-sem">' + esc(sem) + '</span></div>' }
        var dia = isoDia(arg.date)
        return { html: '<div class="pt-dh' + (arg.isToday ? ' hoy' : '') + (dia < hoyISO() ? ' pasado' : '') + '" data-dia="' + dia + '">' +
          '<span class="pt-dh-sem">' + esc(sem) + '</span><span class="pt-dh-num">' + arg.date.getDate() + '</span></div>' }
      },
      eventContent: contenidoTurno,
      eventDidMount: function (info) {
        var t = info.event.extendedProps.t
        info.el.style.setProperty('--c', colorDe(t))
        info.el.style.setProperty('--bg', tinte(colorDe(t), 0.16))
        info.el.title = nombreCorto(t) + ' · ' + (t.servicio || '') + ' · ' + hora(t.inicio) + ' a ' + hora(t.fin)
      },
      dateClick: function (info) {
        if (info.view.type === 'dayGridMonth') { S.cal.changeView('timeGridDay', info.dateStr); return }
        if (!S.puedeEditar) return
        abrirNuevo({ dia: isoDia(info.date), hora: hora(info.date) })
      },
      select: function (info) {
        if (!S.puedeEditar || info.view.type === 'dayGridMonth') return
        var min = Math.round((info.end - info.start) / 60000)
        S.cal.unselect()
        if (min <= 30) return // un toque lo maneja dateClick
        abrirNuevo({ dia: isoDia(info.start), hora: hora(info.start), minutos: min })
      },
      eventClick: function (info) { info.jsEvent.preventDefault(); abrirDetalle(info.event.extendedProps.t) },
      eventAllow: function (_, ev) { return ['pendiente', 'confirmado'].indexOf(ev.extendedProps.t.estado) >= 0 },
      eventDrop: moverEvento,
      eventResize: moverEvento,
      eventClassNames: function (arg) { return ['ev-' + arg.event.extendedProps.t.estado] },
    })
    S.cal.render()

    $('.pt-cal-cab').addEventListener('click', function (e) {
      var b = e.target.closest('[data-nav],[data-v]'); if (!b) return
      if (b.dataset.nav === 'prev') S.cal.prev()
      else if (b.dataset.nav === 'next') S.cal.next()
      else if (b.dataset.nav === 'today') S.cal.today()
      else if (b.dataset.v) S.cal.changeView(b.dataset.v)
    })
    actualizarCabecera()
    pintarLeyenda()
  }

  function actualizarCabecera() {
    if (!S.cal) return
    var v = S.cal.view
    var mes = VISTAS_TITULO.format(v.currentStart)
    mes = mes.charAt(0).toUpperCase() + mes.slice(1)
    var detalle = v.type === 'dayGridMonth' ? '' : v.title
    if (v.type === 'timeGridDay') detalle = diaCorto(v.currentStart) + (isoDia(v.currentStart) === hoyISO() ? ' · hoy' : '')
    $('#pt-cal-titulo').innerHTML = esc(mes) + (detalle ? '<small>' + esc(detalle) + '</small>' : '')
    $$('#pt-vistas button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === v.type) })
  }

  function contenidoTurno(arg) {
    var t = arg.event.extendedProps.t
    var tipo = arg.view.type
    if (tipo === 'dayGridMonth') {
      return { html: '<div class="pt-mes-ev" style="--c:' + esc(colorDe(t)) + '"><i></i><b>' + esc(hora(t.inicio)) + '</b><span>' + esc(nombreCorto(t)) + '</span></div>' }
    }
    if (tipo.indexOf('list') === 0) {
      return { html: '<div class="pt-lista-ev"><b>' + esc(nombreCorto(t)) + '</b><span>' + esc([t.servicio, t.modelo, t.patente].filter(Boolean).join(' · ')) + '</span>' + badge(t.estado) + '</div>' }
    }
    var corto = (t.minutos || 60) <= 30
    // En la semana las columnas son angostas: hora, puntito de estado y nombre.
    if (tipo === 'timeGridWeek') {
      return { html: '<div class="pt-ev' + (corto ? ' corto' : '') + '"><div class="pt-ev-top"><span class="pt-ev-hora">' + esc(hora(t.inicio)) + '</span>' +
        '<span class="pt-punto ' + t.estado + '" title="' + esc(ESTADO_CORTO[t.estado] || '') + '"></span></div>' +
        '<div class="pt-ev-nom">' + esc(nombreCorto(t)) + '</div>' + (corto ? '' : '<div class="pt-ev-serv">' + esc(t.servicio || 'Turno') + '</div>') + '</div>' }
    }
    var auto = [t.modelo, t.patente].filter(Boolean).join(' · ')
    if (corto) {
      return { html: '<div class="pt-ev corto"><span class="pt-ev-hora">' + esc(hora(t.inicio)) + '</span><span class="pt-ev-nom">' + esc(nombreCorto(t)) + '</span></div>' }
    }
    return { html: '<div class="pt-ev">' +
      '<div class="pt-ev-top"><span class="pt-ev-hora">' + esc(hora(t.inicio)) + ' – ' + esc(hora(t.fin)) + '</span>' + badge(t.estado) + '</div>' +
      '<div class="pt-ev-nom">' + esc(nombreCorto(t)) + '</div>' +
      '<div class="pt-ev-serv">' + esc(t.servicio || 'Turno') + '</div>' +
      (auto && (t.minutos || 60) >= 90 ? '<div class="pt-ev-serv">' + esc(auto) + '</div>' : '') +
      '</div>' }
  }

  function traerEventos(info, ok, mal) {
    api.turnos(info.start.toISOString(), info.end.toISOString()).then(function (filas) {
      ok(filas.filter(function (t) {
        return S.verCancelados || ['cancelado', 'no_show', 'a_reprogramar'].indexOf(t.estado) < 0
      }).map(function (t) {
        return {
          id: t.id,
          title: nombreCorto(t),
          start: t.inicio,
          end: t.fin,
          backgroundColor: tinte(colorDe(t), 0.16),
          borderColor: colorDe(t),
          textColor: '#16181d',
          editable: S.puedeEditar && ['pendiente', 'confirmado'].indexOf(t.estado) >= 0,
          extendedProps: { t: t },
        }
      }))
    }).catch(function (e) { mal(e); toast(textoError(e), true) })
  }

  function pintarLeyenda() {
    $('#pt-leyenda').innerHTML = S.servicios.map(function (s) {
      return '<span><i style="background:' + esc(s.color || '#45b6f7') + '"></i>' + esc(s.nombre) + '</span>'
    }).join('')
  }

  // Cuántos horarios de 1 hora tiene un día según el horario del taller.
  function horariosDelDia(iso) {
    var h = (S.config && S.config.horario) || {}
    var dow = new Date(iso + 'T12:00:00-03:00').getUTCDay() || 7
    var paso = (S.config && S.config.intervalo_minutos) || 30
    return (h[String(dow)] || []).reduce(function (n, f) {
      var a = f.desde.split(':'), b = f.hasta.split(':')
      var largo = (+b[0] * 60 + +b[1]) - (+a[0] * 60 + +a[1]) - 60
      return n + (largo >= 0 ? Math.floor(largo / paso) + 1 : 0)
    }, 0)
  }

  // Barrita de lugar libre en cada día visible (para un turno de 1 hora).
  function pintarDisponibilidad() {
    if (!S.cal) return
    var v = S.cal.view
    var desde = isoDia(v.activeStart), hasta = isoDia(new Date(v.activeEnd.getTime() - 1))
    api.dias(desde, hasta, 60).then(function (dias) {
      dias.forEach(function (d) { S.disponibles[d.fecha] = d })
      $$('.pt-disp').forEach(function (b) { b.remove() })
      $$('.fc-daygrid-day[data-date], .pt-dh[data-dia]').forEach(function (celda) {
        var f = celda.getAttribute('data-date') || celda.getAttribute('data-dia')
        var d = S.disponibles[f]
        // Hoy sin horarios casi siempre es que ya pasó la hora: no es "completo".
        if (!d || f < hoyISO() || (f === hoyISO() && !d.feriado && d.libres === 0)) return
        var total = Math.max(horariosDelDia(f), d.libres, 1)
        var b = document.createElement('div')
        if (d.feriado) { b.className = 'pt-disp fer'; b.textContent = 'Feriado' }
        else if (d.libres === 0) { b.className = 'pt-disp lleno'; b.textContent = 'Completo' }
        else {
          b.className = 'pt-disp' + (d.libres / total <= 0.25 ? ' poco' : '')
          b.innerHTML = '<span class="barra"><i style="width:' + Math.round(d.libres / total * 100) + '%"></i></span>' + d.libres + ' libres'
        }
        b.title = d.feriado ? d.feriado : d.libres + ' horarios libres para un turno de 1 hora'
        if (celda.classList.contains('pt-dh')) celda.appendChild(b)
        else {
          var top = $('.fc-daygrid-day-top', celda)
          if (top) top.parentNode.insertBefore(b, top.nextSibling)
        }
      })
    }).catch(function () { /* la disponibilidad es una ayuda: si falla, el calendario sigue */ })
  }

  // --------------------------------------- resumen y vista rápida (todos)
  var ICONOS = {
    hoy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="15.5" r="1.6" fill="currentColor"/></svg>',
    proximos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  }

  function cargarResumen() {
    if (!S.config) { $('#pt-resumen').innerHTML = ''; $('#pt-rapida').innerHTML = ''; return }
    var hoy = hoyISO()
    var desde = hoy.slice(0, 8) + '01T00:00:00-03:00'
    var hasta = sumarDias(hoy, 8) + 'T00:00:00-03:00'
    api.turnos(desde, hasta).then(function (filas) {
      var activos = filas.filter(function (t) { return ['cancelado', 'no_show', 'a_reprogramar'].indexOf(t.estado) < 0 })
      var deHoy = activos.filter(function (t) { return isoDia(t.inicio) === hoy })
      activos.sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1 })
      var proximos = activos.filter(function (t) { return isoDia(t.inicio) > hoy })
      var sinConfirmar = activos.filter(function (t) { return t.estado === 'pendiente' && isoDia(t.inicio) >= hoy })
      var cumplidos = filas.filter(function (t) { return t.estado === 'completado' })
      var pendientesHoy = deHoy.filter(function (t) { return t.estado !== 'completado' })
      var k = [
        ['dest', 'hoy', deHoy.length, deHoy.length === 1 ? 'Turno hoy' : 'Turnos hoy'],
        ['', 'proximos', proximos.length, 'Próximos 7 días'],
        ['alerta', 'alerta', sinConfirmar.length, 'Sin confirmar'],
        ['ok', 'ok', cumplidos.length, 'Cumplidos este mes'],
      ]
      $('#pt-resumen').innerHTML = k.map(function (x) {
        return '<div class="pt-res-k ' + x[0] + '"><div class="ico">' + ICONOS[x[1]] + '</div><div><div class="n">' + x[2] + '</div><div class="l">' + x[3] + '</div></div></div>'
      }).join('')

      function fila(t, conDia) {
        return '<button type="button" class="pt-r-fila" data-id="' + t.id + '" style="--c:' + esc(colorDe(t)) + '">' +
          '<span class="pt-r-hora">' + (conDia ? '<small>' + esc(diaCorto(t.inicio)) + '</small>' : '') + esc(hora(t.inicio)) + '</span>' +
          '<span class="pt-r-txt"><b>' + esc(nombreCorto(t)) + '</b><span>' + esc([t.servicio, t.modelo, t.patente].filter(Boolean).join(' · ')) + '</span></span>' +
          badge(t.estado) + '</button>'
      }
      var porId = {}
      filas.forEach(function (t) { porId[t.id] = t })
      $('#pt-rapida').innerHTML =
        '<div class="pt-r-caja"><div class="pt-r-cab"><b>Hoy</b><span>' + esc(diaCorto(hoy + 'T12:00:00-03:00')) + ' · ' +
        (pendientesHoy.length ? pendientesHoy.length + ' por atender' : 'nada pendiente') + '</span></div><div class="pt-r-lista">' +
        (deHoy.length ? deHoy.map(function (t) { return fila(t, false) }).join('') : '<div class="pt-r-vacio">Hoy no hay turnos.</div>') + '</div></div>' +
        '<div class="pt-r-caja"><div class="pt-r-cab"><b>Próximos</b><span>los siguientes 7 días</span></div><div class="pt-r-lista">' +
        (proximos.length ? proximos.map(function (t) { return fila(t, true) }).join('')
          : '<div class="pt-r-vacio">No hay turnos en los próximos días.</div>') + '</div></div>'
      $$('#pt-rapida .pt-r-fila').forEach(function (b) {
        b.addEventListener('click', function () { var t = porId[b.dataset.id]; if (t) abrirDetalle(t) })
      })
    }).catch(function (e) { $('#pt-resumen').innerHTML = '<div class="pt-aviso mal">' + esc(textoError(e)) + '</div>' })
  }

  function refrescarTodo() {
    if (S.cal) { S.cal.refetchEvents(); pintarDisponibilidad() }
    if (!SECCIONES.agenda.classList.contains('pt-oculto')) cargarResumen()
    cargarProximos()
    if (!SECCIONES.registro.classList.contains('pt-oculto')) cargarRegistro()
  }

  function moverEvento(info) {
    var t = info.event.extendedProps.t
    var min = Math.round((info.event.end - info.event.start) / 60000)
    var antes = diaCorto(t.inicio) + ' ' + hora(t.inicio)
    var despues = diaCorto(info.event.start) + ' ' + hora(info.event.start)
    if (!confirm('¿Mover el turno de ' + titulo(t.cliente_apellido) + ' del ' + antes + ' al ' + despues + ' (' + duracionTexto(min) + ')?')) {
      info.revert(); return
    }
    api.reprogramar(t.id, info.event.start.toISOString(), min).then(function () {
      toast('Turno reprogramado. Avisale al cliente el nuevo horario.')
      refrescarTodo()
    }).catch(function (e) { info.revert(); toast(textoError(e), true) })
  }

  // ------------------------------------------------------- nuevo turno
  function opcionesDuracion(sel) {
    var lista = DURACIONES.slice()
    if (sel && lista.indexOf(sel) < 0) { lista.push(sel); lista.sort(function (a, b) { return a - b }) }
    return lista.map(function (m) {
      return '<option value="' + m + '"' + (m === sel ? ' selected' : '') + '>' + duracionTexto(m) + '</option>'
    }).join('')
  }

  function campo(id, etiqueta, valor, extra) {
    extra = extra || {}
    return '<div class="pt-campo' + (extra.ancho ? ' ancho' : '') + '" data-c="' + id + '"><label for="pt-' + id + '">' + etiqueta + '</label>' +
      '<input id="pt-' + id + '" value="' + esc(valor || '') + '"' + (extra.tipo ? ' type="' + extra.tipo + '"' : '') +
      (extra.ph ? ' placeholder="' + esc(extra.ph) + '"' : '') + (extra.attrs || '') + '>' +
      (extra.ayuda ? '<div class="pt-ayuda">' + extra.ayuda + '</div>' : '') + '</div>'
  }

  // datos: { dia, hora, minutos, cliente:{...}, vehiculo:{...}, servicio }
  function abrirNuevo(datos) {
    if (!S.puedeEditar) return
    datos = datos || {}
    var c = datos.cliente || {}, v = datos.vehiculo || {}
    var serv = datos.servicio ? S.servicios.filter(function (s) { return s.id === datos.servicio })[0] : null
    var minutos = datos.minutos || (serv ? serv.duracion_minutos : 60)
    var dia = datos.dia || hoyISO()

    var m = modal(
      '<h2>Nuevo turno</h2><p class="pt-sub">Los datos del titular, como figuran en la cédula verde.</p>' +
      '<div class="pt-campo"><label for="pt-buscar">Buscar cliente o auto ya cargado</label>' +
      '<input id="pt-buscar" type="search" placeholder="Apellido, patente o chasis" autocomplete="off">' +
      '<div id="pt-resultados"></div></div>' +
      '<div class="pt-seccion">Titular y vehículo</div>' +
      '<div class="pt-grilla">' +
      campo('nombre', 'Nombre del titular *', c.nombre, { attrs: ' autocomplete="off"' }) +
      campo('apellido', 'Apellido del titular *', c.apellido, { attrs: ' autocomplete="off"' }) +
      campo('telefono', 'Teléfono *', c.telefono, { tipo: 'tel', ph: '261 555 1234' }) +
      campo('modelo', 'Modelo del vehículo', v.modelo, { ph: 'Dolphin Mini, Yuan Pro…' }) +
      campo('vin', 'Chasis / VIN', v.vin, { attrs: ' autocapitalize="characters" autocomplete="off"' }) +
      campo('patente', 'Patente', v.patente, { ph: 'AB123CD', attrs: ' autocapitalize="characters" autocomplete="off"' }) +
      '</div>' +
      '<div class="pt-seccion">Turno</div>' +
      '<div class="pt-grilla">' +
      '<div class="pt-campo" data-c="servicio"><label for="pt-servicio">Servicio *</label><select id="pt-servicio"><option value="">Elegí…</option>' +
      S.servicios.map(function (s) {
        return '<option value="' + s.id + '"' + (serv && serv.id === s.id ? ' selected' : '') + '>' + esc(s.nombre) + '</option>'
      }).join('') + '</select></div>' +
      '<div class="pt-campo" data-c="minutos"><label for="pt-minutos">¿Cuánto demora? *</label><select id="pt-minutos">' + opcionesDuracion(minutos) + '</select></div>' +
      '<div class="pt-campo" data-c="dia"><label for="pt-dia">Día *</label><input id="pt-dia" type="date" min="' + hoyISO() + '" value="' + dia + '"></div>' +
      '<div class="pt-campo" data-c="origen"><label for="pt-origen">Lo pidió por</label><select id="pt-origen">' +
      '<option value="whatsapp">WhatsApp</option><option value="telefono">Teléfono</option><option value="presencial">En persona</option><option value="mail">Mail</option><option value="otro">Otro</option></select></div>' +
      '<div class="pt-campo ancho" data-c="hora"><label>Horario * <span style="font-weight:600;color:var(--gris-medio)">(sólo los que tienen lugar)</span></label><div id="pt-horas" class="pt-chips"></div></div>' +
      '<div class="pt-campo ancho" data-c="obs"><label for="pt-obs">Observaciones</label><textarea id="pt-obs" placeholder="Lo que cuenta el cliente, km, etc."></textarea></div>' +
      '</div>' +
      '<div id="pt-error"></div>' +
      '<div class="pt-acciones"><button type="button" class="pt-btn prim" id="pt-guardar">Guardar turno</button></div>'
    )
    var el = m.el
    var elegida = datos.hora || null
    var fechaEntrega = v.fecha_entrega || null

    function cargarHoras() {
      var d = $('#pt-dia', el).value, min = +$('#pt-minutos', el).value
      var caja = $('#pt-horas', el)
      if (!d) { caja.innerHTML = '<div class="pt-vacio">Elegí un día.</div>'; return }
      caja.innerHTML = '<div class="pt-vacio">Buscando horarios…</div>'
      api.libres(d, min).then(function (libres) {
        if (!libres.length) {
          caja.innerHTML = '<div class="pt-vacio">No quedan horarios para ' + duracionTexto(min) + ' ese día.</div><div id="pt-sugeridos" class="pt-chips"></div>'
          sugerirDias(d, min, $('#pt-sugeridos', el), function (nuevo) { $('#pt-dia', el).value = nuevo; elegida = null; cargarHoras() })
          return
        }
        var horas = libres.map(function (l) { return hora(l.inicio) })
        if (elegida && horas.indexOf(elegida) < 0) elegida = null
        caja.innerHTML = libres.map(function (l) {
          var h = hora(l.inicio)
          return '<button type="button" class="pt-chip' + (h === elegida ? ' on' : '') + '" data-h="' + h + '">' + h +
            '<small' + (l.lugares === 1 ? ' class="uno">1 lugar' : '>' + l.lugares + ' lugares') + '</small></button>'
        }).join('')
      }).catch(function (e) { caja.innerHTML = '<div class="pt-aviso mal">' + esc(textoError(e)) + '</div>' })
    }
    $('#pt-horas', el).addEventListener('click', function (e) {
      var b = e.target.closest('.pt-chip'); if (!b || !b.dataset.h) return
      elegida = b.dataset.h
      $$('.pt-chip', $('#pt-horas', el)).forEach(function (x) { x.classList.toggle('on', x === b) })
    })
    $('#pt-dia', el).addEventListener('change', cargarHoras)
    $('#pt-minutos', el).addEventListener('change', cargarHoras)
    $('#pt-servicio', el).addEventListener('change', function () {
      var s = S.servicios.filter(function (x) { return x.id === this.value }, this)[0]
      if (s) { $('#pt-minutos', el).innerHTML = opcionesDuracion(s.duracion_minutos); cargarHoras() }
    })
    cargarHoras()

    // Buscador: autos ya cargados en la base y entregas de la planilla.
    var espera = null
    $('#pt-buscar', el).addEventListener('input', function () {
      var q = this.value.trim()
      clearTimeout(espera)
      if (q.length < 2) { $('#pt-resultados', el).innerHTML = ''; return }
      espera = setTimeout(function () { buscar(q) }, 250)
    })
    function buscar(q) {
      var locales = buscarEnEntregas(q)
      api.buscarVehiculos(q).catch(function () { return [] }).then(function (base) {
        var vistos = {}, items = []
        base.forEach(function (x) {
          if (x.vin) vistos[x.vin] = 1
          var cl = x.cliente || {}
          items.push({
            titulo: titulo(x.titular_apellido || cl.apellido) + ', ' + titulo(x.titular_nombre || cl.nombre),
            detalle: [x.modelo_texto, x.patente, x.vin, cl.telefono].filter(Boolean).join(' · '),
            cliente: { nombre: titulo(x.titular_nombre || cl.nombre), apellido: titulo(x.titular_apellido || cl.apellido), telefono: cl.telefono || '' },
            vehiculo: { modelo: x.modelo_texto || '', vin: x.vin || '', patente: x.patente || '', fecha_entrega: x.fecha_entrega },
          })
        })
        locales.forEach(function (x) { if (!vistos[x.vehiculo.vin]) items.push(x) })
        var caja = $('#pt-resultados', el)
        if (!items.length) { caja.innerHTML = '<div class="pt-vacio">No hay nadie cargado con eso: completá los datos a mano.</div>'; return }
        caja.innerHTML = '<div class="pt-resultados">' + items.slice(0, 10).map(function (x, i) {
          return '<button type="button" class="pt-res" data-i="' + i + '"><b>' + esc(x.titulo) + '</b><span>' + esc(x.detalle) + '</span></button>'
        }).join('') + '</div>'
        $$('.pt-res', caja).forEach(function (b) {
          b.addEventListener('click', function () {
            var x = items[+b.dataset.i]
            completar(x.cliente, x.vehiculo)
            caja.innerHTML = ''
            $('#pt-buscar', el).value = ''
          })
        })
      })
    }
    function completar(cl, ve) {
      $('#pt-nombre', el).value = cl.nombre || ''
      $('#pt-apellido', el).value = cl.apellido || ''
      $('#pt-telefono', el).value = cl.telefono || ''
      $('#pt-modelo', el).value = ve.modelo || ''
      $('#pt-vin', el).value = ve.vin || ''
      $('#pt-patente', el).value = ve.patente || ''
      fechaEntrega = ve.fecha_entrega || null
    }

    $('#pt-guardar', el).addEventListener('click', function () {
      var boton = this
      $$('.pt-campo', el).forEach(function (x) { x.classList.remove('error'); var e = $('.pt-err', x); if (e) e.remove() })
      $('#pt-error', el).innerHTML = ''
      var val = function (id) { return $('#pt-' + id, el).value.trim() }
      var errores = []
      function falta(id, texto) {
        errores.push(id)
        var c = $('[data-c="' + id + '"]', el); if (!c) return
        c.classList.add('error')
        var e = document.createElement('div'); e.className = 'pt-err'; e.textContent = texto; c.appendChild(e)
      }
      if (!val('nombre')) falta('nombre', 'Cargá el nombre del titular.')
      if (!val('apellido')) falta('apellido', 'Cargá el apellido del titular.')
      if (!val('telefono')) falta('telefono', 'Cargá un teléfono.')
      else if (!telefonoWa(val('telefono'))) falta('telefono', 'Revisá el número: con característica, por ejemplo 261 555 1234.')
      var pat = val('patente').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      if (pat && !/^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/.test(pat)) falta('patente', 'La patente tiene que ser como ABC123 o AB123CD.')
      var vin = val('vin').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      if (vin && vin.length !== 17) falta('vin', 'El chasis tiene 17 caracteres (tiene ' + vin.length + ').')
      if (!val('servicio')) falta('servicio', 'Elegí el servicio.')
      if (!val('dia')) falta('dia', 'Elegí el día.')
      if (!elegida) falta('hora', 'Elegí un horario.')
      if (errores.length) { var p = $('[data-c="' + errores[0] + '"]', el); if (p) p.scrollIntoView({ block: 'center', behavior: 'smooth' }); return }

      boton.disabled = true; boton.textContent = 'Guardando…'
      var min = +val('minutos')
      api.darTurno({
        cliente: { nombre: titulo(val('nombre')), apellido: titulo(val('apellido')), telefono: val('telefono') },
        vehiculo: (vin || pat) ? {
          vin: vin, patente: pat, modelo: val('modelo'), fecha_entrega: fechaEntrega,
          titular_nombre: titulo(val('nombre')), titular_apellido: titulo(val('apellido')),
        } : null,
        servicio: val('servicio'),
        inicio: val('dia') + 'T' + elegida + ':00-03:00',
        minutos: min,
        origen: val('origen'),
        observaciones: [val('obs'), (!vin && !pat && val('modelo')) ? 'Modelo: ' + val('modelo') : ''].filter(Boolean).join(' · '),
      }).then(function (r) {
        m.cerrar()
        refrescarTodo()
        var serv = S.servicios.filter(function (s) { return s.id === val('servicio') })[0]
        avisoGuardado({
          numero: r.numero,
          cliente_nombre: val('nombre'), cliente_apellido: val('apellido'), cliente_telefono: val('telefono'),
          inicio: val('dia') + 'T' + elegida + ':00-03:00', fin: null, modelo: val('modelo'), patente: pat,
          servicio: serv ? serv.nombre : '', minutos: min,
        })
      }).catch(function (e) {
        boton.disabled = false; boton.textContent = 'Guardar turno'
        $('#pt-error', el).innerHTML = '<div class="pt-aviso mal">' + esc(textoError(e)) + '</div>'
        cargarHoras()
      })
    })
    setTimeout(function () { (c.nombre ? $('#pt-servicio', el) : $('#pt-buscar', el)).focus() }, 50)
  }

  function sugerirDias(desde, min, caja, elegir) {
    api.dias(sumarDias(desde, 1), sumarDias(desde, 21), min).then(function (dias) {
      var con = dias.filter(function (d) { return d.libres > 0 && !d.feriado }).slice(0, 6)
      if (!con.length) { caja.innerHTML = '<div class="pt-vacio">Tampoco hay lugar en las próximas 3 semanas.</div>'; return }
      caja.innerHTML = '<div class="pt-vacio" style="width:100%">Días con lugar:</div>' + con.map(function (d) {
        return '<button type="button" class="pt-chip" data-d="' + d.fecha + '">' + diaCorto(d.fecha + 'T12:00:00-03:00') + '<small>' + d.libres + '</small></button>'
      }).join('')
      $$('.pt-chip', caja).forEach(function (b) { b.addEventListener('click', function () { elegir(b.dataset.d) }) })
    }).catch(function () { caja.innerHTML = '' })
  }

  function datosMensaje(t) {
    return {
      cliente: titulo(String(t.cliente_nombre || '').split(' ')[0]),
      fecha: fecha(t.inicio),
      hora: hora(t.inicio),
      patente: t.patente || '',
      modelo: t.modelo || '',
      servicios: t.servicio || 'el turno',
    }
  }
  function botonWa(t, tipo, texto) {
    var plantillas = (S.config && S.config.mensajes) || {}
    var link = linkWa(t.cliente_telefono, armarMensaje(plantillas[tipo], datosMensaje(t)))
    return link ? '<a class="pt-btn wa" target="_blank" rel="noopener" href="' + esc(link) + '">' + texto + '</a>' : ''
  }

  function avisoGuardado(t) {
    var m = modal(
      '<h2>Turno ' + (t.numero ? 'N.º ' + esc(t.numero) + ' ' : '') + 'guardado</h2>' +
      '<p class="pt-sub">' + esc(titulo(t.cliente_apellido) + ', ' + titulo(t.cliente_nombre)) + ' · ' + esc(t.servicio) + '<br>' +
      esc(diaCorto(t.inicio)) + ' a las ' + esc(hora(t.inicio)) + ' · ' + esc(duracionTexto(t.minutos)) + '</p>' +
      '<div class="pt-acciones">' + (botonWa(t, 'confirmacion', 'Mandar confirmación por WhatsApp') ||
        '<div class="pt-aviso mal">El teléfono no sirve para WhatsApp: avisale por otro medio.</div>') +
      '<button type="button" class="pt-btn" id="pt-listo">Listo</button></div>'
    )
    $('#pt-listo', m.el).addEventListener('click', m.cerrar)
  }

  // ---------------------------------------------------------- detalle
  function abrirDetalle(t) {
    var est = t.estado
    var activo = est === 'pendiente' || est === 'confirmado'
    var html =
      '<div class="pt-cinta" style="--c:' + esc(t.estado === 'no_show' ? '#d6483a' : (t.color || '#45b6f7')) + '"></div>' +
      '<h2>' + esc(titulo(t.cliente_apellido) + ', ' + titulo(t.cliente_nombre)) + '</h2>' +
      '<p class="pt-sub">Turno N.º ' + esc(t.numero) + ' · <span class="pt-estado ' + est + '">' + esc(ETIQUETA_ESTADO[est] || est) + '</span></p>' +
      '<dl class="pt-datos">' +
      '<dt>Servicio</dt><dd>' + esc(t.servicio || '—') + '</dd>' +
      '<dt>Día</dt><dd>' + esc(diaCorto(t.inicio)) + ' · ' + esc(fecha(t.inicio)) + '</dd>' +
      '<dt>Horario</dt><dd>' + esc(hora(t.inicio)) + ' a ' + esc(hora(t.fin)) + ' (' + esc(duracionTexto(t.minutos)) + ')</dd>' +
      '<dt>Teléfono</dt><dd>' + esc(t.cliente_telefono || '—') + '</dd>' +
      '<dt>Modelo</dt><dd>' + esc(t.modelo || '—') + '</dd>' +
      '<dt>Patente</dt><dd>' + esc(t.patente || '—') + '</dd>' +
      '<dt>Chasis</dt><dd>' + esc(t.vin || '—') + '</dd>' +
      (t.observaciones ? '<dt>Notas</dt><dd>' + esc(t.observaciones) + '</dd>' : '') +
      (t.motivo_cancelacion ? '<dt>Motivo</dt><dd>' + esc(t.motivo_cancelacion) + '</dd>' : '') +
      '<dt>Cargado</dt><dd>' + esc(fecha(t.created_at)) + (t.cargado_por ? ' por ' + esc(t.cargado_por) : '') + '</dd>' +
      '</dl>'

    if (S.puedeEditar) {
      var b = []
      if (est === 'pendiente') b.push('<button type="button" class="pt-btn ok" data-a="confirmado">Confirmó</button>')
      if (activo) {
        b.push('<button type="button" class="pt-btn ok" data-a="completado">Cumplido</button>')
        b.push('<button type="button" class="pt-btn" data-a="reprogramar">Reprogramar</button>')
        b.push('<button type="button" class="pt-btn mal" data-a="no_show">No vino</button>')
        b.push('<button type="button" class="pt-btn mal" data-a="cancelado">Cancelar turno</button>')
      }
      if (est === 'cancelado' || est === 'no_show' || est === 'a_reprogramar') {
        b.push('<button type="button" class="pt-btn prim" data-a="reprogramar">Darle otro día</button>')
      }
      html += '<div class="pt-acciones">' + b.join('') + '</div>'
    }
    var wa = []
    if (activo) {
      wa.push(botonWa(t, est === 'pendiente' ? 'confirmacion' : 'recordatorio', est === 'pendiente' ? 'WhatsApp: pedir confirmación' : 'WhatsApp: recordatorio'))
    }
    if (est === 'completado') wa.push(botonWa(t, 'listo', 'WhatsApp: ya está listo'))
    if (est === 'cancelado' || est === 'no_show' || est === 'a_reprogramar') wa.push(botonWa(t, 'reprogramar', 'WhatsApp: ofrecer otro día'))
    var tel = telefonoWa(t.cliente_telefono)
    if (tel) wa.push('<a class="pt-btn wa" target="_blank" rel="noopener" href="https://wa.me/' + tel + '">Abrir chat</a>')
    if (wa.join('')) html += '<div class="pt-acciones">' + wa.join('') + '</div>'
    html += '<div id="pt-extra"></div>'

    var m = modal(html)
    $$('[data-a]', m.el).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = btn.dataset.a
        if (a === 'reprogramar') { m.cerrar(); abrirReprogramar(t); return }
        if (a === 'cancelado' || a === 'no_show') { pedirMotivo(m, t, a); return }
        cambiar(m, t, a, null, btn)
      })
    })
  }

  function cambiar(m, t, estado, motivo, btn) {
    if (btn) { btn.disabled = true }
    api.cambiarEstado(t.id, estado, motivo).then(function () {
      m.cerrar()
      toast({
        confirmado: 'Turno confirmado.',
        completado: 'Turno marcado como cumplido.',
        cancelado: 'Turno cancelado: el horario quedó libre.',
        no_show: 'Marcado como que no vino: el horario quedó libre.',
      }[estado] || 'Listo.')
      refrescarTodo()
    }).catch(function (e) { if (btn) btn.disabled = false; toast(textoError(e), true) })
  }

  function pedirMotivo(m, t, estado) {
    var caja = $('#pt-extra', m.el)
    caja.innerHTML =
      '<div class="pt-campo" style="margin-top:14px"><label for="pt-motivo">' + (estado === 'cancelado' ? 'Motivo de la cancelación *' : 'Comentario (opcional)') + '</label>' +
      '<textarea id="pt-motivo" placeholder="' + (estado === 'cancelado' ? 'Ej.: el cliente viaja, lo reprograma más adelante' : 'Ej.: no atendió el teléfono') + '"></textarea></div>' +
      '<div class="pt-acciones"><button type="button" class="pt-btn mal" id="pt-confirmar-motivo">' + (estado === 'cancelado' ? 'Cancelar turno' : 'Marcar que no vino') + '</button></div>'
    $('#pt-motivo', m.el).focus()
    $('#pt-confirmar-motivo', m.el).addEventListener('click', function () {
      var mot = $('#pt-motivo', m.el).value.trim()
      if (estado === 'cancelado' && !mot) { $('#pt-motivo', m.el).focus(); toast('Escribí el motivo de la cancelación.', true); return }
      cambiar(m, t, estado, mot || null, this)
    })
  }

  function abrirReprogramar(t) {
    var minutos = t.minutos || 60
    var dia = t.inicio && isoDia(t.inicio) >= hoyISO() ? isoDia(t.inicio) : hoyISO()
    var m = modal(
      '<h2>Reprogramar turno</h2>' +
      '<p class="pt-sub">' + esc(titulo(t.cliente_apellido) + ', ' + titulo(t.cliente_nombre)) + ' · ' + esc(t.servicio || '') +
      '<br>Hoy: ' + esc(diaCorto(t.inicio)) + ' ' + esc(hora(t.inicio)) + '. Al guardar, ese horario queda libre.</p>' +
      '<div class="pt-grilla">' +
      '<div class="pt-campo"><label for="pt-r-dia">Día nuevo</label><input id="pt-r-dia" type="date" min="' + hoyISO() + '" value="' + dia + '"></div>' +
      '<div class="pt-campo"><label for="pt-r-min">¿Cuánto demora?</label><select id="pt-r-min">' + opcionesDuracion(minutos) + '</select></div>' +
      '<div class="pt-campo ancho"><label>Horario</label><div id="pt-r-horas" class="pt-chips"></div></div>' +
      '</div><div class="pt-acciones"><button type="button" class="pt-btn prim" id="pt-r-guardar">Guardar nuevo horario</button></div>'
    )
    var el = m.el, elegida = null
    function cargar() {
      var d = $('#pt-r-dia', el).value, min = +$('#pt-r-min', el).value, caja = $('#pt-r-horas', el)
      caja.innerHTML = '<div class="pt-vacio">Buscando horarios…</div>'
      api.libres(d, min, t.id).then(function (libres) {
        if (!libres.length) {
          caja.innerHTML = '<div class="pt-vacio">No quedan horarios ese día.</div><div id="pt-r-sug" class="pt-chips"></div>'
          sugerirDias(d, min, $('#pt-r-sug', el), function (nuevo) { $('#pt-r-dia', el).value = nuevo; elegida = null; cargar() })
          return
        }
        caja.innerHTML = libres.map(function (l) {
          var h = hora(l.inicio)
          return '<button type="button" class="pt-chip' + (h === elegida ? ' on' : '') + '" data-h="' + h + '">' + h + '<small' + (l.lugares === 1 ? ' class="uno">1 lugar' : '>' + l.lugares + ' lugares') + '</small></button>'
        }).join('')
      }).catch(function (e) { caja.innerHTML = '<div class="pt-aviso mal">' + esc(textoError(e)) + '</div>' })
    }
    $('#pt-r-horas', el).addEventListener('click', function (e) {
      var b = e.target.closest('.pt-chip'); if (!b || !b.dataset.h) return
      elegida = b.dataset.h
      $$('.pt-chip', $('#pt-r-horas', el)).forEach(function (x) { x.classList.toggle('on', x === b) })
    })
    $('#pt-r-dia', el).addEventListener('change', cargar)
    $('#pt-r-min', el).addEventListener('change', cargar)
    cargar()
    $('#pt-r-guardar', el).addEventListener('click', function () {
      if (!elegida) { toast('Elegí un horario.', true); return }
      var btn = this; btn.disabled = true
      var inicio = $('#pt-r-dia', el).value + 'T' + elegida + ':00-03:00'
      api.reprogramar(t.id, inicio, +$('#pt-r-min', el).value).then(function () {
        m.cerrar()
        refrescarTodo()
        var nuevo = Object.assign({}, t, { inicio: inicio, estado: 'pendiente' })
        var m2 = modal('<h2>Turno reprogramado</h2><p class="pt-sub">Nuevo horario: ' + esc(diaCorto(inicio)) + ' a las ' + esc(elegida) + '. El anterior quedó libre.</p>' +
          '<div class="pt-acciones">' + botonWa(nuevo, 'confirmacion', 'Avisarle por WhatsApp') + '<button type="button" class="pt-btn" id="pt-ok2">Listo</button></div>')
        $('#pt-ok2', m2.el).addEventListener('click', m2.cerrar)
      }).catch(function (e) { btn.disabled = false; toast(textoError(e), true); cargar() })
    })
  }

  // ---------------------------------------------------------- registro
  var REG = { filas: [] }
  function cargarRegistro() {
    if (!S.perfil || !S.config) {
      $('#pt-reg-tabla').innerHTML = '<div class="pt-aviso mal">El registro lo ve postventa y gerencia.</div>'
      return
    }
    var mes = $('#pt-mes').value
    if (!mes) { mes = hoyISO().slice(0, 7); $('#pt-mes').value = mes }
    var p = mes.split('-'), sig = new Date(Date.UTC(+p[0], +p[1], 1)).toISOString().slice(0, 7)
    $('#pt-reg-tabla').innerHTML = '<div class="pt-vacio">Cargando…</div>'
    api.turnos(mes + '-01T00:00:00-03:00', sig + '-01T00:00:00-03:00').then(function (filas) {
      REG.filas = filas
      dibujarRegistro()
    }).catch(function (e) { $('#pt-reg-tabla').innerHTML = '<div class="pt-aviso mal">' + esc(textoError(e)) + '</div>' })
  }
  function registroFiltrado() {
    var est = $('#pt-f-estado').value, q = $('#pt-f-buscar').value.trim().toLowerCase()
    return REG.filas.filter(function (t) {
      if (est && t.estado !== est) return false
      if (q && [t.cliente_nombre, t.cliente_apellido, t.patente, t.vin, t.cliente_telefono, t.servicio].join(' ').toLowerCase().indexOf(q) < 0) return false
      return true
    })
  }
  function dibujarRegistro() {
    var filas = registroFiltrado()
    var c = { total: REG.filas.length, completado: 0, cancelado: 0, no_show: 0 }
    REG.filas.forEach(function (t) { if (c[t.estado] != null) c[t.estado]++ })
    $('#pt-reg-kpis').innerHTML = [
      [c.total, 'Turnos del mes'], [c.completado, 'Cumplidos'], [c.cancelado, 'Cancelados'], [c.no_show, 'No vinieron'],
    ].map(function (k) { return '<div class="pt-kpi"><div class="n">' + k[0] + '</div><div class="l">' + k[1] + '</div></div>' }).join('')
    if (!filas.length) { $('#pt-reg-tabla').innerHTML = '<div class="pt-vacio">No hay turnos con esos filtros.</div>'; return }
    $('#pt-reg-tabla').innerHTML = '<div class="pt-tabla-caja"><table class="pt-tabla"><thead><tr>' +
      '<th>N.º</th><th>Día</th><th>Hora</th><th>Dura</th><th>Titular</th><th>Teléfono</th><th>Modelo</th><th>Patente</th><th>Servicio</th><th>Estado</th></tr></thead><tbody>' +
      filas.map(function (t, i) {
        return '<tr data-i="' + i + '"><td>' + esc(t.numero) + '</td><td>' + esc(fecha(t.inicio)) + '</td><td>' + esc(hora(t.inicio)) + '</td><td>' +
          esc(duracionTexto(t.minutos)) + '</td><td><b>' + esc(titulo(t.cliente_apellido) + ', ' + titulo(t.cliente_nombre)) + '</b></td><td>' +
          esc(t.cliente_telefono || '') + '</td><td>' + esc(t.modelo || '') + '</td><td>' + esc(t.patente || '') + '</td><td>' + esc(t.servicio || '') +
          '</td><td><span class="pt-estado ' + t.estado + '">' + esc(ETIQUETA_ESTADO[t.estado] || t.estado) + '</span></td></tr>'
      }).join('') + '</tbody></table></div>'
    $$('#pt-reg-tabla tbody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { abrirDetalle(filas[+tr.dataset.i]) })
    })
  }
  function bajarRegistro() {
    var cab = ['N.º', 'Día', 'Hora', 'Mes', 'Duración (min)', 'Nombre titular', 'Apellido titular', 'Teléfono', 'Modelo', 'Patente', 'Chasis', 'Servicio', 'Estado', 'Pedido por', 'Observaciones', 'Motivo cancelación', 'Cargado por', 'Cargado el']
    function cel(v) { var s = String(v == null ? '' : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
    var filas = registroFiltrado().map(function (t) {
      return [t.numero, fecha(t.inicio), hora(t.inicio), t.mes, t.minutos, titulo(t.cliente_nombre), titulo(t.cliente_apellido), t.cliente_telefono,
        t.modelo, t.patente, t.vin, t.servicio, ETIQUETA_ESTADO[t.estado] || t.estado, t.origen, t.observaciones, t.motivo_cancelacion,
        t.cargado_por, fecha(t.created_at)].map(cel).join(';')
    })
    var csv = '﻿' + [cab.map(cel).join(';')].concat(filas).join('\r\n')
    var a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'turnos_postventa_' + ($('#pt-mes').value || hoyISO().slice(0, 7)) + '.csv'
    document.body.appendChild(a); a.click(); a.remove()
  }

  // ------------------------------------------ unidades: "Agregar turno" y pills
  function unidadPorVin(vin) {
    var pv = window.__postventa
    var lista = pv && typeof pv.unidades === 'function' ? pv.unidades() : []
    for (var i = 0; i < lista.length; i++) if (lista[i].f && lista[i].f.vin === vin) return lista[i]
    return null
  }
  function buscarEnEntregas(q) {
    var pv = window.__postventa
    var lista = pv && typeof pv.unidades === 'function' ? pv.unidades() : []
    var t = q.toLowerCase().replace(/\s+/g, ' '), compacto = q.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    return lista.filter(function (u) {
      var f = u.f || {}
      return (f.apellido + ' ' + f.nombre + ' ' + f.nombre + ' ' + f.apellido).toLowerCase().indexOf(t) >= 0 ||
        (compacto.length >= 4 && String(f.vin || '').toUpperCase().indexOf(compacto) >= 0) ||
        (compacto.length >= 4 && String(f.celular || '').replace(/\D/g, '').indexOf(compacto) >= 0)
    }).slice(0, 8).map(desdeUnidad)
  }
  function desdeUnidad(u) {
    var f = u.f || {}
    return {
      titulo: titulo(f.apellido) + ', ' + titulo(f.nombre),
      detalle: [f.modelo, f.vin, f.celular, 'entrega ' + (f.fecha ? fechaDeISO(f.fecha) : '?')].filter(Boolean).join(' · '),
      cliente: { nombre: titulo(f.nombre), apellido: titulo(f.apellido), telefono: f.celular || '' },
      vehiculo: { modelo: f.modelo || '', vin: f.vin || '', patente: '', fecha_entrega: f.fecha || null },
    }
  }
  function darTurnoDesdeUnidad(vin) {
    var u = unidadPorVin(vin)
    if (!u) { toast('No encontré esa unidad.', true); return }
    var x = desdeUnidad(u)
    var mant = S.servicios.filter(function (s) { return /mantenimiento/i.test(s.nombre) })[0]
    mostrarSeccion('agenda')
    abrirNuevo({ cliente: x.cliente, vehiculo: x.vehiculo, servicio: mant ? mant.id : null })
  }

  function cargarProximos() {
    if (!S.config) return
    api.proximosPorVin().then(function (filas) {
      S.proximos = {}
      filas.forEach(function (t) { if (!S.proximos[t.vin] || t.inicio < S.proximos[t.vin].inicio) S.proximos[t.vin] = t })
      marcarUnidades()
    }).catch(function () { /* las marcas son una ayuda */ })
  }
  // Marca en cada tarjeta si ya tiene turno, y deja el botón Agregar turno.
  function marcarUnidades() {
    $$('#lista .u').forEach(function (card) {
      var boton = $('.btn-turno', card)
      var vin = boton ? boton.dataset.vin : ($('.vin', card) || {}).textContent
      if (!vin) return
      if (!boton && S.puedeEditar) {
        var acc = $('.acc', card)
        if (acc) {
          boton = document.createElement('button')
          boton.type = 'button'; boton.className = 'btn-turno'; boton.dataset.vin = vin; boton.textContent = 'Agregar turno'
          acc.appendChild(boton)
        }
      }
      if (boton && !S.puedeEditar) boton.remove()
      var pill = $('.pt-turno-pill', card)
      var t = S.proximos[vin]
      if (t) {
        if (!pill) { pill = document.createElement('span'); pill.className = 'pt-turno-pill'; var a = $('.acc', card); if (a) a.insertBefore(pill, a.firstChild) }
        pill.textContent = 'Turno ' + diaCorto(t.inicio) + ' ' + hora(t.inicio)
        pill.title = t.servicio || ''
      } else if (pill) pill.remove()
    })
  }

  // ------------------------------------------------------------ arranque
  function iniciar() {
    if (!armarSolapas()) return
    ponerEstilos()
    var est = $('#pt-f-estado')
    est.innerHTML += Object.keys(ETIQUETA_ESTADO).map(function (k) { return '<option value="' + k + '">' + ETIQUETA_ESTADO[k] + '</option>' }).join('')
    $('#pt-mes').addEventListener('change', cargarRegistro)
    $('#pt-f-estado').addEventListener('change', dibujarRegistro)
    $('#pt-f-buscar').addEventListener('input', dibujarRegistro)
    $('#pt-bajar').addEventListener('click', bajarRegistro)
    $('#pt-nuevo').addEventListener('click', function () { abrirNuevo({}) })
    $('#pt-cancelados').addEventListener('change', function () { S.verCancelados = this.checked; if (S.cal) S.cal.refetchEvents() })
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.btn-turno'); if (!b) return
      e.preventDefault(); darTurnoDesdeUnidad(b.dataset.vin)
    })
    var lista = $('#lista')
    if (lista) new MutationObserver(function () { marcarUnidades() }).observe(lista, { childList: true })

    try { api = crearApi() } catch (e) { api = null }
    if (!api) return
    api.sesion().then(function (perfil) {
      S.perfil = perfil
      S.puedeEditar = !!(perfil && perfil.activo && (perfil.rol === 'admin' || perfil.rol === 'asesor_servicio'))
      if (!perfil) return null
      return Promise.all([api.config(), api.servicios()]).then(function (r) {
        S.config = r[0]
        S.servicios = r[1] || []
      })
    }).catch(function () { S.config = null }).then(function () {
      marcarUnidades()
      cargarProximos()
      var guardada = null
      try { guardada = sessionStorage.getItem('pt-seccion') } catch (e) { /* sin almacenamiento */ }
      if (guardada && guardada !== 'unidades') mostrarSeccion(guardada)
    })
  }

  window.__turnos = { telefonoWa: telefonoWa, armarMensaje: armarMensaje, duracionTexto: duracionTexto, abrirNuevo: abrirNuevo }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar)
  else iniciar()
})()
