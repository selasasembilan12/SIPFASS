/* =====================================
   SIPFAS - VERIFIKASI OTP PEMULIHAN
===================================== */

// Mengambil elemen HTML
const otpForm = document.getElementById("otpForm");

const otpInputs = document.querySelectorAll(".otp-input");

const otpError = document.getElementById("otpError");

const timerElement = document.getElementById("timer");

const resendButton = document.getElementById("resendButton");


// =====================================
// 1. PENGATURAN TIMER
// =====================================

let remainingTime = 179;

let timerInterval = null;

let timerExpired = false;


// =====================================
// 2. FORMAT WAKTU
// =====================================

function formatTime(seconds) {

    const minutes = Math.floor(seconds / 60);

    const remainingSeconds = seconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(remainingSeconds).padStart(2, "0")
    );

}


// =====================================
// 3. MENJALANKAN TIMER
// =====================================

function startTimer() {

    clearInterval(timerInterval);

    remainingTime = 179;

    timerExpired = false;

    timerElement.textContent = formatTime(remainingTime);

    timerElement.style.color = "#0750d5";

    timerInterval = setInterval(function () {

        remainingTime--;

        timerElement.textContent = formatTime(remainingTime);

        if (remainingTime <= 0) {

            clearInterval(timerInterval);

            timerExpired = true;

            timerElement.textContent = "00:00";

            timerElement.style.color = "#dc4545";

        }

    }, 1000);

}


// =====================================
// 4. MENAMPILKAN PESAN
// =====================================

function showError(message) {

    otpError.textContent = message;

    otpError.style.color = "#dc4545";

}


// =====================================
// 5. MENGHAPUS PESAN
// =====================================

function clearError() {

    otpError.textContent = "";

}


// =====================================
// 6. MENGISI KODE OTP
// =====================================

function fillOTP(value, startIndex = 0) {

    clearError();

    const numbers = value.replace(/\D/g, "");

    if (numbers.length === 0) {
        return;
    }

    let lastIndex = startIndex;

    for (let i = 0; i < numbers.length; i++) {

        const targetIndex = startIndex + i;

        if (targetIndex >= otpInputs.length) {
            break;
        }

        otpInputs[targetIndex].value = numbers[i];

        lastIndex = targetIndex;

    }

    const nextIndex = Math.min(
        lastIndex + 1,
        otpInputs.length - 1
    );

    otpInputs[nextIndex].focus();

}


// =====================================
// 7. INPUT OTP
// =====================================

otpInputs.forEach(function (input, index) {

    input.addEventListener("input", function () {

        clearError();

        const value = input.value.replace(/\D/g, "");

        if (value.length > 1) {

            fillOTP(value, index);

            return;

        }

        input.value = value.slice(0, 1);

        if (
            input.value !== "" &&
            index < otpInputs.length - 1
        ) {

            otpInputs[index + 1].focus();

        }

    });


    // BACKSPACE DAN NAVIGASI
    input.addEventListener("keydown", function (event) {

        if (event.key === "Backspace") {

            clearError();

            if (input.value === "" && index > 0) {

                otpInputs[index - 1].focus();

                otpInputs[index - 1].value = "";

            }

        }

        if (
            event.key === "ArrowLeft" &&
            index > 0
        ) {

            event.preventDefault();

            otpInputs[index - 1].focus();

        }

        if (
            event.key === "ArrowRight" &&
            index < otpInputs.length - 1
        ) {

            event.preventDefault();

            otpInputs[index + 1].focus();

        }

    });


    // PASTE KODE OTP
    input.addEventListener("paste", function (event) {

        event.preventDefault();

        const pastedData = event.clipboardData.getData("text");

        fillOTP(pastedData, index);

    });

});


// =====================================
// 8. MENGAMBIL KODE OTP
// =====================================

function getOTPCode() {

    let otpCode = "";

    otpInputs.forEach(function (input) {

        otpCode += input.value;

    });

    return otpCode;

}


// =====================================
// 9. TOMBOL VERIFIKASI
// =====================================

otpForm.addEventListener("submit", function (event) {

    event.preventDefault();

    clearError();

    const otpCode = getOTPCode();

    // Jika kode kosong
    if (otpCode.length === 0) {

        showError("Kode OTP wajib diisi.");

        otpInputs[0].focus();

        return;

    }

    // Jika kode belum lengkap
    if (otpCode.length !== 8) {

        showError("Masukkan 8 digit kode OTP.");

        const emptyInput = Array.from(otpInputs).find(
            input => input.value === ""
        );

        if (emptyInput) {
            emptyInput.focus();
        }

        return;

    }

    // Jika kode kedaluwarsa
    if (timerExpired) {

        showError(
            "Kode OTP telah kedaluwarsa. Silakan kirim ulang kode."
        );

        return;

    }

    // Format sudah benar
    showError("Kode siap diverifikasi.");

    otpError.style.color = "#28734a";

    /*
       Verifikasi kode sebenarnya memerlukan backend.
    */

});


// =====================================
// 10. KIRIM ULANG KODE
// =====================================

resendButton.addEventListener("click", function () {

    clearError();

    if (!timerExpired) {

        showError(
            "Kode masih berlaku. Tunggu hingga masa berlaku habis."
        );

        return;

    }

    // Mengosongkan input OTP
    otpInputs.forEach(function (input) {

        input.value = "";

    });

    // Mengatur ulang timer
    startTimer();

    showError(
        "Permintaan kode ulang siap diproses melalui backend."
    );

    otpError.style.color = "#28734a";

    otpInputs[0].focus();

});


// =====================================
// 11. MEMULAI TIMER
// =====================================

startTimer();