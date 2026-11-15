"use strict";

// SIPFAS - PASSWORD-BARU.JS
// Mengelola pembuatan dan penyimpanan kata sandi baru.

document.addEventListener("DOMContentLoaded", mulaiPasswordBaru);

const PASSWORD_CONFIG = {
  users: "sipfasUsers",
  email: "sipfasRecoveryEmail",
  verified: "sipfasRecoveryVerified",
  otp: "sipfasRecoveryOtp",
  expiry: "sipfasRecoveryOtpExpiresAt",
  attempts: "sipfasRecoveryAttempts",
  success: "sipfasPasswordResetSuccess",
};

let formulirPassword;
let inputPasswordBaru;
let inputKonfirmasi;
let tombolSimpan;
let pesanPassword;
let daftarSyarat = [];

// Menginisialisasi halaman password baru.
function mulaiPasswordBaru() {
  formulirPassword = document.getElementById("passwordForm");

  inputPasswordBaru = document.getElementById("newPassword");

  inputKonfirmasi = document.getElementById("confirmPassword");

  tombolSimpan = document.querySelector(".save-button");

  daftarSyarat = Array.from(document.querySelectorAll(".security-list li"));

  if (
    !formulirPassword ||
    !inputPasswordBaru ||
    !inputKonfirmasi ||
    !tombolSimpan
  ) {
    console.error("Elemen password baru tidak ditemukan.");
    return;
  }

  // Membuat tempat pesan.
  buatTempatPesan();

  // Memastikan OTP sudah diverifikasi.
  if (!periksaVerifikasiOTP()) {
    tampilkanPesanPassword(
      "Akses ditolak. Silakan lakukan verifikasi OTP terlebih dahulu.",
      "error",
    );

    nonaktifkanFormulir();
    return;
  }

  // Memastikan akun pemulihan masih tersedia.
  if (!cariAkunPemulihan()) {
    tampilkanPesanPassword(
      "Data akun tidak ditemukan. Silakan ulangi pemulihan.",
      "error",
    );

    nonaktifkanFormulir();
    return;
  }

  // Mengaktifkan tombol tampil/sembunyikan password.
  aktifkanTombolPassword();

  // Memperbarui indikator keamanan secara langsung.
  inputPasswordBaru.addEventListener("input", perbaruiSyaratPassword);

  inputKonfirmasi.addEventListener("input", perbaruiSyaratPassword);

  // Menangani penyimpanan password.
  formulirPassword.addEventListener("submit", function (event) {
    event.preventDefault();
    simpanPasswordBaru();
  });

  perbaruiSyaratPassword();

  console.log("Halaman password baru SIPFAS siap.");
}

// Memeriksa status OTP.
function periksaVerifikasiOTP() {
  return (
    sessionStorage.getItem(PASSWORD_CONFIG.verified) === "true" &&
    !!sessionStorage.getItem(PASSWORD_CONFIG.email)
  );
}

// Mengambil akun berdasarkan email pemulihan.
function cariAkunPemulihan() {
  try {
    const email = sessionStorage.getItem(PASSWORD_CONFIG.email);

    const data = localStorage.getItem(PASSWORD_CONFIG.users);

    if (!email || !data) return null;

    const users = JSON.parse(data);

    if (!Array.isArray(users)) return null;

    const index = users.findIndex(function (user) {
      return (
        String(user.email || "")
          .trim()
          .toLowerCase() === email.trim().toLowerCase()
      );
    });

    if (index === -1) return null;

    return {
      users: users,
      index: index,
      akun: users[index],
    };
  } catch (error) {
    console.error("Gagal mencari akun:", error);
    return null;
  }
}

// Membuat tempat pesan validasi.
function buatTempatPesan() {
  pesanPassword = document.getElementById("passwordMessage");

  if (pesanPassword) return;

  pesanPassword = document.createElement("p");

  pesanPassword.id = "passwordMessage";

  pesanPassword.setAttribute("role", "status");

  pesanPassword.setAttribute("aria-live", "polite");

  pesanPassword.style.cssText = `
    font-size: 13px;
    line-height: 1.5;
    text-align: center;
    margin: 0 0 12px;
  `;

  const kotakKeamanan = document.querySelector(".security-box");

  if (kotakKeamanan) {
    formulirPassword.insertBefore(pesanPassword, kotakKeamanan);
  } else {
    formulirPassword.appendChild(pesanPassword);
  }
}

