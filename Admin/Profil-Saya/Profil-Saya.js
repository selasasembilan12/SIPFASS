/* ============================================================
   SIPFAS - PROFIL SAYA
   REVISI FINAL
   - Edit email
   - Ganti password
   - Sinkronisasi akun login
   - Foto profil
   - Logout
============================================================ */

(() => {
  "use strict";

  // 01. KONFIGURASI
  const CONFIG = {
    activeKey: "sipfasActiveUser",
    usersKey: "sipfasUsers",
    profileKey: "sipfasProfile",
    photoPrefix: "sipfasProfilePhoto_",
    loginURL: "../../auth/login.html",
    maxPhotoSize: 5 * 1024 * 1024,
    maxImageDimension: 500,
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);

  const $$ = (selector, parent = document) => [
    ...parent.querySelectorAll(selector),
  ];

  let activeUser = null;
  let currentPhoto = null;

  // 02. HELPER
  function normalize(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  }

  function accountIdentifier() {
    return String(
      activeUser?.id ||
        activeUser?.username ||
        activeUser?.email ||
        "administrator",
    );
  }

  function photoStorageKey() {
    return CONFIG.photoPrefix + accountIdentifier();
  }

  function showMessage(message, type = "success") {
    let element = $("#profile-feedback");

    if (!element) {
      element = document.createElement("div");
      element.id = "profile-feedback";

      const form = getProfileForm();

      if (form) {
        form.insertAdjacentElement("beforebegin", element);
      } else {
        document.body.appendChild(element);
      }
    }

    element.textContent = message;

    element.style.cssText = `
      padding: 12px 15px;
      margin: 12px 0;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.5;
      background: ${type === "success" ? "#ecfdf3" : "#fef2f2"};
      color: ${type === "success" ? "#187444" : "#c62828"};
      border: 1px solid ${type === "success" ? "#b7ebca" : "#fecaca"};
    `;

    element.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }

  function getProfileForm() {
    return (
      $("#profileForm") ||
      $(".profile-form") ||
      $("#profile-form") ||
      $("#email")?.closest("form") ||
      null
    );
  }

  // 03. MEMBACA DATA
  function getUsers() {
    try {
      const raw = localStorage.getItem(CONFIG.usersKey);

      if (!raw) return [];

      const users = JSON.parse(raw);

      return Array.isArray(users) ? users : null;
    } catch (error) {
      console.error("Gagal membaca akun:", error);
      return null;
    }
  }

  function getActiveUser() {
    try {
      const raw = sessionStorage.getItem(CONFIG.activeKey);

      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error("Gagal membaca sesi:", error);
      return null;
    }
  }

  // 04. MEMERIKSA LOGIN
  function initializeProfile() {
    activeUser = getActiveUser();

    if (!activeUser) {
      alert("Sesi login tidak ditemukan. Silakan login kembali.");
      window.location.replace(CONFIG.loginURL);
      return false;
    }

    currentPhoto = localStorage.getItem(photoStorageKey());

    return true;
  }

  // 05. MENCARI AKUN YANG SEDANG LOGIN
  function findAccount(users) {
    if (!Array.isArray(users) || !activeUser) return -1;

    // Prioritas pertama: ID akun.
    if (activeUser.id) {
      const index = users.findIndex(
        (user) => user.id && String(user.id) === String(activeUser.id),
      );

      if (index !== -1) return index;
    }

    // Prioritas kedua: username.
    if (activeUser.username) {
      const index = users.findIndex(
        (user) => normalize(user.username) === normalize(activeUser.username),
      );

      if (index !== -1) return index;
    }

    // Prioritas ketiga: email.
    if (activeUser.email) {
      return users.findIndex(
        (user) => normalize(user.email) === normalize(activeUser.email),
      );
    }

    return -1;
  }

  // 06. MENAMPILKAN IDENTITAS
  function renderProfile() {
    const users = getUsers() || [];
    const index = findAccount(users);
    const account = index >= 0 ? users[index] : {};

    const name =
      account.name ||
      account.fullName ||
      activeUser.name ||
      activeUser.fullName ||
      activeUser.nama ||
      "Administrator";

    const username = account.username || activeUser.username || "";

    const email = account.email || activeUser.email || "";

    // Menentukan jenis akun yang sedang login.
    const accountRole = normalize(account.role || activeUser.role);

    const isAdministrator =
      accountRole === "administrator" || accountRole === "admin";

    // NIP resmi Administrator.
    const ADMIN_NIP = "19880415 201404 1 002";

    // Mengambil NIP sesuai jenis pengguna.
    const nip =
      account.nim ||
      account.nip ||
      activeUser.nim ||
      activeUser.nip ||
      (isAdministrator ? ADMIN_NIP : "");

    if ($("#nama")) $("#nama").value = name;
    if ($("#nip")) $("#nip").value = nip;
    if ($("#username")) $("#username").value = username;
    if ($("#email")) $("#email").value = email;

    const heading = $(".profile-name-row h1");

    if (heading) heading.textContent = name;

    const nipElement = $(".profile-nip");

    if (nipElement) {
      // Menghapus teks NIP lama agar tidak tampil ganda.
      [...nipElement.childNodes].forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.remove();
        }
      });

      // Menampilkan satu NIP saja.
      nipElement.insertBefore(
        document.createTextNode("NIP: " + nip + " "),
        nipElement.firstChild,
      );
    }

    const topbarName = $(".topbar-user-name");

    if (topbarName) {
      topbarName.textContent = name;
    }

    updatePhotoDisplay();
  }

  // 07. MENYIMPAN PERUBAHAN PROFIL
  function saveProfile(event) {
    if (event) event.preventDefault();

    const nameInput = $("#nama");
    const emailInput = $("#email");
    const passwordInput = $("#password");
    const confirmInput = $("#confirm-password");

    if (!emailInput) {
      showMessage("Kolom email tidak ditemukan.", "error");
      return;
    }

    const newName = nameInput?.value.trim() || "";
    const newEmail = emailInput.value.trim();
    const newPassword = passwordInput?.value || "";
    const confirmPassword = confirmInput?.value || "";

    // VALIDASI NAMA LENGKAP
    if (!newName) {
      showMessage("Nama lengkap wajib diisi.", "error");
      nameInput.focus();
      return;
    }

    if (newName.length < 3) {
      showMessage("Nama lengkap minimal 3 karakter.", "error");
      nameInput.focus();
      return;
    }
    // VALIDASI EMAIL
    if (!newEmail) {
      showMessage("Email wajib diisi.", "error");
      emailInput.focus();
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(newEmail)) {
      showMessage("Format email tidak valid.", "error");
      emailInput.focus();
      return;
    }

    // VALIDASI PASSWORD
    if (newPassword || confirmPassword) {
      if (!newPassword || !confirmPassword) {
        showMessage("Isi password baru dan konfirmasi password.", "error");

        (!newPassword ? passwordInput : confirmInput)?.focus();
        return;
      }

      if (newPassword.length < 8) {
        showMessage("Password baru minimal 8 karakter.", "error");

        passwordInput.focus();
        return;
      }

      if (newPassword !== confirmPassword) {
        showMessage("Konfirmasi password tidak sama.", "error");

        confirmInput.focus();
        return;
      }
    }

    // AMBIL DATA AKUN
    const users = getUsers();

    if (users === null) {
      showMessage("Data akun tidak dapat dibaca.", "error");
      return;
    }

    const accountIndex = findAccount(users);

    if (accountIndex === -1) {
      showMessage(
        "Akun Administrator tidak ditemukan. Periksa data akun login.",
        "error",
      );
      return;
    }

    const account = users[accountIndex];

    // CEK EMAIL DUPLIKAT
    const duplicateEmail = users.some(
      (user, index) =>
        index !== accountIndex && normalize(user.email) === normalize(newEmail),
    );

    if (duplicateEmail) {
      showMessage("Email sudah digunakan oleh akun lain.", "error");

      emailInput.focus();
      return;
    }

    // MEMPERBARUI DATA AKUN
    // MEMPERBARUI DATA AKUN
    const updatedAccount = {
      ...account,
      name: newName,
      email: newEmail,
    };

    if (newPassword) {
      updatedAccount.password = newPassword;
    }

    const updatedUsers = [...users];

    updatedUsers[accountIndex] = updatedAccount;

    // MEMPERBARUI SESI
    const updatedSession = {
      ...activeUser,
      name: newName,
      email: newEmail,
    };

    // MEMPERBARUI DATA PROFIL
    let oldProfile = {};

    try {
      oldProfile = JSON.parse(localStorage.getItem(CONFIG.profileKey) || "{}");
    } catch (error) {
      oldProfile = {};
    }

    const updatedProfile = {
      ...oldProfile,
      ...updatedSession,
    };

    // SIMPAN DATA DAN VERIFIKASI HASIL
    try {
      localStorage.setItem(CONFIG.usersKey, JSON.stringify(updatedUsers));

      localStorage.setItem(CONFIG.profileKey, JSON.stringify(updatedProfile));

      sessionStorage.setItem(CONFIG.activeKey, JSON.stringify(updatedSession));

      // Baca ulang data akun yang baru disimpan.
      const verificationUsers = JSON.parse(
        localStorage.getItem(CONFIG.usersKey),
      );

      const savedAccount = verificationUsers.find(
        (user) =>
          String(user.id || "") === String(updatedAccount.id || "") &&
          normalize(user.username) === normalize(updatedAccount.username),
      );

      if (!savedAccount) {
        throw new Error("Akun tidak ditemukan setelah penyimpanan.");
      }

      if (newPassword && savedAccount.password !== newPassword) {
        throw new Error("Password baru gagal diverifikasi.");
      }

      if (savedAccount.email !== newEmail) {
        throw new Error("Email gagal diverifikasi.");
      }
      // Memastikan nama berhasil tersimpan.
      if (savedAccount.name !== newName) {
        throw new Error("Nama lengkap gagal diverifikasi.");
      }

      // PERBARUI DATA AKTIF
      activeUser = updatedSession;

      // KOSONGKAN INPUT PASSWORD
      if (passwordInput) passwordInput.value = "";
      if (confirmInput) confirmInput.value = "";

      renderProfile();

      showMessage(
        newPassword
          ? "Nama, email, dan password berhasil diperbarui."
          : "Nama dan email berhasil diperbarui.",
        "success",
      );
    } catch (error) {
      console.error("Kesalahan penyimpanan:", error);

      showMessage("Gagal menyimpan perubahan: " + error.message, "error");
    }
  }

  // 08. TOMBOL LIHAT PASSWORD
  function setupPasswordToggle() {
    $$(".password-eye").forEach((eye) => {
      const input = eye.closest(".password-input")?.querySelector("input");

      if (!input || eye.dataset.bound === "true") return;

      eye.dataset.bound = "true";

      function toggle() {
        const visible = input.type === "password";

        input.type = visible ? "text" : "password";

        eye.setAttribute(
          "aria-label",
          visible ? "Sembunyikan password" : "Tampilkan password",
        );
      }

      eye.addEventListener("click", toggle);

      eye.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      });
    });
  }

  // 09. KONTROL FOTO PROFIL
  function setupPhotoControls() {
    const avatar = $(".profile-avatar");

    if (!avatar || $("#profile-photo-input")) return;

    // Input file tersembunyi untuk memilih foto dari komputer.
    const input = document.createElement("input");

    input.type = "file";
    input.id = "profile-photo-input";
    input.accept = "image/jpeg,image/png,image/webp";
    input.hidden = true;

    // Tombol edit berbentuk lingkaran biru seperti Profil Pelapor.
    const editButton = document.createElement("button");

    editButton.type = "button";
    editButton.className = "admin-photo-edit-button";
    editButton.title = "Ubah Foto Profil";
    editButton.setAttribute("aria-label", "Ubah Foto Profil");

    editButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path>
      </svg>
    `;

    // Tombol dan input ditempatkan di dalam area avatar.
    avatar.appendChild(editButton);
    avatar.appendChild(input);

    // Membuka pemilih foto saat tombol pensil diklik.
    editButton.addEventListener("click", function () {
      input.click();
    });

    // Memproses foto yang dipilih.
    input.addEventListener("change", handlePhotoUpload);

    setupPhotoStyle();
  }

  // 10. UPLOAD FOTO
  async function handlePhotoUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showMessage("Gunakan foto JPG, PNG, atau WEBP.", "error");
      event.target.value = "";
      return;
    }

    if (file.size > CONFIG.maxPhotoSize) {
      showMessage("Ukuran foto maksimal 5 MB.", "error");
      event.target.value = "";
      return;
    }

    try {
      const image = await loadImage(file);

      const canvas = document.createElement("canvas");

      const ratio = Math.min(
        1,
        CONFIG.maxImageDimension / Math.max(image.width, image.height),
      );

      canvas.width = Math.round(image.width * ratio);
      canvas.height = Math.round(image.height * ratio);

      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);

      const photo = canvas.toDataURL("image/jpeg", 0.8);

      localStorage.setItem(photoStorageKey(), photo);

      currentPhoto = photo;

      updatePhotoDisplay();

      showMessage("Foto profil berhasil diperbarui.");
    } catch (error) {
      console.error(error);

      showMessage(
        "Foto gagal disimpan. Periksa kapasitas penyimpanan browser.",
        "error",
      );
    }

    event.target.value = "";
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Gambar tidak valid."));
      };

      image.src = url;
    });
  }

  // 11. MENAMPILKAN FOTO

  // 11. MENAMPILKAN FOTO PROFIL ADMIN
  function updatePhotoDisplay() {
    // Avatar utama ditangani di sini, header oleh admin-profile-sync.js.
    const avatar = $(".profile-avatar");

    if (!avatar) return;

    let image = $("img.profile-photo-image", avatar);

    if (!image) {
      image = document.createElement("img");
      image.className = "profile-photo-image";
      image.alt = "Foto profil";

      avatar.appendChild(image);
    }

    if (currentPhoto) {
      image.src = currentPhoto;
      image.style.display = "block";
      avatar.classList.add("has-profile-photo");
    } else {
      image.removeAttribute("src");
      image.style.display = "none";
      avatar.classList.remove("has-profile-photo");
    }
    window.dispatchEvent(new Event("sipfas:admin-profile-updated"));
  }

  // 12. HAPUS FOTO
  function removePhoto() {
    if (!currentPhoto) {
      showMessage("Belum ada foto profil.", "error");
      return;
    }

    if (!confirm("Apakah kamu yakin ingin menghapus foto profil?")) {
      return;
    }

    localStorage.removeItem(photoStorageKey());

    currentPhoto = null;

    updatePhotoDisplay();

    showMessage("Foto profil berhasil dihapus.");
  }

  // 13. CSS FOTO
  function setupPhotoStyle() {
    if ($("#profile-photo-style")) return;

    const style = document.createElement("style");

    style.id = "profile-photo-style";

    style.textContent = `
      .profile-avatar {
        position: relative;
        overflow: visible;
        flex-shrink: 0;
      }

      .profile-avatar img.profile-photo-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
        z-index: 2;
      }

      .admin-photo-edit-button {
        position: absolute;
        right: -5px;
        bottom: -5px;
        z-index: 4;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        background: #2864f0;
        border: 3px solid #ffffff;
        border-radius: 50%;
        color: #ffffff;
        cursor: pointer;
        transition: 0.2s;
      }

      .admin-photo-edit-button svg {
        width: 14px;
        height: 14px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .admin-photo-edit-button:hover {
        background: #1f56dc;
        transform: scale(1.08);
      }

      .profile-photo-controls {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 8px;
        margin: 12px 0;
      }

      .profile-photo-controls button {
        position: static !important;
        transform: none !important;
        padding: 8px 13px;
        border-radius: 7px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }

      .change-photo-btn {
        background: #2563eb;
        color: white;
        border: 1px solid #2563eb;
      }

      .remove-photo-btn {
        background: white;
        color: #dc4545;
        border: 1px solid #dc4545;
      }

      .password-eye {
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
    `;

    document.head.appendChild(style);
  }

  // 14. LOGOUT
  function logout() {
    [
      CONFIG.activeKey,
      "sipfasPendingLogin",
      "sipfasLoginEmail",
      "sipfasLoginOtp",
      "sipfasLoginOtpExpiresAt",
      "sipfasLoginAttempts",
      "sipfasLoginVerified",
    ].forEach((key) => sessionStorage.removeItem(key));

    window.location.replace(CONFIG.loginURL);
  }

  // 15. EVENT LISTENER
  function setupEvents() {
    const form = getProfileForm();

    if (form && form.dataset.profileBound !== "true") {
      form.dataset.profileBound = "true";
      form.addEventListener("submit", saveProfile);
    }

    // Dukungan tombol simpan yang bukan submit.
    const saveButtons = $$("#saveProfile, #btnSimpanProfil, .save-profile-btn");

    saveButtons.forEach((button) => {
      if (button.dataset.profileBound === "true") return;

      button.dataset.profileBound = "true";

      button.addEventListener("click", saveProfile);
    });

    // Logout.
    $$(
      ".sidebar-bottom a, .sidebar a.logout, a.logout, [data-action='logout']",
    ).forEach((link) => {
      if (link.dataset.logoutBound === "true") return;

      if (normalize(link.textContent).includes("keluar")) {
        link.dataset.logoutBound = "true";

        link.addEventListener("click", (event) => {
          event.preventDefault();
          logout();
        });
      }
    });

    // Sinkronisasi foto dari tab lain.
    window.addEventListener("storage", (event) => {
      if (event.key === photoStorageKey()) {
        currentPhoto = localStorage.getItem(photoStorageKey());
        updatePhotoDisplay();
      }
    });
  }

  // 16. INISIALISASI
  function initialize() {
    if (!$("#email")) return;

    if (!initializeProfile()) return;

    setupPhotoStyle();
    setupPhotoControls();
    setupPasswordToggle();
    renderProfile();
    setupEvents();

    console.log("[SIPFAS] Profil Saya berhasil dijalankan.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, {
      once: true,
    });
  } else {
    initialize();
  }
})();
