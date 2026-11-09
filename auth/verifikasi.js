/* ============================================================
   SIPFAS - VERIFIKASI.JS
   VERIFIKASI OTP LOGIN DUA LANGKAH

   Fitur:
   1. OTP acak 8 digit.
   2. Masa berlaku 2 menit.
   3. Maksimal 3 kali percobaan.
   4. Timer hitung mundur.
   5. Pindah kotak OTP otomatis.
   6. Mendukung paste 8 digit sekaligus.
   7. Peringatan jika OTP salah.
   8. Pengiriman ulang setelah OTP kedaluwarsa.
   9. Sinkronisasi identitas akun SIPFAS.
============================================================ */

// 01. Menjalankan sistem setelah HTML selesai dimuat.
document.addEventListener("DOMContentLoaded", initializeVerification);

// 02. Konfigurasi penyimpanan OTP.
const VERIFY_CONFIG = {
  pending: "sipfasPendingLogin",
  email: "sipfasLoginEmail",
  otp: "sipfasLoginOtp",
  expiry: "sipfasLoginOtpExpiresAt",
  attempts: "sipfasLoginAttempts",
  verified: "sipfasLoginVerified",
  active: "sipfasActiveUser",

  duration: 2 * 60 * 1000,
  maxAttempts: 3,
};

// 03. Tujuan Dashboard berdasarkan role.
const DASHBOARD_ROUTES = {
  pelapor: "../User/Dashboard/Dashboard/dashboard.html",
  petugas: "../Petugas/Dashboard/Dashboard.html",
  administrator: "../Admin/Dashboard/Dashboard.html",
};

// 04. Variabel pengatur OTP.
let otpTimerInterval = null;
let otpLocked = false;
let otpExpired = false;

// 05. Menyeragamkan role pengguna.
function normalizeVerifyRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();

  if (["admin", "administrator"].includes(value)) {
    return "administrator";
  }

  if (value === "petugas") {
    return "petugas";
  }

  if (["pelapor", "user"].includes(value)) {
    return "pelapor";
  }

  return "";
}

// ============================================================
// 06. INISIALISASI VERIFIKASI
// ============================================================

function initializeVerification() {
  const form = document.getElementById("verificationForm");
  const inputs = [...document.querySelectorAll(".otp-input")];

  // Memeriksa kelengkapan komponen OTP.
  if (!form || inputs.length !== 8) {
    console.error("Form verifikasi OTP tidak lengkap.");
    return;
  }

  // Mengambil identitas pengguna yang sedang login.
  let user;

  try {
    user = JSON.parse(sessionStorage.getItem(VERIFY_CONFIG.pending) || "null");
  } catch (error) {
    user = null;
  }

  // Memeriksa sesi login.
  if (!user || !user.email) {
    showMessage("Sesi login tidak ditemukan. Silakan login kembali.");

    inputs.forEach((input) => (input.disabled = true));

    const button = form.querySelector("button[type='submit']");

    if (button) button.disabled = true;

    return;
  }

  // Menampilkan email sesuai akun yang login.
  const emailElement = document.querySelector(".email-badge span");

  if (emailElement) {
    emailElement.textContent = maskEmail(user.email);
  }

  // Membuat komponen informasi OTP.
  createVerificationComponents(form);

  // Mengaktifkan interaksi kotak OTP.
  setupOTPInputs(inputs);

  // Mengambil OTP yang masih berlaku.
  const savedOTP = sessionStorage.getItem(VERIFY_CONFIG.otp);
  const expiry = Number(sessionStorage.getItem(VERIFY_CONFIG.expiry));

  if (savedOTP && expiry > Date.now()) {
    otpLocked =
      Number(sessionStorage.getItem(VERIFY_CONFIG.attempts) || "0") >=
      VERIFY_CONFIG.maxAttempts;

    otpExpired = false;

    showDemoOTP(savedOTP);
    updateTimer(inputs, form);

    if (otpLocked) {
      inputs.forEach((input) => (input.disabled = true));
      const button = form.querySelector("button[type='submit']");
      if (button) button.disabled = true;

      showMessage(
        "Batas 3 percobaan telah tercapai. Tunggu OTP kedaluwarsa untuk mengirim ulang.",
      );
    }
  } else {
    generateOTP(inputs, form);
  }

  // Menangani pengiriman formulir OTP.
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    verifyOTP(inputs, user, form);
  });

  // Menangani tombol kirim ulang.
  document
    .getElementById("resendButton")
    .addEventListener("click", function () {
      resendOTP(inputs, form);
    });

  inputs[0].focus();

  console.log("Sistem verifikasi OTP SIPFAS aktif.");
}

