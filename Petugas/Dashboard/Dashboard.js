
/* =========================================================
   DASHBOARD PETUGAS SIPFAS
   Pengelolaan interaksi dan data menggunakan localStorage.
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       1. KONFIGURASI PENYIMPANAN DATA
    ===================================================== */

    const STORAGE_REPORTS = "sipfas_dashboard_reports";
    const STORAGE_SUMMARY = "sipfas_dashboard_summary";
    const STORAGE_SELECTED = "sipfas_selected_report";

    /* Mengambil data laporan dari localStorage. */
    function getReports() {
        try {
            const data = localStorage.getItem(STORAGE_REPORTS);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error("Gagal membaca data laporan:", error);
            return null;
        }
    }

    /* Menyimpan data laporan ke localStorage. */
    function saveReports(reports) {
        try {
            localStorage.setItem(STORAGE_REPORTS, JSON.stringify(reports));
            return true;
        } catch (error) {
            console.error("Gagal menyimpan laporan:", error);
            return false;
        }
    }

    /* Mengambil ringkasan statistik dashboard. */
    function getSummary() {
        try {
            const data = localStorage.getItem(STORAGE_SUMMARY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error("Gagal membaca statistik:", error);
            return null;
        }
    }

    /* Menyimpan ringkasan statistik dashboard. */
    function saveSummary(summary) {
        try {
            localStorage.setItem(STORAGE_SUMMARY, JSON.stringify(summary));
            return true;
        } catch (error) {
            console.error("Gagal menyimpan statistik:", error);
            return false;
        }
    }


    /* =====================================================
       2. DATA AWAL DASHBOARD
    ===================================================== */

    /* Data berikut merupakan empat laporan yang tercantum
       pada tabel Dashboard.html. */

    const initialReports = [
        {
            id: "LPR-2024-001",
            facility: "AC Ruang Kuliah 3.1",
            location: "Gedung Kuliah Bersama Lt. 3",
            date: "24 Okt 2024",
            priority: "Tinggi",
            status: "Menunggu Verifikasi"
        },
        {
            id: "LPR-2024-004",
            facility: "Proyektor Lab Komputer 2",
            location: "Gedung TI Lantai 2",
            date: "23 Okt 2024",
            priority: "Sedang",
            status: "Menunggu Verifikasi"
        },
        {
            id: "LPR-2024-007",
            facility: "Pintu Toilet Gedung TI",
            location: "Gedung Informatika Lt. 1",
            date: "22 Okt 2024",
            priority: "Rendah",
            status: "Menunggu Verifikasi"
        },
        {
            id: "LPR-2024-009",
            facility: "Lampu Koridor Lt. 2",
            location: "Gedung TI Lt. 2",
            date: "21 Okt 2024",
            priority: "Sedang",
            status: "Menunggu Verifikasi"
        }
    ];

    /* Inisialisasi data hanya jika penyimpanan belum tersedia. */
    if (getReports() === null) {
        saveReports(initialReports);
    }

    /* Angka awal mengikuti empat kartu pada HTML.
       Total 12 merupakan ringkasan sistem, sedangkan tabel
       menampilkan empat laporan terbaru yang tersedia. */

    if (getSummary() === null) {
        saveSummary({
            total: 12,
            pending: 4,
            handling: 5,
            completed: 3
        });
    }


    /* =====================================================
       3. MENAMPILKAN STATISTIK DASHBOARD
    ===================================================== */

    function renderSummary() {

        const summary = getSummary();

        if (!summary) return;

        const cards = document.querySelectorAll(".summary-card");

        if (cards.length < 4) return;

        /* Kartu pertama: total laporan. */
        cards[0].querySelector(".number").textContent =
            summary.total;

        /* Kartu kedua: laporan menunggu verifikasi. */
        cards[1].querySelector(".number").textContent =
            summary.pending;

        /* Kartu ketiga: laporan dalam penanganan. */
        cards[2].querySelector(".number").textContent =
            summary.handling;

        /* Kartu keempat: laporan selesai. */
        cards[3].querySelector(".number").textContent =
            summary.completed;
    }


    /* =====================================================
       4. MENAMPILKAN TABEL LAPORAN
    ===================================================== */

    function renderReports() {

        const tableBody = document.querySelector(
            ".report-panel tbody"
        );

        if (!tableBody) return;

        const reports = getReports() || [];

        /* Mengosongkan tabel sebelum menampilkan data baru. */
        tableBody.replaceChildren();

        if (reports.length === 0) {

            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 6;
            cell.textContent = "Belum ada laporan yang tersedia.";
            cell.style.textAlign = "center";

            row.appendChild(cell);
            tableBody.appendChild(row);

            return;
        }

        /* Menampilkan setiap laporan sebagai satu baris tabel. */
        reports.forEach(function (report) {

            const row = document.createElement("tr");

            /* Kolom kode laporan. */
            const codeCell = document.createElement("td");
            codeCell.className = "report-code";
            codeCell.textContent = report.id;

            /* Kolom fasilitas. */
            const facilityCell = document.createElement("td");
            facilityCell.className = "facility";
            facilityCell.textContent = report.facility;

            /* Kolom lokasi. */
            const locationCell = document.createElement("td");
            locationCell.textContent = report.location;

            /* Kolom tanggal. */
            const dateCell = document.createElement("td");
            dateCell.textContent = report.date;

            /* Kolom prioritas. */
            const priorityCell = document.createElement("td");
            const priorityBadge = document.createElement("span");

            priorityBadge.classList.add("priority");

            if (report.priority === "Tinggi") {
                priorityBadge.classList.add("priority-high");
            } else if (report.priority === "Sedang") {
                priorityBadge.classList.add("priority-medium");
            } else {
                priorityBadge.classList.add("priority-low");
            }

            priorityBadge.textContent = report.priority;
            priorityCell.appendChild(priorityBadge);

            /* Kolom tombol periksa. */
            const actionCell = document.createElement("td");
            const actionLink = document.createElement("a");

            actionLink.href =
                "../Detail-Verifikasi-Laporan/Detail-Verifikasi-Laporan.html";

            actionLink.className = "action-button";
            actionLink.textContent = "Periksa";

            /* Menghubungkan tombol dengan laporan yang dipilih. */
            actionLink.addEventListener("click", function () {

                try {
                    localStorage.setItem(
                        STORAGE_SELECTED,
                        JSON.stringify(report)
                    );
                } catch (error) {
                    console.error("Gagal menyimpan laporan terpilih:", error);
                    alert("Data laporan tidak dapat disimpan.");
                }

                const targetURL = new URL(
                    actionLink.href,
                    window.location.href
                );

                targetURL.searchParams.set("id", report.id);

                actionLink.href = targetURL.href;
            });

            actionCell.appendChild(actionLink);

            /* Memasukkan seluruh kolom ke dalam baris. */
            row.append(
                codeCell,
                facilityCell,
                locationCell,
                dateCell,
                priorityCell,
                actionCell
            );

            tableBody.appendChild(row);
        });
    }


    /* =====================================================
       5. MENU SIDEBAR RESPONSIF
    ===================================================== */

    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    const pageOverlay = document.getElementById("pageOverlay");

    /* Membuka dan menutup sidebar pada perangkat mobile. */
    function toggleSidebar() {

        if (!sidebar || !pageOverlay) return;

        const isOpen = sidebar.classList.toggle("open");

        pageOverlay.classList.toggle("show", isOpen);

        if (menuToggle) {
            menuToggle.setAttribute(
                "aria-expanded",
                String(isOpen)
            );
        }
    }

    /* Menjalankan fungsi ketika tombol menu diklik. */
    if (menuToggle) {
        menuToggle.addEventListener("click", toggleSidebar);
    }

    /* Menutup sidebar ketika overlay diklik. */
    if (pageOverlay) {
        pageOverlay.addEventListener("click", toggleSidebar);
    }

    /* Menutup sidebar setelah salah satu menu dipilih. */
    document.querySelectorAll(".nav-link").forEach(function (link) {

        link.addEventListener("click", function () {

            if (sidebar && sidebar.classList.contains("open")) {
                sidebar.classList.remove("open");
                pageOverlay.classList.remove("show");

                if (menuToggle) {
                    menuToggle.setAttribute("aria-expanded", "false");
                }
            }

        });

    });

    /* Menutup sidebar menggunakan tombol Escape. */
    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape" && sidebar) {

            sidebar.classList.remove("open");

            if (pageOverlay) {
                pageOverlay.classList.remove("show");
            }

            if (menuToggle) {
                menuToggle.setAttribute("aria-expanded", "false");
            }
        }

    });


    /* =====================================================
       6. FUNGSI KELUAR DARI SISTEM
    ===================================================== */

    const logoutLink = document.getElementById("logoutLink");

    if (logoutLink) {

        logoutLink.addEventListener("click", function (event) {

            /* Mencegah navigasi langsung sebelum konfirmasi. */
            event.preventDefault();

            const confirmation = window.confirm(
                "Apakah Anda yakin ingin keluar dari sistem?"
            );

            if (confirmation) {

                /* Menghapus informasi sesi, bukan seluruh data laporan. */
                sessionStorage.clear();

                /* Mengarahkan pengguna ke halaman login. */
                window.location.href = "../../auth/login.html";

            }

        });

    }


    /* =====================================================
       7. INISIALISASI DASHBOARD
    ===================================================== */

    /* Menampilkan statistik ketika halaman pertama kali dibuka. */
    renderSummary();

    /* Menampilkan data laporan pada tabel. */
    renderReports();

    /* Informasi untuk pengujian melalui Console browser. */
    console.log("Dashboard SIPFAS berhasil dijalankan.");

    console.log("Data laporan:", getReports());

    console.log("Statistik dashboard:", getSummary());

});
