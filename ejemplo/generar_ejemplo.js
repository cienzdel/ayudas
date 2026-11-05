// Rehace los PDF de ejemplo (ejemplo/anexoN_ejemplo.pdf) con los datos ficticios
// de ejemplo.json. Uso:  npm install pdf-lib@1.17.1  y  node ejemplo/generar_ejemplo.js
const fs = require('fs');
const path = require('path');
const Anexos = require('../rellenar.js');

(async () => {
  const datos = JSON.parse(fs.readFileSync(path.join(__dirname, 'ejemplo.json'), 'utf8'));
  for (const n of [1, 2, 4]) {
    const plantilla = fs.readFileSync(path.join(__dirname, '..', 'pdf', `anexo${n}.pdf`));
    const { bytes, avisos } = await Anexos.rellenar(n, plantilla, datos);
    fs.writeFileSync(path.join(__dirname, `anexo${n}_ejemplo.pdf`), bytes);
    console.log(`Anexo ${n}: ${bytes.length} bytes`, avisos.length ? avisos : '');
  }
})();
