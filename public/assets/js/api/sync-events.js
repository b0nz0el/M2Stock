const DOMAIN_LOADERS = {
  products: ['loadItemsFromBackend', 'loadDropdowns', 'loadDashboardData', 'loadReport'],
  transactions: ['loadDashboardData', 'loadReport', 'loadInTransactions', 'loadOutTransactions'],
  cash: ['loadCashData', 'loadDashboardData', 'loadReport'],
  debt: ['loadData', 'loadDashboardData', 'loadReport'],
  po: ['loadData', 'loadDashboardData', 'loadReport'],
  returns: ['loadReturnData', 'loadDashboardData', 'loadReport'],
  suppliers: ['loadSuppliers', 'loadMasterData'],
  customers: ['loadCustomers', 'loadDashboardData']
};

let pending = new Set();
let refreshTimer = null;

function scheduleRefresh(domain) {
  pending.add(domain);
  if (refreshTimer) return;
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    const domains = [...pending];
    pending.clear();
    domains.forEach((changedDomain) => {
      (DOMAIN_LOADERS[changedDomain] || []).forEach((name) => {
        const loader = window[name];
        if (typeof loader === 'function') {
          Promise.resolve(loader()).catch((error) => console.error(`Refresh gagal (${name}):`, error));
        }
      });
    });
  }, 120);
}

export function initSyncEvents() {
  if (typeof window === 'undefined' || window.__m2stockSyncEventsInitialized || window.__aquastockSyncEventsInitialized) return;
  window.__m2stockSyncEventsInitialized = true;
  window.__aquastockSyncEventsInitialized = true;
  Object.keys(DOMAIN_LOADERS).forEach((domain) => {
    window.addEventListener(`m2stock:${domain}-updated`, () => scheduleRefresh(domain));
    window.addEventListener(`aquastock:${domain}-updated`, () => scheduleRefresh(domain));
  });
}
