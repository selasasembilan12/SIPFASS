"use strict";

/* ============================================================
   SIPFAS - VERIFIKASI DUA LANGKAH
   Mengelola OTP login, timer, percobaan, dan autentikasi.
============================================================ */

// 01. Menjalankan program setelah halaman selesai dimuat.
document.addEventListener("DOMContentLoaded", mulaiVerifikasi);

// 02. Konfigurasi penyimpanan sesi login.
const LOGIN_CONFIG = {
  pending: "sipfasPendingLogin",
  email: "sipfasLoginEmail",
  otp: "sipfasLoginOtp",
  expiry: "sipfasLoginOtpExpiresAt",
  attempts: "sipfasLoginAttempts",
  verified: "sipfasLoginVerified",
  activeUser: "sipfasActiveUser",

  duration: 120000,
  maxAttempts: 3,
};

// 03. Variabel elemen halaman.
let inputOTP = [];
let formulirOTP;
let pesanOTP;
let timerOTP;
let informasiOTP;
let informasiPercobaan;
let tombolVerifikasi;
let tombolKirimUlang;

let intervalTimer = null;
let penggunaLogin = null;
let emailLogin = "";

// 04. Inisialisasi halaman verifikasi.
function mulaiVerifikasi() {
  formulirOTP = document.getElementById("otpForm");
  pesanOTP = document.getElementById("otpMessage");
  timerOTP = document.getElementById("timer");
  informasiOTP = document.getElementById("otpCodeInfo");
  informasiPercobaan = document.getElementById("attemptInfo");

  tombolVerifikasi = document.querySelector(".verify-button");
  tombolKirimUlang = document.getElementById("resendButton");

  inputOTP = Array.from(document.querySelectorAll(".otp-input"));

  // Memastikan elemen halaman tersedia.
  if (
    !formulirOTP ||
    inputOTP.length !== 8 ||
    !pesanOTP ||
    !timerOTP ||
    !informasiOTP ||
    !informasiPercobaan ||
    !tombolVerifikasi ||
    !tombolKirimUlang
  ) {
    console.error("Elemen verifikasi dua langkah tidak lengkap.");
    return;
  }

  // Memeriksa apakah OTP sudah berhasil diverifikasi.
  if (sessionStorage.getItem(LOGIN_CONFIG.verified) === "true") {
    arahkanKeDashboard();
    return;
  }

  // Mengambil data pengguna yang sedang menunggu verifikasi.
  penggunaLogin = ambilDataPendingLogin();

  // Mengambil email pengguna.
  emailLogin = ambilEmailLogin();

  const otp = sessionStorage.getItem(LOGIN_CONFIG.otp);
  const expiry = Number(sessionStorage.getItem(LOGIN_CONFIG.expiry));

  // Memeriksa keberadaan sesi login.
  if (!penggunaLogin || !emailLogin || !otp || !expiry) {
    tampilkanPesan(
      "Sesi login tidak ditemukan. Silakan ulangi proses login.",
      "error",
    );

    nonaktifkanFormulir();

    return;
  }

  // Menampilkan email pengguna.
  tampilkanEmailLogin();

  // Menampilkan OTP simulasi.
  tampilkanInformasiOTP();

  // Menyiapkan jumlah percobaan.
  ambilSisaPercobaan();

  // Mengaktifkan input OTP.
  aturInputOTP();

  // Menangani formulir verifikasi.
  formulirOTP.addEventListener("submit", function (event) {
    event.preventDefault();
    verifikasiKodeOTP();
  });

  // Menangani tombol kirim ulang.
  tombolKirimUlang.addEventListener("click", kirimUlangOTP);

  // Memperbarui informasi kesempatan.
  perbaruiInformasiPercobaan();

  // Memeriksa status OTP.
  perbaruiStatusOTP();

  // Menjalankan timer.
  jalankanTimerOTP();

  console.log("Verifikasi dua langkah SIPFAS siap digunakan.");
}

