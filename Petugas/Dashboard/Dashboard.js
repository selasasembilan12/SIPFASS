
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initializeDashboard);

  const API = {
    dashboard: "../../api/petugas/dashboard.php",
    profile: "../../api/shared/profil-login.php",
    logout: "../../api/auth/logout.php"
  };

  const DETAIL_URL =
    "../Detail-Verifikasi-Laporan/Detail-Verifikasi-Laporan.html";

  const LOGIN_URL = "../../auth/Login.html";

  let refreshTimer = null;
  let refreshInProgress = false;

  function initializeDashboard() {
    const tableBody = document.querySelector(".report-panel tbody");
    const summaryCards = Array.from(
      document.querySelectorAll(".summary-card")
    );

    const sidebar = document.getElementById("sidebar");
    const menuToggle = document.getElementById("menuToggle");
    const pageOverlay = document.getElementById("pageOverlay");
    const logoutLink = document.getElementById("logoutLink");

    if (!tableBody) {
      console.error("[SIPFAS] Tabel dashboard tidak ditemukan.");
      return;
    }

    async function fetchJson(endpoint, options = {}) {
      const response = await fetch(
        new URL(endpoint, window.location.href).href,
        {
          credentials: "same-origin",
          cache: "no-store",
          ...options,
          headers: {
            Accept: "application/json",
            ...(options.headers || {})
          }
        }
      );

      const payload = await response.json();

      if (!response.ok || payload?.success === false) {
        throw new Error(
          payload?.message || "Gagal mengambil data dari server."
        );
      }

      return payload;
    }

    function normalizeText(value) {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
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

    function getReportCode(report) {
      return String(
        firstValue(report, [
          "kode_laporan",
          "nomor_laporan",
          "reportCode",
          "report_code",
          "id_laporan"
        ])
      ).trim().toUpperCase();
    }

    function extractReports(payload) {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.reports)) return payload.reports;
      if (Array.isArray(payload?.laporan)) return payload.laporan;

      return [];
    }

    function normalizeReport(report) {
      return {
        ...report,

        id: getReportCode(report),

        reporterName: firstValue(report, [
          "nama_pelapor",
          "nama_lengkap",
          "reporterName"
        ], "Tidak diketahui"),

        reporterNim: firstValue(report, [
          "nomor_identitas",
          "reporterNim",
          "nim"
        ]),

        facility: firstValue(report, [
          "nama_fasilitas",
          "facilityName",
          "facility"
        ], "Fasilitas belum disebutkan"),

        location: firstValue(report, [
          "nama_lokasi",
          "lokasi_ruangan",
          "facilityLocation",
          "location"
        ], "Belum dicantumkan"),

        description: firstValue(report, [
          "deskripsi_kerusakan",
          "description"
        ]),

        date: firstValue(report, [
          "tanggal_dibuat",
          "tanggal_laporan",
          "created_at"
        ]),

        verificationStatus: firstValue(report, [
          "status_verifikasi",
          "statusVerifikasi"
        ]),

        handlingStatus: firstValue(report, [
          "status_penanganan",
          "handlingStatus"
        ]),

        decision: firstValue(report, [
          "hasil_verifikasi",
          "decision"
        ]),

        priority: firstValue(report, [
          "prioritas_sesudah",
          "prioritas_prediksi",
          "prioritas_awal",
          "prioritas"
        ], "Belum Dinilai")
      };
    }

    async function getAllReportsFromDB() {
      const payload = await fetchJson(API.dashboard);

      return {
        reports: extractReports(payload).map(normalizeReport),
        serverStats:
          payload?.stats ||
          payload?.statistik ||
          payload?.data?.stats ||
          null
      };
    }

    function getReportState(report) {
      const verification = normalizeText(
        report.verificationStatus
      );

      const decision = normalizeText(report.decision);
      const handling = normalizeText(report.handlingStatus);

      const completedTime =
        report.waktu_selesai_penanganan ||
        report.completedAt;

      // Laporan yang ditolak tidak masuk antrean penanganan.
      if (
        verification.includes("tidak valid") ||
        verification.includes("ditolak") ||
        verification === "invalid" ||
        decision.includes("tidak valid") ||
        decision.includes("ditolak") ||
        decision === "invalid"
      ) {
        return "invalid";
      }

      // Status selesai memiliki prioritas klasifikasi tertinggi.
      if (
        completedTime ||
        handling.includes("selesai") ||
        handling === "completed"
      ) {
        return "completed";
      }

      // Laporan yang sudah valid masuk proses penanganan.
      if (
        verification === "valid" ||
        verification.includes("terverifikasi") ||
        decision === "valid" ||
        handling.includes("diproses") ||
        handling.includes("penanganan") ||
        handling.includes("perbaikan")
      ) {
        return "handling";
      }

      // Laporan yang belum diverifikasi tetap menunggu verifikasi.
      return "pending";
    }

    function calculateStatistics(reports) {
      const stats = {
        total: reports.length,
        pending: 0,
        handling: 0,
        completed: 0,
        invalid: 0
      };

      reports.forEach((report) => {
        const state = getReportState(report);
        stats[state]++;
      });

      return stats;
    }

    function renderStatistics(reports, serverStats = null) {
      const calculated = calculateStatistics(reports);

      const stats = serverStats
        ? {
            total: Number(
              serverStats.total ??
              serverStats.total_laporan ??
              calculated.total
            ),
            pending: Number(
              serverStats.pending ??
              serverStats.menunggu_verifikasi ??
              calculated.pending
            ),
            handling: Number(
              serverStats.handling ??
              serverStats.dalam_penanganan ??
              calculated.handling
            ),
            completed: Number(
              serverStats.completed ??
              serverStats.selesai ??
              calculated.completed
            )
          }
        : calculated;

      const values = [
        stats.total,
        stats.pending,
        stats.handling,
        stats.completed
      ];

      summaryCards.forEach((card, index) => {
        const number = card.querySelector(".number");

        if (number && values[index] !== undefined) {
          number.textContent = String(values[index]);
        }
      });

      const description = summaryCards[0]?.querySelector("p");

      if (description) {
        description.textContent =
          calculated.invalid > 0
            ? `${stats.total} laporan tercatat, ${calculated.invalid} tidak valid`
            : `${stats.total} laporan masuk`;
      }
    }

    function normalizePriority(value) {
      const priority = normalizeText(value);

      if (
        priority.includes("tinggi") ||
        priority === "high"
      ) {
        return "Tinggi";
      }

      if (
        priority.includes("sedang") ||
        priority === "medium"
      ) {
        return "Sedang";
      }

      if (
        priority.includes("rendah") ||
        priority === "low"
      ) {
        return "Rendah";
      }

      return "Belum Dinilai";
    }

    function parseDate(value) {
      if (!value) return 0;

      const date = new Date(
        String(value).replace(" ", "T")
      );

      return Number.isNaN(date.getTime())
        ? 0
        : date.getTime();
    }

    function formatDate(value) {
      if (!value) return "—";

      const date = new Date(
        String(value).replace(" ", "T")
      );

      if (Number.isNaN(date.getTime())) {
        return String(value);
      }

      return new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jayapura",
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(date);
    }

    function createCell(value, className = "") {
      const cell = document.createElement("td");

      cell.textContent = value || "—";

      if (className) {
        cell.className = className;
      }

      return cell;
    }

    function createPriorityBadge(value) {
      const priority = normalizePriority(value);
      const badge = document.createElement("span");

      badge.classList.add("priority");

      if (priority === "Tinggi") {
        badge.classList.add("priority-high");
      } else if (priority === "Sedang") {
        badge.classList.add("priority-medium");
      } else if (priority === "Rendah") {
        badge.classList.add("priority-low");
      }

      badge.textContent = priority;

      return badge;
    }

    function createCheckButton(report) {
      const code = getReportCode(report);
      const button = document.createElement("a");

      const destination = new URL(
        DETAIL_URL,
        window.location.href
      );

      destination.searchParams.set("kode", code);

      button.href = destination.href;
      button.className = "action-button";
      button.textContent = "Periksa";

      return button;
    }

    function renderPendingReports(reports) {
      const pendingReports = reports
        .filter((report) => getReportState(report) === "pending")
        .sort((a, b) => parseDate(b.date) - parseDate(a.date));

      tableBody.replaceChildren();

      if (pendingReports.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.className = "empty-row";
        cell.style.textAlign = "center";
        cell.textContent =
          "Tidak ada laporan yang menunggu verifikasi.";

        row.appendChild(cell);
        tableBody.appendChild(row);

        return;
      }

      const fragment = document.createDocumentFragment();

      pendingReports.forEach((report) => {
        const row = document.createElement("tr");

        row.dataset.reportCode = report.id;

        row.appendChild(
          createCell(report.id, "report-code")
        );

        row.appendChild(
          createCell(report.facility, "facility")
        );

        row.appendChild(
          createCell(report.location)
        );

        row.appendChild(
          createCell(formatDate(report.date))
        );

        const priorityCell = document.createElement("td");

        priorityCell.appendChild(
          createPriorityBadge(report.priority)
        );

        row.appendChild(priorityCell);

        const actionCell = document.createElement("td");

        actionCell.appendChild(
          createCheckButton(report)
        );

        row.appendChild(actionCell);

        fragment.appendChild(row);
      });

      tableBody.appendChild(fragment);
    }

    async function refreshDashboard() {
      if (refreshInProgress) return;

      refreshInProgress = true;

      try {
        const result = await getAllReportsFromDB();

        renderStatistics(
          result.reports,
          result.serverStats
        );

        renderPendingReports(result.reports);

      } catch (error) {
        console.error(
          "[SIPFAS] Gagal memperbarui dashboard:",
          error
        );
      } finally {
        refreshInProgress = false;
      }
    }

    function getInitials(name) {
      const words = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      if (words.length === 0) return "PT";

      if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
      }

      return (
        words[0][0] +
        words[words.length - 1][0]
      ).toUpperCase();
    }

    // Mengarahkan path foto relatif ke root proyek SIPFAS.
    function resolvePhotoUrl(path) {
      const value = String(path ?? "").trim();

      if (!value) return "";

      if (/^(https?:|data:|blob:)/i.test(value)) {
        return value;
      }

      const appRoot = new URL(
        "../../",
        window.location.href
      );

      return new URL(
        value.replace(/^\/+/, ""),
        appRoot
      ).href;
    }

    function renderAvatarPhoto(
      avatarEl,
      name,
      photo,
      initials
    ) {
      if (!avatarEl) return;

      let image = avatarEl.querySelector(
        ".profile-header-photo, img"
      );

      let initialsElement = avatarEl.querySelector(
        ".profile-header-initials"
      );

      const svg = avatarEl.querySelector("svg");

      function showInitials() {
        if (image) {
          image.remove();
          image = null;
        }

        if (!initialsElement) {
          initialsElement = document.createElement("span");
          initialsElement.className = "profile-header-initials";
          avatarEl.appendChild(initialsElement);
        }

        initialsElement.textContent = initials;

        if (svg) {
          svg.style.display = "none";
        }
      }

      if (!photo) {
        showInitials();
        return;
      }

      if (!image) {
        image = document.createElement("img");
        image.className = "profile-header-photo";
        avatarEl.appendChild(image);
      }

      if (initialsElement) {
        initialsElement.remove();
        initialsElement = null;
      }

      if (svg) {
        svg.style.display = "none";
      }

      image.onerror = showInitials;
      image.alt = `Foto profil ${name}`;
      image.src = resolvePhotoUrl(photo);

      Object.assign(image.style, {
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: "cover",
        borderRadius: "50%"
      });

      avatarEl.style.overflow = "hidden";
    }

    async function displayActiveUser() {
      try {
        const payload = await fetchJson(API.profile);

        const user = payload?.user || payload?.data;

        if (!user || typeof user !== "object") {
          return;
        }

        const name = firstValue(user, [
          "nama_lengkap",
          "name",
          "fullName",
          "nama_pengguna"
        ], "Petugas Sarpras");

        const role = firstValue(user, [
          "nama_peran",
          "role",
          "peran"
        ], "Petugas Sarpras");

        const photo = firstValue(user, [
          "foto_profil",
          "photo",
          "avatar",
          "foto"
        ]);

        const initials = getInitials(name);

        document.querySelectorAll(
          ".profile-area .profile-name, #officerName, #petugasName, #profileName, .officer-name, .petugas-name, .profile-name"
        ).forEach((element) => {
          element.textContent = name;
        });

        document.querySelectorAll(
          ".profile-area .profile-role, #officerRole, #petugasRole, #profileRole, .officer-role, .petugas-role, .profile-role"
        ).forEach((element) => {
          element.textContent = role;
        });

        document.querySelectorAll(
          ".profile-area .profile-avatar, #profileAvatar, #userAvatar, #officerAvatar, .profile-avatar, .user-avatar"
        ).forEach((element) => {
          renderAvatarPhoto(
            element,
            name,
            photo,
            initials
          );
        });

      } catch (error) {
        console.error(
          "[SIPFAS] Gagal memuat identitas petugas:",
          error
        );
      }
    }

    function setSidebar(open) {
      if (!sidebar) return;

      sidebar.classList.toggle("open", open);

      pageOverlay?.classList.toggle("show", open);

      menuToggle?.setAttribute(
        "aria-expanded",
        String(open)
      );

      menuToggle?.setAttribute(
        "aria-label",
        open ? "Tutup menu" : "Buka menu"
      );
    }

    menuToggle?.addEventListener("click", () => {
      setSidebar(!sidebar.classList.contains("open"));
    });

    pageOverlay?.addEventListener("click", () => {
      setSidebar(false);
    });

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => setSidebar(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setSidebar(false);
      }
    });

    if (logoutLink) {
      logoutLink.href = new URL(
        LOGIN_URL,
        window.location.href
      ).href;

      logoutLink.addEventListener("click", async (event) => {
        event.preventDefault();

        if (!window.confirm(
          "Apakah Anda yakin ingin keluar dari sistem SIPFAS?"
        )) {
          return;
        }

        try {
          await fetch(
            new URL(API.logout, window.location.href).href,
            {
              method: "POST",
              credentials: "same-origin",
              cache: "no-store"
            }
          );
        } catch (error) {
          console.error("[SIPFAS] Logout error:", error);
        } finally {
          window.location.replace(
            new URL(LOGIN_URL, window.location.href).href
          );
        }
      });
    }

    // Memperbarui dashboard ketika ada aktivitas laporan.
    window.addEventListener(
      "sipfas:report-submitted",
      refreshDashboard
    );

    window.addEventListener(
      "sipfas:verification-saved",
      refreshDashboard
    );

    window.addEventListener(
      "sipfas:handling-saved",
      refreshDashboard
    );

    window.addEventListener(
      "sipfas:profile-updated",
      displayActiveUser
    );

    // Memuat ulang data ketika pengguna kembali ke halaman dashboard.
    window.addEventListener("pageshow", () => {
      displayActiveUser();
      refreshDashboard();
    });

    // Memperbarui data berkala agar laporan dari sesi Pelapor
    // dapat muncul tanpa pengguna harus memuat ulang halaman.
    refreshTimer = window.setInterval(() => {
      if (!document.hidden) {
        refreshDashboard();
      }
    }, 15000);

    // Menghentikan timer ketika halaman ditinggalkan.
    window.addEventListener("pagehide", () => {
      if (refreshTimer !== null) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
    });

    displayActiveUser();
    refreshDashboard();
  }
})();
