
/* =========================================================
   SIPFAS - DETAIL VERIFIKASI LAPORAN
   File: Detail-Verifikasi-Laporan.js

   Fungsi:
   1. Memilih keputusan valid atau tidak valid.
   2. Mengelola catatan verifikator.
   3. Menyimpan hasil verifikasi ke Local Storage.
   4. Memuat kembali data yang sudah tersimpan.
   5. Memperbarui status laporan secara otomatis.
   6. Menjaga status awal tetap Menunggu Verifikasi.
========================================================= */


/* =========================================================
   1. KONFIGURASI PENYIMPANAN
========================================================= */

// Key penyimpanan yang digunakan seluruh halaman SIPFAS.
const STORAGE_KEY = "sipfas_verifikasi_laporan";

// Keputusan awal dikosongkan agar tidak otomatis dianggap valid.
let selectedDecision = "";


/* =========================================================
   2. MENUNGGU HALAMAN SELESAI DIMUAT
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    // Mengambil elemen HTML yang dibutuhkan.
    const reportCodeElement = document.getElementById("reportCode");
    const pageCodeElement = document.getElementById("pageCode");
    const decisionButtons = document.querySelectorAll(".decision-option");
    const decisionNotice = document.getElementById("decisionNotice");
    const verifierNotes = document.getElementById("verifierNotes");
    const saveButton = document.getElementById("saveVerification");
    const saveFeedback = document.getElementById("saveFeedback");

    // Mengambil kode laporan dari URL.
    const urlParams = new URLSearchParams(window.location.search);
    const urlReportCode = urlParams.get("kode");

    // Memperbarui kode laporan jika tersedia di URL.
    if (urlReportCode) {

        if (reportCodeElement) {
            reportCodeElement.textContent = urlReportCode;
        }

        if (pageCodeElement) {
            pageCodeElement.textContent = urlReportCode;
        }

    }

    // Mengambil kode laporan yang sedang diperiksa.
    const reportCode = reportCodeElement
        ? reportCodeElement.textContent.trim()
        : "";

    // Memastikan elemen utama tersedia.
    if (!reportCode || !saveButton || !verifierNotes) {
        console.error("Elemen verifikasi laporan tidak ditemukan.");
        return;
    }


    /* =====================================================
       3. MENCARI ELEMEN STATUS LAPORAN
    ===================================================== */

    // Mencari badge status pada halaman detail.
    function getStatusElement() {

        const selectors = [
            "#verificationStatus",
            "#reportStatus",
            ".verification-status",
            ".report-status",
            ".status-badge",
            "[data-report-status]"
        ];

        // Mencari berdasarkan ID atau class yang umum digunakan.
        for (const selector of selectors) {

            const element = document.querySelector(selector);

            if (element) {
                return element;
            }

        }

        // Jika tidak ditemukan, cari elemen berdasarkan teks status.
        const elements = document.querySelectorAll(
            "span, div, p, strong"
        );

        for (const element of elements) {

            const text = element.textContent.trim().toUpperCase();

            if (
                text === "MENUNGGU VERIFIKASI" ||
                text === "TERVERIFIKASI" ||
                text === "TIDAK VALID" ||
                text === "MENUNGGU"
            ) {
                return element;
            }

        }

        return null;

    }


    /* =====================================================
       4. MEMPERBARUI STATUS LAPORAN
    ===================================================== */

    // Mengubah badge berdasarkan keputusan yang tersimpan.
    function updateReportStatus(decision) {

        const statusElement = getStatusElement();

        if (!statusElement) {
            console.warn(
                "Elemen badge status tidak ditemukan pada HTML."
            );
            return;
        }

        // Menentukan teks status.
        let statusText = "MENUNGGU VERIFIKASI";

        if (decision === "valid") {

            statusText = "TERVERIFIKASI";

        } else if (decision === "invalid") {

            statusText = "TIDAK VALID";

        }

        // Memperbarui tulisan status.
        statusElement.textContent = statusText;

        // Menyimpan status pada atribut data.
        statusElement.dataset.reportStatus = decision || "pending";

        // Memberikan informasi status kepada browser.
        statusElement.setAttribute("aria-label", statusText);

    }


    /* =====================================================
       5. MEMBACA DATA LOCAL STORAGE
    ===================================================== */

    // Mengambil seluruh hasil verifikasi.
    function getVerificationData() {

        try {

            const storedData = localStorage.getItem(STORAGE_KEY);

            return storedData ? JSON.parse(storedData) : {};

        } catch (error) {

            console.error(
                "Gagal membaca data verifikasi:",
                error
            );

            return null;

        }

    }


    /* =====================================================
       6. MENAMPILKAN NOTIFIKASI
    ===================================================== */

    // Menampilkan pesan berhasil, informasi, atau gagal.
    function showFeedback(message, type) {

        if (!saveFeedback) return;

        saveFeedback.textContent = message;
        saveFeedback.dataset.state = type;

    }


    /* =====================================================
       7. MENGUBAH PILIHAN KEPUTUSAN
    ===================================================== */

    // Mengatur pilihan tombol dan pemberitahuan keputusan.
    function updateDecision(decision) {

        selectedDecision = decision;

        // Memperbarui tampilan tombol keputusan.
        decisionButtons.forEach(function (button) {

            const isSelected =
                button.dataset.decision === decision;

            button.classList.toggle("selected", isSelected);

            button.setAttribute(
                "aria-pressed",
                String(isSelected)
            );

        });

        // Mengambil elemen judul dan deskripsi pemberitahuan.
        const noticeTitle = decisionNotice
            ? decisionNotice.querySelector("strong span")
            : null;

        const noticeDescription = decisionNotice
            ? decisionNotice.querySelector("p")
            : null;

        // Menampilkan pemberitahuan untuk keputusan Valid.
        if (decision === "valid") {

            if (decisionNotice) {
                decisionNotice.classList.remove("invalid");
                decisionNotice.classList.add("valid");
            }

            if (noticeTitle) {
                noticeTitle.textContent =
                    "Laporan Memenuhi Syarat";
            }

            if (noticeDescription) {
                noticeDescription.textContent =
                    "Laporan diverifikasi valid dan akan diteruskan ke daftar antrean Penanganan Fasilitas.";
            }

        }

        // Menampilkan pemberitahuan untuk keputusan Tidak Valid.
        else if (decision === "invalid") {

            if (decisionNotice) {
                decisionNotice.classList.remove("valid");
                decisionNotice.classList.add("invalid");
            }

            if (noticeTitle) {
                noticeTitle.textContent =
                    "Laporan Tidak Memenuhi Syarat";
            }

            if (noticeDescription) {
                noticeDescription.textContent =
                    "Laporan dinyatakan tidak valid dan tidak diteruskan ke daftar antrean Penanganan Fasilitas.";
            }

        }

        // Mengembalikan pemberitahuan jika belum ada keputusan.
        else {

            if (decisionNotice) {
                decisionNotice.classList.remove("valid", "invalid");
            }

            if (noticeTitle) {
                noticeTitle.textContent =
                    "Menunggu Keputusan Verifikasi";
            }

            if (noticeDescription) {
                noticeDescription.textContent =
                    "Silakan pilih keputusan valid atau tidak valid untuk laporan ini.";
            }

        }

    }


    /* =====================================================
       8. EVENT TOMBOL VALID DAN TIDAK VALID
    ===================================================== */

    // Menjalankan fungsi ketika petugas memilih keputusan.
    decisionButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            const decision = button.dataset.decision;

            // Memastikan keputusan sesuai pilihan.
            if (
                decision !== "valid" &&
                decision !== "invalid"
            ) {
                return;
            }

            // Memperbarui pilihan sementara.
            updateDecision(decision);

            // Menghapus pesan penyimpanan sebelumnya.
            showFeedback("", "");

        });

    });


    /* =====================================================
       9. MENYIMPAN HASIL VERIFIKASI
    ===================================================== */

    function saveVerification() {

        // Keputusan wajib dipilih sebelum penyimpanan.
        if (
            selectedDecision !== "valid" &&
            selectedDecision !== "invalid"
        ) {

            showFeedback(
                "Silakan pilih keputusan verifikasi terlebih dahulu.",
                "error"
            );

            return;

        }

        // Membaca seluruh data yang sudah tersimpan.
        const allData = getVerificationData();

        if (allData === null) {

            showFeedback(
                "Gagal membaca penyimpanan. Data tidak diubah.",
                "error"
            );

            return;

        }

        // Mengambil catatan verifikator.
        // Catatan boleh kosong karena sifatnya opsional.
        const notes = verifierNotes.value.trim();

        // Mengambil informasi tambahan dari halaman.
        const reporterName =
            document.getElementById("reportName")
                ?.textContent.trim() || "";

        const facilityName =
            document.getElementById("reportFacility")
                ?.textContent.trim() || "";

        const facilityLocation =
            document.getElementById("reportLocation")
                ?.textContent.trim() || "";

        const priority =
            document.getElementById("priorityResult")
                ?.textContent.trim() || "";

        const damage =
            document.getElementById("damage")?.value || "";

        const impact =
            document.getElementById("impact")?.value || "";

        // Mengambil waktu penyimpanan.
        const verifiedAt = new Date().toISOString();

        // Membentuk objek hasil verifikasi.
        const verification = {

            reportCode: reportCode,

            reporterName: reporterName,

            facilityName: facilityName,

            facilityLocation: facilityLocation,

            decision: selectedDecision,

            decisionLabel:
                selectedDecision === "valid"
                    ? "Laporan Valid"
                    : "Laporan Tidak Valid",

            notes: notes,

            priority: priority,

            damage: damage,

            impact: impact,

            status: "Selesai Diverifikasi",

            verifiedAt: verifiedAt

        };

        try {

            // Menyimpan data berdasarkan kode laporan.
            allData[reportCode] = verification;

            // Menyimpan objek ke Local Storage.
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(allData)
            );

            // Memastikan data benar-benar tersimpan.
            const savedData = getVerificationData();

            if (
                !savedData ||
                !savedData[reportCode] ||
                savedData[reportCode].decision !== selectedDecision
            ) {

                throw new Error(
                    "Data verifikasi tidak berhasil dikonfirmasi."
                );

            }

            // Memperbarui badge status halaman detail.
            updateReportStatus(selectedDecision);

            // Menampilkan pemberitahuan berhasil.
            showFeedback(
                "Verifikasi laporan " + reportCode +
                " berhasil disimpan!",
                "success"
            );

            // Mengirim pemberitahuan perubahan data.
            window.dispatchEvent(
                new CustomEvent("sipfas:verification-saved", {
                    detail: verification
                })
            );

            // Menampilkan hasil penyimpanan pada Console.
            console.log(
                "Verifikasi berhasil disimpan:",
                verification
            );

        } catch (error) {

            console.error(
                "Gagal menyimpan verifikasi:",
                error
            );

            showFeedback(
                "Penyimpanan gagal. Periksa kapasitas Local Storage browser.",
                "error"
            );

        }

    }


    /* =====================================================
       10. EVENT TOMBOL SIMPAN
    ===================================================== */

    // Menyimpan keputusan ketika tombol ditekan.
    saveButton.addEventListener("click", function (event) {

        // Mencegah form melakukan reload otomatis.
        event.preventDefault();

        saveVerification();

    });


    /* =====================================================
       11. MEMUAT DATA VERIFIKASI SEBELUMNYA
    ===================================================== */

    function loadVerification() {

        const allData = getVerificationData();

        if (allData === null) {

            showFeedback(
                "Data verifikasi sebelumnya tidak dapat dibaca.",
                "error"
            );

            return;

        }

        // Mengambil data berdasarkan kode laporan.
        const savedData = allData[reportCode];

        // Jika belum ada keputusan tersimpan.
        if (
            !savedData ||
            !["valid", "invalid"].includes(savedData.decision)
        ) {

            // Tidak ada keputusan aktif secara otomatis.
            updateDecision("");

            // Mengosongkan catatan verifikator.
            verifierNotes.value = "";

            // Status awal tetap menunggu verifikasi.
            updateReportStatus("");

            // Menghapus pesan sebelumnya.
            showFeedback("", "");

            console.log(
                "Laporan belum diverifikasi:",
                reportCode
            );

            return;

        }

        // Memulihkan keputusan yang benar-benar tersimpan.
        updateDecision(savedData.decision);

        // Memulihkan catatan verifikator.
        verifierNotes.value = savedData.notes || "";

        // Memperbarui status berdasarkan keputusan tersimpan.
        updateReportStatus(savedData.decision);

        // Menampilkan informasi data sebelumnya.
        showFeedback(
            "Data verifikasi sebelumnya berhasil dimuat.",
            "info"
        );

        console.log(
            "Data verifikasi ditemukan:",
            savedData
        );

    }


    /* =====================================================
       12. INISIALISASI HALAMAN
    ===================================================== */

    // Memuat data ketika halaman pertama kali dibuka.
    loadVerification();


    /* =====================================================
       13. SINKRONISASI KETIKA DATA BERUBAH
    ===================================================== */

    // Memperbarui halaman jika data berubah dari tab lain.
    window.addEventListener("storage", function (event) {

        if (event.key === STORAGE_KEY || event.key === null) {

            loadVerification();

        }

    });

    // Menangani perubahan data dari halaman yang sama.
    window.addEventListener(
        "sipfas:verification-saved",
        function (event) {

            if (
                event.detail &&
                event.detail.reportCode === reportCode
            ) {

                updateReportStatus(event.detail.decision);

            }

        }
    );

    // Memastikan status benar ketika kembali ke halaman.
    window.addEventListener("pageshow", function () {

        loadVerification();

    });

});
