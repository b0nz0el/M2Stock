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

// 4. Update public/sw.js
const swPath = path.join(rootDir, 'public/sw.js');
if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');
  swContent = swContent.replace(/const CACHE_NAME = 'aquastock-v[0-9.]+-pwa';/, `const CACHE_NAME = 'aquastock-v${newVersion}-pwa';`);
  fs.writeFileSync(swPath, swContent, 'utf8');
  console.log(`  ✓ Updated public/sw.js → CACHE_NAME: aquastock-v${newVersion}-pwa`);
}

// 5. Update public/assets/js/components/app-sidebar.js
const sidebarPath = path.join(rootDir, 'public/assets/js/components/app-sidebar.js');
if (fs.existsSync(sidebarPath)) {
  let sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
  sidebarContent = sidebarContent.replace(
    /(<span class="ml-auto text-\[10px\] bg-\[#32ADE6\]\/15 text-\[#32ADE6\] px-1\.5 py-0\.5 rounded font-mono font-semibold">)v[0-9.]+(<\/span>)/,
    `$1v${newVersion}$2`
  );
  fs.writeFileSync(sidebarPath, sidebarContent, 'utf8');
  console.log(`  ✓ Updated public/assets/js/components/app-sidebar.js → v${newVersion}`);
}

// 6. Update public/dashboard/index.html
const htmlPath = path.join(rootDir, 'public/dashboard/index.html');
if (fs.existsSync(htmlPath)) {
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');
  // Badge Terkini di settings
  htmlContent = htmlContent.replace(
    /(<span class="px-2 py-0\.5 rounded-full text-\[11px\] font-bold bg-\[#34C759\]\/20 text-\[#34C759\] border border-\[#34C759\]\/30">)v[0-9.]+ \(Terkini\)(<\/span>)/,
    `$1v${newVersion} (Terkini)$2`
  );
  // Versi aktif di settings
  htmlContent = htmlContent.replace(
    /(Versi aktif: <span class="font-semibold text-white">Aquastock Pro )v[0-9.]+ \(PWA Local-First\)(<\/span>)/,
    `$1v${newVersion} (PWA Local-First)$2`
  );
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log(`  ✓ Updated public/dashboard/index.html → v${newVersion}`);
}

// 7. Update public/assets/js/app.js
const appJsPath = path.join(rootDir, 'public/assets/js/app.js');
if (fs.existsSync(appJsPath)) {
  let appJsContent = fs.readFileSync(appJsPath, 'utf8');
  appJsContent = appJsContent.replace(
    /showToast\('Aplikasi berhasil disinkronkan ke versi terbaru \(v[0-9.]+\)!', 'success'\);/,
    `showToast('Aplikasi berhasil disinkronkan ke versi terbaru (v${newVersion})!', 'success');`
  );
  fs.writeFileSync(appJsPath, appJsContent, 'utf8');
  console.log(`  ✓ Updated public/assets/js/app.js → v${newVersion}`);
}

console.log(`\n✅ Selesai! Versi sekarang adalah v${newVersion}`);
