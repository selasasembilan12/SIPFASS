"use strict";

/* ============================================================
   SIPFAS - VERIFIKASI OTP LOGIN
   OTP 8 digit | Berlaku 2 menit | Maksimal 3 percobaan
   Alur disamakan dengan verifikasi OTP pemulihan.
============================================================ */

const API = {
  send: "../api/auth/verifikasi.php",
  verify: "../api/auth/verifikasi.php",
  purpose: "Login",
};

let inputs = [];
let form = null;
let submit = null;
let resend = null;
let timer = null;
let notice = null;
let emailLabel = null;
let notification = null;

let expiry = 0;
let remaining = 3;
let busy = false;
let done = false;
let interval = null;
let redirectTimeout = null;
let messageTimeout = null;

let otpStateLoaded = false;
let expiryNotified = false;
let sessionAvailable = true;

document.addEventListener("DOMContentLoaded", initialize);

window.addEventListener("pagehide", function () {
  clearInterval(interval);
  clearTimeout(redirectTimeout);
  clearTimeout(messageTimeout);
});

// ============================================================
// 01. INISIALISASI
// ============================================================

function initialize() {
  form = document.getElementById("verificationForm");
  inputs = Array.from(document.querySelectorAll(".otp-input"));

  if (!form || inputs.length !== 8) {
    console.error("[SIPFAS] Form OTP tidak ditemukan.");
    return;
  }

  createVerificationComponents(form);

  submit = form.querySelector("button[type='submit']");
  resend = document.getElementById("resendButton");
  timer = document.getElementById("timer");
  notice = document.getElementById("demoOtpNotice");
  emailLabel = document.getElementById("maskedEmail");

  if (!submit || !resend || !timer || !notice || !notification) {
    console.error("[SIPFAS] Komponen OTP tidak lengkap.");
    return;
  }

  notice.textContent =
    "Kode OTP dikirim melalui email terdaftar. Maksimal 3 kali percobaan.";

  setupInputs();

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    verify();
  });

  resend.addEventListener("click", function (event) {
    event.preventDefault();

    if (!resend.disabled) {
      requestOTP("resend");
    }
  });

  interval = setInterval(render, 250);

  render();

  // Memeriksa status OTP dari database.
  requestOTP("ensure");

  console.log("[SIPFAS] Verifikasi OTP siap.");
}

// ============================================================
// 02. INPUT OTP
// ============================================================

function setupInputs() {
  function fill(value, start = 0) {
    const digits = String(value).replace(/\D/g, "").slice(0, 8);

    const offset = digits.length === 8 ? 0 : start;

    for (let i = offset; i < 8; i++) {
      inputs[i].value = "";
    }

    [...digits].forEach(function (digit, index) {
      if (inputs[offset + index]) {
        inputs[offset + index].value = digit;
      }
    });

    inputs[Math.min(offset + digits.length, 7)].focus();
  }

  inputs.forEach(function (input, index) {
    input.addEventListener("input", function () {
      if (busy || done || input.disabled) return;

      const digits = input.value.replace(/\D/g, "");

      if (digits.length > 1) {
        fill(digits, index);
        return;
      }

      input.value = digits.slice(0, 1);

      if (input.value && index < 7) {
        inputs[index + 1].focus();
      }
    });

    input.addEventListener("keydown", function (event) {
      if (busy || done || input.disabled) return;

      if (event.key === "Backspace" && !input.value && index > 0) {
        inputs[index - 1].focus();
      }

      if (event.key === "ArrowLeft" && index > 0) {
        inputs[index - 1].focus();
      }

      if (event.key === "ArrowRight" && index < 7) {
        inputs[index + 1].focus();
      }
    });

    input.addEventListener("paste", function (event) {
      if (busy || done || input.disabled) return;

      event.preventDefault();
      fill(event.clipboardData.getData("text"), index);
    });
  });
}

// ============================================================
// 03. TIMER DAN STATUS TOMBOL
// ============================================================

