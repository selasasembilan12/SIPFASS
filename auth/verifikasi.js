
/* ============================================================
   SIPFAS - VERIFIKASI.JS
   OTP login dan pengalihan berdasarkan role.
   ============================================================ */

document.addEventListener("DOMContentLoaded", initializeVerification);

const VERIFY_CONFIG = {
    pending: "sipfasPendingLogin",
    email: "sipfasLoginEmail",
    otp: "sipfasLoginOtp",
    expiry: "sipfasLoginOtpExpiresAt",
    attempts: "sipfasLoginAttempts",
    verified: "sipfasLoginVerified",
    active: "sipfasActiveUser",
    duration: 5 * 60 * 1000,
    maxAttempts: 5
};

// Path sesuai struktur ZIP asli.
const DASHBOARD_ROUTES = {
    pelapor: "../User/Dashboard/Dashboard/dashboard.html",
    petugas: "../Petugas/Dashboard/Dashboard.html",
    administrator: "../Admin/Dashboard/Dashboard.html"
};

function normalizeVerifyRole(role) {
    const value = String(role || "").trim().toLowerCase();

    if (["admin", "administrator"].includes(value)) {
        return "administrator";
    }

    if (value === "petugas") return "petugas";

    if (["pelapor", "user"].includes(value)) {
        return "pelapor";
    }

    return "";
}

function initializeVerification() {
    const form = document.getElementById("verificationForm");
    const inputs = [...document.querySelectorAll(".otp-input")];

    if (!form || inputs.length !== 8) {
        console.error("Form OTP tidak lengkap.");
        return;
    }

    let user;

    try {
        user = JSON.parse(
            sessionStorage.getItem(VERIFY_CONFIG.pending) || "null"
        );
    } catch {
        user = null;
    }

    if (!user || !DASHBOARD_ROUTES[normalizeVerifyRole(user.role)]) {
        showMessage("Sesi login tidak ditemukan. Silakan login kembali.");
        inputs.forEach(input => input.disabled = true);
        form.querySelector("button").disabled = true;
        return;
    }

    const email = document.querySelector(".email-badge span");

    if (email) email.textContent = maskEmail(user.email);

    setupOTPInputs(inputs);

    generateOTP();

    form.addEventListener("submit", event => {
        event.preventDefault();
        verifyOTP(inputs, user);
    });

    inputs[0].focus();
}

// Membuat OTP acak 8 digit untuk simulasi.
function generateOTP() {
    const random = new Uint32Array(1);

    let code;

    if (window.crypto?.getRandomValues) {
        window.crypto.getRandomValues(random);
        code = String(random[0] % 100000000).padStart(8, "0");
    } else {
        code = String(Math.floor(Math.random() * 100000000))
            .padStart(8, "0");
    }

    sessionStorage.setItem(VERIFY_CONFIG.otp, code);

    sessionStorage.setItem(
        VERIFY_CONFIG.expiry,
        String(Date.now() + VERIFY_CONFIG.duration)
    );

    sessionStorage.setItem(VERIFY_CONFIG.attempts, "0");

    sessionStorage.removeItem(VERIFY_CONFIG.verified);

    console.info("[SIPFAS] OTP SIMULASI:", code);

    showDemoOTP(code);
}

// Menampilkan OTP simulasi pada halaman.
function showDemoOTP(code) {
    let notice = document.getElementById("demoOtpNotice");

    if (!notice) {
        notice = document.createElement("div");
        notice.id = "demoOtpNotice";

        notice.style.cssText =
            "margin:12px auto;padding:12px;background:#eef4ff;" +
            "border:1px dashed #9bb7e8;border-radius:8px;" +
            "text-align:center;color:#24436f;max-width:350px;";

        document.querySelector(".verification-heading")
            ?.appendChild(notice);
    }

    notice.textContent = "OTP simulasi: " + code + " (berlaku 5 menit)";
}

// Menyamarkan email.
function maskEmail(email) {
    if (!email || !email.includes("@")) return "Email tidak tersedia";

    const [name, domain] = email.split("@");

    return name.slice(0, 2) + "***@" + domain;
}

