"use strict";

/* ============================================================
   SIPFAS - VERIFIKASI OTP PEMULIHAN KATA SANDI
   Mengelola OTP pemulihan, timer, percobaan, dan verifikasi.
============================================================ */

// 01. Menjalankan program setelah halaman selesai dimuat.
document.addEventListener("DOMContentLoaded", mulaiVerifikasiPemulihan);

// 02. Konfigurasi penyimpanan sesi pemulihan.
const RECOVERY_OTP_CONFIG = {
  email: "sipfasRecoveryEmail",
  otp: "sipfasRecoveryOtp",
  expiry: "sipfasRecoveryOtpExpiresAt",
  attempts: "sipfasRecoveryAttempts",
  verified: "sipfasRecoveryVerified",

  duration: 120000,
  maxAttempts: 3,

  nextPage: "password-baru.html",
  recoveryPage: "pemulihan.html",
};

// 03. Variabel elemen halaman.
let inputOTP = [];
let formulirOTP;
let pesanOTP;
let timerOTP;
let informasiOTP;
let tombolVerifikasi;
let tombolKirimUlang;

let intervalTimer = null;
let emailPemulihan = "";
let prosesVerifikasi = false;

// ============================================================
// 04. INISIALISASI HALAMAN VERIFIKASI PEMULIHAN
// ============================================================

function mulaiVerifikasiPemulihan() {
  formulirOTP = document.getElementById("otpForm");
  pesanOTP = document.getElementById("otpMessage");
  timerOTP = document.getElementById("timer");
  informasiOTP = document.getElementById("otpCodeInfo");

  tombolVerifikasi = document.querySelector(".verify-button");
  tombolKirimUlang = document.getElementById("resendButton");

  inputOTP = Array.from(document.querySelectorAll(".otp-input"));

  // Memastikan seluruh elemen halaman tersedia.
  if (
    !formulirOTP ||
    inputOTP.length !== 8 ||
    !pesanOTP ||
    !timerOTP ||
    !informasiOTP ||
    !tombolVerifikasi ||
    !tombolKirimUlang
  ) {
    console.error("Elemen verifikasi OTP pemulihan tidak lengkap.");
    return;
  }

  // Memeriksa status verifikasi sebelumnya.
  if (sessionStorage.getItem(RECOVERY_OTP_CONFIG.verified) === "true") {
    window.location.href = RECOVERY_OTP_CONFIG.nextPage;
    return;
  }

  // Mengambil email pemulihan.
  emailPemulihan = String(
    sessionStorage.getItem(RECOVERY_OTP_CONFIG.email) || "",
  )
    .trim()
    .toLowerCase();

  // Mengambil data OTP.
  const otp = sessionStorage.getItem(RECOVERY_OTP_CONFIG.otp);

  const expiry = Number(sessionStorage.getItem(RECOVERY_OTP_CONFIG.expiry));

  // Memeriksa keberadaan sesi pemulihan.
  if (
    !emailPemulihan ||
    !otp ||
    !/^\d{8}$/.test(otp) ||
    !Number.isFinite(expiry) ||
    expiry <= 0
  ) {
    tampilkanPesanPemulihan(
      "Sesi pemulihan tidak ditemukan. Silakan ulangi proses pemulihan.",
      "error",
    );

    nonaktifkanFormulirPemulihan();
    return;
  }

  // Menampilkan email yang disamarkan.
  tampilkanEmailPemulihan();

  // Menampilkan kode OTP simulasi.
  tampilkanInformasiOTPPemulihan();

  // Memastikan jumlah percobaan tersedia.
  ambilSisaPercobaanPemulihan();

  // Mengatur input OTP.
  aturInputOTPPemulihan();

  // Menangani pengiriman formulir.
  formulirOTP.addEventListener("submit", function (event) {
    event.preventDefault();
    verifikasiKodeOTPPemulihan();
  });

  // Menangani pengiriman ulang OTP.
  tombolKirimUlang.addEventListener("click", kirimUlangOTPPemulihan);

  // Memeriksa status OTP.
  perbaruiStatusOTPPemulihan();

  // Menjalankan timer.
  jalankanTimerPemulihan();

  console.log("Verifikasi OTP pemulihan SIPFAS siap digunakan.");
}

