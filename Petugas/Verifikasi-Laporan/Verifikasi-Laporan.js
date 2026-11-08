
/* =========================================================
   SIPFAS - VERIFIKASI LAPORAN
   File: Verifikasi-Laporan.js

   Fungsi:
   1. Pencarian laporan.
   2. Filter prioritas C4.5.
   3. Sinkronisasi hasil verifikasi Local Storage.
   4. Pembaruan status laporan otomatis.
   5. Navigasi tombol Periksa.
   6. Sidebar responsif.
   7. Konfirmasi keluar.
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       1. KONFIGURASI PENYIMPANAN
    ===================================================== */

    // Key yang sama dengan halaman Detail Verifikasi.
    const STORAGE_KEY = "sipfas_verifikasi_laporan";

    // Penanda agar reset data lama hanya berjalan satu kali.
    const RESET_FLAG = "sipfas_reset_lpr001_v2_selesai";


    /* =====================================================
       2. RESET DATA PENGUJIAN LAMA SATU KALI
    ===================================================== */

    // Menghapus hanya hasil pengujian LPR-2024-001.
    // Laporan lainnya tetap dipertahankan.
    try {

        if (!localStorage.getItem(RESET_FLAG)) {

            const oldData = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "{}"
            );

            // Memastikan data berbentuk objek.
            if (
                oldData &&
                typeof oldData === "object" &&
                !Array.isArray(oldData)
            ) {

                delete oldData["LPR-2024-001"];

                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(oldData)
                );

            }

            // Menandai reset telah selesai.
            localStorage.setItem(RESET_FLAG, "true");

            console.log(
                "Reset data pengujian LPR-2024-001 selesai."
            );

        }

    } catch (error) {

        console.error(
            "Gagal melakukan reset data pengujian:",
            error
        );

    }


    /* =====================================================
       3. MENGAMBIL ELEMEN HTML
    ===================================================== */

    const searchInput = document.getElementById("searchReport");
    const priorityFilter = document.getElementById("priorityFilter");

    const table = document.querySelector(".verification-table");

    const tableBody = table
        ? table.querySelector("tbody")
        : null;

    const emptyState = document.getElementById("emptyState");

    const sidebar = document.getElementById("sidebar");
    const menuToggle = document.getElementById("menuToggle");
    const pageOverlay = document.getElementById("pageOverlay");
    const logoutLink = document.getElementById("logoutLink");


    /* =====================================================
       4. VALIDASI ELEMEN HTML
    ===================================================== */

    // Memastikan elemen utama tersedia.
    if (!searchInput || !priorityFilter || !tableBody) {

        console.error(
            "Elemen pencarian, filter, atau tabel tidak ditemukan."
        );

        return;

    }

    // Mengambil seluruh baris laporan.
    const reportRows = Array.from(
        tableBody.querySelectorAll("tr")
    );


    /* =====================================================
       5. NORMALISASI TEKS
    ===================================================== */

    // Menyamakan huruf kapital, kecil, dan spasi.
    function normalizeText(text) {

        return String(text || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

    }


    /* =====================================================
       6. MENGAMBIL KODE LAPORAN
    ===================================================== */

    // Mengambil kode laporan dari kolom pertama.
    function getReportCode(row) {

        return String(row.cells[0]?.innerText || "")
            .replace(/\s+/g, "")
            .trim();

    }


    /* =====================================================
       7. MEMBACA INFORMASI LAPORAN
    ===================================================== */

    // Menggabungkan seluruh informasi dalam satu baris.
    function getReportText(row) {

        const columnTexts = Array.from(row.cells).map(
            function (cell) {

                return cell.innerText || cell.textContent || "";

            }
        );

        return normalizeText(columnTexts.join(" "));

    }


    /* =====================================================
       8. MEMBACA PRIORITAS LAPORAN
    ===================================================== */

    // Mengambil prioritas dari atribut data-priority.
    function getReportPriority(row) {

        return normalizeText(
            row.getAttribute("data-priority")
        );

    }


    /* =====================================================
       9. MEMBACA DATA LOCAL STORAGE
    ===================================================== */

    // Mengambil seluruh hasil verifikasi.
    function getVerificationData() {

        try {

            const storedData = localStorage.getItem(STORAGE_KEY);

            if (!storedData) {
                return {};
            }

            const parsedData = JSON.parse(storedData);

            if (
                !parsedData ||
                typeof parsedData !== "object" ||
                Array.isArray(parsedData)
            ) {
                return {};
            }

            return parsedData;

        } catch (error) {

            console.error(
                "Gagal membaca hasil verifikasi:",
                error
            );

            return null;

        }

    }


    /* =====================================================
       10. MEMPERBARUI STATUS PADA TABEL
    ===================================================== */

    // Mengubah status berdasarkan keputusan yang benar-benar
    // tersimpan di Local Storage.
    function synchronizeVerification() {

        const verificationData = getVerificationData();

        // Jangan mengubah status jika data gagal dibaca.
        if (verificationData === null) {

            console.error(
                "Sinkronisasi dibatalkan karena data tidak terbaca."
            );

            return;

        }

        // Memeriksa seluruh laporan.
        reportRows.forEach(function (row) {

            // Mengambil kode laporan.
            const reportCode = getReportCode(row);

            // Kolom ketujuh adalah kolom status verifikasi.
            const statusCell = row.cells[6];

            if (!statusCell) {
                return;
            }

            // Mengambil elemen status.
            const statusPill = statusCell.querySelector(
                ".status-pill"
            );

            if (!statusPill) {
                return;
            }

            // Mengambil hasil verifikasi berdasarkan kode laporan.
            const savedData = verificationData[reportCode];

            // KONDISI 1: Belum ada keputusan yang disimpan.
            if (
                !savedData ||
                !["valid", "invalid"].includes(savedData.decision)
            ) {

                statusPill.textContent = "Menunggu Verifikasi";

                row.dataset.verificationStatus = "menunggu";

                statusPill.setAttribute(
                    "aria-label",
                    "Menunggu Verifikasi"
                );

                return;

            }

            // KONDISI 2: Laporan dinyatakan valid.
            if (savedData.decision === "valid") {

                statusPill.textContent = "Terverifikasi";

                row.dataset.verificationStatus = "valid";

                statusPill.setAttribute(
                    "aria-label",
                    "Terverifikasi"
                );

                return;

            }

            // KONDISI 3: Laporan dinyatakan tidak valid.
            if (savedData.decision === "invalid") {

                statusPill.textContent = "Tidak Valid";

                row.dataset.verificationStatus = "invalid";

                statusPill.setAttribute(
                    "aria-label",
                    "Tidak Valid"
                );

            }

        });

        console.log(
            "Sinkronisasi status laporan berhasil."
        );

    }


    /* =====================================================
       11. MEMERIKSA KECOCOKAN PENCARIAN
    ===================================================== */

    // Semua kata pencarian harus ditemukan dalam informasi laporan.
    function matchesSearch(row, keyword) {

        if (!keyword) {
            return true;
        }

        const reportText = getReportText(row);

        const searchWords = keyword
            .split(/\s+/)
            .filter(Boolean);

        return searchWords.every(function (word) {

            return reportText.includes(word);

        });

    }


    /* =====================================================
       12. MEMERIKSA FILTER PRIORITAS
    ===================================================== */

    function matchesPriority(row, selectedPriority) {

        // Menampilkan semua laporan jika memilih Semua Prioritas.
        if (
            !selectedPriority ||
            selectedPriority === "semua"
        ) {

            return true;

        }

        return getReportPriority(row) === selectedPriority;

    }


    /* =====================================================
       13. FUNGSI PENCARIAN DAN FILTER
    ===================================================== */

    function filterReports() {

        // Mengambil kata pencarian.
        const keyword = normalizeText(searchInput.value);

        // Mengambil pilihan prioritas.
        const selectedPriority = normalizeText(
            priorityFilter.value
        );

        // Menghitung laporan yang ditemukan.
        let visibleCount = 0;

        // Memeriksa seluruh laporan.
        reportRows.forEach(function (row) {

            const searchMatch = matchesSearch(
                row,
                keyword
            );

            const priorityMatch = matchesPriority(
                row,
                selectedPriority
            );

            // Kedua kondisi harus terpenuhi.
            const shouldDisplay =
                searchMatch && priorityMatch;

            if (shouldDisplay) {

                row.hidden = false;

                row.style.removeProperty("display");

                visibleCount++;

            } else {

                row.hidden = true;

                row.style.setProperty(
                    "display",
                    "none",
                    "important"
                );

            }

        });


        /* =================================================
           14. PESAN DATA TIDAK DITEMUKAN
        ================================================= */

        if (emptyState) {

            emptyState.hidden = visibleCount > 0;

            emptyState.style.display =
                visibleCount === 0 ? "block" : "none";

        }

        console.log(
            "Jumlah laporan ditemukan:",
            visibleCount
        );

    }


    /* =====================================================
       15. EVENT PENCARIAN
    ===================================================== */

    // Menjalankan pencarian ketika pengguna mengetik.
    searchInput.addEventListener(
        "input",
        filterReports
    );

    // Menangani tombol hapus pada kolom pencarian.
    searchInput.addEventListener(
        "search",
        filterReports
    );


    /* =====================================================
       16. EVENT FILTER PRIORITAS
    ===================================================== */

    // Memperbarui tabel ketika pilihan prioritas berubah.
    priorityFilter.addEventListener(
        "change",
        filterReports
    );


    /* =====================================================
       17. TOMBOL PERIKSA
    ===================================================== */

    // Menggunakan event delegation untuk tombol Periksa.
    tableBody.addEventListener("click", function (event) {

        const checkButton = event.target.closest(
            ".check-button"
        );

        if (!checkButton) {
            return;
        }

        const selectedRow = checkButton.closest("tr");

        if (!selectedRow) {
            return;
        }

        const cells = selectedRow.cells;

        // Mengambil informasi laporan.
        const selectedReport = {

            id: getReportCode(selectedRow),

            reporter: (
                cells[1]?.innerText || ""
            ).replace(/\s+/g, " ").trim(),

            facility: (
                cells[2]?.innerText || ""
            ).replace(/\s+/g, " ").trim(),

            location: (
                cells[3]?.innerText || ""
            ).replace(/\s+/g, " ").trim(),

            date: (
                cells[4]?.innerText || ""
            ).replace(/\s+/g, " ").trim(),

            priority: getReportPriority(selectedRow)

        };

        try {

            // Menyimpan laporan yang akan diperiksa.
            localStorage.setItem(
                "sipfas_selected_report",
                JSON.stringify(selectedReport)
            );

        } catch (error) {

            event.preventDefault();

            console.error(
                "Gagal menyimpan laporan terpilih:",
                error
            );

            alert("Data laporan gagal disimpan.");

            return;

        }

        console.log(
            "Laporan yang dipilih:",
            selectedReport
        );

        // Navigasi tetap menggunakan href dari HTML.

    });


    /* =====================================================
       18. SINKRONISASI ANTARHALAMAN
    ===================================================== */

    // Menangani perubahan Local Storage dari tab browser lain.
    window.addEventListener("storage", function (event) {

        if (
            event.key === STORAGE_KEY ||
            event.key === null
        ) {

            synchronizeVerification();

        }

    });

    // Menangani penyimpanan dari halaman detail dalam
    // dokumen yang sama jika event dikirim.
    window.addEventListener(
        "sipfas:verification-saved",
        function () {

            synchronizeVerification();

        }
    );

    // Memperbarui status ketika pengguna kembali ke halaman daftar.
    window.addEventListener("pageshow", function () {

        synchronizeVerification();

        filterReports();

    });


    /* =====================================================
       19. SIDEBAR RESPONSIF
    ===================================================== */

    // Mengatur kondisi buka dan tutup sidebar.
    function setSidebar(isOpen) {

        if (!sidebar) {
            return;
        }

        sidebar.classList.toggle("open", isOpen);

        if (pageOverlay) {

            pageOverlay.classList.toggle(
                "show",
                isOpen
            );

        }

        if (menuToggle) {

            menuToggle.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

        }

    }

    // Membuka dan menutup sidebar.
    if (menuToggle) {

        menuToggle.addEventListener("click", function () {

            const isOpen = sidebar
                ? sidebar.classList.contains("open")
                : false;

            setSidebar(!isOpen);

        });

    }

    // Menutup sidebar ketika overlay diklik.
    if (pageOverlay) {

        pageOverlay.addEventListener("click", function () {

            setSidebar(false);

        });

    }

    // Menutup sidebar setelah menu navigasi dipilih.
    document.querySelectorAll(".nav-link").forEach(
        function (link) {

            link.addEventListener("click", function () {

                setSidebar(false);

            });

        }
    );

    // Menutup sidebar menggunakan tombol Escape.
    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape") {

            setSidebar(false);

        }

    });


    /* =====================================================
       20. KONFIRMASI KELUAR
    ===================================================== */

    if (logoutLink) {

        logoutLink.addEventListener("click", function (event) {

            event.preventDefault();

            const confirmation = window.confirm(
                "Apakah Anda yakin ingin keluar dari sistem SIPFAS?"
            );

            if (!confirmation) {
                return;
            }

            // Menghapus sesi sementara.
            sessionStorage.clear();

            // Mengarahkan pengguna ke halaman tujuan HTML.
            window.location.href = logoutLink.href;

        });

    }


    /* =====================================================
       21. INISIALISASI HALAMAN
    ===================================================== */

    // Membaca status verifikasi terlebih dahulu.
    synchronizeVerification();

    // Menjalankan pencarian awal.
    filterReports();

    // Menampilkan informasi awal.
    console.log(
        "Verifikasi Laporan SIPFAS berhasil dijalankan."
    );

    console.log(
        "Jumlah seluruh laporan:",
        reportRows.length
    );

});