function render() {
  if (!timer || !submit || !resend) return;

  const seconds = Math.max(0, Math.ceil((expiry - Date.now()) / 1000));

  timer.textContent =
    String(Math.floor(seconds / 60)).padStart(2, "0") +
    ":" +
    String(seconds % 60).padStart(2, "0");

  timer.style.color = seconds <= 30 ? "#dc2626" : "#1558d6";

  timer.classList.toggle("expired", seconds === 0);

  // INPUT DIKUNCI KETIKA:
  // 1. Sedang memproses.
  // 2. Login sudah berhasil.
  // 3. OTP kedaluwarsa.
  // 4. Tiga percobaan sudah habis.
  // 5. Status OTP belum diperoleh dari server.

  const locked =
    busy ||
    done ||
    !otpStateLoaded ||
    !sessionAvailable ||
    seconds === 0 ||
    remaining === 0;

  inputs.forEach(function (input) {
    input.disabled = locked;
  });

  // TOMBOL VERIFIKASI.

  submit.disabled = locked;

  submit.style.setProperty(
    "background",
    locked ? "#b8c9e8" : "#2864f0",
    "important",
  );

  submit.style.setProperty("color", "#ffffff", "important");

  submit.style.setProperty(
    "cursor",
    locked ? "not-allowed" : "pointer",
    "important",
  );

  submit.style.setProperty("opacity", "1", "important");

  // TOMBOL KIRIM ULANG.
  // Berbeda dari sebelumnya:
  // Bisa aktif ketika 3 percobaan habis,
  // meskipun timer masih berjalan.

  const canResend =
    otpStateLoaded &&
    sessionAvailable &&
    !busy &&
    !done &&
    (remaining === 0 || seconds === 0);

  resend.disabled = !canResend;
  resend.style.opacity = canResend ? "1" : "0.5";
  resend.style.cursor = canResend ? "pointer" : "not-allowed";

  // NOTIFIKASI KEDALUWARSA.
  if (
    expiry > 0 &&
    seconds === 0 &&
    remaining > 0 &&
    otpStateLoaded &&
    !expiryNotified &&
    !done
  ) {
    expiryNotified = true;

    showMessage(
      "Masa berlaku kode OTP telah berakhir. Silakan kirim ulang kode untuk mendapatkan OTP baru.",
      "warning",
    );
  }
}

// ============================================================
// 04. REQUEST PHP
// ============================================================

async function post(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },

    body: JSON.stringify(payload),
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Respons server tidak valid. Periksa konfigurasi API PHP.");
  }

  return { response, result };
}

// ============================================================
// 05. MEMBUAT KOMPONEN
// ============================================================

