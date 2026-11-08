/* SIPFAS - BUAT KATA SANDI BARU */

//01. Menjalankan JavaScript setelah halaman selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  mulaiPasswordBaru();
});

//02. Menentukan nama penyimpanan sesi pemulihan akun.
const KUNCI_PEMULIHAN = {
  email: "sipfasRecoveryEmail",
  otp: "sipfasRecoveryOtp",
  kedaluwarsa: "sipfasRecoveryOtpExpiresAt",
  terverifikasi: "sipfasRecoveryVerified",
  percobaan: "sipfasRecoveryAttempts",
  berhasil: "sipfasPasswordResetSuccess",
};

//03. Menyiapkan variabel elemen dan formulir.
let formulirPassword;
let inputPasswordBaru;
let inputKonfirmasi;
let tombolSimpan;
let pesanPassword;
let daftarSyarat;

//04. Menginisialisasi seluruh fitur halaman password baru.
function mulaiPasswordBaru() {
  formulirPassword = document.getElementById("passwordForm");
  inputPasswordBaru = document.getElementById("newPassword");
  inputKonfirmasi = document.getElementById("confirmPassword");
  tombolSimpan = document.querySelector(".save-button");
  daftarSyarat = document.querySelectorAll(".security-list li");

  if (!formulirPassword || !inputPasswordBaru || !inputKonfirmasi) {
    console.error("Elemen halaman password baru tidak ditemukan.");
    return;
  }

  // Memastikan pengguna sudah melewati verifikasi OTP.
  if (!periksaVerifikasiOTP()) {
    tampilkanPesanPassword(
      "Akses ditolak. Silakan lakukan verifikasi OTP terlebih dahulu.",
      "error",
    );

    nonaktifkanFormulir();
    return;
  }

  // Membuat tempat untuk menampilkan pesan hasil validasi.
  buatTempatPesan();

  // Mengaktifkan tombol tampilkan dan sembunyikan password.
  aktifkanTombolPassword();

  // Memeriksa persyaratan password setiap kali pengguna mengetik.
  inputPasswordBaru.addEventListener("input", perbaruiSyaratPassword);

  // Memeriksa kecocokan password setiap kali pengguna mengetik konfirmasi.
  inputKonfirmasi.addEventListener("input", perbaruiSyaratPassword);

  // Menangani proses penyimpanan password baru.
  formulirPassword.addEventListener("submit", function (event) {
    event.preventDefault();
    simpanPasswordBaru();
  });

  // Menampilkan seluruh syarat keamanan dalam kondisi awal.
  perbaruiSyaratPassword();

  console.log("Halaman Password Baru SIPFAS siap digunakan.");
}

//05. Memeriksa apakah pengguna sudah berhasil memverifikasi OTP.
function periksaVerifikasiOTP() {
  try {
    const statusVerifikasi = sessionStorage.getItem(
      KUNCI_PEMULIHAN.terverifikasi,
    );

    return statusVerifikasi === "true";
  } catch (error) {
    console.error("Gagal memeriksa verifikasi OTP:", error);
    return false;
  }
}

//06. Membuat tempat untuk menampilkan pesan validasi.
function buatTempatPesan() {
  pesanPassword = document.getElementById("passwordMessage");

  if (!pesanPassword) {
    pesanPassword = document.createElement("p");

    pesanPassword.id = "passwordMessage";
    pesanPassword.setAttribute("role", "status");
    pesanPassword.setAttribute("aria-live", "polite");

    pesanPassword.style.fontSize = "12px";
    pesanPassword.style.lineHeight = "1.5";
    pesanPassword.style.textAlign = "center";
    pesanPassword.style.margin = "0 0 12px";

    const kotakKeamanan = document.querySelector(".security-box");

    if (kotakKeamanan) {
      formulirPassword.insertBefore(pesanPassword, kotakKeamanan);
    } else {
      formulirPassword.appendChild(pesanPassword);
    }
  }
}

//07. Menampilkan pesan informasi, kesalahan, atau keberhasilan.
function tampilkanPesanPassword(pesan, jenis) {
  if (!pesanPassword) {
    buatTempatPesan();
  }

  if (!pesanPassword) return;

  pesanPassword.textContent = pesan;

  if (jenis === "error") {
    pesanPassword.style.color = "#dc4545";
  } else if (jenis === "success") {
    pesanPassword.style.color = "#28734a";
  } else {
    pesanPassword.style.color = "#52627b";
  }
}

