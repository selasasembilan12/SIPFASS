/* ============================================================
   SIPFAS - DETAIL PENANGANAN.JS
   VERSI REVISI FINAL

   SISTEM WAKTU:
   - WIT Maluku Utara (UTC+09:00)
   - Penyimpanan waktu menggunakan ISO 8601 UTC
   - Tampilan waktu menggunakan WIT

   FITUR:
   1. Memuat identitas laporan.
   2. Membaca hasil verifikasi.
   3. Memuat data penanganan sebelumnya.
   4. Menyimpan tindak lanjut perbaikan.
   5. Menyimpan status penanganan.
   6. Menyimpan catatan petugas.
   7. Mencatat waktu mulai penanganan.
   8. Mencatat waktu pembaruan.
   9. Mencatat waktu penyelesaian.
   10. Menyimpan riwayat perubahan.
   11. Mempertahankan data laporan lainnya.
   12. Menampilkan notifikasi penyimpanan.
   13. Memulihkan data setelah refresh.
   14. Mengaktifkan tombol salin.
   15. Mengaktifkan tombol batal.
   16. Mengaktifkan sidebar dan logout.

   LOCAL STORAGE:
   - sipfas_penanganan_laporan
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

    const STORAGE = {
      handling: "sipfas_penanganan_laporan",
      verification: "sipfas_verifikasi_laporan",
      selected: "sipfas_selected_report",
    };

    // WIT Maluku Utara = UTC +09:00.
    const WIT_OFFSET_HOURS = 9;
    const WIT_OFFSET_MS = WIT_OFFSET_HOURS * 60 * 60 * 1000;

    // ====================================================
    // 02. ELEMEN HTML
    // ====================================================

    const $ = (id) => document.getElementById(id);

    const form = $("handlingForm");
    const followUpInput = $("followUp");
    const statusInput = $("handlingStatus");
    const notesInput = $("officerNotes");

    const updatedAtElement = $("updatedAt");
    const reportCodeElement = $("reportCode");
    const pageCodeElement = $("pageCode");
    const headerStatusElement = $("headerStatus");

    const saveButton = $("saveHandling");
    const cancelButton = $("cancelButton");
    const copyButton = $("copyCode");

    const menuToggle = $("menuToggle");
    const sidebar = $("sidebar");
    const pageOverlay = $("pageOverlay");
    const logoutLink = $("logoutLink");

    // ====================================================
    // 03. VALIDASI ELEMEN
    // ====================================================

    const requiredElements = {
      handlingForm: form,
      followUp: followUpInput,
      handlingStatus: statusInput,
      officerNotes: notesInput,
      reportCode: reportCodeElement,
    };

    const missingElements = Object.entries(requiredElements)
      .filter(([, element]) => !element)
      .map(([name]) => name);

    if (missingElements.length) {
      console.error("[SIPFAS] Elemen HTML tidak ditemukan:", missingElements);
      return;
    }

    // ====================================================
    // 04. NORMALISASI DATA
    // ====================================================

    function normalizeText(value) {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    function normalizeCode(value) {
      return String(value ?? "")
        .replace(/\s+/g, "")
        .trim()
        .toUpperCase();
    }

    function normalizeStatus(value) {
      const status = normalizeText(value);

      if (
        [
          "selesai",
          "completed",
          "selesai ditangani",
          "selesai diperbaiki",
        ].includes(status)
      ) {
        return "Selesai";
      }

      if (
        ["diproses", "processing", "sedang diproses", "dalam proses"].includes(
          status,
        )
      ) {
        return "Diproses";
      }

      if (["menunggu", "waiting", "menunggu perbaikan"].includes(status)) {
        return "Menunggu";
      }

      return "";
    }

    // ====================================================
    // 05. FUNGSI WAKTU WIT MALUKU UTARA
    // ====================================================

    // Mengambil waktu aktual perangkat dalam UTC.
    function getCurrentTimestamp() {
      return new Date().toISOString();
    }

    // Memvalidasi timestamp.
    function parseTimestamp(value) {
      if (!value) return null;

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return date;
    }

    // Mengonversi waktu UTC menjadi WIT UTC+09:00.
    function formatWIT(value) {
      const date = value instanceof Date ? value : parseTimestamp(value);

      if (!date) return "Belum tersedia";

      const witDate = new Date(date.getTime() + WIT_OFFSET_MS);

      const formatted = new Intl.DateTimeFormat("id-ID", {
        timeZone: "UTC",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(witDate);

      return formatted + " WIT";
    }

    // Format tanggal tanpa jam.
    function formatDateWIT(value) {
      const date = parseTimestamp(value);

      if (!date) return "Belum tersedia";

      const witDate = new Date(date.getTime() + WIT_OFFSET_MS);

      return new Intl.DateTimeFormat("id-ID", {
        timeZone: "UTC",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(witDate);
    }

    // Memperbarui elemen waktu.
    function setTimestampElement(id, timestamp) {
      const element = $(id);

      if (!element) return;

      element.textContent = timestamp ? formatWIT(timestamp) : "Belum tersedia";
    }

    // ====================================================
    // 06. LOCAL STORAGE
    // ====================================================

    function readStorage(key) {
      try {
        const raw = localStorage.getItem(key);

        if (raw === null) return {};

        const data = JSON.parse(raw);

        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("Format data tidak valid.");
        }

        return data;
      } catch (error) {
        console.error("[SIPFAS] Gagal membaca:", key, error);

        return null;
      }
    }

    function writeStorage(key, data) {
      const serialized = JSON.stringify(data);

      localStorage.setItem(key, serialized);

      const saved = localStorage.getItem(key);

      if (saved !== serialized) {
        throw new Error("Penyimpanan tidak berhasil dikonfirmasi.");
      }

      return JSON.parse(saved);
    }

    // ====================================================
    // 07. NOTIFIKASI
    // ====================================================

    let toastTimer;

    function showToast(message, type = "info") {
      let toast = $("sipfasToastNotification");

      if (!toast) {
        toast = document.createElement("div");
        toast.id = "sipfasToastNotification";
        document.body.appendChild(toast);
      }

      clearTimeout(toastTimer);

      const styles = {
        success: {
          icon: "✓",
          background: "#e8f8ef",
          color: "#087443",
          border: "#a7e5c2",
        },
        error: {
          icon: "✕",
          background: "#fff0f0",
          color: "#c62828",
          border: "#ffcaca",
        },
        info: {
          icon: "ℹ",
          background: "#edf3ff",
          color: "#2458b8",
          border: "#c7d8ff",
        },
      };

      const style = styles[type] || styles.info;

      toast.replaceChildren();

      const icon = document.createElement("span");
      icon.textContent = style.icon;

      const text = document.createElement("span");
      text.textContent = message;

      toast.append(icon, text);

      Object.assign(toast.style, {
        position: "fixed",
        top: "24px",
        right: "24px",
        zIndex: "99999",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        maxWidth: "calc(100vw - 48px)",
        padding: "16px 22px",
        borderRadius: "12px",
        background: style.background,
        color: style.color,
        border: `1px solid ${style.border}`,
        boxShadow: "0 6px 24px rgba(0,0,0,.12)",
        fontSize: "14px",
        fontWeight: "600",
        fontFamily: "inherit",
      });

      toast.hidden = false;
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");

      toastTimer = setTimeout(() => {
        toast.hidden = true;
      }, 4000);
    }

    // ====================================================
    // 08. MENGAMBIL IDENTITAS LAPORAN
    // ====================================================

    let currentReport = null;
    let savedHandling = null;

    function getSelectedReport() {
      const params = new URLSearchParams(window.location.search);

      const urlCode = normalizeCode(params.get("kode"));

      const selectedData = readStorage(STORAGE.selected);

      if (selectedData === null) {
        throw new Error("Data laporan terpilih tidak dapat dibaca.");
      }

      const storedCode = normalizeCode(
        selectedData.id || selectedData.reportCode,
      );

      const code =
        urlCode || storedCode || normalizeCode(reportCodeElement.textContent);

      if (!code) {
        throw new Error("Kode laporan tidak ditemukan.");
      }

      return {
        ...selectedData,
        id: code,
        reportCode: code,
      };
    }

    // ====================================================
    // 09. INFORMASI LAPORAN
    // ====================================================

    function displayReportInformation() {
      const verificationData = readStorage(STORAGE.verification);

      if (verificationData === null) {
        throw new Error("Data verifikasi tidak dapat dibaca.");
      }

      const verification = verificationData[currentReport.reportCode] || {};

      const information = {
        reportName:
          verification.reporterName || currentReport.reporterName || "",

        reportNim: verification.reporterNim || currentReport.reporterNim || "",

        reportFacility:
          verification.facilityName ||
          verification.facility ||
          currentReport.facility ||
          "",

        reportLocation:
          verification.facilityLocation ||
          verification.location ||
          currentReport.location ||
          "",

        reportDescription:
          verification.description ||
          verification.damageDescription ||
          currentReport.description ||
          "",
      };

      reportCodeElement.textContent = currentReport.reportCode;

      if (pageCodeElement) {
        pageCodeElement.textContent = currentReport.reportCode;
      }

      Object.entries(information).forEach(([id, value]) => {
        const element = $(id);

        if (element && value) {
          element.textContent = value;
        }
      });

      const createdAt =
        verification.createdAt ||
        verification.reportCreatedAt ||
        currentReport.createdAt ||
        currentReport.reportCreatedAt;

      if (createdAt) {
        const reportTime = $("reportTime");

        if (reportTime) {
          reportTime.textContent = formatWIT(createdAt);
        }
      }

      const initials = $("reportInitials");

      if (initials && information.reportName) {
        initials.textContent = information.reportName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((word) => word.charAt(0).toUpperCase())
          .join("");
      }
    }

    // ====================================================
    // 10. STATUS HEADER
    // ====================================================

    function setHeaderStatus(status) {
      if (!headerStatusElement) return;

      const normalized = normalizeStatus(status);

      if (!normalized) return;

      headerStatusElement.textContent = normalized;
      headerStatusElement.dataset.status = normalized;
    }

    // ====================================================
    // 11. MEMUAT DATA PENANGANAN
    // ====================================================

    function loadSavedHandling() {
      const allData = readStorage(STORAGE.handling);

      if (allData === null) {
        throw new Error("Data penanganan tidak dapat dibaca.");
      }

      savedHandling = allData[currentReport.reportCode] || null;

      if (!savedHandling) {
        setHeaderStatus("Menunggu");

        if (updatedAtElement) {
          updatedAtElement.textContent = "Belum ada pembaruan";
        }

        setTimestampElement("startedAt", null);
        setTimestampElement("completedAt", null);

        return;
      }

      followUpInput.value =
        savedHandling.followUp ||
        savedHandling.followUpAction ||
        savedHandling.tindakLanjut ||
        "";

      const status = normalizeStatus(
        savedHandling.status || savedHandling.handlingStatus,
      );

      if (status) {
        const option = Array.from(statusInput.options).find(
          (item) => normalizeStatus(item.value) === status,
        );

        if (option) {
          statusInput.value = option.value;
        }

        setHeaderStatus(status);
      }

      notesInput.value =
        savedHandling.officerNotes || savedHandling.catatanPetugas || "";

      if (updatedAtElement) {
        updatedAtElement.textContent = savedHandling.updatedAt
          ? formatWIT(savedHandling.updatedAt)
          : "Belum ada pembaruan";
      }

      setTimestampElement("startedAt", savedHandling.startedAt);

      setTimestampElement("completedAt", savedHandling.completedAt);

      console.log("[SIPFAS] Data penanganan dimuat:", savedHandling);
    }

    // ====================================================
    // 12. VALIDASI FORM
    // ====================================================

    function validateForm() {
      if (!followUpInput.value.trim()) {
        followUpInput.focus();

        showToast("Tindak lanjut perbaikan wajib diisi.", "error");

        return false;
      }

      const status = normalizeStatus(statusInput.value);

      if (!status) {
        statusInput.focus();

        showToast("Pilih status penanganan yang valid.", "error");

        return false;
      }

      return true;
    }

    // ====================================================
    // 13. RIWAYAT PERUBAHAN
    // ====================================================

    function createEventHistory(previous, status, now) {
      const events = Array.isArray(previous?.events)
        ? [...previous.events]
        : [];

      const previousStatus = normalizeStatus(
        previous?.status || previous?.handlingStatus,
      );

      let eventType;

      if (!previous) {
        eventType = "penanganan_dibuat";
      } else if (previousStatus !== status) {
        eventType = "status_diubah";
      } else {
        eventType = "pembaruan_penanganan";
      }

      events.push({
        type: eventType,
        status,
        timestamp: now,
      });

      return events;
    }

    // ====================================================
    // 14. PROSES SIMPAN
    // ====================================================

    function saveHandling(event) {
      event?.preventDefault();

      if (!validateForm()) return;

      if (saveButton) {
        saveButton.disabled = true;
      }

      try {
        const allData = readStorage(STORAGE.handling);

        if (allData === null) {
          throw new Error("Data penanganan sebelumnya tidak dapat dibaca.");
        }

        const code = currentReport.reportCode;
        const previous = allData[code] || null;

        const status = normalizeStatus(statusInput.value);
        const now = getCurrentTimestamp();

        const previousStatus = normalizeStatus(
          previous?.status || previous?.handlingStatus,
        );

        // Waktu mulai: hanya dicatat satu kali.
        let startedAt = previous?.startedAt || null;

        if (!startedAt && ["Diproses", "Selesai"].includes(status)) {
          startedAt = now;
        }

        // Waktu selesai: dicatat ketika status Selesai.
        let completedAt = previous?.completedAt || null;

        if (status === "Selesai") {
          if (previousStatus !== "Selesai" || !completedAt) {
            completedAt = now;
          }
        } else {
          completedAt = null;
        }

        // Waktu pembaruan: berubah setiap penyimpanan.
        const updatedAt = now;

        const followUp = followUpInput.value.trim();
        const officerNotes = notesInput.value.trim();

        const record = {
          ...(previous || {}),

          reportCode: code,

          followUp,
          followUpAction: followUp,
          tindakLanjut: followUp,

          status,
          handlingStatus: status,
          statusLabel: status,

          officerNotes,
          catatanPetugas: officerNotes,

          startedAt,
          updatedAt,
          completedAt,

          startedAtLabel: startedAt ? formatWIT(startedAt) : "",

          updatedAtLabel: formatWIT(updatedAt),

          completedAtLabel: completedAt ? formatWIT(completedAt) : "",

          events: createEventHistory(previous, status, now),

          savedFrom: "detail-penanganan",
        };

        // Menjaga data laporan lain tetap utuh.
        allData[code] = record;

        const persisted = writeStorage(STORAGE.handling, allData);

        // Memeriksa hasil penyimpanan.
        const saved = persisted[code];

        if (
          !saved ||
          saved.status !== status ||
          saved.followUp !== followUp ||
          saved.officerNotes !== officerNotes ||
          saved.updatedAt !== updatedAt
        ) {
          throw new Error("Konfirmasi penyimpanan tidak sesuai.");
        }

        savedHandling = saved;

        // Memperbarui tampilan.
        if (updatedAtElement) {
          updatedAtElement.textContent = formatWIT(updatedAt);
        }

        setTimestampElement("startedAt", startedAt);
        setTimestampElement("completedAt", completedAt);

        setHeaderStatus(status);

        // Memberi sinyal pembaruan kepada halaman lain.
        window.dispatchEvent(
          new CustomEvent("sipfas:handling-saved", {
            detail: {
              reportCode: code,
              record: saved,
            },
          }),
        );

        showToast("Perubahan penanganan berhasil disimpan!", "success");

        console.log("[SIPFAS] Data berhasil disimpan:", saved);
      } catch (error) {
        console.error("[SIPFAS] Gagal menyimpan:", error);

        showToast(error.message || "Gagal menyimpan perubahan.", "error");
      } finally {
        if (saveButton) {
          saveButton.disabled = false;
        }
      }
    }

    // ====================================================
    // 15. EVENT FORM
    // ====================================================

    form.addEventListener("submit", saveHandling);

    statusInput.addEventListener("change", () => {
      const status = normalizeStatus(statusInput.value);

      if (status) {
        setHeaderStatus(status);
      }
    });

    // ====================================================
    // 16. TOMBOL BATAL
    // ====================================================

    cancelButton?.addEventListener("click", (event) => {
      event.preventDefault();

      const target = new URL(
        "../Penanganan/Penanganan.html",
        window.location.href,
      );

      window.location.href = target.href;
    });

    // ====================================================
    // 17. TOMBOL SALIN KODE
    // ====================================================

    async function copyReportCode() {
      const code = currentReport?.reportCode;

      if (!code) {
        showToast("Kode laporan tidak ditemukan.", "error");
        return;
      }

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(code);
        } else {
          const textarea = document.createElement("textarea");

          textarea.value = code;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";

          document.body.appendChild(textarea);
          textarea.select();

          const copied = document.execCommand("copy");

          textarea.remove();

          if (!copied) {
            throw new Error("Penyalinan gagal.");
          }
        }

        showToast("Kode laporan berhasil disalin!", "success");
      } catch (error) {
        console.error(error);

        showToast("Gagal menyalin kode laporan.", "error");
      }
    }

    copyButton?.addEventListener("click", (event) => {
      event.preventDefault();
      copyReportCode();
    });

    // ====================================================
    // 18. SIDEBAR RESPONSIF
    // ====================================================

    function setSidebar(open) {
      sidebar?.classList.toggle("open", open);

      pageOverlay?.classList.toggle("show", open);
      pageOverlay?.classList.toggle("active", open);

      menuToggle?.setAttribute("aria-expanded", String(open));
    }

    menuToggle?.addEventListener("click", () => {
      const open =
        sidebar?.classList.contains("open") ||
        sidebar?.classList.contains("active");

      setSidebar(!open);
    });

    pageOverlay?.addEventListener("click", () => {
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

    // ====================================================
    // 19. LOGOUT
    // ====================================================

    logoutLink?.addEventListener("click", (event) => {
      event.preventDefault();

      const confirmed = window.confirm(
        "Apakah Anda yakin ingin keluar dari SIPFAS?",
      );

      if (!confirmed) return;

      // Menghapus sesi autentikasi saja.
      [
        "sipfasPendingLogin",
        "sipfasLoginEmail",
        "sipfasLoginOtp",
        "sipfasLoginOtpExpiresAt",
        "sipfasLoginAttempts",
        "sipfasLoginVerified",
        "sipfasActiveUser",
      ].forEach((key) => {
        sessionStorage.removeItem(key);
      });

      const loginURL = new URL("../../auth/Login.html", window.location.href);

      window.location.replace(loginURL.href);
    });

    // ====================================================
    // 20. SINKRONISASI LOCAL STORAGE
    // ====================================================

    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE.handling || event.key === null) {
        loadSavedHandling();
      }
    });

    window.addEventListener("pageshow", () => {
      loadSavedHandling();
    });

    // ====================================================
    // 21. INISIALISASI
    // ====================================================

    try {
      currentReport = getSelectedReport();

      displayReportInformation();

      loadSavedHandling();

      console.log("[SIPFAS] Detail Penanganan aktif.");

      console.log("[SIPFAS] Zona waktu: WIT Maluku Utara (UTC+09:00).");

      console.log("[SIPFAS] Kode laporan:", currentReport.reportCode);
    } catch (error) {
      console.error("[SIPFAS] Inisialisasi gagal:", error);

      showToast(error.message, "error");
    }
  }
})();
