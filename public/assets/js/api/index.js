/* ═══════════════════════════════════════════════════
   Aquastock Pro — api/index.js
   Barrel entry point for modular API client
   ═══════════════════════════════════════════════════ */

import {
  createAbortController,
  formatResponse,
  handleError,
  apiRequest
} from './_client.js';
import { items } from './items.js';
import { transactions } from './transactions.js';
import { po } from './po.js';
import { returnApi } from './return.js';
import { suppliers } from './suppliers.js';
import { customers } from './customers.js';
import { users } from './users.js';
import { storage } from './storage.js';
import { report } from './report.js';
import { audit } from './audit.js';
import { cash } from './cash.js';
import { debt } from './debt.js';
import { notif } from './notif.js';
import { backup } from './backup.js';
import { settings } from './settings.js';
import { initSyncEvents } from './sync-events.js';

initSyncEvents();

export const Api = {
  // Helpers
  createAbortController,
  formatResponse,
  handleError,

  // Raw Request
  request: apiRequest,

  // Domains
  items,
  transactions,
  po,
  return: returnApi,
  suppliers,
  customers,
  users,
  storage,
  report,
  audit,
  cash,
  debt,
  notif,
  backup,
  settings
};

// Ekspos ke global window browser
if (typeof window !== 'undefined') {
  window.Api = Api;
}

export default Api;
