
/* ============================================================
   SIPFAS - DETAIL PENANGANAN
   File: Detail-Penanganan.js

   FITUR:
   1. Memuat laporan berdasarkan kode unik.
   2. Mengambil informasi dari hasil verifikasi.
   3. Menyimpan tindak lanjut perbaikan.
   4. Menyimpan status penanganan.
   5. Menyimpan catatan petugas.
   6. Memperbarui tanggal otomatis dalam WIT.
   7. Menampilkan notifikasi berhasil dan gagal.
   8. Memuat kembali data setelah halaman direfresh.
   9. Mempertahankan data laporan lainnya.
   10. Tombol salin kode laporan.
   11. Tombol batal.
   12. Sinkronisasi antarhalaman.

   LOCAL STORAGE:
   - sipfas_verifikasi_laporan
   - sipfas_penanganan_laporan
   - sipfas_selected_report
============================================================ */

(() => {
    "use strict";

    document.addEventListener("DOMContentLoaded", initialize);

    function initialize() {

        /* ====================================================
           1. KONFIGURASI
        ==================================================== */

        const HANDLING_KEY = "sipfas_penanganan_laporan";
        const VERIFICATION_KEY = "sipfas_verifikasi_laporan";
        const SELECTED_REPORT_KEY = "sipfas_selected_report";

        const VALID_STATUSES = [
            "Diproses",
            "Menunggu",
            "Selesai"
        ];

        /* ====================================================
           2. ELEMEN HTML
        ==================================================== */

        const $ = id => document.getElementById(id);

        const form = $("handlingForm");
        const followUpInput = $("followUp");
        const statusInput = $("handlingStatus");
        const notesInput = $("officerNotes");

        const updatedAtElement = $("updatedAt");
        const reportCodeElement = $("reportCode");
        const pageCodeElement = $("pageCode");
        const headerStatusElement = $("headerStatus");

        const cancelButton = $("cancelButton");
        const copyButton = $("copyCode");
        const saveButton = $("saveHandling");

        const menuToggle = $("menuToggle");
        const sidebar = $("sidebar");
        const pageOverlay = $("pageOverlay");
        const logoutLink = $("logoutLink");

        /* ====================================================
           3. VALIDASI ELEMEN HTML
        ==================================================== */

        const requiredElements = {
            handlingForm: form,
            followUp: followUpInput,
            handlingStatus: statusInput,
            officerNotes: notesInput,
            reportCode: reportCodeElement
        };

        const missingElements = Object.entries(
            requiredElements
        )
            .filter(([, element]) => !element)
            .map(([name]) => name);

        if (missingElements.length > 0) {
            console.error(
                "[SIPFAS] Elemen HTML tidak ditemukan:",
                missingElements
            );

            alert(
                "Komponen halaman tidak lengkap: " +
                missingElements.join(", ")
            );

            return;
        }

        /* ====================================================
           4. NORMALISASI DATA
        ==================================================== */

        function normalizeText(value) {
            return String(value ?? "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();
        }

        function normalizeReportCode(value) {
            return String(value ?? "")
                .replace(/\s+/g, "")
                .trim()
                .toUpperCase();
        }

        function normalizeStatus(value) {
            const status = normalizeText(value);

            if (
                status === "selesai" ||
                status === "completed" ||
                status === "selesai ditangani" ||
                status === "selesai diperbaiki"
            ) {
                return "Selesai";
            }

            if (
                status === "diproses" ||
                status === "processing" ||
                status === "sedang diproses" ||
                status === "dalam proses"
            ) {
                return "Diproses";
            }

            if (
                status === "menunggu" ||
                status === "waiting" ||
                status === "menunggu perbaikan"
            ) {
                return "Menunggu";
            }

            return "";
        }

        /* ====================================================
           5. MEMBACA LOCAL STORAGE
        ==================================================== */

        function readStorage(key) {
            try {
                const raw = localStorage.getItem(key);

                if (raw === null) {
                    return {};
                }

                const data = JSON.parse(raw);

                if (
                    !data ||
                    typeof data !== "object" ||
                    Array.isArray(data)
                ) {
                    throw new Error(
                        "Format data penyimpanan tidak valid."
                    );
                }

                return data;

            } catch (error) {
                console.error(
                    `[SIPFAS] Gagal membaca ${key}:`,
                    error
                );

                return null;
            }
        }

        /* ====================================================
           6. MENAMPILKAN NOTIFIKASI
        ==================================================== */

        let toastTimer = null;
        let toastHideTimer = null;

        function showToast(message, type = "info") {

            let toast = $("sipfasToastNotification");

            if (!toast) {
                toast = document.createElement("div");
                toast.id = "sipfasToastNotification";

                document.body.appendChild(toast);
            }

            clearTimeout(toastTimer);
            clearTimeout(toastHideTimer);

            const icons = {
                success: "✓",
                error: "✕",
                info: "ℹ"
            };

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

            toast.replaceChildren();

            const icon = document.createElement("span");
            icon.textContent = icons[type] || icons.info;

            const text = document.createElement("span");
            text.textContent = message;

            toast.append(icon, text);

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
                border: `1px solid ${selected.border}`,
                boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
                fontSize: "14px",
                fontWeight: "600",
                fontFamily: "inherit",
                opacity: "0",
                transform: "translateY(-12px)",
                transition: "opacity 0.3s ease, transform 0.3s ease",
                pointerEvents: "none"
            });

            Object.assign(icon.style, {
                fontSize: "20px",
                fontWeight: "800",
                flexShrink: "0"
            });

            // Memastikan notifikasi dapat ditampilkan kembali
            // setelah notifikasi sebelumnya disembunyikan.
            toast.hidden = false;
            toast.style.display = "flex";

            toast.setAttribute(
                "role",
                type === "error" ? "alert" : "status"
            );

            toast.setAttribute("aria-live", "polite");

            requestAnimationFrame(() => {
                toast.style.opacity = "1";
                toast.style.transform = "translateY(0)";
            });

            toastTimer = setTimeout(() => {

                toast.style.opacity = "0";
                toast.style.transform = "translateY(-12px)";

                toastHideTimer = setTimeout(() => {
                    toast.hidden = true;
                    toast.style.display = "none";
                }, 300);

            }, 4000);
        }

        /* ====================================================
           7. MENGAMBIL IDENTITAS LAPORAN
        ==================================================== */

        function getSelectedReport() {

            const params = new URLSearchParams(
                window.location.search
            );

            const urlCode = normalizeReportCode(
                params.get("kode")
            );

            const selectedData = readStorage(
                SELECTED_REPORT_KEY
            );

            if (selectedData === null) {
                throw new Error(
                    "Data laporan terpilih tidak dapat dibaca."
                );
            }

            const storedCode = normalizeReportCode(
                selectedData.id ||
                selectedData.reportCode
            );

            // URL menjadi sumber utama identitas laporan.
            const reportCode = urlCode ||
                storedCode ||
                normalizeReportCode(
                    reportCodeElement.textContent
                );

            if (!reportCode) {
                throw new Error(
                    "Kode laporan tidak ditemukan."
                );
            }

            return {
                ...selectedData,
                id: reportCode,
                reportCode
            };
        }

        /* ====================================================
           8. MEMUAT DATA LAPORAN
        ==================================================== */

        let currentReport = null;

        function displayReportInformation() {

            const verificationData = readStorage(
                VERIFICATION_KEY
            );

            if (verificationData === null) {
                throw new Error(
                    "Data verifikasi tidak dapat dibaca."
                );
            }

            const verification =
                verificationData[currentReport.reportCode] || {};

            const report = {
                ...verification,
                ...currentReport
            };

            // Menampilkan kode laporan.
            reportCodeElement.textContent =
                currentReport.reportCode;

            if (pageCodeElement) {
                pageCodeElement.textContent =
                    currentReport.reportCode;
            }

            // Mengambil data dari hasil verifikasi.
            const information = {
                reportName:
                    verification.reporterName ||
                    currentReport.reporterName ||
                    "",

                reportNim:
                    verification.reporterNim ||
                    currentReport.reporterNim ||
                    "",

                reportFacility:
                    verification.facilityName ||
                    verification.facility ||
                    currentReport.facility ||
                    "",

                reportLocation:
                    verification.facilityLocation ||
                    verification.location ||
                    currentReport.location ||
                    "",

                reportTime:
                    verification.reportTime ||
                    verification.reportDate ||
                    verification.date ||
                    currentReport.date ||
                    "",

                reportDescription:
                    verification.description ||
                    verification.damageDescription ||
                    currentReport.description ||
                    ""
            };

            // Memperbarui elemen informasi jika tersedia di HTML.
            Object.entries(information).forEach(([id, value]) => {
                const element = $(id);

                if (element && value) {
                    element.textContent = value;
                }
            });

            // Memperbarui inisial pelapor.
            const initials = $("reportInitials");

            if (initials && information.reportName) {
                initials.textContent = information.reportName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(word => word.charAt(0).toUpperCase())
                    .join("");
            }

            console.log(
                "[SIPFAS] Informasi laporan dimuat:",
                report
            );
        }

        /* ====================================================
           9. FORMAT TANGGAL WIT
        ==================================================== */

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

        /* ====================================================
           10. MEMPERBARUI STATUS HEADER
        ==================================================== */

        function setHeaderStatus(status) {

            if (!headerStatusElement) return;

            const icon = headerStatusElement.querySelector("i");

            headerStatusElement.replaceChildren();

            if (icon) {
                headerStatusElement.appendChild(icon);
            }

            headerStatusElement.appendChild(
                document.createTextNode(` ${status}`)
            );

            headerStatusElement.dataset.status = status;
        }

        /* ====================================================
           11. MEMUAT DATA PENANGANAN SEBELUMNYA
        ==================================================== */

        function loadSavedHandling() {

            const allData = readStorage(HANDLING_KEY);

            if (allData === null) {
                showToast(
                    "Data penanganan tidak dapat dibaca.",
                    "error"
                );
                return;
            }

            const saved = allData[currentReport.reportCode];

            if (!saved) {
                setHeaderStatus("Menunggu");
                return;
            }

            // Memulihkan tindak lanjut perbaikan.
            followUpInput.value =
                saved.followUp ||
                saved.followUpAction ||
                saved.tindakLanjut ||
                "";

            // Memulihkan status dengan normalisasi.
            const savedStatus = normalizeStatus(
                saved.status ||
                saved.handlingStatus ||
                saved.statusPenanganan
            );

            if (savedStatus) {

                const matchingOption = Array.from(
                    statusInput.options
                ).find(option => {
                    return normalizeStatus(option.value) === savedStatus;
                });

                if (matchingOption) {
                    statusInput.value = matchingOption.value;
                }

                setHeaderStatus(savedStatus);
            }

            // Memulihkan catatan petugas.
            notesInput.value =
                saved.officerNotes ||
                saved.catatanPetugas ||
                "";

            // Memulihkan tanggal pembaruan.
            if (saved.updatedAt && updatedAtElement) {

                const date = new Date(saved.updatedAt);

                if (!Number.isNaN(date.getTime())) {
                    updatedAtElement.textContent =
                        formatWIT(date);
                }
            }

            console.log(
                "[SIPFAS] Data penanganan sebelumnya dimuat:",
                saved
            );
        }

        /* ====================================================
           12. VALIDASI FORM
        ==================================================== */

        function validateForm() {

            if (!followUpInput.value.trim()) {

                followUpInput.focus();

                showToast(
                    "Tindak lanjut perbaikan wajib diisi!",
                    "error"
                );

                return false;
            }

            const status = normalizeStatus(
                statusInput.value
            );

            if (!VALID_STATUSES.includes(status)) {

                statusInput.focus();

                showToast(
                    "Silakan pilih status penanganan yang valid!",
                    "error"
                );

                return false;
            }

            return true;
        }

        /* ====================================================
           13. MENYIMPAN PERUBAHAN PENANGANAN
        ==================================================== */

        function saveHandling(event) {

            if (event) {
                event.preventDefault();
            }

            if (!validateForm()) {
                return;
            }

            const followUp = followUpInput.value.trim();

            const status = normalizeStatus(
                statusInput.value
            );

            const officerNotes = notesInput.value.trim();

            const now = new Date();

            const record = {

                reportCode: currentReport.reportCode,

                followUp,
                followUpAction: followUp,
                tindakLanjut: followUp,

                status,
                handlingStatus: status,
                statusLabel: status,

                officerNotes,
                catatanPetugas: officerNotes,

                updatedAt: now.toISOString(),
                updatedAtLabel: formatWIT(now),

                savedFrom: "detail-penanganan"
            };

            try {

                // Mengambil seluruh data agar laporan lain tetap aman.
                const allData = readStorage(HANDLING_KEY);

                if (allData === null) {
                    throw new Error(
                        "Data penanganan sebelumnya gagal dibaca."
                    );
                }

                // Memperbarui hanya laporan yang sedang dibuka.
                allData[currentReport.reportCode] = {
                    ...(allData[currentReport.reportCode] || {}),
                    ...record
                };

                const serialized = JSON.stringify(allData);

                localStorage.setItem(
                    HANDLING_KEY,
                    serialized
                );

                // Memastikan data benar-benar tersimpan.
                const persistedRaw =
                    localStorage.getItem(HANDLING_KEY);

                if (persistedRaw !== serialized) {
                    throw new Error(
                        "Data gagal dikonfirmasi setelah penyimpanan."
                    );
                }

                const persistedData =
                    JSON.parse(persistedRaw);

                const savedRecord =
                    persistedData[currentReport.reportCode];

                if (
                    !savedRecord ||
                    savedRecord.reportCode !== currentReport.reportCode ||
                    savedRecord.status !== status ||
                    savedRecord.followUp !== followUp ||
                    savedRecord.officerNotes !== officerNotes
                ) {
                    throw new Error(
                        "Data yang tersimpan tidak sesuai dengan input."
                    );
                }

                // Memperbarui tanggal dan status pada tampilan.
                if (updatedAtElement) {
                    updatedAtElement.textContent =
                        record.updatedAtLabel;
                }

                setHeaderStatus(status);

                // Memberi tahu halaman daftar bahwa data berubah.
                window.dispatchEvent(
                    new CustomEvent(
                        "sipfas:handling-saved",
                        {
                            detail: record
                        }
                    )
                );

                showToast(
                    "Perubahan penanganan berhasil disimpan!",
                    "success"
                );

                console.log(
                    "[SIPFAS] Data penanganan berhasil disimpan:",
                    record
                );

            } catch (error) {

                console.error(
                    "[SIPFAS] Gagal menyimpan penanganan:",
                    error
                );

                showToast(
                    error.message ||
                    "Gagal menyimpan perubahan. Silakan coba kembali.",
                    "error"
                );
            }
        }

        /* ====================================================
           14. EVENT SIMPAN FORM
        ==================================================== */

        form.addEventListener(
            "submit",
            saveHandling
        );

        /* ====================================================
           15. EVENT PERUBAHAN STATUS
        ==================================================== */

        statusInput.addEventListener("change", () => {

            const status = normalizeStatus(
                statusInput.value
            );

            if (status) {
                setHeaderStatus(status);
            }
        });

        /* ====================================================
           16. TOMBOL BATAL
        ==================================================== */

        cancelButton?.addEventListener("click", event => {

            event.preventDefault();

            const targetURL = new URL(
                "../Penanganan/Penanganan.html",
                window.location.href
            );

            window.location.href = targetURL.href;
        });

        /* ====================================================
           17. TOMBOL SALIN KODE LAPORAN
        ==================================================== */

        async function copyReportCode() {

            const code = currentReport.reportCode;

            try {

                // Metode utama menggunakan Clipboard API.
                if (
                    navigator.clipboard &&
                    window.isSecureContext
                ) {
                    await navigator.clipboard.writeText(code);

                } else {

                    // Fallback untuk browser tanpa Clipboard API.
                    const textarea =
                        document.createElement("textarea");

                    textarea.value = code;

                    textarea.style.position = "fixed";
                    textarea.style.opacity = "0";

                    document.body.appendChild(textarea);

                    textarea.select();

                    const copied =
                        document.execCommand("copy");

                    textarea.remove();

                    if (!copied) {
                        throw new Error(
                            "Browser tidak mengizinkan penyalinan."
                        );
                    }
                }

                showToast(
                    "Kode laporan berhasil disalin!",
                    "success"
                );

            } catch (error) {

                console.error(
                    "[SIPFAS] Gagal menyalin kode:",
                    error
                );

                showToast(
                    "Kode tidak dapat disalin otomatis. Silakan salin secara manual: " + code,
                    "error"
                );
            }
        }

        copyButton?.addEventListener(
            "click",
            event => {
                event.preventDefault();
                copyReportCode();
            }
        );

        /* ====================================================
           18. SIDEBAR RESPONSIF
        ==================================================== */

        function setSidebar(isOpen) {

            sidebar?.classList.toggle(
                "open",
                isOpen
            );

            pageOverlay?.classList.toggle(
                "show",
                isOpen
            );

            menuToggle?.setAttribute(
                "aria-expanded",
                String(isOpen)
            );
        }

        menuToggle?.addEventListener("click", () => {

            setSidebar(
                !sidebar?.classList.contains("open")
            );
        });

        pageOverlay?.addEventListener(
            "click",
            () => setSidebar(false)
        );

        document.querySelectorAll(".nav-link").forEach(link => {

            link.addEventListener(
                "click",
                () => setSidebar(false)
            );
        });

        document.addEventListener("keydown", event => {

            if (event.key === "Escape") {
                setSidebar(false);
            }
        });

        /* ====================================================
           19. KONFIRMASI KELUAR
        ==================================================== */

        logoutLink?.addEventListener("click", event => {

            event.preventDefault();

            const confirmation = window.confirm(
                "Apakah Anda yakin ingin keluar dari sistem SIPFAS?"
            );

            if (!confirmation) return;

            sessionStorage.clear();

            window.location.href = logoutLink.href;
        });

        /* ====================================================
           20. INISIALISASI HALAMAN
        ==================================================== */

        try {

            currentReport = getSelectedReport();

            displayReportInformation();

            loadSavedHandling();

            console.log(
                "[SIPFAS] Detail Penanganan berhasil diinisialisasi.",
                currentReport.reportCode
            );

        } catch (error) {

            console.error(
                "[SIPFAS] Inisialisasi gagal:",
                error
            );

            showToast(
                error.message,
                "error"
            );
        }
    }

})();
