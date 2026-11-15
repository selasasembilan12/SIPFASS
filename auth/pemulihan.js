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

// 03. Variabel notifikasi dan proses pengalihan.
let recoveryTimer = null;
let recoveryProcessing = false;

// 04. Menginisialisasi halaman pemulihan.
function initializeRecovery() {
  const form =
    document.getElementById("recoveryForm") ||
    document.querySelector(".recovery-card form");

  const email = document.getElementById("email");

  if (!form || !email) {
    console.error("Form pemulihan tidak ditemukan.");
    return;
  }

  const button = form.querySelector(".submit-button");

  // Mengaktifkan proses pemulihan.
  form.addEventListener("submit", processRecovery);

  // Menghapus notifikasi ketika email mulai diperbaiki.
  email.addEventListener("input", function () {
    clearRecoveryError();
    hideRecoveryCard();
    setRecoveryButton(false);

    recoveryProcessing = false;

    // Menghapus sesi OTP sebelumnya jika email berubah.
    clearRecoverySession();
  });

  // Memastikan tombol aktif saat halaman pertama dibuka.
  if (button) {
    button.disabled = false;

    const buttonText = button.querySelector("span");

    if (buttonText) {
      buttonText.textContent = "Kirim Kode Verifikasi";
    }
  }
}

// 05. Membaca data akun terdaftar.
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

// 06. Menghapus pesan kesalahan email.
function clearRecoveryError() {
  const error = document.getElementById("emailError");
  const input = document.getElementById("email");

  if (error) {
    error.textContent = "";
  }

  if (input) {
    input.removeAttribute("aria-invalid");
  }
}

// 07. Menampilkan notifikasi pemulihan.
function showRecoveryCard(message, type) {
  const card = document.getElementById("recoveryAlert");
  const title = document.getElementById("recoveryAlertTitle");
  const description = document.getElementById("recoveryAlertMessage");
  const icon = document.getElementById("recoveryAlertIcon");

  // Menghentikan timer notifikasi sebelumnya.
  clearTimeout(recoveryTimer);
  recoveryTimer = null;

  // ========================================================
  // NOTIFIKASI BERHASIL: BAGIAN ATAS TENGAH HALAMAN.
  // ========================================================

  if (type === "success") {
    // Menyembunyikan card notifikasi di bawah tombol.
    if (card) {
      card.hidden = true;
      card.setAttribute("aria-hidden", "true");
    }

    // Menghapus notifikasi sukses sebelumnya.
    const notifikasiLama = document.getElementById("recoverySuccessToast");

    if (notifikasiLama) {
      notifikasiLama.remove();
    }

    // Membuat elemen notifikasi sukses.
    const toast = document.createElement("div");

    toast.id = "recoverySuccessToast";
    toast.className = "recovery-toast";

    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");

    // Membuat ikon sukses.
    const toastIcon = document.createElement("div");

    toastIcon.className = "recovery-toast-icon";
    toastIcon.textContent = "✓";

    // Membuat konten notifikasi.
    const toastContent = document.createElement("div");

    toastContent.className = "recovery-toast-content";

    const toastTitle = document.createElement("strong");

    toastTitle.textContent = "Email Berhasil Ditemukan";

    const toastMessage = document.createElement("p");

    toastMessage.textContent = message;

    // Menggabungkan seluruh elemen.
    toastContent.append(toastTitle, toastMessage);

    toast.append(toastIcon, toastContent);

    // Menampilkan notifikasi di bagian atas halaman.
    document.body.appendChild(toast);

    return;
  }

  // ========================================================
  // NOTIFIKASI ERROR / INFORMASI: TETAP DI BAWAH TOMBOL.
  // ========================================================

  // Menghapus notifikasi sukses jika ada.
  const toast = document.getElementById("recoverySuccessToast");

  if (toast) {
    toast.remove();
  }

  // Menggunakan alert jika elemen card tidak tersedia.
  if (!card || !title || !description || !icon) {
    alert(message);
    return;
  }

  // Mengatur tampilan berdasarkan jenis notifikasi.
  card.className = "recovery-alert " + type;

  if (type === "error") {
    title.textContent = "Email Tidak Ditemukan";
    icon.textContent = "!";
  } else {
    title.textContent = "Informasi Pemulihan";
    icon.textContent = "i";
  }

  // Memasukkan keterangan notifikasi.
  description.textContent = message;

  // Menampilkan card.
  card.hidden = false;
  card.setAttribute("aria-hidden", "false");

  // Mengarahkan tampilan ke card notifikasi.
  card.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}

