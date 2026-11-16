
"use strict";

/* ============================================================
   SIPFAS - PASSWORD-BARU.JS
   Mengirim password baru ke backend PHP dan MySQL.
============================================================ */

document.addEventListener("DOMContentLoaded", mulaiPasswordBaru);

const PASSWORD_CONFIG = {
  api: "../api/auth/paswoard-baru.php",
  loginPage: "login.html",
};

let formulirPassword;
let inputPasswordBaru;
let inputKonfirmasi;
let tombolSimpan;
let pesanPassword;
let daftarSyarat = [];
let passwordProcessing = false;

// ============================================================
// 01. INISIALISASI HALAMAN
// ============================================================

function mulaiPasswordBaru() {
  formulirPassword = document.getElementById("passwordForm");

  inputPasswordBaru = document.getElementById("newPassword");

  inputKonfirmasi = document.getElementById("confirmPassword");

  tombolSimpan = document.querySelector(".save-button");

  daftarSyarat = Array.from(
    document.querySelectorAll(".security-list li")
  );

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

  // Mengaktifkan tombol tampil/sembunyikan password.
  aktifkanTombolPassword();

  // Memperbarui indikator keamanan.
  inputPasswordBaru.addEventListener(
    "input",
    perbaruiSyaratPassword
  );

  inputKonfirmasi.addEventListener(
    "input",
    perbaruiSyaratPassword
  );

  // Menangani pengiriman formulir.
  formulirPassword.addEventListener("submit", function (event) {
    event.preventDefault();
    simpanPasswordBaru();
  });

  perbaruiSyaratPassword();

  console.log("Halaman password baru SIPFAS siap.");
}

// ============================================================
// 02. MEMBUAT TEMPAT PESAN
// ============================================================

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
    formulirPassword.insertBefore(
      pesanPassword,
      kotakKeamanan
    );
  } else {
    formulirPassword.appendChild(pesanPassword);
  }
}

// ============================================================
// 03. MENAMPILKAN PESAN
// ============================================================

function tampilkanPesanPassword(pesan, jenis) {
  // Notifikasi berhasil.
  if (jenis === "success") {
    if (!pesanPassword) {
      buatTempatPesan();
    }

    if (pesanPassword) {
      pesanPassword.textContent = "";
      pesanPassword.style.display = "none";
    }

    const notifikasiLama = document.getElementById(
      "passwordSuccessToast"
    );

    if (notifikasiLama) {
      notifikasiLama.remove();
    }

    const toast = document.createElement("div");

    toast.id = "passwordSuccessToast";
    toast.className = "password-success-toast";

    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    const toastIcon = document.createElement("div");

    toastIcon.className = "password-success-toast-icon";
    toastIcon.textContent = "✓";

    const toastContent = document.createElement("div");

    toastContent.className = "password-success-toast-content";

    const toastTitle = document.createElement("strong");

    toastTitle.textContent = "Kata Sandi Berhasil Diperbarui";

    const toastMessage = document.createElement("p");

    toastMessage.textContent = pesan;

    toastContent.append(toastTitle, toastMessage);
    toast.append(toastIcon, toastContent);

    document.body.appendChild(toast);

    return;
  }

  // Pesan error dan informasi.
  if (!pesanPassword) {
    buatTempatPesan();
  }

  if (!pesanPassword) return;

  pesanPassword.style.display = "block";
  pesanPassword.textContent = pesan;

  const warna = {
    error: "#dc4545",
    info: "#52627b",
  };

  pesanPassword.style.color = warna[jenis] || warna.info;
}

// ============================================================
// 04. TOMBOL TAMPIL / SEMBUNYIKAN PASSWORD
// ============================================================

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
    terlihat ? "Tampilkan kata sandi" : "Sembunyikan kata sandi"
  );
}

// ============================================================
// 05. MEMERIKSA PERSYARATAN PASSWORD
// ============================================================

function periksaSyaratPassword() {
  const password = inputPasswordBaru.value;

  const ukuranByte = new TextEncoder().encode(password).length;

  return {
    cukupKarakter: password.length >= 8,
    ukuranValid: ukuranByte <= 72,
    adaHurufBesar: /[A-Z]/.test(password),
    adaHurufKecil: /[a-z]/.test(password),
    adaAngka: /[0-9]/.test(password),
    passwordCocok:
      password.length > 0 &&
      password === inputKonfirmasi.value,
  };
}

// ============================================================
// 06. MEMPERBARUI INDIKATOR KEAMANAN
// ============================================================

function perbaruiSyaratPassword() {
  const syarat = periksaSyaratPassword();

  const status = [
    syarat.cukupKarakter,
    syarat.adaHurufBesar &&
      syarat.adaHurufKecil &&
      syarat.adaAngka &&
      syarat.ukuranValid,
    syarat.passwordCocok,
  ];

  daftarSyarat.forEach(function (item, index) {
    const lingkaran = item.querySelector(".requirement-circle");

    if (!lingkaran) return;

    if (status[index]) {
      lingkaran.style.borderColor = "#24965b";
      lingkaran.style.background = "#24965b";
      lingkaran.style.boxShadow =
        "inset 0 0 0 3px #edf3fa";

      item.style.color = "#24965b";
    } else {
      lingkaran.style.borderColor = "#7e8798";
      lingkaran.style.background = "transparent";
      lingkaran.style.boxShadow = "none";

      item.style.color = "#454d60";
    }
  });

  // Menghapus pesan error lama ketika pengguna memperbaiki input.
  if (
    pesanPassword &&
    pesanPassword.textContent &&
    pesanPassword.style.display !== "none"
  ) {
    pesanPassword.textContent = "";
    pesanPassword.style.display = "none";
  }
}

