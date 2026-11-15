"use strict";

/* ============================================================
   SIPFAS - LOGIN.JS
   Login Pelapor, Petugas, dan Administrator.

   Fitur:
   1. Autentikasi username/email, password, dan role.
   2. Tampil/sembunyikan kata sandi.
   3. Indikator merah khusus pada password yang salah.
   4. Notifikasi top-center.
   5. Validasi perubahan input.
   6. Sinkronisasi akun dengan LocalStorage.
   7. Pengalihan menuju verifikasi OTP.
   8. Pembuatan akun Administrator otomatis.
   9. Pembuatan akun Petugas otomatis.
============================================================ */

/* 01. Menjalankan fungsi login setelah HTML selesai dimuat. */
document.addEventListener("DOMContentLoaded", initializeLogin);

/* 02. Konfigurasi penyimpanan autentikasi SIPFAS. */
const LOGIN_CONFIG = {
  userKey: "sipfasUsers",
  pendingKey: "sipfasPendingLogin",
  emailKey: "sipfasLoginEmail",
  otpKey: "sipfasLoginOtp",
  expiryKey: "sipfasLoginOtpExpiresAt",
  attemptsKey: "sipfasLoginAttempts",
  verifiedKey: "sipfasLoginVerified",
  activeKey: "sipfasActiveUser",
};

/* 03. Variabel notifikasi. */
let loginMessageTimer = null;

/* 04. Normalisasi role pengguna. */
function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();

  const roles = {
    pelapor: "pelapor",
    user: "pelapor",
    petugas: "petugas",
    admin: "administrator",
    administrator: "administrator",
  };

  return roles[value] || "";
}

/* ============================================================
   05. INISIALISASI HALAMAN LOGIN
============================================================ */

function initializeLogin() {
  // Membuat akun bawaan jika belum tersedia.
  ensureDefaultAccounts();

  const form = document.getElementById("loginForm");
  const password = document.getElementById("password");
  const toggle = document.getElementById("togglePassword");

  if (!form || !password) {
    console.error("Elemen form login tidak ditemukan.");
    return;
  }

  setupLoginFieldValidation();

  /* Fitur tampil/sembunyikan password. */
  if (toggle) {
    toggle.addEventListener("click", function () {
      const passwordVisible = password.type === "password";

      password.type = passwordVisible ? "text" : "password";

      toggle.innerHTML = passwordVisible
        ? `
          <svg viewBox="0 0 24 24"
               fill="none"
               aria-hidden="true">
            <path d="M3 3L21 21"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"/>
            <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"/>
            <path d="M9.9 5.2A10.5 10.5 0 0 1 12 5
                     c6.1 0 9.5 7 9.5 7
                     a16 16 0 0 1-3.1 3.8"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"/>
            <path d="M6.2 6.2A17 17 0 0 0 2.5 12
                     s3.4 7 9.5 7
                     c1.2 0 2.3-.2 3.3-.7"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"/>
          </svg>
        `
        : `
          <svg viewBox="0 0 24 24"
               fill="none"
               aria-hidden="true">
            <path d="M2.5 12s3.4-6 9.5-6
                     9.5 6 9.5 6
                     -3.4 6-9.5 6
                     -9.5-6-9.5-6Z"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="2.7"
                    stroke="currentColor"
                    stroke-width="1.8"/>
          </svg>
        `;

      toggle.setAttribute(
        "aria-label",
        passwordVisible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi",
      );

      password.focus();
    });
  }

  form.addEventListener("submit", handleLogin);

  console.log("[SIPFAS] Login berhasil diinisialisasi.");
}

/* ============================================================
   06. MENGAMBIL DATA AKUN DARI LOCALSTORAGE
============================================================ */

function getUsers() {
  try {
    const data = localStorage.getItem(LOGIN_CONFIG.userKey);

    if (!data) return [];

    const users = JSON.parse(data);

    return Array.isArray(users) ? users : null;
  } catch (error) {
    console.error("Gagal membaca data akun:", error);
    return null;
  }
}