// ============================================================
// 07. MEMBUAT KOMPONEN TIMER DAN KIRIM ULANG
// ============================================================

function createVerificationComponents(form) {
  // Membuat informasi kode OTP simulasi.
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

    if (heading) {
      heading.appendChild(notice);
    }
  }

  // Membuat timer hitung mundur.
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

  // Membuat tombol kirim ulang.
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

  // Membuat tempat pesan kesalahan dan keberhasilan.
  let message = document.getElementById("verificationMessage");

  if (!message) {
    message = document.createElement("p");
    message.id = "verificationMessage";
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");

    message.style.cssText = `
      text-align: center;
      margin: 12px 0;
      font-size: 13px;
      line-height: 1.6;
    `;

    resendRow.insertAdjacentElement("afterend", message);
  }
}

// ============================================================
// 08. MENAMPILKAN EMAIL YANG DISAMARKAN
// ============================================================

function maskEmail(email) {
  if (!email || !email.includes("@")) {
    return "Email tidak tersedia";
  }

  const [nama, domain] = email.split("@");

  const namaMask =
    nama.length <= 2 ? nama[0] + "***" : nama.slice(0, 2) + "***";

  return namaMask + "@" + domain;
}

// ============================================================
// 09. MEMBUAT OTP ACAK 8 DIGIT
// ============================================================

function generateOTP(inputs, form) {
  const random = new Uint32Array(1);

  let code;

  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(random);

    code = String(random[0] % 100000000).padStart(8, "0");
  } else {
    code = String(Math.floor(Math.random() * 100000000)).padStart(8, "0");
  }

  // Menyimpan OTP.
  sessionStorage.setItem(VERIFY_CONFIG.otp, code);

  // Menyimpan waktu kedaluwarsa.
  sessionStorage.setItem(
    VERIFY_CONFIG.expiry,
    String(Date.now() + VERIFY_CONFIG.duration),
  );

  // Mengatur ulang percobaan.
  sessionStorage.setItem(VERIFY_CONFIG.attempts, "0");

  // Mengatur ulang status.
  otpLocked = false;
  otpExpired = false;

  // Mengosongkan seluruh kotak OTP.
  inputs.forEach(function (input) {
    input.value = "";
    input.disabled = false;
  });

  // Mengaktifkan tombol verifikasi.
  const button = form.querySelector("button[type='submit']");

  if (button) {
    button.disabled = false;
    button.textContent = "Verifikasi";
  }

  // Menampilkan kode OTP simulasi.
  showDemoOTP(code);

  // Menampilkan informasi.
  showMessage(
    "Kode OTP berhasil dibuat. Masukkan 8 digit kode untuk melanjutkan.",
    "info",
  );

  // Menjalankan timer.
  updateTimer(inputs, form);

  inputs[0].focus();

  console.info("[SIPFAS] OTP SIMULASI:", code);
}

// ============================================================
// 10. MENAMPILKAN KODE OTP SIMULASI
// ============================================================

function showDemoOTP(code) {
  const notice = document.getElementById("demoOtpNotice");

  if (!notice) return;

  notice.textContent =
    "Kode OTP simulasi: " + code + " | Berlaku selama 2 menit.";
}

// ============================================================
// 11. INTERAKSI KOTAK OTP
// ============================================================

