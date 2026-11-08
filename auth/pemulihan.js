
/* ============================================================
   SIPFAS - PEMULIHAN.JS
   Memvalidasi email dan memulai pemulihan kata sandi.
   ============================================================ */

document.addEventListener("DOMContentLoaded", initializeRecovery);

const RECOVERY_CONFIG = {
    users: "sipfasUsers",
    email: "sipfasRecoveryEmail",
    otp: "sipfasRecoveryOtp",
    expiry: "sipfasRecoveryOtpExpiresAt",
    verified: "sipfasRecoveryVerified",
    attempts: "sipfasRecoveryAttempts",
    success: "sipfasPasswordResetSuccess",
    nextPage: "verifikasi-otp-pemulihan.html"
};

function initializeRecovery() {
    const form = document.querySelector(".recovery-card form");
    const email = document.getElementById("email");

    if (!form || !email) {
        console.error("Form pemulihan tidak ditemukan.");
        return;
    }

    form.addEventListener("submit", processRecovery);

    email.addEventListener("input", () => {
        clearRecoveryError();
        showRecoveryMessage("");
    });
}

// Membaca akun terdaftar.
function readRecoveryUsers() {
    try {
        const data = localStorage.getItem(RECOVERY_CONFIG.users);

        if (!data) return [];

        const users = JSON.parse(data);

        return Array.isArray(users) ? users : null;

    } catch (error) {
        console.error(error);
        return null;
    }
}

// Pesan kesalahan email.
function showRecoveryError(message) {
    const error = document.getElementById("emailError");
    const input = document.getElementById("email");

    if (error) error.textContent = message;

    if (input) {
        input.setAttribute("aria-invalid", "true");
        input.focus();
    }
}

function clearRecoveryError() {
    const error = document.getElementById("emailError");
    const input = document.getElementById("email");

    if (error) error.textContent = "";

    if (input) input.removeAttribute("aria-invalid");
}

// Pesan status.
function showRecoveryMessage(message, success = false) {
    const element = document.getElementById("formMessage");

    if (!element) return;

    element.textContent = message;
    element.style.color = success ? "#28734a" : "#dc4545";
}

// Menghapus sesi pemulihan sebelumnya.
function clearRecoverySession() {
    [
        RECOVERY_CONFIG.email,
        RECOVERY_CONFIG.otp,
        RECOVERY_CONFIG.expiry,
        RECOVERY_CONFIG.verified,
        RECOVERY_CONFIG.attempts,
        RECOVERY_CONFIG.success
    ].forEach(key => sessionStorage.removeItem(key));
}

// Proses pemulihan.
function processRecovery(event) {
    event.preventDefault();

    clearRecoveryError();
    showRecoveryMessage("");

    const emailInput = document.getElementById("email");
    const email = emailInput.value.trim().toLowerCase();

    if (!email) {
        showRecoveryError("Email wajib diisi.");
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showRecoveryError("Format email tidak valid.");
        return;
    }

    const users = readRecoveryUsers();

    if (users === null) {
        showRecoveryMessage("Data akun gagal dibaca.");
        return;
    }

    const matched = users.find(user =>
        String(user.email || "").trim().toLowerCase() === email
    );

    if (!matched) {
        showRecoveryMessage(
            "Email tidak ditemukan dalam data akun."
        );
        return;
    }

    try {
        clearRecoverySession();

        sessionStorage.setItem(
            RECOVERY_CONFIG.email,
            email
        );

        showRecoveryMessage(
            "Email ditemukan. Mengalihkan ke verifikasi OTP...",
            true
        );

        const button = document.querySelector(".submit-button");

        if (button) {
            button.disabled = true;
        }

        setTimeout(() => {
            window.location.href = RECOVERY_CONFIG.nextPage;
        }, 600);

    } catch (error) {
        console.error(error);

        showRecoveryMessage(
            "Gagal memulai pemulihan kata sandi."
        );
    }
}
