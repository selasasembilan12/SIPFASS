
/* ============================================================
   SIPFAS - PENANGANAN FASILITAS
   File: Penanganan.js

   FUNGSI:
   1. Menampilkan laporan yang sudah diverifikasi valid.
   2. Mengambil prioritas terbaru dari hasil verifikasi.
   3. Menampilkan status penanganan terbaru.
   4. Menyimpan dan membaca data penanganan.
   5. Pencarian laporan.
   6. Filter berdasarkan prioritas.
   7. Navigasi ke Detail Penanganan.
   8. Sinkronisasi Local Storage.
   9. Sidebar responsif.
   10. Konfirmasi keluar.

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

        const VERIFICATION_KEY = "sipfas_verifikasi_laporan";
        const HANDLING_KEY = "sipfas_penanganan_laporan";
        const SELECTED_REPORT_KEY = "sipfas_selected_report";

        const HANDLING_STATUS = {
            waiting: {
                label: "Menunggu Perbaikan",
                className: "waiting",
                icon: "⌛"
            },
            processing: {
                label: "Diproses",
                className: "processing",
                icon: "↻"
            },
            completed: {
                label: "Selesai",
                className: "completed",
                icon: "✓"
            }
        };

        /* ====================================================
           2. ELEMEN HTML
        ==================================================== */

        const $ = id => document.getElementById(id);

        const searchInput = $("searchHandling");
        const priorityFilter = $("priorityHandling");

        const table = document.querySelector(".handling-table");
        const tableBody = table?.querySelector("tbody");

        const emptyState = $("emptyHandling");

        const sidebar = $("sidebar");
        const menuToggle = $("menuToggle");
        const pageOverlay = $("pageOverlay");
        const logoutLink = $("logoutLink");

        if (!searchInput || !priorityFilter || !tableBody) {
            console.error(
                "[SIPFAS] Elemen pencarian, filter, atau tabel tidak ditemukan."
            );
            return;
        }

        /* ====================================================
           3. FUNGSI NORMALISASI
        ==================================================== */

        function normalizeText(value) {
            return String(value ?? "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();
        }

        // Menyamakan format kode laporan, termasuk kode yang
        // terpisah oleh baris baru di dalam tabel HTML.
        function normalizeReportCode(value) {
            return String(value ?? "")
                .replace(/\s+/g, "")
                .trim()
                .toUpperCase();
        }

        function normalizePriority(value) {
            const text = normalizeText(value);

            if (
                text.includes("tinggi") ||
                text === "high"
            ) {
                return "tinggi";
            }

            if (
                text.includes("sedang") ||
                text === "medium"
            ) {
                return "sedang";
            }

            if (
                text.includes("rendah") ||
                text === "low"
            ) {
                return "rendah";
            }

            return "tidak diketahui";
        }

        function normalizeDecision(value) {
            const text = normalizeText(value);

            if (
                text === "valid" ||
                text === "laporan valid"
            ) {
                return "valid";
            }

            if (
                text === "invalid" ||
                text === "tidak valid" ||
                text === "laporan tidak valid"
            ) {
                return "invalid";
            }

            return "";
        }

        function normalizeHandlingStatus(status) {
            const value = normalizeText(status);

            if (
                value === "selesai" ||
                value === "completed" ||
                value === "selesai ditangani" ||
                value === "selesai diperbaiki"
            ) {
                return "completed";
            }

            if (
                value === "diproses" ||
                value === "processing" ||
                value === "sedang diproses" ||
                value === "dalam proses"
            ) {
                return "processing";
            }

            return "waiting";
        }

        /* ====================================================
           4. MEMBACA LOCAL STORAGE
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
                    throw new Error("Format penyimpanan tidak valid.");
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
           5. DATA CADANGAN DARI HTML
        ==================================================== */

        const originalReportData = {};

        Array.from(tableBody.querySelectorAll("tr")).forEach(row => {
            const code = normalizeReportCode(
                row.cells[0]?.innerText
            );

            if (!code) return;

            const facilityCell = row.cells[1];
            const locationCell = row.cells[2];
            const priorityCell = row.cells[3];
            const dateCell = row.cells[5];

            originalReportData[code] = {
                facility:
                    facilityCell?.querySelector("strong")?.textContent.trim() || "",

                damage:
                    facilityCell?.querySelector("small")?.textContent.trim() || "",

                location:
                    locationCell?.innerText.trim() || "",

                priority:
                    priorityCell?.innerText.trim() || "",

                date:
                    dateCell?.innerText.trim() || ""
            };
        });

        /* ====================================================
           6. MENGAMBIL IDENTITAS LAPORAN
        ==================================================== */

        function getReportCode(verification, storageKey = "") {
            return normalizeReportCode(
                verification?.reportCode ||
                verification?.id ||
                storageKey
            );
        }

        /* ====================================================
           7. VALIDASI KELAYAKAN PENANGANAN
        ==================================================== */

        function isEligibleForHandling(verification) {
            if (!verification) return false;

            const decision = normalizeDecision(
                verification.decision ||
                verification.decisionLabel
            );

            // Hanya laporan yang dinyatakan valid yang diteruskan.
            if (decision !== "valid") {
                return false;
            }

            const status = normalizeText(
                verification.status || ""
            );

            // Mendukung status hasil verifikasi dari versi lama.
            if (
                status &&
                ![
                    "selesai diverifikasi",
                    "terverifikasi",
                    "verified"
                ].includes(status)
            ) {
                return false;
            }

            return true;
        }

        /* ====================================================
           8. MEMBUAT BADGE STATUS
        ==================================================== */

        function createStatusBadge(status) {
            const normalized = normalizeHandlingStatus(status);
            const config = HANDLING_STATUS[normalized];

            const badge = document.createElement("span");

            badge.className =
                `status-badge ${config.className}`;

            badge.dataset.status = normalized;

            const icon = document.createElement("span");

            icon.setAttribute("aria-hidden", "true");
            icon.textContent = config.icon;

            badge.appendChild(icon);

            badge.appendChild(
                document.createTextNode(` ${config.label}`)
            );

            badge.setAttribute(
                "aria-label",
                config.label
            );

            return badge;
        }

        /* ====================================================
           9. MEMBUAT BADGE PRIORITAS
        ==================================================== */

        function createPriorityBadge(priority) {
            const badge = document.createElement("span");

            badge.className =
                `priority-badge ${priority}`;

            badge.dataset.priority = priority;

            const labels = {
                tinggi: "Tinggi",
                sedang: "Sedang",
                rendah: "Rendah",
                "tidak diketahui": "Tidak Diketahui"
            };

            badge.textContent =
                labels[priority] || "Tidak Diketahui";

            return badge;
        }

        /* ====================================================
           10. MEMBUAT BARIS LAPORAN
        ==================================================== */

        function createReportRow(verification, handlingData, storageKey) {

            const reportCode = getReportCode(
                verification,
                storageKey
            );

            const original =
                originalReportData[reportCode] || {};

            // Prioritas selalu mengikuti hasil verifikasi terbaru.
            const priority = normalizePriority(
                verification.priority ||
                verification.priorityLabel ||
                original.priority
            );

            const facility =
                verification.facilityName ||
                verification.facility ||
                original.facility ||
                "Data fasilitas tidak tersedia";

            const damage =
                verification.damageDescription ||
                verification.description ||
                original.damage ||
                "Deskripsi kerusakan tidak tersedia";

            const location =
                verification.facilityLocation ||
                verification.location ||
                original.location ||
                "Lokasi tidak tersedia";

            const reportDate =
                verification.reportTime ||
                verification.reportDate ||
                verification.date ||
                original.date ||
                "—";

            // Mengambil status penanganan berdasarkan kode laporan.
            const savedHandling =
                handlingData[reportCode] || {};

            const handlingStatus = normalizeHandlingStatus(
                savedHandling.status ||
                savedHandling.handlingStatus ||
                savedHandling.statusPenanganan ||
                "waiting"
            );

            const row = document.createElement("tr");

            row.dataset.priority = priority;
            row.dataset.reportCode = reportCode;
            row.dataset.verificationStatus = "valid";
            row.dataset.handlingStatus = handlingStatus;

            /* KOLOM 1: KODE LAPORAN. */

            const codeCell = document.createElement("td");

            const codeBadge = document.createElement("span");

            codeBadge.className = `report-id ${priority}`;
            codeBadge.textContent = reportCode;

            codeCell.appendChild(codeBadge);

            /* KOLOM 2: FASILITAS DAN KERUSAKAN. */

            const facilityCell = document.createElement("td");

            facilityCell.className = "facility";

            const facilityName = document.createElement("strong");

            facilityName.textContent = facility;

            const damageDescription = document.createElement("small");

            damageDescription.textContent = damage;

            facilityCell.appendChild(facilityName);
            facilityCell.appendChild(damageDescription);

            /* KOLOM 3: LOKASI. */

            const locationCell = document.createElement("td");

            const locationElement = document.createElement("span");

            locationElement.className = "location";
            locationElement.textContent = location;

            locationCell.appendChild(locationElement);

            /* KOLOM 4: PRIORITAS C4.5. */

            const priorityCell = document.createElement("td");

            priorityCell.appendChild(
                createPriorityBadge(priority)
            );

            /* KOLOM 5: STATUS PENANGANAN. */

            const statusCell = document.createElement("td");

            statusCell.appendChild(
                createStatusBadge(handlingStatus)
            );

            /* KOLOM 6: TANGGAL LAPORAN. */

            const dateCell = document.createElement("td");

            dateCell.className = "date";
            dateCell.textContent = reportDate;

            /* KOLOM 7: TOMBOL KELOLA. */

            const actionCell = document.createElement("td");

            const manageLink = document.createElement("a");

            manageLink.className = "manage-button";

            const detailURL = new URL(
                "../Detail-Penanganan/Detail-Penanganan.html",
                window.location.href
            );

            detailURL.searchParams.set("kode", reportCode);

            manageLink.href = detailURL.href;

            manageLink.textContent = "Kelola Penanganan";

            // Menyimpan identitas laporan sebelum berpindah halaman.
            manageLink.addEventListener("click", () => {
                try {
                    localStorage.setItem(
                        SELECTED_REPORT_KEY,
                        JSON.stringify({
                            id: reportCode,
                            reportCode,
                            reporterName:
                                verification.reporterName || "",
                            reporterNim:
                                verification.reporterNim || "",
                            facility,
                            location,
                            date: reportDate,
                            priority,
                            description: damage
                        })
                    );
                } catch (error) {
                    console.error(
                        "[SIPFAS] Gagal menyimpan laporan terpilih:",
                        error
                    );
                }
            });

            actionCell.appendChild(manageLink);

            /* MENGGABUNGKAN KOLOM. */

            row.append(
                codeCell,
                facilityCell,
                locationCell,
                priorityCell,
                statusCell,
                dateCell,
                actionCell
            );

            /* DATA PENCARIAN. */

            row.dataset.search = normalizeText([
                reportCode,
                facility,
                damage,
                location,
                priority,
                reportDate,
                handlingStatus
            ].join(" "));

            return row;
        }

        /* ====================================================
           11. MEMUAT DAFTAR PENANGANAN
        ==================================================== */

        function loadHandlingReports() {

            const verificationData =
                readStorage(VERIFICATION_KEY);

            const handlingData =
                readStorage(HANDLING_KEY);

            if (
                verificationData === null ||
                handlingData === null
            ) {
                tableBody.replaceChildren();

                showEmptyState(
                    "Data verifikasi atau penanganan tidak dapat dibaca. Periksa Local Storage."
                );

                return;
            }

            const uniqueReports = new Map();

            // Memastikan setiap laporan hanya ditampilkan satu kali.
            Object.entries(verificationData).forEach(
                ([key, verification]) => {

                    if (!isEligibleForHandling(verification)) {
                        return;
                    }

                    const reportCode = getReportCode(
                        verification,
                        key
                    );

                    if (!reportCode) return;

                    uniqueReports.set(reportCode, {
                        ...verification,
                        reportCode
                    });
                }
            );

            const fragment =
                document.createDocumentFragment();

            uniqueReports.forEach(verification => {

                const row = createReportRow(
                    verification,
                    handlingData,
                    verification.reportCode
                );

                fragment.appendChild(row);
            });

            // Mengganti seluruh isi tabel tanpa duplikasi.
            tableBody.replaceChildren(fragment);

            filterHandling();

            console.log(
                "[SIPFAS] Daftar penanganan diperbarui:",
                uniqueReports.size
            );
        }

        /* ====================================================
           12. PESAN DATA KOSONG
        ==================================================== */

        function showEmptyState(message) {
            if (!emptyState) return;

            emptyState.textContent = message;
            emptyState.hidden = false;
            emptyState.style.display = "block";
        }

        /* ====================================================
           13. PENCARIAN LAPORAN
        ==================================================== */

        function matchesSearch(row, keyword) {
            if (!keyword) return true;

            const content = normalizeText(
                row.dataset.search || row.innerText
            );

            const words = keyword
                .split(/\s+/)
                .filter(Boolean);

            return words.every(word =>
                content.includes(word)
            );
        }

        /* ====================================================
           14. FILTER PRIORITAS
        ==================================================== */

        function matchesPriority(row, selectedPriority) {
            if (
                !selectedPriority ||
                selectedPriority === "semua"
            ) {
                return true;
            }

            return normalizeText(row.dataset.priority) ===
                selectedPriority;
        }

        /* ====================================================
           15. PENCARIAN DAN FILTER UTAMA
        ==================================================== */

        function filterHandling() {

            const rows = Array.from(
                tableBody.querySelectorAll("tr")
            );

            const keyword = normalizeText(searchInput.value);

            const selectedPriority = normalizeText(
                priorityFilter.value
            );

            let visibleCount = 0;

            rows.forEach(row => {

                const visible =
                    matchesSearch(row, keyword) &&
                    matchesPriority(row, selectedPriority);

                row.hidden = !visible;

                if (visible) {
                    row.style.removeProperty("display");
                    visibleCount++;
                } else {
                    row.style.setProperty(
                        "display",
                        "none",
                        "important"
                    );
                }
            });

            if (!emptyState) return;

            if (rows.length === 0) {

                showEmptyState(
                    "Belum ada laporan yang memenuhi syarat penanganan."
                );

            } else if (visibleCount === 0) {

                showEmptyState(
                    "Tidak ada laporan yang cocok dengan pencarian atau filter."
                );

            } else {

                emptyState.hidden = true;
                emptyState.style.display = "none";
            }
        }

        /* ====================================================
           16. EVENT PENCARIAN DAN FILTER
        ==================================================== */

        searchInput.addEventListener(
            "input",
            filterHandling
        );

        searchInput.addEventListener(
            "search",
            filterHandling
        );

        priorityFilter.addEventListener(
            "change",
            filterHandling
        );

        /* ====================================================
           17. SINKRONISASI PERUBAHAN DATA
        ==================================================== */

        window.addEventListener(
            "sipfas:verification-saved",
            loadHandlingReports
        );

        window.addEventListener(
            "sipfas:handling-saved",
            loadHandlingReports
        );

        window.addEventListener("storage", event => {

            if (
                event.key === VERIFICATION_KEY ||
                event.key === HANDLING_KEY ||
                event.key === null
            ) {
                loadHandlingReports();
            }
        });

        window.addEventListener(
            "pageshow",
            loadHandlingReports
        );

        document.addEventListener(
            "visibilitychange",
            () => {
                if (!document.hidden) {
                    loadHandlingReports();
                }
            }
        );

        /* ====================================================
           18. SIDEBAR RESPONSIF
        ==================================================== */

        function setSidebar(isOpen) {
            if (!sidebar) return;

            sidebar.classList.toggle("open", isOpen);

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
                !sidebar.classList.contains("open")
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

        loadHandlingReports();

        console.log(
            "[SIPFAS] Halaman Penanganan berhasil diinisialisasi."
        );
    }

})();
