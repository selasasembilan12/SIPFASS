// 01. Menjalankan JavaScript setelah halaman selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  mulaiVerifikasiOTP();
});

// 02. Menentukan nama penyimpanan data OTP.
const namaPenyimpanan = {
  email: "sipfasRecoveryEmail",
  otp: "sipfasRecoveryOtp",
  waktuHabis: "sipfasRecoveryOtpExpiresAt",
  sudahVerifikasi: "sipfasRecoveryVerified",
  jumlahPercobaan: "sipfasRecoveryAttempts",
};

// 03. Mengatur jumlah digit, waktu berlaku, dan batas percobaan OTP.
const JUMLAH_DIGIT = 8;
const WAKTU_BERLAKU = 179;
const BATAS_PERCOBAAN = 5;

// 04. Menyiapkan variabel halaman OTP.
let timerOTP = null;
let emailPemulihan = "";
let prosesVerifikasi = false;

// 05. Menyiapkan seluruh fitur halaman OTP.
function mulaiVerifikasiOTP() {
  const formulirOTP = document.getElementById("otpForm");
  const kotakOTP = document.querySelectorAll(".otp-input");
  const tombolKirimUlang = document.getElementById("resendButton");

  if (!formulirOTP || kotakOTP.length !== JUMLAH_DIGIT || !tombolKirimUlang) {
    console.error("Elemen halaman OTP tidak ditemukan.");
    return;
  }

  // Mengambil email dari halaman pemulihan.
  emailPemulihan = ambilEmailPemulihan();

  // Menampilkan email atau informasi jika email belum tersedia.
  if (emailPemulihan) {
    tampilkanEmail(emailPemulihan);
  } else {
    document.getElementById("maskedEmail").textContent = "Email belum tersedia";

    tampilkanPesan(
      "Email pemulihan belum ditemukan. OTP simulasi tetap dapat diuji.",
      "error",
    );
  }

  // Menghapus status verifikasi sebelumnya.
  sessionStorage.removeItem(namaPenyimpanan.sudahVerifikasi);

  // Membuat sesi OTP dan menjalankan timer.
  if (!siapkanSesiOTP()) {
    tampilkanPesan(
      "Gagal menyiapkan kode OTP. Silakan muat ulang halaman.",
      "error",
    );
    return;
  }

  // Mengaktifkan fitur input otomatis.
  aktifkanInputOTP();

  // Menangani pengiriman formulir verifikasi.
  formulirOTP.addEventListener("submit", function (event) {
    event.preventDefault();
    verifikasiKodeOTP();
  });

  // Menangani tombol kirim ulang kode.
  tombolKirimUlang.addEventListener("click", kirimUlangOTP);

  console.log("Halaman OTP SIPFAS siap digunakan.");
}

// 06. Mengambil email dari sessionStorage atau URL.
function ambilEmailPemulihan() {
  try {
    const parameterURL = new URLSearchParams(window.location.search);
    const emailURL = parameterURL.get("email");
    const emailTersimpan = sessionStorage.getItem(namaPenyimpanan.email);

    return (emailTersimpan || emailURL || "").trim().toLowerCase();
  } catch (error) {
    console.error("Gagal mengambil email:", error);
    return "";
  }
}

// 07. Menyamarkan alamat email pengguna.
function samarkanEmail(email) {
  const bagianEmail = email.split("@");

  if (bagianEmail.length !== 2) {
    return email;
  }

  const namaEmail = bagianEmail[0];
  const domainEmail = bagianEmail[1];

  const namaTersamar = namaEmail.substring(0, 2) + "***";

  return namaTersamar + "@" + domainEmail;
}

// 08. Menampilkan email yang sudah disamarkan.
function tampilkanEmail(email) {
  const elemenEmail = document.getElementById("maskedEmail");

  if (elemenEmail) {
    elemenEmail.textContent = samarkanEmail(email);
  }
}

