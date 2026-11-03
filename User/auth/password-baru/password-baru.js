
/* =====================================
   SIPFAS - BUAT KATA SANDI BARU
===================================== */

// Mengambil elemen HTML
const passwordForm = document.getElementById("passwordForm");

const newPassword = document.getElementById("newPassword");

const confirmPassword = document.getElementById("confirmPassword");

const toggleNewPassword = document.getElementById("toggleNewPassword");

const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

const newPasswordError = document.getElementById("newPasswordError");

const confirmPasswordError = document.getElementById("confirmPasswordError");

const formMessage = document.getElementById("formMessage");


// =====================================
// 1. MENAMPILKAN / MENYEMBUNYIKAN PASSWORD
// =====================================

function setupPasswordToggle(button, input) {

    button.addEventListener("click", function () {

        const showPassword = input.type === "password";

        input.type = showPassword ? "text" : "password";

        button.setAttribute(
            "aria-label",
            showPassword
                ? "Sembunyikan kata sandi"
                : "Tampilkan kata sandi"
        );

        button.setAttribute(
            "title",
            showPassword
                ? "Sembunyikan kata sandi"
                : "Tampilkan kata sandi"
        );

    });

}

setupPasswordToggle(toggleNewPassword, newPassword);

setupPasswordToggle(toggleConfirmPassword, confirmPassword);


// =====================================
// 2. MENGECEK SYARAT PASSWORD
// =====================================

function checkPasswordRequirements() {

    const password = newPassword.value;

    const confirmation = confirmPassword.value;

    // Minimal 8 karakter
    const hasLength = password.length >= 8;

    // Huruf besar, kecil, dan angka
    const hasCharacter =
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password);

    // Kedua password cocok
    const hasMatch =
        password.length > 0 &&
        confirmation.length > 0 &&
        password === confirmation;

    // Memperbarui indikator
    document
        .getElementById("requirementLength")
        .classList.toggle("valid", hasLength);

    document
        .getElementById("requirementCharacter")
        .classList.toggle("valid", hasCharacter);

    document
        .getElementById("requirementMatch")
        .classList.toggle("valid", hasMatch);

    return {
        hasLength,
        hasCharacter,
        hasMatch
    };

}


// =====================================
// 3. MENGHAPUS PESAN ERROR
// =====================================

function clearMessages() {

    newPasswordError.textContent = "";

    confirmPasswordError.textContent = "";

    formMessage.textContent = "";

}


// =====================================
// 4. SAAT PASSWORD DIKETIK
// =====================================

newPassword.addEventListener("input", function () {

    clearMessages();

    checkPasswordRequirements();

});

confirmPassword.addEventListener("input", function () {

    clearMessages();

    checkPasswordRequirements();

});


// =====================================
// 5. VALIDASI FORM
// =====================================

passwordForm.addEventListener("submit", function (event) {

    event.preventDefault();

    clearMessages();

    const password = newPassword.value;

    const confirmation = confirmPassword.value;

    const requirements = checkPasswordRequirements();


    // Password kosong
    if (password.trim() === "") {

        newPasswordError.textContent =
            "Kata sandi baru wajib diisi.";

        newPassword.focus();

        return;

    }


    // Minimal 8 karakter
    if (!requirements.hasLength) {

        newPasswordError.textContent =
            "Kata sandi minimal harus 8 karakter.";

        newPassword.focus();

        return;

    }


    // Huruf besar, kecil, dan angka
    if (!requirements.hasCharacter) {

        newPasswordError.textContent =
            "Kata sandi harus mengandung huruf besar, huruf kecil, dan angka.";

        newPassword.focus();

        return;

    }


    // Konfirmasi kosong
    if (confirmation.trim() === "") {

        confirmPasswordError.textContent =
            "Konfirmasi kata sandi wajib diisi.";

        confirmPassword.focus();

        return;

    }


    // Password tidak cocok
    if (!requirements.hasMatch) {

        confirmPasswordError.textContent =
            "Konfirmasi kata sandi tidak cocok.";

        confirmPassword.focus();

        return;

    }


    // Jika seluruh persyaratan terpenuhi
    formMessage.style.color = "#28734a";

    formMessage.textContent =
        "Kata sandi memenuhi seluruh persyaratan.";


    /*
       CATATAN:

       Form ini belum terhubung dengan backend.

       Backend nantinya diperlukan untuk:

       1. Memastikan token pemulihan akun masih valid.
       2. Menyimpan kata sandi baru secara aman.
       3. Melakukan hashing password.
       4. Memperbarui data akun pengguna.
       5. Mengakhiri sesi pemulihan akun.

       Jangan menganggap password sudah tersimpan
       sebelum backend berhasil memprosesnya.
    */

});
