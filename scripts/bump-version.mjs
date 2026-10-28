#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Baca versi saat ini dari package.json
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version || '3.4.6';

// 2. Tentukan versi baru (patch, minor, major, atau spesifik)
const arg = process.argv[2] || 'patch';
let newVersion = '';

if (arg === 'patch' || arg === 'minor' || arg === 'major') {
  const parts = currentVersion.split('.').map(n => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(isNaN)) {
    console.error(`Format versi tidak valid di package.json: ${currentVersion}`);
    process.exit(1);
  }
  if (arg === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (arg === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else {
    // patch
    parts[2] += 1;
  }
  newVersion = parts.join('.');
} else {
  // Versi spesifik yang diberikan user (misal: "3.4.7")
  newVersion = arg.replace(/^v/, '');
}

console.log(`🚀 Mengupgrade versi Aquastock Pro: v${currentVersion} → v${newVersion}`);

// 3. Update package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`  ✓ Updated package.json → ${newVersion}`);

// 4. Publish version metadata for the app's same-origin update check
const versionPath = path.join(rootDir, 'public/version.json');
fs.writeFileSync(versionPath, JSON.stringify({
  version: newVersion,
  repository: 'b0nz0el/aquastock-pro',
  branch: 'main'
}, null, 2) + '\n', 'utf8');
console.log(`  ✓ Updated public/version.json → ${newVersion}`);

// 5. Update public/sw.js
const swPath = path.join(rootDir, 'public/sw.js');
if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');
  swContent = swContent.replace(/const CACHE_NAME = 'aquastock-v[0-9.]+-pwa';/, `const CACHE_NAME = 'aquastock-v${newVersion}-pwa';`);
  fs.writeFileSync(swPath, swContent, 'utf8');
  console.log(`  ✓ Updated public/sw.js → CACHE_NAME: aquastock-v${newVersion}-pwa`);
}

// 6. Update public/assets/js/components/app-sidebar.js
const sidebarPath = path.join(rootDir, 'public/assets/js/components/app-sidebar.js');
if (fs.existsSync(sidebarPath)) {
  let sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
  sidebarContent = sidebarContent.replace(
    /(<span class="[^"]*" data-app-version-sidebar>)v[0-9.]+(<\/span>)/,
    `$1v${newVersion}$2`
  );
  fs.writeFileSync(sidebarPath, sidebarContent, 'utf8');
  console.log(`  ✓ Updated public/assets/js/components/app-sidebar.js → v${newVersion}`);
}

// 7. Update public/dashboard/index.html
const htmlPath = path.join(rootDir, 'public/dashboard/index.html');
if (fs.existsSync(htmlPath)) {
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');
  htmlContent = htmlContent.replace(
    /(<meta name="app-version" content=")[0-9.]+(")/,
    `$1${newVersion}$2`
  );
  htmlContent = htmlContent.replace(
    /(<span class="app-version-badge[^"]*" data-app-version-badge>)v[0-9.]+ \(Terkini\)(<\/span>)/,
    `$1v${newVersion} (Terkini)$2`
  );
  htmlContent = htmlContent.replace(
    /(<span class="font-semibold text-white" data-app-version-local>Aquastock Pro )v[0-9.]+ \(PWA Local-First\)(<\/span>)/,
    `$1v${newVersion} (PWA Local-First)$2`
  );
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log(`  ✓ Updated public/dashboard/index.html → v${newVersion}`);
}

console.log(`\n✅ Selesai! Versi sekarang adalah v${newVersion}`);
