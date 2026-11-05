/* app.js: lógica del formulario. Los datos no salen del navegador. */
(function () {
  'use strict';
  const A = window.Anexos;
  const form = document.getElementById('formulario');
  const COLS = {
    conceptos: [['concepto', 'text'], ['importe', 'importe']],
    facturas: [['proveedor', 'text'], ['numero', 'text'], ['fecha', 'text', 'dd/mm/aa'],
      ['concepto', 'text'], ['importe', 'importe'], ['subvencion', 'importe']],
  };
  const MAX = { conceptos: 5, facturas: 200 };

  // ---------- tablas ----------
  function anadirFila(tabla, valores = {}) {
    const tbody = document.querySelector(`#tabla-${tabla} tbody`);
    const tr = document.createElement('tr');
    for (const [c, tipo, ph] of COLS[tabla]) {
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.dataset.c = c;
      inp.value = valores[c] || '';
      inp.setAttribute('aria-label', c);
      if (ph) inp.placeholder = ph;
      if (tipo === 'importe') { td.className = 'num'; inp.inputMode = 'decimal'; inp.placeholder = '0,00'; }
      td.appendChild(inp); tr.appendChild(td);
    }
    const td = document.createElement('td');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'quitar'; b.textContent = '×'; b.title = 'Quitar fila';
    b.setAttribute('aria-label', 'Quitar fila');
    b.addEventListener('click', () => { tr.remove(); actualizar(); });
    td.appendChild(b); tr.appendChild(td);
    tbody.appendChild(tr);
  }
  function filas(tabla) {
    return [...document.querySelectorAll(`#tabla-${tabla} tbody tr`)].map(tr => {
      const o = {};
      tr.querySelectorAll('input').forEach(i => { o[i.dataset.c] = i.value.trim(); });
      return o;
    });
  }
  function vaciarTabla(tabla) { document.querySelector(`#tabla-${tabla} tbody`).innerHTML = ''; }

  // ---------- datos ----------
  function leer() {
    const d = { persona: {}, consejo: {}, banco: {}, solicitud: {}, justificacion: {} };
    form.querySelectorAll('[name]').forEach(el => {
      const [g, k] = el.name.split('.');
      d[g][k] = el.value.trim();
    });
    d.solicitud.conceptos = filas('conceptos');
    d.justificacion.facturas = filas('facturas');
    return d;
  }
  function escribir(d) {
    form.querySelectorAll('[name]').forEach(el => {
      const [g, k] = el.name.split('.');
      el.value = (d[g] && d[g][k]) || '';
    });
    vaciarTabla('conceptos'); vaciarTabla('facturas');
    ((d.solicitud && d.solicitud.conceptos) || []).forEach(f => anadirFila('conceptos', f));
    ((d.justificacion && d.justificacion.facturas) || []).forEach(f => anadirFila('facturas', f));
    if (!filas('conceptos').length) anadirFila('conceptos');
    if (!filas('facturas').length) anadirFila('facturas');
    actualizar();
  }

  // ---------- sumas y comprobaciones en vivo ----------
  function totalDe(lista, campo) {
    return lista.reduce((a, f) => a + (A.importe(f[campo]) || 0), 0);
  }
  function actualizar() {
    const c = filas('conceptos'), f = filas('facturas');
    document.getElementById('total-conceptos').textContent = A.euros(totalDe(c, 'importe'));
    document.getElementById('total-facturas').textContent = A.euros(totalDe(f, 'importe'));
    document.getElementById('total-subvencion').textContent = A.euros(totalDe(f, 'subvencion'));
    document.querySelectorAll('button.anadir').forEach(b => {
      b.disabled = filas(b.dataset.tabla).length >= MAX[b.dataset.tabla];
    });
    // Importes ilegibles y subvencionado mayor que la factura
    document.querySelectorAll('.tabla tbody input').forEach(i => {
      const mal = (i.dataset.c === 'importe' || i.dataset.c === 'subvencion') && i.value.trim() && A.importe(i.value) === null;
      i.setAttribute('aria-invalid', mal ? 'true' : 'false');
      i.style.borderColor = mal ? 'var(--rojo)' : '';
    });
    const iban = form.elements['banco.iban'].value, est = document.getElementById('estado-iban');
    if (!A.limpiarIban(iban)) { est.textContent = ''; est.className = 'estado'; }
    else if (A.ibanValido(iban)) { est.textContent = '✓ IBAN correcto'; est.className = 'estado ok'; }
    else { est.textContent = 'El IBAN no es válido (ES + 22 dígitos, con el dígito de control bien)'; est.className = 'estado mal'; }
  }
  form.addEventListener('input', actualizar);

  // ---------- avisos ----------
  const cajaAvisos = document.getElementById('avisos');
  function avisar(titulo, lista) {
    cajaAvisos.hidden = false;
    cajaAvisos.innerHTML = '';
    const p = document.createElement('strong'); p.textContent = titulo; cajaAvisos.appendChild(p);
    if (lista && lista.length) {
      const ul = document.createElement('ul');
      lista.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
      cajaAvisos.appendChild(ul);
    }
  }

  // ---------- descarga de los anexos ----------
  const cachePlantillas = {};
  async function plantilla(n) {
    if (!cachePlantillas[n]) {
      const r = await fetch('pdf/' + A.PLANTILLAS[n]);
      if (!r.ok) throw new Error('No se pudo cargar pdf/' + A.PLANTILLAS[n]);
      cachePlantillas[n] = await r.arrayBuffer();
    }
    return cachePlantillas[n];
  }
  function descargar(bytes, nombre, tipo) {
    const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
    const a = document.createElement('a');
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function comprobaciones(n, d) {
    const av = [];
    const falta = (v, t) => { if (!v) av.push(`Falta: ${t}.`); };
    falta(d.persona.nombre, 'nombre'); falta(d.persona.dni, 'DNI');
    if (n === 1 || n === 2) falta(d.solicitud.titulo, 'título del proyecto');
    if (n === 4) {
      falta(d.banco.iban, 'IBAN'); falta(d.justificacion.concepto, '«En concepto de»');
      if (!d.justificacion.facturas.some(f => f.subvencion)) av.push('No hay ningún importe subvencionado en la tabla de facturas.');
      d.justificacion.facturas.forEach((f, i) => {
        const imp = A.importe(f.importe), sub = A.importe(f.subvencion);
        if (imp !== null && sub !== null && sub > imp) av.push(`Factura ${i + 1}: lo subvencionado supera el importe de la factura.`);
      });
    }
    return av;
  }
  document.querySelectorAll('[data-anexo]').forEach(b => b.addEventListener('click', async () => {
    const n = Number(b.dataset.anexo);
    const d = leer();
    b.disabled = true;
    try {
      const { bytes, avisos } = await A.rellenar(n, await plantilla(n), d);
      const nombre = `Anexo${n}_${(d.solicitud.titulo || d.justificacion.concepto || 'ayuda').slice(0, 40).normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '')}.pdf`;
      descargar(bytes, nombre, 'application/pdf');
      const todos = comprobaciones(n, d).concat(avisos);
      avisar(todos.length ? `Anexo ${n} descargado, pero revisad esto:` : `Anexo ${n} descargado. Ya se puede firmar con AutoFirma.`, todos);
    } catch (e) {
      console.error(e);
      avisar(`No se pudo generar el Anexo ${n}: ${e.message}`);
    } finally { b.disabled = false; }
  }));

  // ---------- botones de la barra ----------
  document.querySelectorAll('button.anadir').forEach(b => b.addEventListener('click', () => {
    anadirFila(b.dataset.tabla); actualizar();
    const ultima = document.querySelector(`#tabla-${b.dataset.tabla} tbody tr:last-child input`);
    if (ultima) ultima.focus();
  }));
  document.getElementById('cargar-ejemplo').addEventListener('click', async () => {
    try {
      const r = await fetch('ejemplo/ejemplo.json');
      escribir(await r.json());
      avisar('Cargado el ejemplo ficticio de Lucía Ejemplo. Sustituid todos los datos por los vuestros.');
    } catch (e) { avisar('No se pudo cargar el ejemplo.'); }
  });
  document.getElementById('guardar-json').addEventListener('click', () => {
    descargar(JSON.stringify(leer(), null, 2), 'datos_ayuda.json', 'application/json');
    avisar('Datos guardados en datos_ayuda.json. Contiene DNI e IBAN: guardadlo en un sitio privado.');
  });
  document.getElementById('abrir-json').addEventListener('change', async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try { escribir(JSON.parse(await f.text())); avisar(`Datos cargados de ${f.name}.`); }
    catch (e) { avisar('Ese archivo no es un archivo de datos válido.'); }
    ev.target.value = '';
  });
  const bVaciar = document.getElementById('vaciar');
  let armado = null;
  bVaciar.addEventListener('click', () => {
    if (!armado) {
      bVaciar.textContent = '¿Seguro? Pulsa otra vez';
      armado = setTimeout(() => { armado = null; bVaciar.textContent = 'Vaciar'; }, 4000);
      return;
    }
    clearTimeout(armado); armado = null; bVaciar.textContent = 'Vaciar';
    escribir({ consejo: { nombre: 'Consejo de Estudiantes de la Facultad de Ciencias', centro: 'Facultad de Ciencias' } });
    cajaAvisos.hidden = true;
  });

  // Estado inicial
  if (!filas('conceptos').length) anadirFila('conceptos');
  if (!filas('facturas').length) anadirFila('facturas');
  actualizar();
})();
