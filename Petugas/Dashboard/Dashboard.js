/* ============================================================
   SIPFAS - DASHBOARD PETUGAS
   File: Dashboard.js
   REVISI: SINKRONISASI DATA LAPORAN & PROFIL/FOTO PETUGAS

   FUNGSI:
   1. Membaca seluruh laporan dari Local Storage.
   2. Menggabungkan laporan dari seluruh akun Pelapor.
   3. Menghindari duplikasi laporan berdasarkan ID.
   4. Sinkronisasi hasil verifikasi.
   5. Sinkronisasi status penanganan.
   6. Menghitung statistik dashboard.
   7. Menampilkan antrean verifikasi.
   8. Membuka detail laporan.
   9. Sinkronisasi nama, role, dan foto profil petugas.
   10. Pencarian dan navigasi sidebar.
   11. Logout tanpa menghapus data laporan.

   STANDAR:
   - Penyimpanan simulasi menggunakan Local Storage.
   - Sinkronisasi antarhalaman.
   - Waktu WIT Ternate, Maluku Utara (UTC+09:00).
   - Tidak menambahkan jam realtime pada dashboard.

   CATATAN:
   Data utama laporan tetap berada pada sipfasReports.
============================================================ */

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initializeDashboard);

  // ========================================================
  // 01. KONFIGURASI PENYIMPANAN
  // ========================================================

  const STORAGE = {
    reports: "sipfasReports",
    fallbackReports: "sipfas_dashboard_reports",
    verification: "sipfas_verifikasi_laporan",
    handling: "sipfas_penanganan_laporan",
    selected: "sipfas_selected_report",
    users: "sipfasUsers",
    activeUser: "sipfasActiveUser",
    pendingUser: "sipfasPendingLogin",
    photoPrefix: "sipfas_profile_photo_",
  };

  const AUTH_SESSION_KEYS = [
    "sipfasPendingLogin",
    "sipfasLoginEmail",
    "sipfasLoginOtp",
    "sipfasLoginOtpExpiresAt",
    "sipfasLoginAttempts",
    "sipfasLoginVerified",
    "sipfasActiveUser",
  ];

  // ========================================================
  // 02. KONFIGURASI NAVIGASI
  // ========================================================

  const DETAIL_URL =
    "../Detail-Verifikasi-Laporan/Detail-Verifikasi-Laporan.html";

  const LOGIN_URL = "../../auth/Login.html";

  // ========================================================
  // 03. INISIALISASI DASHBOARD
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
    // 04. MEMBACA LOCAL STORAGE
    // ====================================================

    function readStorage(key) {
      try {
        const raw = localStorage.getItem(key);

        if (raw === null) {
          return null;
        }

        return JSON.parse(raw);
      } catch (error) {
        console.error(`[SIPFAS] Gagal membaca ${key}:`, error);

        return null;
      }
    }

    function readSessionOrLocalJson(key) {
      try {
        const raw = sessionStorage.getItem(key) || localStorage.getItem(key);

        if (!raw) return null;

        return JSON.parse(raw);
      } catch (error) {
        return null;
      }
    }

    // ====================================================
    // 05. NORMALISASI TEKS
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

      if (role === "petugas") {
        return "petugas";
      }

      if (role === "pelapor" || role === "user") {
        return "pelapor";
      }

      return role;
    }

    // ====================================================
    // 06. MENGAMBIL NILAI PROPERTI
    // ====================================================

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

    // ====================================================
    // 07. MENGAMBIL IDENTITAS LAPORAN
    // ====================================================

    function getReportCode(report, fallback = "") {
      return normalizeCode(
        firstValue(
          report,
          [
            "id",
            "reportCode",
            "report_code",
            "reportId",
            "report_id",
            "kodeLaporan",
            "kode_laporan",
            "code",
          ],
          fallback,
        ),
      );
    }

    // ====================================================
    // 08. NORMALISASI BENTUK DATA
    // ====================================================

    function getCollectionItems(data) {
      if (!data || typeof data !== "object") {
        return [];
      }

      // Format array.
      if (Array.isArray(data)) {
        return data.filter(
          (item) => item && typeof item === "object" && !Array.isArray(item),
        );
      }

      // Format pembungkus reports.
      if (Array.isArray(data.reports)) {
        return data.reports;
      }

      // Format pembungkus data.
      if (Array.isArray(data.data)) {
        return data.data;
      }

      // Format satu objek laporan.
      if (getReportCode(data)) {
        return [data];
      }

      // Format objek berdasarkan kode laporan.
      return Object.entries(data)
        .filter(
          ([, item]) =>
            item && typeof item === "object" && !Array.isArray(item),
        )
        .map(([code, item]) => ({
          ...item,
          id: getReportCode(item, code),
        }));
    }

    // ====================================================
    // 09. NORMALISASI DATA LAPORAN
    // ====================================================

    function normalizeReport(report) {
      const code = getReportCode(report);

      const location = firstValue(
        report,
        [
          "location",
          "facilityLocation",
          "facility_location",
          "lokasi",
          "lokasiFasilitas",
          "lokasi_fasilitas",
          "namaLokasi",
          "building",
          "buildingName",
          "room",
          "roomName",
          "address",
          "alamat",
        ],
        "",
      );

      return {
        ...report,

        id: code,
        reportCode: code,

        reporterName: firstValue(
          report,
          [
            "reporterName",
            "reporter",
            "namaPelapor",
            "nama_pelapor",
            "fullName",
            "name",
            "nama",
          ],
          "Tidak diketahui",
        ),

        reporterNim: firstValue(
          report,
          ["reporterNim", "nim", "NIM", "studentId", "student_id"],
          "",
        ),

        facility: firstValue(
          report,
          [
            "facility",
            "facilityName",
            "namaFasilitas",
            "nama_fasilitas",
            "facility_name",
          ],
          "Fasilitas belum disebutkan",
        ),

        location: location || "Belum dicantumkan",

        description: firstValue(
          report,
          [
            "description",
            "damageDescription",
            "deskripsi",
            "kerusakan",
            "keterangan",
          ],
          "",
        ),

        date: firstValue(
          report,
          [
            "createdAt",
            "created_at",
            "reportDate",
            "report_date",
            "tanggalLaporan",
            "tanggal_laporan",
            "date",
            "timestamp",
          ],
          "",
        ),

        priority: firstValue(
          report,
          [
            "priority",
            "priorityLabel",
            "recommendationPriority",
            "prioritas",
            "rekomendasiPrioritas",
          ],
          "Belum Dinilai",
        ),

        status: firstValue(
          report,
          ["status", "mainStatus", "statusLaporan", "status_laporan"],
          "Menunggu Verifikasi",
        ),
      };
    }

    // ====================================================
    // 10. MENGGABUNGKAN LAPORAN DARI SELURUH PELAPOR
    // ====================================================

    function getAllReports() {
      const primaryData = readStorage(STORAGE.reports);

      const fallbackData = readStorage(STORAGE.fallbackReports);

      const primaryReports = getCollectionItems(primaryData);

      const fallbackReports = getCollectionItems(fallbackData);

      const reportMap = new Map();

      fallbackReports.forEach((report) => {
        const code = getReportCode(report);

        if (!code) return;

        reportMap.set(
          code,
          normalizeReport({
            ...report,
            id: code,
          }),
        );
      });

      primaryReports.forEach((report) => {
        const code = getReportCode(report);

        if (!code) return;

        const existing = reportMap.get(code) || {};

        reportMap.set(
          code,
          normalizeReport({
            ...existing,
            ...report,
            id: code,
          }),
        );
      });

      // =================================================
      // 10A. MENGGABUNGKAN HASIL VERIFIKASI
      // =================================================

      const verificationData = readStorage(STORAGE.verification);

      const verificationItems = getCollectionItems(verificationData);

      verificationItems.forEach((verification) => {
        const code = getReportCode(verification);

        if (!code || !reportMap.has(code)) {
          return;
        }

        const report = reportMap.get(code);

        report.verification = verification;

        report.facility = firstValue(
          verification,
          ["facilityName", "facility", "namaFasilitas"],
          report.facility,
        );

        report.location = firstValue(
          verification,
          ["facilityLocation", "facility_location", "location", "lokasi"],
          report.location,
        );

        report.priority = firstValue(
          verification,
          ["priorityLabel", "priority", "recommendation"],
          report.priority,
        );

        reportMap.set(code, report);
      });

      // =================================================
      // 10B. MENGGABUNGKAN DATA PENANGANAN
      // =================================================

      const handlingData = readStorage(STORAGE.handling);

      const handlingItems = getCollectionItems(handlingData);

      handlingItems.forEach((handling) => {
        const code = getReportCode(handling);

        if (!code || !reportMap.has(code)) {
          return;
        }

        const report = reportMap.get(code);

        report.handling = handling;

        reportMap.set(code, report);
      });

      return Array.from(reportMap.values());
    }

    // ====================================================
    // 11. NORMALISASI STATUS LAPORAN
    // ====================================================

    function getReportState(report) {
      const verification = report.verification || {};
      const handling = report.handling || {};

      const decision = normalizeText(
        firstValue(
          verification,
          ["decision", "verificationResult", "decisionLabel", "result"],
          report.decision || "",
        ),
      );

      const reportStatus = normalizeText(report.status);

      const verificationStatus = normalizeText(
        firstValue(verification, ["status", "verificationStatus"], ""),
      );

      const handlingStatus = normalizeText(
        firstValue(
          handling,
          ["status", "handlingStatus", "statusPenanganan"],
          "",
        ),
      );

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
        verificationStatus.includes("terverifikasi") ||
        verificationStatus === "verified" ||
        handlingStatus.includes("diproses") ||
        handlingStatus.includes("menunggu perbaikan") ||
        handlingStatus.includes("menunggu penanganan") ||
        handlingStatus.includes("sedang dikerjakan") ||
        handlingStatus === "processing" ||
        reportStatus.includes("diproses") ||
        reportStatus.includes("dalam penanganan") ||
        reportStatus.includes("terverifikasi") ||
        reportStatus === "processing"
      ) {
        return "handling";
      }

      return "pending";
    }

    // ====================================================
    // 12. MENGHITUNG STATISTIK DASHBOARD
    // ====================================================

    function calculateStatistics(reports) {
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

    // ====================================================
    // 13. MEMPERBARUI KARTU STATISTIK
    // ====================================================

    function renderStatistics(reports) {
      const stats = calculateStatistics(reports);

      const values = [
        stats.total,
        stats.pending,
        stats.handling,
        stats.completed,
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
    // 14. NORMALISASI PRIORITAS
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

    // ====================================================
    // 15. MEMBACA DAN MEMFORMAT TANGGAL
    // ====================================================

    function parseDate(value) {
      if (!value) return 0;

      if (typeof value === "number") {
        return value;
      }

      const text = String(value).trim();

      const match = text.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);

      if (match) {
        const months = {
          jan: 0,
          januari: 0,
          feb: 1,
          februari: 1,
          mar: 2,
          maret: 2,
          apr: 3,
          april: 3,
          mei: 4,
          jun: 5,
          juni: 5,
          jul: 6,
          juli: 6,
          agu: 7,
          agustus: 7,
          sep: 8,
          september: 8,
          okt: 9,
          oktober: 9,
          nov: 10,
          november: 10,
          des: 11,
          desember: 11,
        };

        const month = months[match[2].toLowerCase()];

        if (month !== undefined) {
          return new Date(Number(match[3]), month, Number(match[1])).getTime();
        }
      }

      const timestamp = new Date(text).getTime();

      return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    function formatDate(value) {
      if (!value) return "—";

      const text = String(value).trim();

      if (/^\d{1,2}\s+[a-zA-Z]+\s+\d{4}$/i.test(text)) {
        return text;
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return text;
      }

      return new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jayapura",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
    }

    // ====================================================
    // 16. MEMBUAT SEL TABEL
    // ====================================================

    function createCell(value, className = "") {
      const cell = document.createElement("td");

      cell.textContent = value || "—";

      if (className) {
        cell.className = className;
      }

      return cell;
    }

    // ====================================================
    // 17. MEMBUAT BADGE PRIORITAS
    // ====================================================

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

    // ====================================================
    // 18. TOMBOL PERIKSA LAPORAN
    // ====================================================

    function createCheckButton(report) {
      const code = getReportCode(report);

      const button = document.createElement("a");

      const destination = new URL(DETAIL_URL, window.location.href);

      destination.searchParams.set("kode", code);

      button.href = destination.href;
      button.className = "action-button";
      button.textContent = "Periksa";

      button.addEventListener("click", function (event) {
        try {
          const selectedReport = {
            ...report,

            id: code,
            reportCode: code,

            reporter: report.reporterName,
            reporterName: report.reporterName,

            facility: report.facility,
            location: report.location,
            date: report.date,
          };

          localStorage.setItem(
            STORAGE.selected,
            JSON.stringify(selectedReport),
          );
        } catch (error) {
          event.preventDefault();

          console.error("[SIPFAS] Gagal menyimpan laporan terpilih:", error);

          alert("Data laporan gagal disiapkan. Silakan coba kembali.");
        }
      });

      return button;
    }

    // ====================================================
    // 19. MENAMPILKAN ANTREAN VERIFIKASI
    // ====================================================

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

        cell.textContent = "Tidak ada laporan yang menunggu verifikasi.";

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

    // ====================================================
    // 20. REFRESH DASHBOARD
    // ====================================================

    function refreshDashboard() {
      const reports = getAllReports();

      const stats = renderStatistics(reports);

      renderPendingReports(reports);

      console.log("[SIPFAS] Dashboard berhasil diperbarui.");

      console.table({
        totalLaporan: stats.total,
        menungguVerifikasi: stats.pending,
        dalamPenanganan: stats.handling,
        selesai: stats.completed,
        tidakValid: stats.invalid,
      });

      return reports;
    }

    // ====================================================
    // 21. MENAMPILKAN & MENYINKRONKAN IDENTITAS + FOTO PETUGAS
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

      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }

    function formatRoleLabel(role) {
      const normalized = normalizeRole(role);
      if (normalized === "administrator") return "Administrator";
      if (normalized === "petugas") return "Petugas";
      if (normalized === "pelapor") return "Pelapor";
      return "Petugas";
    }

    function getActiveOfficerData() {
      const activeUser =
        readSessionOrLocalJson(STORAGE.activeUser) ||
        readSessionOrLocalJson(STORAGE.pendingUser);

      if (!activeUser || typeof activeUser !== "object") {
        return null;
      }

      const users = readStorage(STORAGE.users);
      let matchedAccount = null;

      if (Array.isArray(users)) {
        const activeId = String(activeUser.id || "").trim();
        const activeUsername = normalizeText(activeUser.username);
        const activeEmail = normalizeText(activeUser.email);

        matchedAccount =
          users.find((account) => {
            if (!account) return false;

            const accId = String(account.id || "").trim();
            const accUsername = normalizeText(account.username);
            const accEmail = normalizeText(account.email);

            return (
              (activeId && accId === activeId) ||
              (activeUsername && accUsername === activeUsername) ||
              (activeEmail && accEmail === activeEmail)
            );
          }) || null;
      }

      const merged = {
        ...(matchedAccount || {}),
        ...activeUser,
      };

      const name = String(
        merged.name ||
          merged.fullName ||
          merged.nama ||
          merged.username ||
          "Petugas SIPFAS",
      ).trim();

      const photoKey = merged.username
        ? STORAGE.photoPrefix +
          encodeURIComponent(normalizeText(merged.username))
        : "";

      const photo =
        (photoKey ? localStorage.getItem(photoKey) : null) ||
        merged.avatar ||
        merged.photo ||
        merged.foto ||
        "";

      return {
        name,
        role: merged.role || "petugas",
        roleLabel: formatRoleLabel(merged.role),
        photo,
        initials: getInitials(name),
      };
    }

    function renderAvatarPhoto(avatarEl, name, photo, initials) {
      if (!avatarEl) return;

      if (avatarEl.tagName === "IMG") {
        if (photo) {
          avatarEl.src = photo;
        }
        avatarEl.alt = `Foto profil ${name}`;
        return;
      }

      const svgIcon = avatarEl.querySelector("svg");
      let imgEl = avatarEl.querySelector(".profile-header-photo, img");
      let initialsEl = avatarEl.querySelector(".profile-header-initials");

      if (photo) {
        if (svgIcon) {
          svgIcon.style.display = "none";
        }
        if (initialsEl) {
          initialsEl.remove();
        }

        if (!imgEl) {
          imgEl = document.createElement("img");
          imgEl.className = "profile-header-photo";
          avatarEl.appendChild(imgEl);
        }

        imgEl.src = photo;
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
        if (imgEl) {
          imgEl.remove();
        }
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

      avatarEl.setAttribute(
        "aria-label",
        photo ? `Foto profil ${name}` : `Profil ${name}`,
      );
    }

    function displayActiveUser() {
      try {
        const officer = getActiveOfficerData();

        if (!officer) return;

        const role = normalizeRole(officer.role);

        if (role && role !== "petugas") {
          console.warn("[SIPFAS] Role aktif bukan Petugas.");
          return;
        }

        // Perbarui semua elemen nama profil di Dashboard
        document
          .querySelectorAll(
            ".profile-area .profile-name, #officerName, #petugasName, #profileName, .officer-name, .petugas-name, .profile-name",
          )
          .forEach((el) => {
            el.textContent = officer.name;
          });

        // Perbarui semua elemen jabatan/role di Dashboard
        document
          .querySelectorAll(
            ".profile-area .profile-role, #officerRole, #petugasRole, #profileRole, .officer-role, .petugas-role, .profile-role",
          )
          .forEach((el) => {
            el.textContent = officer.roleLabel;
          });

        // Perbarui foto/avatar profil di Dashboard
        document
          .querySelectorAll(
            ".profile-area .profile-avatar, #profileAvatar, #userAvatar, #officerAvatar, .profile-avatar, .user-avatar",
          )
          .forEach((avatarEl) => {
            renderAvatarPhoto(
              avatarEl,
              officer.name,
              officer.photo,
              officer.initials,
            );
          });

        console.log(
          `[SIPFAS] Profil & foto petugas tersinkronisasi: ${officer.name}`,
        );
      } catch (error) {
        console.error("[SIPFAS] Gagal membaca identitas petugas:", error);
      }
    }

    // ====================================================
    // 22. SIDEBAR RESPONSIF
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
          open ? "Tutup menu" : "Buka menu",
        );
      }
    }

    if (menuToggle) {
      menuToggle.addEventListener("click", function () {
        setSidebar(!sidebar?.classList.contains("open"));
      });
    }

    if (pageOverlay) {
      pageOverlay.addEventListener("click", function () {
        setSidebar(false);
      });
    }

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", function () {
        setSidebar(false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setSidebar(false);
      }
    });

    // ====================================================
    // 23. LOGOUT
    // ====================================================

    function handleLogout(event) {
      event.preventDefault();

      const confirmed = window.confirm(
        "Apakah Anda yakin ingin keluar dari sistem SIPFAS?",
      );

      if (!confirmed) return;

      try {
        // Menghapus sesi autentikasi saja.
        // Data akun dan laporan tetap tersimpan.

        AUTH_SESSION_KEYS.forEach((key) => {
          sessionStorage.removeItem(key);
          localStorage.removeItem(key);
        });

        const loginDestination = new URL(LOGIN_URL, window.location.href);

        console.log("[SIPFAS] Sesi Petugas berhasil diakhiri.");

        window.location.replace(loginDestination.href);
      } catch (error) {
        console.error("[SIPFAS] Gagal melakukan logout:", error);

        alert("Logout belum berhasil. Silakan coba kembali.");
      }
    }

    if (logoutLink) {
      logoutLink.href = new URL(LOGIN_URL, window.location.href).href;

      logoutLink.addEventListener("click", handleLogout);
    } else {
      console.warn("[SIPFAS] Tombol Keluar tidak ditemukan.");
    }

    // ====================================================
    // 24. SINKRONISASI LOCAL STORAGE
    // ====================================================

    const watchedReportKeys = [
      STORAGE.reports,
      STORAGE.fallbackReports,
      STORAGE.verification,
      STORAGE.handling,
      STORAGE.selected,
    ];

    window.addEventListener("storage", function (event) {
      if (event.key === null || watchedReportKeys.includes(event.key)) {
        refreshDashboard();
      }

      if (
        event.key === null ||
        event.key === STORAGE.users ||
        event.key === STORAGE.activeUser ||
        (event.key && event.key.startsWith(STORAGE.photoPrefix))
      ) {
        displayActiveUser();
      }
    });

    // ====================================================
    // 25. SINKRONISASI CUSTOM EVENT SIPFAS
    // ====================================================

    window.addEventListener("sipfas:report-submitted", refreshDashboard);

    window.addEventListener("sipfas:verification-saved", refreshDashboard);

    window.addEventListener("sipfas:handling-saved", refreshDashboard);

    window.addEventListener("sipfas:profile-updated", displayActiveUser);

    // ====================================================
    // 26. REFRESH KETIKA HALAMAN AKTIF
    // ====================================================

    window.addEventListener("pageshow", function () {
      displayActiveUser();
      refreshDashboard();
    });

    window.addEventListener("focus", function () {
      displayActiveUser();
      refreshDashboard();
    });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        displayActiveUser();
        refreshDashboard();
      }
    });

    // ====================================================
    // 27. INISIALISASI AKHIR
    // ====================================================

    displayActiveUser();

    refreshDashboard();

    console.log("[SIPFAS] Dashboard Petugas berhasil diinisialisasi.");

    console.log("[SIPFAS] Sumber data utama:", STORAGE.reports);

    console.log(
      "[SIPFAS] Zona waktu tampilan tanggal: WIT Ternate (UTC+09:00).",
    );
  }
})();