// Menampilkan pesan informasi.
function tampilkanPesanPassword(pesan, jenis) {
  // NOTIFIKASI KEBERHASILAN DI TENGAH ATAS HALAMAN.
  if (jenis === "success") {
    // Menyembunyikan pesan di dalam formulir.
    if (!pesanPassword) buatTempatPesan();

    if (pesanPassword) {
      pesanPassword.textContent = "";
      pesanPassword.style.display = "none";
    }

    // Menghapus notifikasi sebelumnya jika ada.
    const notifikasiLama = document.getElementById("passwordSuccessToast");

    if (notifikasiLama) {
      notifikasiLama.remove();
    }

    // Membuat wadah notifikasi.
    const toast = document.createElement("div");

    toast.id = "passwordSuccessToast";
    toast.className = "password-success-toast";

    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");

    // Membuat ikon centang.
    const toastIcon = document.createElement("div");

    toastIcon.className = "password-success-toast-icon";
    toastIcon.textContent = "✓";

    // Membuat bagian isi notifikasi.
    const toastContent = document.createElement("div");

    toastContent.className = "password-success-toast-content";

    // Membuat judul notifikasi.
    const toastTitle = document.createElement("strong");

    toastTitle.textContent = "Kata Sandi Berhasil Diperbarui";

    // Membuat keterangan notifikasi.
    const toastMessage = document.createElement("p");

    toastMessage.textContent = pesan;

    // Menggabungkan isi notifikasi.
    toastContent.appendChild(toastTitle);
    toastContent.appendChild(toastMessage);

    toast.appendChild(toastIcon);
    toast.appendChild(toastContent);

    // Menampilkan notifikasi di tengah atas halaman.
    document.body.appendChild(toast);

    return;
  }

  // PESAN ERROR DAN INFORMASI TETAP DI DALAM FORM.
  if (!pesanPassword) buatTempatPesan();

  if (!pesanPassword) return;

  // Menampilkan kembali pesan validasi.
  pesanPassword.style.display = "block";

  pesanPassword.textContent = pesan;

  const warna = {
    error: "#dc4545",
    success: "#28734a",
    info: "#52627b",
  };

  pesanPassword.style.color = warna[jenis] || warna.info;
}

// Mengaktifkan tombol tampil/sembunyikan password.
function aktifkanTombolPassword() {
  const ikonMata = document.querySelectorAll(".eye-icon");

  ikonMata.forEach(function (ikon) {
    const input = ikon.parentElement.querySelector("input");

    if (!input) return;

    ikon.setAttribute("role", "button");
    ikon.setAttribute("tabindex", "0");
    ikon.setAttribute("aria-label", "Tampilkan kata sandi");
    ikon.setAttribute("aria-hidden", "false");

    ikon.addEventListener("click", function () {
      ubahTampilanPassword(input, ikon);
    });

    ikon.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        ubahTampilanPassword(input, ikon);
      }
    });
  });
}

// Mengubah visibilitas password.
function ubahTampilanPassword(input, ikon) {
  const terlihat = input.type === "text";

  input.type = terlihat ? "password" : "text";

  ikon.setAttribute(
    "aria-label",
    terlihat ? "Tampilkan kata sandi" : "Sembunyikan kata sandi",
  );
}

// Memeriksa persyaratan password.
function periksaSyaratPassword() {
  const password = inputPasswordBaru.value;

  return {
    cukupKarakter: password.length >= 8,
    adaHurufBesar: /[A-Z]/.test(password),
    adaHurufKecil: /[a-z]/.test(password),
    adaAngka: /[0-9]/.test(password),
    passwordCocok: password.length > 0 && password === inputKonfirmasi.value,
  };
}

// Memperbarui indikator keamanan.
function perbaruiSyaratPassword() {
  const syarat = periksaSyaratPassword();

  const status = [
    syarat.cukupKarakter,
    syarat.adaHurufBesar && syarat.adaHurufKecil && syarat.adaAngka,
    syarat.passwordCocok,
  ];

  daftarSyarat.forEach(function (item, index) {
    const lingkaran = item.querySelector(".requirement-circle");

    if (!lingkaran) return;

    if (status[index]) {
      lingkaran.style.borderColor = "#24965b";
      lingkaran.style.background = "#24965b";
      lingkaran.style.boxShadow = "inset 0 0 0 3px #edf3fa";

      item.style.color = "#24965b";
    } else {
      lingkaran.style.borderColor = "#7e8798";
      lingkaran.style.background = "transparent";
      lingkaran.style.boxShadow = "none";

      item.style.color = "#454d60";
    }
  });

  if (
    pesanPassword &&
    pesanPassword.textContent &&
    !pesanPassword.textContent.includes("Akses ditolak")
  ) {
    tampilkanPesanPassword("", "info");
  }
}

