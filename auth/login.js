"use strict";

/**
 * ============================================================
 * SIPFAS - LOGIN.JS
 * ============================================================
 *
 * Backend  : PHP PDO + MariaDB
 * Autentikasi: Password + OTP
 *
 * Fitur:
 * 1. Login berdasarkan username/email.
 * 2. Pemilihan role pengguna.
 * 3. Validasi password.
 * 4. Maksimal 5 kali login gagal.
 * 5. Notifikasi sisa percobaan.
 * 6. Countdown pemblokiran 15 menit.
 * 7. Tombol login dinonaktifkan saat diblokir.
 * 8. Tampil/sembunyikan password.
 * 9. Pengalihan ke halaman OTP.
 *
 * Catatan:
 * Validasi pemblokiran tetap dilakukan oleh PHP.
 * JavaScript hanya mengatur tampilan.
 *
 * ============================================================
 */

/* ============================================================
   01. KONFIGURASI
============================================================ */

const LOGIN_CONFIG = {
  apiUrl: "../api/auth/login.php",
  otpPage: "verifikasi.html",
  maxAttempts: 5,
};

let loginSubmitting = false;
let loginMessageTimer = null;
let lockoutTimer = null;

/* ============================================================
   02. NORMALISASI ROLE
============================================================ */

function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();

  const roleMap = {
    admin: "administrator",
    administrator: "administrator",

    petugas: "petugas",
    "petugas sarpras": "petugas",

    pelapor: "pelapor",
    user: "pelapor",
  };

  return roleMap[value] || "";
}

/* ============================================================
   03. INISIALISASI LOGIN
============================================================ */

document.addEventListener("DOMContentLoaded", initializeLogin);

function initializeLogin() {
  const form = document.getElementById("loginForm");

  const username = document.getElementById("username");

  const password = document.getElementById("password");

  const toggle = document.getElementById("togglePassword");

  if (!form || !username || !password) {
    console.error("[SIPFAS] Elemen formulir login tidak ditemukan.");

    return;
  }

  setupLoginFieldValidation();

  /* Tampil/sembunyikan password. */

  if (toggle) {
    toggle.addEventListener("click", function () {
      const visible = password.type === "password";

      password.type = visible ? "text" : "password";

      toggle.setAttribute(
        "aria-label",
        visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi",
      );

      toggle.setAttribute("aria-pressed", String(visible));

      password.focus();
    });
  }

  form.addEventListener("submit", handleLogin);

  console.log("[SIPFAS] Sistem login berhasil diinisialisasi.");
}

/* ============================================================
   04. NOTIFIKASI LOGIN
============================================================ */

function showLoginMessage(message, type = "error", duration = 5000) {
  clearLoginMessage();

  const element = document.createElement("div");

  element.id = "loginMessage";

  element.className = "login-message " + type;

  element.setAttribute("role", type === "error" ? "alert" : "status");

  element.setAttribute("aria-live", "polite");

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

  if (duration > 0) {
    loginMessageTimer = window.setTimeout(clearLoginMessage, duration);
  }
}

/* ============================================================
   05. MEMBERSIHKAN NOTIFIKASI
============================================================ */

function clearLoginMessage() {
  if (loginMessageTimer !== null) {
    clearTimeout(loginMessageTimer);

    loginMessageTimer = null;
  }

  const message = document.getElementById("loginMessage");

  if (message) {
    message.remove();
  }
}

/* ============================================================
   06. INDIKATOR PASSWORD SALAH
============================================================ */

function setPasswordError() {
  const password = document.getElementById("password");

  const wrapper = password ? password.closest(".input-wrapper") : null;

  if (wrapper) {
    wrapper.classList.add("input-error");
  }
}

function clearPasswordError() {
  const password = document.getElementById("password");

  const wrapper = password ? password.closest(".input-wrapper") : null;

  if (wrapper) {
    wrapper.classList.remove("input-error");
  }
}

/* ============================================================
   07. VALIDASI PERUBAHAN INPUT
============================================================ */