// ============================================================
// 07. VALIDASI PASSWORD
// ============================================================

function validasiPasswordBaru() {
  const password = inputPasswordBaru.value;
  const konfirmasi = inputKonfirmasi.value;

  const syarat = periksaSyaratPassword();

  if (!password) {
    tampilkanPesanPassword(
      "Silakan masukkan kata sandi baru.",
      "error"
    );

    inputPasswordBaru.focus();
    return false;
  }

  if (!syarat.cukupKarakter) {
    tampilkanPesanPassword(
      "Kata sandi harus memiliki minimal 8 karakter.",
      "error"
    );

    inputPasswordBaru.focus();
    return false;
  }

  if (!syarat.ukuranValid) {
    tampilkanPesanPassword(
      "Ukuran password tidak boleh melebihi 72 byte.",
      "error"
    );

    inputPasswordBaru.focus();
    return false;
  }

  if (!syarat.adaHurufBesar || !syarat.adaHurufKecil) {
    tampilkanPesanPassword(
      "Kata sandi harus mengandung huruf besar dan huruf kecil.",
      "error"
    );

    inputPasswordBaru.focus();
    return false;
  }

  if (!syarat.adaAngka) {
    tampilkanPesanPassword(
      "Kata sandi harus mengandung minimal satu angka.",
      "error"
    );

    inputPasswordBaru.focus();
    return false;
  }

  if (!konfirmasi) {
    tampilkanPesanPassword(
      "Silakan isi konfirmasi kata sandi.",
      "error"
    );

    inputKonfirmasi.focus();
    return false;
  }

  if (password !== konfirmasi) {
    tampilkanPesanPassword(
      "Konfirmasi kata sandi tidak sesuai.",
      "error"
    );

    inputKonfirmasi.focus();
    return false;
  }

  return true;
}

// ============================================================
// 08. MENGIRIM PASSWORD BARU KE BACKEND PHP
// ============================================================

async function simpanPasswordBaru() {
  // Mencegah pengiriman berulang.
  if (passwordProcessing) return;

  // Validasi password.
  if (!validasiPasswordBaru()) return;

  passwordProcessing = true;

  tombolSimpan.disabled = true;
  tombolSimpan.style.opacity = "0.6";
  tombolSimpan.style.cursor = "not-allowed";

  const teksTombol = tombolSimpan.querySelector("span");
  const teksAwal = teksTombol ? teksTombol.textContent : "";

  if (teksTombol) {
    teksTombol.textContent = "Menyimpan...";
  }

  try {
    const response = await fetch(PASSWORD_CONFIG.api, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        password: inputPasswordBaru.value,
        confirmation: inputKonfirmasi.value,
      }),
    });

    const result = await response.json();

    // Memeriksa respons server.
    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
          "Password gagal diperbarui."
      );
    }

    // Menampilkan notifikasi keberhasilan.
    tampilkanPesanPassword(
      result.message ||
        "Password berhasil diperbarui. Silakan login kembali.",
      "success"
    );

    // Mengosongkan formulir.
    formulirPassword.reset();

    // Memperbarui indikator.
    perbaruiSyaratPassword();

    // Menonaktifkan formulir setelah berhasil.
    nonaktifkanFormulir();

    // Mengarahkan ke halaman login.
    setTimeout(function () {
      window.location.href = PASSWORD_CONFIG.loginPage;
    }, 1500);

  } catch (error) {
    console.error(
      "Kesalahan penyimpanan password:",
      error
    );

    tampilkanPesanPassword(
      error.message ||
        "Tidak dapat menghubungi server. Silakan coba kembali.",
      "error"
    );

  } finally {
    passwordProcessing = false;

    // Tombol aktif kembali jika penyimpanan gagal.
    if (tombolSimpan && !tombolSimpan.disabled) {
      tombolSimpan.style.opacity = "1";
      tombolSimpan.style.cursor = "pointer";
    }

    // Jika formulir tidak dinonaktifkan, pulihkan tombol.
    if (
      tombolSimpan &&
      !tombolSimpan.hasAttribute("data-success")
    ) {
      if (teksTombol && !tombolSimpan.disabled) {
        teksTombol.textContent = teksAwal;
      }
    }
  }
}

// ============================================================
// 09. MENONAKTIFKAN FORMULIR SETELAH BERHASIL
// ============================================================

function nonaktifkanFormulir() {
  if (!formulirPassword) return;

  formulirPassword
    .querySelectorAll("input")
    .forEach(function (input) {
      input.disabled = true;
    });

  if (tombolSimpan) {
    tombolSimpan.disabled = true;
    tombolSimpan.dataset.success = "true";
    tombolSimpan.style.opacity = "0.5";
    tombolSimpan.style.cursor = "not-allowed";
  }
}
