import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
vi.mock('../public/assets/js/supabase-client.js', () => ({ supabase: {} }));

import { hasAccess, MENU_ACCESS } from '../public/assets/js/utils/rbac.js';
import { READ_ONLY_PAGES } from '../public/assets/js/utils/rbac-ui.js';

describe('role access matrix', () => {
  it('grants VIEWER dashboard and read-only PO/return pages only', () => {
    const accessiblePages = Object.keys(MENU_ACCESS).filter(page => hasAccess('VIEWER', page));

    expect(accessiblePages).toEqual(['dashboard', 'po', 'return']);
    expect(READ_ONLY_PAGES.VIEWER).toEqual(['po', 'return']);
  });

  it('grants STAFF operational modules and read-only admin pages, but not reports', () => {
    expect(hasAccess('STAFF', 'items')).toBe(true);
    expect(hasAccess('STAFF', 'report')).toBe(false);
    expect(hasAccess('STAFF', 'users')).toBe(true);
    expect(READ_ONLY_PAGES.STAFF).toEqual(['users', 'audit', 'backup', 'settings']);
  });

  it('keeps every menu page available to OWNER', () => {
    expect(Object.values(MENU_ACCESS).every(roles => roles.includes('OWNER'))).toBe(true);
  });

  it('enforces read-only roles and OWNER-only deletes in database policies', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20261103_z_rbac_matrix.sql'),
      'utf8'
    );

    expect(migration).toContain("UPPER(profiles.role) IN ('OWNER', 'STAFF', 'VIEWER')");
    expect(migration).toContain("UPPER(profiles.role) IN ('OWNER', 'STAFF')");
    expect(migration).toContain("UPPER(profiles.role) = 'OWNER'");
    expect(migration).toContain('DROP POLICY IF EXISTS "profiles_update"');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.get_auth_users() TO authenticated');
  });
});
