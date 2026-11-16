/**
 * =========================================================
 * SIPFAS - JAVASCRIPT REGISTRASI AKUN
 * =========================================================
 *
 * Fungsi:
 * 1. Validasi formulir registrasi.
 * 2. Validasi nama, NIM, username, email, dan password.
 * 3. Mengirim data ke API PHP.
 * 4. Menampilkan respons dari server.
 * 5. Menyiapkan data untuk verifikasi OTP.
 *
 * Penyimpanan akun dilakukan melalui MySQL,
 * bukan LocalStorage.
 *
 * =========================================================
 */

// =========================================================
// 01. INISIALISASI HALAMAN
// =========================================================

document.addEventListener("DOMContentLoaded", function () {
  initializeRegistration();
});

// =========================================================
// 02. POLA VALIDASI
// =========================================================

// Validasi email.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Minimal 8 karakter, huruf besar, huruf kecil, dan angka.
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{8,}$/;

// Validasi username 3-30 karakter.
const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}$/;

// Validasi NIM 5-20 digit.
const NIM_PATTERN = /^[0-9]{5,20}$/;

// =========================================================
// 03. INISIALISASI REGISTRASI
// =========================================================

function initializeRegistration() {
  const registerForm = document.getElementById("registerForm");

  if (!registerForm) {
    console.error("Form registrasi tidak ditemukan.");
    return;
  }

  // Mengaktifkan fitur password.
  initializePasswordToggle();

  // Mengaktifkan validasi input.
  initializeInputValidation();

  // Memproses pengiriman formulir.
  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();

    processRegistration();
  });

  console.log("Registrasi SIPFAS siap digunakan.");
}

// =========================================================
// 04. VALIDASI INPUT SAAT DIKETIK
// =========================================================

function initializeInputValidation() {
  const fields = [
    ["fullName", "fullNameError"],
    ["nim", "nimError"],
    ["username", "usernameError"],
    ["email", "emailError"],
    ["password", "passwordError"],
    ["confirmPassword", "confirmPasswordError"],
  ];

  fields.forEach(function (field) {
    const input = document.getElementById(field[0]);
    const error = document.getElementById(field[1]);

    if (!input || !error) return;

    input.addEventListener("input", function () {
      error.textContent = "";

      input.removeAttribute("aria-invalid");

      showFormMessage("", "");
    });
  });
}

// =========================================================
// 05. MENAMPILKAN ERROR INPUT
// =========================================================

function showFieldError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);

  if (!input || !error) return;

  error.textContent = message;

  input.setAttribute("aria-invalid", "true");
}

// =========================================================
// 06. MENGHAPUS SELURUH ERROR
// =========================================================

function clearAllErrors() {
  const errorIds = [
    "fullNameError",
    "nimError",
    "usernameError",
    "emailError",
    "passwordError",
    "confirmPasswordError",
  ];

  errorIds.forEach(function (id) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = "";
    }
  });

  document.querySelectorAll("#registerForm input").forEach(function (input) {
    input.removeAttribute("aria-invalid");
  });
}

// =========================================================
// 07. MENAMPILKAN PESAN FORMULIR
// =========================================================

function showFormMessage(message, type) {
  const element = document.getElementById("formMessage");

  if (!element) return;

  element.textContent = message;

  if (type === "error") {
    element.style.color = "#d93636";
  } else if (type === "success") {
    element.style.color = "#28734a";
  } else {
    element.style.color = "#687d9d";
  }
}

// =========================================================
// 08. FITUR TAMPIL DAN SEMBUNYIKAN PASSWORD
// =========================================================

function initializePasswordToggle() {
  const buttons = document.querySelectorAll(".eye-button");

  buttons.forEach(function (button) {
    const input = button.closest(".input-box")?.querySelector("input");

    if (!input) return;

    button.addEventListener("click", function () {
      const isHidden = input.type === "password";

      input.type = isHidden ? "text" : "password";

      button.setAttribute(
        "aria-label",
        isHidden ? "Sembunyikan kata sandi" : "Tampilkan kata sandi",
      );

      button.setAttribute("aria-pressed", String(isHidden));

      const slash = button.querySelector(".eye-icon path:last-child");

      if (slash) {
        slash.style.display = isHidden ? "none" : "block";
      }
    });
  });
}

// =========================================================
// 09. VALIDASI SELURUH FORMULIR
// =========================================================

