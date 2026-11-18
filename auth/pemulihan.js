"use strict";

/* ============================================================
   SIPFAS - PEMULIHAN.JS
   Menghubungkan formulir pemulihan dengan database MySQL
   melalui API PHP.
============================================================ */

document.addEventListener("DOMContentLoaded", initializeRecovery);

const RECOVERY_CONFIG = {
  api: "../api/auth/pemulihan.php",
  nextPage: "verifikasi-otp-pemulihan.html",
};

let recoveryProcessing = false;

// ============================================================
// 01. INISIALISASI HALAMAN
// ============================================================

function initializeRecovery() {
  const form = document.getElementById("recoveryForm");
  const email = document.getElementById("email");

  if (!form || !email) {
    console.error("Form pemulihan tidak ditemukan.");
    return;
  }

  form.addEventListener("submit", processRecovery);

  email.addEventListener("input", function () {
    clearRecoveryError();
    hideRecoveryCard();
  });

  setRecoveryButton(false);

  console.log("Halaman pemulihan SIPFAS siap.");
}

// ============================================================
// 02. MEMBERSIHKAN PESAN ERROR
// ============================================================

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

// ============================================================
// 03. MENAMPILKAN NOTIFIKASI
// ============================================================

function showRecoveryCard(message, type) {
  const card = document.getElementById("recoveryAlert");
  const title = document.getElementById("recoveryAlertTitle");
  const description = document.getElementById("recoveryAlertMessage");
  const icon = document.getElementById("recoveryAlertIcon");

  // Notifikasi berhasil.
  if (type === "success") {
    if (card) {
      card.hidden = true;
      card.setAttribute("aria-hidden", "true");
    }

    const oldToast = document.getElementById("recoverySuccessToast");

    if (oldToast) {
      oldToast.remove();
    }

    const toast = document.createElement("div");

    toast.id = "recoverySuccessToast";
    toast.className = "recovery-toast";

    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    const toastIcon = document.createElement("div");
    toastIcon.className = "recovery-toast-icon";
    toastIcon.textContent = "✓";

    const content = document.createElement("div");
    content.className = "recovery-toast-content";

    const heading = document.createElement("strong");
    heading.textContent = "Permintaan Diproses";
    const paragraph = document.createElement("p");
    paragraph.textContent = message;

    content.append(heading, paragraph);
    toast.append(toastIcon, content);

    document.body.appendChild(toast);

    return;
  }

  // Menghapus notifikasi sukses sebelumnya.
  const oldToast = document.getElementById("recoverySuccessToast");

  if (oldToast) {
    oldToast.remove();
  }

  if (!card || !title || !description || !icon) {
    alert(message);
    return;
  }

  card.className = "recovery-alert " + type;

  if (type === "error") {
    title.textContent = "Pemulihan Gagal";
    icon.textContent = "!";
  } else {
    title.textContent = "Informasi Pemulihan";
    icon.textContent = "i";
  }

  description.textContent = message;

  card.hidden = false;
  card.setAttribute("aria-hidden", "false");

  card.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}

// ============================================================
// 04. MENYEMBUNYIKAN NOTIFIKASI
// ============================================================

function hideRecoveryCard() {
  const card = document.getElementById("recoveryAlert");

  if (card) {
    card.hidden = true;
    card.setAttribute("aria-hidden", "true");
  }

  const toast = document.getElementById("recoverySuccessToast");

  if (toast) {
    toast.remove();
  }
}

// ============================================================
// 05. MENGATUR TOMBOL SUBMIT
// ============================================================

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

// ============================================================
// 06. MENAMPILKAN ERROR INPUT EMAIL
// ============================================================

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

// ============================================================
// 07. MENGIRIM EMAIL KE BACKEND PHP
// ============================================================

async function processRecovery(event) {
  event.preventDefault();

  if (recoveryProcessing) return;

  clearRecoveryError();
  hideRecoveryCard();

  const emailInput = document.getElementById("email");

  if (!emailInput) return;

  const email = emailInput.value.trim().toLowerCase();

  // Validasi email kosong.
  if (!email) {
    showRecoveryError("Email wajib diisi.");
    return;
  }

  // Validasi format email.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showRecoveryError("Format email tidak valid.");
    return;
  }

  recoveryProcessing = true;
  setRecoveryButton(true);

  try {
    const response = await fetch(RECOVERY_CONFIG.api, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: email,
      }),
    });

    const result = await response.json();

    // Memeriksa respons backend.
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Pemulihan akun gagal diproses.");
    }

    // Menampilkan pesan berhasil.
    showRecoveryCard(
      result.message || "Email ditemukan. Silahkan lakukan verifikasi OTP.",
      "success",
    );

    // Mengambil alamat tujuan dari backend.
    const destination =
      result.data && result.data.redirect
        ? result.data.redirect
        : RECOVERY_CONFIG.nextPage;

    // Mengarahkan pengguna ke verifikasi OTP.
    setTimeout(function () {
      window.location.href = destination;
    }, 1200);
  } catch (error) {
    console.error("Kesalahan pemulihan SIPFAS:", error);

    showRecoveryCard(
      error.message || "Tidak dapat menghubungi server. Silakan coba kembali.",
      "error",
    );

    recoveryProcessing = false;
    setRecoveryButton(false);
  }
}
