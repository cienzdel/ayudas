# Anexos de las ayudas del Vicerrectorado a Consejos de Estudiantes

Formulario web (https://cienzdel.github.io/ayudas/) que rellena los Anexos 1, 2 y 4 de la
convocatoria de ayudas a Consejos de Estudiantes de Centro de la Universidad de Zaragoza y
descarga el PDF con las sumas hechas, aplanado y listo para firmar con AutoFirma.
Todo ocurre en el navegador: los datos (DNI, IBAN, domicilio) no se envían a ningún sitio.

La guía paso a paso del trámite está en https://cienzdel.unizar.es/ayudas-vicerrectorado.

## Contenido
- `latex/`: réplicas en LaTeX de los modelos oficiales (convocatoria 2025/26), con campos de
  formulario (hyperref). `anexos.sty` tiene las macros comunes; todo va en coordenadas absolutas
  medidas sobre los PDF oficiales (bp, origen arriba a la izquierda).
  - `anexoN.tex`: sin JavaScript. Los Anexos 1 y 2 son la plantilla que rellena la web.
  - `anexo4_piezas.tex`: el Anexo 4 con `\PIEZAS`: cada franja (logo, cabecera, títulos de la
    tabla, una fila, total, banco, firmas, nota, pie y «continuación») sola en su página, en sus
    coordenadas de siempre. Es la plantilla del Anexo 4 en la web.
  - `anexo2_sumas.tex`, `anexo4_sumas.tex`: el mismo anexo con `\CONCALCULO`, que añade
    JavaScript de Acrobat para formatear importes y sumar el total. **No se deben firmar**:
    el JavaScript hace fallar a AutoFirma.
- `pdf/`: los PDF compilados (copiar aquí tras compilar).
- `rellenar.js`: rellena una plantilla con pdf-lib, reparte los textos largos por las líneas,
  encoge la letra si no cabe, aplana y quita `/AcroForm`, `/OpenAction` y `/AA`.
  El Anexo 4 sale con tantas filas como facturas: rellena y aplana `anexo4_piezas.pdf` y apila
  las piezas (constante `A4`, que tiene que coincidir con las franjas de `latex/anexo4.tex`)
  como una longtable: la tabla sigue en la página siguiente con los títulos repetidos y cada
  bloque de abajo salta entero de página si no cabe. Cada pieza se dibuja entera y una sola
  vez, así que no queda texto oculto ni duplicado en el PDF.
- `index.html`, `app.js`, `estilo.css`: el formulario.
- `reparto/`: solo redirige a la herramienta de reparto de gastos, que vive en
  [cienzdel/reparto-gastos-ciencias](https://github.com/cienzdel/reparto-gastos-ciencias)
  (fork de snatip/reparto-gastos-ciencias).
- `ejemplo/`: datos ficticios (`ejemplo.json`, «Lucía Ejemplo», DNI 00000000T, IBAN de ceros)
  y los tres anexos rellenos con ellos.
- `vendor/pdf-lib.min.js`: pdf-lib 1.17.1 (licencia MIT, en `vendor/pdf-lib-LICENSE.md`).

## Cuando cambie el modelo oficial
1. Medir el PDF nuevo (pymupdf: `page.get_text('dict')` para las líneas base y `page.get_drawings()`
   para rayas y cajas) y ajustar las coordenadas de `latex/anexoN.tex`.
2. `latexmk anexoN.tex` (pdflatex) en `latex/` y copiar los PDF a `pdf/`.
3. Si cambian nombres de campos, ajustar `camposAnexo()` en `rellenar.js`.
4. Rehacer el ejemplo: `npm install pdf-lib@1.17.1` y `node ejemplo/generar_ejemplo.js`.
5. Actualizar en el pie de los anexos (`\avisoNoOficial`) la convocatoria de referencia.

## Comprobar que un PDF se puede firmar
```python
import pypdf
r = pypdf.PdfReader('Anexo4.pdf'); root = r.trailer['/Root']
assert '/OpenAction' not in root and '/AA' not in root
assert b'/JavaScript' not in open('Anexo4.pdf', 'rb').read()
```
