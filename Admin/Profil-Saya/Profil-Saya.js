(() => {
  "use strict";

  /* =======================================================
     01. KONFIGURASI API
  ======================================================= */

  const API = {
    profile: "../../api/admin/profil-saya.php",
    photo: "../../api/shared/upload-foto-profil.php",
    password: "../../api/shared/update-password.php",
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);

  const $$ = (selector, parent = document) => [
    ...parent.querySelectorAll(selector),
  ];

  let profile = null;

  let photoUrl = "";

  // Foto yang dipilih tetapi belum disimpan.
  let pendingPhoto = null;

  // URL preview sementara.
  let previewObjectUrl = "";

  /* =======================================================
     02. NOTIFIKASI
  ======================================================= */

  function message(text, type = "success") {
    let box = $("#profile-feedback");

    if (!box) {
      box = document.createElement("div");

      box.id = "profile-feedback";

      const form = $(".profile-form");

      if (form) {
        form.insertAdjacentElement("beforebegin", box);
      } else {
        return;
      }
    }

    box.textContent = text;

    box.style.cssText = `
      padding:12px 15px;
      margin:12px 0;
      border-radius:8px;
      font-size:13px;
      background:${type === "success" ? "#ecfdf3" : "#fef2f2"};
      color:${type === "success" ? "#187444" : "#c62828"};
      border:1px solid ${type === "success" ? "#b7ebca" : "#fecaca"};
    `;
  }

  /* =======================================================
     03. REQUEST API
  ======================================================= */

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
    });

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error("Respons server tidak valid.");
    }

    if (!response.ok || result.success === false) {
      throw new Error(result.message || "Permintaan gagal.");
    }

    return result;
  }

  /* =======================================================
     04. KONVERSI PATH FOTO
  ======================================================= */

  function imagePath(path) {
    if (!path) return "";

    if (/^(https?:|data:|blob:)/i.test(path)) {
      return path;
    }

    return "../../" + String(path).replace(/^\.\//, "").replace(/^\//, "");
  }

  /* =======================================================
     05. MEMUAT PROFIL DARI DATABASE
  ======================================================= */

  function render(data) {
    profile = data || {};

    const name = profile.nama_lengkap || "Administrator";

    if ($("#nama")) {
      $("#nama").value = name;
    }

    if ($("#nip")) {
      $("#nip").value = profile.nomor_identitas || "";
    }

    if ($("#username")) {
      $("#username").value = profile.nama_pengguna || "";
    }

    if ($("#email")) {
      $("#email").value = profile.email || "";
    }

    if ($("#unit")) {
      $("#unit").value = profile.unit_kerja || "";
    }

    const heading = $(".profile-name-row h1");

    if (heading) {
      heading.textContent = name;
    }

    const nip = $(".profile-nip");

    if (nip) {
      nip.textContent = "NIP: " + (profile.nomor_identitas || "-");
    }

    $$(".topbar-user-name").forEach((element) => {
      element.textContent = name;
    });

    photoUrl = imagePath(profile.foto_profil || "");

    renderPhoto();

    // Sinkronisasi hanya ketika data server sudah berhasil dimuat.
    window.dispatchEvent(
      new CustomEvent("sipfas:admin-profile-updated", {
        detail: {
          name,
          foto_profil: profile.foto_profil || "",
        },
      }),
    );
  }

  async function loadProfile() {
    const result = await request(API.profile);

    render(result.data || result.user || {});
  }

  /* =======================================================
     06. RENDER FOTO PROFIL
  ======================================================= */

  function renderPhoto() {
    const avatar = $(".profile-avatar");

    if (!avatar) return;

    let img = $("img.profile-photo-image", avatar);

    if (!img) {
      img = document.createElement("img");

      img.className = "profile-photo-image";

      img.alt = "Foto profil";

      avatar.appendChild(img);
    }

    // Preview sementara lebih diprioritaskan.
    const displayPhoto = previewObjectUrl || photoUrl;

    if (displayPhoto) {
      img.src = displayPhoto;

      img.style.display = "block";
    } else {
      img.removeAttribute("src");

      img.style.display = "none";
    }
  }

  /* =======================================================
     07. PREVIEW FOTO SEMENTARA
     
     PENTING:
     Tidak ada request API pada tahap ini.
     Tidak ada perubahan database.
  ======================================================= */

  function selectPhoto(file) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      message("Gunakan foto JPG, PNG, atau WEBP.", "error");

      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      message("Ukuran foto maksimal 2 MB.", "error");

      return;
    }

    // Hapus preview lama jika ada.
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }

    // Simpan file hanya di memori browser.
    pendingPhoto = file;

    // Buat preview lokal.
    previewObjectUrl = URL.createObjectURL(file);

    renderPhoto();

    message(
      "Foto berhasil dipilih. Klik Simpan Perubahan untuk menyimpan foto profil.",
      "success",
    );
  }

  /* =======================================================
     08. SETUP TOMBOL GANTI FOTO
  ======================================================= */

  function setupPhoto() {
    const avatar = $(".profile-avatar");

    if (!avatar || $("#profile-photo-input")) return;

    const input = document.createElement("input");

    input.type = "file";

    input.id = "profile-photo-input";

    input.accept = "image/jpeg,image/png,image/webp";

    input.hidden = true;

    const button = document.createElement("button");

    button.type = "button";

    button.className = "admin-photo-edit-button";

    button.title = "Ubah Foto Profil";

    button.setAttribute("aria-label", "Ubah Foto Profil");

    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path>
      </svg>
    `;

    button.addEventListener("click", () => {
      input.click();
    });

    // Hanya preview, tidak upload.
    input.addEventListener("change", () => {
      selectPhoto(input.files?.[0]);

      input.value = "";
    });

    avatar.append(button, input);
  }

  /* =======================================================
     09. UPLOAD FOTO KE SERVER
     
     Fungsi ini hanya dipanggil saat tombol SIMPAN ditekan.
  ======================================================= */

  async function uploadPhoto() {
    if (!pendingPhoto) return;

    const form = new FormData();

    form.append("foto_profil", pendingPhoto);

    const result = await request(API.photo, {
      method: "POST",

      body: form,
    });

    return result;
  }

  /* =======================================================
     10. MENYIMPAN DATA PROFIL
  ======================================================= */

  async function saveProfile(event) {
    event?.preventDefault();

    const payload = {
      nama_lengkap: $("#nama")?.value.trim() || "",

      nama_pengguna: $("#username")?.value.trim() || "",

      email: $("#email")?.value.trim() || "",

      unit_kerja: $("#unit")?.value.trim() || "",
    };

    if (payload.nama_lengkap.length < 3) {
      return message("Nama lengkap minimal 3 karakter.", "error");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      return message("Format email tidak valid.", "error");
    }

    const saveButton = $(".save-button");

    if (saveButton) {
      saveButton.disabled = true;

      saveButton.textContent = "Menyimpan...";
    }

    try {
      // 1. Simpan informasi profil.
      await request(API.profile, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      });

      // 2. Upload foto hanya jika ada foto baru.
      if (pendingPhoto) {
        await uploadPhoto();
      }

      // 3. Bersihkan preview sementara.
      pendingPhoto = null;

      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);

        previewObjectUrl = "";
      }

      // 4. Ambil data terbaru dari database.
      await loadProfile();

      message(
        "Profil dan foto berhasil disimpan. Seluruh halaman Admin telah diperbarui.",
        "success",
      );
    } catch (error) {
      console.error("Gagal menyimpan profil:", error);

      message(error.message || "Gagal menyimpan perubahan profil.", "error");
    } finally {
      if (saveButton) {
        saveButton.disabled = false;

        saveButton.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="M5 3h12l4 4v14H3V3z"/>
            <path d="M7 3v6h10V3M7 21v-8h10v8"/>
          </svg>
          Simpan Perubahan
        `;
      }
    }
  }

  /* =======================================================
     11. TOGGLE PASSWORD
  ======================================================= */

  function setupPasswordToggle() {
    $$(".password-eye").forEach((eye) => {
      const input = eye.closest(".password-input")?.querySelector("input");

      if (!input) return;

      eye.addEventListener("click", () => {
        input.type = input.type === "password" ? "text" : "password";
      });
    });
  }

  /* =======================================================
     12. VALIDASI PASSWORD
  ======================================================= */

  async function changePasswordIfFilled() {
    const password = $("#password")?.value || "";

    const confirm = $("#confirm-password")?.value || "";

    if (!password && !confirm) return true;

    if (password.length < 8 || password !== confirm) {
      message(
        password.length < 8
          ? "Password baru minimal 8 karakter."
          : "Konfirmasi password tidak sama.",
        "error",
      );

      return false;
    }

    message(
      "Penggantian password memerlukan password lama. Fitur ini belum diaktifkan pada form saat ini.",
      "error",
    );

    return false;
  }

  /* =======================================================
     13. EVENT LISTENER
  ======================================================= */

  function setupEvents() {
    $(".profile-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!(await changePasswordIfFilled())) {
        return;
      }

      // Semua perubahan baru dikirim ketika tombol Simpan ditekan.
      await saveProfile(event);
    });
  }

  /* =======================================================
     14. INISIALISASI
  ======================================================= */

  async function init() {
    if (!$("#email")) return;

    setupPhoto();

    setupPasswordToggle();

    setupEvents();

    try {
      await loadProfile();

      console.log("[SIPFAS] Profil Admin berhasil dimuat.");
    } catch (error) {
      message(error.message + " Pastikan sesi login Admin aktif.", "error");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
