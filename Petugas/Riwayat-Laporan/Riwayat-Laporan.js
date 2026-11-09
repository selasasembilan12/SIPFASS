
/* ============================================================
   SIPFAS - RIWAYAT LAPORAN
   File: Riwayat-Laporan.js

   PERBAIKAN:
   1. Memperbaiki pembacaan nama lengkap pelapor.
   2. Memperbaiki pembacaan NIM.
   3. Memulihkan nama dari data Local Storage lama.
   4. Menggabungkan data berdasarkan kode laporan.
   5. Membaca data hasil verifikasi.
   6. Membaca data hasil penanganan.
   7. Menampilkan prioritas C4.5 terbaru.
   8. Menampilkan keputusan validasi.
   9. Menampilkan tindak lanjut teknisi.
   10. Menampilkan catatan akhir petugas.
   11. Mempertahankan seluruh arsip HTML.
   12. Mengaktifkan pencarian dan filter.
   13. Memperbaiki tombol Detail Riwayat.
   14. Sinkronisasi perubahan Local Storage.
   15. Mempertahankan navigasi sidebar.

   STORAGE:
   sipfas_verifikasi_laporan
   sipfas_penanganan_laporan
   sipfas_selected_report
============================================================ */

(() => {
    "use strict";

    /* ========================================================
       1. KONFIGURASI PENYIMPANAN
    ======================================================== */

    const VERIFICATION_KEY = "sipfas_verifikasi_laporan";
    const HANDLING_KEY = "sipfas_penanganan_laporan";
    const SELECTED_KEY = "sipfas_selected_report";

    /* ========================================================
       2. INISIALISASI HALAMAN
    ======================================================== */

    document.addEventListener("DOMContentLoaded", initialize);

    function initialize() {

        /* Mengambil elemen HTML berdasarkan ID. */
        const $ = id => document.getElementById(id);

        /* Mengambil elemen pencarian dan filter. */
        const searchInput = $("searchHistory");
        const statusFilter = $("statusHistory");

        /* Mengambil elemen tabel arsip. */
        const historyRows = $("historyRows");
        const recordCount = $("recordCount");
        const historyEmpty = $("historyEmpty");

        /* Mengambil elemen panel detail. */
        const historyDetail = $("historyDetail");
        const detailTitle = $("detailTitle");
        const detailReporter = $("detailReporter");
        const detailDate = $("detailDate");
        const detailValidation = $("detailValidation");
        const detailPriority = $("detailPriority");
        const detailAction = $("detailAction");
        const detailNote = $("detailNote");

        /* Mengambil elemen navigasi. */
        const sidebar = $("sidebar");
        const menuToggle = $("menuToggle");
        const pageOverlay = $("pageOverlay");
        const logoutLink = $("logoutLink");

        /* Memastikan elemen utama tersedia. */
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

        /* ====================================================
           3. STATE PROGRAM
        ==================================================== */

        /* Menyimpan kode laporan yang sedang dipilih. */
        let selectedRecordCode = null;

        /* Menyimpan seluruh data arsip. */
        let allHistoryRecords = [];

        /* Mengambil data awal HTML hanya satu kali. */
        const initialRecords = getInitialRecords();

        /* ====================================================
           4. NORMALISASI TEKS
        ==================================================== */

        function normalizeText(value) {

            /* Mengubah nilai menjadi teks dan membersihkan spasi. */
            return String(value ?? "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();
        }

        function normalizeCode(value) {

            /* Menyeragamkan kode laporan. */
            return String(value ?? "")
                .replace(/\s+/g, "")
                .trim()
                .toUpperCase();
        }

        /* ====================================================
           5. MENGAMBIL FIELD PERTAMA YANG TERSEDIA
        ==================================================== */

        function firstValue(object, keys, fallback = "") {

            /* Memastikan sumber data berbentuk objek. */
            if (!object || typeof object !== "object") {
                return fallback;
            }

            /* Memeriksa seluruh kemungkinan nama properti. */
            for (const key of keys) {

                const value = object[key];

                /* Mengembalikan nilai pertama yang tidak kosong. */
                if (
                    value !== undefined &&
                    value !== null &&
                    String(value).trim() !== ""
                ) {
                    return value;
                }
            }

            /* Mengembalikan nilai cadangan jika tidak ditemukan. */
            return fallback;
        }

        /* ====================================================
           6. MEMERIKSA NILAI KOSONG
        ==================================================== */

        function isEmpty(value) {

            /* Memeriksa nilai yang tidak tersedia. */
            return (
                value === undefined ||
                value === null ||
                String(value).trim() === "" ||
                String(value).trim() === "-"
            );
        }

        /* ====================================================
           7. MEMBACA LOCAL STORAGE
        ==================================================== */

        function readStorage(key) {

            try {

                /* Mengambil data mentah dari Local Storage. */
                const raw = localStorage.getItem(key);

                /* Mengembalikan objek kosong jika belum tersedia. */
                if (!raw) {
                    return {};
                }

                /* Mengubah JSON menjadi objek JavaScript. */
                const data = JSON.parse(raw);

                /* Memastikan data memiliki struktur yang benar. */
                if (!data || typeof data !== "object") {
                    return {};
                }

                return data;

            } catch (error) {

                /* Mencatat kesalahan tanpa menghapus data. */
                console.error(
                    "[SIPFAS] Gagal membaca Local Storage:",
                    key,
                    error
                );

                return {};
            }
        }

        /* ====================================================
           8. MEMBACA DATA LAPORAN TERPILIH
        ==================================================== */

        function getSelectedReport() {

            /* Membaca laporan yang terakhir dipilih. */
            return readStorage(SELECTED_KEY);
        }

        /* ====================================================
           9. MENGUBAH DATA MENJADI FORMAT SERAGAM
        ==================================================== */

        function convertToRecords(data) {

            /* Menyiapkan tempat penyimpanan hasil konversi. */
            const records = [];

            /* Memproses data jika berbentuk array. */
            if (Array.isArray(data)) {

                data.forEach(item => {

                    /* Mengabaikan data yang bukan objek. */
                    if (!item || typeof item !== "object") {
                        return;
                    }

                    /* Mengambil kode unik laporan. */
                    const code = normalizeCode(
                        firstValue(item, [
                            "reportCode",
                            "kodeLaporan",
                            "kode_laporan",
                            "code",
                            "id"
                        ], "")
                    );

                    /* Menambahkan laporan jika kode tersedia. */
                    if (code) {
                        records.push({
                            code,
                            data: item
                        });
                    }
                });

                return records;
            }

            /* Memproses data jika berbentuk objek. */
            if (!data || typeof data !== "object") {
                return records;
            }

            /* Mengambil setiap pasangan kode dan data. */
            Object.entries(data).forEach(([key, value]) => {

                /* Mengabaikan nilai yang tidak berbentuk objek. */
                if (!value || typeof value !== "object") {
                    return;
                }

                /* Mengambil kode dari properti atau key objek. */
                const code = normalizeCode(
                    firstValue(value, [
                        "reportCode",
                        "kodeLaporan",
                        "kode_laporan",
                        "code",
                        "id"
                    ], key)
                );

                /* Memasukkan data laporan ke daftar. */
                if (code) {
                    records.push({
                        code,
                        data: value
                    });
                }
            });

            return records;
        }

        /* ====================================================
           10. MEMBACA DATA AWAL HTML
        ==================================================== */

        function getInitialRecords() {

            /* Menyiapkan daftar arsip awal. */
            const records = [];

            /* Membaca baris tabel sebelum proses render. */
            historyRows.querySelectorAll("tr").forEach(row => {

                /* Mengambil seluruh kolom tabel. */
                const cells = Array.from(
                    row.querySelectorAll("td")
                );

                /* Mengabaikan baris yang tidak lengkap. */
                if (cells.length < 6) {
                    return;
                }

                /* Mengambil kode laporan. */
                const code = normalizeCode(
                    row.dataset.code ||
                    cells[0].textContent.match(
                        /LPR[-\s]?\d{4}[-\s]?\d+/i
                    )?.[0]
                );

                /* Mengabaikan laporan tanpa kode. */
                if (!code) {
                    return;
                }

                /* Mengambil prioritas awal. */
                const priority = cells[3]
                    .querySelector(".priority-pill")
                    ?.textContent.trim() || "-";

                /* Mengambil status akhir awal. */
                const statusText = normalizeText(
                    cells[4].textContent
                );

                /* Menentukan status arsip awal. */
                const finalStatus =
                    statusText.includes("tidak valid")
                        ? "tidak-valid"
                        : "selesai";

                /* Menyimpan data awal laporan. */
                records.push({

                    code,

                    facility: cells[1].innerText.trim(),

                    location: cells[2].innerText.trim(),

                    priority,

                    finalStatus,

                    completionDate: cells[5].innerText.trim(),

                    reporter: "-",

                    reporterNim: "",

                    reportDate: "-",

                    validation: "-",

                    action: "-",

                    note: ""

                });
            });

            return records;
        }

        /* ====================================================
           11. MEMISAHKAN NAMA PELAPOR DAN NIM
        ==================================================== */

        function parseReporter(rawValue) {

            /* Mengubah sumber identitas menjadi teks. */
            const raw = String(rawValue ?? "")
                .replace(/\r/g, "")
                .trim();

            /* Mengembalikan nilai kosong jika tidak tersedia. */
            if (!raw) {
                return {
                    name: "",
                    nim: ""
                };
            }

            /* Memisahkan identitas berdasarkan baris. */
            const lines = raw
                .split(/\n+/)
                .map(line => line.trim())
                .filter(Boolean);

            /* Menyiapkan variabel nama dan NIM. */
            let nameParts = [];
            let nim = "";

            /* Memeriksa setiap baris identitas. */
            lines.forEach(line => {

                /* Mengabaikan keterangan program studi. */
                if (/program\s+studi/i.test(line)) {
                    return;
                }

                /* Mencari nomor NIM dengan atau tanpa label. */
                const nimMatch = line.match(
                    /(?:NIM\s*[:.-]?\s*)?(\d{6,20})/i
                );

                /* Mengambil NIM jika ditemukan. */
                if (nimMatch) {

                    nim = nimMatch[1];

                    /* Menghapus nomor NIM dari teks nama. */
                    const remaining = line
                        .replace(nimMatch[0], "")
                        .replace(/NIM\s*[:.-]?/i, "")
                        .trim();

                    /* Mempertahankan teks nama yang tersisa. */
                    if (remaining) {
                        nameParts.push(remaining);
                    }

                    return;
                }

                /* Menghapus awalan label identitas. */
                const cleanLine = line
                    .replace(/^(nama\s*[:.-]?\s*)/i, "")
                    .replace(/^(pelapor\s*[:.-]?\s*)/i, "")
                    .trim();

                /* Menambahkan baris nama. */
                if (cleanLine) {
                    nameParts.push(cleanLine);
                }
            });

            /* Menggabungkan seluruh bagian nama. */
            const name = nameParts
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

            /* Mengembalikan nama lengkap dan NIM. */
            return {
                name,
                nim
            };
        }

        /* ====================================================
           12. MENGAMBIL IDENTITAS PELAPOR SECARA LENGKAP
        ==================================================== */

        function getReporterInformation(
            verification,
            handling,
            selected,
            initial
        ) {

            /* Mengambil sumber identitas mentah. */
            const rawReporter = firstValue(
                verification,
                [
                    "reporter",
                    "pelapor",
                    "namaPelapor"
                ],
                firstValue(
                    handling,
                    [
                        "reporter",
                        "pelapor",
                        "namaPelapor"
                    ],
                    selected.reporter || ""
                )
            );

            /* Memisahkan nama dan NIM dari teks mentah. */
            const parsed = parseReporter(rawReporter);

            /* Mengambil nama yang tersimpan secara eksplisit. */
            const explicitName = firstValue(
                verification,
                [
                    "reporterName",
                    "namaPelapor",
                    "nama",
                    "reporter_name"
                ],
                firstValue(
                    handling,
                    [
                        "reporterName",
                        "namaPelapor"
                    ],
                    selected.reporterName || initial.reporter || ""
                )
            );

            /* Mengambil NIM yang tersimpan. */
            const explicitNim = firstValue(
                verification,
                [
                    "reporterNim",
                    "nim",
                    "nomorInduk"
                ],
                firstValue(
                    handling,
                    [
                        "reporterNim",
                        "nim"
                    ],
                    selected.reporterNim || initial.reporterNim || ""
                )
            );

            /* Memeriksa apakah field NIM ternyata berisi nama. */
            const nimContainsName =
                !isEmpty(explicitNim) &&
                !/^\d{6,20}$/.test(
                    String(explicitNim).replace(/\D/g, "")
                );

            /* Menyusun nama dari field eksplisit. */
            let name = String(explicitName || "").trim();

            /* Memulihkan bagian nama yang dahulu salah masuk ke field NIM. */
            if (nimContainsName) {

                name = [
                    name,
                    String(explicitNim).trim()
                ].filter(Boolean).join(" ");

            }

            /* Nama lengkap dari teks mentah lebih diutamakan. */
            if (
                parsed.name &&
                parsed.name.split(/\s+/).length >
                name.split(/\s+/).length
            ) {
                name = parsed.name;
            }

            /* Mengambil NIM yang benar-benar berupa angka. */
            let nim = parsed.nim ||
                (
                    /^\d{6,20}$/.test(
                        String(explicitNim).replace(/\D/g, "")
                    )
                        ? String(explicitNim).replace(/\D/g, "")
                        : ""
                );

            /* Menghapus pengulangan spasi pada nama. */
            name = name.replace(/\s+/g, " ").trim();

            /* Mengembalikan identitas yang telah diperbaiki. */
            return {
                name: name || "-",
                nim
            };
        }

        /* ====================================================
           13. MEMBACA KEPUTUSAN VERIFIKASI
        ==================================================== */

        function getDecision(data) {

            /* Mengambil keputusan dari data verifikasi. */
            const decision = normalizeText(
                firstValue(data, [
                    "decision",
                    "keputusan",
                    "decisionLabel",
                    "hasilVerifikasi",
                    "statusVerifikasi",
                    "verificationStatus",
                    "validationStatus"
                ], "")
            );

            /* Mengidentifikasi keputusan tidak valid. */
            if (
                decision.includes("invalid") ||
                decision.includes("tidak valid") ||
                decision.includes("ditolak")
            ) {
                return "Tidak Valid";
            }

            /* Mengidentifikasi keputusan valid. */
            if (
                decision === "valid" ||
                decision === "laporan valid" ||
                decision === "diterima"
            ) {
                return "Valid";
            }

            return "-";
        }

        /* ====================================================
           14. MEMBACA PRIORITAS C4.5
        ==================================================== */

        function getPriority(verification, handling, initial) {

            /* Mengambil prioritas terbaru dari verifikasi. */
            const verificationPriority = firstValue(
                verification,
                [
                    "priorityLabel",
                    "priority",
                    "prioritas",
                    "hasilKlasifikasi",
                    "hasilC45",
                    "klasifikasi",
                    "rekomendasi"
                ],
                ""
            );

            /* Mengambil prioritas dari penanganan jika tersedia. */
            const handlingPriority = firstValue(
                handling,
                [
                    "priorityLabel",
                    "priority",
                    "prioritas"
                ],
                ""
            );

            /* Menggunakan prioritas verifikasi terlebih dahulu. */
            if (!isEmpty(verificationPriority)) {
                return verificationPriority;
            }

            /* Menggunakan prioritas penanganan sebagai cadangan. */
            if (!isEmpty(handlingPriority)) {
                return handlingPriority;
            }

            /* Mempertahankan prioritas awal HTML. */
            return initial.priority || "-";
        }

        /* ====================================================
           15. MEMBACA STATUS PENANGANAN
        ==================================================== */

        function getHandlingStatus(data) {

            /* Mengambil status penanganan. */
            return normalizeText(
                firstValue(data, [
                    "status",
                    "handlingStatus",
                    "statusPenanganan",
                    "statusLabel"
                ], "")
            );
        }

        /* ====================================================
           16. MENENTUKAN STATUS AKHIR
        ==================================================== */

        function getFinalStatus(
            verification,
            handling,
            initial
        ) {

            /* Mengambil keputusan verifikasi. */
            const decision = getDecision(verification);

            /* Mengambil status penanganan. */
            const handlingStatus = getHandlingStatus(handling);

            /* Laporan tidak valid tetap berstatus tidak valid. */
            if (decision === "Tidak Valid") {
                return "tidak-valid";
            }

            /* Penanganan selesai menjadi arsip selesai. */
            if (
                handlingStatus === "selesai" ||
                handlingStatus === "ditutup" ||
                handlingStatus === "completed" ||
                handlingStatus === "closed"
            ) {
                return "selesai";
            }

            /* Mempertahankan status arsip HTML lama. */
            if (initial.code) {
                return initial.finalStatus;
            }

            /* Laporan baru yang belum selesai tidak masuk arsip. */
            return null;
        }

        /* ====================================================
           17. FORMAT TANGGAL
        ==================================================== */

        function formatDate(value) {

            /* Mempertahankan teks kosong sebagai tanda strip. */
            if (isEmpty(value)) {
                return "-";
            }

            /* Mengubah nilai menjadi teks. */
            const text = String(value).trim();

            /* Membuat objek tanggal. */
            const date = new Date(text);

            /* Mempertahankan format asli jika tanggal tidak valid. */
            if (Number.isNaN(date.getTime())) {
                return text;
            }

            /* Mengubah tanggal menjadi format Indonesia WIT. */
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
           18. MEMBANGUN SELURUH DATA RIWAYAT
        ==================================================== */

        function buildHistoryRecords() {

            /* Membaca seluruh hasil verifikasi. */
            const verificationData = convertToRecords(
                readStorage(VERIFICATION_KEY)
            );

            /* Membaca seluruh hasil penanganan. */
            const handlingData = convertToRecords(
                readStorage(HANDLING_KEY)
            );

            /* Membaca laporan yang terakhir dipilih. */
            const selected = getSelectedReport();

            /* Membuat peta data verifikasi berdasarkan kode. */
            const verificationMap = new Map(
                verificationData.map(item => [
                    item.code,
                    item.data
                ])
            );

            /* Membuat peta data penanganan berdasarkan kode. */
            const handlingMap = new Map(
                handlingData.map(item => [
                    item.code,
                    item.data
                ])
            );

            /* Menggabungkan semua kode laporan. */
            const allCodes = new Set([
                ...initialRecords.map(item => item.code),
                ...verificationMap.keys(),
                ...handlingMap.keys()
            ]);

            /* Menyiapkan daftar hasil akhir. */
            const records = [];

            /* Mengolah setiap laporan secara independen. */
            allCodes.forEach(code => {

                /* Mengambil data awal berdasarkan kode. */
                const initial = initialRecords.find(
                    item => item.code === code
                ) || {};

                /* Mengambil data verifikasi berdasarkan kode. */
                const verification =
                    verificationMap.get(code) || {};

                /* Mengambil data penanganan berdasarkan kode. */
                const handling =
                    handlingMap.get(code) || {};

                /* Menggunakan laporan terpilih hanya jika kodenya sama. */
                const selectedForThisReport =
                    normalizeCode(
                        selected.id || selected.reportCode
                    ) === code
                        ? selected
                        : {};

                /* Menentukan status akhir laporan. */
                const finalStatus = getFinalStatus(
                    verification,
                    handling,
                    initial
                );

                /* Mengabaikan laporan yang belum masuk arsip. */
                if (!finalStatus) {
                    return;
                }

                /* Mengambil identitas pelapor secara lengkap. */
                const reporter = getReporterInformation(
                    verification,
                    handling,
                    selectedForThisReport,
                    initial
                );

                /* Mengambil nama fasilitas. */
                const facility = firstValue(
                    verification,
                    [
                        "facilityName",
                        "facility",
                        "fasilitas",
                        "namaFasilitas"
                    ],
                    firstValue(
                        handling,
                        [
                            "facilityName",
                            "facility",
                            "fasilitas"
                        ],
                        selectedForThisReport.facility ||
                        initial.facility ||
                        "-"
                    )
                );

                /* Mengambil lokasi fasilitas. */
                const location = firstValue(
                    verification,
                    [
                        "facilityLocation",
                        "location",
                        "lokasi",
                        "lokasiFasilitas"
                    ],
                    firstValue(
                        handling,
                        [
                            "facilityLocation",
                            "location",
                            "lokasi"
                        ],
                        selectedForThisReport.location ||
                        initial.location ||
                        "-"
                    )
                );

                /* Mengambil tanggal masuk laporan. */
                const reportDate = firstValue(
                    verification,
                    [
                        "reportTime",
                        "reportDate",
                        "tanggalLaporan",
                        "tanggalMasuk",
                        "createdAt",
                        "date"
                    ],
                    firstValue(
                        handling,
                        [
                            "reportTime",
                            "reportDate",
                            "tanggalLaporan"
                        ],
                        selectedForThisReport.date ||
                        initial.reportDate ||
                        "-"
                    )
                );

                /* Mengambil hasil verifikasi. */
                const validation = getDecision(verification);

                /* Mengambil prioritas C4.5. */
                const priority = getPriority(
                    verification,
                    handling,
                    initial
                );

                /* Mengambil tindak lanjut teknisi. */
                const action = firstValue(
                    handling,
                    [
                        "followUp",
                        "followUpAction",
                        "tindakLanjut",
                        "tindakLanjutPerbaikan",
                        "action"
                    ],
                    "-"
                );

                /* Mengambil catatan akhir petugas. */
                const note = firstValue(
                    handling,
                    [
                        "officerNotes",
                        "catatanPetugas",
                        "finalNote",
                        "completionNotes",
                        "notes"
                    ],
                    "-"
                );

                /* Mengambil tanggal penyelesaian. */
                const completionDate = firstValue(
                    handling,
                    [
                        "updatedAtLabel",
                        "updatedAt",
                        "completionDate",
                        "tanggalPenyelesaian",
                        "tanggalSelesai"
                    ],
                    initial.completionDate || "-"
                );

                /* Memasukkan seluruh informasi ke objek laporan. */
                records.push({

                    code,

                    reporter: reporter.name,

                    reporterNim: reporter.nim,

                    facility,

                    location,

                    reportDate: formatDate(reportDate),

                    validation,

                    priority,

                    action,

                    note,

                    finalStatus,

                    completionDate: formatDate(completionDate)

                });
            });

            /* Mengembalikan seluruh arsip yang telah digabungkan. */
            return records;
        }

        /* ====================================================
           19. MEMBUAT BADGE PRIORITAS
        ==================================================== */

        function createPriorityBadge(priority) {

            /* Membuat elemen badge. */
            const badge = document.createElement("span");

            /* Menetapkan class dasar. */
            badge.className = "priority-pill";

            /* Menormalkan nilai prioritas. */
            const value = normalizeText(priority);

            /* Memberikan warna berdasarkan tingkat prioritas. */
            if (value.includes("tinggi")) {

                badge.classList.add("high");

            } else if (value.includes("rendah")) {

                badge.classList.add("low");

            } else {

                badge.classList.add("medium");
            }

            /* Menampilkan label prioritas. */
            badge.textContent = isEmpty(priority) ? "-" : priority;

            return badge;
        }

        /* ====================================================
           20. MEMBUAT BADGE STATUS
        ==================================================== */

        function createStatusBadge(status) {

            /* Membuat elemen status. */
            const badge = document.createElement("span");

            /* Menetapkan class dasar. */
            badge.className = "final-status";

            /* Menentukan tampilan status. */
            if (status === "selesai") {

                badge.classList.add("done");

                badge.textContent = "✓ Selesai";

            } else {

                badge.classList.add("invalid");

                badge.textContent = "⊗ Tidak Valid";
            }

            return badge;
        }

        /* ====================================================
           21. MERENDER TABEL ARSIP
        ==================================================== */

        function renderHistory(records) {

            /* Mengosongkan tabel hasil render sebelumnya. */
            historyRows.replaceChildren();

            /* Membuat baris untuk setiap laporan. */
            records.forEach(record => {

                /* Membuat elemen baris. */
                const row = document.createElement("tr");

                /* Menyimpan identitas laporan pada baris. */
                row.dataset.code = record.code;

                row.dataset.status = record.finalStatus;

                /* Membuat kolom kode laporan. */
                const codeCell = document.createElement("td");

                const codeLabel = document.createElement("span");

                codeLabel.className = "history-code";

                codeLabel.textContent = record.code;

                codeCell.appendChild(codeLabel);

                row.appendChild(codeCell);

                /* Membuat kolom fasilitas. */
                const facilityCell = document.createElement("td");

                facilityCell.className = "history-facility";

                facilityCell.textContent = record.facility;

                row.appendChild(facilityCell);

                /* Membuat kolom lokasi. */
                const locationCell = document.createElement("td");

                locationCell.textContent = record.location;

                row.appendChild(locationCell);

                /* Membuat kolom prioritas. */
                const priorityCell = document.createElement("td");

                priorityCell.appendChild(
                    createPriorityBadge(record.priority)
                );

                row.appendChild(priorityCell);

                /* Membuat kolom status akhir. */
                const statusCell = document.createElement("td");

                statusCell.appendChild(
                    createStatusBadge(record.finalStatus)
                );

                row.appendChild(statusCell);

                /* Membuat kolom tanggal penyelesaian. */
                const dateCell = document.createElement("td");

                dateCell.textContent = record.completionDate;

                row.appendChild(dateCell);

                /* Membuat kolom aksi. */
                const actionCell = document.createElement("td");

                const button = document.createElement("button");

                button.type = "button";

                button.className = "detail-history";

                button.dataset.code = record.code;

                button.textContent = "Detail Riwayat";

                actionCell.appendChild(button);

                row.appendChild(actionCell);

                /* Memasukkan baris ke tabel. */
                historyRows.appendChild(row);
            });

            /* Memperbarui jumlah data arsip. */
            recordCount.textContent =
                `Menampilkan ${records.length} dari ${allHistoryRecords.length} Data Terekam`;

            /* Menampilkan pesan jika tidak ada data. */
            historyEmpty.hidden = records.length > 0;
        }

        /* ====================================================
           22. MENAMPILKAN DETAIL RIWAYAT
        ==================================================== */

        function showHistoryDetail(code) {

            /* Menyeragamkan kode laporan. */
            const normalizedCode = normalizeCode(code);

            /* Mencari laporan berdasarkan kode unik. */
            const record = allHistoryRecords.find(
                item => item.code === normalizedCode
            );

            /* Menghentikan proses jika laporan tidak ditemukan. */
            if (!record) {

                console.warn(
                    "[SIPFAS] Detail laporan tidak ditemukan:",
                    normalizedCode
                );

                return;
            }

            /* Menyimpan kode laporan aktif. */
            selectedRecordCode = normalizedCode;

            /* Menentukan judul berdasarkan status akhir. */
            const statusText =
                record.finalStatus === "selesai"
                    ? "Selesai Diperbaiki"
                    : "Tidak Valid";

            /* Memperbarui judul panel detail. */
            if (detailTitle) {
                detailTitle.textContent =
                    `Detail Riwayat Terpilih: ${record.code} — ${statusText}`;
            }

            /* Menampilkan nama lengkap pelapor. */
            if (detailReporter) {
                detailReporter.textContent = record.reporter;
            }

            /* Menampilkan tanggal masuk laporan. */
            if (detailDate) {
                detailDate.textContent = record.reportDate;
            }

            /* Menampilkan hasil verifikasi. */
            if (detailValidation) {

                detailValidation.textContent = record.validation;

                detailValidation.classList.remove(
                    "valid-label",
                    "invalid-label"
                );

                if (record.validation === "Tidak Valid") {

                    detailValidation.classList.add("invalid-label");

                } else {

                    detailValidation.classList.add("valid-label");
                }
            }

            /* Menampilkan prioritas C4.5. */
            if (detailPriority) {

                detailPriority.textContent = record.priority;

                detailPriority.classList.remove(
                    "high",
                    "medium",
                    "low"
                );

                const priority = normalizeText(record.priority);

                if (priority.includes("tinggi")) {

                    detailPriority.classList.add("high");

                } else if (priority.includes("rendah")) {

                    detailPriority.classList.add("low");

                } else {

                    detailPriority.classList.add("medium");
                }
            }

            /* Menampilkan tindak lanjut teknisi. */
            if (detailAction) {
                detailAction.textContent = record.action;
            }

            /* Menampilkan catatan akhir petugas. */
            if (detailNote) {
                detailNote.textContent = record.note;
            }

            /* Memperbarui badge status panel. */
            const detailState = historyDetail?.querySelector(
                ".detail-state"
            );

            if (detailState) {
                detailState.textContent = statusText;
            }

            /* Memperbarui ikon status panel. */
            const detailCheck = historyDetail?.querySelector(
                ".detail-check"
            );

            if (detailCheck) {
                detailCheck.textContent =
                    record.finalStatus === "selesai" ? "✓" : "⊗";
            }

            /* Memastikan panel detail terlihat. */
            if (historyDetail) {
                historyDetail.hidden = false;
            }

            /* Memperbarui tombol yang sedang aktif. */
            historyRows
                .querySelectorAll(".detail-history")
                .forEach(button => {

                    button.classList.toggle(
                        "active",
                        normalizeCode(button.dataset.code) === normalizedCode
                    );
                });

            /* Menampilkan data detail pada Console untuk pemeriksaan. */
            console.log(
                "[SIPFAS] Detail laporan aktif:",
                record
            );
        }

        /* ====================================================
           23. PENCARIAN DAN FILTER
        ==================================================== */

        function searchHistory() {

            /* Mengambil kata kunci pencarian. */
            const keyword = normalizeText(searchInput.value);

            /* Mengambil filter status. */
            const selectedStatus = normalizeText(
                statusFilter.value
            );

            /* Menyaring seluruh data laporan. */
            const filteredRecords = allHistoryRecords.filter(
                record => {

                    /* Menggabungkan seluruh informasi untuk pencarian. */
                    const searchable = normalizeText([
                        record.code,
                        record.reporter,
                        record.reporterNim,
                        record.facility,
                        record.location,
                        record.priority,
                        record.validation,
                        record.action,
                        record.note
                    ].join(" "));

                    /* Memeriksa kecocokan kata kunci. */
                    const matchesSearch =
                        !keyword || searchable.includes(keyword);

                    /* Memeriksa kecocokan status. */
                    const matchesStatus =
                        selectedStatus === "semua" ||
                        selectedStatus === "" ||
                        record.finalStatus === selectedStatus;

                    /* Mengembalikan hasil kedua filter. */
                    return matchesSearch && matchesStatus;
                }
            );

            /* Menampilkan hasil penyaringan. */
            renderHistory(filteredRecords);
        }

        /* ====================================================
           24. MEMPERBARUI SELURUH DATA
        ==================================================== */

        function refreshHistory() {

            /* Mengambil ulang data dari seluruh sumber. */
            allHistoryRecords = buildHistoryRecords();

            /* Memperbarui tabel berdasarkan filter aktif. */
            searchHistory();

            /* Mempertahankan detail yang sedang dipilih. */
            const selectedExists = allHistoryRecords.some(
                record => record.code === selectedRecordCode
            );

            if (selectedExists) {

                showHistoryDetail(selectedRecordCode);

            } else if (allHistoryRecords.length > 0) {

                showHistoryDetail(allHistoryRecords[0].code);

            } else {

                selectedRecordCode = null;

                if (historyDetail) {
                    historyDetail.hidden = true;
                }
            }

            /* Menampilkan ringkasan data pada Console. */
            console.log(
                "[SIPFAS] Data arsip diperbarui:",
                allHistoryRecords
            );
        }

        /* ====================================================
           25. EVENT TOMBOL DETAIL RIWAYAT
        ==================================================== */

        historyRows.addEventListener("click", event => {

            /* Mencari tombol detail yang diklik. */
            const button = event.target.closest(".detail-history");

            /* Menghentikan proses jika bukan tombol detail. */
            if (!button || !historyRows.contains(button)) {
                return;
            }

            /* Mencegah perilaku default tombol. */
            event.preventDefault();

            /* Membuka detail berdasarkan kode laporan. */
            showHistoryDetail(button.dataset.code);
        });

        /* ====================================================
           26. EVENT PENCARIAN
        ==================================================== */

        searchInput.addEventListener(
            "input",
            searchHistory
        );

        /* ====================================================
           27. EVENT FILTER STATUS
        ==================================================== */

        statusFilter.addEventListener(
            "change",
            searchHistory
        );

        /* ====================================================
           28. SINKRONISASI LOCAL STORAGE
        ==================================================== */

        window.addEventListener("storage", event => {

            /* Memperbarui data jika penyimpanan berubah. */
            if (
                event.key === VERIFICATION_KEY ||
                event.key === HANDLING_KEY ||
                event.key === SELECTED_KEY ||
                event.key === null
            ) {
                refreshHistory();
            }
        });

        /* ====================================================
           29. SINKRONISASI HASIL VERIFIKASI
        ==================================================== */

        window.addEventListener(
            "sipfas:verification-saved",
            refreshHistory
        );

        /* ====================================================
           30. SINKRONISASI HASIL PENANGANAN
        ==================================================== */

        window.addEventListener(
            "sipfas:handling-saved",
            refreshHistory
        );

        /* ====================================================
           31. SINKRONISASI SAAT HALAMAN AKTIF
        ==================================================== */

        window.addEventListener(
            "pageshow",
            refreshHistory
        );

        document.addEventListener(
            "visibilitychange",
            () => {

                /* Memperbarui data ketika pengguna kembali. */
                if (!document.hidden) {
                    refreshHistory();
                }
            }
        );

        /* ====================================================
           32. SIDEBAR RESPONSIF
        ==================================================== */

        function setSidebar(open) {

            /* Mengubah kondisi sidebar. */
            sidebar?.classList.toggle("open", open);

            sidebar?.classList.toggle("active", open);

            /* Mengubah kondisi overlay. */
            pageOverlay?.classList.toggle("show", open);

            pageOverlay?.classList.toggle("active", open);

            /* Memperbarui aksesibilitas tombol menu. */
            menuToggle?.setAttribute(
                "aria-expanded",
                String(open)
            );
        }

        /* Mengaktifkan tombol buka/tutup sidebar. */
        menuToggle?.addEventListener("click", () => {

            const isOpen =
                sidebar?.classList.contains("open") ||
                sidebar?.classList.contains("active");

            setSidebar(!isOpen);
        });

        /* Menutup sidebar melalui overlay. */
        pageOverlay?.addEventListener("click", () => {
            setSidebar(false);
        });

        /* Menutup sidebar setelah navigasi dipilih. */
        document.querySelectorAll(".nav-link").forEach(link => {

            link.addEventListener("click", () => {
                setSidebar(false);
            });
        });

        /* Menutup sidebar menggunakan tombol Escape. */
        document.addEventListener("keydown", event => {

            if (event.key === "Escape") {
                setSidebar(false);
            }
        });

        /* ====================================================
           33. TOMBOL KELUAR
        ==================================================== */

        logoutLink?.addEventListener("click", event => {

            /* Mencegah navigasi sebelum konfirmasi. */
            event.preventDefault();

            /* Meminta konfirmasi kepada pengguna. */
            const confirmation = window.confirm(
                "Apakah Anda yakin ingin keluar dari sistem SIPFAS?"
            );

            /* Membatalkan proses jika pengguna memilih tidak. */
            if (!confirmation) {
                return;
            }

            /* Mengarahkan pengguna ke halaman login. */
            window.location.href = logoutLink.href;
        });

        /* ====================================================
           34. MENJALANKAN HALAMAN
        ==================================================== */

        /* Memuat seluruh data saat halaman pertama dibuka. */
        refreshHistory();

        /* Menampilkan informasi inisialisasi. */
        console.log(
            "[SIPFAS] Riwayat Laporan berhasil diinisialisasi."
        );
    }

})();
