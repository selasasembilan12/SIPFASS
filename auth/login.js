/* ============================================================
   SIPFAS - LOGIN.JS
   Login Pelapor, Petugas, dan Administrator.
   Dilengkapi fitur tampil/sembunyikan kata sandi.
============================================================ */

/* 01. Menjalankan fungsi login setelah HTML selesai dimuat. */
document.addEventListener("DOMContentLoaded", initializeLogin);

/* 02. Konfigurasi penyimpanan data autentikasi SIPFAS. */
const LOGIN_CONFIG = {
  userKey: "sipfasUsers",
  pendingKey: "sipfasPendingLogin",
  emailKey: "sipfasLoginEmail",
  otpKey: "sipfasLoginOtp",
  expiryKey: "sipfasLoginOtpExpiresAt",
  attemptsKey: "sipfasLoginAttempts",
  verifiedKey: "sipfasLoginVerified",
  activeKey: "sipfasActiveUser",
};

/* 03. Menyamakan penulisan role pengguna. */
function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();

  const roles = {
    pelapor: "pelapor",
    user: "pelapor",
    petugas: "petugas",
    admin: "administrator",
    administrator: "administrator",
  };

  return roles[value] || "";
}

/* 04. Menginisialisasi halaman login. */
function initializeLogin() {
  const form = document.getElementById("loginForm");
  const password = document.getElementById("password");
  const toggle = document.getElementById("togglePassword");

  if (!form || !password) {
    console.error("Elemen form login tidak ditemukan.");
    return;
  }

  /* Mengaktifkan fitur tampil/sembunyikan password. */
  if (toggle) {
    toggle.addEventListener("click", function () {
      const passwordVisible = password.type === "password";

      /* Mengubah tipe input password. */
      password.type = passwordVisible ? "text" : "password";

      /* Mengubah ikon sesuai kondisi password. */
      toggle.innerHTML = passwordVisible
        ? `
                    <svg viewBox="0 0 24 24"
                         fill="none"
                         aria-hidden="true">
                        <path d="M3 3L21 21"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linecap="round"/>
                        <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linecap="round"/>
                        <path d="M9.9 5.2A10.5 10.5 0 0 1 12 5
                                 c6.1 0 9.5 7 9.5 7
                                 a16 16 0 0 1-3.1 3.8"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linecap="round"
                              stroke-linejoin="round"/>
                        <path d="M6.2 6.2A17 17 0 0 0 2.5 12
                                 s3.4 7 9.5 7
                                 c1.2 0 2.3-.2 3.3-.7"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linecap="round"/>
                    </svg>
                `
        : `
                    <svg viewBox="0 0 24 24"
                         fill="none"
                         aria-hidden="true">
                        <path d="M2.5 12s3.4-6 9.5-6
                                 9.5 6 9.5 6
                                 -3.4 6-9.5 6
                                 -9.5-6-9.5-6Z"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linecap="round"
                              stroke-linejoin="round"/>
                        <circle cx="12" cy="12" r="2.7"
                                stroke="currentColor"
                                stroke-width="1.8"/>
                    </svg>
                `;

      /* Memperbarui keterangan aksesibilitas. */
      toggle.setAttribute(
        "aria-label",
        passwordVisible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi",
      );

      password.focus();
    });
  }

  /* Menangani proses login. */
  form.addEventListener("submit", handleLogin);

  console.log("[SIPFAS] Login berhasil diinisialisasi.");
}

/* 05. Mengambil data akun dari LocalStorage. */
function getUsers() {
  try {
    const data = localStorage.getItem(LOGIN_CONFIG.userKey);

    if (!data) return [];

    const users = JSON.parse(data);

    return Array.isArray(users) ? users : null;
  } catch (error) {
    console.error("Gagal membaca data akun:", error);

    return null;
  }
}

/* 06. Menampilkan pesan informasi login. */
function showLoginMessage(message, type = "error") {
  let element = document.getElementById("loginMessage");

  if (!element) {
    element = document.createElement("p");

    element.id = "loginMessage";

    element.setAttribute("role", "status");

    element.setAttribute("aria-live", "polite");

    element.style.cssText = `
            font-size: 13px;
            text-align: center;
            line-height: 1.5;
            margin: 12px 0;
        `;

    const form = document.getElementById("loginForm");

    const button = form.querySelector(".login-button");

    form.insertBefore(element, button);
  }

  element.textContent = message;

  element.style.color = type === "success" ? "#28734a" : "#dc4545";
}

/* 07. Memproses autentikasi pengguna. */
function handleLogin(event) {
  event.preventDefault();

  const usernameInput = document.getElementById("username");

  const passwordInput = document.getElementById("password");

  const roleInput = document.getElementById("jenisPengguna");

  const identifier = usernameInput.value.trim().toLowerCase();

  const password = passwordInput.value;

  const selectedRole = normalizeRole(roleInput.value);

  /* Memeriksa kelengkapan formulir. */
  if (!identifier || !password || !selectedRole) {
    showLoginMessage("Lengkapi username, password, dan jenis pengguna.");

    return;
  }

  /* Mengambil seluruh akun terdaftar. */
  const users = getUsers();

  if (users === null) {
    showLoginMessage("Data akun tidak dapat dibaca.");

    return;
  }

  /* Mencocokkan username/email, password, dan role. */
  const user = users.find((account) => {
    const username = String(account.username || "")
      .trim()
      .toLowerCase();

    const email = String(account.email || "")
      .trim()
      .toLowerCase();

    const accountRole = normalizeRole(account.role);

    return (
      (identifier === username || identifier === email) &&
      password === String(account.password || "") &&
      selectedRole === accountRole
    );
  });

  /* Jika akun tidak ditemukan. */
  if (!user) {
    showLoginMessage(
      "Akun tidak ditemukan atau username, password, dan role tidak sesuai.",
    );

    passwordInput.value = "";

    passwordInput.focus();

    return;
  }

  /* Menyiapkan identitas pengguna untuk proses OTP. */
  const pendingUser = {
    id: user.id || "",

    name: user.name || user.fullName || user.nama || "",

    username: user.username || "",

    email: user.email || "",

    role: normalizeRole(user.role),
  };

  try {
    /* Membersihkan sesi autentikasi sebelumnya. */
    [
      LOGIN_CONFIG.pendingKey,
      LOGIN_CONFIG.emailKey,
      LOGIN_CONFIG.otpKey,
      LOGIN_CONFIG.expiryKey,
      LOGIN_CONFIG.attemptsKey,
      LOGIN_CONFIG.verifiedKey,
    ].forEach((key) => sessionStorage.removeItem(key));

    /* Menyimpan identitas pengguna sementara. */
    sessionStorage.setItem(
      LOGIN_CONFIG.pendingKey,
      JSON.stringify(pendingUser),
    );

    sessionStorage.setItem(LOGIN_CONFIG.emailKey, pendingUser.email);

    /* Menampilkan pesan keberhasilan login awal. */
    showLoginMessage("Login berhasil. Lanjutkan verifikasi OTP.", "success");

    /* Menonaktifkan tombol selama proses pengalihan. */
    const button = document.querySelector(".login-button");

    if (button) {
      button.disabled = true;

      const label = button.querySelector("span");

      if (label) {
        label.textContent = "Memproses...";
      }
    }

    /* Mengarahkan pengguna menuju halaman verifikasi OTP. */
    setTimeout(function () {
      window.location.href = "verifikasi.html";
    }, 500);
  } catch (error) {
    console.error("Kesalahan proses login:", error);

    showLoginMessage("Gagal membuat sesi pengguna.");
  }
}