// ============================================================
// 05. MENYAMARKAN ALAMAT EMAIL
// ============================================================

function samarkanEmailPemulihan(email) {
  const bagian = email.split("@");

  if (bagian.length !== 2) {
    return email;
  }

  const nama = bagian[0];
  const domain = bagian[1];

  const namaTersamar =
    nama.length <= 2 ? nama.charAt(0) + "***" : nama.substring(0, 2) + "***";

  return namaTersamar + "@" + domain;
}

// ============================================================
// 06. MENAMPILKAN EMAIL PEMULIHAN
// ============================================================

function tampilkanEmailPemulihan() {
  const elemenEmail = document.getElementById("maskedEmail");

  if (!elemenEmail || !emailPemulihan) {
    return;
  }

  elemenEmail.textContent = samarkanEmailPemulihan(emailPemulihan);
}

// ============================================================
// 07. MENAMPILKAN KODE OTP SIMULASI
// ============================================================

function tampilkanInformasiOTPPemulihan() {
  const otp = sessionStorage.getItem(RECOVERY_OTP_CONFIG.otp);

  if (!otp || !informasiOTP) {
    return;
  }

  informasiOTP.textContent =
    "Kode OTP simulasi: " + otp + " | Berlaku selama 2 menit.";
}

// ============================================================
// 08. MENGAMBIL SISA KESEMPATAN VERIFIKASI
// ============================================================

function ambilSisaPercobaanPemulihan() {
  const nilai = sessionStorage.getItem(RECOVERY_OTP_CONFIG.attempts);

  // Jika data belum tersedia, berikan tiga kesempatan.
  if (nilai === null) {
    sessionStorage.setItem(
      RECOVERY_OTP_CONFIG.attempts,
      String(RECOVERY_OTP_CONFIG.maxAttempts),
    );

    return RECOVERY_OTP_CONFIG.maxAttempts;
  }

  const jumlah = Number(nilai);

  return Number.isFinite(jumlah)
    ? Math.max(0, Math.min(RECOVERY_OTP_CONFIG.maxAttempts, jumlah))
    : 0;
}

// ============================================================
// 09. MENGHITUNG JUMLAH PERCOBAAN YANG SUDAH DIGUNAKAN
// ============================================================

function hitungPercobaanPemulihan() {
  const sisa = ambilSisaPercobaanPemulihan();

  const digunakan = RECOVERY_OTP_CONFIG.maxAttempts - sisa;

  return digunakan;
}

// ============================================================
// 10. MENGATUR DELAPAN KOTAK INPUT OTP
// ============================================================

function aturInputOTPPemulihan() {
  inputOTP.forEach(function (input, index) {
    // Memproses angka yang dimasukkan.
    input.addEventListener("input", function () {
      const angka = input.value.replace(/\D/g, "");

      // Mendukung input beberapa angka sekaligus.
      if (angka.length > 1) {
        masukkanKodeOTPPemulihan(angka);
        return;
      }

      input.value = angka.slice(0, 1);

      // Berpindah otomatis ke kotak berikutnya.
      if (input.value && index < 7) {
        inputOTP[index + 1].focus();
      }

      // Menghapus notifikasi ketika pengguna mulai mengetik.
      if (input.value) {
        tampilkanPesanPemulihan("", "info");
      }
    });

    // Mengatur navigasi keyboard.
    input.addEventListener("keydown", function (event) {
      // Backspace menuju kotak sebelumnya.
      if (event.key === "Backspace" && !input.value && index > 0) {
        inputOTP[index - 1].focus();
      }

      // Navigasi ke kiri.
      if (event.key === "ArrowLeft" && index > 0) {
        inputOTP[index - 1].focus();
      }

      // Navigasi ke kanan.
      if (event.key === "ArrowRight" && index < 7) {
        inputOTP[index + 1].focus();
      }
    });

    // Mendukung paste kode OTP.
    input.addEventListener("paste", function (event) {
      event.preventDefault();

      const teks = event.clipboardData.getData("text");

      masukkanKodeOTPPemulihan(teks);
    });
  });

  // Fokus otomatis ke kotak pertama.
  if (!inputOTP[0].disabled) {
    inputOTP[0].focus();
  }
}

