/* SIPFAS - Profil Admin: data profil dan foto tersimpan di MySQL/server. */
(() => {
  'use strict';
  const API = {
    profile: '../../api/admin/profil-saya.php',
    photo: '../../api/shared/upload-foto-profil.php',
    password: '../../api/shared/update-password.php'
  };
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  let profile = null;
  let photoUrl = '';

  function message(text, type = 'success') {
    let box = $('#profile-feedback');
    if (!box) {
      box = document.createElement('div'); box.id = 'profile-feedback';
      const form = $('.profile-form');
      if (form) form.insertAdjacentElement('beforebegin', box); else return;
    }
    box.textContent = text;
    box.style.cssText = `padding:12px 15px;margin:12px 0;border-radius:8px;font-size:13px;background:${type === 'success' ? '#ecfdf3' : '#fef2f2'};color:${type === 'success' ? '#187444' : '#c62828'};border:1px solid ${type === 'success' ? '#b7ebca' : '#fecaca'}`;
  }
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    let result;
    try { result = await response.json(); } catch { throw new Error('Respons server tidak valid.'); }
    if (!response.ok || result.success === false) throw new Error(result.message || 'Permintaan gagal.');
    return result;
  }
  function imagePath(path) {
    if (!path) return '';
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    return '../../' + String(path).replace(/^\.\//, '').replace(/^\//, '');
  }
  function render(data) {
    profile = data || {};
    const name = profile.nama_lengkap || 'Administrator';
    if ($('#nama')) $('#nama').value = name;
    if ($('#nip')) $('#nip').value = profile.nomor_identitas || '';
    if ($('#username')) $('#username').value = profile.nama_pengguna || '';
    if ($('#email')) $('#email').value = profile.email || '';
    if ($('#unit')) $('#unit').value = profile.unit_kerja || '';
    const heading = $('.profile-name-row h1'); if (heading) heading.textContent = name;
    const nip = $('.profile-nip'); if (nip) nip.textContent = 'NIP: ' + (profile.nomor_identitas || '-');
    $$('.topbar-user-name').forEach(el => el.textContent = name);
    photoUrl = imagePath(profile.foto_profil || '');
    renderPhoto();
    window.dispatchEvent(new CustomEvent('sipfas:admin-profile-updated', { detail: { name, foto_profil: profile.foto_profil || '' } }));
  }
  async function loadProfile() {
    const result = await request(API.profile);
    render(result.data || result.user || {});
  }
  async function saveProfile(event) {
    event?.preventDefault();
    const payload = {
      nama_lengkap: $('#nama')?.value.trim() || '',
      nama_pengguna: $('#username')?.value.trim() || '',
      email: $('#email')?.value.trim() || '',
      unit_kerja: $('#unit')?.value.trim() || ''
    };
    if (payload.nama_lengkap.length < 3) return message('Nama lengkap minimal 3 karakter.', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return message('Format email tidak valid.', 'error');
    try {
      const result = await request(API.profile, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      await loadProfile();
      message(result.message || 'Profil berhasil diperbarui.');
    } catch (error) { message(error.message, 'error'); }
  }
  function renderPhoto() {
    const avatar = $('.profile-avatar'); if (!avatar) return;
    let img = $('img.profile-photo-image', avatar);
    if (!img) { img = document.createElement('img'); img.className = 'profile-photo-image'; img.alt = 'Foto profil'; avatar.appendChild(img); }
    if (photoUrl) { img.src = photoUrl + (photoUrl.includes('?') ? '&' : '?') + 'v=' + Date.now(); img.style.display = 'block'; }
    else { img.removeAttribute('src'); img.style.display = 'none'; }
  }
  async function uploadPhoto(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return message('Gunakan foto JPG, PNG, atau WEBP.', 'error');
    if (file.size > 2 * 1024 * 1024) return message('Ukuran foto maksimal 2 MB.', 'error');
    const form = new FormData(); form.append('foto_profil', file);
    try {
      const result = await request(API.photo, { method: 'POST', body: form });
      await loadProfile(); message(result.message || 'Foto profil berhasil diperbarui.');
    } catch (error) { message(error.message, 'error'); }
  }
  function setupPhoto() {
    const avatar = $('.profile-avatar'); if (!avatar || $('#profile-photo-input')) return;
    const input = document.createElement('input'); input.type = 'file'; input.id = 'profile-photo-input'; input.accept = 'image/jpeg,image/png,image/webp'; input.hidden = true;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'admin-photo-edit-button'; button.title = 'Ubah Foto Profil'; button.setAttribute('aria-label', 'Ubah Foto Profil');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>';
    button.addEventListener('click', () => input.click()); input.addEventListener('change', () => { uploadPhoto(input.files?.[0]); input.value = ''; });
    avatar.append(button, input);
  }
  function setupPasswordToggle() {
    $$('.password-eye').forEach(eye => {
      const input = eye.closest('.password-input')?.querySelector('input'); if (!input) return;
      eye.addEventListener('click', () => { input.type = input.type === 'password' ? 'text' : 'password'; });
    });
  }
  async function changePasswordIfFilled() {
    const password = $('#password')?.value || '';
    const confirm = $('#confirm-password')?.value || '';
    if (!password && !confirm) return true;
    if (password.length < 8 || password !== confirm) { message(password.length < 8 ? 'Password baru minimal 8 karakter.' : 'Konfirmasi password tidak sama.', 'error'); return false; }
    message('Perubahan profil disimpan. Untuk mengganti password, API memerlukan password lama; form saat ini belum menyediakan kolom password lama.', 'error');
    return false;
  }
  function setupEvents() {
    $('.profile-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      if (!await changePasswordIfFilled()) return;
      await saveProfile(e);
    });
    const logout = $$('a.logout, [data-action="logout"], .sidebar-bottom a').find(a => /keluar|logout/i.test(a.textContent));
    logout?.addEventListener('click', () => { /* Logout dikelola endpoint autentikasi aplikasi. */ });
  }
  async function init() {
    if (!$('#email')) return;
    setupPhoto(); setupPasswordToggle(); setupEvents();
    try { await loadProfile(); }
    catch (error) { message(error.message + ' Pastikan sesi login Admin aktif.', 'error'); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
