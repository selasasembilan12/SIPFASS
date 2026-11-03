
/* =====================================
   SIPFAS - REGISTER JAVASCRIPT
===================================== */

const registerForm = document.getElementById("registerForm");

const fullName = document.getElementById("fullName");
const nim = document.getElementById("nim");
const username = document.getElementById("username");
const email = document.getElementById("email");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");

const togglePassword = document.getElementById("togglePassword");
const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

const fullNameError = document.getElementById("fullNameError");
const nimError = document.getElementById("nimError");
const usernameError = document.getElementById("usernameError");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const confirmPasswordError = document.getElementById("confirmPasswordError");

const formMessage = document.getElementById("formMessage");


// =====================================
// 1. TAMPIL / SEMBUNYIKAN PASSWORD
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

        const icon = button.querySelector("svg");

        if (showPassword) {

            icon.innerHTML = `
                <path d="M2 12C4.2 7.8 7.7 5.5 12 5.5
                C16.3 5.5 19.8 7.8 22 12
                C19.8 16.2 16.3 18.5 12 18.5
                C7.7 18.5 4.2 16.2 2 12Z"
                stroke="currentColor" stroke-width="1.6"/>

                <circle cx="12" cy="12" r="3"
                stroke="currentColor" stroke-width="1.6"/>
            `;

        } else {

            icon.innerHTML = `
                <path d="M2 12C4.2 7.8 7.7 5.5 12 5.5
                C16.3 5.5 19.8 7.8 22 12
                C19.8 16.2 16.3 18.5 12 18.5
                C7.7 18.5 4.2 16.2 2 12Z"
                stroke="currentColor" stroke-width="1.6"/>

                <circle cx="12" cy="12" r="3"
                stroke="currentColor" stroke-width="1.6"/>

                <path d="M3 3L21 21"
                stroke="currentColor" stroke-width="1.6"
                stroke-linecap="round"/>
            `;
        }
    });
}

setupPasswordToggle(togglePassword, password);
setupPasswordToggle(toggleConfirmPassword, confirmPassword);


// =====================================
// 2. MENGHAPUS PESAN ERROR
// =====================================

function clearErrors() {

    fullNameError.textContent = "";
    nimError.textContent = "";
    usernameError.textContent = "";
    emailError.textContent = "";
    passwordError.textContent = "";
    confirmPasswordError.textContent = "";
    formMessage.textContent = "";
}


// =====================================
// 3. HAPUS ERROR SAAT MENGETIK
// =====================================

[
    fullName,
    nim,
    username,
    email,
    password,
    confirmPassword
].forEach(function (input) {

    input.addEventListener("input", clearErrors);

});


// =====================================
// 4. VALIDASI FORM REGISTER
// =====================================

registerForm.addEventListener("submit", function (event) {

    event.preventDefault();

    clearErrors();

    let valid = true;

    const nameValue = fullName.value.trim();
    const nimValue = nim.value.trim();
    const usernameValue = username.value.trim();
    const emailValue = email.value.trim();
    const passwordValue = password.value;
    const confirmValue = confirmPassword.value;


    // NAMA LENGKAP
    if (nameValue === "") {
        fullNameError.textContent = "Nama lengkap wajib diisi.";
        valid = false;
    }


    // NIM
    if (nimValue === "") {
        nimError.textContent = "NIM wajib diisi.";
        valid = false;
    } else if (!/^[0-9]+$/.test(nimValue)) {
        nimError.textContent = "NIM harus berupa angka.";
        valid = false;
    }


    // USERNAME
    if (usernameValue === "") {
        usernameError.textContent = "Nama pengguna wajib diisi.";
        valid = false;
    } else if (!/^[a-zA-Z0-9._]+$/.test(usernameValue)) {
        usernameError.textContent =
            "Nama pengguna hanya boleh menggunakan huruf, angka, titik, dan garis bawah.";
        valid = false;
    }


    // EMAIL
    if (emailValue === "") {
        emailError.textContent = "Email wajib diisi.";
        valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
        emailError.textContent = "Format email tidak valid.";
        valid = false;
    }


    // PASSWORD
    if (passwordValue.trim() === "") {
        passwordError.textContent = "Kata sandi wajib diisi.";
        valid = false;
    } else if (passwordValue.length < 8) {
        passwordError.textContent = "Kata sandi minimal 8 karakter.";
        valid = false;
    }


    // KONFIRMASI PASSWORD
    if (confirmValue.trim() === "") {
        confirmPasswordError.textContent =
            "Konfirmasi kata sandi wajib diisi.";
        valid = false;
    } else if (passwordValue !== confirmValue) {
        confirmPasswordError.textContent =
            "Kata sandi tidak cocok.";
        valid = false;
    }


    if (!valid) {
        return;
    }


    formMessage.style.color = "#28734a";
    formMessage.textContent =
        "Data pendaftaran berhasil divalidasi.";

    /*
       Backend diperlukan untuk:
       1. Memeriksa NIM duplikat.
       2. Memeriksa username duplikat.
       3. Memeriksa email duplikat.
       4. Hashing password.
       5. Menyimpan data ke database.
       6. Verifikasi akun.
    */

});