function setupLoginFieldValidation() {
  const username = document.getElementById("username");

  const password = document.getElementById("password");

  const role = document.getElementById("jenisPengguna");

  [username, password, role].forEach(function (element) {
    if (!element) return;

    element.addEventListener("input", function () {
      clearPasswordError();

      if (!lockoutTimer) {
        clearLoginMessage();
      }
    });

    element.addEventListener("change", function () {
      clearPasswordError();

      if (!lockoutTimer) {
        clearLoginMessage();
      }
    });
  });
}

/* ============================================================
   08. STATUS TOMBOL LOGIN
============================================================ */

function setLoginButtonLoading(loading) {
  const button = document.querySelector(".login-button");

  if (!button) return;

  const label = button.querySelector("span");

  button.disabled = loading;

  if (label) {
    label.textContent = loading ? "Memproses..." : "Masuk";
  }

  button.setAttribute("aria-busy", String(loading));
}

/* ============================================================
   09. MEMBACA RESPONS API
============================================================ */

async function readApiResponse(response) {
  const raw = await response.text();

  if (!raw.trim()) {
    console.error("[SIPFAS] Respons PHP kosong.", response.status);

    throw new Error(
      "Server tidak memberikan respons. Periksa konfigurasi PHP.",
    );
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("[SIPFAS] Respons bukan JSON:", raw.substring(0, 1000));

    throw new Error("Respons server tidak valid. Periksa error log PHP.");
  }
}

/* ============================================================
   10. COUNTDOWN PEMBLOKIRAN LOGIN
============================================================ */

function startLockoutCountdown(blockedUntil) {
  stopLockoutCountdown();

  const button = document.querySelector(".login-button");

  const label = button ? button.querySelector("span") : null;

  if (!button) return;

  const endTime = Number(blockedUntil) * 1000;

  if (!Number.isFinite(endTime) || endTime <= Date.now()) {
    return;
  }

  button.disabled = true;

  if (label) {
    label.textContent = "Akun Diblokir";
  }

  function updateCountdown() {
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));

    const minutes = Math.floor(remaining / 60);

    const seconds = remaining % 60;

    const timeText =
      String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");

    showLockoutNotice(
      "Akun diblokir sementara. Coba login kembali dalam " + timeText + ".",
    );

    if (remaining <= 0) {
      stopLockoutCountdown();

      button.disabled = false;

      if (label) {
        label.textContent = "Masuk";
      }

      showLoginMessage(
        "Masa pemblokiran berakhir. Silakan login kembali.",
        "success",
      );

      return;
    }
  }

  updateCountdown();

  lockoutTimer = window.setInterval(updateCountdown, 1000);
}

/* ============================================================
   11. NOTIFIKASI PEMBLOKIRAN
============================================================ */

function showLockoutNotice(message) {
  let element = document.getElementById("loginMessage");

  if (!element) {
    showLoginMessage(message, "error", 0);

    return;
  }

  const text = element.querySelector(".login-message-text");

  if (text) {
    text.textContent = message;
  }
}

/* ============================================================
   12. MENGHENTIKAN COUNTDOWN
============================================================ */

function stopLockoutCountdown() {
  if (lockoutTimer !== null) {
    clearInterval(lockoutTimer);

    lockoutTimer = null;
  }
}

/* ============================================================
   13. MEMPROSES LOGIN
============================================================ */

