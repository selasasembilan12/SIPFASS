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
   7. Notifikasi verifikasi.
   8. Pengiriman ulang OTP.
   9. Sinkronisasi identitas akun.
   10. Notifikasi Login Berhasil di Dashboard.
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
  toast: "sipfasLoginToast",

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

  if (!form || inputs.length !== 8) {
    console.error("Form verifikasi OTP tidak lengkap.");
    return;
  }

  let user;

  try {
    user = JSON.parse(sessionStorage.getItem(VERIFY_CONFIG.pending) || "null");
  } catch (error) {
    user = null;
  }

  if (!user || !user.email) {
    createVerificationComponents(form);

    showMessage(
      "Sesi login tidak ditemukan. Silakan kembali ke halaman login.",
      "error",
    );

    inputs.forEach((input) => (input.disabled = true));

    const button = form.querySelector("button[type='submit']");

    if (button) button.disabled = true;

    return;
  }

  // Menampilkan email yang sudah disamarkan.
  const emailElement = document.querySelector(".email-badge span");

  if (emailElement) {
    emailElement.textContent = maskEmail(user.email);
  }

  createVerificationComponents(form);
  setupOTPInputs(inputs);

  // Memeriksa OTP yang masih berlaku.
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
        "Batas 3 percobaan telah tercapai. Tunggu hingga OTP kedaluwarsa untuk meminta kode baru.",
        "error",
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
  const resendButton = document.getElementById("resendButton");

  if (resendButton) {
    resendButton.addEventListener("click", function () {
      resendOTP(inputs, form);
    });
  }

  inputs[0].focus();

  console.log("Sistem verifikasi OTP SIPFAS aktif.");
}

