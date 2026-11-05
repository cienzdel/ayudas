/*
 * rellenar.js: rellena las réplicas LaTeX de los Anexos 1, 2 y 4 (pdf/anexoN.pdf)
 * a partir de los datos del formulario y devuelve un PDF aplanado: sin campos,
 * sin JavaScript y sin acciones de documento, listo para firmar con AutoFirma.
 *
 * Funciona en el navegador (con window.PDFLib) y en Node (require('pdf-lib')).
 * No envía nada a ningún sitio: todo ocurre en memoria.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('pdf-lib'));
  else raiz.Anexos = fabrica(raiz.PDFLib);
})(typeof self !== 'undefined' ? self : this, function (PDFLib) {
  'use strict';
  const { PDFDocument, StandardFonts, PDFName, TextAlignment,
    pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = PDFLib;

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // ---------- utilidades ----------
  function importe(v) {
    // Acepta «1.234,56», «1234,56», «1234.56» y números. Devuelve céntimos (entero) o null.
    if (typeof v === 'number') return Math.round(v * 100);
    let s = String(v || '').replace(/[€\s]/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  function euros(cent) {
    if (cent === null || cent === undefined) return '';
    const neg = cent < 0; cent = Math.abs(cent);
    const ent = String(Math.floor(cent / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + ent + ',' + String(cent % 100).padStart(2, '0');
  }
  function suma(lista) { return lista.reduce((a, c) => a + (c || 0), 0); }

  function limpiarIban(s) { return String(s || '').replace(/[\s-]/g, '').toUpperCase(); }
  function ibanValido(s) {
    const iban = limpiarIban(s);
    if (!/^ES\d{22}$/.test(iban)) return false;
    const reord = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
    let resto = 0;
    for (const d of reord) resto = (resto * 10 + Number(d)) % 97;
    return resto === 1;
  }
  function ibanBonito(s) { return limpiarIban(s).replace(/(.{4})/g, '$1 ').trim(); }

  // «2026-11-09» → {dia: '9', mes: 'noviembre', anio: '2026', corta: '09/11/2026'}
  function fecha(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return { dia: '', mes: '', anio: '', corta: iso || '', larga: iso || '' };
    const [_, a, me, d] = m;
    return { dia: String(+d), mes: MESES[+me - 1], anio: a, corta: `${d}/${me}/${a}`,
      larga: `${+d} de ${MESES[+me - 1]} de ${a}` };
  }

  // ---------- de los datos del formulario a los campos de cada anexo ----------
  // Devuelve { campos: {nombre: texto}, grupos: [{campos: [...], texto}], avisos: [] }
  // Con opc.sinFilas (Anexo 4 de filas variables) no se rellenan las 12 filas fijas:
  // las dibuja rellenarAnexo4, y los totales cuentan todas las facturas.
  function camposAnexo(n, d, opc = {}) {
    const p = d.persona || {}, c = d.consejo || {}, b = d.banco || {}, s = d.solicitud || {}, j = d.justificacion || {};
    const campos = {}, grupos = [], avisos = [];
    const grupo = (pref, k, texto, desde = 1) => {
      grupos.push({ campos: Array.from({ length: k }, (_, i) => pref + (i + desde)), texto: texto || '' });
    };
    if (n === 1) {
      const conceptos = (s.conceptos || []).map(x => importe(x.importe));
      Object.assign(campos, {
        nombre: p.nombre, dni: p.dni, cargo: p.cargo, asociacion: c.nombre, centro: c.centro,
        direccion: [p.domicilio, p.cp].filter(Boolean).join(', '), ciudad: p.ciudad,
        telefonos: p.telefono, fax: '', cuenta: ibanBonito(b.iban),
        motivos: s.motivos, asistentes: s.asistentes, lugar: s.lugar, fecha: s.fechas,
        fechasolicitud: fecha(s.fechaSolicitud).larga,
        cantidad: euros(conceptos.some(x => x !== null) ? suma(conceptos) : null),
      });
      grupo('otras', 3, s.otrasAyudas);
    } else if (n === 2) {
      Object.assign(campos, { descripcion: s.descripcion, consejo: c.nombre, titulo: s.titulo,
        componentes: s.componentes });
      grupo('actividades', 4, s.actividades);
      grupo('competencias', 2, s.competencias);
      grupo('cronograma', 3, s.cronograma);
      grupo('alcance', 3, s.alcance);
      grupo('lugar', 3, s.necesidades);
      grupo('otras', 4, s.otrasFuentes);
      const filas = (s.conceptos || []).filter(x => x.concepto || x.importe);
      if (filas.length > 5) avisos.push('El Anexo 2 solo tiene 5 líneas de importe: agrupa conceptos.');
      filas.slice(0, 5).forEach((x, i) => {
        campos['concepto' + (i + 1)] = x.concepto;
        campos['importe' + (i + 1)] = euros(importe(x.importe));
      });
      const tot = filas.map(x => importe(x.importe));
      campos.total = euros(tot.length ? suma(tot) : null);
    } else if (n === 4) {
      const f = fecha(j.fechaFirma);
      Object.assign(campos, {
        nombre: p.nombre, dni: p.dni, nifentidad: c.nif, domicilio: p.domicilio, ciudad: p.ciudad,
        cp: p.cp, telefono: p.telefono, email: p.email, concepto: j.concepto,
        organizador: j.organizador, titular: b.titular, niftitular: b.nif,
        dia: f.dia, mes: f.mes, anio: f.anio, firmante: p.nombre,
      });
      grupos.push({ campos: ['representacion1', 'representacion2'], texto: c.nombre });
      const filas = (j.facturas || []).filter(x => Object.values(x).some(Boolean));
      const enTabla = opc.sinFilas ? filas : filas.slice(0, 12);
      if (!opc.sinFilas) {
        if (filas.length > 12) avisos.push('El Anexo 4 solo tiene 12 filas: haced un segundo impreso con el resto.');
        enTabla.forEach((x, i) => {
          const k = i + 1;
          Object.assign(campos, { ['orden' + k]: String(k), ['proveedor' + k]: x.proveedor,
            ['numero' + k]: x.numero, ['fecha' + k]: x.fecha, ['conceptofra' + k]: x.concepto,
            ['importe' + k]: euros(importe(x.importe)), ['subvencion' + k]: euros(importe(x.subvencion)) });
        });
      }
      const tot = suma(enTabla.map(x => importe(x.subvencion)));
      campos.total = filas.length ? euros(tot) : '';
      campos.cantidad = campos.total ? campos.total + ' €' : '';
      const iban = limpiarIban(b.iban);
      if (iban) {
        if (!/^ES\d{22}$/.test(iban)) avisos.push('El IBAN debe ser español: ES y 22 dígitos.');
        else if (!ibanValido(iban)) avisos.push('El IBAN no supera el dígito de control: revisadlo.');
        const dig = iban.slice(2);
        campos.ibandc1 = dig[0]; campos.ibandc2 = dig[1];
        for (let k = 0; k < 20; k++) campos['iban' + (k + 1)] = dig[2 + k] || '';
      }
    }
    return { campos, grupos, avisos };
  }

  // ---------- relleno del PDF ----------
  function anchoCampo(campo) {
    const r = campo.acroField.getWidgets()[0].getRectangle();
    return { w: r.width - 4, h: r.height };
  }
  // Sustituye los caracteres que la fuente estándar (WinAnsi) no puede escribir.
  function codificable(fuente, texto) {
    let out = '';
    for (const ch of String(texto).replace(/\r\n?/g, '\n')) {
      if (ch === '\n') { out += ch; continue; }
      try { fuente.encodeText(ch); out += ch; }
      catch (e) { out += ({ '→': '->', '≤': '<=', '≥': '>=', '−': '-' })[ch] || '?'; }
    }
    return out;
  }
  // Reparte un texto largo por varias líneas (campos) según su anchura.
  function repartir(fuente, tam, texto, anchos) {
    const palabras = String(texto || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const lineas = anchos.map(() => '');
    let i = 0;
    for (const pal of palabras) {
      while (i < anchos.length) {
        const prueba = lineas[i] ? lineas[i] + ' ' + pal : pal;
        // Una palabra más larga que la línea entera va sola (y el campo la encoge).
        if (fuente.widthOfTextAtSize(prueba, tam) <= anchos[i] || !lineas[i]) {
          lineas[i] = prueba; break;
        }
        i++;
      }
      if (i >= anchos.length) return null; // no cabe
    }
    return lineas;
  }

  // El Anexo 4 se genera con tantas filas como facturas; el 1 y el 2, tal cual.
  async function rellenar(n, bytesPlantilla, datos) {
    return n === 4 ? rellenarAnexo4(bytesPlantilla, datos) : rellenarFijo(n, bytesPlantilla, datos);
  }

  async function rellenarFijo(n, bytesPlantilla, datos, opc = {}) {
    const { campos, grupos, avisos } = camposAnexo(n, datos, opc);
    const doc = await PDFDocument.load(bytesPlantilla);
    const form = doc.getForm();
    const times = await doc.embedFont(StandardFonts.TimesRoman);
    const tamBase = { 1: 10, 2: 10, 4: 10 }[n];
    const tamCelda = 8;

    const poner = (nombre, texto, tam) => {
      let f;
      try { f = form.getTextField(nombre); } catch (e) { return; }
      texto = codificable(times, texto || '');
      tam = tam || (/^(orden|proveedor|numero|fecha|conceptofra|importe|subvencion)\d+$/.test(nombre) && n === 4 ? tamCelda : tamBase);
      if (/^iban|^ibandc/.test(nombre) && n === 4) tam = 10;
      const { w, h } = anchoCampo(f);
      if (f.isMultiline()) {
        while (tam > 6) {
          const parr = texto.split('\n');
          let lineas = 0;
          for (const par of parr) lineas += Math.max(1, (repartir(times, tam, par, Array(200).fill(w - 2)) || []).filter(Boolean).length);
          if (lineas * tam * 1.2 <= h - 2) break;
          tam -= 0.5;
        }
        if (tam <= 6) avisos.push(`El texto de «${nombre}» es demasiado largo y puede salir cortado.`);
      } else {
        while (tam > 5.5 && times.widthOfTextAtSize(texto, tam) > w) tam -= 0.25;
        if (times.widthOfTextAtSize(texto, tam) > w) avisos.push(`«${texto.slice(0, 30)}…» no cabe en su casilla.`);
      }
      f.setFontSize(tam);
      f.setText(texto);
    };

    for (const [nombre, texto] of Object.entries(campos)) poner(nombre, texto);
    for (const g of grupos) {
      const fs = g.campos.map(c => form.getTextField(c));
      const anchos = fs.map(f => anchoCampo(f).w);
      const txt = codificable(times, g.texto);
      let tam = tamBase, lineas = null;
      while (tam >= 7 && !(lineas = repartir(times, tam, txt, anchos))) tam -= 0.5;
      if (!lineas) {
        lineas = repartir(times, 7, txt, anchos.map((a, i) => i === anchos.length - 1 ? 1e6 : a)) || [txt];
        avisos.push(`El texto de «${g.campos[0].replace(/\d+$/, '')}» no cabe en las líneas del impreso: resúmelo.`);
      }
      g.campos.forEach((c, i) => poner(c, lineas[i] || '', tam));
    }

    form.updateFieldAppearances(times);
    form.flatten({ updateFieldAppearances: false });
    // Sin formulario ni acciones: así AutoFirma (o Acrobat) firma sin problemas.
    doc.catalog.delete(PDFName.of('AcroForm'));
    doc.catalog.delete(PDFName.of('OpenAction'));
    doc.catalog.delete(PDFName.of('AA'));
    doc.setProducer('Consejo de Estudiantes de Ciencias (formulario de ayudas)');
    doc.setCreator('pdf-lib');
    return { bytes: await doc.save(), avisos };
  }

  // ---------- Anexo 4 con tantas filas como facturas ----------
  // Se rellena la plantilla (anexo4.pdf, de 12 filas) sin las filas y se aplana; después se
  // recorta en franjas y se apilan: cabecera, una franja de fila por factura y la parte de abajo
  // (total, datos bancarios, firmas). El pie de página queda siempre en su sitio.
  // El resultado fluye como una longtable de LaTeX: las filas llenan la página y siguen en la
  // siguiente (con el logo y la fila de títulos repetidos); detrás van el total y los bloques de
  // abajo, cada uno entero, saltando de página solo el que no quepa.
  // Franjas en bp desde arriba, de \filasTabla y las coordenadas de latex/anexo4.tex.
  const A4 = {
    cabecera: [0, 359.5],     // hasta el final de la fila de títulos de la tabla
    titulos: [338.4, 359.5],  // fila de títulos (páginas de continuación)
    logo: [0, 62],            // logo del Vicerrectorado (páginas de continuación)
    fila: [397.8, 409.8],     // fila 4 de la plantilla: 12 bp
    total: [505.8, 520.1],    // TOTAL A PAGAR
    banco: [520.1, 612],      // datos bancarios e IBAN
    firmas: [612, 757],       // «Zaragoza, a...» y firmas (no se separan)
    nota: [757, 790],         // nota de las facturas
    pie: [800, null],         // pie de página, fijo
    filaModelo: 4,
    columnas: ['orden', 'proveedor', 'numero', 'fecha', 'conceptofra', 'importe', 'subvencion'],
  };

  async function rellenarAnexo4(bytesPlantilla, datos) {
    const { bytes: plano, avisos } = await rellenarFijo(4, bytesPlantilla, datos, { sinFilas: true });
    const plantilla = await PDFDocument.load(bytesPlantilla);
    const pag0 = plantilla.getPage(0);
    const W = pag0.getWidth(), H = pag0.getHeight();
    const formP = plantilla.getForm();
    const cols = A4.columnas.map(c => {
      const f = formP.getTextField(c + A4.filaModelo);
      const r = f.acroField.getWidgets()[0].getRectangle();
      return { c, x: r.x, w: r.width, dy: H - (r.y + r.height) - A4.fila[0], h: r.height, align: f.getAlignment() };
    });

    const origen = await PDFDocument.load(plano);
    const doc = await PDFDocument.create();
    const times = await doc.embedFont(StandardFonts.TimesRoman);
    // La página aplanada se incrusta una sola vez; cada franja es un recorte suyo desplazado.
    const entera = await doc.embedPage(origen.getPage(0));
    const F = {};
    for (const k of ['cabecera', 'titulos', 'logo', 'fila', 'total', 'banco', 'firmas', 'nota', 'pie']) {
      const [a, b] = A4[k];
      F[k] = { a, alto: (b === null ? H : b) - a };
    }
    const poner = (pag, fr, yArriba) => {
      pag.pushOperators(pushGraphicsState(), rectangle(0, H - yArriba - fr.alto, W, fr.alto), clip(), endPath());
      pag.drawPage(entera, { x: 0, y: fr.a - yArriba });
      pag.pushOperators(popGraphicsState());
    };
    const celda = (pag, texto, col, yFila) => {
      texto = codificable(times, texto || '');
      if (!texto) return;
      let tam = 8; const ancho = col.w - 3;
      while (tam > 5 && times.widthOfTextAtSize(texto, tam) > ancho) tam -= 0.25;
      if (times.widthOfTextAtSize(texto, tam) > ancho) avisos.push(`«${texto.slice(0, 30)}…» no cabe en su casilla.`);
      const tw = times.widthOfTextAtSize(texto, tam);
      const x = col.align === TextAlignment.Center ? col.x + (col.w - tw) / 2
        : col.align === TextAlignment.Right ? col.x + col.w - 1.5 - tw : col.x + 1.5;
      const base = yFila + col.dy + col.h / 2 + tam * 0.33;
      pag.drawText(texto, { x, y: H - base, size: tam, font: times });
    };

    const facturas = ((datos.justificacion || {}).facturas || []).filter(x => Object.values(x).some(Boolean));
    const limite = A4.pie[0];
    const paginas = [];
    let pag, y;
    const nuevaPagina = (conTitulos) => {
      pag = doc.addPage([W, H]); paginas.push(pag);
      poner(pag, F.logo, 0);
      pag.drawText('Anexo 4 (continuación)', { x: 71.7, y: H - (A4.logo[1] + 20), size: 12, font: times });
      y = A4.logo[1] + 30;
      if (conTitulos) { poner(pag, F.titulos, y); y += F.titulos.alto; }
    };
    // Primera página: la cabecera completa, con la fila de títulos de la tabla.
    pag = doc.addPage([W, H]); paginas.push(pag);
    poner(pag, F.cabecera, 0); y = A4.cabecera[1];

    facturas.forEach((fa, k) => {
      if (y + F.fila.alto > limite) nuevaPagina(true);
      poner(pag, F.fila, y);
      const vals = { orden: String(k + 1), proveedor: fa.proveedor, numero: fa.numero, fecha: fa.fecha,
        conceptofra: fa.concepto, importe: euros(importe(fa.importe)), subvencion: euros(importe(fa.subvencion)) };
      cols.forEach(col => celda(pag, vals[col.c], col, y));
      y += F.fila.alto;
    });
    if (y + F.total.alto > limite) nuevaPagina(true);
    poner(pag, F.total, y); y += F.total.alto;
    for (const k of ['banco', 'firmas', 'nota']) {
      if (y + F[k].alto > limite) nuevaPagina(false);
      poner(pag, F[k], y); y += F[k].alto;
    }

    paginas.forEach((p, ip) => {
      poner(p, F.pie, A4.pie[0]);
      if (paginas.length > 1) {
        const t = `Página ${ip + 1} de ${paginas.length}`;
        p.drawText(t, { x: 523 - times.widthOfTextAtSize(t, 9), y: H - 817.2, size: 9, font: times });
      }
    });

    doc.setTitle('Anexo 4. Impreso de pagos a Delegaciones de Estudiantes');
    doc.setProducer('Consejo de Estudiantes de Ciencias (formulario de ayudas)');
    doc.setCreator('pdf-lib');
    return { bytes: await doc.save(), avisos };
  }

  return { rellenar, camposAnexo, importe, euros, ibanValido, ibanBonito, limpiarIban, fecha };
});
