import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(rootDir, 'public/assets/js/vendor');
mkdirSync(outputDir, { recursive: true });

function syncVendorAsset(packageName, expectedVersion, files) {
  const packageDir = path.join(rootDir, 'node_modules', packageName);
  const packageJson = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  if (packageJson.version !== expectedVersion) {
    throw new Error(`Versi ${packageName} harus ${expectedVersion}; ditemukan ${packageJson.version}.`);
  }
  for (const [source, target] of files) {
    copyFileSync(path.join(packageDir, source), path.join(outputDir, target));
  }
  console.log(`Aset ${packageName} ${packageJson.version} disalin ke public/assets/js/vendor.`);
}

syncVendorAsset('html5-qrcode', '2.3.8', [
  ['html5-qrcode.min.js', 'html5-qrcode.min.js'],
  ['LICENSE', 'html5-qrcode.LICENSE.txt']
]);
syncVendorAsset('jsbarcode', '3.12.1', [
  ['dist/JsBarcode.all.min.js', 'jsbarcode.all.min.js'],
  ['MIT-LICENSE.txt', 'jsbarcode.LICENSE.txt']
]);