// ============================================================
// 07. MEMBUAT KOMPONEN TIMER DAN KIRIM ULANG
// ============================================================

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

  let message = document.getElementById("verificationMessage");

  if (!message) {
    message = document.createElement("div");
    message.id = "verificationMessage";

    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");

    message.innerHTML = `
      <div class="notification-icon"></div>
      <div class="notification-content">
        <strong class="notification-title"></strong>
        <span class="notification-text"></span>
      </div>
    `;

    message.style.display = "none";

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

  sessionStorage.setItem(VERIFY_CONFIG.otp, code);

  sessionStorage.setItem(
    VERIFY_CONFIG.expiry,
    String(Date.now() + VERIFY_CONFIG.duration),
  );

  sessionStorage.setItem(VERIFY_CONFIG.attempts, "0");

  otpLocked = false;
  otpExpired = false;

  inputs.forEach(function (input) {
    input.value = "";
    input.disabled = false;
  });

  const button = form.querySelector("button[type='submit']");

  if (button) {
    button.disabled = false;
    button.textContent = "Verifikasi";
  }

  showDemoOTP(code);

  showMessage(
    "Kode OTP berhasil dibuat. Masukkan 8 digit kode untuk melanjutkan.",
    "info",
  );

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
    input.addEventListener("input", function () {
      if (otpLocked || otpExpired) return;

      const notification = document.getElementById("verificationMessage");

      if (notification) {
        notification.style.display = "none";
      }

      input.value = input.value.replace(/\D/g, "").slice(-1);

      if (input.value && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

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

      const notification = document.getElementById("verificationMessage");

      if (notification) {
        notification.style.display = "none";
      }

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

    if (sisa <= 0) {
      clearInterval(otpTimerInterval);

      otpExpired = true;
      otpLocked = true;

      if (timerElement) {
        timerElement.textContent = "00:00";
        timerElement.style.color = "#dc4545";
      }

      inputs.forEach((input) => (input.disabled = true));

      const button = form.querySelector("button[type='submit']");

      if (button) button.disabled = true;

      if (resendButton) {
        resendButton.disabled = false;
        resendButton.style.opacity = "1";
        resendButton.style.cursor = "pointer";
      }

      showMessage(
        "Masa berlaku kode OTP telah habis. Silakan klik Kirim Ulang Kode untuk mendapatkan kode baru.",
        "warning",
      );

      return;
    }

    const menit = Math.floor(sisa / 60000);
    const detik = Math.floor((sisa % 60000) / 1000);

    if (timerElement) {
      timerElement.textContent =
        String(menit).padStart(2, "0") + ":" + String(detik).padStart(2, "0");

      timerElement.style.color = sisa <= 30000 ? "#dc4545" : "#1558d6";
    }

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
    showMessage(
      "OTP sudah kedaluwarsa. Silakan kirim ulang kode untuk melanjutkan.",
      "warning",
    );
    return;
  }

  if (otpLocked) {
    showMessage(
      "Batas percobaan telah tercapai. Tunggu hingga OTP kedaluwarsa.",
      "error",
    );
    return;
  }

  const entered = inputs.map((input) => input.value).join("");

  if (!/^\d{8}$/.test(entered)) {
    showMessage(
      "Masih ada angka yang belum diisi. Pastikan seluruh 8 kotak OTP terisi.",
      "warning",
    );

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

  if (entered !== saved) {
    attempts++;

    sessionStorage.setItem(VERIFY_CONFIG.attempts, String(attempts));

    inputs.forEach((input) => (input.value = ""));

    if (attempts >= VERIFY_CONFIG.maxAttempts) {
      lockVerification(inputs, form);
      return;
    }

    inputs[0].focus();

    showMessage(
      "Kode OTP tidak sesuai. Percobaan ke-" +
        attempts +
        " dari 3. Kamu masih memiliki " +
        (3 - attempts) +
        " kesempatan.",
      "error",
      "Kode OTP tidak sesuai",
    );

    return;
  }

  // OTP benar, lanjutkan proses login.
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
    "Kamu telah menggunakan seluruh 3 kesempatan. Tunggu hingga waktu OTP habis untuk meminta kode baru.",
    "error",
    "Batas percobaan tercapai",
  );
}

// ============================================================
// 15. MENGIRIM ULANG OTP
// ============================================================

function resendOTP(inputs, form) {
  if (!otpExpired) {
    showMessage(
      "Kode baru belum dapat diminta. Silakan tunggu hingga waktu OTP habis.",
      "warning",
    );
    return;
  }

  generateOTP(inputs, form);

  console.log("OTP baru berhasil dibuat.");
}

// ============================================================
// 16. MENYELESAIKAN LOGIN
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

    // Menyiapkan identitas pengguna.
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

    // Menyiapkan notifikasi untuk Dashboard.
    sessionStorage.setItem(
      "sipfasLoginNotification",
      JSON.stringify({
        title: "Login Berhasil",
        message:
          "Selamat datang, " +
          identitas.name +
          "! Kamu berhasil masuk ke SIPFAS.",
      }),
    );

    // Menghapus data OTP.
    sessionStorage.removeItem(VERIFY_CONFIG.pending);
    sessionStorage.removeItem(VERIFY_CONFIG.otp);
    sessionStorage.removeItem(VERIFY_CONFIG.expiry);
    sessionStorage.removeItem(VERIFY_CONFIG.attempts);

    // Menghentikan timer OTP.
    if (otpTimerInterval) {
      clearInterval(otpTimerInterval);
    }

    console.log("Login SIPFAS berhasil:", identitas);

    // Mengarahkan pengguna ke Dashboard.
    const button = document.querySelector(".verification-button");

    if (button) {
      button.disabled = true;
      button.textContent = "Berhasil...";
    }

    window.location.assign(destination);
  } catch (error) {
    console.error("Gagal menyelesaikan login:", error);

    showMessage(
      "Terjadi kesalahan ketika menghubungkan akun. Silakan coba kembali.",
      "error",
    );
  }
}

// ============================================================
// 17. MENAMPILKAN PESAN INFORMASI DAN NOTIFIKASI OTP
// ============================================================

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
