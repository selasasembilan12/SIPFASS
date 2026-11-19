
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    const API = {
      detail: "../../api/petugas/detail-verifikasi.php",
      save: "../../api/petugas/simpan-verifikasi.php",
      logout: "../../api/auth/logout.php"
    };

    const LOGIN_URL = "../../auth/Login.html";
    const TIME_ZONE = "Asia/Jayapura";

    const $ = (id) => document.getElementById(id);
    const query = (selector) => document.querySelector(selector);

    const reportCodeElement = $("reportCode");
    const damageSelect = $("damage");
    const impactSelect = $("impact");
    const lockedValue = query(".locked-value");
    const priorityResult = $("priorityResult");
    const recalculateButton = $("recalculate");
    const decisionButtons = Array.from(
      document.querySelectorAll(".decision-option")
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

    let currentReportCode = "";
    let currentPriority = "";
    let selectedDecision = "";
    let originalReport = null;

    let hasRecalculated = false;
    let parametersChanged = false;
    let lastCalculatedParameters = null;
    let alreadyVerified = false;
    let saving = false;

    // Menormalkan teks dari database dan input pengguna.
    function normalizeText(value) {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    // Mengambil nilai pertama yang tersedia.
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

    // Menormalkan kode laporan.
    function normalizeReportCode(value) {
      return String(value ?? "")
        .replace(/\s+/g, "")
        .trim()
        .toUpperCase();
    }

    // Mengubah nilai numerik X1 menjadi kategori kerusakan.
    function normalizeDamage(value) {
      const number = Number(value);

      if (number === 3) return "berat";
      if (number === 2) return "sedang";
      if (number === 1) return "ringan";

      const text = normalizeText(value);

      if (text.includes("berat")) return "berat";
      if (text.includes("sedang")) return "sedang";
      if (text.includes("ringan")) return "ringan";

      return "";
    }

    // Mengubah nilai numerik X2 menjadi kategori dampak.
    function normalizeImpact(value) {
      const number = Number(value);

      if (number === 3) return "tinggi";
      if (number === 2) return "sedang";
      if (number === 1) return "rendah";

      const text = normalizeText(value);

      if (text.includes("tinggi")) return "tinggi";
      if (text.includes("sedang")) return "sedang";
      if (text.includes("rendah")) return "rendah";

      return "";
    }

    // Mengubah frekuensi penggunaan menjadi kategori X3.
    function normalizeFrequency(value) {
      const number = Number(value);

      if (Number.isFinite(number) && number > 0) {
        if (number >= 5) return "sering";
        if (number >= 3) return "kadang";
        return "jarang";
      }

      const text = normalizeText(value);

      if (text.includes("sering")) return "sering";
      if (text.includes("kadang")) return "kadang";
      if (text.includes("jarang")) return "jarang";

      return "";
    }

    // Mengubah label prioritas menjadi format standar.
    function normalizePriority(value) {
      const text = normalizeText(value);

      if (text.includes("tinggi")) return "tinggi";
      if (text.includes("sedang")) return "sedang";
      if (text.includes("rendah")) return "rendah";

      return "";
    }

    // Mengubah keputusan verifikasi menjadi format standar.
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

    // Mengubah nilai tanggal menjadi objek Date.
    function parseTimestamp(value) {
      if (!value) return null;

      const date = value instanceof Date
        ? value
        : new Date(String(value).replace(" ", "T"));

      return Number.isNaN(date.getTime()) ? null : date;
    }

    // Menampilkan tanggal dan waktu sesuai zona WIT.
    function formatWIT(value, includeSeconds = true) {
      const date = parseTimestamp(value);

      if (!date) return "Belum tersedia";

      return new Intl.DateTimeFormat("id-ID", {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: includeSeconds ? "2-digit" : undefined,
        hour12: false
      }).format(date) + " WIT";
    }

    // Menampilkan tanggal laporan.
    function formatDateWIT(value) {
      const date = parseTimestamp(value);

      if (!date) return String(value || "—");

      return new Intl.DateTimeFormat("id-ID", {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(date);
    }

    // Menampilkan pesan hasil proses.
    function showFeedback(message, type = "") {
      if (!saveFeedback) return;

      saveFeedback.textContent = message;
      saveFeedback.dataset.state = type;
    }

    // Menampilkan notifikasi ketika penyimpanan berhasil.
    function showSaveNotification(message) {
      const notificationId = "sipfasSaveNotification";
      const styleId = "sipfasSaveNotificationStyle";

      if (!$(styleId)) {
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
            box-shadow: 0 8px 28px rgba(0,0,0,.14);
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
            flex: 0 0 22px;
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

      let notification = $(notificationId);

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
        ".sipfas-notification-message"
      );

      if (messageElement) {
        messageElement.textContent = message;
      }

      notification.classList.remove("show");
      void notification.offsetWidth;
      notification.classList.add("show");

      clearTimeout(notification.dismissTimer);

      notification.dismissTimer = setTimeout(() => {
        notification.classList.remove("show");
      }, 4500);
    }

    // Memperbarui teks elemen HTML.
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

    // Mengambil nilai parameter X3 yang dikunci.
    function getX3Value() {
      return normalizeFrequency(
        lockedValue ? lockedValue.textContent : ""
      );
    }

    // Mengambil seluruh parameter verifikasi.
    function getCurrentParameters() {
      return {
        x1: normalizeDamage(damageSelect.value),
        x2: normalizeImpact(impactSelect.value),
        x3: getX3Value()
      };
    }

    // Memastikan seluruh parameter tersedia.
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

    // Mempertahankan aturan klasifikasi yang digunakan program asli.
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

      if (x2 === "tinggi" && x3 === "sering") {
        return "sedang";
      }

      return "rendah";
    }

    // Menampilkan hasil prioritas.
    function updatePriorityDisplay(priority) {
      const normalized = normalizePriority(priority);

      if (!normalized) return false;

      currentPriority = normalized;

      const labels = {
        tinggi: "TINGGI",
        sedang: "SEDANG",
        rendah: "RENDAH"
      };

      const classes = {
        tinggi: "priority-high",
        sedang: "priority-medium",
        rendah: "priority-low"
      };

      priorityResult.textContent = labels[normalized];

      priorityResult.classList.remove(
        "priority-high",
        "priority-medium",
        "priority-low"
      );

      priorityResult.classList.add(classes[normalized]);

      return true;
    }

    // Menghitung ulang prioritas berdasarkan parameter.
    function recalculatePriority() {
      const parameters = getCurrentParameters();
      const error = validateParameters(parameters);

      if (error) {
        showFeedback(error, "error");
        return;
      }

      const result = classifyPriority(
        parameters.x1,
        parameters.x2,
        parameters.x3
      );

      updatePriorityDisplay(result);

      hasRecalculated = true;
      parametersChanged = false;
      lastCalculatedParameters = { ...parameters };

      showFeedback(
        `Prioritas berhasil dihitung: ${result.toUpperCase()}.`,
        "success"
      );
    }

    // Mengatur tampilan informasi keputusan.
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

    // Mengatur pilihan keputusan petugas.
    function updateDecision(decision) {
      selectedDecision = normalizeDecision(decision);

      decisionButtons.forEach((button) => {
        const selected =
          button.dataset.decision === selectedDecision;

        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });

      updateDecisionNotice(selectedDecision);
    }

    // Mengatur badge status laporan.
    function updateStatusBadge(decision, verifiedAt = null) {
      if (!statusPill) return;

      const labels = {
        valid: "TERVERIFIKASI",
        invalid: "TIDAK VALID",
        pending: "MENUNGGU VERIFIKASI"
      };

      const label = labels[decision] || labels.pending;

      statusPill.textContent = `● ${label}`;
      statusPill.dataset.reportStatus = decision || "pending";
      statusPill.setAttribute("aria-label", label);

      if (verifiedAt) {
        statusPill.title =
          "Waktu verifikasi: " + formatWIT(verifiedAt);
      } else {
        statusPill.removeAttribute("title");
      }
    }

    // Mengembalikan nilai select berdasarkan data database.
    function restoreSelectValue(select, value, normalizer) {
      if (
        !select ||
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return false;
      }

      const target = normalizer(value);

      const option = Array.from(select.options).find(
        (item) =>
          normalizer(item.value || item.textContent) === target
      );

      if (!option) return false;

      select.value = option.value;
      return true;
    }

    // Mengambil detail laporan dari API.
    async function loadVerificationFromDB() {
      const params = new URLSearchParams(window.location.search);

      const code = normalizeReportCode(
        params.get("kode") || reportCodeElement.textContent
      );

      if (!code) {
        showFeedback(
          "Kode laporan tidak ditemukan. Silakan pilih laporan dari daftar.",
          "error"
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
          cache: "no-store",
          headers: {
            Accept: "application/json"
          }
        });

        const payload = await response.json();

        if (response.status === 401) {
          window.location.replace(LOGIN_URL);
          return;
        }

        if (!response.ok || payload?.success !== true) {
          throw new Error(
            payload?.message ||
            "Gagal memuat detail verifikasi dari database."
          );
        }

        const data = payload.data || payload.laporan || payload;

        if (!data || typeof data !== "object") {
          throw new Error("Data laporan tidak tersedia.");
        }

        originalReport = data;

        // Mengambil identitas pelapor.
        const reporterName = firstValue(data, [
          "nama_pelapor",
          "nama_lengkap",
          "reporterName"
        ], "Tidak diketahui");

        const reporterNim = firstValue(data, [
          "nomor_identitas",
          "nim",
          "reporterNim"
        ]);

        setText("reportName", reporterName);
        setText("reportNim", reporterNim, true);

        // Mengambil identitas fasilitas dan lokasi.
        setText(
          "reportFacility",
          firstValue(data, [
            "nama_fasilitas",
            "facilityName",
            "facility"
          ], "—")
        );

        setText(
          "reportLocation",
          firstValue(data, [
            "lokasi_ruangan",
            "nama_lokasi",
            "facilityLocation",
            "location"
          ], "—")
        );

        setText(
          "reportDescription",
          firstValue(data, [
            "deskripsi_kerusakan",
            "deskripsi",
            "description"
          ], "—")
        );

        // Mengambil tanggal pembuatan laporan.
        const reportDate = firstValue(data, [
          "tanggal_dibuat",
          "tanggal_laporan",
          "waktu_lapor",
          "created_at"
        ]);

        setText(
          "reportTime",
          reportDate ? formatDateWIT(reportDate) : "—"
        );

        const datePill = query(".date-pill");

        if (datePill && reportDate) {
          datePill.textContent =
            `◷ ${formatDateWIT(reportDate)}`;
        }

        // Membuat inisial pelapor.
        const initials = $("reportInitials");

        if (initials && reporterName) {
          initials.textContent = reporterName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((word) => word.charAt(0).toUpperCase())
            .join("");
        }

        // Mengambil data verifikasi terakhir jika tersedia.
        const hasHistory =
          data.id_riwayat_verifikasi !== null &&
          data.id_riwayat_verifikasi !== undefined;

        const x1Source = hasHistory
          ? firstValue(data, [
              "x1_sesudah",
              "x1_sebelum"
            ])
          : firstValue(data, [
              "tingkat_kerusakan_x1_terverifikasi",
              "tingkat_kerusakan_x1"
            ]);

        const x2Source = hasHistory
          ? firstValue(data, [
              "x2_sesudah",
              "x2_sebelum"
            ])
          : firstValue(data, [
              "dampak_akademik_x2_terverifikasi",
              "dampak_akademik_x2"
            ]);

        // X3 berasal dari laporan utama, atau riwayat verifikasi terakhir.
        const x3Source = hasHistory
          ? firstValue(data, [
              "x3_digunakan"
            ])
          : firstValue(data, [
              "frekuensi_penggunaan_x3"
            ]);

        const x3Normalized = normalizeFrequency(x3Source);

        const x3Labels = {
          sering: "Sering (5-7x/minggu)",
          kadang: "Kadang (3-4x/minggu)",
          jarang: "Jarang (1-2x/minggu)"
        };

        if (lockedValue && x3Normalized) {
          lockedValue.textContent = x3Labels[x3Normalized];
        }

        // Memulihkan nilai X1 dari database.
        restoreSelectValue(
          damageSelect,
          x1Source,
          normalizeDamage
        );

        // Memulihkan nilai X2 dari database.
        restoreSelectValue(
          impactSelect,
          x2Source,
          normalizeImpact
        );

        // Mengambil prioritas dari data laporan atau riwayat.
        const savedPriority = normalizePriority(
          firstValue(data, hasHistory
            ? ["prioritas_sesudah", "prioritas_sebelum"]
            : ["prioritas_prediksi", "prioritas_awal"])
        );

        if (savedPriority) {
          updatePriorityDisplay(savedPriority);
        } else {
          currentPriority = "";
          priorityResult.textContent = "BELUM DIHITUNG";

          priorityResult.classList.remove(
            "priority-high",
            "priority-medium",
            "priority-low"
          );
        }

        // Memulihkan catatan verifikasi sebelumnya.
        verifierNotes.value = hasHistory
          ? String(data.catatan_verifikasi || "")
          : "";

        // Memulihkan keputusan verifikasi sebelumnya.
        const savedDecision = hasHistory
          ? normalizeDecision(data.hasil_verifikasi)
          : "";

        const verifiedAt = hasHistory
          ? data.waktu_verifikasi
          : null;

        alreadyVerified = hasHistory || savedDecision !== "";

        updateDecision(savedDecision);

        updateStatusBadge(
          savedDecision || "pending",
          verifiedAt
        );

        // Mengunci input apabila laporan sudah diverifikasi.
        damageSelect.disabled = alreadyVerified;
        impactSelect.disabled = alreadyVerified;
        verifierNotes.disabled = alreadyVerified;
        recalculateButton.disabled = alreadyVerified;

        decisionButtons.forEach((button) => {
          button.disabled = alreadyVerified;
        });

        saveButton.disabled = alreadyVerified;

        // Menginisialisasi status perhitungan.
        const initialParameters = getCurrentParameters();

        lastCalculatedParameters =
          validateParameters(initialParameters)
            ? null
            : initialParameters;

        hasRecalculated = false;
        parametersChanged = false;

        if (alreadyVerified) {
          showFeedback(
            `Laporan sudah diverifikasi pada ${formatWIT(verifiedAt)}.`,
            "info"
          );
        } else {
          showFeedback(
            "Detail laporan berhasil dimuat. Silakan lakukan pemeriksaan.",
            "success"
          );
        }

      } catch (error) {
        console.error(
          "[SIPFAS] Gagal memuat detail verifikasi:",
          error
        );

        showFeedback(error.message, "error");
      }
    }

    // Memastikan perubahan parameter sudah dihitung ulang.
    function validateCalculation(parameters) {
      const error = validateParameters(parameters);

      if (error) return error;

      if (!hasRecalculated || !lastCalculatedParameters) {
        return "Klik Hitung Ulang Prioritas sebelum menyimpan.";
      }

      const changed =
        lastCalculatedParameters.x1 !== parameters.x1 ||
        lastCalculatedParameters.x2 !== parameters.x2 ||
        lastCalculatedParameters.x3 !== parameters.x3;

      if (changed || parametersChanged) {
        return "Parameter berubah. Hitung ulang prioritas sebelum menyimpan.";
      }

      return "";
    }

    // Menyimpan hasil verifikasi ke database.
    async function saveVerificationToDB() {
      if (saving || alreadyVerified) return;

      if (!["valid", "invalid"].includes(selectedDecision)) {
        showFeedback(
          "Silakan pilih Laporan Valid atau Laporan Tidak Valid terlebih dahulu.",
          "error"
        );
        return;
      }

      if (!currentReportCode) {
        showFeedback("Kode laporan tidak ditemukan.", "error");
        return;
      }

      const parameters = getCurrentParameters();

      const validationError =
        validateCalculation(parameters);

      if (validationError) {
        showFeedback(validationError, "error");
        return;
      }

      if (!currentPriority) {
        showFeedback(
          "Prioritas belum dihitung.",
          "error"
        );
        return;
      }

      const mapX1ToInt = {
        ringan: 1,
        sedang: 2,
        berat: 3
      };

      const mapX2ToInt = {
        rendah: 1,
        sedang: 2,
        tinggi: 3
      };

      const mapX3ToInt = {
        jarang: 1,
        kadang: 4,
        sering: 7
      };

      const priorityLabel =
        currentPriority.charAt(0).toUpperCase() +
        currentPriority.slice(1);

      const decisionLabel = selectedDecision === "valid"
        ? "Valid"
        : "Tidak Valid";

      const notes = verifierNotes.value.trim();

      saving = true;
      saveButton.disabled = true;

      try {
        const response = await fetch(
          new URL(API.save, window.location.href).href,
          {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
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

              prioritas_sesudah: priorityLabel,
              priority: currentPriority,

              hasil_verifikasi: decisionLabel,
              decision: selectedDecision,

              catatan_verifikasi: notes,
              notes: notes
            })
          }
        );

        const payload = await response.json();

        if (response.status === 401) {
          window.location.replace(LOGIN_URL);
          return;
        }

        if (!response.ok || payload?.success !== true) {
          throw new Error(
            payload?.message ||
            "Gagal menyimpan hasil verifikasi."
          );
        }

        const saved = payload.data || {};

        const verifiedAt = firstValue(
          saved,
          ["waktu_verifikasi", "verifiedAt"],
          new Date().toISOString()
        );

        alreadyVerified = true;

        // Mengunci seluruh input setelah penyimpanan berhasil.
        damageSelect.disabled = true;
        impactSelect.disabled = true;
        verifierNotes.disabled = true;
        recalculateButton.disabled = true;

        decisionButtons.forEach((button) => {
          button.disabled = true;
        });

        saveButton.disabled = true;

        updateStatusBadge(selectedDecision, verifiedAt);

        showFeedback(
          `Verifikasi ${currentReportCode} berhasil disimpan. Prioritas: ${priorityLabel}. Waktu: ${formatWIT(verifiedAt)}.`,
          "success"
        );

        showSaveNotification(
          `Verifikasi laporan ${currentReportCode} berhasil disimpan!`
        );

        // Memberitahukan halaman lain bahwa data telah diperbarui.
        window.dispatchEvent(
          new CustomEvent("sipfas:verification-saved", {
            detail: {
              reportCode: currentReportCode,
              decision: selectedDecision,
              verifiedAt
            }
          })
        );

      } catch (error) {
        console.error(
          "[SIPFAS] Gagal menyimpan verifikasi:",
          error
        );

        showFeedback(
          error.message ||
          "Gagal menyimpan hasil verifikasi ke database.",
          "error"
        );

        saveButton.disabled = false;

      } finally {
        saving = false;
      }
    }

    // Mengatur sidebar halaman.
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

    // Mengatur tombol keputusan.
    decisionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (alreadyVerified) return;

        const decision = normalizeDecision(
          button.dataset.decision
        );

        if (["valid", "invalid"].includes(decision)) {
          updateDecision(decision);
          showFeedback("", "");
        }
      });
    });

    // Mengatur tombol hitung ulang prioritas.
    recalculateButton.addEventListener("click", (event) => {
      event.preventDefault();

      if (alreadyVerified) return;

      recalculatePriority();
    });

    // Mendeteksi perubahan parameter.
    [damageSelect, impactSelect].forEach((select) => {
      select.addEventListener("change", () => {
        if (alreadyVerified) return;

        hasRecalculated = false;
        parametersChanged = true;

        showFeedback(
          "Parameter berubah. Klik Hitung Ulang Prioritas sebelum menyimpan.",
          "info"
        );
      });
    });

    // Menangani penyimpanan verifikasi.
    saveButton.addEventListener("click", (event) => {
      event.preventDefault();
      saveVerificationToDB();
    });

    // Mengatur navigasi sidebar.
    menuToggle?.addEventListener("click", () => {
      setSidebar(!sidebar.classList.contains("open"));
    });

    overlay?.addEventListener("click", () => {
      setSidebar(false);
    });

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        setSidebar(false);
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setSidebar(false);
      }
    });

    // Menangani logout melalui API.
    const logoutLink = $("logoutLink");

    logoutLink?.addEventListener("click", async (event) => {
      event.preventDefault();

      if (!window.confirm(
        "Apakah Anda yakin ingin keluar dari sistem SIPFAS?"
      )) {
        return;
      }

      try {
        const response = await fetch(
          new URL(API.logout, window.location.href).href,
          {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
              Accept: "application/json"
            }
          }
        );

        if (!response.ok) {
          throw new Error("Logout gagal.");
        }

      } catch (error) {
        console.error("[SIPFAS] Logout error:", error);

      } finally {
        window.location.replace(LOGIN_URL);
      }
    });

    // Memuat detail laporan ketika halaman dibuka.
    loadVerificationFromDB();
  }
})();
