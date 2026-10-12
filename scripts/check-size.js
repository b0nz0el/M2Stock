const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Konfigurasi budget (dalam KB)
const BUDGET = {
  cssGzipKB: 60,
  jsGzipKB: 120,
};

function formatKB(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB';
}

function getFiles(dir, filterExt) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getFiles(fullPath, filterExt));
    } else if (entry.isFile() && fullPath.endsWith(filterExt)) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function analyzeFiles(filePaths, basePath) {
  return filePaths.map(filePath => {
    const buffer = fs.readFileSync(filePath);
    const raw = buffer.length;
    const gzip = zlib.gzipSync(buffer).length;
    const relPath = path.relative(basePath, filePath);
    return { path: relPath, raw, gzip };
  });
}

function pad(str, len, alignRight = false) {
  str = String(str);
  if (str.length >= len) return str;
  const padding = ' '.repeat(len - str.length);
  return alignRight ? padding + str : str + padding;
}

function printTable(title, items) {
  console.log(`\n\x1b[1m\x1b[36m=== ${title} ===\x1b[0m`);
  const header = `| ${pad('File', 44)} | ${pad('Raw', 18, true)} | ${pad('Gzip', 18, true)} |`;
  const divider = `|${'-'.repeat(46)}|${'-'.repeat(20)}|${'-'.repeat(20)}|`;
  console.log(divider);
  console.log(header);
  console.log(divider);
  for (const item of items) {
    const rawStr = `${formatKB(item.raw)} (${item.raw} B)`;
    const gzipStr = `${formatKB(item.gzip)} (${item.gzip} B)`;
    console.log(`| ${pad(item.path, 44)} | ${pad(rawStr, 18, true)} | ${pad(gzipStr, 18, true)} |`);
  }
  console.log(divider);
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const cssDir = path.join(rootDir, 'public/assets/css');
  const jsDir = path.join(rootDir, 'public/assets/js');

  const cssFiles = getFiles(cssDir, '.css');
  const jsFiles = getFiles(jsDir, '.js');

  const cssStats = analyzeFiles(cssFiles, rootDir);
  const jsStats = analyzeFiles(jsFiles, rootDir);

  printTable('CSS ASSETS', cssStats);
  const totalCssRaw = cssStats.reduce((acc, f) => acc + f.raw, 0);
  const totalCssGzip = cssStats.reduce((acc, f) => acc + f.gzip, 0);

  printTable('JS ASSETS', jsStats);
  const totalJsRaw = jsStats.reduce((acc, f) => acc + f.raw, 0);
  const totalJsGzip = jsStats.reduce((acc, f) => acc + f.gzip, 0);

  console.log('\n\x1b[1m=== RINGKASAN SIZE BUDGET ===\x1b[0m');
  console.log(`Total CSS raw: ${formatKB(totalCssRaw)} (${totalCssRaw} bytes) | gzip: ${formatKB(totalCssGzip)} (${totalCssGzip} bytes)`);
  console.log(`Total JS raw:  ${formatKB(totalJsRaw)} (${totalJsRaw} bytes) | gzip: ${formatKB(totalJsGzip)} (${totalJsGzip} bytes)`);

  const cssGzipKB = (totalCssGzip / 1024).toFixed(2);
  const jsGzipKB = (totalJsGzip / 1024).toFixed(2);

  let hasWarning = false;

  console.log('\n\x1b[1m=== STATUS BUDGET (Target Awal) ===\x1b[0m');
  if (totalCssGzip > BUDGET.cssGzipKB * 1024) {
    console.warn(`\x1b[33m⚠️  WARNING: CSS gzip (${cssGzipKB} KB) melebihi budget ${BUDGET.cssGzipKB} KB!\x1b[0m`);
    hasWarning = true;
  } else {
    console.log(`\x1b[32m✔ CSS gzip: ${cssGzipKB} KB / budget ${BUDGET.cssGzipKB} KB (PASSED)\x1b[0m`);
  }

  if (totalJsGzip > BUDGET.jsGzipKB * 1024) {
    console.warn(`\x1b[33m⚠️  WARNING: JS gzip (${jsGzipKB} KB) melebihi budget ${BUDGET.jsGzipKB} KB!\x1b[0m`);
    hasWarning = true;
  } else {
    console.log(`\x1b[32m✔ JS gzip:  ${jsGzipKB} KB / budget ${BUDGET.jsGzipKB} KB (PASSED)\x1b[0m`);
  }

  if (hasWarning) {
    console.log('\x1b[33mCatatan: Budget awal masih dalam mode monitoring (exit 0).\x1b[0m\n');
  } else {
    console.log('\x1b[32mSemua asset berada dalam batas size budget awal.\x1b[0m\n');
  }

  // JANGAN exit error di Fase 2.3
  process.exit(0);
}

main();
