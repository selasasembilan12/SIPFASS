
/* =========================================================
   SIPFAS - PENANGANAN FASILITAS
   File: Penanganan.js

   FUNGSI:
   1. Mengambil laporan yang sudah diverifikasi valid.
   2. Menampilkan laporan pada daftar penanganan.
   3. Mengintegrasikan data hasil verifikasi.
   4. Mengintegrasikan status penanganan.
   5. Menyimpan dan membaca status penanganan.
   6. Pencarian laporan.
   7. Filter prioritas C4.5.
   8. Sinkronisasi perubahan data.
   9. Navigasi halaman detail penanganan.
   10. Sidebar responsif.
   11. Konfirmasi keluar sistem.

   SUMBER DATA:
   - sipfas_verifikasi_laporan
   - sipfas_penanganan_laporan
========================================================= */


document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       1. KONFIGURASI PENYIMPANAN
    ===================================================== */

    const VERIFICATION_KEY = "sipfas_verifikasi_laporan";

    const HANDLING_KEY = "sipfas_penanganan_laporan";


    /* =====================================================
       2. MENGAMBIL ELEMEN HTML
    ===================================================== */

    const searchInput = document.getElementById("searchHandling");

    const priorityFilter = document.getElementById("priorityHandling");

    const table = document.querySelector(".handling-table");

    const tableBody = table
        ? table.querySelector("tbody")
        : null;

    const emptyState = document.getElementById("emptyHandling");

    const sidebar = document.getElementById("sidebar");

    const menuToggle = document.getElementById("menuToggle");

    const pageOverlay = document.getElementById("pageOverlay");

    const logoutLink = document.getElementById("logoutLink");


    /* =====================================================
       3. VALIDASI ELEMEN
    ===================================================== */

    if (!searchInput || !priorityFilter || !tableBody) {

        console.error(
            "Elemen pencarian, filter, atau tabel penanganan tidak ditemukan."
        );

        return;

    }


    /* =====================================================
       4. KONFIGURASI STATUS PENANGANAN
    ===================================================== */

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


    /* =====================================================
       5. NORMALISASI TEKS
    ===================================================== */

    function normalizeText(text) {

        return String(text || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

    }


    /* =====================================================
       6. MEMBACA LOCAL STORAGE
    ===================================================== */

    function readStorage(key) {

        try {

            const rawData = localStorage.getItem(key);

            if (!rawData) {
                return {};
            }

            const parsedData = JSON.parse(rawData);

            if (
                !parsedData ||
                typeof parsedData !== "object" ||
                Array.isArray(parsedData)
            ) {

                console.error(
                    "Format penyimpanan tidak valid:",
                    key
                );

                return null;

            }

            return parsedData;

        } catch (error) {

            console.error(
                "Gagal membaca Local Storage:",
                key,
                error
            );

            return null;

        }

    }


    /* =====================================================
       7. MEMBACA DATA VERIFIKASI
    ===================================================== */

    function getVerificationData() {

        return readStorage(VERIFICATION_KEY);

    }


    /* =====================================================
       8. MEMBACA DATA PENANGANAN
    ===================================================== */

    function getHandlingData() {

        return readStorage(HANDLING_KEY);

    }


    /* =====================================================
       9. NORMALISASI PRIORITAS C4.5
    ===================================================== */

    function normalizePriority(priority) {

        const value = normalizeText(priority);

        if (
            value.includes("tinggi") ||
            value === "high"
        ) {

            return "tinggi";

        }

        if (
            value.includes("sedang") ||
            value === "medium"
        ) {

            return "sedang";

        }

        if (
            value.includes("rendah") ||
            value === "low"
        ) {

            return "rendah";

        }

        return "tidak diketahui";

    }


    /* =====================================================
       10. NORMALISASI STATUS PENANGANAN
    ===================================================== */

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


    /* =====================================================
       11. MENGAMBIL DATA TABEL HTML AWAL
    ===================================================== */

    // Data HTML hanya menjadi sumber cadangan untuk informasi
    // yang belum tersedia pada objek hasil verifikasi.
    // Data verifikasi tetap menjadi sumber utama.

    const originalRows = Array.from(
        tableBody.querySelectorAll("tr")
    );

    const originalReportData = {};

    originalRows.forEach(function (row) {

        const reportCode = (
            row.cells[0]?.innerText || ""
        ).trim();

        if (!reportCode) {
            return;
        }

        const facilityCell = row.cells[1];

        const locationCell = row.cells[2];

        const priorityCell = row.cells[3];

        const dateCell = row.cells[5];

        originalReportData[reportCode] = {

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


    /* =====================================================
       12. MENGAMBIL KODE LAPORAN
    ===================================================== */

    function getReportCode(verification) {

        return String(
            verification?.reportCode ||
            verification?.id ||
            ""
        ).trim();

    }


    /* =====================================================
       13. MEMBUAT BADGE STATUS
    ===================================================== */

    function createStatusBadge(status) {

        const normalizedStatus = normalizeHandlingStatus(status);

        const configuration = HANDLING_STATUS[normalizedStatus];

        const badge = document.createElement("span");

        badge.className =
            "status-badge " + configuration.className;

        const icon = document.createElement("span");

        icon.setAttribute("aria-hidden", "true");

        icon.textContent = configuration.icon;

        badge.appendChild(icon);

        badge.appendChild(
            document.createTextNode(configuration.label)
        );

        badge.setAttribute(
            "aria-label",
            configuration.label
        );

        return badge;

    }


    /* =====================================================
       14. MEMBUAT BARIS LAPORAN
    ===================================================== */

    function createReportRow(verification, handlingData) {

        const reportCode = getReportCode(verification);

        const original = originalReportData[reportCode] || {};

        // Prioritas menggunakan data hasil verifikasi.
        const priority = normalizePriority(
            verification.priority || original.priority
        );

        // Data fasilitas menggunakan hasil verifikasi.
        const facility =
            verification.facilityName ||
            original.facility ||
            "Data fasilitas tidak tersedia";

        const damage =
            verification.damage ||
            original.damage ||
            "Deskripsi kerusakan tidak tersedia";

        const location =
            verification.facilityLocation ||
            original.location ||
            "Lokasi tidak tersedia";

        // Tanggal laporan tidak selalu tersedia pada hasil verifikasi.
        const reportDate =
            verification.reportDate ||
            verification.date ||
            original.date ||
            "—";

        // Mengambil status penanganan yang sudah disimpan.
        const savedHandling = handlingData[reportCode] || {};

        const handlingStatus = normalizeHandlingStatus(
            savedHandling.status ||
            savedHandling.handlingStatus ||
            savedHandling.statusPenanganan ||
            "waiting"
        );


        /* ================================================
           MEMBUAT BARIS TABEL
        ================================================ */

        const row = document.createElement("tr");

        row.dataset.priority = priority;

        row.dataset.reportCode = reportCode;

        row.dataset.verificationStatus = "valid";

        row.dataset.handlingStatus = handlingStatus;


        /* ================================================
           KOLOM 1: KODE LAPORAN
        ================================================ */

        const codeCell = document.createElement("td");

        const codeBadge = document.createElement("span");

        codeBadge.className =
            "report-id " + priority;

        codeBadge.textContent = reportCode;

        codeCell.appendChild(codeBadge);


        /* ================================================
           KOLOM 2: FASILITAS DAN KERUSAKAN
        ================================================ */

        const facilityCell = document.createElement("td");

        facilityCell.className = "facility";

        const facilityName = document.createElement("strong");

        facilityName.textContent = facility;

        const damageDescription = document.createElement("small");

        damageDescription.textContent = damage;

        facilityCell.appendChild(facilityName);

        facilityCell.appendChild(damageDescription);


        /* ================================================
           KOLOM 3: LOKASI
        ================================================ */

        const locationCell = document.createElement("td");

        const locationElement = document.createElement("span");

        locationElement.className = "location";

        locationElement.textContent = location;

        locationCell.appendChild(locationElement);


        /* ================================================
           KOLOM 4: PRIORITAS C4.5
        ================================================ */

        const priorityCell = document.createElement("td");

        const priorityBadge = document.createElement("span");

        priorityBadge.className =
            "priority-badge " + priority;

        priorityBadge.textContent =
            priority === "tidak diketahui"
                ? "Tidak Diketahui"
                : priority.charAt(0).toUpperCase() +
                  priority.slice(1);

        priorityCell.appendChild(priorityBadge);


        /* ================================================
           KOLOM 5: STATUS PENANGANAN
        ================================================ */

        const statusCell = document.createElement("td");

        statusCell.appendChild(
            createStatusBadge(handlingStatus)
        );


        /* ================================================
           KOLOM 6: TANGGAL LAPORAN
        ================================================ */

        const dateCell = document.createElement("td");

        dateCell.className = "date";

        dateCell.textContent = reportDate;


        /* ================================================
           KOLOM 7: AKSI
        ================================================ */

        const actionCell = document.createElement("td");

        const manageLink = document.createElement("a");

        manageLink.className = "manage-button";

        manageLink.href =
            "../Detail-Penanganan/Detail-Penanganan.html?kode=" +
            encodeURIComponent(reportCode);

        // Ikon aksi.
        const actionIcon = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        );

        actionIcon.setAttribute("viewBox", "0 0 24 24");

        actionIcon.setAttribute("aria-hidden", "true");

        const iconCircle = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
        );

        iconCircle.setAttribute("cx", "9");

        iconCircle.setAttribute("cy", "7");

        iconCircle.setAttribute("r", "2.5");

        const iconPath = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
        );

        iconPath.setAttribute(
            "d",
            "M3 19v-2a5 5 0 0 1 10 0v2H3ZM17 4v5m-2.5-2.5h5M15 14h6v5h-6z"
        );

        actionIcon.appendChild(iconCircle);

        actionIcon.appendChild(iconPath);

        manageLink.appendChild(actionIcon);

        manageLink.appendChild(
            document.createTextNode("Kelola Penanganan")
        );

        actionCell.appendChild(manageLink);


        /* ================================================
           MEMASUKKAN SEMUA KOLOM KE BARIS
        ================================================ */

        row.appendChild(codeCell);

        row.appendChild(facilityCell);

        row.appendChild(locationCell);

        row.appendChild(priorityCell);

        row.appendChild(statusCell);

        row.appendChild(dateCell);

        row.appendChild(actionCell);


        /* ================================================
           DATA UNTUK PENCARIAN
        ================================================ */

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


    /* =====================================================
       15. VALIDASI LAPORAN SEBELUM MASUK PENANGANAN
    ===================================================== */

    function isEligibleForHandling(verification) {

        if (!verification) {
            return false;
        }

        // Hanya keputusan valid yang boleh diteruskan.
        if (verification.decision !== "valid") {
            return false;
        }

        // Status harus berasal dari hasil verifikasi tersimpan.
        if (
            verification.status &&
            verification.status !== "Selesai Diverifikasi"
        ) {

            return false;

        }

        return true;

    }


    /* =====================================================
       16. MEMUAT DAN MENYINKRONKAN DAFTAR PENANGANAN
    ===================================================== */

    function loadHandlingReports() {

        const verificationData = getVerificationData();

        const handlingData = getHandlingData();

        // Jika penyimpanan gagal dibaca, jangan menampilkan
        // data contoh seolah-olah merupakan data aktual.
        if (
            verificationData === null ||
            handlingData === null
        ) {

            tableBody.replaceChildren();

            showEmptyState(
                "Data verifikasi atau penanganan tidak dapat dibaca. Periksa Local Storage."
            );

            console.error(
                "Pemuatan daftar penanganan dibatalkan."
            );

            return;

        }


        // Mengambil laporan yang telah diverifikasi valid.
        const eligibleReports = Object.values(
            verificationData
        ).filter(isEligibleForHandling);


        // Menghindari duplikasi kode laporan.
        const uniqueReports = new Map();

        eligibleReports.forEach(function (report) {

            const reportCode = getReportCode(report);

            if (!reportCode) {
                return;
            }

            uniqueReports.set(reportCode, report);

        });


        // Membuat ulang daftar laporan berdasarkan data aktual.
        const fragment = document.createDocumentFragment();

        uniqueReports.forEach(function (verification) {

            const row = createReportRow(
                verification,
                handlingData
            );

            fragment.appendChild(row);

        });


        // Mengganti data contoh HTML dengan hasil sinkronisasi.
        tableBody.replaceChildren(fragment);


        // Memperbarui pencarian dan filter.
        filterHandling();


        console.log(
            "Sinkronisasi penanganan selesai."
        );

        console.log(
            "Jumlah laporan valid:",
            uniqueReports.size
        );

    }


    /* =====================================================
       17. PESAN DATA KOSONG
    ===================================================== */

    function showEmptyState(message) {

        if (!emptyState) {
            return;
        }

        emptyState.textContent = message;

        emptyState.hidden = false;

        emptyState.style.display = "block";

    }


    /* =====================================================
       18. PENCARIAN LAPORAN
    ===================================================== */

    function matchesSearch(row, keyword) {

        if (!keyword) {
            return true;
        }

        const reportText = normalizeText(
            row.dataset.search || row.innerText
        );

        const searchWords = keyword
            .split(/\s+/)
            .filter(Boolean);

        return searchWords.every(function (word) {

            return reportText.includes(word);

        });

    }


    /* =====================================================
       19. FILTER PRIORITAS
    ===================================================== */

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


    /* =====================================================
       20. FUNGSI UTAMA PENCARIAN DAN FILTER
    ===================================================== */

    function filterHandling() {

        const rows = Array.from(
            tableBody.querySelectorAll("tr")
        );

        const keyword = normalizeText(searchInput.value);

        const selectedPriority = normalizeText(
            priorityFilter.value
        );

        let visibleCount = 0;

        rows.forEach(function (row) {

            const searchMatch = matchesSearch(
                row,
                keyword
            );

            const priorityMatch = matchesPriority(
                row,
                selectedPriority
            );

            const shouldDisplay =
                searchMatch && priorityMatch;

            row.hidden = !shouldDisplay;

            if (shouldDisplay) {

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


        // Mengatur pesan data kosong.
        if (emptyState) {

            if (rows.length === 0) {

                showEmptyState(
                    "Belum ada laporan yang memenuhi syarat untuk penanganan."
                );

            } else if (visibleCount === 0) {

                showEmptyState(
                    "Tidak ada penanganan yang cocok dengan pencarian atau filter."
                );

            } else {

                emptyState.hidden = true;

                emptyState.style.display = "none";

            }

        }


        console.log(
            "Jumlah laporan penanganan ditemukan:",
            visibleCount
        );

    }


    /* =====================================================
       21. EVENT PENCARIAN
    ===================================================== */

    searchInput.addEventListener(
        "input",
        filterHandling
    );

    searchInput.addEventListener(
        "search",
        filterHandling
    );


    /* =====================================================
       22. EVENT FILTER PRIORITAS
    ===================================================== */

    priorityFilter.addEventListener(
        "change",
        filterHandling
    );


    /* =====================================================
       23. SINKRONISASI PERUBAHAN VERIFIKASI
    ===================================================== */

    // Event yang dikirim oleh halaman Verifikasi.
    window.addEventListener(
        "sipfas:verification-saved",
        function () {

            loadHandlingReports();

        }
    );


    // Perubahan Local Storage dari tab browser lainnya.
    window.addEventListener(
        "storage",
        function (event) {

            if (
                event.key === VERIFICATION_KEY ||
                event.key === HANDLING_KEY ||
                event.key === null
            ) {

                loadHandlingReports();

            }

        }
    );


    /* =====================================================
       24. SINKRONISASI PERUBAHAN PENANGANAN
    ===================================================== */

    // Event ini dapat dikirim oleh halaman Detail Penanganan
    // setelah petugas menyimpan perubahan status.
    window.addEventListener(
        "sipfas:handling-saved",
        function () {

            loadHandlingReports();

        }
    );


    /* =====================================================
       25. MEMUAT ULANG DATA KETIKA HALAMAN DIBUKA
    ===================================================== */

    window.addEventListener(
        "pageshow",
        function () {

            loadHandlingReports();

        }
    );


    /* =====================================================
       26. SIDEBAR RESPONSIF
    ===================================================== */

    function setSidebar(isOpen) {

        if (!sidebar) {
            return;
        }

        sidebar.classList.toggle(
            "open",
            isOpen
        );

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

        menuToggle.addEventListener(
            "click",
            function () {

                const isOpen = sidebar
                    ? sidebar.classList.contains("open")
                    : false;

                setSidebar(!isOpen);

            }
        );

    }


    // Menutup sidebar melalui overlay.
    if (pageOverlay) {

        pageOverlay.addEventListener(
            "click",
            function () {

                setSidebar(false);

            }
        );

    }


    // Menutup sidebar setelah menu dipilih.
    document.querySelectorAll(".nav-link").forEach(
        function (link) {

            link.addEventListener(
                "click",
                function () {

                    setSidebar(false);

                }
            );

        }
    );


    // Menutup sidebar dengan tombol Escape.
    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape") {

                setSidebar(false);

            }

        }
    );


    /* =====================================================
       27. KONFIRMASI KELUAR
    ===================================================== */

    if (logoutLink) {

        logoutLink.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                const confirmation = window.confirm(
                    "Apakah Anda yakin ingin keluar dari sistem SIPFAS?"
                );

                if (!confirmation) {
                    return;
                }

                // Menghapus sesi sementara.
                sessionStorage.clear();

                // Mengarahkan pengguna ke halaman tujuan.
                window.location.href = logoutLink.href;

            }
        );

    }


    /* =====================================================
       28. INISIALISASI HALAMAN
    ===================================================== */

    // Memuat data verifikasi dan penanganan.
    loadHandlingReports();


    console.log(
        "========================================"
    );

    console.log(
        "SIPFAS - PENANGANAN FASILITAS"
    );

    console.log(
        "Program berhasil diinisialisasi."
    );

    console.log(
        "Sumber data:",
        VERIFICATION_KEY,
        HANDLING_KEY
    );

    console.log(
        "========================================"
    );

});
