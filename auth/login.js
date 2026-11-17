
"use strict";

/**
 * SIPFAS - LOGIN.JS
 * Backend: PHP PDO + MariaDB
 * Autentikasi: Password + OTP
 */

// ============================================================
// 1. KONFIGURASI LOGIN
// ============================================================

const LOGIN_CONFIG = {
    apiUrl: "../api/auth/login.php",
    otpPage: "verifikasi.html"
};

let loginSubmitting = false;
let loginMessageTimer = null;


// ============================================================
// 2. NORMALISASI ROLE
// ============================================================

function normalizeRole(role) {

    const value = String(role || "")
        .trim()
        .toLowerCase();

    const roleMap = {
        admin: "administrator",
        administrator: "administrator",

        petugas: "petugas",
        "petugas sarpras": "petugas",

        pelapor: "pelapor",
        user: "pelapor"
    };

    return roleMap[value] || "";
}


// ============================================================
// 3. INISIALISASI HALAMAN LOGIN
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeLogin
);

function initializeLogin() {

    const form = document.getElementById("loginForm");
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const toggle = document.getElementById("togglePassword");

    // Memastikan elemen form tersedia.
    if (!form || !username || !password) {

        console.error(
            "[SIPFAS] Elemen formulir login tidak ditemukan."
        );

        return;
    }

    // Mengaktifkan validasi input.
    setupLoginFieldValidation();

    // Mengatur fitur tampil/sembunyikan password.
    if (toggle) {

        toggle.addEventListener("click", function () {

            const visible = password.type === "password";

            password.type = visible ? "text" : "password";

            toggle.setAttribute(
                "aria-label",
                visible
                    ? "Sembunyikan kata sandi"
                    : "Tampilkan kata sandi"
            );

            toggle.setAttribute(
                "aria-pressed",
                String(visible)
            );

            password.focus();
        });
    }

    // Menghubungkan form dengan proses login.
    form.addEventListener("submit", handleLogin);

    console.log(
        "[SIPFAS] Login berhasil diinisialisasi."
    );
}


// ============================================================
// 4. MENAMPILKAN NOTIFIKASI
// ============================================================

function showLoginMessage(message, type = "error") {

    clearLoginMessage();

    const element = document.createElement("div");

    element.id = "loginMessage";
    element.className = "login-message " + type;

    element.setAttribute(
        "role",
        type === "error" ? "alert" : "status"
    );

    element.setAttribute("aria-live", "polite");

    const icon = document.createElement("span");

    icon.className = "login-message-icon";
    icon.setAttribute("aria-hidden", "true");

    const icons = {
        error: "!",
        success: "✓",
        info: "i"
    };

    icon.textContent = icons[type] || "i";

    const text = document.createElement("span");

    text.className = "login-message-text";
    text.textContent = message;

    element.append(icon, text);

    document.body.appendChild(element);

    loginMessageTimer = setTimeout(
        clearLoginMessage,
        5000
    );
}


// ============================================================
// 5. MENGHAPUS NOTIFIKASI
// ============================================================

function clearLoginMessage() {

    if (loginMessageTimer !== null) {

        clearTimeout(loginMessageTimer);

        loginMessageTimer = null;
    }

    const message = document.getElementById("loginMessage");

    if (message) {
        message.remove();
    }
}


// ============================================================
// 6. VALIDASI PERUBAHAN INPUT
// ============================================================

function setupLoginFieldValidation() {

    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const role = document.getElementById("jenisPengguna");

    [username, password, role].forEach(function (element) {

        if (!element) return;

        element.addEventListener("input", function () {

            clearPasswordError();
            clearLoginMessage();
        });

        element.addEventListener("change", function () {

            clearPasswordError();
            clearLoginMessage();
        });
    });
}


// ============================================================
// 7. INDIKATOR PASSWORD SALAH
// ============================================================

function setPasswordError() {

    const password = document.getElementById("password");

    const wrapper = password
        ? password.closest(".input-wrapper")
        : null;

    if (wrapper) {
        wrapper.classList.add("input-error");
    }
}

function clearPasswordError() {

    const password = document.getElementById("password");

    const wrapper = password
        ? password.closest(".input-wrapper")
        : null;

    if (wrapper) {
        wrapper.classList.remove("input-error");
    }
}


// ============================================================
// 8. MENGATUR STATUS TOMBOL LOGIN
// ============================================================

function setLoginButtonLoading(loading) {

    const button = document.querySelector(".login-button");

    if (!button) return;

    const label = button.querySelector("span");

    button.disabled = loading;

    if (label) {

        label.textContent = loading
            ? "Memproses..."
            : "Masuk";
    }

    button.setAttribute(
        "aria-busy",
        String(loading)
    );
}


