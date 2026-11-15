// =====================================================
// SIPFAS - JAVASCRIPT REGISTRASI AKUN
// =====================================================

// 01. Menjalankan JavaScript setelah halaman selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  initializeRegistration();
});

// 02. Menentukan nama penyimpanan akun pengguna.
const USER_STORAGE_KEY = "sipfasUsers";

// 03. Pola validasi email.
const EMAIL_PATTERN =
  /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

// 04. Pola validasi kata sandi.
// Minimal 8 karakter, huruf besar, huruf kecil, dan angka.
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{8,}$/;

// 05. Mengambil seluruh data akun yang tersimpan.
function getRegisteredUsers() {
  try {
    const savedUsers = localStorage.getItem(USER_STORAGE_KEY);

    if (!savedUsers) {
      return [];
    }

    const users = JSON.parse(savedUsers);

    if (!Array.isArray(users)) {
      throw new Error("Format data pengguna tidak valid.");
    }

    return users;
  } catch (error) {
    console.error("Gagal mengambil data pengguna:", error);
    return [];
  }
}

// 06. Menyimpan data akun pengguna.
function saveRegisteredUsers(users) {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));

    return true;
  } catch (error) {
    console.error("Gagal menyimpan akun:", error);
    return false;
  }
}

// 07. Menginisialisasi halaman registrasi.
function initializeRegistration() {
  const registerForm = document.getElementById("registerForm");

  if (!registerForm) {
    console.error("Form registrasi tidak ditemukan.");
    return;
  }

  // Mengaktifkan fitur tampil dan sembunyikan password.
  initializePasswordToggle();

  // Mengaktifkan penghapusan pesan error.
  initializeInputValidation();

  // Menjalankan proses ketika tombol daftar diklik.
  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    processRegistration();
  });

  console.log("Registrasi SIPFAS siap digunakan.");
}

// 08. Menghapus pesan error ketika input diperbaiki.
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

// 09. Menampilkan pesan kesalahan pada masing-masing input.
function showFieldError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);

  if (!input || !error) return;

  error.textContent = message;
  input.setAttribute("aria-invalid", "true");
}

// 10. Menghapus seluruh pesan kesalahan.
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

// 11. Menampilkan pesan informasi pada formulir.
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

// 12. Mengaktifkan tombol tampil dan sembunyikan password.
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

// 13. Memeriksa data akun yang sudah terdaftar.
function checkDuplicateAccount(nim, username, email) {
  const users = getRegisteredUsers();

  return {
    nimExists: users.some(function (user) {
      return String(user.nim || "").trim() === nim;
    }),

    usernameExists: users.some(function (user) {
      return (
        String(user.username || "")
          .trim()
          .toLowerCase() === username
      );
    }),

    emailExists: users.some(function (user) {
      return (
        String(user.email || "")
          .trim()
          .toLowerCase() === email
      );
    }),
  };
}

