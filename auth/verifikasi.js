"use strict";

// KONFIGURASI API: menentukan endpoint PHP untuk proses verifikasi OTP.
const API = {
  send: "../api/auth/verifikasi.php",
  verify: "../api/auth/verifikasi.php",
  purpose: "Login",
};

let inputs, form, submit, resend, timer, notice, emailLabel;
let expiry = 0;
let remaining = 3;
let busy = false;
let done = false;
let interval;

document.addEventListener("DOMContentLoaded", initialize);
window.addEventListener("pagehide", () => clearInterval(interval));

// 01. Menginisialisasi halaman, komponen OTP, dan permintaan kode pertama.
function initialize() {
  form = document.getElementById("verificationForm");
  inputs = Array.from(document.querySelectorAll(".otp-input"));

  if (!form || inputs.length !== 8) return;

  createVerificationComponents(form);

  submit = form.querySelector("button[type='submit']");
  resend = document.getElementById("resendButton");
  timer = document.getElementById("timer");
  notice = document.getElementById("demoOtpNotice");
  emailLabel = document.querySelector(".email-badge span");

  if (!submit || !resend || !timer || !notice) return;

  notice.textContent = "Kode OTP dikirim melalui email terdaftar.";

  if (emailLabel) emailLabel.textContent = "Email terdaftar";

  sessionStorage.removeItem("sipfasLoginOtp");
  sessionStorage.removeItem("sipfasLoginVerified");

  setupInputs();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    verify();
  });

  resend.addEventListener("click", () => requestOTP("resend"));

  interval = setInterval(render, 250);

  requestOTP("ensure");
}

