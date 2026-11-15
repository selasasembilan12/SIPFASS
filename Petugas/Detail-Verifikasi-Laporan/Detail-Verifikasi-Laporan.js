/* ============================================================
   SIPFAS - DETAIL VERIFIKASI LAPORAN
   File: Detail-Verifikasi-Laporan.js
   VERSI REVISI FINAL

   STANDAR WAKTU:
   - WIT Maluku Utara (UTC+09:00)
   - Penyimpanan timestamp: ISO 8601 UTC.
   - Tampilan timestamp: Asia/Jayapura.

   FITUR:
   1. Memuat identitas laporan berdasarkan kode unik.
   2. Menampilkan informasi pelapor dan fasilitas.
   3. Mengelola parameter X1, X2, dan X3.
   4. Menghitung rekomendasi prioritas.
   5. Memilih keputusan valid atau tidak valid.
   6. Menyimpan hasil verifikasi.
   7. Menyimpan catatan verifikator.
   8. Memuat hasil verifikasi sebelumnya.
   9. Mempertahankan data laporan lainnya.
   10. Sinkronisasi dengan halaman lain.
   11. Menampilkan waktu verifikasi.
   12. Sidebar responsif.
   13. Konfirmasi keluar.
   14. Notifikasi verifikasi berhasil disimpan.

   LOCAL STORAGE:
   - sipfas_verifikasi_laporan
   - sipfas_selected_report
============================================================ */

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    // ====================================================
    // 01. KONFIGURASI
    // ====================================================

    const STORAGE_KEY = "sipfas_verifikasi_laporan";
    const SELECTED_REPORT_KEY = "sipfas_selected_report";

    const TIME_ZONE = "Asia/Jayapura";

    const PRIORITY_LABELS = {
      tinggi: "TINGGI",
      sedang: "SEDANG",
      rendah: "RENDAH",
    };

    const DECISION_LABELS = {
      valid: "Laporan Valid",
      invalid: "Laporan Tidak Valid",
    };

    // ====================================================
    // 02. INISIALISASI ELEMEN HTML
    // ====================================================

    const $ = (id) => document.getElementById(id);
    const query = (selector) => document.querySelector(selector);

    const reportCodeElement = $("reportCode");
    const damageSelect = $("damage");
    const impactSelect = $("impact");

    const lockedValue = query(".locked-value");
    const priorityResult = $("priorityResult");
    const recalculateButton = $("recalculate");

    const decisionButtons = Array.from(
      document.querySelectorAll(".decision-option"),
    );

    const decisionNotice = $("decisionNotice");

    const verifierNotes = $("verifierNotes");
    const saveButton = $("saveVerification");
    const saveFeedback = $("saveFeedback");

    const statusPill = query(".pending-pill");

    // Validasi struktur HTML.
    const requiredElements = {
      reportCode: reportCodeElement,
      damage: damageSelect,
      impact: impactSelect,
      priorityResult,
      recalculate: recalculateButton,
      saveVerification: saveButton,
      verifierNotes,
      decisionButtons,
    };

    const missingElements = Object.entries(requiredElements)
      .filter(([, element]) => {
        return Array.isArray(element) ? element.length === 0 : !element;
      })
      .map(([name]) => name);

    if (missingElements.length > 0) {
      console.error("[SIPFAS] Elemen HTML tidak ditemukan:", missingElements);

      return;
    }

    // ====================================================
    // 03. STATE PROGRAM
    // ====================================================

    let currentReport = null;
    let currentPriority = "";
    let selectedDecision = "";

    let hasRecalculated = false;
    let parametersChanged = false;

    let lastCalculatedParameters = null;

    // ====================================================
    // 04. NORMALISASI TEKS
    // ====================================================

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

    // ====================================================
    // 05. NORMALISASI PARAMETER X1
    // ====================================================

    function normalizeDamage(value) {
      const text = normalizeText(value);

      if (text.includes("berat")) return "berat";
      if (text.includes("sedang")) return "sedang";
      if (text.includes("ringan")) return "ringan";

      return "";
    }

    // ====================================================
    // 06. NORMALISASI PARAMETER X2
    // ====================================================

    function normalizeImpact(value) {
      const text = normalizeText(value);

      if (text.includes("tinggi")) return "tinggi";
      if (text.includes("sedang")) return "sedang";
      if (text.includes("rendah")) return "rendah";

      return "";
    }

    // ====================================================
    // 07. NORMALISASI PRIORITAS
    // ====================================================

    function normalizePriority(value) {
      const text = normalizeText(value);

      if (text.includes("tinggi")) return "tinggi";
      if (text.includes("sedang")) return "sedang";
      if (text.includes("rendah")) return "rendah";

      return "";
    }

    // ====================================================
    // 08. NORMALISASI KEPUTUSAN
    // ====================================================

    function normalizeDecision(value) {
      const text = normalizeText(value);

      if (text === "valid" || text === "laporan valid") {
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

    // ====================================================
    // 09. FORMAT WAKTU WIT
    // ====================================================

    function parseTimestamp(value) {
      if (!value) return null;

      const date = value instanceof Date ? value : new Date(value);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return date;
    }

    function formatWIT(value, includeSeconds = true) {
      const date = parseTimestamp(value);

      if (!date) {
        return "Belum tersedia";
      }

      return (
        new Intl.DateTimeFormat("id-ID", {
          timeZone: TIME_ZONE,
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: includeSeconds ? "2-digit" : undefined,
          hour12: false,
        }).format(date) + " WIT"
      );
    }

    function formatDateWIT(value) {
      const date = parseTimestamp(value);

      if (!date) return String(value || "—");

      return new Intl.DateTimeFormat("id-ID", {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
    }

    // ====================================================
    // 10. MEMBACA LOCAL STORAGE
    // ====================================================

    function readStorage(key) {
      try {
        const raw = localStorage.getItem(key);

        if (raw === null) return {};

        const data = JSON.parse(raw);

        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("Format data penyimpanan tidak valid.");
        }

        return data;
      } catch (error) {
        console.error(`[SIPFAS] Gagal membaca ${key}:`, error);

        return null;
      }
    }

    // ====================================================
    // 11. MENYIMPAN LOCAL STORAGE
    // ====================================================

    function writeStorage(key, data) {
      const serialized = JSON.stringify(data);

      localStorage.setItem(key, serialized);

      const saved = localStorage.getItem(key);

      if (saved !== serialized) {
        throw new Error("Konfirmasi penyimpanan gagal.");
      }

      return true;
    }

    // ====================================================
    // 12. MENAMPILKAN PESAN
    // ====================================================

    function showFeedback(message, type = "") {
      if (!saveFeedback) return;

      saveFeedback.textContent = message;
      saveFeedback.dataset.state = type;
    }

    // ====================================================
    // 12A. NOTIFIKASI VERIFIKASI BERHASIL DISIMPAN
    // ====================================================

    function showSaveNotification(message) {
      const notificationId = "sipfasSaveNotification";
      const styleId = "sipfasSaveNotificationStyle";

      // Membuat CSS notifikasi satu kali.
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");

        style.id = styleId;

        style.textContent = `
                    #${notificationId} {
                        position: fixed;
                        top: 24px;
                        right: 24px;
                        z-index: 99999;
                        display: flex;
                        align-items: flex-start;
                        gap: 12px;
                        width: min(380px, calc(100vw - 32px));
                        padding: 16px 18px;
                        color: #17633a;
                        background: #ffffff;
                        border: 1px solid #b7e4c7;
                        border-left: 4px solid #269653;
                        border-radius: 10px;
                        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
                        font-family: inherit;
                        font-size: 14px;
                        line-height: 1.5;
                        opacity: 0;
                        transform: translateY(-10px);
                        transition: opacity 180ms ease, transform 180ms ease;
                        pointer-events: none;
                    }

                    #${notificationId}.show {
                        opacity: 1;
                        transform: translateY(0);
                    }

                    #${notificationId} .sipfas-notification-icon {
                        display: inline-flex;
                        flex: 0 0 22px;
                        width: 22px;
                        height: 22px;
                        align-items: center;
                        justify-content: center;
                        color: #269653;
                        font-size: 19px;
                        font-weight: 700;
                    }

                    #${notificationId} .sipfas-notification-message {
                        flex: 1;
                        font-weight: 600;
                    }

                    @media (max-width: 480px) {
                        #${notificationId} {
                            top: 12px;
                            right: 12px;
                            width: calc(100vw - 24px);
                        }
                    }

                    @media (prefers-reduced-motion: reduce) {
                        #${notificationId} {
                            transition: none;
                        }
                    }
                `;

        document.head.appendChild(style);
      }

      // Menggunakan satu elemen notifikasi.
      let notification = document.getElementById(notificationId);

      if (!notification) {
        notification = document.createElement("div");

        notification.id = notificationId;

        notification.setAttribute("role", "status");

        notification.setAttribute("aria-live", "polite");

        notification.setAttribute("aria-atomic", "true");

        const icon = document.createElement("span");

        icon.className = "sipfas-notification-icon";

        icon.setAttribute("aria-hidden", "true");

        icon.textContent = "✓";

        const text = document.createElement("span");

        text.className = "sipfas-notification-message";

        notification.appendChild(icon);
        notification.appendChild(text);

        document.body.appendChild(notification);
      }

      const messageElement = notification.querySelector(
        ".sipfas-notification-message",
      );

      if (messageElement) {
        messageElement.textContent = message;
      }

      notification.classList.remove("show");

      void notification.offsetWidth;

      notification.classList.add("show");

      if (notification.dismissTimer) {
        window.clearTimeout(notification.dismissTimer);
      }

      notification.dismissTimer = window.setTimeout(() => {
        notification.classList.remove("show");
      }, 4500);
    }

    // ====================================================
    // 13. MEMPERBARUI TEKS HTML
    // ====================================================

    function setText(id, value, allowEmpty = false) {
      const element = $(id);

      if (!element || value === undefined || value === null) {
        return;
      }

      const text = String(value).trim();

      if (text || allowEmpty) {
        element.textContent = text;
      }
    }

    // ====================================================
    // 14. MENGAMBIL KODE LAPORAN
    // ====================================================

    function getCurrentReportCode() {
      return normalizeReportCode(reportCodeElement.textContent);
    }

    // ====================================================
    // 15. MEMUAT LAPORAN TERPILIH
    // ====================================================

    function loadSelectedReport() {
      const params = new URLSearchParams(window.location.search);

      const urlCode = normalizeReportCode(params.get("kode"));

      const selectedData = readStorage(SELECTED_REPORT_KEY);

      if (selectedData === null) {
        showFeedback("Data laporan terpilih tidak dapat dibaca.", "error");

        return null;
      }

      const storedCode = normalizeReportCode(
        selectedData.id || selectedData.reportCode || selectedData.report_code,
      );

      const reportCode = urlCode || storedCode;

      if (!reportCode) {
        showFeedback(
          "Kode laporan tidak ditemukan. Silakan pilih laporan dari daftar.",
          "error",
        );

        return null;
      }

      if (urlCode && storedCode && urlCode !== storedCode) {
        showFeedback(
          "Identitas laporan tidak cocok. Silakan pilih ulang laporan.",
          "error",
        );

        return null;
      }

      const report = {
        ...selectedData,
        id: reportCode,
        reportCode,
      };

      setText("reportCode", reportCode);
      setText("pageCode", reportCode);

      return report;
    }

    // ====================================================
    // 16. INFORMASI PELAPOR
    // ====================================================

    function getReporterInformation(report) {
      const raw = String(report.reporter || "").trim();

      const lines = raw
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean);

      return {
        name: report.reporterName || lines[0] || "",

        nim: report.reporterNim || lines.slice(1).join(" ") || "",
      };
    }

    // ====================================================
    // 17. MENAMPILKAN INFORMASI LAPORAN
    // ====================================================

    function displayReportInformation(report) {
      if (!report) return;

      const reporter = getReporterInformation(report);

      setText("reportCode", report.id);
      setText("pageCode", report.id);

      setText("reportName", reporter.name);
      setText("reportNim", reporter.nim, true);

      setText("reportFacility", report.facility);
      setText("reportLocation", report.location);

      const reportDate =
        report.date || report.reportTime || report.createdAt || "";

      // Menampilkan tanggal pengiriman laporan.
      setText("reportTime", reportDate ? formatDateWIT(reportDate) : "—");

      // Inisial pelapor.
      const initials = $("reportInitials");

      if (initials && reporter.name) {
        initials.textContent = reporter.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((word) => word.charAt(0).toUpperCase())
          .join("");
      }

      // Badge tanggal.
      const datePill = query(".date-pill");

      if (datePill && reportDate) {
        datePill.textContent = `◷ ${formatDateWIT(reportDate)}`;
      }

      // Deskripsi kerusakan.
      if (report.description) {
        setText("reportDescription", report.description);
      }

      // Prioritas awal.
      const initialPriority = normalizePriority(report.priority);

      if (initialPriority) {
        updatePriorityDisplay(initialPriority);
      } else {
        currentPriority = "";

        priorityResult.textContent = "BELUM DIHITUNG";

        priorityResult.classList.remove(
          "priority-high",
          "priority-medium",
          "priority-low",
        );
      }
    }

    // ====================================================
    // 18. MENGAMBIL NILAI X3
    // ====================================================

    function getX3Value() {
      const rawValue = lockedValue ? lockedValue.textContent : "";

      const value = normalizeText(rawValue);

      if (value.includes("jarang")) return "jarang";
      if (value.includes("kadang")) return "kadang";
      if (value.includes("sering")) return "sering";

      return "";
    }

    // ====================================================
    // 19. MENGAMBIL PARAMETER X1, X2, X3
    // ====================================================

    function getCurrentParameters() {
      return {
        x1: normalizeDamage(damageSelect.value),
        x2: normalizeImpact(impactSelect.value),
        x3: getX3Value(),
      };
    }

    // ====================================================
    // 20. VALIDASI PARAMETER
    // ====================================================

    function validateParameters(parameters) {
      if (!["berat", "sedang", "ringan"].includes(parameters.x1)) {
        return "Nilai X1 tidak valid.";
      }

      if (!["tinggi", "sedang", "rendah"].includes(parameters.x2)) {
        return "Nilai X2 tidak valid.";
      }

      if (!["sering", "kadang", "jarang"].includes(parameters.x3)) {
        return "Nilai X3 tidak valid atau belum tersedia.";
      }

      return "";
    }

    // ====================================================
    // 21. KLASIFIKASI PRIORITAS
    // ====================================================

    /*
           ATURAN KLASIFIKASI SEMENTARA.

           Fungsi ini mempertahankan aturan dari program
           sebelumnya.

           Aturan ini belum dapat disebut sebagai pohon
           keputusan C4.5 hasil training dataset penelitian
           tanpa bukti hasil pembentukan model.
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

        return x3 === "sering" ? "sedang" : "rendah";
      }

      if (x2 === "tinggi" && x3 === "sering") {
        return "sedang";
      }

      return "rendah";
    }

    // ====================================================
    // 22. MEMPERBARUI TAMPILAN PRIORITAS
    // ====================================================

    function updatePriorityDisplay(priority) {
      const normalized = normalizePriority(priority);

      if (!normalized) return false;

      currentPriority = normalized;

      priorityResult.textContent = PRIORITY_LABELS[normalized];

      priorityResult.classList.remove(
        "priority-high",
        "priority-medium",
        "priority-low",
      );

      const cssClasses = {
        tinggi: "priority-high",
        sedang: "priority-medium",
        rendah: "priority-low",
      };

      priorityResult.classList.add(cssClasses[normalized]);

      return true;
    }

    // ====================================================
    // 23. MENGHITUNG ULANG PRIORITAS
    // ====================================================

    function recalculatePriority() {
      const parameters = getCurrentParameters();

      const validationError = validateParameters(parameters);

      if (validationError) {
        showFeedback(validationError, "error");
        return;
      }

      const result = classifyPriority(
        parameters.x1,
        parameters.x2,
        parameters.x3,
      );

      if (!Object.prototype.hasOwnProperty.call(PRIORITY_LABELS, result)) {
        showFeedback("Hasil klasifikasi tidak tersedia.", "error");

        return;
      }

      updatePriorityDisplay(result);

      hasRecalculated = true;
      parametersChanged = false;

      lastCalculatedParameters = {
        ...parameters,
      };

      const recommendationInfo = query(".recommendation p");

      if (recommendationInfo) {
        recommendationInfo.textContent =
          "Hasil klasifikasi merupakan rekomendasi awal dan belum menjadi keputusan akhir verifikasi.";
      }

      showFeedback(
        `Prioritas berhasil dihitung: ${result.toUpperCase()}.`,
        "success",
      );

      console.log("[SIPFAS] Hasil perhitungan:", {
        reportCode: getCurrentReportCode(),
        parameters,
        priority: result,
      });
    }

    // ====================================================
    // 24. TAMPILAN KEPUTUSAN VERIFIKASI
    // ====================================================

    function updateDecisionNotice(decision) {
      if (!decisionNotice) return;

      const title = decisionNotice.querySelector("strong span");

      const description = decisionNotice.querySelector("p");

      decisionNotice.classList.remove("valid", "invalid");

      if (decision === "valid") {
        decisionNotice.classList.add("valid");

        if (title) {
          title.textContent = "Laporan Memenuhi Syarat";
        }

        if (description) {
          description.textContent =
            "Laporan diverifikasi valid dan akan diteruskan ke daftar antrean Penanganan Fasilitas.";
        }
      } else if (decision === "invalid") {
        decisionNotice.classList.add("invalid");

        if (title) {
          title.textContent = "Laporan Tidak Memenuhi Syarat";
        }

        if (description) {
          description.textContent =
            "Laporan dinyatakan tidak valid dan tidak diteruskan ke daftar antrean Penanganan Fasilitas.";
        }
      } else {
        if (title) {
          title.textContent = "Menunggu Keputusan Verifikasi";
        }

        if (description) {
          description.textContent =
            "Silakan pilih keputusan valid atau tidak valid untuk laporan ini.";
        }
      }
    }

    // ====================================================
    // 25. MEMILIH KEPUTUSAN
    // ====================================================

    function updateDecision(decision) {
      selectedDecision = normalizeDecision(decision);

      decisionButtons.forEach((button) => {
        const isSelected = button.dataset.decision === selectedDecision;

        button.classList.toggle("selected", isSelected);

        button.setAttribute("aria-pressed", String(isSelected));
      });

      updateDecisionNotice(selectedDecision);
    }

    // ====================================================
    // 26. MEMPERBARUI STATUS LAPORAN
    // ====================================================

    function updateStatusBadge(decision, verifiedAt = null) {
      if (!statusPill) return;

      const labels = {
        valid: "TERVERIFIKASI",
        invalid: "TIDAK VALID",
        pending: "MENUNGGU VERIFIKASI",
      };

      const label = labels[decision] || labels.pending;

      statusPill.textContent = `● ${label}`;

      statusPill.dataset.reportStatus = decision || "pending";

      statusPill.setAttribute("aria-label", label);

      if (verifiedAt) {
        statusPill.title = "Waktu verifikasi: " + formatWIT(verifiedAt);
      } else {
        statusPill.removeAttribute("title");
      }
    }

    // ====================================================
    // 27. METADATA LAPORAN
    // ====================================================

    function getReportMetadata() {
      return {
        reportCode: getCurrentReportCode(),

        reporterName: $("reportName")?.textContent.trim() || "",

        reporterNim: $("reportNim")?.textContent.trim() || "",

        facilityName: $("reportFacility")?.textContent.trim() || "",

        facilityLocation: $("reportLocation")?.textContent.trim() || "",

        reportTime: $("reportTime")?.textContent.trim() || "",

        description: $("reportDescription")?.textContent.trim() || "",
      };
    }

    // ====================================================
    // 28. MENYIMPAN HASIL VERIFIKASI
    // ====================================================

    function saveVerification() {
      // Validasi keputusan.
      if (!["valid", "invalid"].includes(selectedDecision)) {
        showFeedback(
          "Silakan pilih Laporan Valid atau Laporan Tidak Valid terlebih dahulu.",
          "error",
        );

        return;
      }

      // Validasi kode laporan.
      const reportCode = getCurrentReportCode();

      if (!reportCode) {
        showFeedback("Kode laporan tidak ditemukan.", "error");

        return;
      }

      // Membaca seluruh data.
      const allData = readStorage(STORAGE_KEY);

      if (allData === null) {
        showFeedback("Data penyimpanan gagal dibaca.", "error");

        return;
      }

      // Validasi parameter.
      const parameters = getCurrentParameters();

      const validationError = validateParameters(parameters);

      if (validationError) {
        showFeedback(validationError, "error");
        return;
      }

      // Parameter berubah wajib dihitung ulang.
      if (parametersChanged && !hasRecalculated) {
        showFeedback(
          "Parameter berubah. Klik Hitung Ulang Prioritas sebelum menyimpan.",
          "error",
        );

        return;
      }

      // Memastikan parameter sama dengan hasil perhitungan.
      if (
        hasRecalculated &&
        lastCalculatedParameters &&
        (lastCalculatedParameters.x1 !== parameters.x1 ||
          lastCalculatedParameters.x2 !== parameters.x2 ||
          lastCalculatedParameters.x3 !== parameters.x3)
      ) {
        showFeedback(
          "Parameter berbeda dari hasil perhitungan. Silakan hitung ulang.",
          "error",
        );

        return;
      }

      // Validasi prioritas.
      if (
        !Object.prototype.hasOwnProperty.call(PRIORITY_LABELS, currentPriority)
      ) {
        showFeedback("Prioritas belum dihitung atau belum tersedia.", "error");

        return;
      }

      // Timestamp baru dalam ISO 8601 UTC.
      const verifiedAt = new Date().toISOString();

      const previous = allData[reportCode] || {};

      // Mempertahankan waktu laporan awal.
      const createdAt =
        previous.createdAt ||
        currentReport.createdAt ||
        currentReport.reportCreatedAt ||
        null;

      // Membentuk objek hasil verifikasi.
      const verification = {
        ...previous,

        ...getReportMetadata(),

        reportCode,

        id: reportCode,

        x1: parameters.x1,
        x2: parameters.x2,
        x3: parameters.x3,

        damage: parameters.x1,
        impact: parameters.x2,
        frequency: parameters.x3,

        priority: currentPriority,

        priorityLabel: PRIORITY_LABELS[currentPriority],

        decision: selectedDecision,

        decisionLabel: DECISION_LABELS[selectedDecision],

        notes: verifierNotes.value.trim(),

        status: "Selesai Diverifikasi",

        // Waktu pengiriman tidak diganti waktu verifikasi.
        createdAt,

        // Waktu verifikasi terbaru.
        verifiedAt,

        // Versi aturan yang digunakan.
        modelVersion: "aturan-sementara-v2",
      };

      try {
        // Memperbarui hanya laporan yang sedang diproses.
        allData[reportCode] = verification;

        writeStorage(STORAGE_KEY, allData);

        // Verifikasi ulang hasil penyimpanan.
        const savedData = readStorage(STORAGE_KEY);

        const saved = savedData?.[reportCode];

        if (
          !saved ||
          saved.priority !== currentPriority ||
          saved.decision !== selectedDecision ||
          saved.verifiedAt !== verifiedAt
        ) {
          throw new Error("Konfirmasi penyimpanan gagal.");
        }

        // Memperbarui status tampilan.
        updateStatusBadge(selectedDecision, verifiedAt);

        // Menampilkan waktu verifikasi.
        const feedbackMessage =
          `Verifikasi ${reportCode} berhasil disimpan. ` +
          `Prioritas: ${PRIORITY_LABELS[currentPriority]}. ` +
          `Waktu: ${formatWIT(verifiedAt)}.`;

        showFeedback(feedbackMessage, "success");

        // NOTIFIKASI KEBERHASILAN PENYIMPANAN.
        // Dipanggil hanya setelah data berhasil diverifikasi.
        showSaveNotification(
          `Verifikasi laporan ${reportCode} berhasil disimpan!`,
        );

        // Mengirim event pembaruan antarkomponen.
        window.dispatchEvent(
          new CustomEvent("sipfas:verification-saved", {
            detail: verification,
          }),
        );

        console.log("[SIPFAS] Verifikasi berhasil disimpan:", verification);
      } catch (error) {
        console.error("[SIPFAS] Gagal menyimpan verifikasi:", error);

        showFeedback(
          "Gagal menyimpan hasil verifikasi. Periksa Local Storage browser.",
          "error",
        );
      }
    }

    // ====================================================
    // 29. MEMULIHKAN NILAI SELECT
    // ====================================================

    function restoreSelectValue(select, value, normalizer) {
      if (!select || !value) return;

      const target = normalizer(value);

      const matchingOption = Array.from(select.options).find((option) => {
        return normalizer(option.value || option.textContent) === target;
      });

      if (matchingOption) {
        select.value = matchingOption.value;
      }
    }

    // ====================================================
    // 30. MEMUAT VERIFIKASI SEBELUMNYA
    // ====================================================

    function loadVerification() {
      const reportCode = getCurrentReportCode();

      if (!reportCode) return;

      const allData = readStorage(STORAGE_KEY);

      if (allData === null) {
        showFeedback("Data verifikasi sebelumnya tidak dapat dibaca.", "error");

        return;
      }

      const saved = allData[reportCode];

      // Belum pernah diverifikasi.
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

      // Memulihkan X1 dan X2.
      restoreSelectValue(
        damageSelect,
        saved.x1 || saved.damage,
        normalizeDamage,
      );

      restoreSelectValue(
        impactSelect,
        saved.x2 || saved.impact,
        normalizeImpact,
      );

      // Memulihkan prioritas.
      const savedPriority = normalizePriority(
        saved.priority || saved.priorityLabel,
      );

      if (savedPriority) {
        updatePriorityDisplay(savedPriority);
      }

      // Memulihkan catatan.
      verifierNotes.value = saved.notes || "";

      // Memulihkan keputusan.
      const savedDecision = normalizeDecision(
        saved.decision || saved.decisionLabel,
      );

      updateDecision(savedDecision);

      updateStatusBadge(savedDecision || "pending", saved.verifiedAt);

      // Memulihkan parameter hasil perhitungan.
      const savedParameters = {
        x1: normalizeDamage(saved.x1 || saved.damage),
        x2: normalizeImpact(saved.x2 || saved.impact),
        x3: normalizeText(saved.x3 || saved.frequency),
      };

      // Mengunci keadaan awal agar tidak dianggap perubahan baru.
      lastCalculatedParameters = validateParameters(savedParameters)
        ? null
        : savedParameters;

      hasRecalculated = false;
      parametersChanged = false;

      showFeedback(
        saved.verifiedAt
          ? "Data verifikasi sebelumnya berhasil dimuat. Waktu verifikasi: " +
              formatWIT(saved.verifiedAt)
          : "Data verifikasi sebelumnya berhasil dimuat.",
        "success",
      );

      console.log("[SIPFAS] Data verifikasi dimuat:", saved);
    }

    // ====================================================
    // 31. EVENT PILIHAN KEPUTUSAN
    // ====================================================

    decisionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const decision = normalizeDecision(button.dataset.decision);

        if (!["valid", "invalid"].includes(decision)) {
          return;
        }

        updateDecision(decision);

        showFeedback("", "");
      });
    });

    // ====================================================
    // 32. EVENT HITUNG ULANG
    // ====================================================

    recalculateButton.addEventListener("click", (event) => {
      event.preventDefault();

      recalculatePriority();
    });

    // ====================================================
    // 33. EVENT PERUBAHAN PARAMETER
    // ====================================================

    [damageSelect, impactSelect].forEach((select) => {
      select.addEventListener("change", () => {
        hasRecalculated = false;
        parametersChanged = true;

        showFeedback(
          "Parameter berubah. Klik Hitung Ulang Prioritas sebelum menyimpan.",
          "info",
        );
      });
    });

    // ====================================================
    // 34. EVENT SIMPAN VERIFIKASI
    // ====================================================

    saveButton.addEventListener("click", (event) => {
      event.preventDefault();

      saveVerification();
    });

    // ====================================================
    // 35. SINKRONISASI LOCAL STORAGE
    // ====================================================

    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        loadVerification();
      }
    });

    // ====================================================
    // 36. EVENT PEMBARUAN VERIFIKASI
    // ====================================================

    window.addEventListener("sipfas:verification-saved", (event) => {
      if (event.detail?.reportCode === getCurrentReportCode()) {
        updateStatusBadge(event.detail.decision, event.detail.verifiedAt);
      }
    });

    // ====================================================
    // 37. SIDEBAR RESPONSIF
    // ====================================================

    const sidebar = $("sidebar");
    const menuToggle = $("menuToggle");
    const overlay = $("pageOverlay");

    function setSidebar(open) {
      if (!sidebar) return;

      sidebar.classList.toggle("open", open);

      overlay?.classList.toggle("show", open);

      menuToggle?.setAttribute("aria-expanded", String(open));
    }

    menuToggle?.addEventListener("click", () => {
      setSidebar(!sidebar.classList.contains("open"));
    });

    overlay?.addEventListener("click", () => setSidebar(false));

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => setSidebar(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setSidebar(false);
      }
    });

    // ====================================================
    // 38. KONFIRMASI KELUAR
    // ====================================================

    const logoutLink = $("logoutLink");

    logoutLink?.addEventListener("click", (event) => {
      event.preventDefault();

      const confirmation = window.confirm(
        "Apakah Anda yakin ingin keluar dari sistem SIPFAS?",
      );

      if (!confirmation) return;

      sessionStorage.clear();

      window.location.href = logoutLink.href;
    });

    // ====================================================
    // 39. INISIALISASI DATA
    // ====================================================

    currentReport = loadSelectedReport();

    if (!currentReport) {
      console.error(
        "[SIPFAS] Inisialisasi dibatalkan karena identitas laporan tidak valid.",
      );

      return;
    }

    // Menampilkan informasi laporan.
    displayReportInformation(currentReport);

    // Memuat hasil verifikasi sebelumnya.
    loadVerification();

    console.log("[SIPFAS] Detail Verifikasi berhasil diinisialisasi:", {
      reportCode: getCurrentReportCode(),
      report: currentReport,
      timeZone: TIME_ZONE,
    });
  }
})();