// Memvalidasi password sebelum disimpan.
function validasiPasswordBaru() {
  const password = inputPasswordBaru.value;

  const konfirmasi = inputKonfirmasi.value;

  const syarat = periksaSyaratPassword();

  if (!password) {
    tampilkanPesanPassword("Silakan masukkan kata sandi baru.", "error");

    inputPasswordBaru.focus();
    return false;
  }

  if (!syarat.cukupKarakter) {
    tampilkanPesanPassword(
      "Kata sandi harus memiliki minimal 8 karakter.",
      "error",
    );

    inputPasswordBaru.focus();
    return false;
  }

  if (!syarat.adaHurufBesar || !syarat.adaHurufKecil) {
    tampilkanPesanPassword(
      "Kata sandi harus mengandung huruf besar dan huruf kecil.",
      "error",
    );

    inputPasswordBaru.focus();
    return false;
  }

  if (!syarat.adaAngka) {
    tampilkanPesanPassword(
      "Kata sandi harus mengandung minimal satu angka.",
      "error",
    );

    inputPasswordBaru.focus();
    return false;
  }

  if (!konfirmasi) {
    tampilkanPesanPassword("Silakan isi konfirmasi kata sandi.", "error");

    inputKonfirmasi.focus();
    return false;
  }

  if (password !== konfirmasi) {
    tampilkanPesanPassword("Konfirmasi kata sandi tidak sesuai.", "error");

    inputKonfirmasi.focus();
    return false;
  }

  return true;
}

// Menyimpan password baru ke akun yang sesuai.
function simpanPasswordBaru() {
  // Memeriksa kembali status OTP.
  if (!periksaVerifikasiOTP()) {
    tampilkanPesanPassword(
      "Sesi verifikasi tidak ditemukan. Silakan ulangi pemulihan.",
      "error",
    );

    nonaktifkanFormulir();
    return;
  }

  // Memvalidasi seluruh persyaratan.
  if (!validasiPasswordBaru()) return;

  // Mengambil akun pemilik email pemulihan.
  const konteks = cariAkunPemulihan();

  if (!konteks) {
    tampilkanPesanPassword(
      "Akun tidak ditemukan. Silakan ulangi pemulihan.",
      "error",
    );
    return;
  }

  try {
    // Memperbarui password akun.
    konteks.users[konteks.index].password = inputPasswordBaru.value;

    // Menyimpan seluruh daftar akun kembali.
    localStorage.setItem(PASSWORD_CONFIG.users, JSON.stringify(konteks.users));

    // Menyimpan status keberhasilan.
    sessionStorage.setItem(PASSWORD_CONFIG.success, "true");

    // Menampilkan pesan keberhasilan.
    tampilkanPesanPassword(
      "Kata sandi berhasil diperbarui. Silakan login kembali.",
      "success",
    );

    // Menonaktifkan formulir.
    nonaktifkanFormulir();

    // Menghapus sesi pemulihan setelah password berhasil disimpan.
    [
      PASSWORD_CONFIG.email,
      PASSWORD_CONFIG.otp,
      PASSWORD_CONFIG.expiry,
      PASSWORD_CONFIG.verified,
      PASSWORD_CONFIG.attempts,
    ].forEach(function (key) {
      sessionStorage.removeItem(key);
    });

    // Mengarahkan kembali ke halaman login.
    setTimeout(function () {
      window.location.href = "login.html";
    }, 1500);
  } catch (error) {
    console.error("Gagal memperbarui password:", error);

    tampilkanPesanPassword(
      "Gagal menyimpan kata sandi. Silakan coba kembali.",
      "error",
    );
  }
}

// Menonaktifkan formulir.
function nonaktifkanFormulir() {
  if (!formulirPassword) return;

  formulirPassword.querySelectorAll("input").forEach(function (input) {
    input.disabled = true;
  });

  if (tombolSimpan) {
    tombolSimpan.disabled = true;
    tombolSimpan.style.opacity = "0.5";
    tombolSimpan.style.cursor = "not-allowed";
  }
}