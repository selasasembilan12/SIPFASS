
/* ============================================================
   SIPFAS - LOGIN.JS
   Login untuk Pelapor, Petugas, dan Administrator.
   ============================================================ */

document.addEventListener("DOMContentLoaded", initializeLogin);

const LOGIN_CONFIG = {
    userKey: "sipfasUsers",
    pendingKey: "sipfasPendingLogin",
    emailKey: "sipfasLoginEmail",
    otpKey: "sipfasLoginOtp",
    expiryKey: "sipfasLoginOtpExpiresAt",
    attemptsKey: "sipfasLoginAttempts",
    verifiedKey: "sipfasLoginVerified",
    activeKey: "sipfasActiveUser"
};

// Normalisasi nama role agar konsisten.
function normalizeRole(role) {
    const value = String(role || "").trim().toLowerCase();

    const roles = {
        pelapor: "pelapor",
        user: "pelapor",
        petugas: "petugas",
        admin: "administrator",
        administrator: "administrator"
    };

    return roles[value] || "";
}

function initializeLogin() {
    const form = document.getElementById("loginForm");
    const password = document.getElementById("password");
    const toggle = document.getElementById("togglePassword");

    if (!form) {
        console.error("Form login tidak ditemukan.");
        return;
    }

    // Tampilkan/sembunyikan password.
    toggle?.addEventListener("click", function () {
        const visible = password.type === "password";

        password.type = visible ? "text" : "password";

        toggle.setAttribute(
            "aria-label",
            visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
        );
    });

    form.addEventListener("submit", handleLogin);

    console.log("[SIPFAS] Login siap.");
}

// Membaca akun dari localStorage.
function getUsers() {
    try {
        const data = localStorage.getItem(LOGIN_CONFIG.userKey);

        if (!data) return [];

        const users = JSON.parse(data);

        return Array.isArray(users) ? users : null;

    } catch (error) {
        console.error("Kesalahan membaca akun:", error);
        return null;
    }
}

// Menampilkan pesan login.
function showLoginMessage(message, type = "error") {
    let element = document.getElementById("loginMessage");

    if (!element) {
        element = document.createElement("p");
        element.id = "loginMessage";
        element.setAttribute("role", "status");
        element.setAttribute("aria-live", "polite");

        element.style.cssText =
            "font-size:13px;text-align:center;margin:12px 0;";

        const form = document.getElementById("loginForm");
        const button = form.querySelector(".login-button");

        form.insertBefore(element, button);
    }

    element.textContent = message;
    element.style.color =
        type === "success" ? "#28734a" : "#dc4545";
}

// Proses login.
function handleLogin(event) {
    event.preventDefault();

    const identifier = document.getElementById("username")
        .value.trim().toLowerCase();

    const password = document.getElementById("password").value;

    const selectedRole = normalizeRole(
        document.getElementById("jenisPengguna").value
    );

    if (!identifier || !password || !selectedRole) {
        showLoginMessage(
            "Lengkapi username, password, dan jenis pengguna."
        );
        return;
    }

    const users = getUsers();

    if (users === null) {
        showLoginMessage("Data akun tidak dapat dibaca.");
        return;
    }

    // Pencocokan username/email, password, dan role.
    const user = users.find(account => {
        const username = String(account.username || "")
            .trim().toLowerCase();

        const email = String(account.email || "")
            .trim().toLowerCase();

        const accountRole = normalizeRole(account.role);

        return (
            (identifier === username || identifier === email) &&
            password === String(account.password || "") &&
            selectedRole === accountRole
        );
    });

    if (!user) {
        showLoginMessage(
            "Akun tidak ditemukan atau username, password, dan role tidak sesuai."
        );

        document.getElementById("password").value = "";
        return;
    }

    // Data sementara untuk OTP.
    const pendingUser = {
        id: user.id || "",
        name: user.name || user.fullName || "",
        username: user.username || "",
        email: user.email || "",
        role: normalizeRole(user.role)
    };

    try {
        // Membersihkan sesi lama tanpa menghapus akun.
        [
            LOGIN_CONFIG.pendingKey,
            LOGIN_CONFIG.emailKey,
            LOGIN_CONFIG.otpKey,
            LOGIN_CONFIG.expiryKey,
            LOGIN_CONFIG.attemptsKey,
            LOGIN_CONFIG.verifiedKey
        ].forEach(key => sessionStorage.removeItem(key));

        sessionStorage.setItem(
            LOGIN_CONFIG.pendingKey,
            JSON.stringify(pendingUser)
        );

        sessionStorage.setItem(
            LOGIN_CONFIG.emailKey,
            pendingUser.email
        );

        showLoginMessage(
            "Login berhasil. Lanjutkan verifikasi OTP.",
            "success"
        );

        const button = document.querySelector(".login-button");

        if (button) {
            button.disabled = true;
            const label = button.querySelector("span");
            if (label) label.textContent = "Memproses...";
        }

        setTimeout(() => {
            window.location.href = "verifikasi.html";
        }, 500);

    } catch (error) {
        console.error(error);
        showLoginMessage("Gagal membuat sesi login.");
    }
}
