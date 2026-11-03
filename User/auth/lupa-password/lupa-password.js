/* =====================================
   SIPFAS - LUPA KATA SANDI
===================================== */

// Mengambil elemen HTML
const forgotForm = document.getElementById("forgotForm");

const email = document.getElementById("email");

const emailError = document.getElementById("emailError");

const formMessage = document.getElementById("formMessage");


// =====================================
// 1. VALIDASI FORMAT EMAIL
// =====================================

function isValidEmail(value) {

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailPattern.test(value);

}


// =====================================
// 2. MENGHAPUS PESAN
// =====================================

function clearMessages() {

    emailError.textContent = "";

    formMessage.textContent = "";

}


// =====================================
// 3. HAPUS ERROR SAAT MENGETIK
// =====================================

email.addEventListener("input", function () {

    clearMessages();

});


// =====================================
// 4. VALIDASI FORM
// =====================================

forgotForm.addEventListener("submit", function (event) {

    event.preventDefault();

    clearMessages();

    const emailValue = email.value.trim();


    // Jika email kosong
    if (emailValue === "") {

        emailError.textContent =
            "Email terdaftar wajib diisi.";

        email.focus();

        return;

    }


    // Jika format email salah
    if (!isValidEmail(emailValue)) {

        emailError.textContent =
            "Masukkan alamat email yang valid.";

        email.focus();

        return;

    }


    // Jika format email benar
    formMessage.style.color = "#28734a";

    formMessage.textContent =
        "Jika email terdaftar, kode verifikasi akan dikirimkan.";


    /*
       CATATAN:

       Form ini belum terhubung dengan backend.

       Backend nantinya harus:

       1. Menerima alamat email pengguna.
       2. Memproses permintaan pemulihan akun.
       3. Mengirim kode OTP jika akun memenuhi syarat.
       4. Menghindari pengungkapan status akun.
       5. Membatasi jumlah permintaan kode OTP.

       Jangan menyatakan bahwa email berhasil dikirim
       sebelum backend benar-benar memprosesnya.
    */

});