// 02. Mengatur input OTP, perpindahan fokus, penghapusan, dan paste kode.
function setupInputs() {
  const fill = (value, start = 0) => {
    const digits = String(value).replace(/\D/g, "").slice(0, 8);
    const offset = digits.length === 8 ? 0 : start;

    [...digits].forEach((digit, i) => {
      if (inputs[offset + i]) inputs[offset + i].value = digit;
    });

    inputs[Math.min(offset + digits.length, 7)].focus();
  };

  inputs.forEach((input, index) => {
    input.addEventListener("input", () => {
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

    input.addEventListener("keydown", (event) => {
      if (
        (event.key === "ArrowLeft" ||
          (event.key === "Backspace" && !input.value)) &&
        index > 0
      ) {
        inputs[index - 1].focus();
      }

      if (event.key === "ArrowRight" && index < 7) {
        inputs[index + 1].focus();
      }
    });

    input.addEventListener("paste", (event) => {
      event.preventDefault();
      fill(event.clipboardData.getData("text"), index);
    });
  });
}

// 03. Memperbarui timer dan mengatur status aktif setiap komponen.
function render() {
  if (!timer || !submit || !inputs || !resend) return;

  const seconds = Math.max(0, Math.ceil((expiry - Date.now()) / 1000));

  timer.textContent =
    String(Math.floor(seconds / 60)).padStart(2, "0") +
    ":" +
    String(seconds % 60).padStart(2, "0");

  timer.classList.toggle("expired", seconds === 0);

  timer.style.color = seconds <= 30 ? "#dc4545" : "#1558d6";

  const disabled = busy || done || seconds === 0 || remaining === 0;

  inputs.forEach((input) => {
    input.disabled = disabled;
  });

  submit.disabled = disabled;

  resend.disabled = busy || done || seconds > 0;

  resend.style.opacity = resend.disabled ? "0.5" : "1";

  resend.style.cursor = resend.disabled ? "not-allowed" : "pointer";
}

// 04. Mengirim permintaan JSON ke server dengan session PHP yang sama.
async function post(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
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

// 05. Menampilkan notifikasi berdasarkan hasil proses OTP.
function message(text, type = "error") {
  showMessage(text, type);
}

// 06. Memastikan OTP tersedia atau mengirim kode baru melalui email.
async function requestOTP(action) {
  if (busy || done || (action === "resend" && expiry > Date.now())) {
    return;
  }

  busy = true;
  render();

  try {
    const { response, result } = await post(API.send, {
      tujuan: API.purpose,
      action,
    });

    if (!response.ok || result.success !== true) {
      throw new Error(result.message || "OTP gagal dikirim.");
    }

    const data = result.data || result;
    const deadline = Number(data.expires_at) * 1000;

    if (!Number.isFinite(deadline) || deadline <= Date.now()) {
      throw new Error("Masa berlaku OTP dari server tidak valid.");
    }

    expiry = deadline;

    remaining = Number.isInteger(data.remaining_attempts)
      ? Math.max(0, Math.min(3, data.remaining_attempts))
      : 3;

    if (emailLabel && typeof data.masked_email === "string") {
      emailLabel.textContent = data.masked_email;
    }

    inputs.forEach((input) => {
      input.value = "";
    });

    message("Masukkan kode OTP yang dikirim ke email Anda.", "info");
  } catch (error) {
    message(error.message || "Tidak dapat terhubung ke server.");
  } finally {
    busy = false;
    render();

    if (!inputs[0].disabled) {
      inputs[0].focus();
    }
  }
}

// 07. Memvalidasi OTP melalui database dan membaca redirect dari respons server.
// Memverifikasi OTP dan mengirimkan notifikasi setelah berhasil login.
async function verify() {
  if (busy || done || expiry <= Date.now() || remaining === 0) return;

  const otp = inputs.map((input) => input.value).join("");

  if (!/^\d{8}$/.test(otp)) {
    message("Masukkan seluruh 8 digit kode OTP.");
    return;
  }

  busy = true;
  render();

  try {
    const { response, result } = await post(API.verify, {
      action: "verify",
      otp,
    });

    if (!response.ok || result.success !== true) {
      if (Number.isInteger(result.remaining_attempts)) {
        remaining = Math.max(0, Math.min(3, result.remaining_attempts));
      }

      if ([410, 401, 409].includes(response.status)) {
        expiry = 0;
      }

      if (response.status === 429) {
        remaining = 0;
      }

      inputs.forEach((input) => {
        input.value = "";
      });

      message(result.message || "Verifikasi gagal.");
      return;
    }

    const allowed = [
      "../Admin/Dashboard/Dashboard.html",
      "../Petugas/Dashboard/Dashboard.html",
      "../User/Dashboard/Dashboard/dashboard.html",
    ];

    if (!allowed.includes(result.data?.redirect || result.redirect)) {
      throw new Error("Tujuan halaman dari server tidak valid.");
    }

    const redirect = result.data?.redirect || result.redirect;
    const user = result.data?.user || result.user || {};

    // Menyimpan notifikasi agar muncul setelah Dashboard terbuka.
    sessionStorage.setItem(
      "sipfasLoginNotification",
      JSON.stringify({
        type: "success",
        title: "Login Berhasil!",
        message:
          "Selamat datang, " +
          (user.nama_lengkap || "Pengguna") +
          "! Anda berhasil masuk ke SIPFAS.",
        createdAt: Date.now(),
      }),
    );

    done = true;
    clearInterval(interval);

    // Mengarahkan pengguna ke Dashboard sesuai role.
    window.location.assign(redirect);
  } catch (error) {
    message(error.message || "Tidak dapat terhubung ke server.");
  } finally {
    busy = false;
    render();

    if (!inputs[0].disabled) {
      inputs[0].focus();
    }
  }
}

// 08. Membuat komponen timer, tombol kirim ulang, dan notifikasi OTP.
function createVerificationComponents(form) {
  let notice = document.getElementById("demoOtpNotice");

  if (!notice) {
    notice = document.createElement("div");
    notice.id = "demoOtpNotice";

    notice.style.cssText = `
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

    const heading = document.querySelector(".verification-heading");

    if (heading) heading.appendChild(notice);
  }

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
      <strong id="timer" style="color:#1558d6;font-size:16px;">
        02:00
      </strong>
    `;

    form.insertBefore(timerRow, form.querySelector("button[type='submit']"));
  }

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
        style="
          border: none;
          background: none;
          color: #2563eb;
          font-weight: 700;
          cursor: not-allowed;
          opacity: 0.5;
        "
        disabled
      >
        Kirim Ulang Kode
      </button>
    `;

    form.insertAdjacentElement("afterend", resendRow);
  }

  let messageElement = document.getElementById("verificationMessage");

  if (!messageElement) {
    messageElement = document.createElement("div");
    messageElement.id = "verificationMessage";

    messageElement.setAttribute("role", "status");
    messageElement.setAttribute("aria-live", "polite");

    messageElement.innerHTML = `
      <div class="notification-icon"></div>
      <div class="notification-content">
        <strong class="notification-title"></strong>
        <span class="notification-text"></span>
      </div>
    `;

    messageElement.style.display = "none";

    resendRow.insertAdjacentElement("afterend", messageElement);
  }
}

// 09. Menampilkan notifikasi keberhasilan, informasi, atau kesalahan OTP.
function showMessage(message, type = "error", customTitle = "") {
  const element = document.getElementById("verificationMessage");

  if (!element) return;

  const titles = {
    error: "Kode OTP tidak sesuai",
    warning: "Perlu perhatian",
    success: "Verifikasi berhasil",
    info: "Informasi verifikasi",
  };

  const icons = {
    error: `
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 8v5"></path>
        <path d="M12 16h.01"></path>
      </svg>
    `,
    warning: `
      <svg viewBox="0 0 24 24">
        <path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z"></path>
        <path d="M12 9v4"></path>
        <path d="M12 16h.01"></path>
      </svg>
    `,
    success: `
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="m8 12 3 3 5-6"></path>
      </svg>
    `,
    info: `
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 11v5"></path>
        <path d="M12 8h.01"></path>
      </svg>
    `,
  };

  element.className = type;

  const icon = element.querySelector(".notification-icon");

  if (icon) {
    icon.innerHTML = icons[type] || icons.error;
  }

  const title = element.querySelector(".notification-title");

  if (title) {
    title.textContent = customTitle || titles[type] || titles.error;
  }

  const text = element.querySelector(".notification-text");

  if (text) {
    text.textContent = message;
  }

  element.style.display = "flex";
}
