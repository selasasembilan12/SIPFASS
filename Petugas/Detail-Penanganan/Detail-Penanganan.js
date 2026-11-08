
/* =========================================================
   SIPFAS - DETAIL PENANGANAN
   File: Detail-Penanganan.js

   FITUR:
   1. Memuat data laporan berdasarkan kode laporan.
   2. Menyimpan tindak lanjut perbaikan.
   3. Menyimpan status penanganan.
   4. Menyimpan catatan petugas.
   5. Memperbarui tanggal secara otomatis (WIT).
   6. Menampilkan notifikasi berhasil dan gagal.
   7. Memuat kembali data setelah halaman direfresh.
   8. Mempertahankan data laporan lainnya.

   MEDIA PENYIMPANAN:
   Local Storage

   STORAGE KEY:
   sipfas_penanganan_laporan
========================================================= */

(function () {

    "use strict";

    // =====================================================
    // 1. KONFIGURASI PROGRAM
    // =====================================================

    const STORAGE_KEY = "sipfas_penanganan_laporan";

    // Pilihan status yang diperbolehkan.
    const VALID_STATUSES = [
        "Diproses",
        "Menunggu",
        "Selesai"
    ];

    // Timer notifikasi.
    let toastTimer = null;
    let toastHideTimer = null;


    // =====================================================
    // 2. MENJALANKAN PROGRAM SETELAH HTML DIMUAT
    // =====================================================

    document.addEventListener("DOMContentLoaded", function () {

        // Mengambil seluruh elemen HTML berdasarkan ID.
        const form = document.getElementById("handlingForm");

        const followUpInput =
            document.getElementById("followUp");

        const statusInput =
            document.getElementById("handlingStatus");

        const notesInput =
            document.getElementById("officerNotes");

        const updatedAtElement =
            document.getElementById("updatedAt");

        const reportCodeElement =
            document.getElementById("reportCode");

        const pageCodeElement =
            document.getElementById("pageCode");

        const headerStatusElement =
            document.getElementById("headerStatus");

        const cancelButton =
            document.getElementById("cancelButton");

        const copyButton =
            document.getElementById("copyCode");


        // =================================================
        // 3. VALIDASI ELEMEN HTML
        // =================================================

        // Memastikan elemen utama tersedia.
        const requiredElements = {
            handlingForm: form,
            followUp: followUpInput,
            handlingStatus: statusInput,
            officerNotes: notesInput,
            reportCode: reportCodeElement
        };

        const missingElements = Object.entries(requiredElements)
            .filter(function (item) {
                return !item[1];
            })
            .map(function (item) {
                return item[0];
            });

        // Menghentikan program jika elemen wajib tidak ditemukan.
        if (missingElements.length > 0) {

            console.error(
                "Elemen HTML tidak ditemukan:",
                missingElements
            );

            showToast(
                "Komponen halaman tidak lengkap: " +
                missingElements.join(", "),
                "error"
            );

            return;
        }


        // =================================================
        // 4. MENGAMBIL KODE LAPORAN
        // =================================================

        // Membaca kode laporan dari URL.
        const params = new URLSearchParams(
            window.location.search
        );

        const codeFromUrl = (
            params.get("kode") || ""
        ).trim();

        // Jika URL tidak memiliki kode, gunakan kode HTML.
        const reportCode = codeFromUrl ||
            reportCodeElement.textContent.trim();

        if (!reportCode) {

            showToast(
                "Kode laporan tidak ditemukan.",
                "error"
            );

            return;
        }

        // Menampilkan kode laporan.
        reportCodeElement.textContent = reportCode;

        if (pageCodeElement) {
            pageCodeElement.textContent = reportCode;
        }


        // =================================================
        // 5. SISTEM NOTIFIKASI TOAST
        // =================================================

        function showToast(message, type = "info") {

            // Mengambil notifikasi yang sudah pernah dibuat.
            let toast = document.getElementById(
                "sipfasToastNotification"
            );

            // Membuat elemen notifikasi jika belum tersedia.
            if (!toast) {

                toast = document.createElement("div");

                toast.id = "sipfasToastNotification";

                document.body.appendChild(toast);
            }

            // Menghapus timer sebelumnya.
            clearTimeout(toastTimer);
            clearTimeout(toastHideTimer);

            // Konfigurasi ikon notifikasi.
            const icons = {
                success: "✓",
                error: "✕",
                info: "ℹ"
            };

            // Konfigurasi warna notifikasi.
            const colors = {

                success: {
                    background: "#e8f8ef",
                    color: "#087443",
                    border: "#a7e5c2"
                },

                error: {
                    background: "#fff0f0",
                    color: "#c62828",
                    border: "#ffcaca"
                },

                info: {
                    background: "#edf3ff",
                    color: "#2458b8",
                    border: "#c7d8ff"
                }
            };

            const selected = colors[type] || colors.info;

            // Mengosongkan isi notifikasi sebelumnya.
            toast.textContent = "";

            // Membuat ikon notifikasi.
            const icon = document.createElement("span");

            icon.textContent = icons[type] || icons.info;

            // Membuat teks notifikasi.
            const text = document.createElement("span");

            text.textContent = message;

            // Memasukkan ikon dan teks.
            toast.appendChild(icon);
            toast.appendChild(text);

            // Mengatur desain notifikasi.
            Object.assign(toast.style, {

                position: "fixed",

                top: "24px",

                right: "24px",

                zIndex: "99999",

                display: "flex",

                alignItems: "center",

                gap: "12px",

                maxWidth: "calc(100vw - 48px)",

                padding: "16px 22px",

                borderRadius: "12px",

                background: selected.background,

                color: selected.color,

                border: "1px solid " + selected.border,

                boxShadow: "0 6px 24px rgba(0,0,0,0.12)",

                fontSize: "14px",

                fontWeight: "600",

                fontFamily: "inherit",

                opacity: "0",

                transform: "translateY(-12px)",

                transition:
                    "opacity 0.3s ease, transform 0.3s ease",

                pointerEvents: "none"

            });

            // Mengatur ikon notifikasi.
            Object.assign(icon.style, {

                fontSize: "20px",

                fontWeight: "800",

                flexShrink: "0"

            });

            // Menampilkan notifikasi.
            toast.hidden = false;

            toast.setAttribute(
                "role",
                type === "error" ? "alert" : "status"
            );

            toast.setAttribute("aria-live", "polite");

            // Menjalankan animasi masuk.
            requestAnimationFrame(function () {

                toast.style.opacity = "1";

                toast.style.transform = "translateY(0)";

            });

            // Menghilangkan notifikasi setelah 4 detik.
            toastTimer = setTimeout(function () {

                toast.style.opacity = "0";

                toast.style.transform = "translateY(-12px)";

                toastHideTimer = setTimeout(function () {

                    toast.hidden = true;

                    toast.style.display = "none";

                }, 300);

            }, 4000);
        }


        // =================================================
        // 6. MEMBACA DATA LOCAL STORAGE
        // =================================================

        function getAllHandlingData() {

            let raw;

            try {

                raw = localStorage.getItem(STORAGE_KEY);

            } catch (error) {

                console.error(
                    "Gagal membaca Local Storage:",
                    error
                );

                throw new Error(
                    "Browser tidak dapat mengakses penyimpanan."
                );
            }

            // Jika belum ada data, gunakan objek kosong.
            if (!raw) {
                return {};
            }

            let parsed;

            try {

                parsed = JSON.parse(raw);

            } catch (error) {

                console.error(
                    "Format JSON penyimpanan tidak valid:",
                    error
                );

                throw new Error(
                    "Data penyimpanan rusak dan tidak dapat dibaca."
                );
            }

            // Memastikan struktur penyimpanan berbentuk objek.
            if (
                parsed === null ||
                typeof parsed !== "object" ||
                Array.isArray(parsed)
            ) {

                throw new Error(
                    "Struktur data penanganan tidak valid."
                );
            }

            return parsed;
        }


        // =================================================
        // 7. FORMAT TANGGAL WIT
        // =================================================

        function formatWIT(date) {

            return new Intl.DateTimeFormat("id-ID", {

                timeZone: "Asia/Jayapura",

                day: "2-digit",

                month: "long",

                year: "numeric",

                hour: "2-digit",

                minute: "2-digit",

                hour12: false

            }).format(date) + " WIT";
        }


        // =================================================
        // 8. MEMPERBARUI STATUS HEADER
        // =================================================

        function setHeaderStatus(status) {

            if (!headerStatusElement) {
                return;
            }

            // Mempertahankan ikon yang terdapat pada header.
            const icon = headerStatusElement.querySelector("i");

            headerStatusElement.textContent = "";

            if (icon) {
                headerStatusElement.appendChild(icon);
            }

            // Memperbarui teks status.
            headerStatusElement.appendChild(
                document.createTextNode(" " + status)
            );

            headerStatusElement.dataset.status = status;
        }


        // =================================================
        // 9. MEMUAT DATA PENANGANAN SEBELUMNYA
        // =================================================

        function loadSavedHandling() {

            let allData;

            try {

                allData = getAllHandlingData();

            } catch (error) {

                showToast(error.message, "error");

                return;
            }

            // Mengambil data berdasarkan kode laporan.
            const saved = allData[reportCode];

            // Jika belum pernah disimpan, gunakan data awal HTML.
            if (!saved || typeof saved !== "object") {
                return;
            }

            // Mengisi kembali tindak lanjut.
            followUpInput.value =
                saved.followUp ||
                saved.followUpAction ||
                saved.tindakLanjut ||
                "";

            // Mengisi kembali status.
            const savedStatus =
                saved.status ||
                saved.handlingStatus;

            if (VALID_STATUSES.includes(savedStatus)) {

                statusInput.value = savedStatus;

                setHeaderStatus(savedStatus);
            }

            // Mengisi kembali catatan petugas.
            notesInput.value =
                saved.officerNotes ||
                saved.catatanPetugas ||
                "";

            // Mengisi tanggal pembaruan terakhir.
            if (saved.updatedAt && updatedAtElement) {

                const date = new Date(saved.updatedAt);

                if (!Number.isNaN(date.getTime())) {

                    updatedAtElement.textContent =
                        formatWIT(date);
                }
            }
        }


        // =================================================
        // 10. VALIDASI FORM
        // =================================================

        function validateForm() {

            // Tindak lanjut wajib diisi.
            if (!followUpInput.value.trim()) {

                followUpInput.focus();

                showToast(
                    "Tindak lanjut perbaikan wajib diisi!",
                    "error"
                );

                return false;
            }

            // Memastikan status dipilih dengan benar.
            if (
                !VALID_STATUSES.includes(statusInput.value)
            ) {

                statusInput.focus();

                showToast(
                    "Silakan pilih status penanganan yang valid!",
                    "error"
                );

                return false;
            }

            // Catatan petugas bersifat opsional.
            return true;
        }


        // =================================================
        // 11. PROSES SIMPAN PERUBAHAN
        // =================================================

        function saveHandling(event) {

            // Mencegah form melakukan reload.
            if (event) {
                event.preventDefault();
            }

            // Menjalankan validasi.
            if (!validateForm()) {
                return;
            }

            // Mengambil nilai dari form.
            const followUp = followUpInput.value.trim();

            const status = statusInput.value;

            const officerNotes = notesInput.value.trim();

            // Mengambil waktu saat ini.
            const now = new Date();

            // Membentuk data penanganan.
            const record = {

                reportCode: reportCode,

                // Data tindak lanjut.
                followUp: followUp,

                followUpAction: followUp,

                tindakLanjut: followUp,

                // Data status.
                status: status,

                handlingStatus: status,

                statusLabel: status,

                // Data catatan petugas.
                officerNotes: officerNotes,

                catatanPetugas: officerNotes,

                // Data tanggal pembaruan.
                updatedAt: now.toISOString(),

                updatedAtLabel: formatWIT(now),

                // Identitas sumber pembaruan.
                savedFrom: "detail-penanganan"

            };

            try {

                // Membaca seluruh data yang sudah tersimpan.
                const allData = getAllHandlingData();

                // Memperbarui laporan aktif tanpa menghapus laporan lain.
                allData[reportCode] = {

                    ...(allData[reportCode] || {}),

                    ...record

                };

                // Mengubah objek menjadi JSON.
                const serialized = JSON.stringify(allData);

                // Menyimpan data ke Local Storage.
                localStorage.setItem(
                    STORAGE_KEY,
                    serialized
                );

                // Membaca ulang data untuk memastikan penyimpanan.
                const persistedRaw =
                    localStorage.getItem(STORAGE_KEY);

                if (persistedRaw !== serialized) {

                    throw new Error(
                        "Data belum berhasil diverifikasi setelah penyimpanan."
                    );
                }

                // Mengambil hasil penyimpanan.
                const persistedData = JSON.parse(persistedRaw);

                const savedRecord = persistedData[reportCode];

                // Memastikan data yang disimpan sesuai input.
                if (
                    !savedRecord ||
                    savedRecord.reportCode !== reportCode ||
                    savedRecord.status !== status ||
                    savedRecord.followUp !== followUp ||
                    savedRecord.officerNotes !== officerNotes
                ) {

                    throw new Error(
                        "Data yang tersimpan tidak sesuai dengan input."
                    );
                }

                // Memperbarui tanggal pada halaman.
                if (updatedAtElement) {

                    updatedAtElement.textContent =
                        record.updatedAtLabel;
                }

                // Memperbarui status header.
                setHeaderStatus(status);

                // Mengirim event pembaruan ke halaman lain.
                window.dispatchEvent(

                    new CustomEvent(
                        "sipfas:handling-saved",
                        {
                            detail: record
                        }
                    )

                );

                // Menampilkan notifikasi berhasil.
                showToast(
                    "Perubahan penanganan berhasil disimpan!",
                    "success"
                );

                // Menampilkan informasi di console.
                console.log(
                    "Data penanganan berhasil disimpan:",
                    record
                );

            } catch (error) {

                // Menampilkan kesalahan jika penyimpanan gagal.
                console.error(
                    "Gagal menyimpan perubahan:",
                    error
                );

                // Menampilkan notifikasi gagal.
                showToast(
                    error.message ||
                    "Gagal menyimpan perubahan. Silakan coba kembali.",
                    "error"
                );
            }
        }


        // =================================================
        // 12. EVENT SUBMIT FORM
        // =================================================

        // Menjalankan penyimpanan ketika tombol ditekan.
        form.addEventListener(
            "submit",
            saveHandling
        );


        // =================================================
        // 13. EVENT PERUBAHAN STATUS
        // =================================================

        // Memperbarui status header saat pilihan berubah.
        statusInput.addEventListener(
            "change",
            function () {

                if (
                    VALID_STATUSES.includes(statusInput.value)
                ) {

                    setHeaderStatus(statusInput.value);
                }
            }
        );


        // =================================================
        // 14. EVENT TOMBOL BATAL
        // =================================================

        if (cancelButton) {

            cancelButton.addEventListener(
                "click",
                function () {

                    window.location.href =
                        "../Penanganan/Penanganan.html";
                }
            );
        }


        // =================================================
        // 15. EVENT TOMBOL SALIN KODE LAPORAN
        // =================================================

        if (copyButton) {

            copyButton.addEventListener(
                "click",
                async function () {

                    try {

                        await navigator.clipboard.writeText(
                            reportCode
                        );

                        showToast(
                            "Kode laporan berhasil disalin!",
                            "success"
                        );

                    } catch (error) {

                        console.error(
                            "Gagal menyalin kode laporan:",
                            error
                        );

                        showToast(
                            "Kode tidak dapat disalin otomatis.",
                            "error"
                        );
                    }
                }
            );
        }


        // =================================================
        // 16. INISIALISASI HALAMAN
        // =================================================

        // Memuat data ketika halaman pertama kali dibuka.
        loadSavedHandling();

        console.log(
            "SIPFAS Detail Penanganan berhasil dijalankan."
        );

        console.log(
            "Kode laporan aktif:",
            reportCode
        );

    });

})();