// ============================================================
// 9. MEMBACA RESPONS DARI PHP
// ============================================================

async function readApiResponse(response) {

    // Membaca respons sebagai teks terlebih dahulu.
    const raw = await response.text();

    // Memeriksa respons kosong.
    if (!raw.trim()) {

        console.error(
            "[SIPFAS] Respons PHP kosong.",
            "HTTP:",
            response.status,
            "URL:",
            response.url
        );

        throw new Error(
            "PHP mengirim respons kosong. Periksa Apache error.log dan PHP error.log."
        );
    }

    // Mengubah respons menjadi JSON.
    try {

        return JSON.parse(raw);

    } catch (error) {

        console.error(
            "[SIPFAS] Respons bukan JSON:",
            raw.substring(0, 1000)
        );

        throw new Error(
            "PHP menghasilkan respons bukan JSON. Periksa konfigurasi API dan error log."
        );
    }
}


// ============================================================
// 10. PROSES LOGIN
// ============================================================

async function handleLogin(event) {

    event.preventDefault();

    // Mencegah permintaan login ganda.
    if (loginSubmitting) return;

    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const roleInput = document.getElementById("jenisPengguna");

    // Memastikan elemen tersedia.
    if (!usernameInput || !passwordInput || !roleInput) {

        showLoginMessage(
            "Komponen formulir login tidak lengkap."
        );

        return;
    }

    // Mengambil nilai formulir.
    const identifier = usernameInput.value.trim();

    const password = passwordInput.value;

    const selectedRole = normalizeRole(
        roleInput.value
    );

    clearPasswordError();
    clearLoginMessage();


    // ========================================================
    // 10.1. VALIDASI INPUT
    // ========================================================

    if (!identifier || !password || !selectedRole) {

        showLoginMessage(
            "Username/email, password, dan jenis pengguna wajib diisi."
        );

        return;
    }

    if (identifier.length > 150) {

        showLoginMessage(
            "Username atau email terlalu panjang."
        );

        return;
    }

    if (password.length > 4096) {

        showLoginMessage(
            "Password melebihi batas yang diperbolehkan."
        );

        return;
    }


    // ========================================================
    // 10.2. MENGAKTIFKAN LOADING
    // ========================================================

    loginSubmitting = true;

    setLoginButtonLoading(true);


    try {

        // ====================================================
        // 10.3. MENGIRIM DATA KE LOGIN.PHP
        // ====================================================

        const response = await fetch(
            LOGIN_CONFIG.apiUrl,
            {
                method: "POST",

                credentials: "same-origin",

                cache: "no-store",

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


        // ====================================================
        // 10.4. MEMBACA RESPONS SERVER
        // ====================================================

        const result = await readApiResponse(response);


        // ====================================================
        // 10.5. MEMERIKSA STATUS LOGIN
        // ====================================================

        if (!response.ok || result.success !== true) {

            // Memberikan indikator apabila password salah.
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


        // ====================================================
        // 10.6. MEMERIKSA STATUS OTP
        // ====================================================

        if (
            !result.data ||
            result.data.requires_otp !== true
        ) {

            throw new Error(
                "Server belum memberikan status verifikasi OTP."
            );
        }


        // ====================================================
        // 10.7. MEMERIKSA ALAMAT HALAMAN OTP
        // ====================================================

        const redirect =
            result.data.redirect || LOGIN_CONFIG.otpPage;

        if (redirect !== LOGIN_CONFIG.otpPage) {

            throw new Error(
                "Alamat halaman verifikasi OTP tidak valid."
            );
        }


        // ====================================================
        // 10.8. MENAMPILKAN NOTIFIKASI BERHASIL
        // ====================================================

        showLoginMessage(
            result.message ||
            "OTP berhasil dikirim ke email Anda.",
            "success"
        );


        // ====================================================
        // 10.9. MENGARAHKAN KE HALAMAN OTP
        // ====================================================

        // Session tetap dikelola oleh PHP.
        // Tidak menggunakan LocalStorage sebagai autentikasi.

        window.setTimeout(function () {

            window.location.assign(
                LOGIN_CONFIG.otpPage
            );

        }, 500);


    } catch (error) {

        // Mencatat error untuk pemeriksaan developer.
        console.error(
            "[SIPFAS LOGIN ERROR]",
            error
        );

        showLoginMessage(
            error.message ||
            "Terjadi kesalahan saat menghubungi server."
        );

        // Mengaktifkan kembali tombol jika login gagal.
        loginSubmitting = false;

        setLoginButtonLoading(false);
    }
}


// ============================================================
// 11. AKHIR LOGIN.JS
// ============================================================
