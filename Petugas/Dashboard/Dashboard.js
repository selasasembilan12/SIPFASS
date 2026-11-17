
// DASHBOARD.JS

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initializeDashboard);

  // ========================================================
  // 01. KONFIGURASI ENDPOINT API & NAVIGASI
  // ========================================================

  const API = {
    dashboard: "../../api/petugas/dashboard.php",
    profile: "../../api/shared/profil-login.php",
    logout: "../../api/auth/logout.php",
  };

  const DETAIL_URL =
    "../Detail-Verifikasi-Laporan/Detail-Verifikasi-Laporan.html";

  const LOGIN_URL = "../../auth/Login.html";

  // ========================================================
  // 02. INISIALISASI DASHBOARD
  // ========================================================

  function initializeDashboard() {
    const tableBody = document.querySelector(".report-panel tbody");
    const summaryCards = Array.from(document.querySelectorAll(".summary-card"));

    const sidebar = document.getElementById("sidebar");
    const menuToggle = document.getElementById("menuToggle");
    const pageOverlay = document.getElementById("pageOverlay");
    const logoutLink = document.getElementById("logoutLink");

    if (!tableBody) {
      console.error("[SIPFAS] Tabel laporan dashboard tidak ditemukan.");
      return;
    }

    // ====================================================
    // 03. HELPER FETCH API DATABASE
    // ====================================================

    async function fetchJson(endpoint, options = {}) {
      const url = new URL(endpoint, window.location.href);

      const response = await fetch(url.href, {
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          ...(options.headers || {})
        },
        ...options,
      });

      const payload = await response.json();

      if (!response.ok || payload?.success === false) {
        throw new Error(
          payload?.message || `Gagal memuat data dari ${endpoint}.`
        );
      }

      return payload;
    }

    // ====================================================
    // 04. NORMALISASI TEKS & DATA
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

    function normalizeRole(value) {
      const role = normalizeText(value);

      if (role === "admin" || role === "administrator") {
        return "administrator";
      }

      if (role.includes("petugas")) return "petugas";

      if (role === "pelapor" || role === "user") {
        return "pelapor";
      }

      return role;
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

    function getReportCode(report, fallback = "") {
      return normalizeCode(
        firstValue(
          report,
          [
            "kode_laporan",
            "nomor_laporan",
            "reportCode",
            "report_code",
            "id_laporan",
            "id",
            "code",
          ],
          fallback,
        ),
      );
    }

    function extractCollection(payload) {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.reports)) return payload.reports;
      if (Array.isArray(payload?.laporan)) return payload.laporan;
      if (Array.isArray(payload?.data?.laporan)) return payload.data.laporan;
      if (Array.isArray(payload?.data?.reports)) return payload.data.reports;

      return [];
    }

    function normalizeReport(report) {
      const code = getReportCode(report);

      return {
        ...report,

        id: code,
        reportCode: code,

        reporterName: firstValue(
          report,
          [
            "reporterName",
            "nama_pelapor",
            "nama_lengkap",
            "reporter",
            "nama",
          ],
          "Tidak diketahui",
        ),

        reporterNim: firstValue(
          report,
          ["reporterNim", "nomor_identitas", "nim"],
          "",
        ),

        facility: firstValue(
          report,
          [
            "nama_fasilitas",
            "facilityName",
            "facility",
            "fasilitas",
          ],
          "Fasilitas belum disebutkan",
        ),

        location: firstValue(
          report,
          [
            "lokasi_ruangan",
            "facilityLocation",
            "location",
            "lokasi",
          ],
          "Belum dicantumkan",
        ),

        description: firstValue(
          report,
          ["deskripsi_kerusakan", "description", "deskripsi", "keterangan"],
          "",
        ),

        date: firstValue(
          report,
          [
            "tanggal_dibuat",
            "tanggal_laporan",
            "waktu_lapor",
            "created_at",
            "createdAt",
            "date",
          ],
          "",
        ),

        priority: firstValue(
          report,
          [
            "prioritas_sesudah",
            "prioritas_sebelum",
            "prioritas",
            "label_prioritas",
            "priority",
            "priorityLabel",
          ],
          "Belum Dinilai",
        ),

        status: firstValue(
          report,
          ["status_laporan", "status", "statusLaporan"],
          "Menunggu Verifikasi",
        ),

        decision: firstValue(
          report,
          ["hasil_verifikasi", "decision", "verificationResult"],
          "",
        ),

        handlingStatus: firstValue(
          report,
          ["status_penanganan", "handlingStatus"],
          report.waktu_selesai_penanganan || report.completedAt
            ? "Selesai"
            : report.waktu_mulai_penanganan || report.startedAt
              ? "Diproses"
              : "",
        ),
      };
    }

    async function getAllReportsFromDB() {
      const payload = await fetchJson(API.dashboard);
      const items = extractCollection(payload);

      return {
        reports: items.map(normalizeReport),
        serverStats:
          payload?.stats ||
          payload?.statistik ||
          payload?.data?.stats ||
          null,
      };
    }

    // ====================================================
    // 05. STATUS & STATISTIK DASHBOARD
    // ====================================================

    function getReportState(report) {
      const decision = normalizeText(report.decision);
      const reportStatus = normalizeText(report.status);
      const handlingStatus = normalizeText(report.handlingStatus);

      if (
        decision === "invalid" ||
        decision.includes("tidak valid") ||
        decision.includes("ditolak") ||
        reportStatus.includes("tidak valid") ||
        reportStatus === "invalid"
      ) {
        return "invalid";
      }

      if (
        report.waktu_selesai_penanganan ||
        report.completedAt ||
        handlingStatus.includes("selesai") ||
        handlingStatus === "completed" ||
        reportStatus.includes("selesai") ||
        reportStatus === "completed"
      ) {
        return "completed";
      }

      if (
        decision === "valid" ||
        decision.includes("terverifikasi") ||
        handlingStatus.includes("diproses") ||
        handlingStatus.includes("menunggu perbaikan") ||
        handlingStatus.includes("sedang dikerjakan") ||
        reportStatus.includes("diproses") ||
        reportStatus.includes("dalam penanganan") ||
        reportStatus.includes("terverifikasi") ||
        report.waktu_mulai_penanganan ||
        report.startedAt
      ) {
        return "handling";
      }

      return "pending";
    }

    function calculateStatistics(reports, serverStats = null) {
      if (serverStats && typeof serverStats === "object") {
        return {
          total: Number(
            serverStats.total ??
            serverStats.total_laporan ??
            reports.length
          ),

          pending: Number(
            serverStats.pending ??
            serverStats.menunggu_verifikasi ??
            0
          ),

          handling: Number(
            serverStats.handling ??
            serverStats.dalam_penanganan ??
            0
          ),

          completed: Number(
            serverStats.completed ??
            serverStats.selesai ??
            0
          ),

          invalid: Number(
            serverStats.invalid ??
            serverStats.tidak_valid ??
            0
          ),
        };
      }

      const statistics = {
        total: reports.length,
        pending: 0,
        handling: 0,
        completed: 0,
        invalid: 0,
      };

      reports.forEach((report) => {
        const state = getReportState(report);

        if (Object.prototype.hasOwnProperty.call(statistics, state)) {
          statistics[state]++;
        }
      });

      return statistics;
    }

    function renderStatistics(reports, serverStats = null) {
      const stats = calculateStatistics(reports, serverStats);

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

      const totalDescription = summaryCards[0]?.querySelector("p");

      if (totalDescription) {
        totalDescription.textContent =
          stats.invalid > 0
            ? `${stats.total} laporan tercatat, ${stats.invalid} tidak valid`
            : `${stats.total} laporan masuk semester ini`;
      }

      return stats;
    }

    // ====================================================
    // 06. PRIORITAS & FORMAT TANGGAL WIT
    // ====================================================

    function normalizePriority(value) {
      const priority = normalizeText(value);

      if (priority.includes("tinggi") || priority === "high") {
        return "Tinggi";
      }

      if (priority.includes("sedang") || priority === "medium") {
        return "Sedang";
      }

      if (priority.includes("rendah") || priority === "low") {
        return "Rendah";
      }

      return "Belum Dinilai";
    }

    function parseDate(value) {
      if (!value) return 0;
      if (typeof value === "number") return value;

      const timestamp = new Date(
        String(value).replace(" ", "T")
      ).getTime();

      return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    function formatDate(value) {
      if (!value) return "—";

      const text = String(value).trim();
      const date = new Date(text.replace(" ", "T"));

      if (Number.isNaN(date.getTime())) return text;

      return new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jayapura",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
    }

    // ====================================================
    // 07. RENDER TABEL ANTREAN VERIFIKASI
    // ====================================================

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

        row.appendChild(createCell(report.id, "report-code"));
        row.appendChild(createCell(report.facility, "facility"));
        row.appendChild(createCell(report.location));
        row.appendChild(createCell(formatDate(report.date)));

        const priorityCell = document.createElement("td");
        priorityCell.appendChild(createPriorityBadge(report.priority));
        row.appendChild(priorityCell);

        const actionCell = document.createElement("td");
        actionCell.appendChild(createCheckButton(report));
        row.appendChild(actionCell);

        fragment.appendChild(row);
      });

      tableBody.appendChild(fragment);
    }

    async function refreshDashboard() {
      try {
        const { reports, serverStats } = await getAllReportsFromDB();

        renderStatistics(reports, serverStats);
        renderPendingReports(reports);

      } catch (error) {
        console.error(
          "[SIPFAS] Gagal memuat dashboard dari database:",
          error
        );
      }
    }

    // ====================================================
    // 08. IDENTITAS & FOTO PETUGAS DARI DATABASE
    // ====================================================

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

    // PERBAIKAN:
    // Path foto database harus diarahkan ke root proyek SIPFAS.
    function resolvePhotoUrl(path) {
      const value = String(path ?? "").trim();

      if (!value) return "";

      if (/^(https?:|data:|blob:)/i.test(value)) {
        return value;
      }

      const appRoot = new URL("../../", window.location.href);

      return new URL(
        value.replace(/^\/+/, ""),
        appRoot
      ).href;
    }

    function renderAvatarPhoto(avatarEl, name, photo, initials) {
      if (!avatarEl) return;

      if (avatarEl.tagName === "IMG") {
        if (photo) {
          avatarEl.onerror = () => {
            avatarEl.removeAttribute("src");
            avatarEl.alt = `Foto profil ${name} tidak dapat dimuat`;
          };

          avatarEl.src = resolvePhotoUrl(photo);
        }

        avatarEl.alt = `Foto profil ${name}`;

        return;
      }

      const svgIcon = avatarEl.querySelector("svg");

      let imgEl = avatarEl.querySelector(
        ".profile-header-photo, img"
      );

      let initialsEl = avatarEl.querySelector(
        ".profile-header-initials"
      );

      if (photo) {
        if (svgIcon) {
          svgIcon.style.display = "none";
        }

        if (initialsEl) {
          initialsEl.remove();
          initialsEl = null;
        }

        if (!imgEl) {
          imgEl = document.createElement("img");
          imgEl.className = "profile-header-photo";
          avatarEl.appendChild(imgEl);
        }

        imgEl.onerror = () => {
          imgEl.remove();

          if (!initialsEl) {
            initialsEl = document.createElement("span");
            initialsEl.className = "profile-header-initials";
            avatarEl.appendChild(initialsEl);
          }

          initialsEl.textContent = initials;

          Object.assign(initialsEl.style, {
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontWeight: "700",
            fontSize: "14px",
          });
        };

        imgEl.src = resolvePhotoUrl(photo);
        imgEl.alt = `Foto profil ${name}`;

        Object.assign(imgEl.style, {
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "cover",
          borderRadius: "50%",
        });

        avatarEl.style.overflow = "hidden";

      } else {
        if (imgEl) imgEl.remove();

        if (svgIcon) {
          svgIcon.style.display = "none";
        }

        if (!initialsEl) {
          initialsEl = document.createElement("span");
          initialsEl.className = "profile-header-initials";
          avatarEl.appendChild(initialsEl);
        }

        initialsEl.textContent = initials;

        Object.assign(initialsEl.style, {
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontWeight: "700",
          fontSize: "14px",
        });
      }
    }

    async function displayActiveUser() {
      try {
        const payload = await fetchJson(API.profile);

        const user = payload?.user || payload?.data || payload;

        if (!user || typeof user !== "object") return;

        const rawRole = firstValue(
          user,
          ["nama_peran", "role", "peran"],
          "Petugas Sarpras"
        );

        const role = normalizeRole(rawRole);

        if (role && role !== "petugas" && role !== "administrator") {
          return;
        }

        const name = firstValue(
          user,
          [
            "nama_lengkap",
            "name",
            "fullName",
            "nama_pengguna",
            "username"
          ],
          "Petugas Sarpras"
        );

        const photo = firstValue(
          user,
          ["foto_profil", "photo", "avatar", "foto"],
          ""
        );

        const initials = getInitials(name);

        document
          .querySelectorAll(
            ".profile-area .profile-name, #officerName, #petugasName, #profileName, .officer-name, .petugas-name, .profile-name"
          )
          .forEach((el) => {
            el.textContent = name;
          });

        document
          .querySelectorAll(
            ".profile-area .profile-role, #officerRole, #petugasRole, #profileRole, .officer-role, .petugas-role, .profile-role"
          )
          .forEach((el) => {
            el.textContent = rawRole;
          });

        document
          .querySelectorAll(
            ".profile-area .profile-avatar, #profileAvatar, #userAvatar, #officerAvatar, .profile-avatar, .user-avatar"
          )
          .forEach((avatarEl) => {
            renderAvatarPhoto(
              avatarEl,
              name,
              photo,
              initials
            );
          });

      } catch (error) {
        console.error(
          "[SIPFAS] Gagal memuat profil petugas:",
          error
        );
      }
    }

    // ====================================================
    // 09. SIDEBAR & LOGOUT PHP SESSION
    // ====================================================

    function setSidebar(open) {
      if (!sidebar) return;

      sidebar.classList.toggle("open", open);

      if (pageOverlay) {
        pageOverlay.classList.toggle("show", open);
      }

      if (menuToggle) {
        menuToggle.setAttribute("aria-expanded", String(open));

        menuToggle.setAttribute(
          "aria-label",
          open ? "Tutup menu" : "Buka menu"
        );
      }
    }

    menuToggle?.addEventListener("click", () =>
      setSidebar(!sidebar?.classList.contains("open"))
    );

    pageOverlay?.addEventListener("click", () =>
      setSidebar(false)
    );

    document
      .querySelectorAll(".nav-link")
      .forEach((link) =>
        link.addEventListener("click", () => setSidebar(false))
      );

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

        if (
          !window.confirm(
            "Apakah Anda yakin ingin keluar dari sistem SIPFAS?"
          )
        ) {
          return;
        }

        try {
          await fetch(
            new URL(API.logout, window.location.href).href,
            {
              method: "POST",
              credentials: "same-origin",
            }
          );

        } finally {
          window.location.replace(
            new URL(LOGIN_URL, window.location.href).href
          );
        }
      });
    }

    // ====================================================
    // 10. EVENT SINKRONISASI
    // ====================================================

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

    window.addEventListener("pageshow", () => {
      displayActiveUser();
      refreshDashboard();
    });

    displayActiveUser();
    refreshDashboard();
  }
})();
