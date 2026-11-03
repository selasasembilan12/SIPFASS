/* =====================================
   SIPFAS - LOGIN JAVASCRIPT
===================================== */

// Mengambil elemen HTML
const loginForm = document.getElementById("loginForm");

const username = document.getElementById("username");
const password = document.getElementById("password");

const usernameError = document.getElementById("usernameError");
const passwordError = document.getElementById("passwordError");

const formMessage = document.getElementById("formMessage");

const togglePassword = document.getElementById("togglePassword");


// =====================================
// 1. TAMPIL / SEMBUNYIKAN PASSWORD
// =====================================

togglePassword.addEventListener("click", function () {

    const showPassword = password.type === "password";

    password.type = showPassword ? "text" : "password";

    togglePassword.setAttribute(
        "aria-label",
        showPassword
            ? "Sembunyikan kata sandi"
            : "Tampilkan kata sandi"
    );

    togglePassword.setAttribute(
        "title",
        showPassword
            ? "Sembunyikan kata sandi"
            : "Tampilkan kata sandi"
    );

});


// =====================================
// 2. VALIDASI FORM LOGIN
// =====================================

loginForm.addEventListener("submit", function (event) {

    event.preventDefault();

    // Menghapus pesan sebelumnya
    usernameError.textContent = "";
    passwordError.textContent = "";
    formMessage.textContent = "";

    let valid = true;


    // Validasi nama pengguna
    if (username.value.trim() === "") {

        usernameError.textContent =
            "Nama pengguna wajib diisi.";

        valid = false;

    }


    // Validasi kata sandi
    if (password.value.trim() === "") {

        passwordError.textContent =
            "Kata sandi wajib diisi.";

        valid = false;

    }


    // Menghentikan proses jika belum valid
    if (!valid) {

        return;

    }


    // Jika semua input sudah terisi
    formMessage.style.color = "#28734a";

    formMessage.textContent =
        "Data login siap diproses.";

    /*
       CATATAN:
       Hubungkan bagian ini dengan API/backend
       autentikasi SIPFAS untuk proses login sebenarnya.
    */

});


// =====================================
// 3. HAPUS ERROR SAAT MENGETIK
// =====================================

username.addEventListener("input", function () {

    usernameError.textContent = "";

    formMessage.textContent = "";

});


password.addEventListener("input", function () {

    passwordError.textContent = "";

    formMessage.textContent = "";

});


// =====================================
// 4. TOMBOL DAFTAR SEKARANG
// =====================================

document.getElementById("registerLink")
    .addEventListener("click", function (event) {

        event.preventDefault();

        formMessage.style.color = "#8995a5";

        formMessage.textContent =
            "Halaman pendaftaran belum dihubungkan.";

    });