async function handleLogin(event) {
  event.preventDefault();

  if (loginSubmitting) return;

  // Mencegah pengiriman login ketika countdown aktif.
  if (lockoutTimer !== null) return;

  const usernameInput = document.getElementById("username");

  const passwordInput = document.getElementById("password");

  const roleInput = document.getElementById("jenisPengguna");

  if (!usernameInput || !passwordInput || !roleInput) {
    showLoginMessage("Komponen formulir login tidak lengkap.");

    return;
  }

  const identifier = usernameInput.value.trim();

  const password = passwordInput.value;

  const selectedRole = normalizeRole(roleInput.value);

  clearPasswordError();

  clearLoginMessage();

  /* ========================================================
     13.1. VALIDASI INPUT
  ======================================================== */

  if (!identifier || !password || !selectedRole) {
    showLoginMessage(
      "Username/email, password, dan jenis pengguna wajib diisi.",
    );

    return;
  }

  if (identifier.length > 150) {
    showLoginMessage("Username atau email terlalu panjang.");

    return;
  }

  if (password.length > 4096) {
    showLoginMessage("Password tidak valid.");

    return;
  }

  /* ========================================================
     13.2. MENGAKTIFKAN LOADING
  ======================================================== */

  loginSubmitting = true;

  setLoginButtonLoading(true);

  try {
    /* ====================================================
       13.3. MENGIRIM REQUEST KE PHP
    ==================================================== */

    const response = await fetch(LOGIN_CONFIG.apiUrl, {
      method: "POST",

      credentials: "same-origin",

      cache: "no-store",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        identifier: identifier,
        password: password,
        role: selectedRole,
      }),
    });

    /* ====================================================
       13.4. MEMBACA RESPONS
    ==================================================== */

    const result = await readApiResponse(response);

    /* ====================================================
       13.5. MENANGANI AKUN YANG DIBLOKIR
    ==================================================== */

    if (response.status === 429 && result.data?.blocked === true) {
      loginSubmitting = false;

      setLoginButtonLoading(false);

      startLockoutCountdown(result.data.blocked_until);

      return;
    }

    /* ====================================================
       13.6. MENANGANI PASSWORD SALAH
    ==================================================== */

    if (!response.ok || result.success !== true) {
      if (response.status === 401) {
        // Memberikan indikator password salah.
        setPasswordError();

        // Mengosongkan password sebelumnya.
        passwordInput.value = "";

        // Mengembalikan fokus ke kolom password.
        passwordInput.focus();

        const remaining = result.data?.remaining_attempts;

        if (Number.isInteger(remaining)) {
          showLoginMessage(
            "Password atau identitas salah. Sisa kesempatan login: " +
              remaining +
              " kali.",
            "error",
          );
        } else {
          showLoginMessage(
            result.message || "Username/email atau password salah.",
            "error",
          );
        }

        // PENTING:
        // Mengembalikan status login agar pengguna
        // dapat langsung mencoba memasukkan password lagi.

        loginSubmitting = false;

        setLoginButtonLoading(false);

        // Tidak menggunakan throw Error.
        // Langsung keluar dari fungsi.
        return;
      }

      throw new Error(result.message || "Login gagal. Silakan coba kembali.");
    }

    /* ====================================================
       13.7. MEMERIKSA STATUS OTP
    ==================================================== */

    if (!result.data || result.data.requires_otp !== true) {
      throw new Error("Server belum memberikan status verifikasi OTP.");
    }

    /* ====================================================
       13.8. MEMERIKSA ALAMAT OTP
    ==================================================== */

    const redirect = result.data.redirect || LOGIN_CONFIG.otpPage;

    if (redirect !== LOGIN_CONFIG.otpPage) {
      throw new Error("Alamat halaman verifikasi OTP tidak valid.");
    }

    /* ====================================================
       13.9. LOGIN BERHASIL
    ==================================================== */

    showLoginMessage(
      result.message || "OTP berhasil dikirim ke email Anda.",
      "success",
    );

    /* ====================================================
       13.10. MENGARAHKAN KE HALAMAN OTP
    ==================================================== */

    window.setTimeout(function () {
      window.location.assign(LOGIN_CONFIG.otpPage);
    }, 500);
  } catch (error) {
    console.error("[SIPFAS LOGIN ERROR]", error);

    showLoginMessage(
      error.message || "Terjadi kesalahan saat menghubungi server.",
      "error",
    );

    // Memastikan tombol kembali aktif
    // jika terjadi kesalahan koneksi atau server.

    loginSubmitting = false;

    setLoginButtonLoading(false);
  }
}
