//VERIFIKASI-LAPORAN.JS

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initializeVerificationPage);

  function initializeVerificationPage() {
    // 01. KONFIGURASI
    const STORAGE_KEY = "sipfas_verifikasi_laporan";
    const SELECTED_REPORT_KEY = "sipfas_selected_report";
    const ACTIVE_USER_KEY = "sipfasActiveUser";
    const PENDING_USER_KEY = "sipfasPendingLogin";
    const USERS_KEY = "sipfasUsers";
    const PHOTO_PREFIX = "sipfas_profile_photo_";
    const TIME_ZONE = "Asia/Jayapura";
    const DETAIL_URL = "../Detail-Verifikasi-Laporan/Detail-Verifikasi-Laporan.html";

    // 02. ELEMEN HTML
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

    if (!searchInput || !priorityFilter || !tableBody) {
      console.error("[SIPFAS] Elemen pencarian, filter, atau tabel tidak ditemukan.");
      return;
    }

    const reportRows = Array.from(tableBody.querySelectorAll("tr"));

    // 03. FUNGSI NORMALISASI
    function normalizeText(value) {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    function normalizeCode(value) {
      const text = String(value ?? "").replace(/\s+/g, "").trim().toUpperCase();
      const match = text.match(/LPR-\d{4}-\d+/i);
      return match ? match[0].toUpperCase() : text;
    }

    function normalizeDecision(value) {
      const decision = normalizeText(value);
      if (["valid", "laporan valid", "terverifikasi", "selesai diverifikasi"].includes(decision)) {
        return "valid";
      }
      if (["invalid", "tidak valid", "laporan tidak valid"].includes(decision)) {
        return "invalid";
      }
      return "";
    }

    function normalizePriority(value) {
      const priority = normalizeText(value);
      if (priority.includes("tinggi")) return "tinggi";
      if (priority.includes("sedang")) return "sedang";
      if (priority.includes("rendah")) return "rendah";
      return "";
    }

    // 04. SINKRONISASI PROFIL & FOTO PETUGAS
    function parseStoredJson(storage, key) {
      try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.warn(`[SIPFAS] Gagal membaca data ${key}:`, error);
        return null;
      }
    }

    function formatRoleLabel(role) {
      const value = normalizeText(role);
      if (value === "administrator" || value === "admin") return "Administrator";
      if (value === "petugas") return "Petugas";
      if (value === "pelapor" || value === "user") return "Pelapor";
      return "Petugas";
    }

    function getInitials(name) {
      const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return "PT";
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    // 04. IDENTITAS PETUGAS DARI SESSION PHP / DATABASE
    const PROFILE_API = "../../api/shared/profil-login.php";
    const LOGOUT_API = "../../api/auth/logout.php";
    const LOGIN_PAGE = "../../auth/Login.html";
    let currentOfficerProfile = null;

    function getActiveOfficerProfile() {
      return currentOfficerProfile;
    }

    function getInitials(name) {
      const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return "PT";
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function normalizeOfficerRole(role) {
      const value = normalizeText(role);
      if (value.includes("admin")) return "Administrator";
      if (value.includes("petugas")) return "Petugas Sarana Prasarana";
      if (value.includes("pelapor") || value === "user") return "Pelapor";
      return String(role || "Pengguna").trim();
    }

    function resolveOfficerPhoto(path) {
      if (!path) return "";
      const value = String(path);
      if (/^(data:|https?:\/\/|blob:)/i.test(value)) return value;
      return new URL("../../" + value.replace(/^\/+/, ""), window.location.href).href;
    }

    function renderAvatarElement(el, profile) {
      if (!el) return;
      const photo = resolveOfficerPhoto(profile.avatar);

      if (el.tagName === "IMG") {
        if (photo) el.src = photo;
        el.alt = `Foto ${profile.name}`;
        return;
      }

      const svgIcon = el.querySelector("svg");
      let imgInside = el.querySelector(".profile-header-photo, img");
      let initialsEl = el.querySelector(".profile-header-initials");

      if (photo) {
        if (svgIcon) svgIcon.style.display = "none";
        if (initialsEl) initialsEl.remove();
        if (!imgInside) {
          imgInside = document.createElement("img");
          imgInside.className = "profile-header-photo";
          el.appendChild(imgInside);
        }
        imgInside.src = photo;
        imgInside.alt = `Foto ${profile.name}`;
        Object.assign(imgInside.style, {
          width: "100%", height: "100%", display: "block",
          objectFit: "cover", borderRadius: "50%",
        });
      } else {
        if (imgInside) imgInside.remove();
        if (svgIcon) svgIcon.style.display = "none";
        if (!initialsEl) {
          initialsEl = document.createElement("span");
          initialsEl.className = "profile-header-initials";
          el.appendChild(initialsEl);
        }
        initialsEl.textContent = profile.initials;
        Object.assign(initialsEl.style, {
          display: "flex", width: "100%", height: "100%",
          alignItems: "center", justifyContent: "center",
          color: "#ffffff", fontWeight: "700", fontSize: "14px",
        });
      }

      el.style.overflow = "hidden";
      el.setAttribute("aria-label", photo ? `Foto profil ${profile.name}` : `Profil ${profile.name}`);
    }

    async function synchronizeOfficerProfile() {
      try {
        const response = await fetch(PROFILE_API, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const payload = await response.json();

        if (response.status === 401) {
          window.location.replace(LOGIN_PAGE);
          return null;
        }
        if (!response.ok || payload.success !== true || !payload.user) {
          throw new Error(payload.message || "Profil petugas tidak dapat dimuat.");
        }

        const user = payload.user;
        const displayName = String(user.nama_lengkap || user.nama_pengguna || "Petugas SIPFAS").trim();
        currentOfficerProfile = {
          id: String(user.id_pengguna || ""),
          name: displayName,
          username: String(user.nama_pengguna || ""),
          email: String(user.email || ""),
          role: normalizeOfficerRole(user.nama_peran),
          avatar: String(user.foto_profil || ""),
          initials: getInitials(displayName),
        };

        const profile = currentOfficerProfile;
        const nameSelectors = [
          "#officerName", "#petugasName", "#profileName", "#userName",
          ".officer-name", ".petugas-name", ".profile-name", ".user-name",
          ".account-name", "[data-profile-name]", "[data-user-name]",
        ];
        document.querySelectorAll(nameSelectors.join(", ")).forEach((el) => {
          el.textContent = profile.name;
        });

        const roleSelectors = [
          "#officerRole", "#petugasRole", "#profileRole", "#userRole",
          ".officer-role", ".petugas-role", ".profile-role", ".user-role",
          ".account-role", "[data-profile-role]", "[data-user-role]",
        ];
        document.querySelectorAll(roleSelectors.join(", ")).forEach((el) => {
          el.textContent = profile.role;
        });

        const emailSelectors = [
          "#officerEmail", "#profileEmail", "#userEmail",
          ".profile-email", ".user-email", "[data-profile-email]",
        ];
        document.querySelectorAll(emailSelectors.join(", ")).forEach((el) => {
          el.textContent = profile.email;
        });

        const avatarSelectors = [
          ".profile-area .profile-avatar", "#profileAvatar", "#userAvatar",
          "#officerAvatar", ".profile-avatar", ".user-avatar",
          ".avatar", "[data-profile-avatar]",
        ];
        document.querySelectorAll(avatarSelectors.join(", ")).forEach((el) => {
          renderAvatarElement(el, profile);
        });

        console.log(`[SIPFAS] Profil server tersinkronisasi: ${profile.name} (${profile.role}).`);
        return profile;
      } catch (error) {
        console.error("[SIPFAS] Gagal menyinkronkan profil dari server:", error);
        return null;
      }
    }

    async function performLogout(event) {
      event.preventDefault();
      if (!window.confirm("Apakah Anda yakin ingin keluar dari sistem SIPFAS?")) return;
      try {
        const response = await fetch(LOGOUT_API, {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const payload = await response.json();
        if (!response.ok || payload.success !== true) {
          throw new Error(payload.message || "Logout gagal.");
        }
        window.location.replace(LOGIN_PAGE);
      } catch (error) {
        console.error("[SIPFAS] Logout gagal:", error);
        window.alert(error.message || "Tidak dapat mengakhiri sesi.");
      }
    }

    // 05. EKSTRAKSI DATA BARIS TABEL
    function cleanCell(cell) {
      return String(cell?.innerText || cell?.textContent || "").replace(/\s+/g, " ").trim();
    }

    function getReportCode(row) {
      return row ? normalizeCode(row.dataset.reportCode || cleanCell(row.cells[0])) : "";
    }

    function getReporterName(row) {
      const reporterCell = row?.cells[1];
      if (!reporterCell) return "";
      const strong = reporterCell.querySelector("strong");
      if (strong) return cleanCell(strong);

      const small = reporterCell.querySelector("small");
      let name = cleanCell(reporterCell);
      if (small) name = name.replace(cleanCell(small), "");
      return name.trim();
    }

    function getReporterNim(row) {
      const reporterCell = row?.cells[1];
      if (!reporterCell) return "";
      const small = reporterCell.querySelector("small");
      if (small) return cleanCell(small);

      const match = cleanCell(reporterCell).match(/\b\d{6,20}\b/);
      return match ? match[0] : "";
    }

    function getFacility(row) {
      return cleanCell(row?.cells[2]);
    }

    function getLocation(row) {
      return cleanCell(row?.cells[3]);
    }

    function getReportDate(row) {
      const dateCell = row?.cells[4];
      return (
        row?.dataset.createdAt ||
        row?.dataset.reportTime ||
        dateCell?.dataset.timestamp ||
        cleanCell(dateCell)
      );
    }

    function getReportPriority(row) {
      const datasetPriority = normalizePriority(row?.dataset.priority);
      return datasetPriority || normalizePriority(cleanCell(row?.cells[5]));
    }

    // 06. VERIFIKASI, STORAGE & FORMAT WAKTU
    function getVerificationData() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return {};
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

    function getLatestVerificationTimestamp() {
      const verificationData = getVerificationData();
      if (verificationData === null) return null;

      const timestamps = Object.values(verificationData)
        .filter((item) => {
          if (!item || !item.verifiedAt) return false;
          return Boolean(normalizeDecision(item.decision || item.decisionLabel || item.status));
        })
        .map((item) => {
          const date = new Date(item.verifiedAt);
          return Number.isNaN(date.getTime()) ? null : date;
        })
        .filter(Boolean);

      if (timestamps.length === 0) return null;
      return timestamps.reduce((latest, current) =>
        current.getTime() > latest.getTime() ? current : latest,
      );
    }

    function formatLatestVerificationTime(timestamp) {
      if (!timestamp) return "Belum ada verifikasi";
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return "Belum ada verifikasi";

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

      if (reportDate === today) return `Hari ini, ${time} WIT`;

      const formattedDate = new Intl.DateTimeFormat("id-ID", {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(date);

      return `${formattedDate}, pukul ${time} WIT`;
    }

    function updateLatestVerificationDisplay() {
      const timestamp = getLatestVerificationTimestamp();
      if (timestamp === null && getVerificationData() === null) return;

      const formattedTime = formatLatestVerificationTime(timestamp);
      const explicitElement = document.querySelector(
        "#lastUpdate, #lastUpdated, .last-update, .update-terakhir, [data-last-update]",
      );

      if (explicitElement) {
        explicitElement.textContent = `Update Terakhir: ${formattedTime}`;
        return;
      }

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
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
        if (!reportCode || !statusCell) return;

        const statusPill = statusCell.querySelector(".status-pill");
        if (!statusPill) return;

        const savedData = verificationData[reportCode];
        const decision = normalizeDecision(
          savedData?.decision || savedData?.decisionLabel || savedData?.status,
        );

        if (!savedData || !decision) {
          statusPill.textContent = "Menunggu Verifikasi";
          row.dataset.verificationStatus = "menunggu";
          statusPill.setAttribute("aria-label", "Menunggu Verifikasi");
          statusPill.removeAttribute("title");
          return;
        }

        if (decision === "valid") {
          statusPill.textContent = "Terverifikasi";
          row.dataset.verificationStatus = "valid";
          statusPill.setAttribute("aria-label", "Terverifikasi");
        } else if (decision === "invalid") {
          statusPill.textContent = "Tidak Valid";
          row.dataset.verificationStatus = "invalid";
          statusPill.setAttribute("aria-label", "Tidak Valid");
        }

        if (savedData.verifiedAt) {
          const verifiedDate = new Date(savedData.verifiedAt);
          if (!Number.isNaN(verifiedDate.getTime())) {
            statusPill.title = "Waktu verifikasi: " + formatLatestVerificationTime(verifiedDate);
          }
        }

        const latestPriority = normalizePriority(savedData.priority || savedData.priorityLabel);
        if (latestPriority && priorityCell) {
          const labels = { tinggi: "Tinggi", sedang: "Sedang", rendah: "Rendah" };
          const priorityElement = priorityCell.querySelector(".pill, .priority");
          if (priorityElement) priorityElement.textContent = labels[latestPriority];
          row.dataset.priority = latestPriority;
        }
      });

      console.log("[SIPFAS] Sinkronisasi verifikasi berhasil.");
    }

    // 07. PENCARIAN, FILTER & LAPORAN TERPILIH
    function getReportText(row) {
      return normalizeText(Array.from(row.cells).map((cell) => cleanCell(cell)).join(" "));
    }

    function matchesSearch(row, keyword) {
      if (!keyword) return true;
      const reportText = getReportText(row);
      const keywords = keyword.split(/\s+/).filter(Boolean);
      return keywords.every((word) => reportText.includes(word));
    }

    function normalizePriorityFilter(value) {
      const normalized = normalizeText(value);
      if (!normalized || normalized === "semua" || normalized.includes("semua prioritas")) {
        return "semua";
      }
      return normalizePriority(normalized);
    }

    function matchesPriority(row, selectedPriority) {
      if (!selectedPriority || selectedPriority === "semua") return true;
      return getReportPriority(row) === selectedPriority;
    }

    function filterReports() {
      const keyword = normalizeText(searchInput.value);
      const selectedPriority = normalizePriorityFilter(priorityFilter.value);
      let visibleCount = 0;

      reportRows.forEach((row) => {
        const visible = matchesSearch(row, keyword) && matchesPriority(row, selectedPriority);
        row.hidden = !visible;
        if (visible) {
          row.style.removeProperty("display");
          visibleCount++;
        } else {
          row.style.setProperty("display", "none", "important");
        }
      });

      if (emptyState) {
        emptyState.hidden = visibleCount > 0;
        emptyState.style.display = visibleCount > 0 ? "none" : "block";
      }
      console.log("[SIPFAS] Jumlah laporan ditemukan:", visibleCount);
    }

    function buildSelectedReport(row) {
      const reportCode = getReportCode(row);
      if (!reportCode) return null;

      let existingData = {};
      try {
        const raw = localStorage.getItem(SELECTED_REPORT_KEY);
        existingData = raw ? JSON.parse(raw) || {} : {};
      } catch (error) {
        console.warn("[SIPFAS] Metadata laporan sebelumnya tidak dapat dibaca.", error);
      }

      const activeOfficer = getActiveOfficerProfile();
      const report = {
        ...existingData,
        id: reportCode,
        reportCode,
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

      if (!report.reporterName) console.warn("[SIPFAS] Nama pelapor tidak tersedia:", reportCode);
      if (!report.location) console.warn("[SIPFAS] Lokasi laporan tidak tersedia:", reportCode);
      return report;
    }

    // 08. EVENT LISTENER, SINKRONISASI & NAVIGASI
    searchInput.addEventListener("input", filterReports);
    searchInput.addEventListener("search", filterReports);
    priorityFilter.addEventListener("change", filterReports);

    tableBody.addEventListener("click", function (event) {
      const checkButton = event.target.closest(".check-button");
      if (!checkButton) return;

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

      if (!saveSelectedReport(selectedReport)) {
        event.preventDefault();
        alert("Laporan gagal disimpan. Periksa penyimpanan browser.");
        return;
      }

      try {
        const targetUrl = new URL(checkButton.href || DETAIL_URL, window.location.href);
        targetUrl.searchParams.set("kode", selectedReport.reportCode);
        checkButton.href = targetUrl.href;
      } catch (error) {
        console.error("[SIPFAS] Kesalahan navigasi:", error);
        event.preventDefault();
        return;
      }

      console.log("[SIPFAS] Laporan terpilih:", selectedReport);
    });

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

    window.addEventListener("sipfas:verification-saved", function () {
      synchronizeVerification();
      filterReports();
      updateLatestVerificationDisplay();
    });

    window.addEventListener("sipfas:profile-updated", synchronizeOfficerProfile);

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

    function setSidebar(isOpen) {
      if (!sidebar) return;
      sidebar.classList.toggle("open", isOpen);
      pageOverlay?.classList.toggle("show", isOpen);
      menuToggle?.setAttribute("aria-expanded", String(isOpen));
    }

    menuToggle?.addEventListener("click", () => {
      setSidebar(!(sidebar?.classList.contains("open") || false));
    });
    pageOverlay?.addEventListener("click", () => setSidebar(false));
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => setSidebar(false));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setSidebar(false);
    });

    logoutLink?.addEventListener("click", performLogout);
    // 09. INISIALISASI AKHIR
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