function validateRegistration(data) {
  let firstInvalidInput = null;

  function setInvalid(input) {
    if (!firstInvalidInput) {
      firstInvalidInput = input;
    }
  }

  // Validasi nama lengkap.
  if (data.fullName.length < 3 || data.fullName.length > 150) {
    showFieldError(
      "fullName",
      "fullNameError",
      "Nama lengkap harus terdiri dari 3 sampai 150 karakter.",
    );

    setInvalid(document.getElementById("fullName"));
  }

  // Validasi NIM.
  if (!NIM_PATTERN.test(data.nim)) {
    showFieldError(
      "nim",
      "nimError",
      "NIM harus berupa angka dengan panjang 5 sampai 20 digit.",
    );

    setInvalid(document.getElementById("nim"));
  }

  // Validasi username.
  if (!USERNAME_PATTERN.test(data.username)) {
    showFieldError(
      "username",
      "usernameError",
      "Username harus terdiri dari 3 sampai 30 karakter.",
    );

    setInvalid(document.getElementById("username"));
  }

  // Validasi email.
  const emailInput = document.getElementById("email");

  if (
    !EMAIL_PATTERN.test(data.email) ||
    !emailInput.checkValidity() ||
    data.email.length > 150
  ) {
    showFieldError("email", "emailError", "Format alamat email tidak valid.");

    setInvalid(emailInput);
  }

  // Validasi password.
  if (
    data.password.length < 8 ||
    data.password.length > 72 ||
    !PASSWORD_PATTERN.test(data.password)
  ) {
    showFieldError(
      "password",
      "passwordError",
      "Password minimal 8 karakter dan wajib mengandung huruf besar, huruf kecil, serta angka.",
    );

    setInvalid(document.getElementById("password"));
  }

  // Validasi konfirmasi password.
  if (!data.confirmPassword || data.password !== data.confirmPassword) {
    showFieldError(
      "confirmPassword",
      "confirmPasswordError",
      "Konfirmasi password tidak sesuai.",
    );

    setInvalid(document.getElementById("confirmPassword"));
  }

  if (firstInvalidInput) {
    showFormMessage("Periksa kembali data yang kamu masukkan.", "error");

    firstInvalidInput.focus();

    return false;
  }

  return true;
}

// =========================================================
// 10. PROSES REGISTRASI
// =========================================================

async function processRegistration() {
  clearAllErrors();

  showFormMessage("", "");

  // Mengambil nilai formulir.
  const data = {
    fullName: document.getElementById("fullName").value.trim(),

    nim: document.getElementById("nim").value.trim(),

    username: document.getElementById("username").value.trim().toLowerCase(),

    email: document.getElementById("email").value.trim().toLowerCase(),

    password: document.getElementById("password").value,

    confirmPassword: document.getElementById("confirmPassword").value,
  };

  // Memvalidasi formulir sebelum dikirim.
  if (!validateRegistration(data)) {
    return;
  }

  // Mengambil tombol daftar.
  const submitButton = document.querySelector(".register-button");

  const originalText = submitButton ? submitButton.textContent : "";

  // Mencegah pengiriman berulang.
  if (submitButton) {
    submitButton.disabled = true;

    submitButton.textContent = "Memproses...";

    submitButton.style.opacity = "0.7";

    submitButton.style.cursor = "not-allowed";
  }

  try {
    // Mengirim data ke API registrasi.
    const response = await fetch("../api/auth/registrasi.php", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      credentials: "same-origin",

      body: JSON.stringify(data),
    });

    // Membaca respons JSON.
    const result = await response.json();

    // Memeriksa hasil registrasi.
    if (!response.ok || !result.success) {
      showFormMessage(result.message || "Registrasi gagal.", "error");

      return;
    }

    // Menyimpan informasi sementara untuk halaman OTP.
    if (result.data.id_pengguna) {
      sessionStorage.setItem(
        "sipfas_verification_id",
        String(result.data.id_pengguna),
      );
    }

    if (result.data.email) {
      sessionStorage.setItem("sipfas_verification_email", result.data.email);
    }

    // Menampilkan hasil pengiriman email.
    if (result.data.email_sent === false) {
      showFormMessage(
        "Akun berhasil dibuat, tetapi OTP gagal dikirim. Silakan hubungi administrator.",
        "error",
      );

      return;
    }

    showFormMessage(
      result.message || "Registrasi berhasil. OTP telah dikirim ke email.",
      "success",
    );

    // Halaman verifikasi sedang dibuat.
    // Pengalihan akan disambungkan setelah halaman temanmu selesai.

    console.log("===== REGISTRASI SIPFAS =====");

    console.log("ID Pengguna:", result.data.id_pengguna);

    console.log("Email:", result.data.email);

    console.log("OTP berhasil dikirim:", result.data.email_sent);

    console.log("=============================");
  } catch (error) {
    console.error("Kesalahan registrasi:", error);

    showFormMessage(
      "Tidak dapat menghubungi server. Pastikan Apache dan MySQL XAMPP aktif.",
      "error",
    );
  } finally {
    // Mengaktifkan tombol kembali.
    if (submitButton) {
      submitButton.disabled = false;

      submitButton.textContent = originalText;

      submitButton.style.opacity = "1";

      submitButton.style.cursor = "pointer";
    }
  }
}
