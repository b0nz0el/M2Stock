const fs = require('fs');
const path = require('path');

const files = [
  'public/index.html',
  'public/404.html',
  'public/login/index.html',
  'public/dashboard/index.html',
  'public/dashboard/items/index.html',
  'public/dashboard/in/index.html',
  'public/dashboard/out/index.html',
  'public/dashboard/po/index.html',
  'public/dashboard/return/index.html',
  'public/dashboard/suppliers/index.html',
  'public/dashboard/customers/index.html',
  'public/dashboard/cash/index.html',
  'public/dashboard/debt/index.html',
  'public/dashboard/report/index.html',
  'public/dashboard/users/index.html',
  'public/dashboard/audit/index.html',
  'public/dashboard/notif/index.html',
  'public/dashboard/backup/index.html',
  'public/dashboard/settings/index.html',
];

for (const file of files) {
  const filePath = path.resolve(__dirname, '..', file);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Remove CDN script tag and comments
  content = content.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js"><\/script>\r?\n?/g, '');
  content = content.replace(/<!-- CDN: Chart\.js -->\r?\n?/, '');

  // 2. Add local chart.min.js only for dashboard and report
  if (file === 'public/dashboard/index.html') {
    if (!content.includes('chart.min.js')) {
      content = content.replace(
        '<script src="../assets/js/charts.js" defer></script>',
        '<script src="../assets/js/vendor/chart.min.js" defer></script>\n<script src="../assets/js/charts.js" defer></script>'
      );
      console.log(`Added chart.min.js to ${file}`);
    }
  } else if (file === 'public/dashboard/report/index.html') {
    if (!content.includes('chart.min.js')) {
      content = content.replace(
        '<script src="../../assets/js/charts.js" defer></script>',
        '<script src="../../assets/js/vendor/chart.min.js" defer></script>\n<script src="../../assets/js/charts.js" defer></script>'
      );
      console.log(`Added chart.min.js to ${file}`);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('Finished updating HTML files for Chart.js lazy load.');
