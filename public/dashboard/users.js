let usersData = [];
let searchQuery = '';
let currentUserRole = 'VIEWER';

const AVATAR_GRADIENTS = [
  'from-[#0088CC] to-[#32ADE6]',
  'from-[#34C759] to-[#28A745]',
  'from-[#AF52DE] to-[#9B3DC8]',
  'from-[#FF9500] to-[#FF5E3A]'
];

function formatTimeAgoWIB(dateStr) {
  if (!dateStr) return 'Belum pernah login';
  const d = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);

  if (diffSec < 60) return 'Baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;

  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function getRoleBadge(role) {
  const r = (role || 'staff').toLowerCase();
  if (r === 'owner') {
    return `<span class="badge bg-[#0088CC]/15 text-[#32ADE6] font-bold">OWNER</span>`;
  }
  if (r === 'viewer') {
    return `<span class="badge bg-[#AF52DE]/15 text-[#AF52DE] font-semibold">VIEWER</span>`;
  }
  return `<span class="badge bg-[#34C759]/15 text-[#34C759] font-semibold">STAFF</span>`;
}

async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  try {
    currentUserRole = await window.RBAC?.getUserRole?.() || 'VIEWER';
    const res = await Api.users.getAll();
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-8 text-center text-[#FF3B30]">${res.error?.message || 'Gagal memuat daftar pengguna'}</td></tr>`;
      return;
    }
    usersData = res.data || [];
    updateUserMetrics();
    renderUsers();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-8 text-center text-[#FF3B30]">Terjadi kesalahan: ${err.message}</td></tr>`;
  }
}

function updateUserMetrics() {
  const total = usersData.length;
  const ownerCount = usersData.filter(u => (u.role || '').toLowerCase() === 'owner').length;
  const staffCount = usersData.filter(u => (u.role || '').toLowerCase() === 'staff').length;
  const viewerCount = usersData.filter(u => (u.role || '').toLowerCase() === 'viewer').length;

  document.getElementById('metric-total-users').textContent = total;
  document.getElementById('metric-owner-count').textContent = ownerCount;
  document.getElementById('metric-staff-count').textContent = staffCount;
  document.getElementById('metric-viewer-count').textContent = viewerCount;
  document.getElementById('users-count-info').textContent = `Total: ${total} user`;
}

