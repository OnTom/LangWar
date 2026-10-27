// Kontrola před spuštěním (npm start / npm run dev): správná verze Node.js a nainstalované balíčky.
// Místo dlouhé anglické chyby vypíše, co přesně udělat.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const problems = [];

const major = Number(process.versions.node.split('.')[0]);
if (major < 20) {
  problems.push(
    `Máš Node.js ${process.versions.node}, hra potřebuje verzi 20 nebo novější.\n` +
      '   Stáhni si verzi LTS z https://nodejs.org, nainstaluj ji a otevři nový terminál.'
  );
}

const missing = Object.keys(pkg.dependencies).filter(
  (name) => !fs.existsSync(path.join(root, 'node_modules', name, 'package.json'))
);
if (missing.length) {
  problems.push(
    `Chybí nainstalované balíčky (${missing.join(', ')}).\n` +
      '   Ve složce hry spusť:  npm install\n' +
      '   (ve Windows PowerShellu:  npm.cmd install)\n' +
      '   Je to potřeba po prvním stažení a pokaždé, když přibudou nové balíčky.'
  );
}

if (problems.length) {
  console.error('\n❌ Hru zatím nejde spustit:\n');
  problems.forEach((p, i) => console.error(`${i + 1}. ${p}\n`));
  process.exit(1);
}
