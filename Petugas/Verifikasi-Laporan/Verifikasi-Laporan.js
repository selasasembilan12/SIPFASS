/* ============================================================
   SIPFAS - VERIFIKASI LAPORAN
   File: Verifikasi-Laporan.js
   VERSI FINAL REVISI SINKRONISASI WAKTU & PROFIL PETUGAS

   FITUR:
   1. Membaca daftar laporan dari tabel HTML.
   2. Membaca identitas nama dan NIM pelapor.
   3. Membaca fasilitas dan lokasi laporan.
   4. Pencarian laporan.
   5. Filter prioritas C4.5.
   6. Sinkronisasi status verifikasi.
   7. Sinkronisasi prioritas hasil verifikasi.
   8. Penyimpanan laporan terpilih.
   9. Navigasi Detail Verifikasi.
   10. Sinkronisasi Local Storage.
   11. Sinkronisasi waktu verifikasi terbaru.
   12. Sinkronisasi profil & foto petugas yang login.
   13. Sidebar responsif.
   14. Konfirmasi keluar.

   LOCAL STORAGE & SESSION STORAGE:
   - sipfas_verifikasi_laporan
   - sipfas_selected_report
   - sipfasActiveUser
   - sipfasUsers
   - sipfas_profile_photo_<username>

   ZONA WAKTU:
   WIT - Ternate, Maluku Utara (UTC+09:00)

   CATATAN:
   Tidak menghapus data laporan.
   Tidak mengubah struktur HTML dan CSS.
   Tidak menggunakan jam realtime.
============================================================ */