function createVerificationComponents(form) {
  // INFORMASI OTP.

  let noticeElement = document.getElementById("demoOtpNotice");

  if (!noticeElement) {
    noticeElement = document.createElement("div");
    noticeElement.id = "demoOtpNotice";

    noticeElement.style.cssText = `
      margin: 16px auto;
      padding: 12px;
      background: #eef4ff;
      border: 1px dashed #9bb7e8;
      border-radius: 10px;
      text-align: center;
      color: #24436f;
      max-width: 400px;
      font-size: 14px;
    `;

    document.querySelector(".verification-heading")?.appendChild(noticeElement);
  }

  // TIMER.

  let timerRow = document.getElementById("timerRow");

  if (!timerRow) {
    timerRow = document.createElement("div");
    timerRow.id = "timerRow";

    timerRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 18px 0;
      padding: 12px 15px;
      background: #f2f6fc;
      border-radius: 10px;
      color: #526783;
      font-size: 14px;
    `;

    timerRow.innerHTML = `
      <span>Masa berlaku kode OTP</span>
      <strong id="timer">02:00</strong>
    `;

    form.insertBefore(timerRow, form.querySelector("button[type='submit']"));
  }

  // KIRIM ULANG.

  let resendRow = document.getElementById("resendRow");

  if (!resendRow) {
    resendRow = document.createElement("div");
    resendRow.id = "resendRow";

    resendRow.style.cssText = `
      text-align: center;
      margin: 20px 0;
      font-size: 14px;
      color: #526783;
    `;

    resendRow.innerHTML = `
      Tidak menerima kode?

      <button
        type="button"
        id="resendButton"
        disabled
        style="
          border: none;
          background: none;
          color: #2563eb;
          font-weight: 700;
          cursor: not-allowed;
          opacity: 0.5;
        "
      >
        Kirim Ulang Kode
      </button>
    `;

    form.insertAdjacentElement("afterend", resendRow);
  }

  // NOTIFIKASI.

  notification = document.getElementById("verificationMessage");

  if (!notification) {
    notification = document.createElement("div");
    notification.id = "verificationMessage";

    notification.innerHTML = `
      <div class="notification-icon"></div>

      <div class="notification-content">
        <strong class="notification-title"></strong>
        <span class="notification-text"></span>
      </div>
    `;

    document.body.appendChild(notification);
  }

  notification.setAttribute("aria-live", "polite");
  notification.setAttribute("role", "status");

  notification.style.zIndex = "999999";
}

// ============================================================
// 06. NOTIFIKASI
// ============================================================

function message(text, type = "error") {
  showMessage(text, type);
}

function showMessage(text, type = "error") {
  if (!notification || !document.body.contains(notification)) {
    notification = document.getElementById("verificationMessage");
  }

  if (!notification) {
    notification = document.createElement("div");
    notification.id = "verificationMessage";

    notification.innerHTML = `
      <div class="notification-icon"></div>
      <div class="notification-content">
        <strong class="notification-title"></strong>
        <span class="notification-text"></span>
      </div>
    `;

    document.body.appendChild(notification);
  }

  const config = {
    error: {
      title: "Verifikasi Gagal",
      background: "#fef2f2",
      border: "#fecaca",
      accent: "#dc2626",
      color: "#dc2626",
      icon: `
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 8v5"></path>
          <path d="M12 16h.01"></path>
        </svg>
      `,
    },

    warning: {
      title: "Perlu Perhatian",
      background: "#fff7ed",
      border: "#fed7aa",
      accent: "#ea580c",
      color: "#c2410c",
      icon: `
        <svg viewBox="0 0 24 24">
          <path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z"></path>
          <path d="M12 9v4"></path>
          <path d="M12 16h.01"></path>
        </svg>
      `,
    },

    success: {
      title: "Berhasil",
      background: "#ecfdf5",
      border: "#bbf7d0",
      accent: "#16a34a",
      color: "#15803d",
      icon: `
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="m8 12 3 3 5-6"></path>
        </svg>
      `,
    },

    info: {
      title: "Informasi Verifikasi",
      background: "#eff6ff",
      border: "#bfdbfe",
      accent: "#2563eb",
      color: "#1d4ed8",
      icon: `
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 11v5"></path>
          <path d="M12 8h.01"></path>
        </svg>
      `,
    },
  };

  const selected = config[type] || config.error;

  const icon = notification.querySelector(".notification-icon");
  const title = notification.querySelector(".notification-title");
  const description = notification.querySelector(".notification-text");

  if (!icon || !title || !description) {
    console.error("[SIPFAS] Struktur notifikasi tidak lengkap.");
    return;
  }

  icon.innerHTML = selected.icon;
  title.textContent = selected.title;
  description.textContent = text;

  notification.className = type;

  notification.style.cssText += `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 32px);
    max-width: 460px;
    min-height: 65px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 17px;
    background: ${selected.background};
    border: 1px solid ${selected.border};
    border-left: 4px solid ${selected.accent};
    border-radius: 10px;
    box-shadow: 0 8px 28px rgba(24,39,75,.15);
    color: ${selected.color};
    font-family: Inter, Arial, sans-serif;
    box-sizing: border-box;
    z-index: 999999;
    visibility: visible;
    opacity: 1;
    text-align: left;
  `;

  const content = notification.querySelector(".notification-content");

  content.style.cssText = `
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  `;

  icon.style.cssText = `
    width: 29px;
    height: 29px;
    min-width: 29px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: ${selected.accent};
    color: white;
  `;

  const svg = icon.querySelector("svg");

  if (svg) {
    svg.style.cssText = `
      width: 17px;
      height: 17px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    `;
  }

  title.style.cssText = `
    display: block;
    font-size: 13px;
    font-weight: 700;
  `;

  description.style.cssText = `
    display: block;
    font-size: 12px;
    line-height: 1.5;
  `;

  notification.setAttribute("role", type === "error" ? "alert" : "status");

  notification.style.display = "flex";
  notification.style.animation = "none";

  void notification.offsetWidth;

  notification.style.animation = "verificationToastIn .3s ease";

  clearTimeout(messageTimeout);

  messageTimeout = setTimeout(function () {
    notification.style.display = "none";
  }, 5000);
}

// ============================================================
// 07. MEMINTA OTP DAN KIRIM ULANG
// ============================================================

async function requestOTP(action) {
  if (busy || done || !sessionAvailable) return;

  // Kunci pengiriman hanya jika OTP masih aktif
  // DAN percobaan masih tersedia.

  if (action === "resend" && expiry > Date.now() && remaining > 0) {
    showMessage(
      "Kode OTP masih berlaku. Silakan gunakan kode yang telah dikirim.",
      "warning",
    );
    return;
  }

  busy = true;
  render();

  try {
    const { response, result } = await post(API.send, {
      tujuan: API.purpose,
      action: action,
    });

    const data = result.data || {};

    // Memperbarui status dari server.
    if (
      Number.isFinite(Number(data.expires_at)) &&
      Number(data.expires_at) > 0
    ) {
      expiry = Number(data.expires_at) * 1000;
    }

    if (Number.isInteger(data.remaining_attempts)) {
      remaining = Math.max(0, Math.min(3, data.remaining_attempts));
    }

    // RESPONS GAGAL.
    if (!response.ok || result.success !== true) {
      otpStateLoaded = true;

      if (response.status === 401) {
        sessionAvailable = false;
        expiry = 0;

        showMessage(
          result.message ||
            "Sesi login tidak ditemukan. Silakan login kembali.",
          "error",
        );

        return;
      }

      if (response.status === 410) {
        expiry = 0;
        remaining = 0;
        expiryNotified = true;

        showMessage(
          result.message ||
            "Kode OTP telah kedaluwarsa. Silakan kirim ulang kode.",
          "warning",
        );

        return;
      }

      if (response.status === 429) {
        // Jika batas percobaan habis,
        // kirim ulang harus langsung dapat digunakan.

        if (Number.isInteger(data.remaining_attempts)) {
          remaining = data.remaining_attempts;
        }

        if (remaining === 0) {
          showMessage(
            result.message ||
              "Batas 3 percobaan OTP tercapai. Silakan kirim ulang kode untuk mendapatkan OTP baru.",
            "warning",
          );
        } else {
          showMessage(
            result.message || "Batas pengiriman OTP tercapai.",
            "warning",
          );
        }

        return;
      }

      throw new Error(result.message || "OTP gagal diproses.");
    }

    // RESPONS BERHASIL.
    const deadline = Number(data.expires_at) * 1000;

    if (!Number.isFinite(deadline) || deadline <= Date.now()) {
      throw new Error("Masa berlaku OTP dari server tidak valid.");
    }

    expiry = deadline;

    remaining = Number.isInteger(data.remaining_attempts)
      ? Math.max(0, Math.min(3, data.remaining_attempts))
      : 3;

    expiryNotified = false;
    otpStateLoaded = true;

    if (emailLabel && typeof data.masked_email === "string") {
      emailLabel.textContent = data.masked_email;
    }

    inputs.forEach(function (input) {
      input.value = "";
    });

    if (action === "resend") {
      showMessage(
        "Kode OTP baru berhasil dikirim ke email Anda. Silakan periksa kotak masuk email.",
        "success",
      );
    } else {
      showMessage("Silakan masukkan 8 digit kode dari email Anda.", "info");
    }
  } catch (error) {
    console.error("[SIPFAS OTP SEND ERROR]", error);

    if (action === "ensure") {
      otpStateLoaded = true;
    }

    showMessage(error.message || "Tidak dapat terhubung ke server.", "error");
  } finally {
    busy = false;
    render();

    if (!inputs[0].disabled) {
      inputs[0].focus();
    }
  }
}

// ============================================================
// 08. VERIFIKASI OTP
// ============================================================

async function verify() {
  if (
    busy ||
    done ||
    !otpStateLoaded ||
    !sessionAvailable ||
    expiry <= Date.now() ||
    remaining === 0
  ) {
    return;
  }

  const otp = inputs
    .map(function (input) {
      return input.value;
    })
    .join("");

  // VALIDASI DELAPAN DIGIT.

  if (!/^\d{8}$/.test(otp)) {
    showMessage(
      "Masukkan seluruh 8 digit kode OTP sebelum melakukan verifikasi.",
      "warning",
    );
    return;
  }

  busy = true;
  render();

  try {
    const { response, result } = await post(API.verify, {
      action: "verify",
      otp: otp,
    });

    const data = result.data || {};

    // ========================================
    // A. OTP SALAH
    // ========================================

    if (!response.ok || result.success !== true) {
      if (Number.isInteger(data.remaining_attempts)) {
        remaining = Math.max(0, Math.min(3, data.remaining_attempts));
      }

      if (
        Number.isFinite(Number(data.expires_at)) &&
        Number(data.expires_at) > 0
      ) {
        expiry = Number(data.expires_at) * 1000;
      }

      inputs.forEach(function (input) {
        input.value = "";
      });

      // SESSION BERAKHIR.
      if (response.status === 401) {
        sessionAvailable = false;
        expiry = 0;

        showMessage(
          result.message || "Sesi login berakhir. Silakan login kembali.",
          "error",
        );

        return;
      }

      // OTP KEDALUWARSA.
      if (response.status === 410) {
        expiry = 0;
        remaining = 0;
        expiryNotified = true;

        showMessage(
          result.message ||
            "Kode OTP telah kedaluwarsa. Silakan kirim ulang kode.",
          "warning",
        );

        return;
      }

      // BATAS TIGA PERCOBAAN.
      if (response.status === 429 || remaining === 0) {
        remaining = 0;

        showMessage(
          "Batas percobaan OTP tercapai. Silakan kirim ulang kode untuk mendapatkan OTP baru.",
          "error",
        );

        return;
      }

      // OTP SALAH PERTAMA ATAU KEDUA.
      showMessage(
        (result.message || "Kode OTP salah.") +
          " Sisa percobaan: " +
          remaining +
          "/3.",
        "error",
      );

      return;
    }

    // ========================================
    // B. OTP BENAR
    // ========================================

    if (!data || typeof data.redirect !== "string") {
      throw new Error("Alamat Dashboard tidak ditemukan dalam respons server.");
    }

    const allowedRoutes = [
      "../Admin/Dashboard/Dashboard.html",
      "../Petugas/Dashboard/Dashboard.html",
      "../User/Dashboard/Dashboard/dashboard.html",
    ];

    if (!allowedRoutes.includes(data.redirect)) {
      throw new Error("Tujuan Dashboard tidak valid.");
    }

    done = true;

    clearInterval(interval);

    inputs.forEach(function (input) {
      input.disabled = true;
    });

    submit.disabled = true;
    resend.disabled = true;

    showMessage(
      "Selamat datang di SIPFAS! Anda berhasil masuk ke sistem.",
      "success",
    );

    redirectTimeout = setTimeout(function () {
      window.location.assign(data.redirect);
    }, 1800);
  } catch (error) {
    console.error("[SIPFAS OTP VERIFY ERROR]", error);

    showMessage(error.message || "Tidak dapat terhubung ke server.", "error");
  } finally {
    busy = false;

    if (!done) {
      render();

      if (!inputs[0].disabled) {
        inputs[0].focus();
      }
    }
  }
}