// ============================================================
// 11. MEMASUKKAN DELAPAN ANGKA SEKALIGUS
// ============================================================

function masukkanKodeOTPPemulihan(kode) {
  const angka = String(kode).replace(/\D/g, "").slice(0, 8);

  inputOTP.forEach(function (input, index) {
    input.value = angka[index] || "";
  });

  const posisi = Math.min(angka.length, 7);

  inputOTP[posisi].focus();

  if (angka.length > 0) {
    tampilkanPesanPemulihan("", "info");
  }
}

// ============================================================
// 12. MENGAMBIL KODE DARI SELURUH KOTAK
// ============================================================

function ambilKodeOTPPemulihan() {
  return inputOTP
    .map(function (input) {
      return input.value;
    })
    .join("");
}

// ============================================================
// 13. MENAMPILKAN NOTIFIKASI VERIFIKASI
// ============================================================

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

// ============================================================
// 14. MEMERIKSA STATUS OTP
// ============================================================

function perbaruiStatusOTPPemulihan() {
  const expiry = Number(sessionStorage.getItem(RECOVERY_OTP_CONFIG.expiry));

  const waktuHabis = !expiry || Date.now() >= expiry;

  const percobaanHabis = ambilSisaPercobaanPemulihan() <= 0;

  const tidakAktif = waktuHabis || percobaanHabis;

  // Mengaktifkan atau menonaktifkan kotak input.
  inputOTP.forEach(function (input) {
    input.disabled = tidakAktif;
  });

  // Mengatur tombol verifikasi.
  tombolVerifikasi.disabled = tidakAktif;

  // Tombol kirim ulang aktif setelah OTP kedaluwarsa.
  tombolKirimUlang.disabled = !waktuHabis;

  // Menampilkan pesan sesuai kondisi OTP.
  if (waktuHabis) {
    tampilkanPesanPemulihan(
      "Kode OTP telah kedaluwarsa. Silakan kirim ulang kode.",
      "error",
    );
  } else if (percobaanHabis) {
    tampilkanPesanPemulihan(
      "Batas percobaan verifikasi tercapai! (3/3). Silakan kirim ulang OTP setelah masa berlaku habis.",
      "error",
    );
  }
}

// ============================================================
// 15. MENJALANKAN TIMER OTP
// ============================================================

function jalankanTimerPemulihan() {
  clearInterval(intervalTimer);

  function hitungWaktu() {
    const expiry = Number(sessionStorage.getItem(RECOVERY_OTP_CONFIG.expiry));

    const sisaWaktu = Math.max(0, Math.ceil((expiry - Date.now()) / 1000));

    const menit = Math.floor(sisaWaktu / 60);
    const detik = sisaWaktu % 60;

    // Menampilkan waktu dengan format MM:SS.
    timerOTP.textContent =
      String(menit).padStart(2, "0") + ":" + String(detik).padStart(2, "0");

    // Mengubah warna timer ketika OTP kedaluwarsa.
    timerOTP.classList.toggle("expired", sisaWaktu <= 0);

    // Menghentikan timer ketika waktu habis.
    if (sisaWaktu <= 0) {
      clearInterval(intervalTimer);

      perbaruiStatusOTPPemulihan();
    }
  }

  // Menampilkan timer secara langsung.
  hitungWaktu();

  // Menjalankan timer selama OTP masih berlaku.
  if (Date.now() < Number(sessionStorage.getItem(RECOVERY_OTP_CONFIG.expiry))) {
    intervalTimer = setInterval(hitungWaktu, 250);
  }
}

