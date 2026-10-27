const fs = require('fs');
const path = require('path');
const { Window } = require('happy-dom');

const subPages = [
  'items', 'in', 'out', 'po', 'return',
  'suppliers', 'customers', 'cash', 'debt',
  'report', 'users', 'audit', 'backup', 'settings', 'notif'
];

const dashboardPath = path.resolve(__dirname, '../public/dashboard/index.html');
const templatePath = fs.existsSync(dashboardPath + '.bak') ? dashboardPath + '.bak' : dashboardPath;
const rawDashboardHtml = fs.readFileSync(templatePath, 'utf8');

let pageContainersHtml = '';
let modalsHtml = '';

subPages.forEach(slug => {
  const filePath = path.resolve(__dirname, '../public/dashboard', slug, 'index.html');
  const subHtml = fs.readFileSync(filePath, 'utf8');
  const subWin = new Window();
  const subDoc = subWin.document;
  subDoc.write(subHtml);

  // 1. Extract Page Container
  const pageEl = subDoc.getElementById('page-' + slug);
  if (!pageEl) {
    throw new Error('Page element not found for: ' + slug);
  }

  // Remove 'active' class
  const classList = pageEl.getAttribute('class') || '';
  const cleanedClass = classList.split(/\s+/).filter(c => c !== 'active').join(' ');
  pageEl.setAttribute('class', cleanedClass);

  let pageHtml = pageEl.outerHTML;

  // Fix asset paths
  pageHtml = pageHtml.replace(/\.\.\/\.\.\/assets\//g, '../assets/');

  // Specific fixes
  if (slug === 'suppliers') {
    pageHtml = pageHtml.replace(/handleSearch\(this\.value\)/g, 'handleSearchSuppliers(this.value)');
  } else if (slug === 'customers') {
    pageHtml = pageHtml.replace(/handleSearch\(this\.value\)/g, 'handleSearchCustomers(this.value)');
  } else if (slug === 'users') {
    pageHtml = pageHtml.replace(/handleSearch\(this\.value\)/g, 'handleSearchUsers(this.value)');
  } else if (slug === 'return') {
    pageHtml = pageHtml.replace(/id="btn-prev-page"/g, 'id="btn-return-prev-page"');
    pageHtml = pageHtml.replace(/id="btn-next-page"/g, 'id="btn-return-next-page"');
  }

  pageContainersHtml += '\n    <!-- =========================== ' + slug.toUpperCase() + ' =========================== -->\n    ' + pageHtml + '\n';

  // 2. Extract Modals
  const modals = [...subDoc.querySelectorAll('div[id^="modal-"]')].filter(m => !m.id.endsWith('-title') && !m.id.endsWith('-description'));
  modals.forEach(m => {
    let mHtml = m.outerHTML;
    mHtml = mHtml.replace(/\.\.\/\.\.\/assets\//g, '../assets/');

    if (slug === 'suppliers') {
      mHtml = mHtml.replace(/id="modal-delete-title"/g, 'id="modal-delete-supplier-title"');
      mHtml = mHtml.replace(/aria-labelledby="modal-delete-title"/g, 'aria-labelledby="modal-delete-supplier-title"');
    } else if (slug === 'customers') {
      mHtml = mHtml.replace(/id="modal-delete-title"/g, 'id="modal-delete-customer-title"');
      mHtml = mHtml.replace(/aria-labelledby="modal-delete-title"/g, 'aria-labelledby="modal-delete-customer-title"');
    }

    modalsHtml += '\n<!-- =========================== MODAL (' + slug.toUpperCase() + ': ' + m.id + ') =========================== -->\n' + mHtml + '\n';
  });
});

// Locate insertion points in rawDashboardHtml
const mainCloseIdx = rawDashboardHtml.indexOf('</main>');
if (mainCloseIdx === -1) throw new Error('Could not find </main>');

const beforeMainClose = rawDashboardHtml.slice(0, mainCloseIdx);
const afterMainClose = rawDashboardHtml.slice(mainCloseIdx);

// Inject pageContainers before </main>
let combinedHtml = beforeMainClose + pageContainersHtml + afterMainClose;

// Locate bulk-bar for modals
const toastIdx = combinedHtml.indexOf('<!-- ═══════════ FLOATING BULK ACTION BAR ═══════════ -->');
if (toastIdx === -1) throw new Error('Could not find bulk bar');

const beforeToast = combinedHtml.slice(0, toastIdx);
const afterToast = combinedHtml.slice(toastIdx);

// Inject modals before bulk bar
combinedHtml = beforeToast + modalsHtml + afterToast;

// Replace scripts section
const scriptsOldStart = combinedHtml.indexOf('<!-- Scripts (defer agar DOM siap lebih dulu) -->');
const scriptsOldEnd = combinedHtml.indexOf('</body>');
if (scriptsOldStart === -1 || scriptsOldEnd === -1) throw new Error('Could not find scripts block');

const newScriptsBlock = `<!-- Scripts (defer agar DOM siap lebih dulu) -->
<script type="module" src="../assets/js/supabase-client.js"></script>
<script src="../assets/js/auth.js" defer></script>
<script src="../assets/js/utils.js" defer></script>
<script src="../assets/js/image-utils.js" defer></script>
<script src="../assets/js/navigation.js" defer></script>
<script src="../assets/js/vendor/chart.min.js" defer></script>
<script src="../assets/js/charts.js" defer></script>
<script src="../assets/js/animations.js" defer></script>
<script src="../assets/js/components/app-sidebar.js" defer></script>
<script src="../assets/js/icons.js" defer></script>
<script type="module" src="../assets/js/api/index.js"></script>
<script src="../assets/js/components/barcode-scanner.js" defer></script>
<script src="../assets/js/components/csv-import.js" defer></script>
<script src="../assets/js/components/select-ui.js" defer></script>
<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js" defer></script>
<script src="../assets/js/app.js" defer></script>

<!-- SPA Page Modules (Setiap modul terisolasi di scope masing-masing) -->
<script type="module" src="./dashboard.js"></script>
<script type="module" src="./items/items.js"></script>
<script type="module" src="./in/in.js"></script>
<script type="module" src="./out/out.js"></script>
<script type="module" src="./po/po.js"></script>
<script type="module" src="./return/return.js"></script>
<script type="module" src="./suppliers/suppliers.js"></script>
<script type="module" src="./customers/customers.js"></script>
<script type="module" src="./cash/cash.js"></script>
<script type="module" src="./debt/debt.js"></script>
<script type="module" src="./report/report.js"></script>
<script type="module" src="./users/users.js"></script>
<script type="module" src="./audit/audit.js"></script>
<script type="module" src="./backup/backup.js"></script>
<script type="module" src="./settings/settings.js"></script>
<script type="module" src="./notif/notif.js"></script>

<script type="module">
  import { applyReadOnlyUI } from '../assets/js/utils/rbac-ui.js';
  await applyReadOnlyUI();
</script>
`;

combinedHtml = combinedHtml.slice(0, scriptsOldStart) + newScriptsBlock + combinedHtml.slice(scriptsOldEnd);

fs.writeFileSync(dashboardPath, combinedHtml);
console.log('Successfully written unified dashboard SPA to', dashboardPath);
console.log('New file size:', (combinedHtml.length / 1024).toFixed(1), 'KB');