// 08. Menyembunyikan notifikasi pemulihan.
function hideRecoveryCard() {
  // Menghentikan timer pengalihan jika masih berjalan.
  clearTimeout(recoveryTimer);
  recoveryTimer = null;

  // Menyembunyikan card notifikasi di bawah tombol.
  const card = document.getElementById("recoveryAlert");

  if (card) {
    card.hidden = true;
    card.setAttribute("aria-hidden", "true");
  }

  // Menghapus notifikasi sukses di atas halaman.
  const toast = document.getElementById("recoverySuccessToast");

  if (toast) {
    toast.remove();
  }
}

// 09. Menghapus sesi pemulihan sebelumnya.
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

// 10. Membuat OTP simulasi delapan digit.
function generateRecoveryOTP() {
  const angka = new Uint32Array(1);

  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(angka);

    return String(10000000 + (angka[0] % 90000000));
  }

  return String(Math.floor(10000000 + Math.random() * 90000000));
}

// 11. Mengaktifkan atau menonaktifkan tombol.
function setRecoveryButton(disabled) {
  const button = document.querySelector(".submit-button");

  if (!button) return;

  button.disabled = disabled;

  const buttonText = button.querySelector("span");

  if (buttonText) {
    buttonText.textContent = disabled
      ? "Memproses..."
      : "Kirim Kode Verifikasi";
  }
}

// 12. Memproses permintaan pemulihan akun.
function processRecovery(event) {
  event.preventDefault();

  // Mencegah pengiriman berulang.
  if (recoveryProcessing) return;

  clearRecoveryError();
  hideRecoveryCard();

  const emailInput = document.getElementById("email");

  if (!emailInput) return;

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

  // Mengambil data akun terdaftar.
  const users = readRecoveryUsers();

  if (users === null) {
    showRecoveryCard("Data akun gagal dibaca. Silakan coba kembali.", "error");
    return;
  }

  // Mencari email dalam data registrasi.
  const matched = users.find(function (user) {
    return (
      user &&
      String(user.email || "")
        .trim()
        .toLowerCase() === email
    );
  });

  // Menampilkan card jika email tidak ditemukan.
  if (!matched) {
    showRecoveryCard(
      "Email yang Anda masukkan tidak terdaftar dalam data akun.",
      "error",
    );
    return;
  }

  try {
    // Menghapus sesi pemulihan sebelumnya.
    clearRecoverySession();

    // Membuat OTP baru.
    const otpBaru = generateRecoveryOTP();

    // Menentukan waktu kedaluwarsa.
    const waktuKedaluwarsa = Date.now() + RECOVERY_CONFIG.duration;

    // Menyimpan data sesi pemulihan.
    sessionStorage.setItem(RECOVERY_CONFIG.email, email);

    sessionStorage.setItem(RECOVERY_CONFIG.otp, otpBaru);

    sessionStorage.setItem(RECOVERY_CONFIG.expiry, String(waktuKedaluwarsa));

    sessionStorage.setItem(
      RECOVERY_CONFIG.attempts,
      String(RECOVERY_CONFIG.maxAttempts),
    );

    // Menghapus status verifikasi sebelumnya.
    sessionStorage.removeItem(RECOVERY_CONFIG.verified);

    // Menandai proses pemulihan sedang berjalan.
    recoveryProcessing = true;

    // Menampilkan notifikasi keberhasilan di atas tengah.
    showRecoveryCard(
      "Email terdaftar. Anda akan diarahkan ke halaman verifikasi OTP.",
      "success",
    );

    // Menonaktifkan tombol selama proses.
    setRecoveryButton(true);

    // Mengarahkan pengguna ke halaman verifikasi OTP.
    recoveryTimer = setTimeout(function () {
      window.location.href = RECOVERY_CONFIG.nextPage;
    }, 1200);
  } catch (error) {
    console.error("Kesalahan pemulihan akun:", error);

    // Membersihkan sesi jika proses penyimpanan gagal.
    clearRecoverySession();

    recoveryProcessing = false;

    // Mengaktifkan kembali tombol.
    setRecoveryButton(false);

    // Menampilkan card kesalahan.
    showRecoveryCard(
      "Gagal memulai pemulihan kata sandi. Silakan coba kembali.",
      "error",
    );
  }
}

// 13. Menampilkan kesalahan input email.
function showRecoveryError(message) {
  const error = document.getElementById("emailError");
  const input = document.getElementById("email");

  if (error) {
    error.textContent = message;
  }

  if (input) {
    input.setAttribute("aria-invalid", "true");
    input.focus();
  }
}