(() => {
  "use strict";

  /* ========================================================
       1. INISIALISASI PROGRAM
    ======================================================== */

  document.addEventListener("DOMContentLoaded", initializeVerificationPage);

  function initializeVerificationPage() {
    /* ====================================================
           2. KONFIGURASI
        ==================================================== */

    const STORAGE_KEY = "sipfas_verifikasi_laporan";

    const SELECTED_REPORT_KEY = "sipfas_selected_report";

    const ACTIVE_USER_KEY = "sipfasActiveUser";

    const PENDING_USER_KEY = "sipfasPendingLogin";

    const USERS_KEY = "sipfasUsers";

    const PHOTO_PREFIX = "sipfas_profile_photo_";

    const TIME_ZONE = "Asia/Jayapura";

    const DETAIL_URL =
      "../Detail-Verifikasi-Laporan/Detail-Verifikasi-Laporan.html";

    /* ====================================================
           3. MENGAMBIL ELEMEN HTML
        ==================================================== */

    const $ = (id) => document.getElementById(id);

    const searchInput = $("searchReport");

    const priorityFilter = $("priorityFilter");

    const table = document.querySelector(".verification-table");

    const tableBody = table ? table.querySelector("tbody") : null;

    const emptyState = $("emptyState");

    const sidebar = $("sidebar");

    const menuToggle = $("menuToggle");

    const pageOverlay = $("pageOverlay");

    const logoutLink = $("logoutLink");

    /* ====================================================
           4. VALIDASI ELEMEN HTML
        ==================================================== */

    if (!searchInput || !priorityFilter || !tableBody) {
      console.error(
        "[SIPFAS] Elemen pencarian, filter, atau tabel tidak ditemukan.",
      );

      return;
    }

    /* Mengambil seluruh baris laporan. */

    const reportRows = Array.from(tableBody.querySelectorAll("tr"));

    /* ====================================================
           5. NORMALISASI TEKS
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
           6. NORMALISASI KODE LAPORAN
        ==================================================== */

    function normalizeCode(value) {
      const text = String(value ?? "")
        .replace(/\s+/g, "")
        .trim()
        .toUpperCase();

      const match = text.match(/LPR-\d{4}-\d+/i);

      return match ? match[0].toUpperCase() : text;
    }

    /* ====================================================
           7. NORMALISASI STATUS VERIFIKASI
        ==================================================== */

    function normalizeDecision(value) {
      const decision = normalizeText(value);

      if (
        decision === "valid" ||
        decision === "laporan valid" ||
        decision === "terverifikasi" ||
        decision === "selesai diverifikasi"
      ) {
        return "valid";
      }

      if (
        decision === "invalid" ||
        decision === "tidak valid" ||
        decision === "laporan tidak valid"
      ) {
        return "invalid";
      }

      return "";
    }

    /* ====================================================
           8. NORMALISASI PRIORITAS
        ==================================================== */

    function normalizePriority(value) {
      const priority = normalizeText(value);

      if (priority.includes("tinggi")) {
        return "tinggi";
      }

      if (priority.includes("sedang")) {
        return "sedang";
      }

      if (priority.includes("rendah")) {
        return "rendah";
      }

      return "";
    }

    /* ====================================================
           8B. SINKRONISASI PROFIL & FOTO PETUGAS LOGIN
        ==================================================== */

    function parseStoredJson(storage, key) {
      try {
        const raw = storage.getItem(key);

        if (!raw) return null;

        return JSON.parse(raw);
      } catch (error) {
        console.warn(`[SIPFAS] Gagal membaca data ${key}:`, error);

        return null;
      }
    }

    function formatRoleLabel(role) {
      const value = normalizeText(role);

      if (value === "administrator" || value === "admin") {
        return "Administrator";
      }

      if (value === "petugas") {
        return "Petugas";
      }

      if (value === "pelapor" || value === "user") {
        return "Pelapor";
      }

      return "Petugas";
    }

    function getInitials(name) {
      const parts = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      if (parts.length === 0) return "PT";

      if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
      }

      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function getActiveOfficerProfile() {
      const activeUser =
        parseStoredJson(localStorage, ACTIVE_USER_KEY) ||
        parseStoredJson(sessionStorage, ACTIVE_USER_KEY) ||
        parseStoredJson(sessionStorage, PENDING_USER_KEY) ||
        parseStoredJson(localStorage, PENDING_USER_KEY);

      if (!activeUser || typeof activeUser !== "object") {
        return null;
      }

      const users = parseStoredJson(localStorage, USERS_KEY);

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

      const displayName = String(
        merged.name ||
          merged.fullName ||
          merged.nama ||
          merged.username ||
          "Petugas SIPFAS",
      ).trim();

      const photoKey = merged.username
        ? PHOTO_PREFIX + encodeURIComponent(normalizeText(merged.username))
        : "";

      const storedPhoto =
        (photoKey ? localStorage.getItem(photoKey) : null) ||
        merged.avatar ||
        merged.photo ||
        merged.foto ||
        "";

      return {
        id: merged.id || "",
        name: displayName,
        username: merged.username || "",
        email: merged.email || "",
        role: formatRoleLabel(merged.role),
        avatar: storedPhoto,
        initials: getInitials(displayName),
      };
    }

    function renderAvatarElement(el, profile) {
      if (!el) return;

      if (el.tagName === "IMG") {
        if (profile.avatar) {
          el.src = profile.avatar;
        }

        el.alt = `Foto ${profile.name}`;
        return;
      }

      const svgIcon = el.querySelector("svg");
      let imgInside = el.querySelector(".profile-header-photo, img");
      let initialsEl = el.querySelector(".profile-header-initials");

      if (profile.avatar) {
        if (svgIcon) {
          svgIcon.style.display = "none";
        }

        if (initialsEl) {
          initialsEl.remove();
        }

        if (!imgInside) {
          imgInside = document.createElement("img");
          imgInside.className = "profile-header-photo";
          el.appendChild(imgInside);
        }

        imgInside.src = profile.avatar;
        imgInside.alt = `Foto ${profile.name}`;

        Object.assign(imgInside.style, {
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "cover",
          borderRadius: "50%",
        });

        el.style.overflow = "hidden";
      } else {
        if (imgInside) {
          imgInside.remove();
        }

        if (svgIcon) {
          svgIcon.style.display = "none";
        }

        if (!initialsEl) {
          initialsEl = document.createElement("span");
          initialsEl.className = "profile-header-initials";
          el.appendChild(initialsEl);
        }

        initialsEl.textContent = profile.initials;

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

      el.setAttribute(
        "aria-label",
        profile.avatar
          ? `Foto profil ${profile.name}`
          : `Profil ${profile.name}`,
      );
    }

    function synchronizeOfficerProfile() {
      const profile = getActiveOfficerProfile();

      if (!profile) {
        console.warn("[SIPFAS] Sesi akun petugas aktif tidak ditemukan.");

        return;
      }

      /* Memperbarui nama profil pada header/sidebar. */
      const nameSelectors = [
        "#officerName",
        "#petugasName",
        "#profileName",
        "#userName",
        ".officer-name",
        ".petugas-name",
        ".profile-name",
        ".user-name",
        ".account-name",
        "[data-profile-name]",
        "[data-user-name]",
      ];

      document.querySelectorAll(nameSelectors.join(", ")).forEach((el) => {
        el.textContent = profile.name;
      });

      /* Memperbarui label role/jabatan petugas. */
      const roleSelectors = [
        "#officerRole",
        "#petugasRole",
        "#profileRole",
        "#userRole",
        ".officer-role",
        ".petugas-role",
        ".profile-role",
        ".user-role",
        ".account-role",
        "[data-profile-role]",
        "[data-user-role]",
      ];

      document.querySelectorAll(roleSelectors.join(", ")).forEach((el) => {
        el.textContent = profile.role;
      });

      /* Memperbarui email jika ditampilkan di profil. */
      const emailSelectors = [
        "#officerEmail",
        "#profileEmail",
        "#userEmail",
        ".profile-email",
        ".user-email",
        "[data-profile-email]",
      ];

      if (profile.email) {
        document.querySelectorAll(emailSelectors.join(", ")).forEach((el) => {
          el.textContent = profile.email;
        });
      }

      /* Memperbarui foto avatar atau inisial petugas. */
      const avatarSelectors = [
        ".profile-area .profile-avatar",
        "#profileAvatar",
        "#userAvatar",
        "#officerAvatar",
        ".profile-avatar",
        ".user-avatar",
        ".avatar",
        "[data-profile-avatar]",
      ];

      document.querySelectorAll(avatarSelectors.join(", ")).forEach((el) => {
        renderAvatarElement(el, profile);
      });

      /* Fallback untuk struktur .user-profile / .profile-info tanpa class spesifik anak. */
      const profileContainers = document.querySelectorAll(
        ".user-profile, .profile-box, .header-profile, .sidebar-profile",
      );

      profileContainers.forEach((container) => {
        const hasExplicit = container.querySelector(nameSelectors.join(", "));

        if (hasExplicit) return;

        const strongEl = container.querySelector("strong, h4, h5, .name");

        const subEl = container.querySelector("small, span:not(.avatar), p");

        if (strongEl) {
          strongEl.textContent = profile.name;
        }

        if (subEl && subEl !== strongEl && !subEl.querySelector("img")) {
          subEl.textContent = profile.role;
        }
      });

      console.log(
        `[SIPFAS] Profil & foto petugas tersinkronisasi: ${profile.name} (${profile.role})`,
      );
    }

    /* ====================================================
           9. MEMBERSIHKAN TEKS KOLOM
        ==================================================== */

    function cleanCell(cell) {
      return String(cell?.innerText || cell?.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
    }

    /* ====================================================
           10. MEMBACA KODE LAPORAN
        ==================================================== */

    function getReportCode(row) {
      if (!row) return "";

      return normalizeCode(row.dataset.reportCode || cleanCell(row.cells[0]));
    }

    /* ====================================================
           11. MEMBACA NAMA PELAPOR
        ==================================================== */

    function getReporterName(row) {
      const reporterCell = row?.cells[1];

      if (!reporterCell) return "";

      const strong = reporterCell.querySelector("strong");

      if (strong) {
        return cleanCell(strong);
      }

      const small = reporterCell.querySelector("small");

      let name = cleanCell(reporterCell);

      if (small) {
        name = name.replace(cleanCell(small), "");
      }

      return name.trim();
    }

    /* ====================================================
           12. MEMBACA NIM PELAPOR
        ==================================================== */

    function getReporterNim(row) {
      const reporterCell = row?.cells[1];

      if (!reporterCell) return "";

      const small = reporterCell.querySelector("small");

      if (small) {
        return cleanCell(small);
      }

      const text = cleanCell(reporterCell);

      const match = text.match(/\b\d{6,20}\b/);

      return match ? match[0] : "";
    }

    /* ====================================================
           13. MEMBACA NAMA FASILITAS
        ==================================================== */

    function getFacility(row) {
      return cleanCell(row?.cells[2]);
    }

    /* ====================================================
           14. MEMBACA LOKASI FASILITAS
        ==================================================== */

    function getLocation(row) {
      return cleanCell(row?.cells[3]);
    }

    /* ====================================================
           15. MEMBACA TANGGAL LAPORAN
        ==================================================== */

    function getReportDate(row) {
      const dateCell = row?.cells[4];

      return (
        row?.dataset.createdAt ||
        row?.dataset.reportTime ||
        dateCell?.dataset.timestamp ||
        cleanCell(dateCell)
      );
    }

    /* ====================================================
           16. MEMBACA PRIORITAS LAPORAN
        ==================================================== */

    function getReportPriority(row) {
      const datasetPriority = normalizePriority(row?.dataset.priority);

      if (datasetPriority) {
        return datasetPriority;
      }

      return normalizePriority(cleanCell(row?.cells[5]));
    }

    /* ====================================================
           17. MEMBACA DATA VERIFIKASI
        ==================================================== */

    function getVerificationData() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (raw === null) {
          return {};
        }

        const data = JSON.parse(raw);

        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("Format penyimpanan verifikasi tidak valid.");
        }

        return data;
      } catch (error) {
        console.error("[SIPFAS] Kesalahan membaca data verifikasi:", error);

        return null;
      }
    }

    /* ====================================================
           18. SINKRONISASI WAKTU VERIFIKASI TERBARU
        ==================================================== */

    function getLatestVerificationTimestamp() {
      const verificationData = getVerificationData();

      if (verificationData === null) {
        return null;
      }

      const timestamps = Object.values(verificationData)
        .filter((item) => {
          if (!item || !item.verifiedAt) {
            return false;
          }

          const decision = normalizeDecision(
            item.decision || item.decisionLabel || item.status,
          );

          return Boolean(decision);
        })
        .map((item) => {
          const date = new Date(item.verifiedAt);

          return Number.isNaN(date.getTime()) ? null : date;
        })
        .filter(Boolean);

      if (timestamps.length === 0) {
        return null;
      }

      return timestamps.reduce((latest, current) => {
        return current.getTime() > latest.getTime() ? current : latest;
      });
    }

    /* ====================================================
           19. FORMAT WAKTU WIT
        ==================================================== */

    function formatLatestVerificationTime(timestamp) {
      if (!timestamp) {
        return "Belum ada verifikasi";
      }

      const date = new Date(timestamp);

      if (Number.isNaN(date.getTime())) {
        return "Belum ada verifikasi";
      }

      const time = new Intl.DateTimeFormat("id-ID", {
        timeZone: TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).format(date);

      const reportDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);

      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      if (reportDate === today) {
        return `Hari ini, ${time} WIT`;
      }

      const formattedDate = new Intl.DateTimeFormat("id-ID", {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(date);

      return `${formattedDate}, pukul ${time} WIT`;
    }

    /* ====================================================
           20. MEMPERBARUI TAMPILAN UPDATE TERAKHIR
        ==================================================== */

    function updateLatestVerificationDisplay() {
      const timestamp = getLatestVerificationTimestamp();

      if (timestamp === null) {
        const data = getVerificationData();

        if (data === null) {
          return;
        }
      }

      const formattedTime = formatLatestVerificationTime(timestamp);

      const explicitElement = document.querySelector(
        "#lastUpdate, " +
          "#lastUpdated, " +
          ".last-update, " +
          ".update-terakhir, " +
          "[data-last-update]",
      );

      if (explicitElement) {
        explicitElement.textContent = `Update Terakhir: ${formattedTime}`;

        return;
      }

      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );

      let node;

      while ((node = walker.nextNode())) {
        if (/Update Terakhir\s*:/i.test(node.nodeValue)) {
          node.nodeValue = node.nodeValue.replace(
            /Update Terakhir\s*:.*/i,
            `Update Terakhir: ${formattedTime}`,
          );

          return;
        }
      }

      console.warn("[SIPFAS] Elemen Update Terakhir tidak ditemukan.");
    }

    /* ====================================================
           21. MENYIMPAN LAPORAN TERPILIH
        ==================================================== */

    function saveSelectedReport(report) {
      try {
        localStorage.setItem(SELECTED_REPORT_KEY, JSON.stringify(report));

        const saved = JSON.parse(localStorage.getItem(SELECTED_REPORT_KEY));

        if (!saved || normalizeCode(saved.id) !== normalizeCode(report.id)) {
          throw new Error("Validasi penyimpanan laporan gagal.");
        }

        return true;
      } catch (error) {
        console.error("[SIPFAS] Gagal menyimpan laporan terpilih:", error);

        return false;
      }
    }

    /* ====================================================
           22. SINKRONISASI STATUS VERIFIKASI
        ==================================================== */

    function synchronizeVerification() {
      const verificationData = getVerificationData();

      if (verificationData === null) {
        console.error("[SIPFAS] Sinkronisasi dibatalkan.");

        return;
      }

      reportRows.forEach((row) => {
        const reportCode = getReportCode(row);

        const statusCell = row.cells[6];

        const priorityCell = row.cells[5];

        if (!reportCode || !statusCell) {
          return;
        }

        const statusPill = statusCell.querySelector(".status-pill");

        if (!statusPill) {
          return;
        }

        const savedData = verificationData[reportCode];

        const decision = normalizeDecision(
          savedData?.decision || savedData?.decisionLabel || savedData?.status,
        );

        /* --------------------------------------------
                   LAPORAN BELUM DIVERIFIKASI
                -------------------------------------------- */

        if (!savedData || !decision) {
          statusPill.textContent = "Menunggu Verifikasi";

          row.dataset.verificationStatus = "menunggu";

          statusPill.setAttribute("aria-label", "Menunggu Verifikasi");

          statusPill.removeAttribute("title");

          return;
        }

        /* --------------------------------------------
                   LAPORAN VALID
                -------------------------------------------- */

        if (decision === "valid") {
          statusPill.textContent = "Terverifikasi";

          row.dataset.verificationStatus = "valid";

          statusPill.setAttribute("aria-label", "Terverifikasi");
        }

        /* --------------------------------------------
                   LAPORAN TIDAK VALID
                -------------------------------------------- */

        if (decision === "invalid") {
          statusPill.textContent = "Tidak Valid";

          row.dataset.verificationStatus = "invalid";

          statusPill.setAttribute("aria-label", "Tidak Valid");
        }

        /* --------------------------------------------
                   WAKTU VERIFIKASI
                -------------------------------------------- */

        if (savedData.verifiedAt) {
          const verifiedDate = new Date(savedData.verifiedAt);

          if (!Number.isNaN(verifiedDate.getTime())) {
            statusPill.title =
              "Waktu verifikasi: " + formatLatestVerificationTime(verifiedDate);
          }
        }

        /* --------------------------------------------
                   PRIORITAS HASIL VERIFIKASI
                -------------------------------------------- */

        const latestPriority = normalizePriority(
          savedData.priority || savedData.priorityLabel,
        );

        if (latestPriority && priorityCell) {
          const labels = {
            tinggi: "Tinggi",

            sedang: "Sedang",

            rendah: "Rendah",
          };

          const priorityElement =
            priorityCell.querySelector(".pill, .priority");

          if (priorityElement) {
            priorityElement.textContent = labels[latestPriority];
          }

          row.dataset.priority = latestPriority;
        }
      });

      console.log("[SIPFAS] Sinkronisasi verifikasi berhasil.");
    }

    /* ====================================================
           23. MEMBACA SELURUH INFORMASI LAPORAN
        ==================================================== */

    function getReportText(row) {
      return normalizeText(
        Array.from(row.cells)

          .map((cell) => cleanCell(cell))

          .join(" "),
      );
    }

    /* ====================================================
           24. PENCARIAN LAPORAN
        ==================================================== */

    function matchesSearch(row, keyword) {
      if (!keyword) {
        return true;
      }

      const reportText = getReportText(row);

      const keywords = keyword.split(/\s+/).filter(Boolean);

      return keywords.every((word) => reportText.includes(word));
    }

    /* ====================================================
           25. FILTER PRIORITAS
        ==================================================== */

    function normalizePriorityFilter(value) {
      const normalized = normalizeText(value);

      if (
        !normalized ||
        normalized === "semua" ||
        normalized.includes("semua prioritas")
      ) {
        return "semua";
      }

      return normalizePriority(normalized);
    }

    function matchesPriority(row, selectedPriority) {
      if (!selectedPriority || selectedPriority === "semua") {
        return true;
      }

      return getReportPriority(row) === selectedPriority;
    }

    /* ====================================================
           26. MENJALANKAN PENCARIAN DAN FILTER
        ==================================================== */

    function filterReports() {
      const keyword = normalizeText(searchInput.value);

      const selectedPriority = normalizePriorityFilter(priorityFilter.value);

      let visibleCount = 0;

      reportRows.forEach((row) => {
        const searchMatch = matchesSearch(row, keyword);

        const priorityMatch = matchesPriority(row, selectedPriority);

        const visible = searchMatch && priorityMatch;

        row.hidden = !visible;

        if (visible) {
          row.style.removeProperty("display");

          visibleCount++;
        } else {
          row.style.setProperty("display", "none", "important");
        }
      });

      /* Pesan ketika data tidak ditemukan. */

      if (emptyState) {
        emptyState.hidden = visibleCount > 0;

        emptyState.style.display = visibleCount > 0 ? "none" : "block";
      }

      console.log("[SIPFAS] Jumlah laporan ditemukan:", visibleCount);
    }

    /* ====================================================
           27. EVENT PENCARIAN
        ==================================================== */

    searchInput.addEventListener("input", filterReports);

    searchInput.addEventListener("search", filterReports);

    /* ====================================================
           28. EVENT FILTER
        ==================================================== */

    priorityFilter.addEventListener("change", filterReports);

    /* ====================================================
           29. MEMBENTUK DATA LAPORAN TERPILIH
        ==================================================== */

    function buildSelectedReport(row) {
      const reportCode = getReportCode(row);

      if (!reportCode) {
        return null;
      }

      let existingData = {};

      try {
        const raw = localStorage.getItem(SELECTED_REPORT_KEY);

        existingData = raw ? JSON.parse(raw) || {} : {};
      } catch (error) {
        console.warn(
          "[SIPFAS] Metadata laporan sebelumnya tidak dapat dibaca.",
          error,
        );

        existingData = {};
      }

      const activeOfficer = getActiveOfficerProfile();

      const report = {
        ...existingData,

        id: reportCode,

        reportCode: reportCode,

        reporter: getReporterName(row),

        reporterName: getReporterName(row),

        reporterNim: getReporterNim(row),

        facility: getFacility(row),

        facilityName: getFacility(row),

        location: getLocation(row),

        facilityLocation: getLocation(row),

        date: getReportDate(row),

        priority: getReportPriority(row),

        verifierName: activeOfficer?.name || existingData.verifierName || "",

        verifierId: activeOfficer?.id || existingData.verifierId || "",

        selectedAt: new Date().toISOString(),
      };

      if (!report.reporterName) {
        console.warn("[SIPFAS] Nama pelapor tidak tersedia:", reportCode);
      }

      if (!report.location) {
        console.warn("[SIPFAS] Lokasi laporan tidak tersedia:", reportCode);
      }

      return report;
    }

    /* ====================================================
           30. TOMBOL PERIKSA
        ==================================================== */

    tableBody.addEventListener("click", function (event) {
      const checkButton = event.target.closest(".check-button");

      if (!checkButton) {
        return;
      }

      const selectedRow = checkButton.closest("tr");

      if (!selectedRow) {
        event.preventDefault();

        return;
      }

      const selectedReport = buildSelectedReport(selectedRow);

      if (!selectedReport || !selectedReport.id) {
        event.preventDefault();

        alert("Kode laporan tidak ditemukan.");

        return;
      }

      /* Menyimpan laporan terpilih. */

      const saved = saveSelectedReport(selectedReport);

      if (!saved) {
        event.preventDefault();

        alert("Laporan gagal disimpan. Periksa penyimpanan browser.");

        return;
      }

      /* Memastikan tujuan navigasi benar. */

      try {
        const targetUrl = new URL(
          checkButton.href || DETAIL_URL,
          window.location.href,
        );

        targetUrl.searchParams.set("kode", selectedReport.reportCode);

        checkButton.href = targetUrl.href;
      } catch (error) {
        console.error("[SIPFAS] Kesalahan navigasi:", error);

        event.preventDefault();

        return;
      }

      console.log("[SIPFAS] Laporan terpilih:", selectedReport);
    });

    /* ====================================================
           31. SINKRONISASI LOCAL STORAGE
        ==================================================== */

    window.addEventListener("storage", function (event) {
      if (event.key === STORAGE_KEY || event.key === null) {
        synchronizeVerification();

        filterReports();

        updateLatestVerificationDisplay();
      }

      if (
        event.key === ACTIVE_USER_KEY ||
        event.key === USERS_KEY ||
        (event.key && event.key.startsWith(PHOTO_PREFIX)) ||
        event.key === null
      ) {
        synchronizeOfficerProfile();
      }
    });

    /* ====================================================
           32. SINKRONISASI EVENT VERIFIKASI & PROFIL
        ==================================================== */

    window.addEventListener("sipfas:verification-saved", function () {
      synchronizeVerification();

      filterReports();

      updateLatestVerificationDisplay();
    });

    window.addEventListener(
      "sipfas:profile-updated",
      synchronizeOfficerProfile,
    );

    /* ====================================================
           33. REFRESH SAAT HALAMAN KEMBALI AKTIF
        ==================================================== */

    window.addEventListener("pageshow", function () {
      synchronizeOfficerProfile();

      synchronizeVerification();

      filterReports();

      updateLatestVerificationDisplay();
    });

    window.addEventListener("focus", synchronizeOfficerProfile);

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        synchronizeOfficerProfile();

        synchronizeVerification();

        filterReports();

        updateLatestVerificationDisplay();
      }
    });

    /* ====================================================
           34. SIDEBAR RESPONSIF
        ==================================================== */

    function setSidebar(isOpen) {
      if (!sidebar) return;

      sidebar.classList.toggle("open", isOpen);

      if (pageOverlay) {
        pageOverlay.classList.toggle("show", isOpen);
      }

      if (menuToggle) {
        menuToggle.setAttribute("aria-expanded", String(isOpen));
      }
    }

    /* Membuka sidebar. */

    menuToggle?.addEventListener("click", function () {
      const isOpen = sidebar?.classList.contains("open") || false;

      setSidebar(!isOpen);
    });

    /* Menutup sidebar melalui overlay. */

    pageOverlay?.addEventListener("click", function () {
      setSidebar(false);
    });

    /* Menutup sidebar setelah memilih menu. */

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", function () {
        setSidebar(false);
      });
    });

    /* Menutup sidebar menggunakan Escape. */

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setSidebar(false);
      }
    });

    /* ====================================================
           35. KONFIRMASI KELUAR
        ==================================================== */

    logoutLink?.addEventListener("click", function (event) {
      const confirmation = window.confirm(
        "Apakah Anda yakin ingin keluar dari sistem SIPFAS?",
      );

      if (!confirmation) {
        event.preventDefault();

        return;
      }

      /*
                    Membersihkan sesi login aktif.
                    Data laporan tidak dihapus.
                */
      try {
        localStorage.removeItem(ACTIVE_USER_KEY);
        sessionStorage.removeItem(ACTIVE_USER_KEY);
        sessionStorage.removeItem(PENDING_USER_KEY);
      } catch (error) {
        console.warn("[SIPFAS] Gagal membersihkan sesi aktif:", error);
      }
    });

    /* ====================================================
           36. INISIALISASI AKHIR
        ==================================================== */

    synchronizeOfficerProfile();

    synchronizeVerification();

    filterReports();

    updateLatestVerificationDisplay();

    console.log("==========================================");

    console.log("[SIPFAS] VERIFIKASI LAPORAN AKTIF");

    console.log("[SIPFAS] Total laporan:", reportRows.length);

    console.log("[SIPFAS] Penyimpanan:", STORAGE_KEY);

    console.log("[SIPFAS] Zona waktu:", TIME_ZONE);

    console.log("[SIPFAS] Sinkronisasi waktu, profil & foto petugas aktif.");

    console.log("==========================================");
  }
})();
