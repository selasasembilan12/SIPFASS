
/* ============================================================
   SIPFAS - DETAIL VERIFIKASI LAPORAN
   File: Detail-Verifikasi-Laporan.js

   FUNGSI:
   1. Memuat identitas laporan berdasarkan kode laporan.
   2. Menampilkan informasi pelapor dan fasilitas.
   3. Mengelola parameter X1, X2, dan X3.
   4. Menghitung prioritas C4.5.
   5. Memilih keputusan valid atau tidak valid.
   6. Menyimpan hasil verifikasi.
   7. Menyimpan catatan verifikator.
   8. Memuat hasil verifikasi sebelumnya.
   9. Sinkronisasi dengan halaman daftar laporan.
   10. Mengelola navigasi sidebar.

   LOCAL STORAGE:
   sipfas_verifikasi_laporan
   sipfas_selected_report
============================================================ */

(() => {
    "use strict";

    /* ========================================================
       1. KONFIGURASI
    ======================================================== */

    const STORAGE_KEY = "sipfas_verifikasi_laporan";
    const SELECTED_REPORT_KEY = "sipfas_selected_report";

    const PRIORITY_LABELS = {
        tinggi: "TINGGI",
        sedang: "SEDANG",
        rendah: "RENDAH"
    };

    const DECISION_LABELS = {
        valid: "Laporan Valid",
        invalid: "Laporan Tidak Valid"
    };

    /* ========================================================
       2. INISIALISASI
    ======================================================== */

    document.addEventListener("DOMContentLoaded", initialize);

    function initialize() {

        const $ = id => document.getElementById(id);
        const query = selector => document.querySelector(selector);

        /* Elemen informasi laporan. */
        const reportCodeElement = $("reportCode");
        const damageSelect = $("damage");
        const impactSelect = $("impact");

        /* Elemen parameter dan prioritas. */
        const lockedValue = query(".locked-value");
        const priorityResult = $("priorityResult");
        const recalculateButton = $("recalculate");

        /* Elemen keputusan verifikasi. */
        const decisionButtons = Array.from(
            document.querySelectorAll(".decision-option")
        );

        const decisionNotice = $("decisionNotice");

        /* Elemen penyimpanan. */
        const verifierNotes = $("verifierNotes");
        const saveButton = $("saveVerification");
        const saveFeedback = $("saveFeedback");

        /* Elemen status. */
        const statusPill = query(".pending-pill");

        /* Validasi elemen HTML. */
        if (
            !reportCodeElement ||
            !damageSelect ||
            !impactSelect ||
            !priorityResult ||
            !recalculateButton ||
            !saveButton ||
            !verifierNotes ||
            decisionButtons.length === 0
        ) {
            console.error(
                "[SIPFAS] Elemen HTML Detail Verifikasi tidak lengkap."
            );
            return;
        }

        /* ====================================================
           3. STATE PROGRAM
        ==================================================== */

        let currentReport = null;
        let currentPriority = "";
        let selectedDecision = "";

        let hasRecalculated = false;
        let parametersChanged = false;
        let lastCalculatedParameters = null;

        /* ====================================================
           4. NORMALISASI TEKS
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
           5. NORMALISASI PARAMETER X1
        ==================================================== */

        function normalizeDamage(value) {
            const text = normalizeText(value);

            if (text.includes("berat")) return "berat";
            if (text.includes("sedang")) return "sedang";
            if (text.includes("ringan")) return "ringan";

            return "";
        }

        /* ====================================================
           6. NORMALISASI PARAMETER X2
        ==================================================== */

        function normalizeImpact(value) {
            const text = normalizeText(value);

            if (text.includes("tinggi")) return "tinggi";
            if (text.includes("sedang")) return "sedang";
            if (text.includes("rendah")) return "rendah";

            return "";
        }

        /* ====================================================
           7. NORMALISASI PRIORITAS
        ==================================================== */

        function normalizePriority(value) {
            const text = normalizeText(value);

            if (text.includes("tinggi")) return "tinggi";
            if (text.includes("sedang")) return "sedang";
            if (text.includes("rendah")) return "rendah";

            return "";
        }

        /* ====================================================
           8. MEMBACA LOCAL STORAGE
        ==================================================== */

        function readStorage(key) {
            try {
                const raw = localStorage.getItem(key);

                if (raw === null) return {};

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
                    `[SIPFAS] Gagal membaca ${key}:`,
                    error
                );

                return null;
            }
        }

        /* ====================================================
           9. MENYIMPAN LOCAL STORAGE
        ==================================================== */

        function writeStorage(key, data) {
            const serialized = JSON.stringify(data);

            localStorage.setItem(key, serialized);

            if (localStorage.getItem(key) !== serialized) {
                throw new Error("Konfirmasi penyimpanan gagal.");
            }

            return true;
        }

        /* ====================================================
           10. MENAMPILKAN PESAN
        ==================================================== */

        function showFeedback(message, type = "") {
            if (!saveFeedback) return;

            saveFeedback.textContent = message;
            saveFeedback.dataset.state = type;
        }

        /* ====================================================
           11. MEMPERBARUI TEKS HTML
        ==================================================== */

        function setText(id, value, allowEmpty = false) {
            const element = $(id);

            if (
                !element ||
                value === undefined ||
                value === null
            ) {
                return;
            }

            const text = String(value).trim();

            if (text || allowEmpty) {
                element.textContent = text;
            }
        }

        /* ====================================================
           12. MENGAMBIL KODE LAPORAN
        ==================================================== */

        function getCurrentReportCode() {
            return String(
                reportCodeElement.textContent || ""
            ).trim().toUpperCase();
        }

        /* ====================================================
           13. MEMUAT LAPORAN TERPILIH
        ==================================================== */

        function loadSelectedReport() {
            const params = new URLSearchParams(
                window.location.search
            );

            const urlCode = (
                params.get("kode") || ""
            ).trim().toUpperCase();

            const selectedData = readStorage(
                SELECTED_REPORT_KEY
            );

            if (selectedData === null) {
                showFeedback(
                    "Data laporan terpilih tidak dapat dibaca.",
                    "error"
                );
                return null;
            }

            const storedCode = String(
                selectedData.id ||
                selectedData.reportCode ||
                ""
            ).trim().toUpperCase();

            const reportCode = urlCode || storedCode;

            if (!reportCode) {
                showFeedback(
                    "Kode laporan tidak ditemukan. Silakan pilih laporan dari daftar.",
                    "error"
                );
                return null;
            }

            if (
                urlCode &&
                storedCode &&
                urlCode !== storedCode
            ) {
                showFeedback(
                    "Identitas laporan tidak cocok. Silakan pilih ulang laporan.",
                    "error"
                );
                return null;
            }

            const report = {
                ...selectedData,
                id: reportCode
            };

            setText("reportCode", reportCode);
            setText("pageCode", reportCode);

            return report;
        }

        /* ====================================================
           14. INFORMASI PELAPOR
        ==================================================== */

        function getReporterInformation(report) {
            const raw = String(
                report.reporter || ""
            ).trim();

            const lines = raw
                .split(/\n+/)
                .map(item => item.trim())
                .filter(Boolean);

            return {
                name: report.reporterName || lines[0] || "",
                nim: report.reporterNim ||
                    lines.slice(1).join(" ") ||
                    ""
            };
        }

        /* ====================================================
           15. MENAMPILKAN INFORMASI LAPORAN
        ==================================================== */

        function displayReportInformation(report) {
            if (!report) return;

            const reporter = getReporterInformation(report);

            setText("reportCode", report.id);
            setText("pageCode", report.id);
            setText("reportName", reporter.name);
            setText("reportNim", reporter.nim, true);

            setText("reportFacility", report.facility);
            setText("reportLocation", report.location);
            setText("reportTime", report.date);

            /* Menampilkan inisial pelapor. */
            const initials = $("reportInitials");

            if (initials && reporter.name) {
                initials.textContent = reporter.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(word => word.charAt(0).toUpperCase())
                    .join("");
            }

            /* Menampilkan tanggal laporan. */
            const datePill = query(".date-pill");

            if (datePill && report.date) {
                datePill.textContent = `◷ ${report.date}`;
            }

            /* Menampilkan deskripsi kerusakan. */
            if (report.description) {
                setText(
                    "reportDescription",
                    report.description
                );
            }

            /* Menampilkan prioritas awal. */
            const initialPriority = normalizePriority(
                report.priority
            );

            if (initialPriority) {
                updatePriorityDisplay(initialPriority);
            } else {
                currentPriority = "";
                priorityResult.textContent = "BELUM DIHITUNG";

                priorityResult.classList.remove(
                    "priority-high",
                    "priority-medium",
                    "priority-low"
                );
            }
        }

        /* ====================================================
           16. MENGAMBIL NILAI X3
        ==================================================== */

        function getX3Value() {
            const rawValue = lockedValue
                ? lockedValue.textContent
                : "";

            const value = normalizeText(rawValue);

            if (value.includes("jarang")) return "jarang";
            if (value.includes("kadang")) return "kadang";
            if (value.includes("sering")) return "sering";

            return "";
        }

        /* ====================================================
           17. MENGAMBIL PARAMETER X1, X2, X3
        ==================================================== */

        function getCurrentParameters() {
            return {
                x1: normalizeDamage(damageSelect.value),
                x2: normalizeImpact(impactSelect.value),
                x3: getX3Value()
            };
        }

        /* ====================================================
           18. VALIDASI PARAMETER
        ==================================================== */

        function validateParameters(parameters) {
            if (
                !["berat", "sedang", "ringan"].includes(
                    parameters.x1
                )
            ) {
                return "Nilai X1 tidak valid.";
            }

            if (
                !["tinggi", "sedang", "rendah"].includes(
                    parameters.x2
                )
            ) {
                return "Nilai X2 tidak valid.";
            }

            if (
                !["sering", "kadang", "jarang"].includes(
                    parameters.x3
                )
            ) {
                return "Nilai X3 tidak valid atau belum tersedia.";
            }

            return "";
        }

        /* ====================================================
           19. KLASIFIKASI PRIORITAS C4.5
        ==================================================== */

        /*
           ATURAN KLASIFIKASI SEMENTARA DARI PROGRAM SUMBER.

           Ganti aturan ini jika sudah tersedia pohon keputusan
           C4.5 hasil training dataset penelitian.
        */

        function classifyPriority(x1, x2, x3) {

            if (x1 === "berat") {
                return "tinggi";
            }

            if (x1 === "sedang") {

                if (x2 === "tinggi") {
                    return "tinggi";
                }

                if (x2 === "sedang") {

                    if (x3 === "sering") {
                        return "tinggi";
                    }

                    if (x3 === "kadang") {
                        return "sedang";
                    }

                    return "rendah";
                }

                return x3 === "sering"
                    ? "sedang"
                    : "rendah";
            }

            if (
                x2 === "tinggi" &&
                x3 === "sering"
            ) {
                return "sedang";
            }

            return "rendah";
        }

        /* ====================================================
           20. MEMPERBARUI TAMPILAN PRIORITAS
        ==================================================== */

        function updatePriorityDisplay(priority) {
            const normalized = normalizePriority(priority);

            if (!normalized) return false;

            currentPriority = normalized;

            priorityResult.textContent =
                PRIORITY_LABELS[normalized];

            priorityResult.classList.remove(
                "priority-high",
                "priority-medium",
                "priority-low"
            );

            const cssClasses = {
                tinggi: "priority-high",
                sedang: "priority-medium",
                rendah: "priority-low"
            };

            priorityResult.classList.add(
                cssClasses[normalized]
            );

            return true;
        }

        /* ====================================================
           21. MENGHITUNG ULANG PRIORITAS
        ==================================================== */

        function recalculatePriority() {
            const parameters = getCurrentParameters();

            const validationError =
                validateParameters(parameters);

            if (validationError) {
                showFeedback(validationError, "error");
                return;
            }

            const result = classifyPriority(
                parameters.x1,
                parameters.x2,
                parameters.x3
            );

            if (!result) {
                showFeedback(
                    "Hasil klasifikasi tidak tersedia.",
                    "error"
                );
                return;
            }

            updatePriorityDisplay(result);

            hasRecalculated = true;
            parametersChanged = false;

            lastCalculatedParameters = {
                ...parameters
            };

            const recommendationInfo = query(
                ".recommendation p"
            );

            if (recommendationInfo) {
                recommendationInfo.textContent =
                    "Hasil klasifikasi merupakan rekomendasi awal dan belum menjadi keputusan akhir penanganan.";
            }

            showFeedback(
                `Prioritas berhasil dihitung: ${result.toUpperCase()}.`,
                "success"
            );

            console.log(
                "[SIPFAS] Hasil perhitungan:",
                {
                    reportCode: getCurrentReportCode(),
                    parameters,
                    priority: result
                }
            );
        }

        /* ====================================================
           22. TAMPILAN KEPUTUSAN VERIFIKASI
        ==================================================== */

        function updateDecisionNotice(decision) {
            if (!decisionNotice) return;

            const title = decisionNotice.querySelector(
                "strong span"
            );

            const description = decisionNotice.querySelector(
                "p"
            );

            decisionNotice.classList.remove(
                "valid",
                "invalid"
            );

            if (decision === "valid") {
                decisionNotice.classList.add("valid");

                if (title) {
                    title.textContent =
                        "Laporan Memenuhi Syarat";
                }

                if (description) {
                    description.textContent =
                        "Laporan diverifikasi valid dan akan diteruskan ke daftar antrean Penanganan Fasilitas.";
                }

            } else if (decision === "invalid") {
                decisionNotice.classList.add("invalid");

                if (title) {
                    title.textContent =
                        "Laporan Tidak Memenuhi Syarat";
                }

                if (description) {
                    description.textContent =
                        "Laporan dinyatakan tidak valid dan tidak diteruskan ke daftar antrean Penanganan Fasilitas.";
                }

            } else {
                if (title) {
                    title.textContent =
                        "Menunggu Keputusan Verifikasi";
                }

                if (description) {
                    description.textContent =
                        "Silakan pilih keputusan valid atau tidak valid untuk laporan ini.";
                }
            }
        }

        /* ====================================================
           23. MEMILIH KEPUTUSAN
        ==================================================== */

        function updateDecision(decision) {
            selectedDecision = decision;

            decisionButtons.forEach(button => {
                const isSelected =
                    button.dataset.decision === decision;

                button.classList.toggle(
                    "selected",
                    isSelected
                );

                button.setAttribute(
                    "aria-pressed",
                    String(isSelected)
                );
            });

            updateDecisionNotice(decision);
        }

        /* ====================================================
           24. MEMPERBARUI STATUS LAPORAN
        ==================================================== */

        function updateStatusBadge(decision) {
            if (!statusPill) return;

            const labels = {
                valid: "TERVERIFIKASI",
                invalid: "TIDAK VALID",
                pending: "MENUNGGU VERIFIKASI"
            };

            const label = labels[decision] || labels.pending;

            statusPill.textContent = `● ${label}`;
            statusPill.dataset.reportStatus =
                decision || "pending";

            statusPill.setAttribute(
                "aria-label",
                label
            );
        }

        /* ====================================================
           25. METADATA LAPORAN
        ==================================================== */

        function getReportMetadata() {
            return {
                reportCode: getCurrentReportCode(),

                reporterName:
                    $("reportName")?.textContent.trim() || "",

                reporterNim:
                    $("reportNim")?.textContent.trim() || "",

                facilityName:
                    $("reportFacility")?.textContent.trim() || "",

                facilityLocation:
                    $("reportLocation")?.textContent.trim() || "",

                reportTime:
                    $("reportTime")?.textContent.trim() || "",

                description:
                    $("reportDescription")?.textContent.trim() || ""
            };
        }

        /* ====================================================
           26. MENYIMPAN HASIL VERIFIKASI
        ==================================================== */

        function saveVerification() {

            /* Validasi keputusan. */
            if (
                !["valid", "invalid"].includes(selectedDecision)
            ) {
                showFeedback(
                    "Silakan pilih Laporan Valid atau Laporan Tidak Valid terlebih dahulu.",
                    "error"
                );
                return;
            }

            /* Validasi kode laporan. */
            const reportCode = getCurrentReportCode();

            if (!reportCode) {
                showFeedback(
                    "Kode laporan tidak ditemukan.",
                    "error"
                );
                return;
            }

            /* Membaca seluruh data laporan tersimpan. */
            const allData = readStorage(STORAGE_KEY);

            if (allData === null) {
                showFeedback(
                    "Data penyimpanan gagal dibaca.",
                    "error"
                );
                return;
            }

            /* Mengambil parameter terbaru. */
            const parameters = getCurrentParameters();

            const validationError =
                validateParameters(parameters);

            if (validationError) {
                showFeedback(validationError, "error");
                return;
            }

            /* Wajib hitung ulang jika parameter berubah. */
            if (
                parametersChanged &&
                !hasRecalculated
            ) {
                showFeedback(
                    "Parameter berubah. Klik Hitung Ulang Prioritas sebelum menyimpan.",
                    "error"
                );
                return;
            }

            /* Memastikan parameter sama dengan hasil perhitungan. */
            if (
                hasRecalculated &&
                lastCalculatedParameters &&
                (
                    lastCalculatedParameters.x1 !== parameters.x1 ||
                    lastCalculatedParameters.x2 !== parameters.x2 ||
                    lastCalculatedParameters.x3 !== parameters.x3
                )
            ) {
                showFeedback(
                    "Parameter berbeda dari hasil perhitungan. Silakan hitung ulang.",
                    "error"
                );
                return;
            }

            /* Validasi prioritas. */
            if (
                !Object.prototype.hasOwnProperty.call(
                    PRIORITY_LABELS,
                    currentPriority
                )
            ) {
                showFeedback(
                    "Prioritas belum dihitung atau belum tersedia.",
                    "error"
                );
                return;
            }

            const verifiedAt = new Date().toISOString();

            /* Membentuk data verifikasi lengkap. */
            const verification = {
                ...getReportMetadata(),

                reportCode,

                x1: parameters.x1,
                x2: parameters.x2,
                x3: parameters.x3,

                damage: parameters.x1,
                impact: parameters.x2,
                frequency: parameters.x3,

                priority: currentPriority,
                priorityLabel:
                    PRIORITY_LABELS[currentPriority],

                decision: selectedDecision,
                decisionLabel:
                    DECISION_LABELS[selectedDecision],

                notes: verifierNotes.value.trim(),

                status: "Selesai Diverifikasi",

                verifiedAt,

                modelVersion: "aturan-sementara-v2"
            };

            try {

                /*
                   Setiap laporan disimpan berdasarkan kode unik.
                   Data laporan lainnya tidak akan tertimpa.
                */

                allData[reportCode] = verification;

                writeStorage(
                    STORAGE_KEY,
                    allData
                );

                /* Memastikan data benar-benar tersimpan. */
                const savedData = readStorage(STORAGE_KEY);

                if (
                    !savedData ||
                    !savedData[reportCode] ||
                    savedData[reportCode].priority !== currentPriority ||
                    savedData[reportCode].decision !== selectedDecision ||
                    savedData[reportCode].verifiedAt !== verifiedAt
                ) {
                    throw new Error(
                        "Konfirmasi penyimpanan gagal."
                    );
                }

                /* Memperbarui status pada halaman. */
                updateStatusBadge(selectedDecision);

                showFeedback(
                    `Verifikasi ${reportCode} berhasil disimpan. Prioritas: ${PRIORITY_LABELS[currentPriority]}.`,
                    "success"
                );

                /* Mengirim event pembaruan. */
                window.dispatchEvent(
                    new CustomEvent(
                        "sipfas:verification-saved",
                        {
                            detail: verification
                        }
                    )
                );

                console.log(
                    "[SIPFAS] Verifikasi berhasil disimpan:",
                    verification
                );

            } catch (error) {
                console.error(
                    "[SIPFAS] Gagal menyimpan verifikasi:",
                    error
                );

                showFeedback(
                    "Gagal menyimpan hasil verifikasi. Periksa Local Storage browser.",
                    "error"
                );
            }
        }

        /* ====================================================
           27. MEMULIHKAN NILAI SELECT
        ==================================================== */

        function restoreSelectValue(select, value, normalizer) {
            if (!select || !value) return;

            const target = normalizer(value);

            const matchingOption = Array.from(
                select.options
            ).find(option => {
                return normalizer(
                    option.value || option.textContent
                ) === target;
            });

            if (matchingOption) {
                select.value = matchingOption.value;
            }
        }

        /* ====================================================
           28. MEMUAT VERIFIKASI SEBELUMNYA
        ==================================================== */

        function loadVerification() {
            const reportCode = getCurrentReportCode();

            if (!reportCode) return;

            const allData = readStorage(STORAGE_KEY);

            if (allData === null) {
                showFeedback(
                    "Data verifikasi sebelumnya tidak dapat dibaca.",
                    "error"
                );
                return;
            }

            const saved = allData[reportCode];

            /* Jika belum pernah diverifikasi. */
            if (!saved) {
                selectedDecision = "";
                hasRecalculated = false;
                parametersChanged = false;
                lastCalculatedParameters = null;

                verifierNotes.value = "";

                updateDecision("");
                updateStatusBadge("pending");

                showFeedback("", "");
                return;
            }

            /* Memulihkan parameter X1 dan X2. */
            restoreSelectValue(
                damageSelect,
                saved.x1 || saved.damage,
                normalizeDamage
            );

            restoreSelectValue(
                impactSelect,
                saved.x2 || saved.impact,
                normalizeImpact
            );

            /* Memulihkan prioritas. */
            const savedPriority = normalizePriority(
                saved.priority || saved.priorityLabel
            );

            if (savedPriority) {
                updatePriorityDisplay(savedPriority);
            }

            /* Memulihkan catatan. */
            verifierNotes.value = saved.notes || "";

            /* Memulihkan keputusan. */
            const savedDecision = [
                "valid",
                "invalid"
            ].includes(saved.decision)
                ? saved.decision
                : "";

            updateDecision(savedDecision);

            updateStatusBadge(
                savedDecision || "pending"
            );

            parametersChanged = false;
            hasRecalculated = false;
            lastCalculatedParameters = null;

            showFeedback(
                "Data verifikasi sebelumnya berhasil dimuat.",
                "success"
            );

            console.log(
                "[SIPFAS] Data verifikasi dimuat:",
                saved
            );
        }

        /* ====================================================
           29. EVENT PILIHAN KEPUTUSAN
        ==================================================== */

        decisionButtons.forEach(button => {
            button.addEventListener("click", () => {

                const decision = button.dataset.decision;

                if (
                    !["valid", "invalid"].includes(decision)
                ) {
                    return;
                }

                updateDecision(decision);
                showFeedback("", "");
            });
        });

        /* ====================================================
           30. EVENT HITUNG ULANG
        ==================================================== */

        recalculateButton.addEventListener(
            "click",
            event => {
                event.preventDefault();
                recalculatePriority();
            }
        );

        /* ====================================================
           31. EVENT PERUBAHAN X1 DAN X2
        ==================================================== */

        [damageSelect, impactSelect].forEach(select => {
            select.addEventListener("change", () => {

                hasRecalculated = false;
                parametersChanged = true;

                showFeedback(
                    "Parameter berubah. Klik Hitung Ulang Prioritas sebelum menyimpan.",
                    "info"
                );
            });
        });

        /* ====================================================
           32. EVENT SIMPAN VERIFIKASI
        ==================================================== */

        saveButton.addEventListener("click", event => {
            event.preventDefault();
            saveVerification();
        });

        /* ====================================================
           33. SINKRONISASI LOCAL STORAGE
        ==================================================== */

        window.addEventListener("storage", event => {
            if (
                event.key === STORAGE_KEY ||
                event.key === null
            ) {
                loadVerification();
            }
        });

        /* ====================================================
           34. EVENT PEMBARUAN VERIFIKASI
        ==================================================== */

        window.addEventListener(
            "sipfas:verification-saved",
            event => {

                if (
                    event.detail?.reportCode ===
                    getCurrentReportCode()
                ) {
                    updateStatusBadge(
                        event.detail.decision
                    );
                }
            }
        );

        /* ====================================================
           35. SIDEBAR RESPONSIF
        ==================================================== */

        const sidebar = $("sidebar");
        const menuToggle = $("menuToggle");
        const overlay = $("pageOverlay");

        function setSidebar(open) {
            if (!sidebar) return;

            sidebar.classList.toggle("open", open);

            overlay?.classList.toggle("show", open);

            menuToggle?.setAttribute(
                "aria-expanded",
                String(open)
            );
        }

        menuToggle?.addEventListener("click", () => {
            setSidebar(
                !sidebar.classList.contains("open")
            );
        });

        overlay?.addEventListener(
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
           36. KONFIRMASI KELUAR
        ==================================================== */

        const logoutLink = $("logoutLink");

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
           37. INISIALISASI DATA
        ==================================================== */

        currentReport = loadSelectedReport();

        if (!currentReport) {
            console.error(
                "[SIPFAS] Inisialisasi dibatalkan karena identitas laporan tidak valid."
            );
            return;
        }

        /* Menampilkan identitas laporan. */
        displayReportInformation(currentReport);

        /* Memuat hasil verifikasi sebelumnya. */
        loadVerification();

        console.log(
            "[SIPFAS] Detail Verifikasi berhasil diinisialisasi:",
            {
                reportCode: getCurrentReportCode(),
                report: currentReport
            }
        );

    } // Penutup fungsi initialize()

})(); // Penutup IIFE
