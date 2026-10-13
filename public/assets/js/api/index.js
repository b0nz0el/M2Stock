/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/index.js
   Barrel entry point for modular API client
   ═══════════════════════════════════════════════════ */

import {
  createAbortController,
  formatResponse,
  handleError,
  setMockMode,
  isMockMode,
  apiRequest
} from './_client.js';
import { items } from './items.js';
import { transactions, po, returnApi } from './transactions.js';
import { suppliers } from './suppliers.js';
import { customers } from './customers.js';
import { users } from './users.js';
import { storage } from './storage.js';

export const Api = {
  // Helpers
  createAbortController,
  formatResponse,
  handleError,
  setMockMode,
  isMockMode,

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
  storage
};

// Ekspos ke global window browser
if (typeof window !== 'undefined') {
  window.Api = Api;
}

export default Api;
