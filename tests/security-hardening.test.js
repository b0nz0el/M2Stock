import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('security hardening regressions', () => {
  it('escapes product names before rendering dashboard HTML', () => {
    const source = readFileSync(resolve(root, 'public/dashboard/dashboard.js'), 'utf8');

    expect(source).toContain('${escapeHtml(p.name)}');
    expect(source).toContain('${escapeHtml(item.name)}');
  });

  it('restricts sensitive RPCs and requires an authorized user for restock generation', () => {
    const migration = readFileSync(
      resolve(root, 'supabase/migrations/20261103_security_hardening.sql'),
      'utf8'
    );

    expect(migration).toContain('FROM PUBLIC, anon');
    expect(migration).toContain("IF v_user_id IS NULL THEN");
    expect(migration).toContain("NOT IN ('OWNER', 'STAFF')");
    expect(migration).toContain('generate_draft_po_from_low_stock_unchecked');
  });

  it('does not trust user-editable metadata to authorize owners', () => {
    const migration = readFileSync(
      resolve(root, 'supabase/migrations/20261103_security_hardening.sql'),
      'utf8'
    );

    expect(migration).not.toContain('user_metadata');
    expect(migration).toContain('profiles_update_owner_only');
    expect(migration).toContain("UPPER(profiles.role) = 'OWNER'");
  });
});
