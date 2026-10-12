const fs = require('fs');
const path = require('path');

const files = [
  { file: 'public/index.html', prefix: 'assets/fonts' },
  { file: 'public/404.html', prefix: 'assets/fonts' },
  { file: 'public/login/index.html', prefix: '../assets/fonts' },
  { file: 'public/dashboard/index.html', prefix: '../assets/fonts' },
  { file: 'public/dashboard/items/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/in/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/out/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/po/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/return/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/suppliers/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/customers/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/cash/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/debt/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/report/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/users/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/audit/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/notif/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/backup/index.html', prefix: '../../assets/fonts' },
  { file: 'public/dashboard/settings/index.html', prefix: '../../assets/fonts' },
];

for (const { file, prefix } of files) {
  const filePath = path.resolve(__dirname, '..', file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if already injected
  if (content.includes('InterVariable.woff2')) {
    console.log(`Skipping already updated: ${file}`);
    continue;
  }

  const snippet = `<!-- Inter font (self-host) -->\n<link rel="preconnect" href="/" crossorigin>\n<link rel="preload" href="${prefix}/InterVariable.woff2"\n      as="font" type="font/woff2" crossorigin>\n<link rel="stylesheet" href="${prefix}/inter.css">\n\n`;

  if (content.includes('<!-- Styles -->')) {
    content = content.replace('<!-- Styles -->', snippet + '<!-- Styles -->');
  } else if (content.includes('<link rel="stylesheet"')) {
    content = content.replace('<link rel="stylesheet"', snippet + '<link rel="stylesheet"');
  } else if (content.includes('</head>')) {
    content = content.replace('</head>', snippet + '</head>');
  } else {
    console.error(`Cannot find insertion point in: ${file}`);
    process.exit(1);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated: ${file} (with ${prefix})`);
}
console.log('All 19 files updated.');