// 14. Memproses seluruh pendaftaran akun.
function processRegistration() {
  clearAllErrors();
  showFormMessage("", "");

  // Mengambil seluruh elemen input.
  const fullNameInput = document.getElementById("fullName");
  const nimInput = document.getElementById("nim");
  const usernameInput = document.getElementById("username");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  // Memastikan seluruh elemen tersedia.
  if (
    !fullNameInput ||
    !nimInput ||
    !usernameInput ||
    !emailInput ||
    !passwordInput ||
    !confirmPasswordInput
  ) {
    console.error("Elemen formulir registrasi tidak lengkap.");

    showFormMessage(
      "Formulir tidak dapat diproses. Periksa kembali halaman registrasi.",
      "error",
    );

    return;
  }

  // Mengambil nilai input.
  const fullName = fullNameInput.value.trim();
  const nim = nimInput.value.trim();
  const username = usernameInput.value.trim().toLowerCase();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  let firstInvalidInput = null;

  function setInvalid(input) {
    if (!firstInvalidInput) {
      firstInvalidInput = input;
    }
  }

  // 15. Validasi nama lengkap.
  if (!fullName) {
    showFieldError("fullName", "fullNameError", "Nama lengkap wajib diisi.");

    setInvalid(fullNameInput);
  } else if (fullName.length < 3) {
    showFieldError(
      "fullName",
      "fullNameError",
      "Nama lengkap minimal 3 karakter.",
    );

    setInvalid(fullNameInput);
  }

  // 16. Validasi NIM.
  if (!nim) {
    showFieldError("nim", "nimError", "NIM wajib diisi.");

    setInvalid(nimInput);
  } else if (!/^[0-9]{5,20}$/.test(nim)) {
    showFieldError(
      "nim",
      "nimError",
      "NIM harus berupa angka dengan panjang 5–20 digit.",
    );

    setInvalid(nimInput);
  }

  // 17. Validasi username.
  const usernamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}$/;

  if (!username) {
    showFieldError("username", "usernameError", "Username wajib diisi.");

    setInvalid(usernameInput);
  } else if (!usernamePattern.test(username)) {
    showFieldError(
      "username",
      "usernameError",
      "Username harus terdiri dari 3–30 karakter.",
    );

    setInvalid(usernameInput);
  }

  // 18. Validasi format email.
  if (!email) {
    showFieldError("email", "emailError", "Email wajib diisi.");

    setInvalid(emailInput);
  } else if (!EMAIL_PATTERN.test(email) || !emailInput.checkValidity()) {
    showFieldError(
      "email",
      "emailError",
      "Format email tidak valid. Contoh: nama@gmail.com.",
    );

    setInvalid(emailInput);
  }

  // 19. Validasi kata sandi.
  if (!password) {
    showFieldError("password", "passwordError", "Kata sandi wajib diisi.");

    setInvalid(passwordInput);
  } else if (!PASSWORD_PATTERN.test(password)) {
    showFieldError(
      "password",
      "passwordError",
      "Kata sandi minimal 8 karakter dan wajib mengandung huruf besar, huruf kecil, serta angka.",
    );

    setInvalid(passwordInput);
  }

  // 20. Validasi konfirmasi kata sandi.
  if (!confirmPassword) {
    showFieldError(
      "confirmPassword",
      "confirmPasswordError",
      "Konfirmasi kata sandi wajib diisi.",
    );

    setInvalid(confirmPasswordInput);
  } else if (password !== confirmPassword) {
    showFieldError(
      "confirmPassword",
      "confirmPasswordError",
      "Konfirmasi kata sandi tidak sesuai.",
    );

    setInvalid(confirmPasswordInput);
  }

  // 21. Menghentikan proses apabila input tidak valid.
  if (firstInvalidInput) {
    showFormMessage("Periksa kembali data yang kamu masukkan.", "error");

    firstInvalidInput.focus();
    return;
  }

  // 22. Memeriksa apakah NIM, username, atau email sudah digunakan.
  const duplicate = checkDuplicateAccount(nim, username, email);

  if (duplicate.nimExists) {
    showFieldError("nim", "nimError", "NIM tersebut sudah terdaftar.");

    setInvalid(nimInput);
  }

  if (duplicate.usernameExists) {
    showFieldError("username", "usernameError", "Username sudah digunakan.");

    setInvalid(usernameInput);
  }

  if (duplicate.emailExists) {
    showFieldError("email", "emailError", "Email sudah terdaftar.");

    setInvalid(emailInput);
  }

  // Menghentikan proses apabila terdapat data duplikat.
  if (firstInvalidInput) {
    showFormMessage("Data akun sudah digunakan. Periksa kembali.", "error");

    firstInvalidInput.focus();
    return;
  }

  // 23. Membuat identitas akun baru.
  const newUser = {
    id: "USR-" + Date.now(),

    name: fullName,

    nim: nim,

    username: username,

    email: email,

    // Password hanya untuk simulasi frontend.
    // Untuk aplikasi produksi gunakan backend dan password hashing.
    password: password,

    role: "pelapor",

    createdAt: new Date().toISOString(),
  };

  // 24. Menambahkan akun baru ke daftar pengguna.
  const users = getRegisteredUsers();

  users.push(newUser);

  // 25. Menyimpan akun ke LocalStorage.
  const saved = saveRegisteredUsers(users);

  if (!saved) {
    showFormMessage("Pendaftaran gagal. Silakan coba kembali.", "error");

    return;
  }

  // 26. Menampilkan informasi hasil registrasi.
  console.log("===== REGISTRASI SIPFAS =====");
  console.log("ID:", newUser.id);
  console.log("Nama:", newUser.name);
  console.log("NIM:", newUser.nim);
  console.log("Username:", newUser.username);
  console.log("Email:", newUser.email);
  console.log("Role:", newUser.role);
  console.log("=============================");

  // 27. Memberikan informasi keberhasilan.
  showFormMessage(
    "Registrasi berhasil! Mengarahkan ke halaman login...",
    "success",
  );

  // Menonaktifkan tombol untuk mencegah pengiriman berulang.
  const submitButton = document.querySelector(".register-button");

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.style.opacity = "0.7";
    submitButton.style.cursor = "not-allowed";
  }

  // 28. Mengarahkan pengguna ke halaman login.
  setTimeout(function () {
    window.location.href = "login.html";
  }, 1500);
}
