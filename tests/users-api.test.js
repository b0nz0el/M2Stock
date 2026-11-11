import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Api.users.create & user management', () => {
  let users;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      supabase: {
        rpc: vi.fn(),
        functions: {
          invoke: vi.fn()
        },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
      }
    });
    vi.stubGlobal('fetch', vi.fn());

    const mod = await import('../public/assets/js/api/users.js');
    users = mod.users;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates missing email or password', async () => {
    const res = await users.create({ email: '', password: '' });
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('VALIDATION_ERROR');
  });

  it('calls admin_create_user RPC when available', async () => {
    window.supabase.rpc.mockResolvedValueOnce({
      data: { success: true, email: 'new@example.com', role: 'STAFF' },
      error: null
    });

    const res = await users.create({
      email: 'new@example.com',
      password: 'Password123!',
      role: 'STAFF',
      full_name: 'Budi Santoso'
    });

    expect(res.ok).toBe(true);
    expect(window.supabase.rpc).toHaveBeenCalledWith('admin_create_user', {
      new_email: 'new@example.com',
      new_password: 'Password123!',
      new_role: 'STAFF',
      new_full_name: 'Budi Santoso'
    });
  });

  it('falls back to signup when RPC and Edge functions are unavailable', async () => {
    window.supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function' }
    });
    window.supabase.functions.invoke.mockRejectedValueOnce(
      new Error('Failed to send a request to the Edge Function')
    );

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { id: 'usr-123', email: 'staff@example.com' }
      })
    });

    const res = await users.create({
      email: 'staff@example.com',
      password: 'Password123!',
      role: 'STAFF',
      full_name: 'Staff Toko'
    });

    expect(res.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('translates rate limit error to informative guidance for OWNER', async () => {
    window.supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function' }
    });
    window.supabase.functions.invoke.mockRejectedValueOnce(
      new Error('Failed to send a request to the Edge Function')
    );

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        code: 429,
        error_code: 'over_email_send_rate_limit',
        msg: 'email rate limit exceeded'
      })
    });

    const res = await users.create({
      email: 'staff@example.com',
      password: 'Password123!',
      role: 'STAFF'
    });

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('RATE_LIMIT');
    expect(res.error.message).toContain('Batas kirim email Supabase tercapai');
  });

  it('filters out ghost users whose profiles were deleted in Supabase', async () => {
    // profiles table only has Maulana and Salma (test01 was deleted in Supabase)
    window.supabase.from.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue({
        data: [
          { id: '1', name: 'Maulana', full_name: 'Maulana', email: 'owner@example.com', role: 'OWNER' },
          { id: '2', name: 'Salma', full_name: 'Salma', email: 'salma@example.com', role: 'STAFF' }
        ]
      })
    });

    // auth.users still has 3 users (including orphaned test01)
    window.supabase.rpc.mockResolvedValueOnce({
      data: [
        { id: '1', email: 'owner@example.com', full_name: 'Maulana', role: 'OWNER' },
        { id: '2', email: 'salma@example.com', full_name: 'Salma', role: 'STAFF' },
        { id: '3', email: 'test01@test.com', full_name: 'test01', role: 'VIEWER' }
      ],
      error: null
    });

    const res = await users.getAll();
    expect(res.ok).toBe(true);
    expect(res.data.length).toBe(2);
    expect(res.data.some(u => u.email === 'test01@test.com')).toBe(false);
  });

  it('deletes user via admin_delete_user RPC or profile fallback', async () => {
    window.supabase.rpc.mockResolvedValueOnce({
      data: { success: true },
      error: null
    });

    const res = await users.delete('usr-to-delete');
    expect(res.ok).toBe(true);
    expect(window.supabase.rpc).toHaveBeenCalledWith('admin_delete_user', {
      target_user_id: 'usr-to-delete'
    });
  });

  describe('resetPassword', () => {
    it('validates missing targetUserId or password', async () => {
      const res1 = await users.resetPassword('', 'Password123!');
      expect(res1.ok).toBe(false);
      expect(res1.error.code).toBe('VALIDATION_ERROR');

      const res2 = await users.resetPassword('usr-1', '');
      expect(res2.ok).toBe(false);
      expect(res2.error.code).toBe('VALIDATION_ERROR');
    });

    it('validates password length under 8 characters', async () => {
      const res = await users.resetPassword('usr-1', 'short');
      expect(res.ok).toBe(false);
      expect(res.error.code).toBe('VALIDATION_ERROR');
      expect(res.error.message).toContain('minimal 8 karakter');
    });

    it('calls admin_reset_password RPC when available', async () => {
      window.supabase.rpc.mockResolvedValueOnce({
        data: { success: true, user_id: 'usr-123' },
        error: null
      });

      const res = await users.resetPassword('usr-123', 'NewSecret123!');
      expect(res.ok).toBe(true);
      expect(window.supabase.rpc).toHaveBeenCalledWith('admin_reset_password', {
        target_user_id: 'usr-123',
        new_password: 'NewSecret123!'
      });
      expect(res.meta.message).toContain('berhasil direset');
    });

    it('handles RPC error properly', async () => {
      window.supabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: 'P0001', message: 'Hanya OWNER yang dapat mereset password pengguna' }
      });

      const res = await users.resetPassword('usr-123', 'NewSecret123!');
      expect(res.ok).toBe(false);
      expect(res.error.code).toBe('P0001');
      expect(res.error.message).toContain('Hanya OWNER');
    });
  });
});