// 09. Membuat kode OTP acak sebanyak delapan digit.
function buatKodeOTP() {
  const angkaAcak = new Uint32Array(JUMLAH_DIGIT);

  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(angkaAcak);

    return Array.from(angkaAcak)
      .map(function (angka) {
        return String(angka % 10);
      })
      .join("");
  }

  let kodeOTP = "";

  for (let i = 0; i < JUMLAH_DIGIT; i++) {
    kodeOTP += Math.floor(Math.random() * 10);
  }

  return kodeOTP;
}

// 10. Membuat dan menyimpan sesi OTP simulasi.
function buatSesiOTP() {
  const kodeBaru = buatKodeOTP();
  const waktuKedaluwarsa = Date.now() + WAKTU_BERLAKU * 1000;

  try {
    sessionStorage.setItem(namaPenyimpanan.otp, kodeBaru);
    sessionStorage.setItem(
      namaPenyimpanan.waktuHabis,
      String(waktuKedaluwarsa),
    );
    sessionStorage.setItem(namaPenyimpanan.jumlahPercobaan, "0");

    sessionStorage.removeItem(namaPenyimpanan.sudahVerifikasi);

    // Menampilkan OTP simulasi di Console untuk pengujian.
    console.warn("OTP SIMULASI SIPFAS:", kodeBaru);

    prosesVerifikasi = false;

    return true;
  } catch (error) {
    console.error("Gagal menyimpan sesi OTP:", error);
    return false;
  }
}

// 11. Menyiapkan sesi OTP ketika halaman dibuka.
function siapkanSesiOTP() {
  const berhasil = buatSesiOTP();

  if (!berhasil) {
    return false;
  }

  mulaiTimerOTP();

  return true;
}

// 12. Mengaktifkan input otomatis delapan kotak OTP.
function aktifkanInputOTP() {
  const kotakOTP = document.querySelectorAll(".otp-input");

  kotakOTP.forEach(function (kotak, index) {
    // Mengatur angka yang dimasukkan dan perpindahan otomatis.
    kotak.addEventListener("input", function () {
      const angka = kotak.value.replace(/\D/g, "");

      if (angka.length > 1) {
        masukkanKodeOTP(angka, index);
        return;
      }

      kotak.value = angka.slice(-1);

      hapusPesanOTP();

      if (kotak.value && index < JUMLAH_DIGIT - 1) {
        kotakOTP[index + 1].focus();
      }
    });

    // Mengatur tombol Backspace dan panah kiri atau kanan.
    kotak.addEventListener("keydown", function (event) {
      if (event.key === "Backspace" && !kotak.value && index > 0) {
        event.preventDefault();

        kotakOTP[index - 1].value = "";
        kotakOTP[index - 1].focus();

        hapusPesanOTP();
      }

      if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        kotakOTP[index - 1].focus();
      }

      if (event.key === "ArrowRight" && index < JUMLAH_DIGIT - 1) {
        event.preventDefault();
        kotakOTP[index + 1].focus();
      }
    });

    // Mendukung paste kode OTP sekaligus.
    kotak.addEventListener("paste", function (event) {
      event.preventDefault();

      const kodeTempel = event.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, JUMLAH_DIGIT);

      if (kodeTempel) {
        masukkanKodeOTP(kodeTempel, 0);
      }
    });

    // Menghapus pesan ketika kotak OTP dipilih.
    kotak.addEventListener("focus", hapusPesanOTP);
  });
}

// 13. Memasukkan angka OTP ke kotak secara otomatis.
function masukkanKodeOTP(kode, posisiAwal) {
  const kotakOTP = document.querySelectorAll(".otp-input");
  const angka = kode.replace(/\D/g, "").slice(0, JUMLAH_DIGIT);

  kotakOTP.forEach(function (kotak, posisi) {
    if (posisi >= posisiAwal) {
      kotak.value = "";
    }
  });

  for (let i = 0; i < angka.length; i++) {
    const posisi = posisiAwal + i;

    if (posisi < JUMLAH_DIGIT) {
      kotakOTP[posisi].value = angka[i];
    }
  }

  const kotakKosong = Array.from(kotakOTP).find(function (kotak) {
    return !kotak.value;
  });

  if (kotakKosong) {
    kotakKosong.focus();
  } else {
    kotakOTP[JUMLAH_DIGIT - 1].focus();
  }

  hapusPesanOTP();
}

