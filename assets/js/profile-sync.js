/**
 * ============================================================
 * SIPFAS - SINKRONISASI PROFIL PELAPOR
 * ============================================================
 * Sumber data utama:
 * DATABASE -> API PROFIL -> SELURUH ANTARMUKA PELAPOR
 *
 * File ini dipanggil pada setiap halaman Pelapor.
 * Nama, NIM, username, email, role, dan foto diambil dari API.
 * ============================================================
 */

(function () {
  "use strict";

  const script = document.currentScript;

  if (!script || !script.src) {
    console.error("SIPFAS: Lokasi profile-sync.js tidak ditemukan.");
    return;
  }

  const API_URL = new URL("../../api/user/profil.php", script.src).href;
  const LOGIN_URL = new URL("../../auth/Login.html", script.src).href;

  let currentProfile = null;
  let loadingPromise = null;

  // ---------------------------------------------------------
  // 1. MENYIAPKAN URL FOTO DARI PATH DATABASE
  // ---------------------------------------------------------

  function resolvePhoto(path) {
    if (!path || typeof path !== "string") return null;

    const value = path.trim();
    if (!value) return null;

    if (/^https?:\/\//i.test(value)) return value;
    if (/^(data:|blob:)/i.test(value)) return value;

    // Path database disimpan relatif dari folder utama SIPFASS.
    return new URL("../../" + value.replace(/^\/+/, ""), script.src).href;
  }

  // ---------------------------------------------------------
  // 2. MEMPERBARUI NAMA DAN IDENTITAS PENGGUNA
  // ---------------------------------------------------------

  function updateIdentity(profile) {
    const name = profile.nama_lengkap || profile.name || "Pengguna";
    const nim = profile.nomor_identitas || profile.nim || "-";
    const username = profile.username || "";
    const email = profile.email || "";
    const role = profile.role || "Pelapor";

    document
      .querySelectorAll(".header-name, .header-profile-name")
      .forEach((element) => {
        element.textContent = name;
      });

    document.querySelectorAll(".welcome-name").forEach((element) => {
      element.textContent = "Selamat Datang, " + name;
    });

    document.querySelectorAll(".identity-information h2").forEach((element) => {
      element.textContent = name;
    });

    const fields = {
      nama: name,
      nim: nim === "-" ? "" : nim,
      username: username,
      email: email,
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element && document.activeElement !== element) {
        element.value = value;
      }
    });

    document.querySelectorAll(".role-badge").forEach((element) => {
      element.textContent = role;
    });

    const identityNim = document.getElementById("identityNim");
    if (identityNim) {
      identityNim.textContent = "NIM: " + nim;
    }
  }

  // ---------------------------------------------------------
  // 3. MENYIAPKAN AVATAR HEADER DI SEMUA HALAMAN
  // ---------------------------------------------------------

  function getHeaderImages() {
    const images = new Set();

    document.querySelectorAll(".header-avatar").forEach((avatar) => {
      avatar.style.position = "relative";
      avatar.style.width = "33px";
      avatar.style.height = "33px";
      avatar.style.minWidth = "33px";
      avatar.style.minHeight = "33px";
      avatar.style.flex = "0 0 33px";
      avatar.style.overflow = "hidden";
      avatar.style.borderRadius = "50%";

      let image =
        avatar.querySelector("#headerProfileImage") ||
        avatar.querySelector(".sipfas-header-photo");

      if (!image) {
        image = document.createElement("img");
        image.className = "sipfas-header-photo";
        image.alt = "Foto Profil";
        image.hidden = true;
        avatar.appendChild(image);
      }

      image.style.position = "absolute";
      image.style.inset = "0";
      image.style.width = "100%";
      image.style.height = "100%";
      image.style.maxWidth = "100%";
      image.style.maxHeight = "100%";
      image.style.objectFit = "cover";
      image.style.borderRadius = "50%";
      image.style.zIndex = "2";

      images.add(image);
    });

    const profileImage = document.getElementById("profilePhotoImage");
    if (profileImage) images.add(profileImage);

    return Array.from(images);
  }

  // ---------------------------------------------------------
  // 4. MEMPERBARUI FOTO PROFIL DAN AVATAR HEADER
  // ---------------------------------------------------------

  function updatePhoto(profile) {
    const photoUrl = resolvePhoto(profile.foto_profil || profile.photo || "");

    const images = getHeaderImages();

    images.forEach((image) => {
      const isProfilePhoto = image.id === "profilePhotoImage";
      const container = isProfilePhoto
        ? document.getElementById("profilePhotoContainer")
        : image.closest(".header-avatar");

      const placeholder = isProfilePhoto
        ? document.getElementById("photoPlaceholder")
        : container?.querySelector("svg");

      if (!photoUrl) {
        image.hidden = true;
        image.removeAttribute("src");
        if (placeholder) placeholder.hidden = false;
        return;
      }

      image.onload = function () {
        image.hidden = false;
        image.style.display = "block";
        if (placeholder) placeholder.hidden = true;
      };

      image.onerror = function () {
        image.hidden = true;
        image.removeAttribute("src");
        if (placeholder) placeholder.hidden = false;
        console.error("SIPFAS: Foto profil gagal dimuat:", photoUrl);
      };

      // Parameter versi menghindari cache ketika foto diperbarui.
      const separator = photoUrl.includes("?") ? "&" : "?";
      image.src = photoUrl + separator + "v=" + Date.now();
    });
  }

  // ---------------------------------------------------------
  // 5. MEMPERBARUI SELURUH TAMPILAN PROFIL
  // ---------------------------------------------------------

  function renderProfile(profile) {
    if (!profile || !profile.id_pengguna) {
      throw new Error("Data profil dari server tidak lengkap.");
    }

    currentProfile = profile;

    updateIdentity(profile);
    updatePhoto(profile);

    window.dispatchEvent(
      new CustomEvent("sipfas:profile-loaded", {
        detail: { profile: profile },
      }),
    );
  }

  // ---------------------------------------------------------
  // 6. MENGAMBIL DATA PROFIL TERBARU DARI DATABASE
  // ---------------------------------------------------------

  async function loadProfile() {
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async function () {
      try {
        const response = await fetch(API_URL, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        let result;
        try {
          result = await response.json();
        } catch {
          throw new Error("Respons API profil bukan JSON yang valid.");
        }

        if (response.status === 401) {
          window.location.replace(LOGIN_URL);
          return null;
        }

        if (!response.ok || result.success !== true) {
          throw new Error(
            result.message || "Tidak dapat mengambil data profil.",
          );
        }

        renderProfile(result.data);
        return result.data;
      } catch (error) {
        console.error("SIPFAS PROFILE SYNC:", error);

        document.dispatchEvent(
          new CustomEvent("sipfas:profile-error", {
            detail: { message: error.message },
          }),
        );

        return null;
      } finally {
        loadingPromise = null;
      }
    })();

    return loadingPromise;
  }

  // ---------------------------------------------------------
  // 7. MEMUAT ULANG PROFIL SETELAH DATA DIPERBARUI
  // ---------------------------------------------------------

  window.addEventListener("sipfas:profile-updated", function (event) {
    if (event.detail && event.detail.profile) {
      renderProfile(event.detail.profile);
    } else {
      loadProfile();
    }
  });

  // ---------------------------------------------------------
  // 8. MENJALANKAN SINKRONISASI SAAT HALAMAN SIAP
  // ---------------------------------------------------------

  function start() {
    loadProfile();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  // ---------------------------------------------------------
  // 9. MENYEDIAKAN FUNGSI UNTUK MODUL PROFIL
  // ---------------------------------------------------------

  window.SIPFASProfile = {
    get: function () {
      return currentProfile;
    },
    refresh: loadProfile,
    resolvePhoto: resolvePhoto,
    getApiUrl: function () {
      return API_URL;
    },
  };
})();
