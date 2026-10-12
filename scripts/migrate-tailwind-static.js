const fs = require('fs');
const path = require('path');

const files = [
  { file: 'public/index.html', cssPath: 'assets/css/tailwind.static.css' },
  { file: 'public/404.html', cssPath: 'assets/css/tailwind.static.css' },
  { file: 'public/login/index.html', cssPath: '../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/index.html', cssPath: '../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/items/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/in/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/out/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/po/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/return/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/suppliers/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/customers/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/cash/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/debt/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/report/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/users/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/audit/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/notif/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/backup/index.html', cssPath: '../../assets/css/tailwind.static.css' },
  { file: 'public/dashboard/settings/index.html', cssPath: '../../assets/css/tailwind.static.css' },
];

for (const { file, cssPath } of files) {
  const filePath = path.resolve(__dirname, '..', file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if tailwind.static.css already added
  if (content.includes('tailwind.static.css')) {
    console.log(`Skipping already updated: ${file}`);
    continue;
  }

  // 1. Remove CDN script tag
  content = content.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\r?\n?/g, '');
  content = content.replace('<!-- CDN: Tailwind, Lucide, Chart.js -->', '<!-- CDN: Lucide, Chart.js -->');
  content = content.replace('<!-- CDN: Tailwind, Lucide -->', '<!-- CDN: Lucide -->');

  // 2. Add stylesheet link
  const linkTag = `<link rel="stylesheet" href="${cssPath}">\n`;

  if (content.includes('<!-- Styles -->\n')) {
    content = content.replace('<!-- Styles -->\n', `<!-- Styles -->\n${linkTag}`);
  } else if (content.includes('<link rel="stylesheet" href="assets/css/main.css">')) {
    content = content.replace('<link rel="stylesheet" href="assets/css/main.css">', `${linkTag}<link rel="stylesheet" href="assets/css/main.css">`);
  } else if (content.includes('</head>')) {
    content = content.replace('</head>', `${linkTag}</head>`);
  } else {
    console.error(`Cannot find insertion point for stylesheet in: ${file}`);
    process.exit(1);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully migrated: ${file}`);
}

console.log('All 19 HTML files processed.');
