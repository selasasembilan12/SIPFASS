"use strict";

/**
 * SIPFAS - PASSWORD BARU
 *
 * Mengelola formulir password baru, validasi,
 * komunikasi dengan API, dan notifikasi.
 */

const PASSWORD_CONFIG = {
  api: "../api/auth/password-baru.php",
  loginPage: "login.html",
};

let formulirPassword;
let inputPasswordBaru;
let inputKonfirmasi;
let tombolSimpan;
let pesanPassword;
let daftarSyarat = [];
let passwordProcessing = false;
let redirectTimer = null;

// Menjalankan inisialisasi setelah halaman selesai dimuat.
document.addEventListener("DOMContentLoaded", mulaiPasswordBaru);

// ============================================================
// 01. INISIALISASI HALAMAN
// ============================================================

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
    console.error("Elemen formulir password tidak ditemukan.");
    return;
  }

  buatTempatPesan();
  aktifkanTombolPassword();

  inputPasswordBaru.addEventListener("input", perbaruiSyaratPassword);
  inputKonfirmasi.addEventListener("input", perbaruiSyaratPassword);

  formulirPassword.addEventListener("submit", function (event) {
    event.preventDefault();
    simpanPasswordBaru();
  });

  perbaruiSyaratPassword();

  console.log("SIPFAS: Halaman password baru siap.");
}

// ============================================================
// 02. MENYIAPKAN TEMPAT NOTIFIKASI
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
    formulirPassword.insertBefore(pesanPassword, kotakKeamanan);
  } else {
    formulirPassword.appendChild(pesanPassword);
  }
}

// ============================================================
// 03. MENAMPILKAN NOTIFIKASI
// ============================================================

function tampilkanPesanPassword(pesan, jenis) {
  if (jenis === "success") {
    const lama = document.getElementById("passwordSuccessToast");

    if (lama) lama.remove();

    const toast = document.createElement("div");
    toast.id = "passwordSuccessToast";
    toast.className = "password-success-toast";

    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    const icon = document.createElement("div");
    icon.className = "password-success-toast-icon";
    icon.textContent = "✓";

    const content = document.createElement("div");
    content.className = "password-success-toast-content";

    const title = document.createElement("strong");
    title.textContent = "Kata Sandi Berhasil Diperbarui";

    const description = document.createElement("p");
    description.textContent = pesan;

    content.append(title, description);
    toast.append(icon, content);

    document.body.appendChild(toast);

    return;
  }

  if (!pesanPassword) buatTempatPesan();

  if (!pesanPassword) return;

  pesanPassword.style.display = "block";
  pesanPassword.textContent = pesan;

  pesanPassword.style.color = jenis === "error" ? "#dc4545" : "#52627b";
}

// ============================================================
// 04. TOMBOL TAMPILKAN PASSWORD
// ============================================================

function aktifkanTombolPassword() {
  document.querySelectorAll(".eye-icon").forEach(function (ikon) {
    const input = ikon.parentElement.querySelector("input");

    if (!input) return;

    ikon.setAttribute("role", "button");
    ikon.setAttribute("tabindex", "0");
    ikon.setAttribute("aria-label", "Tampilkan kata sandi");

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

function ubahTampilanPassword(input, ikon) {
  const terlihat = input.type === "text";

  input.type = terlihat ? "password" : "text";

  ikon.setAttribute(
    "aria-label",
    terlihat ? "Tampilkan kata sandi" : "Sembunyikan kata sandi",
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
    passwordCocok: password.length > 0 && password === inputKonfirmasi.value,
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
      lingkaran.style.boxShadow = "inset 0 0 0 3px #edf3fa";
      item.style.color = "#24965b";
    } else {
      lingkaran.style.borderColor = "#7e8798";
      lingkaran.style.background = "transparent";
      lingkaran.style.boxShadow = "none";
      item.style.color = "#454d60";
    }
  });

  if (pesanPassword) {
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
    tampilkanPesanPassword("Silakan masukkan kata sandi baru.", "error");
    inputPasswordBaru.focus();
    return false;
  }

  if (!syarat.cukupKarakter || !syarat.ukuranValid) {
    tampilkanPesanPassword(
      "Password harus terdiri dari minimal 8 karakter dan maksimal 72 byte.",
      "error",
    );
    inputPasswordBaru.focus();
    return false;
  }

  if (!syarat.adaHurufBesar || !syarat.adaHurufKecil) {
    tampilkanPesanPassword(
      "Password harus mengandung huruf besar dan huruf kecil.",
      "error",
    );
    inputPasswordBaru.focus();
    return false;
  }

  if (!syarat.adaAngka) {
    tampilkanPesanPassword(
      "Password harus mengandung minimal satu angka.",
      "error",
    );
    inputPasswordBaru.focus();
    return false;
  }

  if (!konfirmasi) {
    tampilkanPesanPassword("Silakan isi konfirmasi password.", "error");
    inputKonfirmasi.focus();
    return false;
  }

  if (password !== konfirmasi) {
    tampilkanPesanPassword("Konfirmasi password tidak sesuai.", "error");
    inputKonfirmasi.focus();
    return false;
  }

  return true;
}

// ============================================================
// 08. MENGIRIM PASSWORD BARU KE API
// ============================================================

async function simpanPasswordBaru() {
  if (passwordProcessing) return;

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
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        password: inputPasswordBaru.value,
        confirmation: inputKonfirmasi.value,
      }),
    });

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error("Respons server tidak valid.");
    }

    if (!response.ok || result.success !== true) {
      throw new Error(result.message || "Password gagal diperbarui.");
    }

    // Menampilkan notifikasi keberhasilan.
    tampilkanPesanPassword(
      result.message || "Password berhasil diperbarui. Silakan login kembali.",
      "success",
    );

    formulirPassword.reset();
    nonaktifkanFormulir();

    // Mengarahkan pengguna kembali ke halaman login.
    redirectTimer = setTimeout(function () {
      window.location.assign(PASSWORD_CONFIG.loginPage);
    }, 2500);
  } catch (error) {
    console.error("[SIPFAS PASSWORD BARU]", error);

    tampilkanPesanPassword(
      error.message || "Terjadi kesalahan saat memperbarui password.",
      "error",
    );

    passwordProcessing = false;

    tombolSimpan.disabled = false;
    tombolSimpan.style.opacity = "1";
    tombolSimpan.style.cursor = "pointer";

    if (teksTombol) {
      teksTombol.textContent = teksAwal;
    }
  }
}

// ============================================================
// 09. MENONAKTIFKAN FORMULIR SETELAH BERHASIL
// ============================================================

function nonaktifkanFormulir() {
  formulirPassword.querySelectorAll("input").forEach(function (input) {
    input.disabled = true;
  });

  if (tombolSimpan) {
    tombolSimpan.disabled = true;
    tombolSimpan.dataset.success = "true";
    tombolSimpan.style.opacity = "0.5";
    tombolSimpan.style.cursor = "not-allowed";
  }
}