// 14. Menggabungkan delapan angka OTP yang dimasukkan.
function ambilKodeOTP() {
  const kotakOTP = document.querySelectorAll(".otp-input");

  return Array.from(kotakOTP)
    .map(function (kotak) {
      return kotak.value;
    })
    .join("");
}

// 15. Menampilkan pesan informasi, kesalahan, atau keberhasilan.
function tampilkanPesan(pesan, jenis) {
  const elemenPesan = document.getElementById("otpMessage");

  if (!elemenPesan) {
    return;
  }

  elemenPesan.textContent = pesan;

  if (jenis === "success") {
    elemenPesan.style.color = "#28734a";
  } else if (jenis === "error") {
    elemenPesan.style.color = "#dc4545";
  } else {
    elemenPesan.style.color = "#52627b";
  }
}

// 16. Menghapus pesan OTP sebelumnya.
function hapusPesanOTP() {
  tampilkanPesan("", "");
}

// 17. Mengosongkan seluruh kotak OTP.
function kosongkanKotakOTP() {
  const kotakOTP = document.querySelectorAll(".otp-input");

  kotakOTP.forEach(function (kotak) {
    kotak.value = "";
  });

  if (kotakOTP.length > 0) {
    kotakOTP[0].focus();
  }
}

// 18. Menjalankan hitung mundur masa berlaku OTP.
function mulaiTimerOTP() {
  const elemenTimer = document.getElementById("timer");
  const tombolKirimUlang = document.getElementById("resendButton");

  if (!elemenTimer || !tombolKirimUlang) {
    return;
  }

  // Menghentikan timer sebelumnya.
  if (timerOTP) {
    clearInterval(timerOTP);
    timerOTP = null;
  }

  tombolKirimUlang.disabled = true;

  // Memperbarui waktu yang tersisa setiap detik.
  function perbaruiTimer() {
    const waktuHabis = Number(
      sessionStorage.getItem(namaPenyimpanan.waktuHabis),
    );

    const sisaWaktu = Math.max(0, Math.ceil((waktuHabis - Date.now()) / 1000));

    const menit = Math.floor(sisaWaktu / 60);
    const detik = sisaWaktu % 60;

    elemenTimer.textContent =
      String(menit).padStart(2, "0") + ":" + String(detik).padStart(2, "0");

    if (sisaWaktu <= 0) {
      clearInterval(timerOTP);
      timerOTP = null;

      elemenTimer.textContent = "00:00";
      tombolKirimUlang.disabled = false;

      sessionStorage.removeItem(namaPenyimpanan.otp);

      tampilkanPesan(
        "Kode OTP telah kedaluwarsa. Silakan kirim ulang kode.",
        "error",
      );
    }
  }

  perbaruiTimer();

  timerOTP = setInterval(perbaruiTimer, 1000);
}

