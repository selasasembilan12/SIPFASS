
/* =========================================================
   SIPFAS - RIWAYAT PERBAIKAN
   File: Riwayat-Laporan.js

   FUNGSI PROGRAM:
   1. Menampilkan arsip laporan.
   2. Mengambil data dari Local Storage.
   3. Mengintegrasikan data verifikasi.
   4. Mengintegrasikan data penanganan.
   5. Melakukan pencarian laporan.
   6. Melakukan filter status akhir.
   7. Menampilkan detail riwayat.
   8. Memperbarui arsip secara otomatis.
   9. Mempertahankan data contoh HTML.

   STORAGE KEY:
   sipfas_verifikasi_laporan
   sipfas_penanganan_laporan
========================================================= */

(function () {

    "use strict";


    // =====================================================
    // 1. KONFIGURASI PENYIMPANAN
    // =====================================================

    const STORAGE_VERIFIKASI =
        "sipfas_verifikasi_laporan";

    const STORAGE_PENANGANAN =
        "sipfas_penanganan_laporan";


    // =====================================================
    // 2. MENJALANKAN PROGRAM SETELAH HTML DIMUAT
    // =====================================================

    document.addEventListener("DOMContentLoaded", function () {


        // =================================================
        // 3. MENGAMBIL ELEMEN HTML
        // =================================================

        const searchInput =
            document.getElementById("searchHistory");

        const statusFilter =
            document.getElementById("statusHistory");

        const historyRows =
            document.getElementById("historyRows");

        const recordCount =
            document.getElementById("recordCount");

        const historyEmpty =
            document.getElementById("historyEmpty");

        const historyDetail =
            document.getElementById("historyDetail");

        const detailTitle =
            document.getElementById("detailTitle");

        const detailReporter =
            document.getElementById("detailReporter");

        const detailDate =
            document.getElementById("detailDate");

        const detailValidation =
            document.getElementById("detailValidation");

        const detailPriority =
            document.getElementById("detailPriority");

        const detailAction =
            document.getElementById("detailAction");

        const detailNote =
            document.getElementById("detailNote");

        const sidebar =
            document.getElementById("sidebar");

        const menuToggle =
            document.getElementById("menuToggle");

        const pageOverlay =
            document.getElementById("pageOverlay");


        // Memastikan komponen utama tersedia.
        if (
            !searchInput ||
            !statusFilter ||
            !historyRows ||
            !recordCount ||
            !historyEmpty
        ) {

            console.error(
                "[SIPFAS] Elemen utama Riwayat Laporan tidak ditemukan."
            );

            return;
        }


        // =================================================
        // 4. FUNGSI MEMBACA LOCAL STORAGE
        // =================================================

        function readStorage(key) {

            try {

                const raw = localStorage.getItem(key);

                if (!raw) {
                    return {};
                }

                const parsed = JSON.parse(raw);

                if (
                    parsed === null ||
                    typeof parsed !== "object"
                ) {

                    console.warn(
                        "[SIPFAS] Struktur penyimpanan tidak valid:",
                        key
                    );

                    return {};
                }

                return parsed;

            } catch (error) {

                console.error(
                    "[SIPFAS] Gagal membaca:",
                    key,
                    error
                );

                return {};
            }
        }


        // =================================================
        // 5. FUNGSI NORMALISASI TEKS
        // =================================================

        // Menyamakan format teks untuk pencarian dan pencocokan.
        function normalizeText(value) {

            return String(value ?? "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, " ")
                .trim()
                .replace(/\s+/g, " ");
        }


        // Mengambil nilai pertama yang tersedia.
        function firstValue(object, keys, fallback = "") {

            if (!object || typeof object !== "object") {
                return fallback;
            }

            for (const key of keys) {

                const value = object[key];

                if (
                    value !== undefined &&
                    value !== null &&
                    String(value).trim() !== ""
                ) {

                    return value;
                }
            }

            return fallback;
        }


        // =================================================
        // 6. MEMBACA DATA BERDASARKAN KODE LAPORAN
        // =================================================

        // Mendukung penyimpanan berbentuk array maupun objek.
        function convertToRecords(data) {

            if (Array.isArray(data)) {

                return data.map(function (item) {

                    return {
                        code: firstValue(item, [
                            "reportCode",
                            "kodeLaporan",
                            "kode_laporan",
                            "code",
                            "id"
                        ]),
                        data: item
                    };

                }).filter(function (item) {
                    return Boolean(item.code);
                });
            }

            if (
                !data ||
                typeof data !== "object"
            ) {
                return [];
            }

            return Object.entries(data).map(function (entry) {

                const key = entry[0];
                const value = entry[1];

                const code = firstValue(value, [
                    "reportCode",
                    "kodeLaporan",
                    "kode_laporan",
                    "code"
                ], key);

                return {
                    code: code,
                    data: value
                };

            }).filter(function (item) {
                return Boolean(item.code);
            });
        }


        // =================================================
        // 7. MEMBACA DATA AWAL DARI HTML
        // =================================================

        // Data contoh HTML tetap dipertahankan.
        function getInitialRecords() {

            const records = [];

            const rows = historyRows.querySelectorAll("tr");

            rows.forEach(function (row) {

                const cells = row.querySelectorAll("td");

                if (cells.length < 6) {
                    return;
                }

                const code = row.dataset.code;

                if (!code) {
                    return;
                }

                const priorityElement =
                    cells[3].querySelector(".priority-pill");

                const statusElement =
                    cells[4].querySelector(".final-status");

                const button =
                    row.querySelector(".detail-history");

                records.push({

                    code: code,

                    facility: cells[1].innerText.trim(),

                    location: cells[2].innerText.trim(),

                    priority: priorityElement
                        ? priorityElement.innerText.trim()
                        : "-",

                    finalStatus: row.dataset.status,

                    completionDate: cells[5].innerText.trim(),

                    reporter: "-",

                    reportDate: "-",

                    validation: "-",

                    action: "-",

                    note: "-",

                    searchText: row.dataset.search || row.innerText,

                    button: button

                });

            });

            return records;
        }


        // =================================================
        // 8. MENENTUKAN STATUS AKHIR LAPORAN
        // =================================================

        function getFinalStatus(verification, handling) {

            // Membaca status verifikasi.
            const verificationStatus = normalizeText(
                firstValue(verification, [
                    "statusVerifikasi",
                    "verificationStatus",
                    "hasilVerifikasi",
                    "validationStatus",
                    "keputusanVerifikasi",
                    "status"
                ])
            );

            // Membaca status penanganan.
            const handlingStatus = normalizeText(
                firstValue(handling, [
                    "handlingStatus",
                    "status",
                    "statusPenanganan"
                ])
            );

            // Laporan tidak valid masuk arsip penutupan.
            if (
                verificationStatus.includes("tidak valid") ||
                verificationStatus.includes("invalid") ||
                verificationStatus.includes("tidak-valid")
            ) {

                return "tidak-valid";
            }

            // Laporan selesai masuk arsip perbaikan.
            if (
                handlingStatus === "selesai" ||
                handlingStatus === "ditutup" ||
                handlingStatus === "closed" ||
                handlingStatus === "completed"
            ) {

                return "selesai";
            }

            return null;
        }


        // =================================================
        // 9. MEMBACA PRIORITAS C4.5
        // =================================================

        function getPriority(verification) {

            return firstValue(verification, [

                "priority",

                "prioritas",

                "hasilKlasifikasi",

                "klasifikasi",

                "hasilC45",

                "rekomendasi"

            ], "-");
        }


        // =================================================
        // 10. MEMBENTUK DATA ARSIP
        // =================================================

        function buildHistoryRecords() {

            // Mengambil data awal dari tabel HTML.
            const initialRecords = getInitialRecords();

            // Mengambil data dari Local Storage.
            const verificationData = convertToRecords(
                readStorage(STORAGE_VERIFIKASI)
            );

            const handlingData = convertToRecords(
                readStorage(STORAGE_PENANGANAN)
            );

            // Menggabungkan data berdasarkan kode laporan.
            const recordMap = new Map();

            initialRecords.forEach(function (record) {

                recordMap.set(
                    record.code,
                    record
                );

            });

            // Menyimpan data verifikasi berdasarkan kode.
            const verificationMap = new Map();

            verificationData.forEach(function (item) {

                verificationMap.set(
                    String(item.code).trim(),
                    item.data
                );

            });

            // Menyimpan data penanganan berdasarkan kode.
            const handlingMap = new Map();

            handlingData.forEach(function (item) {

                handlingMap.set(
                    String(item.code).trim(),
                    item.data
                );

            });

            // Menggabungkan semua kode laporan.
            const allCodes = new Set([

                ...verificationMap.keys(),

                ...handlingMap.keys(),

                ...recordMap.keys()

            ]);

            allCodes.forEach(function (code) {

                const verification =
                    verificationMap.get(code) || {};

                const handling =
                    handlingMap.get(code) || {};

                // Menentukan status akhir.
                const finalStatus = getFinalStatus(
                    verification,
                    handling
                );

                // Laporan yang belum selesai tidak diarsipkan.
                if (!finalStatus) {

                    // Hapus data contoh yang sudah tidak memenuhi
                    // kriteria arsip apabila statusnya berubah.
                    if (
                        verificationMap.has(code) ||
                        handlingMap.has(code)
                    ) {

                        recordMap.delete(code);
                    }

                    return;
                }

                // Mengambil data yang sudah ada.
                const oldRecord =
                    recordMap.get(code) || {};

                // Mengambil data fasilitas.
                const facility = firstValue(
                    verification,
                    [
                        "facility",
                        "fasilitas",
                        "namaFasilitas",
                        "namaAset",
                        "namaBarang",
                        "namaPeralatan"
                    ],
                    firstValue(
                        handling,
                        [
                            "facility",
                            "fasilitas",
                            "namaFasilitas"
                        ],
                        oldRecord.facility || "-"
                    )
                );

                // Mengambil lokasi fasilitas.
                const location = firstValue(
                    verification,
                    [
                        "location",
                        "lokasi",
                        "lokasiFasilitas"
                    ],
                    firstValue(
                        handling,
                        [
                            "location",
                            "lokasi"
                        ],
                        oldRecord.location || "-"
                    )
                );

                // Mengambil nama pelapor.
                const reporter = firstValue(
                    verification,
                    [
                        "reporter",
                        "pelapor",
                        "namaPelapor",
                        "reporterName"
                    ],
                    oldRecord.reporter || "-"
                );

                // Mengambil tanggal laporan.
                const reportDate = firstValue(
                    verification,
                    [
                        "reportDate",
                        "tanggalLaporan",
                        "createdAt",
                        "tanggalMasuk"
                    ],
                    oldRecord.reportDate || "-"
                );

                // Mengambil hasil validasi.
                const validation = firstValue(
                    verification,
                    [
                        "statusVerifikasi",
                        "verificationStatus",
                        "hasilVerifikasi",
                        "validationStatus",
                        "keputusanVerifikasi"
                    ],
                    oldRecord.validation ||
                    (finalStatus === "tidak-valid"
                        ? "Tidak Valid"
                        : "Valid")
                );

                // Mengambil tindak lanjut teknisi.
                const action = firstValue(
                    handling,
                    [
                        "followUp",
                        "followUpAction",
                        "tindakLanjut",
                        "tindakLanjutPerbaikan"
                    ],
                    oldRecord.action || "-"
                );

                // Mengambil catatan akhir petugas.
                const note = firstValue(
                    handling,
                    [
                        "officerNotes",
                        "catatanPetugas",
                        "catatan",
                        "finalNote"
                    ],
                    oldRecord.note || "-"
                );

                // Mengambil tanggal pembaruan.
                const completionDate = firstValue(
                    handling,
                    [
                        "updatedAtLabel",
                        "updatedAt",
                        "tanggalPembaruan",
                        "completionDate",
                        "tanggalSelesai"
                    ],
                    oldRecord.completionDate || "-"
                );

                // Membentuk objek arsip.
                const record = {

                    code: code,

                    facility: facility,

                    location: location,

                    priority: getPriority(verification) !== "-"
                        ? getPriority(verification)
                        : oldRecord.priority || "-",

                    finalStatus: finalStatus,

                    completionDate: formatDisplayDate(
                        completionDate
                    ),

                    reporter: reporter,

                    reportDate: formatDisplayDate(reportDate),

                    validation: validation,

                    action: action,

                    note: note,

                    searchText: [

                        code,

                        facility,

                        location,

                        reporter,

                        validation,

                        action,

                        note

                    ].join(" ")

                };

                recordMap.set(code, record);

            });

            return Array.from(recordMap.values());
        }


        // =================================================
        // 11. FORMAT TANGGAL
        // =================================================

        function formatDisplayDate(value) {

            if (!value || value === "-") {
                return "-";
            }

            const date = new Date(value);

            // Jika bukan format tanggal yang dikenali,
            // pertahankan teks tanggal aslinya.
            if (Number.isNaN(date.getTime())) {
                return String(value);
            }

            return new Intl.DateTimeFormat("id-ID", {

                timeZone: "Asia/Jayapura",

                day: "2-digit",

                month: "short",

                year: "numeric",

                hour: "2-digit",

                minute: "2-digit",

                hour12: false

            }).format(date) + " WIT";
        }


        // =================================================
        // 12. MEMBUAT ELEMEN TABEL
        // =================================================

        // Membuat elemen teks agar data aman ditampilkan.
        function createCell(text, className) {

            const td = document.createElement("td");

            if (className) {
                td.className = className;
            }

            td.textContent = text || "-";

            return td;
        }


        // Membuat badge prioritas.
        function createPriorityBadge(priority) {

            const badge = document.createElement("span");

            badge.className = "priority-pill";

            const value = normalizeText(priority);

            if (value.includes("tinggi")) {

                badge.classList.add("high");

            } else if (value.includes("rendah")) {

                badge.classList.add("low");

            } else {

                badge.classList.add("medium");
            }

            badge.textContent = priority || "-";

            return badge;
        }


        // Membuat badge status akhir.
        function createStatusBadge(status) {

            const badge = document.createElement("span");

            badge.className = "final-status";

            if (status === "selesai") {

                badge.classList.add("done");

                badge.textContent = "✓ Selesai";

            } else {

                badge.classList.add("invalid");

                badge.textContent = "⊗ Tidak Valid";
            }

            return badge;
        }


        // =================================================
        // 13. MENAMPILKAN TABEL RIWAYAT
        // =================================================

        let allHistoryRecords = [];

        let selectedRecordCode = null;

        function renderHistory(records) {

            // Menghapus baris sebelumnya.
            historyRows.replaceChildren();

            // Membuat baris baru.
            records.forEach(function (record) {

                const row = document.createElement("tr");

                row.dataset.code = record.code;

                row.dataset.status = record.finalStatus;

                row.dataset.search = record.searchText || "";

                // Kolom kode laporan.
                const codeCell = document.createElement("td");

                const codeBadge = document.createElement("span");

                codeBadge.className = "history-code";

                codeBadge.textContent = record.code;

                codeCell.appendChild(codeBadge);

                row.appendChild(codeCell);

                // Kolom fasilitas.
                row.appendChild(
                    createCell(
                        record.facility,
                        "history-facility"
                    )
                );

                // Kolom lokasi.
                row.appendChild(
                    createCell(record.location)
                );

                // Kolom prioritas.
                const priorityCell = document.createElement("td");

                priorityCell.appendChild(
                    createPriorityBadge(record.priority)
                );

                row.appendChild(priorityCell);

                // Kolom status akhir.
                const statusCell = document.createElement("td");

                statusCell.appendChild(
                    createStatusBadge(record.finalStatus)
                );

                row.appendChild(statusCell);

                // Kolom tanggal penyelesaian.
                row.appendChild(
                    createCell(record.completionDate)
                );

                // Kolom tombol detail.
                const actionCell = document.createElement("td");

                const detailButton =
                    document.createElement("button");

                detailButton.type = "button";

                detailButton.className = "detail-history";

                detailButton.dataset.code = record.code;

                detailButton.textContent = "Detail Riwayat";

                const eyeIcon = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "svg"
                );

                eyeIcon.setAttribute("viewBox", "0 0 24 24");

                eyeIcon.setAttribute("aria-hidden", "true");

                const eyePath = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "path"
                );

                eyePath.setAttribute(
                    "d",
                    "M2 12C4.5 7.5 8 5 12 5 C16 5 19.5 7.5 22 12 C19.5 16.5 16 19 12 19 C8 19 4.5 16.5 2 12Z"
                );

                const eyeCircle = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "circle"
                );

                eyeCircle.setAttribute("cx", "12");

                eyeCircle.setAttribute("cy", "12");

                eyeCircle.setAttribute("r", "3");

                eyeIcon.appendChild(eyePath);

                eyeIcon.appendChild(eyeCircle);

                detailButton.appendChild(eyeIcon);

                actionCell.appendChild(detailButton);

                row.appendChild(actionCell);

                // Memasukkan baris ke tabel.
                historyRows.appendChild(row);

                // Mempertahankan status tombol aktif.
                if (record.code === selectedRecordCode) {

                    detailButton.classList.add("active");
                }

            });

            // Memperbarui jumlah hasil.
            recordCount.textContent =
                "Menampilkan " +
                records.length +
                " dari " +
                allHistoryRecords.length +
                " Data Terekam";

            // Menampilkan pesan apabila data kosong.
            historyEmpty.hidden = records.length !== 0;
        }


        // =================================================
        // 14. SISTEM PENCARIAN
        // =================================================

        function searchHistory() {

            const keyword = normalizeText(
                searchInput.value
            );

            const selectedStatus = statusFilter.value;

            const filteredRecords =
                allHistoryRecords.filter(function (record) {

                    // Mencari semua informasi laporan.
                    const searchableText = normalizeText([

                        record.code,

                        record.facility,

                        record.location,

                        record.priority,

                        record.reporter,

                        record.reportDate,

                        record.validation,

                        record.action,

                        record.note

                    ].join(" "));

                    const matchesSearch =
                        !keyword ||
                        searchableText.includes(keyword);

                    // Memeriksa status akhir.
                    const matchesStatus =
                        selectedStatus === "semua" ||
                        record.finalStatus === selectedStatus;

                    return matchesSearch && matchesStatus;

                });

            renderHistory(filteredRecords);

        }


        // =================================================
        // 15. MENAMPILKAN DETAIL RIWAYAT
        // =================================================

        function showHistoryDetail(code) {

            const record = allHistoryRecords.find(
                function (item) {
                    return item.code === code;
                }
            );

            if (!record) {

                console.warn(
                    "[SIPFAS] Data detail tidak ditemukan:",
                    code
                );

                return;
            }

            selectedRecordCode = code;

            // Memperbarui judul detail.
            if (detailTitle) {

                const statusText =
                    record.finalStatus === "selesai"
                        ? "Selesai Diperbaiki"
                        : "Tidak Valid";

                detailTitle.textContent =
                    "Detail Riwayat Terpilih: " +
                    record.code +
                    " — " +
                    statusText;
            }

            // Memperbarui informasi pelapor.
            if (detailReporter) {

                detailReporter.textContent =
                    record.reporter || "-";
            }

            // Memperbarui tanggal laporan.
            if (detailDate) {

                detailDate.textContent =
                    record.reportDate || "-";
            }

            // Memperbarui hasil verifikasi.
            if (detailValidation) {

                detailValidation.textContent =
                    record.validation || "-";

                detailValidation.className =
                    record.finalStatus === "selesai"
                        ? "valid-label"
                        : "invalid-label";
            }

            // Memperbarui prioritas.
            if (detailPriority) {

                detailPriority.textContent =
                    record.priority || "-";

                detailPriority.className =
                    "priority-pill";

                const priority = normalizeText(
                    record.priority
                );

                if (priority.includes("tinggi")) {

                    detailPriority.classList.add("high");

                } else if (priority.includes("rendah")) {

                    detailPriority.classList.add("low");

                } else {

                    detailPriority.classList.add("medium");
                }
            }

            // Memperbarui tindak lanjut teknisi.
            if (detailAction) {

                detailAction.textContent =
                    record.action || "-";
            }

            // Memperbarui catatan akhir petugas.
            if (detailNote) {

                detailNote.textContent =
                    record.note || "-";
            }

            // Memperbarui label status detail.
            if (historyDetail) {

                const stateElement =
                    historyDetail.querySelector(".detail-state");

                if (stateElement) {

                    stateElement.textContent =
                        record.finalStatus === "selesai"
                            ? "Selesai Diperbaiki"
                            : "Tidak Valid";
                }

                const checkElement =
                    historyDetail.querySelector(".detail-check");

                if (checkElement) {

                    checkElement.textContent =
                        record.finalStatus === "selesai"
                            ? "✓"
                            : "⊗";
                }
            }

            // Memperbarui tombol yang aktif.
            historyRows
                .querySelectorAll(".detail-history")
                .forEach(function (button) {

                    button.classList.toggle(
                        "active",
                        button.dataset.code === code
                    );

                });

        }


        // =================================================
        // 16. EVENT PENCARIAN
        // =================================================

        searchInput.addEventListener(
            "input",
            searchHistory
        );


        // =================================================
        // 17. EVENT FILTER STATUS
        // =================================================

        statusFilter.addEventListener(
            "change",
            searchHistory
        );


        // =================================================
        // 18. EVENT TOMBOL DETAIL
        // =================================================

        // Menggunakan event delegation agar tombol tetap
        // berfungsi meskipun tabel dirender ulang.
        historyRows.addEventListener(
            "click",
            function (event) {

                const button = event.target.closest(
                    ".detail-history"
                );

                if (!button) {
                    return;
                }

                const code = button.dataset.code;

                showHistoryDetail(code);

            }
        );


        // =================================================
        // 19. MEMUAT ULANG DATA DARI LOCAL STORAGE
        // =================================================

        function refreshHistory() {

            // Mengambil data terbaru.
            allHistoryRecords = buildHistoryRecords();

            // Mengembalikan pilihan detail jika masih tersedia.
            if (
                selectedRecordCode &&
                !allHistoryRecords.some(function (record) {
                    return record.code === selectedRecordCode;
                })
            ) {

                selectedRecordCode = null;
            }

            // Menjalankan pencarian dan filter kembali.
            searchHistory();

            // Memperbarui detail laporan terpilih.
            if (selectedRecordCode) {

                showHistoryDetail(selectedRecordCode);

            } else if (allHistoryRecords.length > 0) {

                // Menampilkan detail laporan pertama.
                showHistoryDetail(
                    allHistoryRecords[0].code
                );

            }
        }


        // =================================================
        // 20. SINKRONISASI PERUBAHAN LOCAL STORAGE
        // =================================================

        // Menangkap perubahan dari tab browser lain.
        window.addEventListener(
            "storage",
            function (event) {

                if (
                    event.key === STORAGE_VERIFIKASI ||
                    event.key === STORAGE_PENANGANAN
                ) {

                    refreshHistory();
                }
            }
        );


        // Menangkap event dari halaman penanganan.
        window.addEventListener(
            "sipfas:handling-saved",
            function () {

                refreshHistory();
            }
        );


        // =================================================
        // 21. FUNGSI SIDEBAR MOBILE
        // =================================================

        if (menuToggle && sidebar) {

            menuToggle.addEventListener(
                "click",
                function () {

                    sidebar.classList.toggle("active");

                    if (pageOverlay) {

                        pageOverlay.classList.toggle("active");
                    }
                }
            );
        }

        if (pageOverlay && sidebar) {

            pageOverlay.addEventListener(
                "click",
                function () {

                    sidebar.classList.remove("active");

                    pageOverlay.classList.remove("active");
                }
            );
        }


        // =================================================
        // 22. INISIALISASI HALAMAN
        // =================================================

        // Menampilkan data ketika halaman pertama dibuka.
        refreshHistory();

        console.log(
            "[SIPFAS] Riwayat Perbaikan berhasil dijalankan."
        );

        console.log(
            "[SIPFAS] Jumlah arsip:",
            allHistoryRecords.length
        );

    });

})();