/* ============================================================
   07. MEMBUAT AKUN ADMINISTRATOR DAN PETUGAS OTOMATIS

   Akun hanya dibuat jika username dan email belum tersedia.
   Akun lama tidak ditimpa.
============================================================ */

function ensureDefaultAccounts() {
  const users = getUsers();

  if (users === null) {
    console.error("Data pengguna tidak dapat dibaca.");
    return;
  }

  /* AKUN ADMINISTRATOR */
  const defaultAdmin = {
    id: "ADM-001",
    name: "Administrator SIPFAS",
    nim: "",
    username: "admin",
    email: "admin@sipfas.local",
    password: "admin123",
    role: "administrator",
    createdAt: new Date().toISOString(),
  };

  /* AKUN PETUGAS */
  const defaultPetugas = {
    id: "PTG-001",
    name: "Petugas SIPFAS",
    nim: "",
    username: "petugas",
    email: "petugas@sipfas.local",
    password: "petugas123",
    role: "petugas",
    createdAt: new Date().toISOString(),
  };

  const defaultAccounts = [defaultAdmin, defaultPetugas];

  let accountsAdded = 0;

  defaultAccounts.forEach(function (account) {
    const username = String(account.username).trim().toLowerCase();

    const email = String(account.email).trim().toLowerCase();

    const accountExists = users.some(function (user) {
      const existingUsername = String(user.username || "")
        .trim()
        .toLowerCase();

      const existingEmail = String(user.email || "")
        .trim()
        .toLowerCase();

      return existingUsername === username || existingEmail === email;
    });

    if (accountExists) {
      console.log("Akun sudah tersedia:", username);
      return;
    }

    users.push(account);
    accountsAdded++;
  });

  if (accountsAdded === 0) {
    console.log("Akun bawaan SIPFAS sudah tersedia.");
    return;
  }

  try {
    localStorage.setItem(LOGIN_CONFIG.userKey, JSON.stringify(users));

    console.log("[SIPFAS] Akun bawaan berhasil dibuat:", accountsAdded);
  } catch (error) {
    console.error("Gagal menyimpan akun bawaan:", error);
  }
}

/* ============================================================
   08. MENAMPILKAN NOTIFIKASI LOGIN TOP-CENTER
============================================================ */

function showLoginMessage(message, type = "error") {
  clearLoginMessage();

  const element = document.createElement("div");

  element.id = "loginMessage";
  element.className = "login-message " + type;

  element.setAttribute("role", type === "error" ? "alert" : "status");

  element.setAttribute("aria-live", "polite");
  element.setAttribute("aria-atomic", "true");

  const icon = document.createElement("span");

  icon.className = "login-message-icon";
  icon.setAttribute("aria-hidden", "true");

  const icons = {
    error: "!",
    success: "✓",
    info: "i",
  };

  icon.textContent = icons[type] || "i";

  const text = document.createElement("span");

  text.className = "login-message-text";
  text.textContent = message;

  element.append(icon, text);

  document.body.appendChild(element);
}

/* ============================================================
   09. MENGHAPUS NOTIFIKASI LOGIN
============================================================ */

function clearLoginMessage() {
  const message = document.getElementById("loginMessage");

  clearTimeout(loginMessageTimer);
  loginMessageTimer = null;

  if (message) {
    message.remove();
  }
}

/* ============================================================
   10. VALIDASI VISUAL PASSWORD
============================================================ */

function setPasswordError() {
  const password = document.getElementById("password");

  const wrapper = password?.closest(".input-wrapper");

  if (wrapper) {
    wrapper.classList.add("input-error");
  }
}

function clearPasswordError() {
  const password = document.getElementById("password");

  const wrapper = password?.closest(".input-wrapper");

  if (wrapper) {
    wrapper.classList.remove("input-error");
  }
}

/* ============================================================
   11. VALIDASI PERUBAHAN INPUT
============================================================ */

