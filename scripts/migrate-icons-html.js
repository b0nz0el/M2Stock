const fs = require('fs');
const path = require('path');

const files = [
  { file: 'public/index.html', scriptPath: 'assets/js/icons.js' },
  { file: 'public/404.html', scriptPath: 'assets/js/icons.js' },
  { file: 'public/login/index.html', scriptPath: '../assets/js/icons.js' },
  { file: 'public/dashboard/index.html', scriptPath: '../assets/js/icons.js' },
  { file: 'public/dashboard/items/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/in/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/out/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/po/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/return/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/suppliers/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/customers/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/cash/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/debt/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/report/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/users/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/audit/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/notif/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/backup/index.html', scriptPath: '../../assets/js/icons.js' },
  { file: 'public/dashboard/settings/index.html', scriptPath: '../../assets/js/icons.js' },
];

for (const { file, scriptPath } of files) {
  const filePath = path.resolve(__dirname, '..', file);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Remove CDN script tag and related comments
  content = content.replace(/<script src="https:\/\/unpkg\.com\/lucide@latest\/dist\/umd\/lucide\.js"><\/script>\r?\n?/g, '');
  content = content.replace(/<!-- CDN: Lucide, Chart\.js -->\r?\n?/, '<!-- CDN: Chart.js -->\n');
  content = content.replace(/<!-- CDN: Lucide -->\r?\n?/, '');

  // 2. Add icons.js script tag before app.js (or login.js)
  const scriptTag = `<script src="${scriptPath}" defer></script>\n`;

  if (content.includes(scriptPath)) {
    console.log(`Skipping already has icons.js: ${file}`);
  } else if (content.includes('app.js')) {
    // Insert before app.js
    content = content.replace(/<script src="([^"]*\/app\.js)" defer><\/script>/, `${scriptTag}<script src="$1" defer></script>`);
    console.log(`Inserted icons.js before app.js in ${file}`);
  } else if (content.includes('login.js')) {
    // Insert before login.js
    content = content.replace(/<script src="([^"]*\/login\.js)" defer><\/script>/, `${scriptTag}<script src="$1" defer></script>`);
    console.log(`Inserted icons.js before login.js in ${file}`);
  } else if (content.includes('</body>')) {
    content = content.replace('</body>', `${scriptTag}</body>`);
    console.log(`Inserted icons.js before </body> in ${file}`);
  } else {
    console.log(`No insertion point for ${file}`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('Finished updating HTML files.');
