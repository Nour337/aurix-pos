// Bundles gas/*.js into dist/gas/Code.gs (one file to paste into the Apps Script editor).
import fs from 'node:fs';
const files = ['Code.js', 'Auth.js', 'Inventory.js', 'Sales.js', 'Shifts.js', 'Reports.js', 'Admin.js', 'Main.js'];
fs.mkdirSync('dist/gas', { recursive: true });
fs.writeFileSync('dist/gas/Code.gs', files.map((f) => `// ===== ${f} =====\n` + fs.readFileSync('gas/' + f, 'utf8')).join('\n'));
fs.copyFileSync('gas/appsscript.json', 'dist/gas/appsscript.json');
console.log('dist/gas/Code.gs written', fs.statSync('dist/gas/Code.gs').size, 'bytes');
