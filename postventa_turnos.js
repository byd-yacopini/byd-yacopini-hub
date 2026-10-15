// Agenda de turnos de postventa, adentro de postventa.html (la página de
// Nicolás). Vive en un archivo aparte para tocar lo mínimo su página: él sólo
// tiene que cargar este script y poner el botón "Dar turno" en cada unidad.
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
  var CSS = '' +
    '.pt-tabs{display:flex;gap:6px;margin:0 0 14px;flex-wrap:wrap}' +
    '.pt-tab{padding:9px 16px;border-radius:999px;border:1px solid var(--gris-claro,#d4d4d4);background:var(--blanco,#fff);font:inherit;font-size:13.5px;font-weight:700;color:var(--carbon,#2a2a2a);cursor:pointer}' +
    '.pt-tab.on{background:var(--negro,#0a0a0a);border-color:var(--negro,#0a0a0a);color:#fff}' +
    '.pt-oculto{display:none!important}' +
    '.pt-barra{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 10px}' +
    '.pt-barra .pt-esp{flex:1}' +
    '.pt-btn{padding:9px 14px;border-radius:999px;border:1px solid var(--gris-claro,#d4d4d4);background:var(--blanco,#fff);color:var(--carbon,#2a2a2a);font:inherit;font-weight:700;font-size:13px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}' +
    '.pt-btn:disabled{opacity:.5;cursor:default}' +
    '.pt-btn.prim{background:var(--azul-ev,#1565d8);border-color:var(--azul-ev,#1565d8);color:#fff}' +
    '.pt-btn.ok{background:var(--verde,#1b7f4c);border-color:var(--verde,#1b7f4c);color:#fff}' +
    '.pt-btn.mal{color:var(--rojo,#c0392b);border-color:#f0c4be}' +
    '.pt-btn.wa{background:#1fa855;border-color:#1fa855;color:#fff}' +
    '.pt-chk{font-size:12.5px;color:var(--gris-oscuro,#4a4a4a);display:inline-flex;gap:6px;align-items:center}' +
    '.pt-cal{background:var(--blanco,#fff);border:1px solid var(--gris-claro,#d4d4d4);border-radius:12px;padding:10px}' +
    '.pt-cal .fc{font-size:13px}' +
    '.pt-cal .fc .fc-toolbar-title{font-size:17px;font-weight:800}' +
    '.pt-cal .fc .fc-toolbar-title::first-letter{text-transform:uppercase}' +
    '@media(max-width:720px){.pt-cal .fc .fc-footer-toolbar{padding-left:52px}.pt-cal .fc .fc-toolbar-title{font-size:15px}}' +
    '.pt-cal .fc .fc-button{border-radius:999px;font-weight:700;font-size:12.5px;padding:6px 12px;text-transform:capitalize}' +
    '.pt-cal .fc .fc-button-primary{background:#fff;border-color:var(--gris-claro,#d4d4d4);color:var(--carbon,#2a2a2a)}' +
    '.pt-cal .fc .fc-button-primary:not(:disabled).fc-button-active,.pt-cal .fc .fc-button-primary:not(:disabled):active{background:var(--negro,#0a0a0a);border-color:var(--negro,#0a0a0a);color:#fff}' +
    '.pt-cal .fc-event{border-radius:8px;border-width:0;padding:1px 3px;cursor:pointer}' +
    '.pt-cal .fc-event .fc-event-title{font-weight:700}' +
    '.pt-cal .ev-completado{opacity:.55}' +
    '.pt-cal .ev-completado .fc-event-title:before{content:"✓ "}' +
    '.pt-cal .ev-no_show{background:repeating-linear-gradient(135deg,#c0392b,#c0392b 6px,#a93226 6px,#a93226 12px)!important}' +
    '.pt-cal .ev-cancelado{opacity:.45;text-decoration:line-through}' +
    '.pt-cal .ev-pendiente{box-shadow:inset 0 0 0 2px rgba(255,255,255,.75)}' +
    '.pt-disp{display:block;margin:2px 4px 0 auto;width:max-content;font-size:10.5px;font-weight:800;padding:1px 7px;border-radius:999px;background:#e3f5ea;color:#145c37}' +
    '.pt-disp.poco{background:#fff7e6;color:#7a5a00}.pt-disp.lleno{background:#fbeaea;color:#8a2020}.pt-disp.fer{background:#eef0f2;color:#5c6167}' +
    '.fc-col-header-cell .pt-disp{margin:3px auto 2px}' +
    '.pt-leyenda{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--gris-oscuro,#4a4a4a);margin:10px 2px 0}' +
    '.pt-leyenda i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}' +
    '.pt-fondo{position:fixed;inset:0;background:rgba(10,10,10,.45);z-index:100000;display:flex;align-items:flex-end;justify-content:center}' +
    '@media(min-width:720px){.pt-fondo{align-items:center}}' +
    '.pt-modal{background:var(--blanco,#fff);width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:16px 16px 0 0;padding:18px 18px 22px;box-shadow:0 10px 40px rgba(0,0,0,.25)}' +
    '@media(min-width:720px){.pt-modal{border-radius:16px}}' +
    '.pt-modal h2{font-size:18px;margin:0 0 4px;color:var(--negro,#0a0a0a)}' +
    '.pt-modal .pt-sub{font-size:12.5px;color:var(--gris-oscuro,#4a4a4a);margin:0 0 14px}' +
    '.pt-cerrar{float:right;border:0;background:var(--gris-fondo,#f2f2f2);width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer}' +
    '.pt-grilla{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}' +
    '.pt-grilla .ancho{grid-column:1/-1}' +
    '@media(max-width:520px){.pt-grilla{grid-template-columns:1fr}}' +
    '.pt-campo label{display:block;font-size:11.5px;font-weight:700;color:var(--gris-oscuro,#4a4a4a);margin:0 0 4px;letter-spacing:.2px}' +
    '.pt-campo input,.pt-campo select,.pt-campo textarea{width:100%;font:inherit;font-size:15px;padding:10px 11px;border:1px solid var(--gris-claro,#d4d4d4);border-radius:10px;background:#fff;color:var(--carbon,#2a2a2a);box-sizing:border-box}' +
    '.pt-campo textarea{min-height:64px;resize:vertical}' +
    '.pt-campo .pt-ayuda{font-size:11.5px;color:var(--gris-medio,#8c8c8c);margin-top:3px}' +
    '.pt-campo.error input,.pt-campo.error select{border-color:var(--rojo,#c0392b)}' +
    '.pt-campo .pt-err{font-size:11.5px;color:var(--rojo,#c0392b);margin-top:3px}' +
    '.pt-seccion{font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--gris-medio,#8c8c8c);margin:16px 0 8px}' +
    '.pt-chips{display:flex;flex-wrap:wrap;gap:6px}' +
    '.pt-chip{padding:8px 12px;border-radius:999px;border:1px solid var(--gris-claro,#d4d4d4);background:#fff;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;color:var(--carbon,#2a2a2a)}' +
    '.pt-chip small{font-weight:600;color:var(--gris-medio,#8c8c8c);margin-left:4px}' +
    '.pt-chip.on{background:var(--azul-ev,#1565d8);border-color:var(--azul-ev,#1565d8);color:#fff}.pt-chip.on small{color:#dbe7ff}' +
    '.pt-vacio{font-size:13px;color:var(--gris-medio,#8c8c8c);padding:6px 0}' +
    '.pt-resultados{border:1px solid var(--gris-claro,#d4d4d4);border-radius:10px;margin-top:6px;max-height:220px;overflow:auto}' +
    '.pt-res{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--gris-fondo,#f2f2f2);background:#fff;padding:9px 11px;font:inherit;font-size:13px;cursor:pointer}' +
    '.pt-res:hover{background:#eef4ff}.pt-res b{color:var(--negro,#0a0a0a)}.pt-res span{display:block;font-size:11.5px;color:var(--gris-oscuro,#4a4a4a)}' +
    '.pt-acciones{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}' +
    '.pt-datos{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13.5px;margin:6px 0 4px}' +
    '.pt-datos dt{color:var(--gris-medio,#8c8c8c);font-weight:700;font-size:12px;padding-top:1px}.pt-datos dd{margin:0;overflow-wrap:anywhere}' +
    '.pt-estado{display:inline-block;font-size:11.5px;font-weight:800;padding:3px 10px;border-radius:999px;background:#eef4ff;color:#1f3f7a}' +
    '.pt-estado.completado{background:#e3f5ea;color:#145c37}.pt-estado.cancelado,.pt-estado.no_show{background:#fbeaea;color:#8a2020}.pt-estado.confirmado{background:#e3f5ea;color:#145c37}' +
    '.pt-aviso{background:#eef4ff;border:1px solid #c9dafb;color:#1f3f7a;font-size:12.5px;border-radius:10px;padding:10px 12px;margin:10px 0;line-height:1.5}' +
    '.pt-aviso.mal{background:#fbeaea;border-color:#f0c4be;color:#8a2020}' +
    '.pt-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0a0a0a;color:#fff;padding:11px 16px;border-radius:12px;font-size:13.5px;font-weight:600;z-index:100001;max-width:92vw;box-shadow:0 6px 24px rgba(0,0,0,.3)}' +
    '.pt-toast.mal{background:#8a2020}' +
    '.pt-tabla-caja{background:#fff;border:1px solid var(--gris-claro,#d4d4d4);border-radius:12px;overflow:auto}' +
    '.pt-tabla{width:100%;border-collapse:collapse;font-size:12.5px;min-width:820px}' +
    '.pt-tabla th{text-align:left;font-size:10.5px;letter-spacing:.6px;text-transform:uppercase;color:var(--gris-medio,#8c8c8c);padding:9px 10px;border-bottom:1px solid var(--gris-claro,#d4d4d4);white-space:nowrap}' +
    '.pt-tabla td{padding:8px 10px;border-bottom:1px solid var(--gris-fondo,#f2f2f2);vertical-align:top}' +
    '.pt-tabla tr{cursor:pointer}.pt-tabla tbody tr:hover{background:#f7faff}' +
    '.pt-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}' +
    '@media(max-width:720px){.pt-kpis{grid-template-columns:repeat(2,1fr)}}' +
    '.pt-kpi{background:#fff;border:1px solid var(--gris-claro,#d4d4d4);border-radius:12px;padding:10px 12px}' +
    '.pt-kpi .n{font-size:24px;font-weight:800;color:var(--negro,#0a0a0a);line-height:1.1}.pt-kpi .l{font-size:11.5px;font-weight:600;color:var(--gris-oscuro,#4a4a4a);margin-top:2px}' +
    '.pt-turno-pill{display:inline-block;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:#e3f5ea;color:#145c37;white-space:nowrap}' +
    '.btn-turno{padding:8px 12px;border-radius:10px;border:0;background:var(--azul-ev,#1565d8);color:#fff;font-weight:700;font-size:12.5px;font-family:inherit;cursor:pointer}'

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
      '<h1>Agenda de turnos</h1>' +
      '<p class="sub">Tocá un horario vacío para dar un turno, o un turno para confirmarlo, marcarlo cumplido, cancelarlo o reprogramarlo. Podés arrastrarlo a otro horario.</p>' +
      '<div id="pt-aviso-agenda"></div>' +
      '<div class="pt-barra"><button type="button" class="pt-btn prim" id="pt-nuevo">+ Nuevo turno</button>' +
      '<span class="pt-esp"></span><label class="pt-chk"><input type="checkbox" id="pt-cancelados"> Ver cancelados</label></div>' +
      '<div class="pt-cal"><div id="pt-calendario"></div></div>' +
      '<div class="pt-leyenda" id="pt-leyenda"></div>'

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

  function abrirAgenda() {
    if (S.cal) { S.cal.updateSize(); return }
    if (!S.perfil) {
      $('#pt-aviso-agenda').innerHTML = '<div class="pt-aviso mal">Para ver la agenda tenés que entrar al hub con tu mail y tu código.</div>'
      return
    }
    if (!S.config) {
      $('#pt-aviso-agenda').innerHTML = '<div class="pt-aviso mal">La agenda todavía no está habilitada para tu cuenta. Pedile a Calidad que te active como <b>Asesor de servicio</b>.</div>'
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
      headerToolbar: celu
        ? { left: 'prev,next', center: 'title', right: 'today' }
        : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' },
      footerToolbar: celu ? { center: 'timeGridDay,timeGridWeek,dayGridMonth,listWeek' } : false,
      buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', list: 'Lista' },
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
      dayMaxEvents: 3,
      slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      selectable: S.puedeEditar,
      selectMirror: true,
      editable: S.puedeEditar,
      eventDurationEditable: S.puedeEditar,
      events: traerEventos,
      datesSet: function () { pintarDisponibilidad() },
      dateClick: function (info) {
        if (!S.puedeEditar) return
        if (info.view.type === 'dayGridMonth') {
          S.cal.changeView('timeGridDay', info.dateStr)
          return
        }
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
    pintarLeyenda()
  }

  function traerEventos(info, ok, mal) {
    api.turnos(info.start.toISOString(), info.end.toISOString()).then(function (filas) {
      ok(filas.filter(function (t) {
        return S.verCancelados || ['cancelado', 'no_show', 'a_reprogramar'].indexOf(t.estado) < 0
      }).map(function (t) {
        var color = t.color || '#45b6f7'
        if (t.estado === 'no_show') color = '#c0392b'
        var auto = [t.modelo, t.patente].filter(Boolean).join(' · ')
        return {
          id: t.id,
          title: titulo(t.cliente_apellido) + ', ' + titulo(t.cliente_nombre) + ' — ' + (t.servicio || 'Turno') + (auto ? ' (' + auto + ')' : ''),
          start: t.inicio,
          end: t.fin,
          backgroundColor: color,
          borderColor: color,
          textColor: '#0a0a0a',
          editable: S.puedeEditar && ['pendiente', 'confirmado'].indexOf(t.estado) >= 0,
          extendedProps: { t: t },
        }
      }))
    }).catch(function (e) { mal(e); toast(textoError(e), true) })
  }

  function pintarLeyenda() {
    $('#pt-leyenda').innerHTML = S.servicios.map(function (s) {
      return '<span><i style="background:' + esc(s.color || '#45b6f7') + '"></i>' + esc(s.nombre) + '</span>'
    }).join('') + '<span>✓ = cumplido · borde blanco = sin confirmar</span>'
  }

  // Cuántos horarios de 1 hora quedan en cada día visible.
  function pintarDisponibilidad() {
    if (!S.cal) return
    var v = S.cal.view
    var desde = isoDia(v.activeStart), hasta = isoDia(new Date(v.activeEnd.getTime() - 1))
    api.dias(desde, hasta, 60).then(function (dias) {
      dias.forEach(function (d) { S.disponibles[d.fecha] = d })
      $$('.pt-disp').forEach(function (b) { b.remove() })
      $$('.fc-daygrid-day[data-date], .fc-col-header-cell[data-date]').forEach(function (celda) {
        var d = S.disponibles[celda.getAttribute('data-date')]
        var f = celda.getAttribute('data-date')
        // Hoy sin horarios casi siempre es que ya pasó la hora: no es "completo".
        if (!d || f < hoyISO() || (f === hoyISO() && !d.feriado && d.libres === 0)) return
        var b = document.createElement('span')
        if (d.feriado) { b.className = 'pt-disp fer'; b.textContent = 'Feriado' }
        else if (d.libres === 0) { b.className = 'pt-disp lleno'; b.textContent = 'Completo' }
        else { b.className = 'pt-disp' + (d.libres <= 3 ? ' poco' : ''); b.textContent = d.libres + (d.libres === 1 ? ' horario' : ' horarios') }
        b.title = d.feriado ? d.feriado : 'Horarios libres para un turno de 1 hora'
        var dest = $('.fc-daygrid-day-top', celda) || $('.fc-col-header-cell-cushion', celda) || celda
        dest.parentNode.insertBefore(b, dest.nextSibling)
      })
    }).catch(function () { /* la disponibilidad es una ayuda: si falla, el calendario sigue */ })
  }

  function refrescarTodo() {
    if (S.cal) { S.cal.refetchEvents(); pintarDisponibilidad() }
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
            '<small>' + (l.lugares === 1 ? '1 lugar' : l.lugares + ' lugares') + '</small></button>'
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
          return '<button type="button" class="pt-chip' + (h === elegida ? ' on' : '') + '" data-h="' + h + '">' + h + '<small>' + (l.lugares === 1 ? '1 lugar' : l.lugares + ' lugares') + '</small></button>'
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

  // ------------------------------------------ unidades: "Dar turno" y pills
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
  // Marca en cada tarjeta si ya tiene turno, y deja el botón Dar turno.
  function marcarUnidades() {
    $$('#lista .u').forEach(function (card) {
      var boton = $('.btn-turno', card)
      var vin = boton ? boton.dataset.vin : ($('.vin', card) || {}).textContent
      if (!vin) return
      if (!boton && S.puedeEditar) {
        var acc = $('.acc', card)
        if (acc) {
          boton = document.createElement('button')
          boton.type = 'button'; boton.className = 'btn-turno'; boton.dataset.vin = vin; boton.textContent = 'Dar turno'
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
