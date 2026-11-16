"use strict";

// SIPFAS - Verifikasi OTP Pemulihan melalui PHP.
// Kontrak pengiriman: POST verifikasi-otp-pemulihan.php {tujuan, action: "ensure"|"resend"}.
// Respons sukses: {success:true, expires_at: <Unix detik>, masked_email: "...", remaining_attempts: 3}.
// Server harus memvalidasi sesi, mengirim OTP, dan tidak mengembalikan kode OTP.
const API = {
  send: "../api/auth/verifikasi-otp-pemulihan.php",
  verify: "../api/auth/verifikasi-otp-pemulihan.php",
  purpose: "Pemulihan"
};
let inputs, form, submit, resend, timer, notice, emailLabel, pesanOTP;
let expiry = 0, remaining = 3, busy = false, done = false, interval;

document.addEventListener("DOMContentLoaded", initialize);
window.addEventListener("pagehide", () => clearInterval(interval));

function initialize() {
  form = document.getElementById("otpForm");
  inputs = Array.from(document.querySelectorAll(".otp-input"));
  if (!form || inputs.length !== 8) return;
  pesanOTP = document.getElementById('otpMessage');
  submit = form.querySelector("button[type='submit']");
  resend = document.getElementById("resendButton");
  timer = document.getElementById("timer");
  notice = document.getElementById("otpCodeInfo");
  emailLabel = document.querySelector("#maskedEmail");
  if (!submit || !resend || !timer || !notice) return;
  notice.textContent = "Kode OTP dikirim melalui email terdaftar.";
  if (emailLabel) emailLabel.textContent = "Email terdaftar";
  // Hapus kode simulasi lama; jangan gunakan browser untuk autentikasi.
  sessionStorage.removeItem("sipfasRecoveryOtp");
  sessionStorage.removeItem("sipfasRecoveryVerified");
  setupInputs();
  form.addEventListener("submit", event => { event.preventDefault(); verify(); });
  resend.addEventListener("click", () => requestOTP("resend"));
  interval = setInterval(render, 250);
  requestOTP("ensure");
}

// 01. Mengelola input, fokus, dan paste delapan digit.
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
      if (digits.length > 1) { fill(digits, index); return; }
      input.value = digits.slice(0, 1);
      if (input.value && index < 7) inputs[index + 1].focus();
    });
    input.addEventListener("keydown", event => {
      if ((event.key === "ArrowLeft" || (event.key === "Backspace" && !input.value)) && index > 0) inputs[index - 1].focus();
      if (event.key === "ArrowRight" && index < 7) inputs[index + 1].focus();
    });
    input.addEventListener("paste", event => {
      event.preventDefault();
      fill(event.clipboardData.getData("text"), index);
    });
  });
}

// 02. Timer hanya untuk tampilan; keputusan akhir tetap pada server.
function render() {
  const seconds = Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
  timer.textContent = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  timer.classList.toggle("expired", seconds === 0);
  timer.style.color = seconds <= 30 ? "#dc4545" : "#1558d6";
  const disabled = busy || done || seconds === 0 || remaining === 0;
  inputs.forEach(input => { input.disabled = disabled; });
  submit.disabled = disabled;
  resend.disabled = busy || done || seconds > 0;
  
}

// 03. Semua permintaan menggunakan cookie sesi PHP.
async function post(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error("Respons server tidak valid. Periksa konfigurasi API PHP."); }
  return { response, result };
}

function message(text, type = "error") {
  tampilkanPesanPemulihan(text, type);
}

// 04. Meminta OTP server atau mengirim ulang setelah kedaluwarsa.
async function requestOTP(action) {
  if (busy || done || (action === "resend" && expiry > Date.now())) return;
  busy = true;
  render();
  try {
    const { response, result } = await post(API.send, { tujuan: API.purpose, action });
    if (!response.ok || result.success !== true) throw new Error(result.message || "OTP gagal dikirim.");
    const data = result.data || result;
    const deadline = Number(data.expires_at) * 1000;
    if (!Number.isFinite(deadline) || deadline <= Date.now()) throw new Error("Masa berlaku OTP dari server tidak valid.");
    expiry = deadline;
    remaining = Number.isInteger(data.remaining_attempts) ? Math.max(0, Math.min(3, data.remaining_attempts)) : 3;
    if (emailLabel && typeof data.masked_email === "string") emailLabel.textContent = data.masked_email;
    inputs.forEach(input => { input.value = ""; });
    message("Masukkan kode OTP yang dikirim ke email Anda.", "info");
  } catch (error) {
    message(error.message || "Tidak dapat terhubung ke server.");
  } finally {
    busy = false;
    render();
    if (!inputs[0].disabled) inputs[0].focus();
  }
}

// 05. Verifikasi langsung ke database melalui endpoint PHP.
async function verify() {
  if (busy || done || expiry <= Date.now() || remaining === 0) return;
  const otp = inputs.map(input => input.value).join("");
  if (!/^\d{8}$/.test(otp)) {
    message("Masukkan seluruh 8 digit kode OTP.");
    return;
  }
  busy = true;
  render();
  try {
    const { response, result } = await post(API.verify, { action: "verify", otp });
    if (!response.ok || result.success !== true) {
      if (Number.isInteger(result.remaining_attempts)) remaining = Math.max(0, Math.min(3, result.remaining_attempts));
      if (response.status === 410 || response.status === 401 || response.status === 409) expiry = 0;
      if (response.status === 429) remaining = 0;
      inputs.forEach(input => { input.value = ""; });
      message(result.message || "Verifikasi gagal.");
      return;
    }
    const allowed = ["password-baru.html"];
    if (!allowed.includes(result.redirect)) throw new Error("Tujuan halaman dari server tidak valid.");
    done = true;
    clearInterval(interval);
    message(result.message || "Verifikasi berhasil!", "success");
    window.location.assign(result.redirect);
  } catch (error) {
    message(error.message || "Tidak dapat terhubung ke server.");
  } finally {
    busy = false;
    render();
    if (!inputs[0].disabled) inputs[0].focus();
  }
}

// 06. Komponen tampilan asli dari halaman SIPFAS.
function tampilkanPesanPemulihan(teks, jenis) {
  if (!pesanOTP) {
    return;
  }

  // Memasukkan pesan notifikasi.
  pesanOTP.textContent = teks;

  // Menghapus seluruh class notifikasi sebelumnya.
  pesanOTP.classList.remove("is-error", "is-success", "is-info");

  // Mengatur tampilan berdasarkan jenis notifikasi.
  if (teks) {
    pesanOTP.classList.add("is-" + jenis);
  }

  // Mengatur warna sebagai fallback.
  const warna = {
    info: "#0755d5",
    error: "#dc4545",
    success: "#168447",
  };

  pesanOTP.style.color = warna[jenis] || "#52627b";
}
