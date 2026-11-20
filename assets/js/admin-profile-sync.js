/* =========================================================
   SIPFAS - ADMIN PROFILE GLOBAL SYNC

   Fungsi:
   - Sinkronisasi nama Admin.
   - Sinkronisasi foto profil Admin.
   - Memperbarui avatar pada seluruh halaman Admin.
   - Mengambil data langsung dari API server.
   - Menggunakan URL root proyek secara otomatis.
========================================================= */

(() => {
  "use strict";

  /* =======================================================
     01. MENENTUKAN ROOT PROYEK
  ======================================================= */

  const script = document.currentScript;

  // Mengambil lokasi root proyek berdasarkan lokasi file JS.
  const PROJECT_ROOT = script?.src
    ? new URL("../../", script.src)
    : new URL("../../", window.location.href);

  /* =======================================================
     02. URL API PROFIL
  ======================================================= */

  const PROFILE_API = new URL("api/shared/profil-login.php", PROJECT_ROOT).href;

  /* =======================================================
     03. KONVERSI URL FOTO
  ======================================================= */

  function photoUrl(path) {
    if (!path) return "";

    const value = String(path).trim();

    if (/^(https?:|data:|blob:)/i.test(value)) {
      return value;
    }

    return new URL(value.replace(/^\/+/, ""), PROJECT_ROOT).href;
  }

  /* =======================================================
     04. SINKRONISASI PROFIL ADMIN
  ======================================================= */

  async function sync() {
    try {
      const response = await fetch(PROFILE_API, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API profil gagal (${response.status}).`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Gagal mengambil profil Admin.");
      }

      // Mendukung beberapa format response API.
      const user = result.user || result.data || {};

      const name = user.nama_lengkap || "Administrator";

      const photo = photoUrl(user.foto_profil || "");

      /* ===============================================
         05. UPDATE NAMA ADMIN
      =============================================== */

      document.querySelectorAll(".topbar-user-name").forEach((element) => {
        element.textContent = name;
      });

      /* ===============================================
         06. UPDATE FOTO PROFIL HEADER
      =============================================== */

      document.querySelectorAll(".topbar-user-avatar").forEach((avatar) => {
        let img = avatar.querySelector(".admin-header-photo");

        const icon = avatar.querySelector("svg");

        if (photo) {
          if (!img) {
            img = document.createElement("img");

            img.className = "admin-header-photo";

            img.alt = "Foto profil Admin";

            Object.assign(img.style, {
              width: "100%",

              height: "100%",

              objectFit: "cover",

              borderRadius: "50%",

              display: "block",
            });

            avatar.appendChild(img);
          }

          // Cache busting agar foto terbaru langsung terlihat.
          const separator = photo.includes("?") ? "&" : "?";

          img.src = photo + separator + "v=" + Date.now();

          if (icon) {
            icon.style.display = "none";
          }
        } else {
          if (img) {
            img.remove();
          }

          if (icon) {
            icon.style.display = "";
          }
        }
      });

      console.log("[SIPFAS] Profil Admin berhasil disinkronkan.");
    } catch (error) {
      console.error("[SIPFAS] Sinkronisasi profil Admin gagal:", error);
    }
  }

  /* =======================================================
     07. EVENT SINKRONISASI
  ======================================================= */

  // Saat halaman pertama kali dibuka.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sync, { once: true });
  } else {
    sync();
  }

  // Saat profil diperbarui dari halaman Profil Saya.
  window.addEventListener("sipfas:admin-profile-updated", sync);

  // Saat pengguna kembali ke halaman sebelumnya.
  window.addEventListener("pageshow", sync);
})();