// 05. Mengambil data pending login.
function ambilDataPendingLogin() {
  try {
    const data = sessionStorage.getItem(LOGIN_CONFIG.pending);

    if (!data) return null;

    const hasil = JSON.parse(data);

    if (!hasil || typeof hasil !== "object") {
      return null;
    }

    return hasil;
  } catch (error) {
    console.error("Gagal membaca data pending login:", error);
    return null;
  }
}

// 06. Mengambil email login.
function ambilEmailLogin() {
  // Mengutamakan email yang sudah disimpan oleh login.js.
  let email = sessionStorage.getItem(LOGIN_CONFIG.email);

  // Mengambil email dari data pending jika diperlukan.
  if (!email && penggunaLogin) {
    const dataPengguna =
      penggunaLogin.user || penggunaLogin.account || penggunaLogin;

    email = dataPengguna.email || penggunaLogin.email || "";
  }

  if (email) {
    email = String(email).trim().toLowerCase();

    sessionStorage.setItem(LOGIN_CONFIG.email, email);
  }

  return email;
}

// 07. Menyamarkan alamat email.
function samarkanEmail(email) {
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

// 08. Menampilkan email pengguna.
function tampilkanEmailLogin() {
  const elemenEmail = document.getElementById("maskedEmail");

  if (!elemenEmail || !emailLogin) return;

  elemenEmail.textContent = samarkanEmail(emailLogin);
}

// 09. Menampilkan kode OTP simulasi.
function tampilkanInformasiOTP() {
  const otp = sessionStorage.getItem(LOGIN_CONFIG.otp);

  if (!otp || !informasiOTP) return;

  informasiOTP.textContent =
    "Kode OTP simulasi: " + otp + " | Berlaku selama 2 menit.";
}

// 10. Mengambil sisa kesempatan verifikasi.
function ambilSisaPercobaan() {
  const nilai = sessionStorage.getItem(LOGIN_CONFIG.attempts);

  // Jika belum ada, berikan tiga kesempatan.
  if (nilai === null) {
    sessionStorage.setItem(
      LOGIN_CONFIG.attempts,
      String(LOGIN_CONFIG.maxAttempts),
    );

    return LOGIN_CONFIG.maxAttempts;
  }

  const jumlah = Number(nilai);

  return Number.isFinite(jumlah)
    ? Math.max(0, Math.min(LOGIN_CONFIG.maxAttempts, jumlah))
    : 0;
}

// 11. Memperbarui informasi kesempatan.
function perbaruiInformasiPercobaan() {
  if (!informasiPercobaan) return;

  const sisa = ambilSisaPercobaan();

  informasiPercobaan.textContent =
    sisa + " dari " + LOGIN_CONFIG.maxAttempts + " kali";

  // Memberikan warna peringatan ketika kesempatan hampir habis.
  informasiPercobaan.classList.toggle("warning", sisa <= 1);
}

// 12. Mengatur input OTP.
function aturInputOTP() {
  inputOTP.forEach(function (input, index) {
    // Memproses angka yang dimasukkan.
    input.addEventListener("input", function () {
      const angka = input.value.replace(/\D/g, "");

      // Mendukung input beberapa digit sekaligus.
      if (angka.length > 1) {
        masukkanKodeOTP(angka);
        return;
      }

      input.value = angka.slice(0, 1);

      // Berpindah otomatis ke kotak berikutnya.
      if (input.value && index < 7) {
        inputOTP[index + 1].focus();
      }

      // Menghapus pesan lama saat pengguna mulai mengetik.
      if (input.value) {
        tampilkanPesan("", "info");
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

      masukkanKodeOTP(teks);
    });
  });

  // Fokus otomatis ke kotak pertama.
  if (!inputOTP[0].disabled) {
    inputOTP[0].focus();
  }
}

// 13. Memasukkan delapan angka sekaligus.
function masukkanKodeOTP(kode) {
  const angka = String(kode).replace(/\D/g, "").slice(0, 8);

  inputOTP.forEach(function (input, index) {
    input.value = angka[index] || "";
  });

  const posisi = Math.min(angka.length, 7);

  inputOTP[posisi].focus();

  if (angka.length > 0) {
    tampilkanPesan("", "info");
  }
}

// 14. Mengambil kode dari seluruh kotak.
function ambilKodeOTP() {
  return inputOTP
    .map(function (input) {
      return input.value;
    })
    .join("");
}

// 15. Menampilkan pesan verifikasi.
function tampilkanPesan(teks, jenis) {
  if (!pesanOTP) return;

  pesanOTP.textContent = teks;

  const warna = {
    info: "#0755d5",
    error: "#dc4545",
    success: "#168447",
  };

  pesanOTP.style.color = warna[jenis] || "#52627b";
}

// 16. Memeriksa status OTP.
function perbaruiStatusOTP() {
  const expiry = Number(sessionStorage.getItem(LOGIN_CONFIG.expiry));

  const waktuHabis = !expiry || Date.now() >= expiry;

  const percobaanHabis = ambilSisaPercobaan() <= 0;

  // OTP tidak dapat digunakan jika kedaluwarsa atau kesempatan habis.
  const tidakAktif = waktuHabis || percobaanHabis;

  // Mengaktifkan atau menonaktifkan kotak input.
  inputOTP.forEach(function (input) {
    input.disabled = tidakAktif;
  });

  // Mengatur tombol verifikasi.
  tombolVerifikasi.disabled = tidakAktif;

  // Kirim ulang baru aktif setelah masa berlaku habis.
  tombolKirimUlang.disabled = !waktuHabis;

  // Memperbarui informasi kesempatan.
  perbaruiInformasiPercobaan();

  // Menampilkan pesan kondisi OTP.
  if (waktuHabis) {
    tampilkanPesan(
      "Kode OTP telah kedaluwarsa. Silakan kirim ulang kode.",
      "error",
    );
  } else if (percobaanHabis) {
    tampilkanPesan(
      "Batas percobaan telah tercapai. Tunggu hingga OTP kedaluwarsa untuk mengirim ulang.",
      "error",
    );
  }
}

// 17. Menjalankan timer OTP.
function jalankanTimerOTP() {
  clearInterval(intervalTimer);

  function hitungWaktu() {
    const expiry = Number(sessionStorage.getItem(LOGIN_CONFIG.expiry));

    const sisaWaktu = Math.max(0, Math.ceil((expiry - Date.now()) / 1000));

    const menit = Math.floor(sisaWaktu / 60);
    const detik = sisaWaktu % 60;

    timerOTP.textContent =
      String(menit).padStart(2, "0") + ":" + String(detik).padStart(2, "0");

    // Timer berhenti ketika masa berlaku habis.
    if (sisaWaktu <= 0) {
      clearInterval(intervalTimer);
      perbaruiStatusOTP();
    }
  }

  // Menampilkan timer langsung.
  hitungWaktu();

  // Timer tetap berjalan meskipun kesempatan habis.
  if (Date.now() < Number(sessionStorage.getItem(LOGIN_CONFIG.expiry))) {
    intervalTimer = setInterval(hitungWaktu, 250);
  }
}

// 18. Memverifikasi kode OTP.
function verifikasiKodeOTP() {
  const otpAsli = sessionStorage.getItem(LOGIN_CONFIG.otp);

  const expiry = Number(sessionStorage.getItem(LOGIN_CONFIG.expiry));

  const kodeMasukan = ambilKodeOTP();

  const sisaAwal = ambilSisaPercobaan();

  // Memeriksa masa berlaku OTP.
  if (!expiry || Date.now() >= expiry) {
    perbaruiStatusOTP();
    return;
  }

  // Memeriksa kesempatan yang tersedia.
  if (sisaAwal <= 0) {
    perbaruiStatusOTP();
    return;
  }

  // Memeriksa kelengkapan kode.
  if (kodeMasukan.length !== 8) {
    tampilkanPesan("Masukkan seluruh 8 digit kode verifikasi.", "error");
    return;
  }

  // Memeriksa kesesuaian OTP.
  if (kodeMasukan !== otpAsli) {
    // Mengurangi kesempatan sebanyak satu kali.
    const sisa = Math.max(0, sisaAwal - 1);

    sessionStorage.setItem(LOGIN_CONFIG.attempts, String(sisa));

    // Mengosongkan kotak input.
    // Kode OTP simulasi tetap ditampilkan.
    inputOTP.forEach(function (input) {
      input.value = "";
    });

    // Memperbarui informasi kesempatan.
    perbaruiInformasiPercobaan();

    const percobaanKe = LOGIN_CONFIG.maxAttempts - sisa;

    // Jika seluruh kesempatan habis.
    if (sisa <= 0) {
      tampilkanPesan(
        "Batas percobaan telah tercapai. Tunggu hingga OTP kedaluwarsa.",
        "error",
      );

      perbaruiStatusOTP();
      return;
    }

    // Menampilkan pesan kesalahan.
    tampilkanPesan(
      "Kode OTP salah! Percobaan ke-" +
        percobaanKe +
        " dari " +
        LOGIN_CONFIG.maxAttempts +
        ". Sisa percobaan: " +
        sisa +
        " kali.",
      "error",
    );

    // Mengembalikan fokus ke kotak pertama.
    inputOTP[0].focus();

    return;
  }

  // Jika OTP benar, proses autentikasi berhasil.
  selesaikanVerifikasiLogin();
}

// 19. Menyelesaikan verifikasi login.
function selesaikanVerifikasiLogin() {
  // Mengambil data pengguna yang menunggu verifikasi.
  const dataPending = penggunaLogin;

  if (!dataPending) {
    tampilkanPesan(
      "Data pengguna tidak ditemukan. Silakan login kembali.",
      "error",
    );
    return;
  }

  // Mengambil objek pengguna.
  const dataPengguna = dataPending.user || dataPending.account || dataPending;

  // Menentukan role pengguna.
  const role = dataPengguna.role || dataPending.role || "";

  // Memastikan data pengguna valid.
  if (!role) {
    tampilkanPesan(
      "Role pengguna tidak ditemukan. Silakan login kembali.",
      "error",
    );
    return;
  }

  // Menyimpan status verifikasi berhasil.
  sessionStorage.setItem(LOGIN_CONFIG.verified, "true");

  // Menyimpan data pengguna aktif.
  sessionStorage.setItem(LOGIN_CONFIG.activeUser, JSON.stringify(dataPengguna));

  // Menyimpan email pengguna.
  sessionStorage.setItem(LOGIN_CONFIG.email, emailLogin);

  // Menghentikan timer.
  clearInterval(intervalTimer);

  // Menonaktifkan seluruh input.
  inputOTP.forEach(function (input) {
    input.disabled = true;
  });

  tombolVerifikasi.disabled = true;
  tombolKirimUlang.disabled = true;

  // Menampilkan pesan keberhasilan.
  tampilkanPesan("Verifikasi berhasil! Mengarahkan ke dashboard...", "success");

  // Membersihkan data OTP yang sudah tidak diperlukan.
  sessionStorage.removeItem(LOGIN_CONFIG.pending);
  sessionStorage.removeItem(LOGIN_CONFIG.otp);
  sessionStorage.removeItem(LOGIN_CONFIG.expiry);
  sessionStorage.removeItem(LOGIN_CONFIG.attempts);

  // Mengarahkan berdasarkan role pengguna.
  setTimeout(function () {
    arahkanKeDashboard();
  }, 800);
}

// 20. Mengarahkan pengguna berdasarkan role.
function arahkanKeDashboard() {
  const dataAktif = sessionStorage.getItem(LOGIN_CONFIG.activeUser);

  if (!dataAktif) {
    window.location.href = "login.html";
    return;
  }

  let pengguna;

  try {
    pengguna = JSON.parse(dataAktif);
  } catch (error) {
    console.error("Data pengguna aktif tidak valid:", error);
    window.location.href = "login.html";
    return;
  }

  const role = String(pengguna.role || "").toLowerCase();

  // Tujuan dashboard sesuai role.
  const halamanDashboard = {
    pelapor: "../User/Dashboard/Dashboard/dashboard.html",
    petugas: "../Petugas/Dashboard/Dashboard.html",
    administrator: "../Admin/Dashboard/Dashboard.html",
  };

  const tujuan = halamanDashboard[role];

  if (!tujuan) {
    tampilkanPesan(
      "Role pengguna tidak dikenali. Silakan login kembali.",
      "error",
    );
    return;
  }

  window.location.href = tujuan;
}

// 21. Mengirim ulang OTP.
function kirimUlangOTP() {
  // Mengambil email pengguna.
  const email = sessionStorage.getItem(LOGIN_CONFIG.email);

  if (!email) {
    tampilkanPesan(
      "Sesi login tidak ditemukan. Silakan login kembali.",
      "error",
    );
    return;
  }

  const expiry = Number(sessionStorage.getItem(LOGIN_CONFIG.expiry));

  // Kirim ulang hanya ketika OTP sudah kedaluwarsa.
  if (expiry && Date.now() < expiry) {
    return;
  }

  // Membuat kode OTP baru.
  const otpBaru = buatKodeOTP();

  // Menyimpan OTP baru.
  sessionStorage.setItem(LOGIN_CONFIG.otp, otpBaru);

  // Memulai masa berlaku baru selama dua menit.
  sessionStorage.setItem(
    LOGIN_CONFIG.expiry,
    String(Date.now() + LOGIN_CONFIG.duration),
  );

  // Mengembalikan kesempatan menjadi tiga kali.
  sessionStorage.setItem(
    LOGIN_CONFIG.attempts,
    String(LOGIN_CONFIG.maxAttempts),
  );

  // Menghapus status verifikasi sebelumnya.
  sessionStorage.removeItem(LOGIN_CONFIG.verified);

  // Mengosongkan kotak OTP.
  inputOTP.forEach(function (input) {
    input.value = "";
    input.disabled = false;
  });

  // Mengaktifkan tombol verifikasi.
  tombolVerifikasi.disabled = false;

  // Menonaktifkan tombol kirim ulang.
  tombolKirimUlang.disabled = true;

  // Memperbarui kode OTP simulasi.
  tampilkanInformasiOTP();

  // Memperbarui jumlah kesempatan.
  perbaruiInformasiPercobaan();

  // Menampilkan pesan.
  tampilkanPesan(
    "Kode OTP baru berhasil dibuat. Silakan gunakan kode terbaru.",
    "success",
  );

  // Memulai timer baru.
  clearInterval(intervalTimer);
  jalankanTimerOTP();

  // Fokus kembali ke input pertama.
  inputOTP[0].focus();

  console.log("OTP simulasi baru:", otpBaru);
}

// 22. Membuat OTP acak delapan digit.
function buatKodeOTP() {
  const angka = new Uint32Array(1);

  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(angka);

    return String(10000000 + (angka[0] % 90000000));
  }

  return String(Math.floor(10000000 + Math.random() * 90000000));
}

// 23. Menonaktifkan formulir jika sesi tidak tersedia.
function nonaktifkanFormulir() {
  inputOTP.forEach(function (input) {
    input.disabled = true;
  });

  if (tombolVerifikasi) {
    tombolVerifikasi.disabled = true;
  }

  if (tombolKirimUlang) {
    tombolKirimUlang.disabled = true;
  }
}

// 24. Membersihkan timer ketika meninggalkan halaman.
window.addEventListener("pagehide", function () {
  clearInterval(intervalTimer);
});