// ============================================================
// 16. MEMVERIFIKASI KODE OTP PEMULIHAN
// ============================================================

function verifikasiKodeOTPPemulihan() {
  // Mencegah proses verifikasi berulang.
  if (prosesVerifikasi) {
    return;
  }

  const otpAsli = sessionStorage.getItem(RECOVERY_OTP_CONFIG.otp);

  const expiry = Number(sessionStorage.getItem(RECOVERY_OTP_CONFIG.expiry));

  const kodeMasukan = ambilKodeOTPPemulihan();

  const sisaAwal = ambilSisaPercobaanPemulihan();

  // Memeriksa masa berlaku OTP.
  if (!expiry || Date.now() >= expiry) {
    perbaruiStatusOTPPemulihan();
    return;
  }

  // Memeriksa kesempatan yang tersedia.
  if (sisaAwal <= 0) {
    perbaruiStatusOTPPemulihan();
    return;
  }

  // Memeriksa kelengkapan kode.
  if (!/^\d{8}$/.test(kodeMasukan)) {
    tampilkanPesanPemulihan(
      "Masukkan seluruh 8 digit kode verifikasi.",
      "error",
    );
    return;
  }

  // Memeriksa kesesuaian kode OTP.
  if (kodeMasukan !== otpAsli) {
    // Mengurangi kesempatan sebanyak satu kali.
    const sisa = Math.max(0, sisaAwal - 1);

    sessionStorage.setItem(RECOVERY_OTP_CONFIG.attempts, String(sisa));

    // Mengosongkan seluruh kotak OTP.
    inputOTP.forEach(function (input) {
      input.value = "";
    });

    // Menghitung jumlah percobaan yang sudah digunakan.
    const percobaanKe = hitungPercobaanPemulihan();

    // Jika seluruh kesempatan telah habis.
    if (sisa <= 0) {
      perbaruiStatusOTPPemulihan();
      return;
    }

    // Menampilkan notifikasi kesalahan dengan format 1/3 atau 2/3.
    tampilkanPesanPemulihan(
      "Kode OTP salah! Percobaan " +
        percobaanKe +
        "/" +
        RECOVERY_OTP_CONFIG.maxAttempts +
        ". Silakan coba kembali.",
      "error",
    );

    // Mengembalikan fokus ke kotak pertama.
    inputOTP[0].focus();

    return;
  }

  // Jika OTP benar, lanjutkan pemulihan kata sandi.
  selesaikanVerifikasiPemulihan();
}

// ============================================================
// 17. MENYELESAIKAN VERIFIKASI PEMULIHAN
// ============================================================

function selesaikanVerifikasiPemulihan() {
  // Memastikan email pemulihan masih tersedia.
  const email = sessionStorage.getItem(RECOVERY_OTP_CONFIG.email);

  if (!email) {
    tampilkanPesanPemulihan(
      "Data email pemulihan tidak ditemukan. Silakan ulangi proses.",
      "error",
    );
    return;
  }

  // Mengaktifkan pengunci proses.
  prosesVerifikasi = true;

  // Menyimpan status verifikasi berhasil.
  sessionStorage.setItem(RECOVERY_OTP_CONFIG.verified, "true");

  // Menghentikan timer.
  clearInterval(intervalTimer);

  // Menonaktifkan seluruh kotak input.
  inputOTP.forEach(function (input) {
    input.disabled = true;
  });

  tombolVerifikasi.disabled = true;
  tombolKirimUlang.disabled = true;

  // Membersihkan data OTP yang sudah tidak diperlukan.
  sessionStorage.removeItem(RECOVERY_OTP_CONFIG.otp);

  sessionStorage.removeItem(RECOVERY_OTP_CONFIG.expiry);

  sessionStorage.removeItem(RECOVERY_OTP_CONFIG.attempts);

  // Menampilkan notifikasi keberhasilan.
  tampilkanPesanPemulihan(
    "Verifikasi berhasil! Mengarahkan ke halaman kata sandi baru...",
    "success",
  );

  // Mengarahkan pengguna ke halaman penggantian kata sandi.
  setTimeout(function () {
    window.location.href = RECOVERY_OTP_CONFIG.nextPage;
  }, 1000);
}