//08. Mengaktifkan fitur tampilkan dan sembunyikan password.
function aktifkanTombolPassword() {
  const ikonMata = document.querySelectorAll(".eye-icon");

  ikonMata.forEach(function (ikon) {
    const input = ikon.parentElement.querySelector("input");

    if (!input) return;

    // Mengubah ikon menjadi tombol yang dapat diakses.
    ikon.setAttribute("role", "button");
    ikon.setAttribute("tabindex", "0");
    ikon.setAttribute("aria-hidden", "false");
    ikon.setAttribute("aria-label", "Tampilkan kata sandi");

    // Mengubah tipe input ketika ikon diklik.
    ikon.addEventListener("click", function () {
      ubahTampilanPassword(input, ikon);
    });

    // Mendukung penggunaan tombol Enter dan Spasi.
    ikon.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        ubahTampilanPassword(input, ikon);
      }
    });
  });
}

//09. Mengubah password menjadi terlihat atau tersembunyi.
function ubahTampilanPassword(input, ikon) {
  const passwordTerlihat = input.type === "text";

  input.type = passwordTerlihat ? "password" : "text";

  ikon.setAttribute(
    "aria-label",
    passwordTerlihat ? "Tampilkan kata sandi" : "Sembunyikan kata sandi",
  );
}

//10. Memeriksa seluruh persyaratan keamanan password.
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

//11. Memperbarui indikator syarat keamanan password.
function perbaruiSyaratPassword() {
  const syarat = periksaSyaratPassword();

  const statusSyarat = [
    syarat.cukupKarakter,
    syarat.adaHurufBesar && syarat.adaHurufKecil && syarat.adaAngka,
    syarat.passwordCocok,
  ];

  daftarSyarat.forEach(function (item, index) {
    const lingkaran = item.querySelector(".requirement-circle");

    if (!lingkaran) return;

    if (statusSyarat[index]) {
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

  // Menghapus pesan lama ketika pengguna memperbaiki input.
  if (pesanPassword && pesanPassword.textContent) {
    tampilkanPesanPassword("", "");
  }
}

//12. Memeriksa kelengkapan dan keamanan password sebelum disimpan.
function validasiPasswordBaru() {
  const password = inputPasswordBaru.value;
  const konfirmasi = inputKonfirmasi.value;
  const syarat = periksaSyaratPassword();

  if (!password.trim()) {
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

//13. Memproses penyimpanan kata sandi baru.
function simpanPasswordBaru() {
  // Memastikan status OTP masih terverifikasi.
  if (!periksaVerifikasiOTP()) {
    tampilkanPesanPassword(
      "Sesi verifikasi tidak ditemukan. Silakan ulangi pemulihan akun.",
      "error",
    );

    nonaktifkanFormulir();
    return;
  }

  // Memeriksa seluruh persyaratan password.
  if (!validasiPasswordBaru()) {
    return;
  }

  // Menampilkan informasi bahwa simulasi berhasil.
  tampilkanPesanPassword(
    "Kata sandi berhasil divalidasi. Mengarahkan Anda ke halaman login...",
    "success",
  );

  // Menonaktifkan tombol agar tidak diklik berulang kali.
  tombolSimpan.disabled = true;
  tombolSimpan.style.opacity = "0.7";
  tombolSimpan.style.cursor = "not-allowed";

  // Menyimpan tanda bahwa proses simulasi reset berhasil.
  try {
    sessionStorage.setItem(KUNCI_PEMULIHAN.berhasil, "true");

    // Menghapus sesi OTP setelah proses selesai.
    sessionStorage.removeItem(KUNCI_PEMULIHAN.otp);
    sessionStorage.removeItem(KUNCI_PEMULIHAN.kedaluwarsa);
    sessionStorage.removeItem(KUNCI_PEMULIHAN.terverifikasi);
    sessionStorage.removeItem(KUNCI_PEMULIHAN.percobaan);

    // Mengarahkan pengguna kembali ke halaman login.
    setTimeout(function () {
      window.location.href = "login.html";
    }, 1500);
  } catch (error) {
    console.error("Gagal menyelesaikan proses reset password:", error);

    tampilkanPesanPassword("Terjadi kesalahan. Silakan coba kembali.", "error");

    tombolSimpan.disabled = false;
    tombolSimpan.style.opacity = "1";
    tombolSimpan.style.cursor = "pointer";
  }
}

//14. Menonaktifkan formulir jika verifikasi OTP belum berhasil.
function nonaktifkanFormulir() {
  const semuaInput = formulirPassword.querySelectorAll("input");

  semuaInput.forEach(function (input) {
    input.disabled = true;
  });

  if (tombolSimpan) {
    tombolSimpan.disabled = true;
    tombolSimpan.style.opacity = "0.5";
    tombolSimpan.style.cursor = "not-allowed";
  }
}
