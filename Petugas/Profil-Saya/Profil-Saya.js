
/* ============================================================
   SIPFAS - PROFIL SAYA PETUGAS
   File: Profil-Saya.js

   FUNGSI:
   1. Toggle tampil/sembunyi password.
   2. Validasi password.
   3. Validasi konfirmasi password.
   4. Notifikasi keberhasilan dan kegagalan.
   5. Indikator proses penyimpanan.
   6. Pencegahan submit berulang.
   7. Sinkronisasi identitas profil.
   8. Sidebar responsif.
   9. Konfirmasi keluar.
   10. Integrasi backend autentikasi.

   Catatan:
   Penggantian password sungguhan membutuhkan backend.
============================================================ */

(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {

        // ====================================================
        // 1. MENGAMBIL ELEMEN HTML
        // ====================================================

        const profileForm = document.getElementById("profileForm");

        const fullName = document.getElementById("fullName");
        const username = document.getElementById("username");
        const email = document.getElementById("email");
        const role = document.getElementById("role");

        const currentPassword = document.getElementById("currentPassword");
        const newPassword = document.getElementById("newPassword");
        const confirmPassword = document.getElementById("confirmPassword");

        const feedback = document.getElementById("formFeedback");

        const saveButton = profileForm
            ? profileForm.querySelector('button[type="submit"]')
            : null;

        const sidebar = document.getElementById("sidebar");
        const menuToggle = document.getElementById("menuToggle");
        const pageOverlay = document.getElementById("pageOverlay");
        const logoutLink = document.getElementById("logoutLink");

        // Memastikan elemen utama tersedia.
        if (!profileForm || !feedback || !saveButton) {
            console.error("[SIPFAS] Formulir profil tidak ditemukan.");
            return;
        }

        // ====================================================
        // 2. KONFIGURASI PROGRAM
        // ====================================================

        const MIN_PASSWORD_LENGTH = 8;

        let isSubmitting = false;

        const originalButtonHTML = saveButton.innerHTML;

        // ====================================================
        // 3. FUNGSI NOTIFIKASI
        // ====================================================

        function showNotification(message, type) {

            feedback.textContent = message;

            feedback.className = "form-feedback " + type;

            feedback.dataset.state = type;

            feedback.setAttribute("role", "status");

            feedback.setAttribute("aria-live", "polite");
        }

        // Menghapus notifikasi.
        function clearNotification() {

            feedback.textContent = "";

            feedback.className = "form-feedback";

            delete feedback.dataset.state;
        }

        // ====================================================
        // 4. FUNGSI VALIDASI INPUT
        // ====================================================

        function clearValidationErrors() {

            [
                currentPassword,
                newPassword,
                confirmPassword
            ].forEach(function (input) {

                input.classList.remove("input-error");

                input.removeAttribute("aria-invalid");

            });
        }

        // Menampilkan kesalahan pada kolom tertentu.
        function setInputError(input, message) {

            input.classList.add("input-error");

            input.setAttribute("aria-invalid", "true");

            showNotification(message, "error");

            input.focus();

            return false;
        }

        // ====================================================
        // 5. FITUR TAMPILKAN DAN SEMBUNYIKAN PASSWORD
        // ====================================================

        document.querySelectorAll(".toggle-password").forEach(
            function (button) {

                const targetId = button.dataset.target;

                const input = document.getElementById(targetId);

                if (!input) {
                    console.error("Input password tidak ditemukan:", targetId);
                    return;
                }

                button.setAttribute("aria-controls", targetId);

                button.setAttribute("aria-pressed", "false");

                button.addEventListener("click", function () {

                    const isPassword = input.type === "password";

                    input.type = isPassword ? "text" : "password";

                    button.setAttribute(
                        "aria-pressed",
                        String(isPassword)
                    );

                    button.setAttribute(
                        "aria-label",
                        isPassword
                            ? "Sembunyikan kata sandi"
                            : "Tampilkan kata sandi"
                    );

                    input.focus();

                });

            }
        );

        // ====================================================
        // 6. VALIDASI KEKUATAN PASSWORD
        // ====================================================

        function validatePassword(password) {

            if (password.length < MIN_PASSWORD_LENGTH) {

                return {
                    valid: false,
                    message: "Kata sandi minimal harus 8 karakter."
                };

            }

            if (!/[a-zA-Z]/.test(password)) {

                return {
                    valid: false,
                    message: "Kata sandi harus mengandung huruf."
                };

            }

            if (!/[0-9]/.test(password)) {

                return {
                    valid: false,
                    message: "Kata sandi harus mengandung angka."
                };

            }

            return {
                valid: true,
                message: ""
            };
        }

        // ====================================================
        // 7. VALIDASI SELURUH FORMULIR
        // ====================================================

        function validateForm() {

            clearValidationErrors();

            const oldPassword = currentPassword.value;
            const password = newPassword.value;
            const confirmation = confirmPassword.value;

            // Semua kolom kosong berarti tidak ada perubahan.
            if (!oldPassword && !password && !confirmation) {

                showNotification(
                    "Isi ketiga kolom kata sandi jika ingin melakukan perubahan.",
                    "error"
                );

                return false;
            }

            // Memeriksa password lama.
            if (!oldPassword.trim()) {

                return setInputError(
                    currentPassword,
                    "Masukkan kata sandi saat ini."
                );

            }

            // Memeriksa password baru.
            if (!password) {

                return setInputError(
                    newPassword,
                    "Masukkan kata sandi baru."
                );

            }

            // Memeriksa format password baru.
            const passwordResult = validatePassword(password);

            if (!passwordResult.valid) {

                return setInputError(
                    newPassword,
                    passwordResult.message
                );

            }

            // Password baru harus berbeda dari password lama.
            if (oldPassword === password) {

                return setInputError(
                    newPassword,
                    "Kata sandi baru harus berbeda dari kata sandi saat ini."
                );

            }

            // Memeriksa konfirmasi password.
            if (!confirmation) {

                return setInputError(
                    confirmPassword,
                    "Masukkan konfirmasi kata sandi baru."
                );

            }

            // Memastikan kedua password sama.
            if (password !== confirmation) {

                return setInputError(
                    confirmPassword,
                    "Konfirmasi kata sandi tidak sesuai."
                );

            }

            return true;
        }

        // ====================================================
        // 8. INDIKATOR TOMBOL SIMPAN
        // ====================================================

        function setLoading(loading) {

            isSubmitting = loading;

            saveButton.disabled = loading;

            saveButton.setAttribute(
                "aria-busy",
                String(loading)
            );

            if (loading) {

                saveButton.textContent = "Memproses Perubahan...";

            } else {

                saveButton.innerHTML = originalButtonHTML;

            }
        }

        // ====================================================
        // 9. MEMBERSIHKAN INPUT PASSWORD
        // ====================================================

        function resetPasswordFields() {

            currentPassword.value = "";

            newPassword.value = "";

            confirmPassword.value = "";

            clearValidationErrors();
        }

        // ====================================================
        // 10. INTEGRASI BACKEND
        // ====================================================

        async function updatePassword(oldPassword, newValue) {

            /*
             Backend harus menyediakan:

             window.SIPFAS_AUTH.changePassword()

             Backend bertanggung jawab untuk:
             - Memeriksa password lama.
             - Melakukan hashing password baru.
             - Memperbarui password di database.
             - Mengembalikan status keberhasilan.

             Jangan menyimpan password di Local Storage.
            */

            if (
                !window.SIPFAS_AUTH ||
                typeof window.SIPFAS_AUTH.changePassword !== "function"
            ) {

                throw new Error(
                    "Backend autentikasi belum terhubung. Perubahan kata sandi belum dapat disimpan."
                );

            }

            const result = await window.SIPFAS_AUTH.changePassword({

                currentPassword: oldPassword,

                newPassword: newValue

            });

            if (!result || result.success !== true) {

                throw new Error(
                    result && result.message
                        ? result.message
                        : "Server menolak perubahan kata sandi."
                );

            }

            return result;
        }

        // ====================================================
        // 11. PROSES SIMPAN PERUBAHAN
        // ====================================================

        profileForm.addEventListener("submit", async function (event) {

            event.preventDefault();

            // Mencegah proses penyimpanan berulang.
            if (isSubmitting) {
                return;
            }

            clearNotification();

            clearValidationErrors();

            // Menjalankan validasi.
            if (!validateForm()) {
                return;
            }

            const oldPassword = currentPassword.value;

            const newValue = newPassword.value;

            try {

                setLoading(true);

                showNotification(
                    "Sedang memproses perubahan kata sandi...",
                    "info"
                );

                // Mengirim perubahan ke backend.
                const result = await updatePassword(
                    oldPassword,
                    newValue
                );

                // Hanya dijalankan jika server berhasil.
                resetPasswordFields();

                showNotification(
                    result.message || "Kata sandi berhasil diperbarui.",
                    "success"
                );

                console.log(
                    "[SIPFAS] Kata sandi berhasil diperbarui."
                );

                window.dispatchEvent(
                    new CustomEvent("sipfas:password-changed")
                );

            } catch (error) {

                console.error(
                    "[SIPFAS] Kesalahan penyimpanan:",
                    error
                );

                showNotification(
                    error.message || "Gagal memperbarui kata sandi.",
                    "error"
                );

            } finally {

                setLoading(false);

            }

        });

        // ====================================================
        // 12. MENGHAPUS ERROR KETIKA INPUT DIUBAH
        // ====================================================

        [
            currentPassword,
            newPassword,
            confirmPassword
        ].forEach(function (input) {

            input.addEventListener("input", function () {

                input.classList.remove("input-error");

                input.removeAttribute("aria-invalid");

                clearNotification();

            });

        });

        // ====================================================
        // 13. SINKRONISASI IDENTITAS PETUGAS
        // ====================================================

        function synchronizeIdentity() {

            if (!fullName) {
                return;
            }

            const name = fullName.value.trim();

            if (!name) {
                return;
            }

            const headerName = document.querySelector(
                ".profile-area .profile-name"
            );

            const identityName = document.querySelector(
                ".profile-identity h2"
            );

            const avatar = document.querySelector(".large-avatar");

            if (headerName) {
                headerName.textContent = name;
            }

            if (identityName) {
                identityName.textContent = name;
            }

            if (avatar) {

                const initials = name
                    .replace(/\./g, "")
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(function (word) {
                        return word.charAt(0);
                    })
                    .join("")
                    .toUpperCase();

                // Mengubah inisial tanpa menghapus badge.
                Array.from(avatar.childNodes).forEach(function (node) {

                    if (node.nodeType === Node.TEXT_NODE) {
                        node.remove();
                    }

                });

                avatar.insertBefore(
                    document.createTextNode(initials),
                    avatar.querySelector(".verified-mark")
                );

            }
        }

        // ====================================================
        // 14. SIDEBAR RESPONSIF
        // ====================================================

        function setSidebar(isOpen) {

            if (!sidebar) {
                return;
            }

            sidebar.classList.toggle("open", isOpen);

            if (pageOverlay) {

                pageOverlay.classList.toggle("show", isOpen);

            }

            if (menuToggle) {

                menuToggle.setAttribute(
                    "aria-expanded",
                    String(isOpen)
                );

                menuToggle.setAttribute(
                    "aria-label",
                    isOpen ? "Tutup menu" : "Buka menu"
                );

            }
        }

        // Tombol menu sidebar.
        if (menuToggle) {

            menuToggle.addEventListener("click", function () {

                const isOpen = sidebar.classList.contains("open");

                setSidebar(!isOpen);

            });

        }

        // Menutup sidebar melalui overlay.
        if (pageOverlay) {

            pageOverlay.addEventListener("click", function () {

                setSidebar(false);

            });

        }

        // Menutup sidebar setelah navigasi.
        document.querySelectorAll(".nav-link").forEach(
            function (link) {

                link.addEventListener("click", function () {

                    setSidebar(false);

                });

            }
        );

        // Menutup sidebar dengan tombol Escape.
        document.addEventListener("keydown", function (event) {

            if (event.key === "Escape") {

                setSidebar(false);

            }

        });

        // ====================================================
        // 15. KONFIRMASI KELUAR
        // ====================================================

        if (logoutLink) {

            logoutLink.addEventListener("click", function (event) {

                event.preventDefault();

                const confirmation = window.confirm(
                    "Apakah Anda yakin ingin keluar dari sistem SIPFAS?"
                );

                if (!confirmation) {
                    return;
                }

                // Mengikuti alamat tujuan pada HTML.
                // Tidak menghapus data laporan Local Storage.
                window.location.href = logoutLink.href;

            });

        }

        // ====================================================
        // 16. INISIALISASI HALAMAN
        // ====================================================

        synchronizeIdentity();

        setSidebar(false);

        console.log(
            "[SIPFAS] Profil Saya berhasil diinisialisasi."
        );

        console.log(
            "[SIPFAS] Toggle password: aktif."
        );

        console.log(
            "[SIPFAS] Validasi formulir: aktif."
        );

        console.log(
            "[SIPFAS] Sidebar: aktif."
        );

        console.log(
            "[SIPFAS] Backend:",
            window.SIPFAS_AUTH ? "Tersedia" : "Belum terhubung."
        );

    });

})();
