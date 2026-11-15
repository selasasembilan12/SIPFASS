/* ============================================================
   SIPFAS - PENANGANAN FASILITAS
   File: Penanganan.js
   VERSI REVISI FINAL + SINKRONISASI PROFIL & FOTO PETUGAS

   STANDAR WAKTU:
   - WIT Maluku Utara (UTC+09:00)
   - Timestamp disimpan dalam ISO 8601 UTC.
   - Tampilan waktu dikonversi menjadi WIT.

   FITUR:
   1. Menampilkan laporan yang telah diverifikasi valid.
   2. Mengambil prioritas terbaru dari hasil verifikasi.
   3. Mengambil status terbaru dari Detail Penanganan.
   4. Menampilkan tanggal pengiriman laporan.
   5. Menampilkan waktu pembaruan terakhir.
   6. Menampilkan waktu mulai penanganan.
   7. Menampilkan waktu penyelesaian.
   8. Pencarian laporan.
   9. Filter berdasarkan prioritas.
   10. Navigasi ke Detail Penanganan.
   11. Sinkronisasi Local Storage.
   12. Sinkronisasi profil & foto petugas yang masuk secara realtime.
   13. Mempertahankan data laporan lainnya.
   14. Sidebar responsif.
   15. Konfirmasi keluar.

   LOCAL STORAGE & SESSION STORAGE:
   - sipfas_verifikasi_laporan
   - sipfas_penanganan_laporan
   - sipfas_selected_report
   - sipfasActiveUser
   - sipfasUsers
   - sipfas_profile_photo_<username>
============================================================ */

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    // ====================================================
    // 01. KONFIGURASI
    // ====================================================

    const STORAGE = {
      verification: "sipfas_verifikasi_laporan",
      handling: "sipfas_penanganan_laporan",
      selected: "sipfas_selected_report",
      activeUser: "sipfasActiveUser",
      pendingUser: "sipfasPendingLogin",
      users: "sipfasUsers",
      photoPrefix: "sipfas_profile_photo_",
    };

    // WIT Maluku Utara menggunakan UTC+09:00.
    const WIT_OFFSET_MS = 9 * 60 * 60 * 1000;

    const HANDLING_STATUS = {
      waiting: {
        label: "Menunggu Perbaikan",
        className: "waiting",
        icon: "⌛",
      },
      processing: {
        label: "Diproses",
        className: "processing",
        icon: "↻",
      },
      completed: {
        label: "Selesai",
        className: "completed",
        icon: "✓",
      },
    };

    // ====================================================
    // 02. ELEMEN HTML
    // ====================================================

    const $ = (id) => document.getElementById(id);

    const searchInput = $("searchHandling");
    const priorityFilter = $("priorityHandling");

    const table = document.querySelector(".handling-table");
    const tableBody = table?.querySelector("tbody");

    const emptyState = $("emptyHandling");

    const sidebar = $("sidebar");
    const menuToggle = $("menuToggle");
    const pageOverlay = $("pageOverlay");
    const logoutLink = $("logoutLink");

    if (!searchInput || !priorityFilter || !tableBody) {
      console.error(
        "[SIPFAS] Elemen pencarian, filter, atau tabel tidak ditemukan.",
      );
      return;
    }

    // ====================================================
    // 03. FUNGSI NORMALISASI
    // ====================================================

    function normalizeText(value) {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    // Menyeragamkan kode laporan.
    function normalizeReportCode(value) {
      return String(value ?? "")
        .replace(/\s+/g, "")
        .trim()
        .toUpperCase();
    }

    // Menyeragamkan prioritas C4.5.
    function normalizePriority(value) {
      const text = normalizeText(value);

      if (text.includes("tinggi") || text === "high") {
        return "tinggi";
      }

      if (text.includes("sedang") || text === "medium") {
        return "sedang";
      }

      if (text.includes("rendah") || text === "low") {
        return "rendah";
      }

      return "tidak diketahui";
    }

    // Memastikan hanya laporan valid yang masuk penanganan.
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

    // Mengonversi status ke tiga kategori utama.
    function normalizeHandlingStatus(status) {
      const value = normalizeText(status);

      if (
        [
          "selesai",
          "completed",
          "selesai ditangani",
          "selesai diperbaiki",
        ].includes(value)
      ) {
        return "completed";
      }

      if (
        ["diproses", "processing", "sedang diproses", "dalam proses"].includes(
          value,
        )
      ) {
        return "processing";
      }

      return "waiting";
    }

    // ====================================================
    // 03B. SINKRONISASI PROFIL & FOTO PETUGAS LOGIN
    // ====================================================

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
        parseStoredJson(localStorage, STORAGE.activeUser) ||
        parseStoredJson(sessionStorage, STORAGE.activeUser) ||
        parseStoredJson(sessionStorage, STORAGE.pendingUser) ||
        parseStoredJson(localStorage, STORAGE.pendingUser);

      if (!activeUser || typeof activeUser !== "object") {
        return null;
      }

      const users = parseStoredJson(localStorage, STORAGE.users);
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
        ? STORAGE.photoPrefix +
          encodeURIComponent(normalizeText(merged.username))
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

    // ====================================================
    // 04. FUNGSI WAKTU WIT MALUKU UTARA
    // ====================================================

    // Memvalidasi timestamp dari penyimpanan.
    function parseTimestamp(value) {
      if (!value) return null;

      const date =
        typeof value === "number" ? new Date(value) : new Date(value);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return date;
    }

    // Mengubah timestamp UTC menjadi waktu WIT.
    function formatWIT(value, includeSeconds = true) {
      const date = parseTimestamp(value);

      if (!date) return "Belum tersedia";

      const witDate = new Date(date.getTime() + WIT_OFFSET_MS);

      return (
        new Intl.DateTimeFormat("id-ID", {
          timeZone: "UTC",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: includeSeconds ? "2-digit" : undefined,
          hour12: false,
        }).format(witDate) + " WIT"
      );
    }

    // Memformat tanggal laporan tanpa mengubah nilai aslinya.
    function formatReportDate(value) {
      if (!value) return "—";

      const date = parseTimestamp(value);

      if (!date) {
        return String(value);
      }

      const witDate = new Date(date.getTime() + WIT_OFFSET_MS);

      return new Intl.DateTimeFormat("id-ID", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(witDate);
    }

    // Mengambil waktu pembaruan yang valid.
    function getUpdatedTimestamp(record) {
      return (
        record?.updatedAt ||
        record?.updated_at ||
        record?.lastUpdated ||
        record?.tanggalPembaruan ||
        null
      );
    }

    // ====================================================
    // 05. MEMBACA LOCAL STORAGE
    // ====================================================

    function readStorage(key) {
      try {
        const raw = localStorage.getItem(key);

        if (raw === null) return {};

        const data = JSON.parse(raw);

        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("Format penyimpanan tidak valid.");
        }

        return data;
      } catch (error) {
        console.error(`[SIPFAS] Gagal membaca ${key}:`, error);

        return null;
      }
    }

    // ====================================================
    // 06. DATA CADANGAN DARI HTML
    // ====================================================

    const originalReportData = {};

    Array.from(tableBody.querySelectorAll("tr")).forEach((row) => {
      const code = normalizeReportCode(row.cells[0]?.innerText);

      if (!code) return;

      const facilityCell = row.cells[1];
      const locationCell = row.cells[2];
      const priorityCell = row.cells[3];
      const dateCell = row.cells[5];

      originalReportData[code] = {
        facility:
          facilityCell?.querySelector("strong")?.textContent.trim() || "",

        damage: facilityCell?.querySelector("small")?.textContent.trim() || "",

        location: locationCell?.innerText.trim() || "",

        priority: priorityCell?.innerText.trim() || "",

        date: dateCell?.innerText.trim() || "",
      };
    });

    // ====================================================
    // 07. IDENTITAS LAPORAN
    // ====================================================

    function getReportCode(report, storageKey = "") {
      return normalizeReportCode(
        report?.reportCode ||
          report?.report_code ||
          report?.id ||
          report?.reportId ||
          report?.report_id ||
          report?.kodeLaporan ||
          report?.kode_laporan ||
          storageKey,
      );
    }

    // ====================================================
    // 08. VALIDASI KELAYAKAN PENANGANAN
    // ====================================================

    function isEligibleForHandling(verification) {
      if (!verification) return false;

      const decision = normalizeDecision(
        verification.decision || verification.decisionLabel,
      );

      if (decision !== "valid") {
        return false;
      }

      const status = normalizeText(verification.status || "");

      if (
        status &&
        !["selesai diverifikasi", "terverifikasi", "verified"].includes(status)
      ) {
        return false;
      }

      return true;
    }

    // ====================================================
    // 09. MEMBUAT BADGE STATUS
    // ====================================================

    function createStatusBadge(status) {
      const normalized = normalizeHandlingStatus(status);
      const config = HANDLING_STATUS[normalized];

      const badge = document.createElement("span");

      badge.className = `status-badge ${config.className}`;

      badge.dataset.status = normalized;

      const icon = document.createElement("span");

      icon.setAttribute("aria-hidden", "true");
      icon.textContent = config.icon;

      badge.appendChild(icon);

      badge.appendChild(document.createTextNode(` ${config.label}`));

      badge.setAttribute("aria-label", config.label);

      return badge;
    }

    // ====================================================
    // 10. MEMBUAT BADGE PRIORITAS
    // ====================================================

    function createPriorityBadge(priority) {
      const badge = document.createElement("span");

      badge.className = `priority-badge ${priority}`;

      badge.dataset.priority = priority;

      const labels = {
        tinggi: "Tinggi",
        sedang: "Sedang",
        rendah: "Rendah",
        "tidak diketahui": "Tidak Diketahui",
      };

      badge.textContent = labels[priority] || "Tidak Diketahui";

      return badge;
    }

    // ====================================================
    // 11. MEMBUAT INFORMASI WAKTU PEMBARUAN
    // ====================================================

    function createUpdatedTimeElement(timestamp) {
      const element = document.createElement("small");

      element.className = "handling-updated-time";

      if (timestamp) {
        element.textContent = "Diperbarui: " + formatWIT(timestamp, false);

        element.title = "Pembaruan terakhir: " + formatWIT(timestamp);
      } else {
        element.textContent = "Belum diperbarui";

        element.title = "Belum ada pembaruan penanganan.";
      }

      Object.assign(element.style, {
        display: "block",
        marginTop: "5px",
        fontSize: "10px",
        lineHeight: "1.5",
        color: "#737e8c",
        fontWeight: "400",
      });

      return element;
    }

    // ====================================================
    // 12. MEMBUAT BARIS LAPORAN
    // ====================================================

    function createReportRow(verification, handlingData, storageKey) {
      const reportCode = getReportCode(verification, storageKey);

      const original = originalReportData[reportCode] || {};

      const priority = normalizePriority(
        verification.priority ||
          verification.priorityLabel ||
          verification.recommendation ||
          original.priority,
      );

      const facility =
        verification.facilityName ||
        verification.facility ||
        verification.namaFasilitas ||
        original.facility ||
        "Data fasilitas tidak tersedia";

      const damage =
        verification.damageDescription ||
        verification.description ||
        verification.kerusakan ||
        original.damage ||
        "Deskripsi kerusakan tidak tersedia";

      const location =
        verification.facilityLocation ||
        verification.location ||
        verification.lokasi ||
        original.location ||
        "Lokasi tidak tersedia";

      const reportDate =
        verification.createdAt ||
        verification.reportCreatedAt ||
        verification.reportTime ||
        verification.reportDate ||
        verification.date ||
        verification.tanggalLaporan ||
        original.date ||
        "—";

      const savedHandling = handlingData[reportCode] || {};

      const handlingStatus = normalizeHandlingStatus(
        savedHandling.status ||
          savedHandling.handlingStatus ||
          savedHandling.statusPenanganan ||
          "waiting",
      );

      const updatedAt = getUpdatedTimestamp(savedHandling);

      const row = document.createElement("tr");

      row.dataset.priority = priority;
      row.dataset.reportCode = reportCode;
      row.dataset.verificationStatus = "valid";
      row.dataset.handlingStatus = handlingStatus;

      // KOLOM 1: KODE LAPORAN.
      const codeCell = document.createElement("td");

      const codeBadge = document.createElement("span");

      codeBadge.className = `report-id ${priority}`;
      codeBadge.textContent = reportCode;

      codeCell.appendChild(codeBadge);

      // KOLOM 2: FASILITAS DAN DESKRIPSI KERUSAKAN.
      const facilityCell = document.createElement("td");

      facilityCell.className = "facility";

      const facilityName = document.createElement("strong");

      facilityName.textContent = facility;

      const damageDescription = document.createElement("small");

      damageDescription.textContent = damage;

      facilityCell.appendChild(facilityName);
      facilityCell.appendChild(damageDescription);

      // KOLOM 3: LOKASI.
      const locationCell = document.createElement("td");

      const locationElement = document.createElement("span");

      locationElement.className = "location";
      locationElement.textContent = location;

      locationCell.appendChild(locationElement);

      // KOLOM 4: PRIORITAS.
      const priorityCell = document.createElement("td");

      priorityCell.appendChild(createPriorityBadge(priority));

      // KOLOM 5: STATUS DAN WAKTU PEMBARUAN.
      const statusCell = document.createElement("td");

      statusCell.appendChild(createStatusBadge(handlingStatus));

      statusCell.appendChild(createUpdatedTimeElement(updatedAt));

      // KOLOM 6: TANGGAL PENGIRIMAN LAPORAN.
      const dateCell = document.createElement("td");

      dateCell.className = "date";

      dateCell.textContent = formatReportDate(reportDate);

      // KOLOM 7: TOMBOL KELOLA.
      const actionCell = document.createElement("td");

      const manageLink = document.createElement("a");

      manageLink.className = "manage-button";
      manageLink.textContent = "Kelola Penanganan";

      const detailURL = new URL(
        "../Detail-Penanganan/Detail-Penanganan.html",
        window.location.href,
      );

      detailURL.searchParams.set("kode", reportCode);

      manageLink.href = detailURL.href;

      // Menyimpan laporan aktif beserta identitas petugas sebelum berpindah halaman.
      manageLink.addEventListener("click", () => {
        try {
          const activeOfficer = getActiveOfficerProfile();

          localStorage.setItem(
            STORAGE.selected,
            JSON.stringify({
              id: reportCode,
              reportCode,

              reporterName:
                verification.reporterName || verification.namaPelapor || "",

              reporterNim: verification.reporterNim || verification.nim || "",

              facility,
              location,
              date: reportDate,
              priority,
              description: damage,
              handlerName: activeOfficer?.name || "",
              handlerId: activeOfficer?.id || "",
            }),
          );
        } catch (error) {
          console.error("[SIPFAS] Gagal menyimpan laporan terpilih:", error);
        }
      });

      actionCell.appendChild(manageLink);

      // Menggabungkan seluruh kolom.
      row.append(
        codeCell,
        facilityCell,
        locationCell,
        priorityCell,
        statusCell,
        dateCell,
        actionCell,
      );

      // Menyediakan data untuk pencarian.
      row.dataset.search = normalizeText(
        [
          reportCode,
          facility,
          damage,
          location,
          priority,
          reportDate,
          handlingStatus,
          updatedAt ? formatWIT(updatedAt) : "",
        ].join(" "),
      );

      return row;
    }

    // ====================================================
    // 13. MEMUAT DAFTAR PENANGANAN
    // ====================================================

    function loadHandlingReports() {
      const verificationData = readStorage(STORAGE.verification);

      const handlingData = readStorage(STORAGE.handling);

      if (verificationData === null || handlingData === null) {
        tableBody.replaceChildren();

        showEmptyState(
          "Data verifikasi atau penanganan tidak dapat dibaca. Periksa Local Storage.",
        );

        return;
      }

      const uniqueReports = new Map();

      Object.entries(verificationData).forEach(([key, verification]) => {
        if (!isEligibleForHandling(verification)) {
          return;
        }

        const reportCode = getReportCode(verification, key);

        if (!reportCode) return;

        uniqueReports.set(reportCode, {
          ...verification,
          reportCode,
        });
      });

      const fragment = document.createDocumentFragment();

      uniqueReports.forEach((verification) => {
        const row = createReportRow(
          verification,
          handlingData,
          verification.reportCode,
        );

        fragment.appendChild(row);
      });

      tableBody.replaceChildren(fragment);

      filterHandling();

      console.log("[SIPFAS] Daftar penanganan diperbarui:", uniqueReports.size);
    }

    // ====================================================
    // 14. PESAN DATA KOSONG
    // ====================================================

    function showEmptyState(message) {
      if (!emptyState) return;

      emptyState.textContent = message;
      emptyState.hidden = false;
      emptyState.style.display = "block";
    }

    // ====================================================
    // 15. PENCARIAN LAPORAN
    // ====================================================

    function matchesSearch(row, keyword) {
      if (!keyword) return true;

      const content = normalizeText(row.dataset.search || row.innerText);

      const words = keyword.split(/\s+/).filter(Boolean);

      return words.every((word) => content.includes(word));
    }

    // ====================================================
    // 16. FILTER PRIORITAS
    // ====================================================

    function matchesPriority(row, selectedPriority) {
      if (!selectedPriority || selectedPriority === "semua") {
        return true;
      }

      return normalizeText(row.dataset.priority) === selectedPriority;
    }

    // ====================================================
    // 17. PENCARIAN DAN FILTER UTAMA
    // ====================================================

    function filterHandling() {
      const rows = Array.from(tableBody.querySelectorAll("tr"));

      const keyword = normalizeText(searchInput.value);

      const selectedPriority = normalizeText(priorityFilter.value);

      let visibleCount = 0;

      rows.forEach((row) => {
        const visible =
          matchesSearch(row, keyword) && matchesPriority(row, selectedPriority);

        row.hidden = !visible;

        if (visible) {
          row.style.removeProperty("display");
          visibleCount++;
        } else {
          row.style.setProperty("display", "none", "important");
        }
      });

      if (!emptyState) return;

      if (rows.length === 0) {
        showEmptyState("Belum ada laporan yang memenuhi syarat penanganan.");
      } else if (visibleCount === 0) {
        showEmptyState(
          "Tidak ada laporan yang cocok dengan pencarian atau filter.",
        );
      } else {
        emptyState.hidden = true;
        emptyState.style.display = "none";
      }
    }

    // ====================================================
    // 18. EVENT PENCARIAN DAN FILTER
    // ====================================================

    searchInput.addEventListener("input", filterHandling);

    searchInput.addEventListener("search", filterHandling);

    priorityFilter.addEventListener("change", filterHandling);

    // ====================================================
    // 19. SINKRONISASI PERUBAHAN DATA & PROFIL REALTIME
    // ====================================================

    window.addEventListener("sipfas:handling-saved", loadHandlingReports);

    window.addEventListener("sipfas:verification-saved", loadHandlingReports);

    window.addEventListener(
      "sipfas:profile-updated",
      synchronizeOfficerProfile,
    );

    window.addEventListener("storage", (event) => {
      if (
        event.key === STORAGE.verification ||
        event.key === STORAGE.handling ||
        event.key === null
      ) {
        loadHandlingReports();
      }

      if (
        event.key === STORAGE.activeUser ||
        event.key === STORAGE.users ||
        (event.key && event.key.startsWith(STORAGE.photoPrefix)) ||
        event.key === null
      ) {
        synchronizeOfficerProfile();
      }
    });

    window.addEventListener("pageshow", () => {
      synchronizeOfficerProfile();
      loadHandlingReports();
    });

    window.addEventListener("focus", synchronizeOfficerProfile);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        synchronizeOfficerProfile();
        loadHandlingReports();
      }
    });

    // ====================================================
    // 20. SIDEBAR RESPONSIF
    // ====================================================

    function setSidebar(isOpen) {
      if (!sidebar) return;

      sidebar.classList.toggle("open", isOpen);

      pageOverlay?.classList.toggle("show", isOpen);

      pageOverlay?.classList.toggle("active", isOpen);

      menuToggle?.setAttribute("aria-expanded", String(isOpen));
    }

    menuToggle?.addEventListener("click", () => {
      const isOpen =
        sidebar.classList.contains("open") ||
        sidebar.classList.contains("active");

      setSidebar(!isOpen);
    });

    pageOverlay?.addEventListener("click", () => setSidebar(false));

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => setSidebar(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setSidebar(false);
      }
    });

    // ====================================================
    // 21. KONFIRMASI KELUAR
    // ====================================================

    logoutLink?.addEventListener("click", (event) => {
      event.preventDefault();

      const confirmation = window.confirm(
        "Apakah Anda yakin ingin keluar dari sistem SIPFAS?",
      );

      if (!confirmation) return;

      // Menghapus sesi autentikasi saja.
      // Data laporan di Local Storage tetap dipertahankan.
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
        localStorage.removeItem(key);
      });

      window.location.replace(logoutLink.href);
    });

    // ====================================================
    // 22. INISIALISASI HALAMAN
    // ====================================================

    synchronizeOfficerProfile();
    loadHandlingReports();

    console.log(
      "[SIPFAS] Halaman Penanganan & foto profil petugas berhasil diinisialisasi.",
    );

    console.log("[SIPFAS] Zona waktu: WIT Maluku Utara (UTC+09:00).");
  }
})();
