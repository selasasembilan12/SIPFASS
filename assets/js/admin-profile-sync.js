/* Sinkronisasi nama dan foto profil Admin pada seluruh halaman Admin dari server. */
(() => {
  'use strict';
  const PROFILE_API = (function () {
    const script = document.currentScript;
    // File ini berada di assets/js/, sehingga ../../api/shared/profil-login.php
    // relatif terhadap halaman tidak dapat dipastikan; gunakan URL root proyek.
    return '../../api/shared/profil-login.php';
  })();
  function photoUrl(path) {
    if (!path) return '';
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    return '../../' + String(path).replace(/^\//, '');
  }
  async function sync() {
    try {
      const response = await fetch(PROFILE_API, { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) return;
      const user = result.user || result.data || {};
      const name = user.nama_lengkap || 'Administrator';
      const photo = photoUrl(user.foto_profil || '');
      document.querySelectorAll('.topbar-user-name').forEach(el => el.textContent = name);
      document.querySelectorAll('.topbar-user-avatar').forEach(avatar => {
        let img = avatar.querySelector('.admin-header-photo');
        const icon = avatar.querySelector('svg');
        if (photo) {
          if (!img) { img = document.createElement('img'); img.className = 'admin-header-photo'; img.alt = 'Foto profil admin'; Object.assign(img.style, { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }); avatar.appendChild(img); }
          img.src = photo + (photo.includes('?') ? '&' : '?') + 'v=' + Date.now(); if (icon) icon.style.display = 'none';
        } else { img?.remove(); if (icon) icon.style.display = ''; }
      });
    } catch (error) { console.error('[SIPFAS] Sinkronisasi profil Admin gagal:', error); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true }); else sync();
  window.addEventListener('sipfas:admin-profile-updated', sync);
  window.addEventListener('pageshow', sync);
})();