// Interaksi kotak OTP.
function setupOTPInputs(inputs) {
    inputs.forEach((input, index) => {
        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "").slice(-1);

            if (input.value && index < 7) {
                inputs[index + 1].focus();
            }
        });

        input.addEventListener("keydown", event => {
            if (event.key === "Backspace" && !input.value && index > 0) {
                inputs[index - 1].focus();
            }

            if (event.key === "ArrowLeft" && index > 0) {
                inputs[index - 1].focus();
            }

            if (event.key === "ArrowRight" && index < 7) {
                inputs[index + 1].focus();
            }
        });

        input.addEventListener("paste", event => {
            event.preventDefault();

            const code = event.clipboardData
                .getData("text")
                .replace(/\D/g, "")
                .slice(0, 8);

            code.split("").forEach((digit, i) => {
                inputs[i].value = digit;
            });

            inputs[Math.min(code.length, 7)].focus();
        });
    });
}

// Memeriksa OTP.
function verifyOTP(inputs, user) {
    const entered = inputs.map(input => input.value).join("");

    if (!/^\d{8}$/.test(entered)) {
        showMessage("Masukkan 8 digit OTP.");
        inputs.find(input => !input.value)?.focus();
        return;
    }

    const saved = sessionStorage.getItem(VERIFY_CONFIG.otp);
    const expiry = Number(sessionStorage.getItem(VERIFY_CONFIG.expiry));

    let attempts = Number(
        sessionStorage.getItem(VERIFY_CONFIG.attempts) || "0"
    );

    if (!saved || !expiry) {
        showMessage("OTP tidak tersedia. Silakan login kembali.");
        return;
    }

    if (Date.now() > expiry) {
        showMessage("OTP sudah kedaluwarsa. Silakan login kembali.");
        return;
    }

    if (attempts >= VERIFY_CONFIG.maxAttempts) {
        showMessage("Batas percobaan OTP telah tercapai.");
        return;
    }

    if (entered !== saved) {
        attempts++;

        sessionStorage.setItem(
            VERIFY_CONFIG.attempts,
            String(attempts)
        );

        inputs.forEach(input => input.value = "");
        inputs[0].focus();

        showMessage("OTP salah. Sisa percobaan: " +
            (VERIFY_CONFIG.maxAttempts - attempts));

        return;
    }

    finishLogin(user);
}

// Menyimpan sesi aktif dan menuju dashboard.
function finishLogin(user) {
    const role = normalizeVerifyRole(user.role);
    const destination = DASHBOARD_ROUTES[role];

    if (!destination) {
        showMessage("Role pengguna tidak dikenali.");
        return;
    }

    try {
        sessionStorage.setItem(VERIFY_CONFIG.verified, "true");

        sessionStorage.setItem(
            VERIFY_CONFIG.active,
            JSON.stringify(user)
        );

        sessionStorage.setItem(
            VERIFY_CONFIG.email,
            user.email || ""
        );

        // OTP hanya berlaku sekali.
        sessionStorage.removeItem(VERIFY_CONFIG.pending);
        sessionStorage.removeItem(VERIFY_CONFIG.otp);
        sessionStorage.removeItem(VERIFY_CONFIG.expiry);
        sessionStorage.removeItem(VERIFY_CONFIG.attempts);

        showMessage("Verifikasi berhasil. Membuka dashboard...", true);

        const button = document.querySelector(".verification-button");

        if (button) {
            button.disabled = true;
            button.textContent = "Berhasil...";
        }

        setTimeout(() => {
            window.location.assign(destination);
        }, 600);

    } catch (error) {
        console.error(error);
        showMessage("Gagal menyimpan sesi pengguna.");
    }
}

// Pesan status.
function showMessage(message, success = false) {
    let element = document.getElementById("verificationMessage");

    if (!element) {
        element = document.createElement("p");
        element.id = "verificationMessage";
        element.setAttribute("role", "status");

        document.getElementById("verificationForm")
            ?.insertAdjacentElement("afterend", element);
    }

    element.style.cssText =
        "text-align:center;margin:12px 0;font-size:14px;color:" +
        (success ? "#28734a" : "#dc4545");

    element.textContent = message;
}
