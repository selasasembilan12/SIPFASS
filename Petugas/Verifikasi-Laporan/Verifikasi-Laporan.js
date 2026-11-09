
/* ============================================================
   SIPFAS - VERIFIKASI LAPORAN
   File: Verifikasi-Laporan.js

   FITUR:
   1. Pencarian laporan.
   2. Filter prioritas C4.5.
   3. Sinkronisasi prioritas terbaru.
   4. Sinkronisasi status verifikasi.
   5. Tombol Periksa untuk setiap pelapor.
   6. Penyimpanan identitas laporan terpilih.
   7. Perbaikan nama lengkap dan NIM pelapor.
   8. Sidebar responsif.
   9. Konfirmasi keluar.

   PENYIMPANAN:
   Setiap laporan menggunakan kode unik sebagai identitas.
============================================================ */

(() => {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {

        /* ====================================================
           1. KONFIGURASI
        ==================================================== */

        const STORAGE_KEY = "sipfas_verifikasi_laporan";
        const SELECTED_REPORT_KEY = "sipfas_selected_report";

        /* ====================================================
           2. ELEMEN HTML
        ==================================================== */

        const searchInput = document.getElementById("searchReport");
        const priorityFilter = document.getElementById("priorityFilter");

        const table = document.querySelector(".verification-table");
        const tableBody = table?.querySelector("tbody");

        const emptyState = document.getElementById("emptyState");

        const sidebar = document.getElementById("sidebar");
        const menuToggle = document.getElementById("menuToggle");
        const pageOverlay = document.getElementById("pageOverlay");
        const logoutLink = document.getElementById("logoutLink");

        /* Memastikan elemen utama halaman tersedia. */
        if (!searchInput || !priorityFilter || !tableBody) {
            console.error("[SIPFAS] Elemen utama tidak ditemukan.");
            return;
        }

        /* Mengambil seluruh baris laporan dari tabel. */
        const reportRows = Array.from(
            tableBody.querySelectorAll("tr")
        );

        /* ====================================================
           3. NORMALISASI TEKS
        ==================================================== */

        function normalizeText(value) {
            return String(value ?? "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();
        }

        /* ====================================================
           4. MEMBERSIHKAN ISI KOLOM
        ==================================================== */

        function cleanCell(cell) {
            return String(
                cell?.innerText || cell?.textContent || ""
            )
                .replace(/\s+/g, " ")
                .trim();
        }

        /* ====================================================
           5. MENGAMBIL KODE LAPORAN
        ==================================================== */

        function getReportCode(row) {
            const raw = cleanCell(row.cells[0]);

            const match = raw.match(
                /LPR[-\s]?\d{4}[-\s]?\d+/i
            );

            return match
                ? match[0].replace(/\s+/g, "").toUpperCase()
                : raw.replace(/\s+/g, "");
        }

        /* ====================================================
           6. NORMALISASI PRIORITAS
        ==================================================== */

        function normalizePriority(value) {
            const priority = normalizeText(value);

            if (priority.includes("tinggi")) return "tinggi";
            if (priority.includes("sedang")) return "sedang";
            if (priority.includes("rendah")) return "rendah";

            return "";
        }

        /* ====================================================
           7. MEMBACA DATA LOCAL STORAGE
        ==================================================== */

        function getVerificationData() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);

                if (!raw) return {};

                const data = JSON.parse(raw);

                if (
                    !data ||
                    typeof data !== "object" ||
                    Array.isArray(data)
                ) {
                    throw new Error("Format data tidak valid.");
                }

                return data;

            } catch (error) {
                console.error(
                    "[SIPFAS] Gagal membaca data:",
                    error
                );

                return null;
            }
        }

        /* ====================================================
           8. MEMBACA PRIORITAS LAPORAN
        ==================================================== */

        function getReportPriority(row) {

            /* Membaca prioritas terbaru dari atribut baris. */
            const datasetPriority = normalizePriority(
                row.getAttribute("data-priority")
            );

            if (datasetPriority) {
                return datasetPriority;
            }

            /* Membaca prioritas dari kolom tabel. */
            return normalizePriority(
                cleanCell(row.cells[5])
            );
        }

        /* ====================================================
           9. MEMPERBARUI BADGE PRIORITAS C4.5
        ==================================================== */

        function updatePriorityBadge(row, priority) {
            const priorityCell = row.cells[5];

            if (!priorityCell) {
                console.warn(
                    "[SIPFAS] Kolom prioritas tidak ditemukan:",
                    getReportCode(row)
                );
                return;
            }

            /* Menentukan konfigurasi warna setiap prioritas. */
            const styles = {
                tinggi: {
                    label: "Tinggi",
                    background: "#FEE2E2",
                    color: "#B91C1C",
                    dot: "#DC2626"
                },

                sedang: {
                    label: "Sedang",
                    background: "#FEF3C7",
                    color: "#92400E",
                    dot: "#D97706"
                },

                rendah: {
                    label: "Rendah",
                    background: "#D1FAE5",
                    color: "#047857",
                    dot: "#059669"
                }
            };

            const config = styles[priority];

            if (!config) return;

            /* Memperbarui atribut prioritas pada baris. */
            row.dataset.priority = priority;

            row.setAttribute(
                "data-priority",
                priority
            );

            /* Membuat badge prioritas terbaru. */
            const badge = document.createElement("span");

            badge.className = "priority-badge";
            badge.dataset.priority = priority;

            badge.style.display = "inline-flex";
            badge.style.alignItems = "center";
            badge.style.justifyContent = "center";
            badge.style.gap = "8px";
            badge.style.padding = "6px 14px";
            badge.style.borderRadius = "999px";
            badge.style.backgroundColor = config.background;
            badge.style.color = config.color;
            badge.style.fontWeight = "500";
            badge.style.whiteSpace = "nowrap";

            /* Membuat titik indikator warna. */
            const dot = document.createElement("span");

            dot.style.width = "8px";
            dot.style.height = "8px";
            dot.style.borderRadius = "50%";
            dot.style.backgroundColor = config.dot;
            dot.style.flexShrink = "0";

            badge.appendChild(dot);

            badge.appendChild(
                document.createTextNode(config.label)
            );

            /* Mengganti badge lama dengan badge terbaru. */
            priorityCell.replaceChildren(badge);

            console.log(
                `[SIPFAS] Prioritas ${getReportCode(row)} diperbarui menjadi ${config.label}.`
            );
        }

        /* ====================================================
           10. MEMPERBARUI STATUS VERIFIKASI
        ==================================================== */

        function updateRowStatus(row, decision) {
            const statusCell = row.cells[6];

            if (!statusCell) return;

            let statusPill = statusCell.querySelector(
                ".status-pill"
            );

            if (!statusPill) {
                statusPill = statusCell.querySelector("span");
            }

            if (!statusPill) return;

            /* Menentukan label status verifikasi. */
            const labels = {
                pending: "Menunggu Verifikasi",
                valid: "Terverifikasi",
                invalid: "Tidak Valid"
            };

            const label = labels[decision] || labels.pending;

            statusPill.textContent = label;

            statusPill.dataset.reportStatus = decision;

            statusPill.setAttribute(
                "aria-label",
                label
            );

            row.dataset.verificationStatus = decision;
        }

        /* ====================================================
           11. SINKRONISASI PRIORITAS DAN STATUS
        ==================================================== */

        function synchronizeVerification() {
            const verificationData = getVerificationData();

            if (verificationData === null) {
                console.error("[SIPFAS] Sinkronisasi dibatalkan.");
                return;
            }

            reportRows.forEach(row => {
                const reportCode = getReportCode(row);

                if (!reportCode) return;

                /* Mengambil hasil berdasarkan kode laporan. */
                const savedData = verificationData[reportCode];

                /* Mempertahankan kondisi awal jika belum diverifikasi. */
                if (!savedData) {
                    updateRowStatus(row, "pending");
                    return;
                }

                /* Memperbarui prioritas C4.5. */
                const latestPriority = normalizePriority(
                    savedData.priority ||
                    savedData.priorityLabel
                );

                if (latestPriority) {
                    updatePriorityBadge(
                        row,
                        latestPriority
                    );
                }

                /* Memperbarui status verifikasi. */
                const rawDecision = normalizeText(
                    savedData.decision || ""
                );

                const decision =
                    rawDecision === "valid"
                        ? "valid"
                        : rawDecision === "invalid"
                            ? "invalid"
                            : "pending";

                updateRowStatus(row, decision);
            });

            console.log(
                "[SIPFAS] Seluruh prioritas dan status berhasil disinkronkan."
            );
        }

        /* ====================================================
           12. MENGGABUNGKAN TEKS LAPORAN
        ==================================================== */

        function getReportText(row) {
            return normalizeText(
                Array.from(row.cells)
                    .map(cleanCell)
                    .join(" ")
            );
        }

        /* ====================================================
           13. PENCARIAN LAPORAN
        ==================================================== */

        function matchesSearch(row, keyword) {
            if (!keyword) return true;

            const words = keyword
                .split(/\s+/)
                .filter(Boolean);

            const content = getReportText(row);

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

            return getReportPriority(row) === selectedPriority;
        }

        /* ====================================================
           15. MENJALANKAN PENCARIAN DAN FILTER
        ==================================================== */

        function filterReports() {
            const keyword = normalizeText(searchInput.value);

            const selectedPriority = normalizeText(
                priorityFilter.value
            );

            let visibleCount = 0;

            reportRows.forEach(row => {
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

            /* Menampilkan pesan jika hasil pencarian kosong. */
            if (emptyState) {
                emptyState.hidden = visibleCount > 0;

                emptyState.style.display =
                    visibleCount > 0 ? "none" : "block";
            }
        }

        /* ====================================================
           16. EVENT PENCARIAN DAN FILTER
        ==================================================== */

        searchInput.addEventListener(
            "input",
            filterReports
        );

        searchInput.addEventListener(
            "search",
            filterReports
        );

        priorityFilter.addEventListener(
            "change",
            filterReports
        );

        /* ====================================================
           17. MENGAMBIL IDENTITAS PELAPOR
        ==================================================== */

        function getSelectedReport(row) {

            /* Mengambil sel kolom pelapor. */
            const reporterCell = row.cells[1];

            /* Membaca teks asli tanpa menghilangkan baris. */
            const reporterText = String(
                reporterCell?.innerText ||
                reporterCell?.textContent ||
                ""
            )
                .replace(/\r/g, "")
                .trim();

            /* Memisahkan identitas berdasarkan baris. */
            const reporterLines = reporterText
                .split(/\n+/)
                .map(line => line.trim())
                .filter(Boolean);

            /* Menyediakan tempat untuk bagian nama. */
            const nameParts = [];

            /* Menyediakan variabel khusus NIM. */
            let reporterNim = "";

            /* Memeriksa setiap baris identitas pelapor. */
            reporterLines.forEach(line => {

                /* Menghapus informasi program studi. */
                const identityLine = line
                    .replace(
                        /\s*[—–-]?\s*Program\s+Studi\b.*$/i,
                        ""
                    )
                    .trim();

                /* Mengabaikan baris kosong. */
                if (!identityLine) return;

                /* Mencari NIM dengan atau tanpa label. */
                const nimMatch = identityLine.match(
                    /(?:NIM\s*[:：.-]?\s*)?(\d{6,20})/i
                );

                /* Memisahkan NIM dari nama. */
                if (nimMatch) {

                    /* Menyimpan nomor NIM saja. */
                    reporterNim = nimMatch[1];

                    /* Menghapus NIM dari teks nama. */
                    const remainingName = identityLine
                        .replace(nimMatch[0], "")
                        .replace(/NIM\s*[:：.-]?/i, "")
                        .replace(/[|•–—-]+$/g, "")
                        .trim();

                    /* Menyimpan nama jika berada pada baris yang sama. */
                    if (remainingName) {
                        nameParts.push(remainingName);
                    }

                    return;
                }

                /* Menghapus label nama atau pelapor. */
                const cleanedName = identityLine
                    .replace(/^(nama\s*[:：.-]?\s*)/i, "")
                    .replace(/^(pelapor\s*[:：.-]?\s*)/i, "")
                    .trim();

                /* Menyimpan bagian nama yang ditemukan. */
                if (cleanedName) {
                    nameParts.push(cleanedName);
                }
            });

            /* Menggabungkan semua bagian menjadi nama lengkap. */
            const reporterName = nameParts
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

            /* Mengambil kode unik laporan. */
            const reportCode = getReportCode(row);

            /* Mengembalikan data laporan yang dipilih. */
            return {
                id: reportCode,

                /* Menyimpan teks asli untuk kompatibilitas. */
                reporter: reporterText,

                /* Menyimpan nama lengkap pelapor. */
                reporterName: reporterName,

                /* Menyimpan NIM berupa angka saja. */
                reporterNim: reporterNim,

                /* Mengambil nama fasilitas. */
                facility: cleanCell(row.cells[2]),

                /* Mengambil lokasi fasilitas. */
                location: cleanCell(row.cells[3]),

                /* Mengambil tanggal laporan. */
                date: cleanCell(row.cells[4]),

                /* Mengambil prioritas C4.5. */
                priority: getReportPriority(row),

                /* Mencatat waktu pemilihan laporan. */
                selectedAt: new Date().toISOString()
            };
        }

        /* ====================================================
           18. TOMBOL PERIKSA
        ==================================================== */

        tableBody.addEventListener("click", event => {

            /* Mengambil tombol Periksa yang diklik. */
            const button = event.target.closest(".check-button");

            if (!button) return;

            /* Mengambil baris laporan yang dipilih. */
            const row = button.closest("tr");

            if (!row) return;

            /* Mengambil seluruh identitas laporan. */
            const report = getSelectedReport(row);

            /* Memastikan kode laporan tersedia. */
            if (!report.id) {
                event.preventDefault();
                alert("Kode laporan tidak ditemukan.");
                return;
            }

            try {

                /* Menyimpan identitas laporan ke Local Storage. */
                localStorage.setItem(
                    SELECTED_REPORT_KEY,
                    JSON.stringify(report)
                );

                /* Memeriksa apakah tombol berada di dalam link. */
                const anchor = button.matches("a[href]")
                    ? button
                    : button.closest("a[href]");

                if (anchor) {

                    /* Mempertahankan URL tujuan yang sudah tersedia. */
                    const target = new URL(anchor.href);

                    target.searchParams.set(
                        "kode",
                        report.id
                    );

                    anchor.href = target.toString();

                } else {

                    /* Mengarahkan ke halaman Detail Verifikasi. */
                    event.preventDefault();

                    const detailURL = new URL(
                        "../Detail-Verifikasi-Laporan/Detail-Verifikasi-Laporan.html",
                        window.location.href
                    );

                    detailURL.searchParams.set(
                        "kode",
                        report.id
                    );

                    window.location.href = detailURL.toString();
                }

                console.log(
                    "[SIPFAS] Laporan terpilih:",
                    report
                );

            } catch (error) {

                event.preventDefault();

                console.error(
                    "[SIPFAS] Gagal membuka laporan:",
                    error
                );

                alert("Gagal membuka detail laporan.");
            }
        });

        /* ====================================================
           19. SINKRONISASI ANTARHALAMAN
        ==================================================== */

        /* Memperbarui data jika Local Storage berubah dari tab lain. */
        window.addEventListener("storage", event => {
            if (
                event.key === STORAGE_KEY ||
                event.key === null
            ) {
                synchronizeVerification();
                filterReports();
            }
        });

        /* Memperbarui data setelah verifikasi disimpan. */
        window.addEventListener(
            "sipfas:verification-saved",
            () => {
                synchronizeVerification();
                filterReports();
            }
        );

        /* Memperbarui data ketika pengguna kembali ke halaman. */
        window.addEventListener("pageshow", () => {
            synchronizeVerification();
            filterReports();
        });

        /* Memperbarui data ketika halaman kembali aktif. */
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
                synchronizeVerification();
                filterReports();
            }
        });

        /* ====================================================
           20. SIDEBAR RESPONSIF
        ==================================================== */

        function setSidebar(open) {
            if (!sidebar) return;

            sidebar.classList.toggle("open", open);

            pageOverlay?.classList.toggle("show", open);

            menuToggle?.setAttribute(
                "aria-expanded",
                String(open)
            );
        }

        /* Mengaktifkan tombol buka dan tutup sidebar. */
        menuToggle?.addEventListener("click", () => {
            setSidebar(
                !sidebar.classList.contains("open")
            );
        });

        /* Menutup sidebar ketika overlay diklik. */
        pageOverlay?.addEventListener(
            "click",
            () => setSidebar(false)
        );

        /* Menutup sidebar setelah menu navigasi dipilih. */
        document.querySelectorAll(".nav-link").forEach(link => {
            link.addEventListener(
                "click",
                () => setSidebar(false)
            );
        });

        /* Menutup sidebar menggunakan tombol Escape. */
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                setSidebar(false);
            }
        });

        /* ====================================================
           21. KONFIRMASI KELUAR
        ==================================================== */

        logoutLink?.addEventListener("click", event => {

            /* Mencegah navigasi sebelum konfirmasi. */
            event.preventDefault();

            /* Meminta konfirmasi pengguna. */
            const confirmation = window.confirm(
                "Apakah Anda yakin ingin keluar dari sistem SIPFAS?"
            );

            if (!confirmation) return;

            /* Membersihkan sesi login tanpa menghapus data laporan. */
            sessionStorage.clear();

            /* Mengarahkan pengguna ke halaman keluar. */
            window.location.href = logoutLink.href;
        });

        /* ====================================================
           22. INISIALISASI
        ==================================================== */

        /* Menyinkronkan prioritas dan status sebelum filter. */
        synchronizeVerification();

        /* Menampilkan seluruh laporan sesuai filter awal. */
        filterReports();

        /* Menampilkan informasi keberhasilan inisialisasi. */
        console.log(
            `[SIPFAS] Halaman siap. Total laporan: ${reportRows.length}`
        );

    });

})();