function renderUsers() {
  const tbody = document.getElementById('users-table-body');
  let filtered = usersData;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(u =>
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-5 py-12 text-center text-[#A0A0A5]">
          <div class="flex flex-col items-center justify-center gap-2">
            <i data-lucide="user-x" class="w-8 h-8 text-[#A0A0A5]/40" aria-hidden="true"></i>
            <p class="font-medium text-white">Tidak ada data pengguna</p>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map((u, idx) => {
    const initial = (u.full_name || u.email || 'U').charAt(0).toUpperCase();
    const grad = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
    const roleBadge = getRoleBadge(u.role);
    const lastLoginText = formatTimeAgoWIB(u.last_sign_in_at);

    return `
      <tr class="table-row border-b border-white/5 hover:bg-white/[0.02] transition">
        <td class="px-5 py-3.5">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-gradient-to-br ${grad} grid place-items-center font-bold text-sm text-white shadow-sm">
              ${initial}
            </div>
            <div>
              <span class="font-medium text-white">${escapeHtml(u.full_name || u.email.split('@')[0])}</span>
            </div>
          </div>
        </td>
        <td class="px-5 py-3.5 text-[#A0A0A5]">${escapeHtml(u.email || '-')}</td>
        <td class="px-5 py-3.5">${roleBadge}</td>
        <td class="px-5 py-3.5">
          <span class="flex items-center gap-1.5 text-[#34C759] text-xs">
            <span class="w-2 h-2 bg-[#34C759] rounded-full"></span>
            Aktif
          </span>
        </td>
        <td class="px-5 py-3.5 text-[#A0A0A5] text-xs">${lastLoginText}</td>
        <td class="px-5 py-3.5 text-right">
          ${currentUserRole === 'OWNER' ? `
            <button onclick="openRoleModal('${u.id}')" title="Edit Role" aria-label="Edit Role ${escapeHtml(u.email)}" class="btn-edit-role p-1.5 hover:bg-white/10 rounded-lg text-[#32ADE6] transition">
              <i data-lucide="pencil" class="w-4 h-4" aria-hidden="true"></i>
            </button>
          ` : '<span class="text-[#A0A0A5]">-</span>'}
        </td>
      </tr>
    `;
  }).join('');

  if (window.syncTableLabels) window.syncTableLabels();
  if (window.lucide) lucide.createIcons();
}

function handleSearch(val) {
  searchQuery = val || '';
  renderUsers();
}

function openRoleModal(userId) {
  if (currentUserRole !== 'OWNER') return;

  const user = usersData.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('role-target-user-id').value = user.id;
  document.getElementById('role-target-user-name').value = user.full_name || user.email.split('@')[0];
  document.getElementById('role-target-user-email').value = user.email;
  document.getElementById('select-user-role').value = (user.role || 'staff').toLowerCase();

  const modal = document.getElementById('modal-user-role');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeRoleModal() {
  const modal = document.getElementById('modal-user-role');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function handleSaveRole(e) {
  e.preventDefault();
  if (currentUserRole !== 'OWNER') {
    showToast('Hanya OWNER yang dapat mengubah role pengguna', 'error');
    return;
  }

  const userId = document.getElementById('role-target-user-id').value;
  const newRole = document.getElementById('select-user-role').value;
  const user = usersData.find(u => u.id === userId);
  const email = user ? user.email : 'user';

  if (!userId || !newRole) return;

  const btn = document.getElementById('btn-save-user-role');
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Menyimpan...`;

  try {
    const res = await Api.users.updateRole(userId, newRole);
    if (!res.ok) {
      let rawMsg = res.error?.message || '';
      let errMsg = 'Gagal mengubah role';
      if (/only owner/i.test(rawMsg) || /hanya owner/i.test(rawMsg)) {
        errMsg = 'Hanya owner yang bisa ubah role';
      } else if (/demote the last owner/i.test(rawMsg) || /owner terakhir/i.test(rawMsg)) {
        errMsg = 'Tidak bisa demote owner terakhir';
      } else if (rawMsg) {
        errMsg = rawMsg;
      }
      showToast(errMsg, 'error');
      return;
    }
    showToast(`Role ${email} berhasil diubah`, 'success');
    closeRoleModal();
    await loadUsers();
  } catch (err) {
    let rawMsg = err.message || '';
    let errMsg = 'Terjadi kesalahan: ' + rawMsg;
    if (/only owner/i.test(rawMsg) || /hanya owner/i.test(rawMsg)) {
      errMsg = 'Hanya owner yang bisa ubah role';
    } else if (/demote the last owner/i.test(rawMsg) || /owner terakhir/i.test(rawMsg)) {
      errMsg = 'Tidak bisa demote owner terakhir';
    }
    showToast(errMsg, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Simpan Role`;
    if (window.lucide) lucide.createIcons();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function openCreateUserModal() {
  let role = String(currentUserRole || '').toUpperCase();
  if (role !== 'OWNER' && window.RBAC?.getUserRole) {
    try {
      const fetched = await window.RBAC.getUserRole();
      if (fetched) {
        currentUserRole = fetched;
        role = String(fetched).toUpperCase();
      }
    } catch (_) {}
  }

  if (role !== 'OWNER') {
    if (typeof showToast === 'function') {
      showToast('Hanya OWNER yang dapat menambah pengguna baru', 'warning');
    }
    return;
  }

  const modal = document.getElementById('modal-create-user');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  const emailInput = document.getElementById('new-user-email');
  if (emailInput) setTimeout(() => emailInput.focus(), 50);
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function closeCreateUserModal() {
  const modal = document.getElementById('modal-create-user');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function loadUsersFromBackend() {
  return loadUsers();
}

async function handleCreateUserSubmit(e) {
  e.preventDefault();
  let roleCheck = String(currentUserRole || '').toUpperCase();
  if (roleCheck !== 'OWNER' && window.RBAC?.getUserRole) {
    try {
      const r = await window.RBAC.getUserRole();
      if (r) {
        currentUserRole = r;
        roleCheck = String(r).toUpperCase();
      }
    } catch (_) {}
  }

  if (roleCheck !== 'OWNER') {
    showToast('Hanya OWNER yang dapat membuat pengguna baru', 'error');
    return;
  }

  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value;
  const full_name = document.getElementById('new-user-name').value.trim();
  const role = document.getElementById('new-user-role').value;
  
  if (password.length < 8) {
    showToast('Password minimal 8 karakter', 'error');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-create-user');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Menyimpan...`;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  try {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
      showToast('Sesi tidak valid', 'error');
      return;
    }
    
    let data;
    if (window.supabase.functions && typeof window.supabase.functions.invoke === 'function') {
      const { data: funcData, error: funcErr } = await window.supabase.functions.invoke('create-user', {
        body: { email, password, role: role.toLowerCase(), full_name }
      });
      if (funcErr) {
        showToast(funcErr.message || 'Gagal menambah user', 'error');
        return;
      }
      data = funcData;
    } else {
      const clientUrl = window.supabase.supabaseUrl || 'https://kvdktgknwxmqpankwpre.supabase.co';
      const clientKey = window.supabase.supabaseKey || '';
      const res = await fetch(
        `${clientUrl}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.access_token,
            'apikey': clientKey
          },
          body: JSON.stringify({ email, password, role: role.toLowerCase(), full_name })
        }
      );
      
      data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Gagal menambah user', 'error');
        return;
      }
    }
    
    showToast('User ' + email + ' berhasil ditambahkan', 'success');
    closeCreateUserModal();
    const form = document.getElementById('create-user-form');
    if (form) form.reset();
    await loadUsersFromBackend(); // reload tabel
  } catch (err) {
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml || `<i data-lucide="check" class="w-4 h-4"></i> Simpan`;
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  }
}

window.openCreateUserModal = openCreateUserModal;
window.closeCreateUserModal = closeCreateUserModal;
window.handleCreateUserSubmit = handleCreateUserSubmit;
window.loadUsersFromBackend = loadUsersFromBackend;
window.loadUsers = loadUsers;
window.openRoleModal = openRoleModal;
window.closeRoleModal = closeRoleModal;
window.handleSaveRole = handleSaveRole;
window.handleSearch = handleSearch;
window.handleSearchUsers = handleSearch;
window.initUsers = loadUsers;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeCreateUserModal();
    closeRoleModal();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadUsers);
} else {
  loadUsers();
}
