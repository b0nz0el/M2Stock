import fs from 'fs';
import path from 'path';

const htmlFiles = [
  'public/index.html',
  'public/404.html',
  'public/login/index.html',
  'public/dashboard/index.html',
  'public/dashboard/items/index.html',
  'public/dashboard/in/index.html',
  'public/dashboard/out/index.html',
  'public/dashboard/po/index.html',
  'public/dashboard/return/index.html',
  'public/dashboard/cash/index.html',
  'public/dashboard/debt/index.html',
  'public/dashboard/customers/index.html',
  'public/dashboard/suppliers/index.html',
  'public/dashboard/report/index.html',
  'public/dashboard/users/index.html',
  'public/dashboard/audit/index.html',
  'public/dashboard/backup/index.html',
  'public/dashboard/settings/index.html',
  'public/dashboard/notif/index.html'
];

const pwaSnippet = `\n<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0088CC">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="aQuaStock Pro">
<link rel="apple-touch-icon" href="/assets/images/icons/icon-192x192.png">`;

let updatedCount = 0;
for (const relPath of htmlFiles) {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) continue;

  let content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes('rel="manifest"')) continue;

  // Insert after favicon link or after <head>
  if (content.includes('<link rel="icon"')) {
    content = content.replace(/(<link rel="icon"[^>]*>)/i, `$1${pwaSnippet}`);
  } else if (content.includes('<head>')) {
    content = content.replace('<head>', `<head>${pwaSnippet}`);
  }

  fs.writeFileSync(fullPath, content, 'utf8');
  updatedCount++;
  console.log(`Linked PWA in ${relPath}`);
}

console.log(`Finished linking PWA meta tags in ${updatedCount} files.`);