function setupLoginFieldValidation() {
  const username = document.getElementById("username");
  const password = document.getElementById("password");
  const role = document.getElementById("jenisPengguna");

  if (password) {
    password.addEventListener("input", function () {
      clearPasswordError();
      clearLoginMessage();
    });
  }

  if (username) {
    username.addEventListener("input", function () {
      clearPasswordError();
      clearLoginMessage();
    });
  }

  if (role) {
    role.addEventListener("change", function () {
      clearPasswordError();
      clearLoginMessage();
    });
  }
}

/* ============================================================
   12. MEMPROSES AUTENTIKASI PENGGUNA
============================================================ */

function handleLogin(event) {
  event.preventDefault();

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const roleInput = document.getElementById("jenisPengguna");

  const identifier = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const selectedRole = normalizeRole(roleInput.value);

  clearPasswordError();
  clearLoginMessage();

  /* Validasi formulir. */
  if (!identifier || !password || !selectedRole) {
    showLoginMessage(
      "Silakan lengkapi nama pengguna, kata sandi, dan jenis pengguna.",
      "error",
    );

    return;
  }

  /* Mengambil akun. */
  const users = getUsers();

  if (users === null) {
    showLoginMessage(
      "Data akun tidak dapat dibaca. Silakan muat ulang halaman.",
      "error",
    );

    return;
  }

  /* Mencocokkan username/email dan role. */
  const user = users.find((account) => {
    const username = String(account.username || "")
      .trim()
      .toLowerCase();

    const email = String(account.email || "")
      .trim()
      .toLowerCase();

    const accountRole = normalizeRole(account.role);

    return (
      (identifier === username || identifier === email) &&
      selectedRole === accountRole
    );
  });

  if (!user) {
    showLoginMessage(
      "Akun tidak ditemukan atau nama pengguna dan jenis pengguna tidak sesuai.",
      "error",
    );

    return;
  }

  /* Memeriksa password. */
  const correctPassword = password === String(user.password || "");

  if (!correctPassword) {
    setPasswordError();

    showLoginMessage(
      "Kata sandi yang Anda masukkan tidak sesuai. Silakan periksa kembali.",
      "error",
    );

    passwordInput.value = "";
    passwordInput.focus();

    return;
  }

  /* Menyiapkan identitas pengguna untuk OTP. */
  const pendingUser = {
    id: user.id || "",

    name: user.name || user.fullName || user.nama || "",

    username: user.username || "",

    email: user.email || "",

    role: normalizeRole(user.role),
  };

  try {
    /* Membersihkan sesi autentikasi sebelumnya. */
    [
      LOGIN_CONFIG.pendingKey,
      LOGIN_CONFIG.emailKey,
      LOGIN_CONFIG.otpKey,
      LOGIN_CONFIG.expiryKey,
      LOGIN_CONFIG.attemptsKey,
      LOGIN_CONFIG.verifiedKey,
    ].forEach((key) => sessionStorage.removeItem(key));

    /* Menyimpan identitas pengguna sementara. */
    sessionStorage.setItem(
      LOGIN_CONFIG.pendingKey,
      JSON.stringify(pendingUser),
    );

    sessionStorage.setItem(LOGIN_CONFIG.emailKey, pendingUser.email);

    showLoginMessage(
      "Login berhasil. Silakan lanjutkan verifikasi dua langkah.",
      "success",
    );

    /* Menonaktifkan tombol selama pengalihan. */
    const button = document.querySelector(".login-button");

    if (button) {
      button.disabled = true;

      const label = button.querySelector("span");

      if (label) {
        label.textContent = "Memproses...";
      }
    }

    /* Menuju halaman verifikasi OTP. */
    setTimeout(function () {
      window.location.href = "verifikasi.html";
    }, 500);
  } catch (error) {
    console.error("Kesalahan proses login:", error);

    showLoginMessage(
      "Gagal membuat sesi pengguna. Silakan coba kembali.",
      "error",
    );
  }
}
