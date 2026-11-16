//DETAIL-PENANGANAN.JS

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    // ====================================================
    // 01. KONFIGURASI ENDPOINT API & ZONA WAKTU WIT
    // ====================================================

    const API = {
      detail: "../../api/petugas/detail-penanganan.php",
      save: "../../api/petugas/simpan-penanganan.php",
      logout: "../../api/auth/logout.php",
    };

    const WIT_OFFSET_MS = 9 * 60 * 60 * 1000;

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

    if (
      !form ||
      !followUpInput ||
      !statusInput ||
      !notesInput ||
      !reportCodeElement
    ) {
      console.error("[SIPFAS] Elemen form penanganan tidak ditemukan.");
      return;
    }

    // ====================================================
    // 03. NORMALISASI & FORMAT WAKTU WIT
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
        ["selesai", "completed", "selesai ditangani", "selesai diperbaiki"].includes(
          status,
        )
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
      if (
        ["menunggu", "waiting", "menunggu perbaikan", "terverifikasi"].includes(
          status,
        )
      ) {
        return "Menunggu";
      }
      return "";
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

    function parseTimestamp(value) {
      if (!value) return null;
      const date = new Date(String(value).replace(" ", "T"));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatWIT(value) {
      const date = value instanceof Date ? value : parseTimestamp(value);
      if (!date) return "Belum tersedia";

      const witDate = new Date(date.getTime() + WIT_OFFSET_MS);
      return (
        new Intl.DateTimeFormat("id-ID", {
          timeZone: "UTC",
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(witDate) + " WIT"
      );
    }

    function setTimestampElement(id, timestamp) {
      const element = $(id);
      if (element) {
        element.textContent = timestamp ? formatWIT(timestamp) : "Belum tersedia";
      }
    }

    // ====================================================
    // 04. NOTIFIKASI TOAST
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
    // 05. MEMUAT DATA LAPORAN & PENANGANAN DARI DATABASE
    // ====================================================

    let currentReportCode = "";

    function getTargetCode() {
      const params = new URLSearchParams(window.location.search);
      return normalizeCode(params.get("kode") || reportCodeElement.textContent);
    }

    function setHeaderStatus(status) {
      if (!headerStatusElement) return;
      const normalized = normalizeStatus(status);
      if (!normalized) return;
      headerStatusElement.textContent = normalized;
      headerStatusElement.dataset.status = normalized;
    }

    async function loadHandlingFromDB() {
      const code = getTargetCode();
      if (!code) {
        showToast("Kode laporan tidak ditemukan.", "error");
        return;
      }

      currentReportCode = code;
      reportCodeElement.textContent = code;
      if (pageCodeElement) pageCodeElement.textContent = code;

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
            payload?.message || "Gagal mengambil detail penanganan dari database.",
          );
        }

        const data = payload?.data || payload?.laporan || payload;
        const penanganan =
          payload?.penanganan || data?.penanganan || data;

        const infoMap = {
          reportName: firstValue(data, ["nama_pelapor", "nama_lengkap", "reporterName"]),
          reportNim: firstValue(data, ["nomor_identitas", "nim", "reporterNim"]),
          reportFacility: firstValue(data, ["nama_fasilitas", "facilityName", "facility"]),
          reportLocation: firstValue(data, ["lokasi_ruangan", "facilityLocation", "location"]),
          reportDescription: firstValue(data, ["deskripsi_kerusakan", "deskripsi", "description"]),
        };

        Object.entries(infoMap).forEach(([id, value]) => {
          const el = $(id);
          if (el && value) el.textContent = value;
        });

        const createdAt = firstValue(data, [
          "tanggal_dibuat",
          "tanggal_laporan",
          "waktu_lapor",
          "created_at",
        ]);
        if (createdAt && $("reportTime")) {
          $("reportTime").textContent = formatWIT(createdAt);
        }

        const initials = $("reportInitials");
        if (initials && infoMap.reportName) {
          initials.textContent = infoMap.reportName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w.charAt(0).toUpperCase())
            .join("");
        }

        followUpInput.value = firstValue(penanganan, [
          "tindak_lanjut_perbaikan",
          "tindak_lanjut",
          "followUp",
        ]);

        notesInput.value = firstValue(penanganan, [
          "catatan_petugas",
          "officerNotes",
        ]);

        const status = normalizeStatus(
          firstValue(penanganan, ["status_penanganan", "status_laporan", "status"], "Menunggu"),
        );
        if (status) {
          const option = Array.from(statusInput.options).find(
            (opt) => normalizeStatus(opt.value) === status,
          );
          if (option) statusInput.value = option.value;
          setHeaderStatus(status);
        }

        const updatedAt = firstValue(penanganan, ["waktu_pembaruan", "updatedAt"]);
        const startedAt = firstValue(penanganan, ["waktu_mulai_penanganan", "startedAt"]);
        const completedAt = firstValue(penanganan, ["waktu_selesai_penanganan", "completedAt"]);

        if (updatedAtElement) {
          updatedAtElement.textContent = updatedAt
            ? formatWIT(updatedAt)
            : "Belum ada pembaruan";
        }
        setTimestampElement("startedAt", startedAt);
        setTimestampElement("completedAt", completedAt);
      } catch (error) {
        console.error("[SIPFAS] Gagal memuat penanganan:", error);
        showToast(error.message, "error");
      }
    }

    // ====================================================
    // 06. SIMPAN PENANGANAN KE simpan-penanganan.php
    // ====================================================

    async function saveHandlingToDB(event) {
      event?.preventDefault();

      const followUp = followUpInput.value.trim();
      const status = normalizeStatus(statusInput.value);
      const officerNotes = notesInput.value.trim();

      if (!followUp) {
        followUpInput.focus();
        showToast("Tindak lanjut perbaikan wajib diisi.", "error");
        return;
      }

      if (!status) {
        statusInput.focus();
        showToast("Pilih status penanganan yang valid.", "error");
        return;
      }

      if (saveButton) saveButton.disabled = true;

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
            tindak_lanjut_perbaikan: followUp,
            followUp,
            status_penanganan: status,
            status,
            catatan_petugas: officerNotes,
            officerNotes,
          }),
        });

        const payload = await response.json();
        if (!response.ok || payload?.success === false) {
          throw new Error(
            payload?.message || "Gagal menyimpan perubahan penanganan ke database.",
          );
        }

        const saved = payload?.data || payload;
        const updatedAt = firstValue(
          saved,
          ["waktu_pembaruan", "updatedAt"],
          new Date().toISOString(),
        );
        const startedAt = firstValue(saved, ["waktu_mulai_penanganan", "startedAt"], null);
        const completedAt = firstValue(saved, ["waktu_selesai_penanganan", "completedAt"], null);

        if (updatedAtElement) updatedAtElement.textContent = formatWIT(updatedAt);
        setTimestampElement("startedAt", startedAt);
        setTimestampElement("completedAt", completedAt);
        setHeaderStatus(status);

        window.dispatchEvent(
          new CustomEvent("sipfas:handling-saved", {
            detail: { reportCode: currentReportCode, record: saved },
          }),
        );

        showToast("Perubahan penanganan berhasil disimpan!", "success");
      } catch (error) {
        console.error("[SIPFAS] Gagal menyimpan penanganan:", error);
        showToast(error.message || "Gagal menyimpan perubahan.", "error");
      } finally {
        if (saveButton) saveButton.disabled = false;
      }
    }

    form.addEventListener("submit", saveHandlingToDB);

    statusInput.addEventListener("change", () => {
      const status = normalizeStatus(statusInput.value);
      if (status) setHeaderStatus(status);
    });

    cancelButton?.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = new URL(
        "../Penanganan/Penanganan.html",
        window.location.href,
      ).href;
    });

    copyButton?.addEventListener("click", async (event) => {
      event.preventDefault();
      if (!currentReportCode) return;
      try {
        await navigator.clipboard.writeText(currentReportCode);
        showToast("Kode laporan berhasil disalin!", "success");
      } catch {
        showToast("Gagal menyalin kode laporan.", "error");
      }
    });

    // Sidebar & Logout
    function setSidebar(open) {
      sidebar?.classList.toggle("open", open);
      pageOverlay?.classList.toggle("show", open);
      pageOverlay?.classList.toggle("active", open);
      menuToggle?.setAttribute("aria-expanded", String(open));
    }

    menuToggle?.addEventListener("click", () =>
      setSidebar(!sidebar?.classList.contains("open")),
    );
    pageOverlay?.addEventListener("click", () => setSidebar(false));
    document
      .querySelectorAll(".nav-link")
      .forEach((link) => link.addEventListener("click", () => setSidebar(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setSidebar(false);
    });

    logoutLink?.addEventListener("click", async (event) => {
      event.preventDefault();
      if (!window.confirm("Apakah Anda yakin ingin keluar dari SIPFAS?")) return;
      try {
        await fetch(new URL(API.logout, window.location.href).href, {
          method: "POST",
          credentials: "same-origin",
        });
      } finally {
        window.location.replace(
          new URL("../../auth/Login.html", window.location.href).href,
        );
      }
    });

    loadHandlingFromDB();
  }
})();