function setupOTPInputs(inputs) {
  inputs.forEach(function (input, index) {
    // Memasukkan satu angka dan berpindah otomatis.
    input.addEventListener("input", function () {
      if (otpLocked || otpExpired) return;

      input.value = input.value.replace(/\D/g, "").slice(-1);

      if (input.value && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

    // Mengatur tombol keyboard.
    input.addEventListener("keydown", function (event) {
      if (event.key === "Backspace" && !input.value && index > 0) {
        inputs[index - 1].focus();
      }

      if (event.key === "ArrowLeft" && index > 0) {
        inputs[index - 1].focus();
      }

      if (event.key === "ArrowRight" && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

    // Mendukung paste 8 digit sekaligus.
    input.addEventListener("paste", function (event) {
      event.preventDefault();

      if (otpLocked || otpExpired) return;

      const code = event.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 8);

      code.split("").forEach(function (digit, i) {
        inputs[i].value = digit;
      });

      inputs[Math.min(code.length, 7)].focus();
    });
  });
}

// ============================================================
// 12. TIMER HITUNG MUNDUR 2 MENIT
// ============================================================

function updateTimer(inputs, form) {
  if (otpTimerInterval) {
    clearInterval(otpTimerInterval);
  }

  const timerElement = document.getElementById("timer");
  const resendButton = document.getElementById("resendButton");

  const expiry = Number(sessionStorage.getItem(VERIFY_CONFIG.expiry));

  function hitungMundur() {
    const sisa = expiry - Date.now();

    // Jika OTP kedaluwarsa.
    if (sisa <= 0) {
      clearInterval(otpTimerInterval);

      otpExpired = true;

      otpLocked = true;

      if (timerElement) {
        timerElement.textContent = "00:00";
        timerElement.style.color = "#dc4545";
      }

      // Menonaktifkan kotak OTP.
      inputs.forEach((input) => (input.disabled = true));

      // Menonaktifkan tombol verifikasi.
      const button = form.querySelector("button[type='submit']");

      if (button) button.disabled = true;

      // Mengaktifkan kirim ulang.
      if (resendButton) {
        resendButton.disabled = false;
        resendButton.style.opacity = "1";
        resendButton.style.cursor = "pointer";
      }

      showMessage(
        "Masa berlaku OTP telah habis. Silakan klik Kirim Ulang Kode.",
        "error",
      );

      return;
    }

    // Menghitung menit dan detik.
    const menit = Math.floor(sisa / 60000);
    const detik = Math.floor((sisa % 60000) / 1000);

    if (timerElement) {
      timerElement.textContent =
        String(menit).padStart(2, "0") + ":" + String(detik).padStart(2, "0");

      timerElement.style.color = sisa <= 30000 ? "#dc4545" : "#1558d6";
    }

    // Kirim ulang belum dapat digunakan.
    if (resendButton) {
      resendButton.disabled = true;
      resendButton.style.opacity = "0.5";
      resendButton.style.cursor = "not-allowed";
    }
  }

  hitungMundur();

  otpTimerInterval = setInterval(hitungMundur, 1000);
}

// ============================================================
// 13. MEMVERIFIKASI OTP
// ============================================================

function verifyOTP(inputs, user, form) {
  if (otpExpired) {
    showMessage("OTP sudah kedaluwarsa. Silakan kirim ulang kode.", "error");
    return;
  }

  if (otpLocked) {
    showMessage(
      "Batas percobaan telah tercapai. Tunggu OTP kedaluwarsa.",
      "error",
    );
    return;
  }

  // Menggabungkan 8 digit.
  const entered = inputs.map((input) => input.value).join("");

  if (!/^\d{8}$/.test(entered)) {
    showMessage("Masukkan kode OTP lengkap sebanyak 8 digit.", "error");

    inputs.find((input) => !input.value)?.focus();

    return;
  }

  const saved = sessionStorage.getItem(VERIFY_CONFIG.otp);

  const expiry = Number(sessionStorage.getItem(VERIFY_CONFIG.expiry));

  let attempts = Number(sessionStorage.getItem(VERIFY_CONFIG.attempts) || "0");

  if (!saved || !expiry) {
    showMessage("OTP tidak tersedia. Silakan login kembali.", "error");
    return;
  }

  if (Date.now() >= expiry) {
    updateTimer(inputs, form);
    return;
  }

  if (attempts >= VERIFY_CONFIG.maxAttempts) {
    lockVerification(inputs, form);
    return;
  }

  // Memeriksa kesesuaian kode.
  if (entered !== saved) {
    attempts++;

    sessionStorage.setItem(VERIFY_CONFIG.attempts, String(attempts));

    // Mengosongkan kotak OTP.
    inputs.forEach((input) => (input.value = ""));

    if (attempts >= VERIFY_CONFIG.maxAttempts) {
      lockVerification(inputs, form);
      return;
    }

    inputs[0].focus();

    showMessage(
      "Kode OTP salah! Percobaan ke-" +
        attempts +
        " dari 3. Sisa percobaan: " +
        (3 - attempts) +
        " kali.",
      "error",
    );

    return;
  }

  // OTP benar.
  finishLogin(user);
}

// ============================================================
// 14. MENGUNCI OTP SETELAH 3 KALI KESALAHAN
// ============================================================

function lockVerification(inputs, form) {
  otpLocked = true;

  inputs.forEach((input) => (input.disabled = true));

  const button = form.querySelector("button[type='submit']");

  if (button) button.disabled = true;

  showMessage(
    "Percobaan OTP telah mencapai batas maksimal 3 kali. Tunggu hingga timer habis untuk meminta kode baru.",
    "error",
  );
}

// ============================================================
// 15. MENGIRIM ULANG OTP
// ============================================================

function resendOTP(inputs, form) {
  if (!otpExpired) {
    showMessage("Silakan tunggu hingga masa berlaku OTP habis.", "error");
    return;
  }

  // Menghasilkan kode OTP baru.
  generateOTP(inputs, form);

  console.log("OTP baru berhasil dibuat.");
}

// ============================================================
// 16. MENYELESAIKAN LOGIN DAN SINKRONISASI AKUN
// ============================================================

function finishLogin(user) {
  const role = normalizeVerifyRole(user.role);
  const destination = DASHBOARD_ROUTES[role];

  if (!destination) {
    showMessage("Role pengguna tidak dikenali.", "error");
    return;
  }

  try {
    const users = JSON.parse(localStorage.getItem("sipfasUsers") || "[]");

    // Mencari akun berdasarkan ID atau username.
    const akun = users.find(function (item) {
      return (
        (user.id && String(item.id) === String(user.id)) ||
        (user.username &&
          String(item.username || "").toLowerCase() ===
            String(user.username).toLowerCase())
      );
    });

    if (!akun) {
      showMessage("Akun tidak ditemukan. Silakan login kembali.", "error");
      return;
    }

    const identitas = {
      id: akun.id || "",
      name: akun.name || akun.fullName || akun.nama || "",
      nim: akun.nim || "",
      username: akun.username || "",
      email: akun.email || "",
      role: normalizeVerifyRole(akun.role),
    };

    if (!identitas.name || identitas.role !== role) {
      showMessage("Identitas akun tidak valid.", "error");
      return;
    }

    // Menyimpan profil akun.
    localStorage.setItem("sipfasProfile", JSON.stringify(identitas));

    // Menyimpan sesi pengguna aktif.
    sessionStorage.setItem(VERIFY_CONFIG.active, JSON.stringify(identitas));

    // Menyimpan status verifikasi.
    sessionStorage.setItem(VERIFY_CONFIG.verified, "true");

    sessionStorage.setItem(VERIFY_CONFIG.email, identitas.email);

    // Menghapus data OTP.
    sessionStorage.removeItem(VERIFY_CONFIG.pending);
    sessionStorage.removeItem(VERIFY_CONFIG.otp);
    sessionStorage.removeItem(VERIFY_CONFIG.expiry);
    sessionStorage.removeItem(VERIFY_CONFIG.attempts);

    if (otpTimerInterval) {
      clearInterval(otpTimerInterval);
    }

    showMessage(
      "Verifikasi berhasil! Selamat datang, " + identitas.name + ".",
      "success",
    );

    const button = document.querySelector(".verification-button");

    if (button) {
      button.disabled = true;
      button.textContent = "Berhasil...";
    }

    console.log("Login SIPFAS berhasil:", identitas);

    setTimeout(function () {
      window.location.assign(destination);
    }, 1000);
  } catch (error) {
    console.error("Gagal menyelesaikan login:", error);

    showMessage("Terjadi kesalahan ketika menghubungkan akun.", "error");
  }
}

// ============================================================
// 17. MENAMPILKAN PESAN INFORMASI
// ============================================================

function showMessage(message, type = "error") {
  const element = document.getElementById("verificationMessage");

  if (!element) return;

  element.textContent = message;

  const warna = {
    error: "#dc4545",
    success: "#28734a",
    info: "#1558d6",
  };

  element.style.color = warna[type] || warna.error;
}
