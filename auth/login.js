"use strict";

/* ============================================================
   SIPFAS - LOGIN.JS
   Sistem autentikasi berbasis PHP PDO, MariaDB, dan OTP
============================================================ */

const LOGIN_CONFIG = {
  apiUrl: "../api/auth/login.php",
  otpPage: "verifikasi.html",
};

let loginSubmitting = false;
let loginMessageTimer = null;

/* ============================================================
   01. NORMALISASI ROLE
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
   02. INISIALISASI
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

  console.log("[SIPFAS] Login berhasil diinisialisasi.");
}

/* ============================================================
   03. NOTIFIKASI
============================================================ */

function showLoginMessage(message, type = "error") {
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

  loginMessageTimer = setTimeout(function () {
    clearLoginMessage();
  }, 5000);
}

/* ============================================================
   04. HAPUS NOTIFIKASI
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
   05. VALIDASI INPUT
============================================================ */

function setupLoginFieldValidation() {
  const username = document.getElementById("username");
  const password = document.getElementById("password");
  const role = document.getElementById("jenisPengguna");

  [username, password, role].forEach(function (element) {
    if (!element) return;

    element.addEventListener("input", function () {
      clearPasswordError();
      clearLoginMessage();
    });

    element.addEventListener("change", function () {
      clearPasswordError();
      clearLoginMessage();
    });
  });
}

/* ============================================================
   06. INDIKATOR PASSWORD
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
   07. STATUS TOMBOL
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
   08. REQUEST LOGIN
============================================================ */

async function handleLogin(event) {
  event.preventDefault();

  if (loginSubmitting) return;

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const roleInput = document.getElementById("jenisPengguna");

  if (!usernameInput || !passwordInput || !roleInput) {
    showLoginMessage("Komponen formulir login tidak lengkap.", "error");
    return;
  }

  const identifier = usernameInput.value.trim();
  const password = passwordInput.value;
  const selectedRole = normalizeRole(roleInput.value);

  clearPasswordError();
  clearLoginMessage();

  if (!identifier || !password || !selectedRole) {
    showLoginMessage(
      "Username/email, password, dan jenis pengguna wajib diisi.",
      "error",
    );
    return;
  }

  if (identifier.length > 150) {
    showLoginMessage("Username atau email terlalu panjang.", "error");
    return;
  }

  if (password.length > 4096) {
    showLoginMessage("Password melebihi batas yang diperbolehkan.", "error");
    return;
  }

  loginSubmitting = true;
  setLoginButtonLoading(true);

  try {
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

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error("Respons server tidak valid. Periksa konfigurasi API.");
    }

    if (!response.ok || result.success !== true) {
      if (response.status === 401) {
        setPasswordError();
        passwordInput.value = "";
        passwordInput.focus();
      }

      throw new Error(
        result.message || "Login gagal. Periksa kembali data Anda.",
      );
    }

    if (!result.data || result.data.requires_otp !== true) {
      throw new Error("Server belum memberikan status verifikasi OTP.");
    }

    const redirect = result.data.redirect || LOGIN_CONFIG.otpPage;

    // Hanya izinkan halaman OTP yang telah ditentukan.
    if (redirect !== LOGIN_CONFIG.otpPage) {
      throw new Error("Tujuan verifikasi login tidak valid.");
    }

    showLoginMessage(
      "Login berhasil. Silakan lanjutkan verifikasi OTP.",
      "success",
    );

    // Jangan membuat session autentikasi di JavaScript.
    // Session sementara sepenuhnya dikelola oleh PHP.

    window.setTimeout(function () {
      window.location.assign(LOGIN_CONFIG.otpPage);
    }, 500);
  } catch (error) {
    console.error("[SIPFAS LOGIN ERROR]", error);

    showLoginMessage(
      error.message || "Terjadi kesalahan saat menghubungi server.",
      "error",
    );

    loginSubmitting = false;
    setLoginButtonLoading(false);
  }
}

/* ============================================================
   09. AKHIR LOGIN.JS
============================================================ */