// ============================================================
// 18. MENGIRIM ULANG OTP PEMULIHAN
// ============================================================

function kirimUlangOTPPemulihan() {
  // Memeriksa email pemulihan.
  const email = sessionStorage.getItem(RECOVERY_OTP_CONFIG.email);

  if (!email) {
    tampilkanPesanPemulihan(
      "Sesi pemulihan tidak ditemukan. Silakan ulangi proses.",
      "error",
    );
    return;
  }

  const expiry = Number(sessionStorage.getItem(RECOVERY_OTP_CONFIG.expiry));

  // Memastikan OTP lama sudah kedaluwarsa.
  if (expiry && Date.now() < expiry) {
    return;
  }

  // Membuat kode OTP baru.
  const otpBaru = buatKodeOTPPemulihan();

  // Menyimpan OTP baru.
  sessionStorage.setItem(RECOVERY_OTP_CONFIG.otp, otpBaru);

  // Mengatur masa berlaku baru selama dua menit.
  sessionStorage.setItem(
    RECOVERY_OTP_CONFIG.expiry,
    String(Date.now() + RECOVERY_OTP_CONFIG.duration),
  );

  // Mengembalikan kesempatan menjadi tiga kali.
  sessionStorage.setItem(
    RECOVERY_OTP_CONFIG.attempts,
    String(RECOVERY_OTP_CONFIG.maxAttempts),
  );

  // Menghapus status verifikasi sebelumnya.
  sessionStorage.removeItem(RECOVERY_OTP_CONFIG.verified);

  // Mengosongkan dan mengaktifkan kembali input.
  inputOTP.forEach(function (input) {
    input.value = "";
    input.disabled = false;
  });

  // Mengaktifkan tombol verifikasi.
  tombolVerifikasi.disabled = false;

  // Menonaktifkan tombol kirim ulang.
  tombolKirimUlang.disabled = true;

  // Memperbarui informasi OTP.
  tampilkanInformasiOTPPemulihan();

  // Menghapus notifikasi lama.
  tampilkanPesanPemulihan(
    "Kode OTP baru berhasil dibuat. Silakan gunakan kode terbaru.",
    "success",
  );

  // Menghentikan timer lama dan menjalankan timer baru.
  clearInterval(intervalTimer);

  jalankanTimerPemulihan();

  // Mengembalikan fokus ke kotak pertama.
  inputOTP[0].focus();

  console.log("OTP pemulihan baru:", otpBaru);
}

// ============================================================
// 19. MEMBUAT OTP ACAK DELAPAN DIGIT
// ============================================================

function buatKodeOTPPemulihan() {
  const angka = new Uint32Array(1);

  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(angka);

    return String(10000000 + (angka[0] % 90000000));
  }

  return String(Math.floor(10000000 + Math.random() * 90000000));
}

// ============================================================
// 20. MENONAKTIFKAN FORMULIR
// ============================================================

function nonaktifkanFormulirPemulihan() {
  // Menonaktifkan seluruh kotak input.
  inputOTP.forEach(function (input) {
    input.disabled = true;
  });

  // Menonaktifkan tombol verifikasi.
  if (tombolVerifikasi) {
    tombolVerifikasi.disabled = true;
  }

  // Menonaktifkan tombol kirim ulang.
  if (tombolKirimUlang) {
    tombolKirimUlang.disabled = true;
  }
}

// ============================================================
// 21. MEMBERSIHKAN TIMER KETIKA MENINGGALKAN HALAMAN
// ============================================================

window.addEventListener("pagehide", function () {
  clearInterval(intervalTimer);
});
