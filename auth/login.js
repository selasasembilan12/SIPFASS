
"use strict";

/* ============================================================
   SIPFAS - LOGIN.JS
   Sistem Login Berbasis PHP PDO dan MariaDB

   Fitur:
   1. Login Administrator.
   2. Login Petugas Sarpras.
   3. Login Pelapor.
   4. Login menggunakan username atau email.
   5. Validasi autentikasi melalui database.
   6. Tampil/sembunyikan password.
   7. Notifikasi top-center.
   8. Indikator kesalahan input.
   9. Pengalihan menuju verifikasi OTP.

   CATATAN:
   Tidak menggunakan LocalStorage untuk autentikasi.
   Tidak menggunakan SessionStorage untuk autentikasi.
   Session dikelola oleh PHP.
============================================================ */


/* ============================================================
   01. KONFIGURASI API
============================================================ */

const LOGIN_CONFIG = {

    // Lokasi login.php relatif terhadap halaman login.html.
    apiUrl: "../api/auth/login.php",

    // Halaman verifikasi OTP.
    otpPage: "verifikasi-otp.html"

};


/* ============================================================
   02. VARIABEL GLOBAL
============================================================ */

let loginSubmitting = false;

let loginMessageTimer = null;


/* ============================================================
   03. NORMALISASI ROLE
============================================================ */

function normalizeRole(role) {

    const value = String(role || "")
        .trim()
        .toLowerCase();

    const roleMap = {

        "admin": "administrator",

        "administrator": "administrator",

        "petugas": "petugas",

        "petugas sarpras": "petugas",

        "pelapor": "pelapor",

        "user": "pelapor"

    };

    return roleMap[value] || "";

}


/* ============================================================
   04. INISIALISASI LOGIN
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    initializeLogin
);


function initializeLogin() {

    const form = document.getElementById("loginForm");

    const username = document.getElementById("username");

    const password = document.getElementById("password");

    const toggle = document.getElementById("togglePassword");


    // Memeriksa elemen formulir.

    if (!form || !username || !password) {

        console.error(
            "[SIPFAS] Elemen formulir login tidak ditemukan."
        );

        return;

    }


    // Mengaktifkan validasi input.

    setupLoginFieldValidation();


    // Mengaktifkan tombol tampil/sembunyikan password.

    if (toggle) {

        toggle.addEventListener("click", function () {

            const isPassword =
                password.type === "password";

            password.type = isPassword
                ? "text"
                : "password";


            toggle.setAttribute(
                "aria-label",
                isPassword
                    ? "Sembunyikan kata sandi"
                    : "Tampilkan kata sandi"
            );


            password.focus();

        });

    }


    // Mengaktifkan proses login.

    form.addEventListener(
        "submit",
        handleLogin
    );


    console.log(
        "[SIPFAS] Sistem login berhasil diinisialisasi."
    );

}


/* ============================================================
   05. NOTIFIKASI LOGIN
============================================================ */

function showLoginMessage(
    message,
    type = "error"
) {

    clearLoginMessage();


    const element = document.createElement("div");

    element.id = "loginMessage";

    element.className = "login-message " + type;


    element.setAttribute(
        "role",
        type === "error" ? "alert" : "status"
    );

    element.setAttribute(
        "aria-live",
        "polite"
    );


    const icon = document.createElement("span");

    icon.className = "login-message-icon";

    icon.setAttribute(
        "aria-hidden",
        "true"
    );


    const icons = {

        error: "!",

        success: "✓",

        info: "i"

    };


    icon.textContent = icons[type] || "i";


    const text = document.createElement("span");

    text.className = "login-message-text";

    text.textContent = message;


    element.append(
        icon,
        text
    );


    document.body.appendChild(element);


    loginMessageTimer = setTimeout(function () {

        clearLoginMessage();

    }, 5000);

}


/* ============================================================
   06. MENGHAPUS NOTIFIKASI
============================================================ */

function clearLoginMessage() {

    if (loginMessageTimer !== null) {

        clearTimeout(loginMessageTimer);

        loginMessageTimer = null;

    }


    const message = document.getElementById(
        "loginMessage"
    );


    if (message) {

        message.remove();

    }

}


/* ============================================================
   07. INDIKATOR ERROR PASSWORD
============================================================ */

function setPasswordError() {

    const password = document.getElementById(
        "password"
    );


    const wrapper = password
        ? password.closest(".input-wrapper")
        : null;


    if (wrapper) {

        wrapper.classList.add("input-error");

    }

}


function clearPasswordError() {

    const password = document.getElementById(
        "password"
    );


    const wrapper = password
        ? password.closest(".input-wrapper")
        : null;


    if (wrapper) {

        wrapper.classList.remove("input-error");

    }

}


/* ============================================================
   08. VALIDASI PERUBAHAN INPUT
============================================================ */

