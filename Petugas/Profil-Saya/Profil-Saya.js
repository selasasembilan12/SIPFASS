
/* ============================================================
   SIPFAS - PROFIL SAYA
   FINAL JAVASCRIPT
   Fokus:
   1. Pengelolaan identitas petugas.
   2. Penyimpanan perubahan profil.
   3. Validasi perubahan kata sandi.
   4. Verifikasi kata sandi melalui backend.
   5. Toggle password.
   6. Navigasi sidebar.
============================================================ */

(() => {
    "use strict";

    /* ========================================================
       1. KONFIGURASI
    ======================================================== */

    const STORAGE_KEY = "sipfas_profile";

    /* ========================================================
       2. INISIALISASI PROGRAM
    ======================================================== */

    function initProfil() {

        // Mengambil elemen formulir profil.
        const form = document.getElementById("profileForm");

        // Mengambil input identitas.
        const nama = document.getElementById("fullName");
        const username = document.getElementById("username");
        const email = document.getElementById("email");

        // Mengambil input password.
        const currentPassword =
            document.getElementById("currentPassword");

        const newPassword =
            document.getElementById("newPassword");

        const confirmPassword =
            document.getElementById("confirmPassword");

        // Mengambil elemen tombol dan notifikasi.
        const tombolSimpan =
            document.getElementById("saveButton") ||
            form?.querySelector('button[type="submit"]');

        const feedback =
            document.getElementById("formFeedback");

        // Mengambil elemen identitas.
        const avatar =
            document.querySelector(".large-avatar");

        const headerNama =
            document.querySelector(".profile-area .profile-name");

        const kartuNama =
            document.querySelector(".profile-identity h2");

        // Mengambil elemen navigasi.
        const sidebar = document.getElementById("sidebar");
        const menuToggle = document.getElementById("menuToggle");
        const overlay = document.getElementById("pageOverlay");

        // Memastikan seluruh elemen penting tersedia.
        if (
            !form ||
            !nama ||
            !username ||
            !email ||
            !tombolSimpan
        ) {
            console.error(
                "[SIPFAS] Elemen formulir profil tidak ditemukan."
            );
            return;
        }

        // Mencegah inisialisasi program berulang.
        if (form.dataset.initialized === "true") return;

        form.dataset.initialized = "true";

        // Menyimpan tampilan awal tombol.
        const tombolAwal = tombolSimpan.innerHTML;

        // Mengatur status proses penyimpanan.
        let sedangMenyimpan = false;

        /* ====================================================
           3. MENGAKTIFKAN INPUT PROFIL
        ==================================================== */

        [nama, username, email].forEach(input => {

            // Mengaktifkan input agar dapat diedit.
            input.readOnly = false;

            input.disabled = false;

            // Menghapus atribut penguncian.
            input.removeAttribute("readonly");

            input.removeAttribute("disabled");

        });

        /* ====================================================
           4. MEMBERSIHKAN TEKS
        ==================================================== */

        function bersihkan(teks) {

            // Menghilangkan spasi berlebihan.
            return String(teks ?? "")
                .replace(/\s+/g, " ")
                .trim();

        }

        /* ====================================================
           5. MEMBACA DATA PROFIL
        ==================================================== */

        function bacaProfil() {

            try {

                // Mengambil data dari Local Storage.
                const data = localStorage.getItem(STORAGE_KEY);

                // Mengembalikan null jika belum ada data.
                if (!data) return null;

                // Mengubah JSON menjadi objek.
                const hasil = JSON.parse(data);

                // Memastikan data berupa objek.
                if (
                    !hasil ||
                    typeof hasil !== "object" ||
                    Array.isArray(hasil)
                ) {
                    return null;
                }

                return hasil;

            } catch (error) {

                console.error(
                    "[SIPFAS] Gagal membaca profil:",
                    error
                );

                return null;

            }
        }

        /* ====================================================
           6. MENGAMBIL DATA PROFIL
        ==================================================== */

        function ambilData() {

            return {

                // Mengambil nama lengkap.
                fullName: bersihkan(nama.value),

                // Mengambil username.
                username: bersihkan(username.value),

                // Mengambil email.
                email: bersihkan(email.value).toLowerCase()

            };

        }

        /* ====================================================
           7. MENAMPILKAN NOTIFIKASI
        ==================================================== */

        function tampilkanPesan(pesan, jenis) {

            // Menggunakan console jika elemen tidak tersedia.
            if (!feedback) {
                console.log(pesan);
                return;
            }

            // Memasukkan pesan.
            feedback.textContent = pesan;

            // Mengatur jenis pesan.
            feedback.className = `form-feedback ${jenis}`;

            // Mengatur aksesibilitas.
            feedback.setAttribute("role", "status");

            feedback.setAttribute("aria-live", "polite");

        }

        /* ====================================================
           8. MEMBUAT INISIAL AVATAR
        ==================================================== */

        function buatInisial(namaLengkap) {

            // Membersihkan nama.
            const namaBersih = bersihkan(namaLengkap)
                .replace(/[^\p{L}\p{N}\s]/gu, "");

            // Memisahkan nama menjadi kata.
            const kata = namaBersih
                .split(/\s+/)
                .filter(Boolean);

            // Mengambil maksimal dua inisial.
            return kata
                .slice(0, 2)
                .map(item => item.charAt(0))
                .join("")
                .toUpperCase() || "RH";

        }

        /* ====================================================
           9. MEMPERBARUI AVATAR
        ==================================================== */

        function perbaruiAvatar(namaLengkap) {

            if (!avatar) return;

            // Mengambil inisial terbaru.
            const inisial = buatInisial(namaLengkap);

            // Mencari elemen inisial yang sudah tersedia.
            let elemen = avatar.querySelector(".avatar-initials");

            // Membuat elemen jika belum tersedia.
            if (!elemen) {

                elemen = document.createElement("span");

                elemen.className = "avatar-initials";

                avatar.prepend(elemen);

            }

            // Menghapus elemen inisial tambahan.
            avatar.querySelectorAll(".avatar-initials")
                .forEach((item, index) => {
                    if (index > 0) item.remove();
                });

            // Memperbarui tulisan inisial.
            elemen.textContent = inisial;

            // Mempertahankan badge verifikasi.
            avatar.setAttribute(
                "aria-label",
                `Avatar ${namaLengkap}`
            );

        }

        /* ====================================================
           10. MEMPERBARUI IDENTITAS
        ==================================================== */

        function perbaruiTampilan(data) {

            // Memperbarui nama pada header.
            if (headerNama) {
                headerNama.textContent = data.fullName;
            }

            // Memperbarui nama pada kartu profil.
            if (kartuNama) {
                kartuNama.textContent = data.fullName;
            }

            // Memperbarui avatar.
            perbaruiAvatar(data.fullName);

        }

        /* ====================================================
           11. VALIDASI PROFIL
        ==================================================== */

        function validasiProfil() {

            const data = ambilData();

            // Memeriksa nama.
            if (!data.fullName || data.fullName.length < 3) {

                nama.focus();

                tampilkanPesan(
                    "Nama lengkap minimal 3 karakter.",
                    "error"
                );

                return false;

            }

            // Memeriksa username.
            if (
                !/^[a-zA-Z0-9._-]{3,30}$/.test(data.username)
            ) {

                username.focus();

                tampilkanPesan(
                    "Username harus 3-30 karakter dan hanya menggunakan huruf, angka, titik, atau garis bawah.",
                    "error"
                );

                return false;

            }

            // Memeriksa email.
            if (
                data.email &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
            ) {

                email.focus();

                tampilkanPesan(
                    "Format email tidak valid.",
                    "error"
                );

                return false;

            }

            return true;

        }

        /* ====================================================
           12. VALIDASI PASSWORD
        ==================================================== */

        function validasiPassword() {

            // Password tidak di-trim karena spasi bisa menjadi
            // bagian dari password yang sah.
            const lama = currentPassword?.value ?? "";

            const baru = newPassword?.value ?? "";

            const konfirmasi = confirmPassword?.value ?? "";

            // Memeriksa apakah pengguna ingin mengganti password.
            const diminta = Boolean(lama || baru || konfirmasi);

            // Jika seluruh kolom kosong, password tidak diubah.
            if (!diminta) {

                return {
                    valid: true,
                    diminta: false
                };

            }

            // Password lama wajib diisi.
            if (!lama) {

                currentPassword.focus();

                tampilkanPesan(
                    "Masukkan kata sandi saat ini.",
                    "error"
                );

                return {
                    valid: false,
                    diminta: true
                };

            }

            // Password baru wajib diisi.
            if (!baru) {

                newPassword.focus();

                tampilkanPesan(
                    "Masukkan kata sandi baru.",
                    "error"
                );

                return {
                    valid: false,
                    diminta: true
                };

            }

            // Memeriksa panjang password baru.
            if (baru.length < 8) {

                newPassword.focus();

                tampilkanPesan(
                    "Kata sandi baru minimal 8 karakter.",
                    "error"
                );

                return {
                    valid: false,
                    diminta: true
                };

            }

            // Memastikan password mengandung huruf.
            if (!/[a-zA-Z]/.test(baru)) {

                newPassword.focus();

                tampilkanPesan(
                    "Kata sandi harus mengandung huruf.",
                    "error"
                );

                return {
                    valid: false,
                    diminta: true
                };

            }

            // Memastikan password mengandung angka.
            if (!/[0-9]/.test(baru)) {

                newPassword.focus();

                tampilkanPesan(
                    "Kata sandi harus mengandung angka.",
                    "error"
                );

                return {
                    valid: false,
                    diminta: true
                };

            }

            // Password baru tidak boleh sama dengan password lama.
            if (baru === lama) {

                newPassword.focus();

                tampilkanPesan(
                    "Kata sandi baru harus berbeda dari kata sandi saat ini.",
                    "error"
                );

                return {
                    valid: false,
                    diminta: true
                };

            }

            // Konfirmasi wajib diisi.
            if (!konfirmasi) {

                confirmPassword.focus();

                tampilkanPesan(
                    "Konfirmasi kata sandi baru wajib diisi.",
                    "error"
                );

                return {
                    valid: false,
                    diminta: true
                };

            }

            // Konfirmasi harus sama persis dengan password baru.
            if (baru !== konfirmasi) {

                confirmPassword.focus();

                tampilkanPesan(
                    "Konfirmasi kata sandi tidak cocok.",
                    "error"
                );

                return {
                    valid: false,
                    diminta: true
                };

            }

            // Seluruh validasi berhasil.
            return {
                valid: true,
                diminta: true
            };

        }

        /* ====================================================
           13. MEMBERSIHKAN KOLOM PASSWORD
        ==================================================== */

        function bersihkanPassword() {

            if (currentPassword) {
                currentPassword.value = "";
            }

            if (newPassword) {
                newPassword.value = "";
            }

            if (confirmPassword) {
                confirmPassword.value = "";
            }

        }

        /* ====================================================
           14. MENYIMPAN PROFIL
        ==================================================== */

        function simpanProfil(data) {

            // Membaca data profil lama.
            const dataLama = bacaProfil() || {};

            // Menggabungkan data lama dan baru.
            const dataBaru = {

                ...dataLama,

                ...data,

                updatedAt: new Date().toISOString()

            };

            // Menyimpan ke Local Storage.
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(dataBaru)
            );

            // Memeriksa hasil penyimpanan.
            const hasil = bacaProfil();

            if (
                !hasil ||
                hasil.fullName !== data.fullName ||
                hasil.username !== data.username ||
                hasil.email !== data.email
            ) {

                throw new Error(
                    "Penyimpanan profil gagal diverifikasi."
                );

            }

            return hasil;

        }

        /* ====================================================
           15. MENGUBAH PASSWORD MELALUI SERVER
        ==================================================== */

        async function ubahPassword() {

            // Mengambil layanan autentikasi.
            const backend = window.SIPFAS_AUTH;

            // Backend wajib tersedia.
            if (
                !backend ||
                typeof backend.changePassword !== "function"
            ) {

                throw new Error(
                    "Layanan perubahan password belum terhubung ke backend. Password tidak diubah."
                );

            }

            // Mengirim password ke backend.
            const hasil = await backend.changePassword({

                currentPassword: currentPassword.value,

                newPassword: newPassword.value

            });

            // Memastikan server mengonfirmasi keberhasilan.
            if (!hasil || hasil.success !== true) {

                throw new Error(
                    hasil?.message ||
                    "Password lama salah atau perubahan password gagal."
                );

            }

            return true;

        }

        /* ====================================================
           16. MEMUAT PROFIL
        ==================================================== */

        function muatProfil() {

            const data = bacaProfil();

            // Memuat data jika tersedia.
            if (data) {

                if (typeof data.fullName === "string") {
                    nama.value = data.fullName;
                }

                if (typeof data.username === "string") {
                    username.value = data.username;
                }

                if (typeof data.email === "string") {
                    email.value = data.email;
                }

            }

            // Memastikan input dapat diedit.
            [nama, username, email].forEach(input => {

                input.readOnly = false;

                input.disabled = false;

            });

            // Memperbarui tampilan.
            perbaruiTampilan(ambilData());

        }

        /* ====================================================
           17. EVENT SIMPAN PERUBAHAN
        ==================================================== */

        form.addEventListener("submit", async event => {

            // Mencegah reload halaman.
            event.preventDefault();

            // Mencegah klik berulang.
            if (sedangMenyimpan) return;

            // Memvalidasi profil.
            if (!validasiProfil()) return;

            // Memvalidasi password.
            const hasilValidasi = validasiPassword();

            // Menghentikan proses jika password tidak valid.
            if (!hasilValidasi.valid) return;

            try {

                // Mengaktifkan status proses.
                sedangMenyimpan = true;

                tombolSimpan.disabled = true;

                tombolSimpan.textContent = "Menyimpan...";

                // Menampilkan notifikasi proses.
                tampilkanPesan(
                    "Sedang memproses perubahan...",
                    "info"
                );

                // Mengambil data identitas.
                const data = ambilData();

                // Mengubah password terlebih dahulu jika diminta.
                if (hasilValidasi.diminta) {

                    await ubahPassword();

                }

                // Menyimpan identitas setelah proses password sukses.
                simpanProfil(data);

                // Memperbarui tampilan.
                perbaruiTampilan(data);

                // Mengosongkan password.
                bersihkanPassword();

                // Menampilkan pesan keberhasilan yang sesuai.
                tampilkanPesan(
                    hasilValidasi.diminta
                        ? "Profil dan kata sandi berhasil diperbarui."
                        : "Perubahan profil berhasil disimpan.",
                    "success"
                );

                // Mengirim event perubahan profil.
                window.dispatchEvent(
                    new CustomEvent("sipfas:profile-updated", {
                        detail: {
                            profile: data
                        }
                    })
                );

                console.log(
                    "[SIPFAS] Perubahan berhasil diproses."
                );

            } catch (error) {

                // Menampilkan kesalahan.
                console.error(
                    "[SIPFAS] Kesalahan penyimpanan:",
                    error
                );

                tampilkanPesan(
                    error.message ||
                    "Terjadi kesalahan saat menyimpan perubahan.",
                    "error"
                );

            } finally {

                // Mengaktifkan kembali tombol.
                sedangMenyimpan = false;

                tombolSimpan.disabled = false;

                tombolSimpan.innerHTML = tombolAwal;

            }

        });

        /* ====================================================
           18. EVENT INPUT
        ==================================================== */

        [nama, username, email].forEach(input => {

            input.addEventListener("input", () => {

                input.classList.remove("input-error");

                input.removeAttribute("aria-invalid");

                if (feedback) {

                    feedback.textContent = "";

                    feedback.className = "form-feedback";

                }

                // Memperbarui avatar ketika nama diketik.
                if (input === nama) {

                    perbaruiAvatar(
                        bersihkan(nama.value) || "RH"
                    );

                }

            });

        });

        /* ====================================================
           19. TOGGLE PASSWORD
        ==================================================== */

        document.querySelectorAll(".toggle-password")
            .forEach(button => {

                const target = button.dataset.target;

                const input = document.getElementById(target);

                if (!input) return;

                // Mencegah tombol dianggap sebagai tombol submit.
                button.type = "button";

                button.addEventListener("click", () => {

                    const sedangTersembunyi =
                        input.type === "password";

                    // Mengubah tipe input.
                    input.type = sedangTersembunyi
                        ? "text"
                        : "password";

                    // Memperbarui status aksesibilitas.
                    button.setAttribute(
                        "aria-pressed",
                        String(sedangTersembunyi)
                    );

                    button.setAttribute(
                        "aria-label",
                        sedangTersembunyi
                            ? "Sembunyikan kata sandi"
                            : "Tampilkan kata sandi"
                    );

                });

            });

        /* ====================================================
           20. SIDEBAR MOBILE
        ==================================================== */

        function aturSidebar(buka) {

            sidebar?.classList.toggle("open", buka);

            overlay?.classList.toggle("show", buka);

            menuToggle?.setAttribute(
                "aria-expanded",
                String(buka)
            );

        }

        menuToggle?.addEventListener("click", () => {

            const terbuka =
                sidebar?.classList.contains("open");

            aturSidebar(!terbuka);

        });

        overlay?.addEventListener("click", () => {

            aturSidebar(false);

        });

        document.addEventListener("keydown", event => {

            if (event.key === "Escape") {

                aturSidebar(false);

            }

        });

        /* ====================================================
           21. SINKRONISASI ANTARTAB
        ==================================================== */

        window.addEventListener("storage", event => {

            if (event.key === STORAGE_KEY) {

                muatProfil();

            }

        });

        /* ====================================================
           22. INISIALISASI AKHIR
        ==================================================== */

        // Memuat data profil.
        muatProfil();

        // Memastikan sidebar tertutup saat awal.
        aturSidebar(false);

        // Menampilkan status program.
        console.log(
            "[SIPFAS] Profil Saya berhasil dijalankan."
        );

    }

    /* ========================================================
       23. MENJALANKAN PROGRAM
    ======================================================== */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initProfil,
            { once: true }
        );

    } else {

        initProfil();

    }

})();
