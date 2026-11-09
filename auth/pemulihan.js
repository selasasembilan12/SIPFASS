"use strict";

/* ============================================================
   SIPFAS - PEMULIHAN.JS
   Memvalidasi email dan membuat sesi OTP pemulihan akun.
============================================================ */

// 01. Menjalankan program setelah halaman selesai dimuat.
document.addEventListener("DOMContentLoaded", initializeRecovery);

// 02. Konfigurasi penyimpanan pemulihan akun.
const RECOVERY_CONFIG = {
  users: "sipfasUsers",
  email: "sipfasRecoveryEmail",
  otp: "sipfasRecoveryOtp",
  expiry: "sipfasRecoveryOtpExpiresAt",
  verified: "sipfasRecoveryVerified",
  attempts: "sipfasRecoveryAttempts",
  success: "sipfasPasswordResetSuccess",
  duration: 120000,
  maxAttempts: 3,
  nextPage: "verifikasi-otp-pemulihan.html",
};

// 03. Menginisialisasi halaman pemulihan.
function initializeRecovery() {
  const form = document.querySelector(".recovery-card form");
  const email = document.getElementById("email");

  if (!form || !email) {
    console.error("Form pemulihan tidak ditemukan.");
    return;
  }

  form.addEventListener("submit", processRecovery);

  email.addEventListener("input", function () {
    clearRecoveryError();
    showRecoveryMessage("");
  });
}

// 04. Membaca data akun terdaftar.
function readRecoveryUsers() {
  try {
    const data = localStorage.getItem(RECOVERY_CONFIG.users);

    if (!data) return [];

    const users = JSON.parse(data);

    return Array.isArray(users) ? users : null;
  } catch (error) {
    console.error("Gagal membaca data akun:", error);
    return null;
  }
}

// 05. Menghapus pesan kesalahan email.
function clearRecoveryError() {
  const error = document.getElementById("emailError");
  const input = document.getElementById("email");

  if (error) error.textContent = "";

  if (input) input.removeAttribute("aria-invalid");
}

// 06. Menampilkan pesan informasi.
function showRecoveryMessage(message, success = false) {
  const element = document.getElementById("formMessage");

  if (!element) return;

  element.textContent = message;

  element.style.color = success ? "#28734a" : "#dc4545";
}

// 07. Menampilkan kesalahan email.
function showRecoveryError(message) {
  const error = document.getElementById("emailError");
  const input = document.getElementById("email");

  if (error) error.textContent = message;

  if (input) {
    input.setAttribute("aria-invalid", "true");
    input.focus();
  }
}

// 08. Menghapus sesi pemulihan sebelumnya.
function clearRecoverySession() {
  const keys = [
    RECOVERY_CONFIG.email,
    RECOVERY_CONFIG.otp,
    RECOVERY_CONFIG.expiry,
    RECOVERY_CONFIG.verified,
    RECOVERY_CONFIG.attempts,
    RECOVERY_CONFIG.success,
  ];

  keys.forEach(function (key) {
    sessionStorage.removeItem(key);
  });
}

// 09. Membuat OTP simulasi delapan digit.
function generateRecoveryOTP() {
  const angka = new Uint32Array(1);

  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(angka);

    return String(10000000 + (angka[0] % 90000000));
  }

  return String(Math.floor(10000000 + Math.random() * 90000000));
}

// 10. Memproses permintaan pemulihan akun.
function processRecovery(event) {
  event.preventDefault();

  clearRecoveryError();
  showRecoveryMessage("");

  const emailInput = document.getElementById("email");
  const email = emailInput.value.trim().toLowerCase();

  // Memeriksa email kosong.
  if (!email) {
    showRecoveryError("Email wajib diisi.");
    return;
  }

  // Memeriksa format email.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showRecoveryError("Format email tidak valid.");
    return;
  }

  // Mengambil data akun.
  const users = readRecoveryUsers();

  if (users === null) {
    showRecoveryMessage("Data akun gagal dibaca.");
    return;
  }

  // Mencari email yang sesuai dengan akun terdaftar.
  const matched = users.find(function (user) {
    return (
      String(user.email || "")
        .trim()
        .toLowerCase() === email
    );
  });

  if (!matched) {
    showRecoveryMessage("Email tidak ditemukan dalam data akun.");
    return;
  }

  try {
    // Menghapus sesi pemulihan sebelumnya.
    clearRecoverySession();

    // Membuat OTP baru.
    const otpBaru = generateRecoveryOTP();

    // Menentukan waktu kedaluwarsa.
    const waktuKedaluwarsa = Date.now() + RECOVERY_CONFIG.duration;

    // Menyimpan seluruh data sesi OTP.
    sessionStorage.setItem(RECOVERY_CONFIG.email, email);

    sessionStorage.setItem(RECOVERY_CONFIG.otp, otpBaru);

    sessionStorage.setItem(RECOVERY_CONFIG.expiry, String(waktuKedaluwarsa));

    sessionStorage.setItem(
      RECOVERY_CONFIG.attempts,
      String(RECOVERY_CONFIG.maxAttempts),
    );

    // Menghapus status verifikasi sebelumnya.
    sessionStorage.removeItem(RECOVERY_CONFIG.verified);

    // Menampilkan informasi proses.
    showRecoveryMessage(
      "Email ditemukan. Mengalihkan ke verifikasi OTP...",
      true,
    );

    // Menonaktifkan tombol sementara.
    const button = document.querySelector(".submit-button");

    if (button) {
      button.disabled = true;
    }

    // Mengarahkan pengguna ke halaman OTP.
    setTimeout(function () {
      window.location.href = RECOVERY_CONFIG.nextPage;
    }, 600);
  } catch (error) {
    console.error("Kesalahan pemulihan akun:", error);

    showRecoveryMessage("Gagal memulai pemulihan kata sandi.");
  }
}