function setupLoginFieldValidation() {

    const username = document.getElementById(
        "username"
    );

    const password = document.getElementById(
        "password"
    );

    const role = document.getElementById(
        "jenisPengguna"
    );


    if (username) {

        username.addEventListener(
            "input",
            function () {

                clearPasswordError();

                clearLoginMessage();

            }
        );

    }


    if (password) {

        password.addEventListener(
            "input",
            function () {

                clearPasswordError();

                clearLoginMessage();

            }
        );

    }


    if (role) {

        role.addEventListener(
            "change",
            function () {

                clearPasswordError();

                clearLoginMessage();

            }
        );

    }

}


/* ============================================================
   09. STATUS TOMBOL LOGIN
============================================================ */

function setLoginButtonLoading(loading) {

    const button = document.querySelector(
        ".login-button"
    );


    if (!button) {

        return;

    }


    const label = button.querySelector("span");


    if (loading) {

        button.disabled = true;

        if (label) {

            label.textContent = "Memproses...";

        }

    } else {

        button.disabled = false;

        if (label) {

            label.textContent = "Masuk";

        }

    }

}


/* ============================================================
   10. PROSES LOGIN KE DATABASE MELALUI PHP
============================================================ */

async function handleLogin(event) {

    event.preventDefault();


    // Mencegah pengiriman login berulang.

    if (loginSubmitting) {

        return;

    }


    // Mengambil elemen formulir.

    const usernameInput = document.getElementById(
        "username"
    );

    const passwordInput = document.getElementById(
        "password"
    );

    const roleInput = document.getElementById(
        "jenisPengguna"
    );


    if (!usernameInput || !passwordInput || !roleInput) {

        showLoginMessage(
            "Komponen formulir login tidak lengkap.",
            "error"
        );

        return;

    }


    // Mengambil nilai formulir.

    const identifier = usernameInput.value
        .trim()
        .toLowerCase();

    const password = passwordInput.value;

    const selectedRole = normalizeRole(
        roleInput.value
    );


    clearPasswordError();

    clearLoginMessage();


    // Validasi input.

    if (
        identifier === "" ||
        password === "" ||
        selectedRole === ""
    ) {

        showLoginMessage(
            "Username/email, password, dan jenis pengguna wajib diisi.",
            "error"
        );

        return;

    }


    if (identifier.length > 150) {

        showLoginMessage(
            "Username atau email terlalu panjang.",
            "error"
        );

        return;

    }


    // Memulai proses autentikasi.

    loginSubmitting = true;

    setLoginButtonLoading(true);


    try {

        /* ====================================================
           MENGIRIM REQUEST KE LOGIN.PHP
        ==================================================== */

        const response = await fetch(
            LOGIN_CONFIG.apiUrl,
            {

                method: "POST",

                credentials: "same-origin",

                headers: {

                    "Content-Type": "application/json",

                    "Accept": "application/json"

                },

                body: JSON.stringify({

                    identifier: identifier,

                    password: password,

                    role: selectedRole

                })

            }
        );


        /* ====================================================
           MEMBACA RESPONSE SERVER
        ==================================================== */

        let result;

        try {

            result = await response.json();

        } catch (error) {

            throw new Error(
                "Server tidak memberikan respons JSON yang valid."
            );

        }


        /* ====================================================
           MEMERIKSA HASIL LOGIN
        ==================================================== */

        if (!response.ok || !result.success) {

            if (response.status === 401) {

                setPasswordError();

                passwordInput.value = "";

                passwordInput.focus();

            }

            throw new Error(
                result.message ||
                "Login gagal. Periksa kembali data Anda."
            );

        }


        /* ====================================================
           MEMERIKSA STATUS OTP
        ==================================================== */

        if (
            !result.data ||
            result.data.requires_otp !== true
        ) {

            throw new Error(
                "Proses autentikasi OTP tidak tersedia."
            );

        }


        /* ====================================================
           LOGIN BERHASIL - MENUNGGU VERIFIKASI OTP
        ==================================================== */

        showLoginMessage(
            "Login berhasil. Silakan lanjutkan verifikasi OTP.",
            "success"
        );


        /* ====================================================
           PENGALIHAN KE HALAMAN OTP
        ==================================================== */

        const redirectUrl =
            result.data.redirect || LOGIN_CONFIG.otpPage;


        setTimeout(function () {

            window.location.href = redirectUrl;

        }, 500);


    } catch (error) {

        console.error(
            "[SIPFAS LOGIN ERROR]",
            error
        );


        showLoginMessage(
            error.message ||
            "Terjadi kesalahan saat menghubungi server.",
            "error"
        );


        loginSubmitting = false;

        setLoginButtonLoading(false);

    }

}


/* ============================================================
   11. AKHIR PROGRAM LOGIN.JS
============================================================ */
