import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = path.join(rootDir, 'node_modules', 'html5-qrcode');
const packageJson = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));

if (packageJson.version !== '2.3.8') {
  throw new Error(`Versi html5-qrcode harus 2.3.8; ditemukan ${packageJson.version}.`);
}

const outputDir = path.join(rootDir, 'public/assets/js/vendor');
mkdirSync(outputDir, { recursive: true });
copyFileSync(path.join(packageDir, 'html5-qrcode.min.js'), path.join(outputDir, 'html5-qrcode.min.js'));
copyFileSync(path.join(packageDir, 'LICENSE'), path.join(outputDir, 'html5-qrcode.LICENSE.txt'));

console.log(`Aset html5-qrcode ${packageJson.version} disalin ke public/assets/js/vendor.`);
