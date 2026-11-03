/* =====================================
   SIPFAS - VERIFIKASI DUA LANGKAH
===================================== */

// Mengambil elemen HTML
const verificationForm = document.getElementById("verificationForm");

const otpInputs = document.querySelectorAll(".otp-input");

const otpError = document.getElementById("otpError");

const maskedEmail = document.getElementById("maskedEmail");


// =====================================
// 1. MENAMPILKAN PESAN
// =====================================

function showMessage(message, color = "#dc4545") {

    otpError.textContent = message;
    otpError.style.color = color;

}


// =====================================
// 2. MENGHAPUS PESAN ERROR
// =====================================

function clearMessage() {

    otpError.textContent = "";

}


// =====================================
// 3. MENGISI KODE OTP
// =====================================

function fillOTP(value, startIndex = 0) {

    clearMessage();

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
// 4. INPUT OTP
// =====================================

otpInputs.forEach(function (input, index) {

    input.addEventListener("input", function () {

        clearMessage();

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


    // =====================================
    // 5. BACKSPACE DAN NAVIGASI
    // =====================================

    input.addEventListener("keydown", function (event) {

        if (event.key === "Backspace") {

            clearMessage();

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


    // =====================================
    // 6. PASTE KODE OTP
    // =====================================

    input.addEventListener("paste", function (event) {

        event.preventDefault();

        const pastedData = event.clipboardData.getData("text");

        fillOTP(pastedData, index);

    });

});


// =====================================
// 7. MENGAMBIL KODE OTP
// =====================================

function getOTPCode() {

    let otpCode = "";

    otpInputs.forEach(function (input) {
        otpCode += input.value;
    });

    return otpCode;

}


// =====================================
// 8. VALIDASI FORM
// =====================================

verificationForm.addEventListener("submit", function (event) {

    event.preventDefault();

    clearMessage();

    const otpCode = getOTPCode();

    // Jika kode belum diisi
    if (otpCode.length === 0) {

        showMessage("Kode verifikasi wajib diisi.");

        otpInputs[0].focus();
        return;

    }

    // Jika kode belum lengkap
    if (otpCode.length !== 8) {

        showMessage("Masukkan 8 digit kode verifikasi.");

        const emptyInput = Array.from(otpInputs).find(
            input => input.value === ""
        );

        if (emptyInput) {
            emptyInput.focus();
        }

        return;

    }

    // Memastikan kode hanya angka
    if (!/^\d{8}$/.test(otpCode)) {

        showMessage("Kode verifikasi harus berupa angka.");
        return;

    }

    // Jika format kode benar
    showMessage(
        "Kode siap diverifikasi.",
        "#28734a"
    );

    /*
       CATATAN:

       Validasi ini hanya memeriksa format OTP.

       Untuk verifikasi sebenarnya, kode OTP
       harus dikirim ke backend SIPFAS.

       Backend harus memeriksa:
       - Kecocokan kode
       - Masa berlaku kode
       - Status penggunaan kode
       - Identitas pengguna
    */

});


// =====================================
// 9. EMAIL PENGGUNA
// =====================================

maskedEmail.textContent = "mi***@email.com";