// 19. Memeriksa kode OTP yang dimasukkan pengguna.
function verifikasiKodeOTP() {
  hapusPesanOTP();

  if (prosesVerifikasi) {
    return;
  }

  const kodeDimasukkan = ambilKodeOTP();
  const kodeTersimpan = sessionStorage.getItem(namaPenyimpanan.otp);

  const waktuHabis = Number(sessionStorage.getItem(namaPenyimpanan.waktuHabis));

  const jumlahPercobaan = Number(
    sessionStorage.getItem(namaPenyimpanan.jumlahPercobaan) || "0",
  );

  // Memeriksa kelengkapan delapan digit OTP.
  if (!/^\d{8}$/.test(kodeDimasukkan)) {
    tampilkanPesan("Masukkan seluruh 8 digit kode OTP.", "error");

    const kotakKosong = Array.from(
      document.querySelectorAll(".otp-input"),
    ).find(function (kotak) {
      return !kotak.value;
    });

    if (kotakKosong) {
      kotakKosong.focus();
    }

    return;
  }

  // Memeriksa batas percobaan verifikasi.
  if (jumlahPercobaan >= BATAS_PERCOBAAN) {
    tampilkanPesan(
      "Batas percobaan tercapai. Silakan kirim ulang kode OTP.",
      "error",
    );

    return;
  }

  // Memeriksa masa berlaku kode OTP.
  if (!kodeTersimpan || !waktuHabis || Date.now() >= waktuHabis) {
    tampilkanPesan(
      "Kode OTP sudah kedaluwarsa. Silakan kirim ulang kode.",
      "error",
    );

    return;
  }

  // Memeriksa kecocokan kode OTP.
  if (kodeDimasukkan !== kodeTersimpan) {
    const percobaanBaru = jumlahPercobaan + 1;

    sessionStorage.setItem(
      namaPenyimpanan.jumlahPercobaan,
      String(percobaanBaru),
    );

    const sisaPercobaan = BATAS_PERCOBAAN - percobaanBaru;

    kosongkanKotakOTP();

    if (sisaPercobaan <= 0) {
      tampilkanPesan(
        "Kode OTP salah. Batas percobaan tercapai. Silakan kirim ulang kode.",
        "error",
      );
    } else {
      tampilkanPesan(
        "Kode OTP tidak sesuai. Sisa percobaan: " + sisaPercobaan + " kali.",
        "error",
      );
    }

    return;
  }

  // Menyimpan status verifikasi berhasil.
  try {
    sessionStorage.setItem(namaPenyimpanan.sudahVerifikasi, "true");
  } catch (error) {
    tampilkanPesan("Gagal menyimpan status verifikasi.", "error");
    return;
  }

  prosesVerifikasi = true;

  // Menghentikan timer setelah verifikasi berhasil.
  if (timerOTP) {
    clearInterval(timerOTP);
    timerOTP = null;
  }

  // Menonaktifkan tombol verifikasi selama pengalihan.
  const tombolVerifikasi = document.querySelector(".verify-button");

  if (tombolVerifikasi) {
    tombolVerifikasi.disabled = true;
  }

  // Menampilkan pemberitahuan keberhasilan.
  tampilkanPesan(
    "Verifikasi berhasil! Mengarahkan ke halaman kata sandi baru...",
    "success",
  );

  // Mengarahkan pengguna ke halaman kata sandi baru.
  setTimeout(function () {
    window.location.href = "password-baru.html";
  }, 1000);
}

// 20. Membuat kode OTP baru setelah masa berlaku habis.
function kirimUlangOTP() {
  const tombolKirimUlang = document.getElementById("resendButton");

  if (!tombolKirimUlang || tombolKirimUlang.disabled) {
    return;
  }

  // Membuat sesi OTP baru.
  const berhasil = buatSesiOTP();

  if (!berhasil) {
    tampilkanPesan("Gagal membuat kode baru. Silakan coba kembali.", "error");
    return;
  }

  // Mengosongkan kode sebelumnya.
  kosongkanKotakOTP();

  // Menghapus pesan sebelumnya.
  hapusPesanOTP();

  // Menampilkan informasi kode baru.
  tampilkanPesan(
    "Kode OTP baru berhasil dibuat. Silakan periksa Console untuk pengujian.",
    "success",
  );

  // Memulai kembali hitung mundur.
  mulaiTimerOTP();
}

// 21. Menghentikan timer ketika pengguna meninggalkan halaman.
window.addEventListener("pagehide", function () {
  if (timerOTP) {
    clearInterval(timerOTP);
    timerOTP = null;
  }
});
