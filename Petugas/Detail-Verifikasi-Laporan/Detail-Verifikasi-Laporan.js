//DETAIL-VERIFIKASI.JS

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    // ====================================================
    // 01. KONFIGURASI ENDPOINT API & KONSTANTA
    // ====================================================

    const API = {
      detail: "../../api/petugas/detail-verifikasi.php",
      save: "../../api/petugas/simpan-verifikasi.php",
      logout: "../../api/auth/logout.php",
    };

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
      console.error("[SIPFAS] Elemen HTML verifikasi tidak lengkap.");
      return;
    }

    // ====================================================
    // 03. STATE PROGRAM
    // ====================================================

    let currentReportCode = "";
    let currentPriority = "";
    let selectedDecision = "";

    let hasRecalculated = false;
    let parametersChanged = false;
    let lastCalculatedParameters = null;

    // ====================================================
    // 04. NORMALISASI DATA & SKEMA DB (TINYINT <-> LABEL)
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

    function firstValue(object, keys, fallback = "") {
      for (const key of keys) {
        const value = object?.[key];
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

    function normalizeDamage(value) {
      const n = Number(value);
      if (n === 3) return "berat";
      if (n === 2) return "sedang";
      if (n === 1) return "ringan";
      const text = normalizeText(value);
      if (text.includes("berat")) return "berat";
      if (text.includes("sedang")) return "sedang";
      if (text.includes("ringan")) return "ringan";
      return "";
    }

    function normalizeImpact(value) {
      const n = Number(value);
      if (n === 3) return "tinggi";
      if (n === 2) return "sedang";
      if (n === 1) return "rendah";
      const text = normalizeText(value);
      if (text.includes("tinggi")) return "tinggi";
      if (text.includes("sedang")) return "sedang";
      if (text.includes("rendah")) return "rendah";
      return "";
    }

    function normalizeFrequency(value) {
      const n = Number(value);
      if (!Number.isNaN(n) && n > 0) {
        if (n >= 5) return "sering";
        if (n >= 3) return "kadang";
        return "jarang";
      }
      const text = normalizeText(value);
      if (text.includes("sering")) return "sering";
      if (text.includes("kadang")) return "kadang";
      if (text.includes("jarang")) return "jarang";
      return "";
    }

    function normalizePriority(value) {
      const text = normalizeText(value);
      if (text.includes("tinggi")) return "tinggi";
      if (text.includes("sedang")) return "sedang";
      if (text.includes("rendah")) return "rendah";
      return "";
    }

    function normalizeDecision(value) {
      const text = normalizeText(value);
      if (text === "valid" || text === "laporan valid") return "valid";
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
    // 05. FORMAT WAKTU WIT & FEEDBACK UI
    // ====================================================

    function parseTimestamp(value) {
      if (!value) return null;
      const date =
        value instanceof Date ? value : new Date(String(value).replace(" ", "T"));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatWIT(value, includeSeconds = true) {
      const date = parseTimestamp(value);
      if (!date) return "Belum tersedia";
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

    function showFeedback(message, type = "") {
      if (!saveFeedback) return;
      saveFeedback.textContent = message;
      saveFeedback.dataset.state = type;
    }

    function showSaveNotification(message) {
      const notificationId = "sipfasSaveNotification";
      const styleId = "sipfasSaveNotificationStyle";

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
        `;
        document.head.appendChild(style);
      }

      let notification = document.getElementById(notificationId);
      if (!notification) {
        notification = document.createElement("div");
        notification.id = notificationId;
        notification.setAttribute("role", "status");
        notification.setAttribute("aria-live", "polite");

        const icon = document.createElement("span");
        icon.className = "sipfas-notification-icon";
        icon.textContent = "✓";

        const text = document.createElement("span");
        text.className = "sipfas-notification-message";

        notification.append(icon, text);
        document.body.appendChild(notification);
      }

      const messageElement = notification.querySelector(
        ".sipfas-notification-message",
      );
      if (messageElement) messageElement.textContent = message;

      notification.classList.remove("show");
      void notification.offsetWidth;
      notification.classList.add("show");

      window.clearTimeout(notification.dismissTimer);
      notification.dismissTimer = window.setTimeout(() => {
        notification.classList.remove("show");
      }, 4500);
    }

    function setText(id, value, allowEmpty = false) {
      const element = $(id);
      if (!element || value === undefined || value === null) return;
      const text = String(value).trim();
      if (text || allowEmpty) element.textContent = text;
    }

    // ====================================================
    // 06. PARAMETER, KLASIFIKASI & STATUS UI
    // ====================================================

    function getX3Value() {
      return normalizeFrequency(lockedValue ? lockedValue.textContent : "");
    }

    function getCurrentParameters() {
      return {
        x1: normalizeDamage(damageSelect.value),
        x2: normalizeImpact(impactSelect.value),
        x3: getX3Value(),
      };
    }

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

    function classifyPriority(x1, x2, x3) {
      if (x1 === "berat") return "tinggi";
      if (x1 === "sedang") {
        if (x2 === "tinggi") return "tinggi";
        if (x2 === "sedang") {
          if (x3 === "sering") return "tinggi";
          if (x3 === "kadang") return "sedang";
          return "rendah";
        }
        return x3 === "sering" ? "sedang" : "rendah";
      }
      if (x2 === "tinggi" && x3 === "sering") return "sedang";
      return "rendah";
    }

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
      updatePriorityDisplay(result);

      hasRecalculated = true;
      parametersChanged = false;
      lastCalculatedParameters = { ...parameters };

      showFeedback(
        `Prioritas berhasil dihitung: ${result.toUpperCase()}.`,
        "success",
      );
    }

    function updateDecisionNotice(decision) {
      if (!decisionNotice) return;
      const title = decisionNotice.querySelector("strong span");
      const description = decisionNotice.querySelector("p");

      decisionNotice.classList.remove("valid", "invalid");

      if (decision === "valid") {
        decisionNotice.classList.add("valid");
        if (title) title.textContent = "Laporan Memenuhi Syarat";
        if (description) {
          description.textContent =
            "Laporan diverifikasi valid dan akan diteruskan ke daftar antrean Penanganan Fasilitas.";
        }
      } else if (decision === "invalid") {
        decisionNotice.classList.add("invalid");
        if (title) title.textContent = "Laporan Tidak Memenuhi Syarat";
        if (description) {
          description.textContent =
            "Laporan dinyatakan tidak valid dan tidak diteruskan ke daftar antrean Penanganan Fasilitas.";
        }
      } else {
        if (title) title.textContent = "Menunggu Keputusan Verifikasi";
        if (description) {
          description.textContent =
            "Silakan pilih keputusan valid atau tidak valid untuk laporan ini.";
        }
      }
    }

    function updateDecision(decision) {
      selectedDecision = normalizeDecision(decision);
      decisionButtons.forEach((button) => {
        const isSelected = button.dataset.decision === selectedDecision;
        button.classList.toggle("selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
      });
      updateDecisionNotice(selectedDecision);
    }

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

    function restoreSelectValue(select, value, normalizer) {
      if (!select || value === undefined || value === null || value === "") return;
      const target = normalizer(value);
      const matchingOption = Array.from(select.options).find(
        (option) => normalizer(option.value || option.textContent) === target,
      );
      if (matchingOption) select.value = matchingOption.value;
    }

    // ====================================================
    // 07. MEMUAT LAPORAN & VERIFIKASI DARI detail-verifikasi.php
    // ====================================================

    async function loadVerificationFromDB() {
      const params = new URLSearchParams(window.location.search);
      const code = normalizeReportCode(
        params.get("kode") || reportCodeElement.textContent,
      );

      if (!code) {
        showFeedback(
          "Kode laporan tidak ditemukan. Silakan pilih laporan dari daftar.",
          "error",
        );
        return;
      }

      currentReportCode = code;
      setText("reportCode", code);
      setText("pageCode", code);

      try {
        const url = new URL(API.detail, window.location.href);
        url.searchParams.set("kode", code);

        const response = await fetch(url.href, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const payload = await response.json();

        if (!response.ok || payload?.success === false) {
          throw new Error(
            payload?.message || "Gagal memuat detail verifikasi dari database.",
          );
        }

        const data = payload?.data || payload?.laporan || payload;
        const verif = payload?.verifikasi || data?.verifikasi || data;

        const reporterName = firstValue(data, [
          "nama_pelapor",
          "nama_lengkap",
          "reporterName",
        ]);
        const reporterNim = firstValue(data, [
          "nomor_identitas",
          "nim",
          "reporterNim",
        ]);

        setText("reportName", reporterName);
        setText("reportNim", reporterNim, true);
        setText(
          "reportFacility",
          firstValue(data, ["nama_fasilitas", "facilityName", "facility"]),
        );
        setText(
          "reportLocation",
          firstValue(data, ["lokasi_ruangan", "facilityLocation", "location"]),
        );
        setText(
          "reportDescription",
          firstValue(data, ["deskripsi_kerusakan", "deskripsi", "description"]),
        );

        const reportDate = firstValue(data, [
          "tanggal_dibuat",
          "tanggal_laporan",
          "waktu_lapor",
          "created_at",
        ]);
        setText("reportTime", reportDate ? formatDateWIT(reportDate) : "—");

        const datePill = query(".date-pill");
        if (datePill && reportDate) {
          datePill.textContent = `◷ ${formatDateWIT(reportDate)}`;
        }

        const initials = $("reportInitials");
        if (initials && reporterName) {
          initials.textContent = reporterName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w.charAt(0).toUpperCase())
            .join("");
        }

        // Pulihkan X3 dari frekuensi_penggunaan fasilitas / x3_digunakan
        const x3Raw = firstValue(verif, [
          "x3_digunakan",
          "frekuensi_penggunaan",
          "frekuensi_penggunaan_x3",
          "x3",
        ]);
        const x3Normalized = normalizeFrequency(x3Raw);
        const x3LabelMap = {
          sering: "Sering (5-7x/minggu)",
          kadang: "Kadang (3-4x/minggu)",
          jarang: "Jarang (1-2x/minggu)",
        };
        if (lockedValue && x3Normalized) {
          lockedValue.textContent = x3LabelMap[x3Normalized];
        }

        // Pulihkan X1 & X2
        restoreSelectValue(
          damageSelect,
          firstValue(verif, ["x1_sesudah", "x1_sebelum", "tingkat_kerusakan_x1", "x1"]),
          normalizeDamage,
        );
        restoreSelectValue(
          impactSelect,
          firstValue(verif, ["x2_sesudah", "x2_sebelum", "dampak_akademik_x2", "x2"]),
          normalizeImpact,
        );

        // Pulihkan Prioritas
        const savedPriority = normalizePriority(
          firstValue(verif, [
            "prioritas_sesudah",
            "prioritas_sebelum",
            "prioritas",
            "label_prioritas",
            "priority",
          ]),
        );
        if (savedPriority) {
          updatePriorityDisplay(savedPriority);
        } else {
          currentPriority = "";
          priorityResult.textContent = "BELUM DIHITUNG";
          priorityResult.classList.remove(
            "priority-high",
            "priority-medium",
            "priority-low",
          );
        }

        verifierNotes.value = firstValue(verif, [
          "catatan_verifikasi",
          "notes",
        ]);

        const savedDecision = normalizeDecision(
          firstValue(verif, ["hasil_verifikasi", "decision"]),
        );
        const verifiedAt = firstValue(verif, ["waktu_verifikasi", "verifiedAt"], null);

        updateDecision(savedDecision);
        updateStatusBadge(savedDecision || "pending", verifiedAt);

        const initialParams = getCurrentParameters();
        lastCalculatedParameters = validateParameters(initialParams)
          ? null
          : initialParams;
        hasRecalculated = false;
        parametersChanged = false;

        if (verifiedAt) {
          showFeedback(
            `Data verifikasi berhasil dimuat. Waktu verifikasi: ${formatWIT(verifiedAt)}`,
            "success",
          );
        }
      } catch (error) {
        console.error("[SIPFAS] Gagal memuat verifikasi:", error);
        showFeedback(error.message, "error");
      }
    }

    // ====================================================
    // 08. SIMPAN VERIFIKASI KE simpan-verifikasi.php
    // ====================================================

    async function saveVerificationToDB() {
      if (!["valid", "invalid"].includes(selectedDecision)) {
        showFeedback(
          "Silakan pilih Laporan Valid atau Laporan Tidak Valid terlebih dahulu.",
          "error",
        );
        return;
      }

      if (!currentReportCode) {
        showFeedback("Kode laporan tidak ditemukan.", "error");
        return;
      }

      const parameters = getCurrentParameters();
      const validationError = validateParameters(parameters);
      if (validationError) {
        showFeedback(validationError, "error");
        return;
      }

      if (parametersChanged && !hasRecalculated) {
        showFeedback(
          "Parameter berubah. Klik Hitung Ulang Prioritas sebelum menyimpan.",
          "error",
        );
        return;
      }

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

      if (
        !Object.prototype.hasOwnProperty.call(PRIORITY_LABELS, currentPriority)
      ) {
        showFeedback("Prioritas belum dihitung atau belum tersedia.", "error");
        return;
      }

      const mapX1ToInt = { ringan: 1, sedang: 2, berat: 3 };
      const mapX2ToInt = { rendah: 1, sedang: 2, tinggi: 3 };
      const mapX3ToInt = { jarang: 1, kadang: 4, sering: 7 };

      saveButton.disabled = true;

      try {
        const url = new URL(API.save, window.location.href);
        const response = await fetch(url.href, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            kode_laporan: currentReportCode,
            reportCode: currentReportCode,
            x1: parameters.x1,
            x2: parameters.x2,
            x3: parameters.x3,
            x1_sesudah: mapX1ToInt[parameters.x1],
            x2_sesudah: mapX2ToInt[parameters.x2],
            x3_digunakan: mapX3ToInt[parameters.x3],
            prioritas_sesudah:
              currentPriority.charAt(0).toUpperCase() + currentPriority.slice(1),
            priority: currentPriority,
            hasil_verifikasi:
              selectedDecision === "valid" ? "Valid" : "Tidak Valid",
            decision: selectedDecision,
            decisionLabel: DECISION_LABELS[selectedDecision],
            catatan_verifikasi: verifierNotes.value.trim(),
            notes: verifierNotes.value.trim(),
          }),
        });

        const payload = await response.json();
        if (!response.ok || payload?.success === false) {
          throw new Error(
            payload?.message || "Gagal menyimpan hasil verifikasi ke database.",
          );
        }

        const saved = payload?.data || payload;
        const verifiedAt = firstValue(
          saved,
          ["waktu_verifikasi", "verifiedAt"],
          new Date().toISOString(),
        );

        updateStatusBadge(selectedDecision, verifiedAt);

        showFeedback(
          `Verifikasi ${currentReportCode} berhasil disimpan. Prioritas: ${PRIORITY_LABELS[currentPriority]}. Waktu: ${formatWIT(verifiedAt)}.`,
          "success",
        );

        showSaveNotification(
          `Verifikasi laporan ${currentReportCode} berhasil disimpan!`,
        );

        window.dispatchEvent(
          new CustomEvent("sipfas:verification-saved", {
            detail: {
              reportCode: currentReportCode,
              decision: selectedDecision,
              verifiedAt,
            },
          }),
        );
      } catch (error) {
        console.error("[SIPFAS] Gagal menyimpan verifikasi:", error);
        showFeedback(
          error.message || "Gagal menyimpan hasil verifikasi ke database.",
          "error",
        );
      } finally {
        saveButton.disabled = false;
      }
    }

    // ====================================================
    // 09. EVENT LISTENERS & SIDEBAR
    // ====================================================

    decisionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const decision = normalizeDecision(button.dataset.decision);
        if (["valid", "invalid"].includes(decision)) {
          updateDecision(decision);
          showFeedback("", "");
        }
      });
    });

    recalculateButton.addEventListener("click", (event) => {
      event.preventDefault();
      recalculatePriority();
    });

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

    saveButton.addEventListener("click", (event) => {
      event.preventDefault();
      saveVerificationToDB();
    });

    const sidebar = $("sidebar");
    const menuToggle = $("menuToggle");
    const overlay = $("pageOverlay");

    function setSidebar(open) {
      if (!sidebar) return;
      sidebar.classList.toggle("open", open);
      overlay?.classList.toggle("show", open);
      menuToggle?.setAttribute("aria-expanded", String(open));
    }

    menuToggle?.addEventListener("click", () =>
      setSidebar(!sidebar.classList.contains("open")),
    );
    overlay?.addEventListener("click", () => setSidebar(false));
    document
      .querySelectorAll(".nav-link")
      .forEach((link) => link.addEventListener("click", () => setSidebar(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setSidebar(false);
    });

    const logoutLink = $("logoutLink");
    logoutLink?.addEventListener("click", async (event) => {
      event.preventDefault();
      if (
        !window.confirm("Apakah Anda yakin ingin keluar dari sistem SIPFAS?")
      ) {
        return;
      }
      try {
        await fetch(new URL(API.logout, window.location.href).href, {
          method: "POST",
          credentials: "same-origin",
        });
      } finally {
        window.location.href = logoutLink.href;
      }
    });

    loadVerificationFromDB();
  }
})();