
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {

    // Mengatur endpoint API dan penyimpanan metadata laporan terpilih.
    const API = {
      reports: "../../api/petugas/daftar-penanganan.php",
      profile: "../../api/shared/profil-login.php",
      logout: "../../api/auth/logout.php"
    };

    const STORAGE = {
      selected: "sipfas_selected_report"
    };

    const LOGIN_URL = "../../auth/Login.html";
    const DETAIL_URL =
      "../Detail-Penanganan/Detail-Penanganan.html";

    const HANDLING_STATUS = {
      waiting: {
        label: "Menunggu Perbaikan",
        className: "waiting",
        icon: "⌛"
      },
      processing: {
        label: "Diproses",
        className: "processing",
        icon: "↻"
      },
      completed: {
        label: "Selesai",
        className: "completed",
        icon: "✓"
      }
    };

    // Mengambil elemen HTML halaman.
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
        "[SIPFAS] Elemen pencarian, filter, atau tabel tidak ditemukan."
      );
      return;
    }

    let reports = [];
    let activeOfficerProfile = null;
    let refreshInProgress = false;
    let profileRequest = null;
    let refreshTimer = null;

    // Menormalisasi teks agar pencarian konsisten.
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

    // Menormalkan prioritas dari database.
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

    // Menormalkan hasil verifikasi.
    function normalizeDecision(value) {
      const text = normalizeText(value);

      if (
        text === "valid" ||
        text === "laporan valid"
      ) {
        return "valid";
      }

      if (
        text === "invalid" ||
        text === "tidak valid" ||
        text === "laporan tidak valid" ||
        text === "ditolak"
      ) {
        return "invalid";
      }

      return "";
    }

    // Menormalkan status penanganan.
    function normalizeHandlingStatus(status) {
      const value = normalizeText(status);

      if (
        [
          "selesai",
          "completed",
          "selesai ditangani",
          "selesai diperbaiki"
        ].includes(value)
      ) {
        return "completed";
      }

      if (
        [
          "diproses",
          "processing",
          "sedang diproses",
          "dalam proses"
        ].includes(value)
      ) {
        return "processing";
      }

      return "waiting";
    }

    // Mengambil kode laporan dari berbagai kemungkinan nama kolom.
    function getReportCode(report) {
      return normalizeReportCode(
        firstValue(report, [
          "kode_laporan",
          "reportCode",
          "report_code",
          "id_laporan"
        ])
      );
    }

    // Mengambil data JSON dari API.
    async function fetchJson(url, options = {}) {
      const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.headers || {})
        }
      });

      const raw = await response.text();

      let payload;

      try {
        payload = JSON.parse(raw);
      } catch {
        throw new Error(
          "Respons server bukan JSON. Periksa endpoint API Petugas."
        );
      }

      if (response.status === 401) {
        window.location.replace(LOGIN_URL);
        throw new Error("Sesi login telah berakhir.");
      }

      if (!response.ok || payload?.success !== true) {
        throw new Error(
          payload?.message ||
          `Permintaan gagal. HTTP ${response.status}`
        );
      }

      return payload;
    }

    // Memuat seluruh laporan dari database.
    async function loadReportsFromDatabase() {
      const payload = await fetchJson(API.reports);

      if (!Array.isArray(payload.data)) {
        throw new Error(
          "Format data daftar penanganan tidak sesuai."
        );
      }

      return payload.data.map(normalizeReport);
    }

    // Menyesuaikan data SQL dengan kebutuhan tabel Penanganan.
    function normalizeReport(report) {
      return {
        ...report,

        id: getReportCode(report),

        reporterId: firstValue(report, [
          "id_pelapor"
        ]),

        reporterName: firstValue(report, [
          "nama_pelapor"
        ], "Tidak diketahui"),

        reporterNim: firstValue(report, [
          "nomor_identitas"
        ]),

        facility: firstValue(report, [
          "nama_fasilitas"
        ], "Data fasilitas tidak tersedia"),

        location: firstValue(report, [
          "nama_lokasi",
          "lokasi_ruangan"
        ], "Lokasi tidak tersedia"),

        description: firstValue(report, [
          "deskripsi_kerusakan"
        ], "Deskripsi kerusakan tidak tersedia"),

        priority: normalizePriority(
          firstValue(report, [
            "prioritas_sesudah",
            "prioritas_prediksi",
            "prioritas_awal"
          ])
        ),

        decision: normalizeDecision(
          firstValue(report, [
            "hasil_verifikasi"
          ])
        ),

        verificationStatus: firstValue(report, [
          "status_verifikasi"
        ]),

        handlingStatus: normalizeHandlingStatus(
          firstValue(report, [
            "status_penanganan"
          ], "Menunggu")
        ),

        verificationTime: firstValue(report, [
          "waktu_verifikasi"
        ]),

        reportDate: firstValue(report, [
          "tanggal_dibuat"
        ]),

        updatedAt: firstValue(report, [
          "waktu_pembaruan",
          "tanggal_diperbarui"
        ]),

        handlingStart: firstValue(report, [
          "waktu_mulai_penanganan"
        ]),

        handlingEnd: firstValue(report, [
          "waktu_selesai_penanganan"
        ]),

        lastAction: firstValue(report, [
          "tindak_lanjut_perbaikan"
        ]),

        officerNotes: firstValue(report, [
          "catatan_petugas"
        ]),

        officerId: firstValue(report, [
          "id_petugas"
        ])
      };
    }

    // Memastikan laporan sudah diverifikasi valid.
    function isEligibleForHandling(report) {
      if (!report) return false;

      if (report.decision !== "valid") {
        return false;
      }

      const status = normalizeText(
        report.verificationStatus
      );

      if (
        status.includes("tidak valid") ||
        status.includes("ditolak") ||
        status === "invalid"
      ) {
        return false;
      }

      // Laporan yang sudah selesai tidak ditampilkan dalam antrean aktif.
      if (report.handlingStatus === "completed") {
        return false;
      }

      return true;
    }

    // Mengubah tanggal database menjadi objek Date.
    function parseTimestamp(value) {
      if (!value) return null;

      const date = new Date(
        String(value).replace(" ", "T")
      );

      return Number.isNaN(date.getTime())
        ? null
        : date;
    }

    // Memformat tanggal laporan dalam zona WIT.
    function formatReportDate(value) {
      const date = parseTimestamp(value);

      if (!date) return "—";

      return new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jayapura",
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(date);
    }

    // Memformat waktu pembaruan terakhir dalam zona WIT.
    function formatWIT(value, includeSeconds = true) {
      const date = parseTimestamp(value);

      if (!date) return "Belum tersedia";

      return new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jayapura",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: includeSeconds ? "2-digit" : undefined,
        hourCycle: "h23"
      }).format(date) + " WIT";
    }

    // Mengambil waktu pembaruan terakhir dari laporan.
    function getUpdatedTimestamp(report) {
      return (
        report.updatedAt ||
        report.handlingStart ||
        report.verificationTime ||
        null
      );
    }

    // Mengatur tampilan badge status penanganan.
    function createStatusBadge(status) {
      const normalized = normalizeHandlingStatus(status);
      const config = HANDLING_STATUS[normalized];

      const badge = document.createElement("span");

      badge.className =
        `status-badge ${config.className}`;

      badge.dataset.status = normalized;

      const icon = document.createElement("span");

      icon.setAttribute("aria-hidden", "true");
      icon.textContent = config.icon;

      badge.appendChild(icon);

      badge.appendChild(
        document.createTextNode(` ${config.label}`)
      );

      badge.setAttribute("aria-label", config.label);

      return badge;
    }

    // Mengatur tampilan badge prioritas.
    function createPriorityBadge(priority) {
      const badge = document.createElement("span");

      badge.className =
        `priority-badge ${priority}`;

      badge.dataset.priority = priority;

      const labels = {
        tinggi: "Tinggi",
        sedang: "Sedang",
        rendah: "Rendah",
        "tidak diketahui": "Tidak Diketahui"
      };

      badge.textContent =
        labels[priority] || "Tidak Diketahui";

      return badge;
    }

    // Menampilkan waktu pembaruan terakhir.
    function createUpdatedTimeElement(timestamp) {
      const element = document.createElement("small");

      element.className = "handling-updated-time";

      if (timestamp) {
        element.textContent =
          "Diperbarui: " + formatWIT(timestamp, false);

        element.title =
          "Pembaruan terakhir: " + formatWIT(timestamp);

      } else {
        element.textContent = "Belum diperbarui";

        element.title =
          "Belum ada pembaruan penanganan.";
      }

      Object.assign(element.style, {
        display: "block",
        marginTop: "5px",
        fontSize: "10px",
        lineHeight: "1.5",
        color: "#737e8c",
        fontWeight: "400"
      });

      return element;
    }

    // Menyimpan metadata laporan terpilih untuk halaman detail.
    // Data utama tetap dibaca kembali dari database pada halaman detail.
    function saveSelectedReport(report, officer) {
      const selected = {
        id: report.id,
        reportCode: report.id,

        reporterName: report.reporterName,
        reporterNim: report.reporterNim,

        facility: report.facility,
        facilityName: report.facility,

        location: report.location,
        facilityLocation: report.location,

        date: report.reportDate,
        priority: report.priority,
        description: report.description,

        handlerName: officer.name,
        handlerId: officer.id,
        handlerEmail: officer.email,
        handlerRole: officer.role,

        selectedAt: new Date().toISOString()
      };

      try {
        localStorage.setItem(
          STORAGE.selected,
          JSON.stringify(selected)
        );

        return true;

      } catch (error) {
        console.error(
          "[SIPFAS] Gagal menyimpan metadata laporan:",
          error
        );

        return false;
      }
    }

    // Membuat satu baris laporan pada tabel.
    function createReportRow(report) {
      const priority = report.priority;
      const updatedAt = getUpdatedTimestamp(report);

      const row = document.createElement("tr");

      row.dataset.priority = priority;
      row.dataset.reportCode = report.id;
      row.dataset.verificationStatus = "valid";
      row.dataset.handlingStatus = report.handlingStatus;

      // Kolom kode laporan.
      const codeCell = document.createElement("td");

      const codeBadge = document.createElement("span");

      codeBadge.className = `report-id ${priority}`;
      codeBadge.textContent = report.id;

      codeCell.appendChild(codeBadge);

      // Kolom fasilitas dan deskripsi kerusakan.
      const facilityCell = document.createElement("td");

      facilityCell.className = "facility";

      const facilityName = document.createElement("strong");
      facilityName.textContent = report.facility;

      const damageDescription = document.createElement("small");
      damageDescription.textContent = report.description;

      facilityCell.append(
        facilityName,
        damageDescription
      );

      // Kolom lokasi ruangan.
      const locationCell = document.createElement("td");

      const locationElement = document.createElement("span");

      locationElement.className = "location";
      locationElement.textContent = report.location;

      locationCell.appendChild(locationElement);

      // Kolom prioritas.
      const priorityCell = document.createElement("td");

      priorityCell.appendChild(
        createPriorityBadge(priority)
      );

      // Kolom status penanganan.
      const statusCell = document.createElement("td");

      statusCell.append(
        createStatusBadge(report.handlingStatus),
        createUpdatedTimeElement(updatedAt)
      );

      // Kolom tanggal laporan.
      const dateCell = document.createElement("td");

      dateCell.className = "date";
      dateCell.textContent = formatReportDate(report.reportDate);

      // Kolom tombol pengelolaan.
      const actionCell = document.createElement("td");

      const manageLink = document.createElement("a");

      manageLink.className = "manage-button";
      manageLink.textContent = "Kelola Penanganan";

      const detailURL = new URL(
        DETAIL_URL,
        window.location.href
      );

      detailURL.searchParams.set("kode", report.id);

      manageLink.href = detailURL.href;

      // Mengambil profil petugas terbaru sebelum membuka detail.
      manageLink.addEventListener("click", async (event) => {
        event.preventDefault();

        if (!isEligibleForHandling(report)) {
          window.alert(
            "Laporan ini tidak lagi berada dalam antrean penanganan."
          );

          await refreshHandlingReports();
          return;
        }

        try {
          const officer = await getActiveOfficerProfile(true);

          if (!officer) {
            throw new Error(
              "Identitas petugas tidak berhasil dimuat."
            );
          }

          const saved = saveSelectedReport(report, officer);

          if (!saved) {
            throw new Error(
              "Metadata laporan gagal disimpan."
            );
          }

          window.location.assign(detailURL.href);

        } catch (error) {
          console.error(
            "[SIPFAS] Gagal membuka detail penanganan:",
            error
          );

          window.alert(
            error.message ||
            "Gagal membuka detail penanganan."
          );
        }
      });

      actionCell.appendChild(manageLink);

      row.append(
        codeCell,
        facilityCell,
        locationCell,
        priorityCell,
        statusCell,
        dateCell,
        actionCell
      );

      row.dataset.search = normalizeText([
        report.id,
        report.reporterName,
        report.reporterNim,
        report.facility,
        report.description,
        report.location,
        priority,
        report.handlingStatus,
        report.reportDate
      ].join(" "));

      return row;
    }

    // Menampilkan pesan ketika tabel tidak memiliki laporan.
    function showEmptyState(message) {
      if (!emptyState) return;

      emptyState.textContent = message;
      emptyState.hidden = false;
      emptyState.style.display = "block";
    }

    // Memfilter laporan berdasarkan pencarian dan prioritas.
    function filterHandling() {
      const rows = Array.from(
        tableBody.querySelectorAll("tr")
      );

      const keyword = normalizeText(searchInput.value);
      const selectedPriority = normalizeText(
        priorityFilter.value
      );

      let visibleCount = 0;

      rows.forEach((row) => {
        const content = normalizeText(
          row.dataset.search || row.innerText
        );

        const matchesSearch =
          !keyword ||
          keyword.split(/\s+/).every((word) =>
            content.includes(word)
          );

        const matchesPriority =
          !selectedPriority ||
          selectedPriority === "semua" ||
          normalizeText(row.dataset.priority) === selectedPriority;

        const visible = matchesSearch && matchesPriority;

        row.hidden = !visible;

        if (visible) {
          row.style.removeProperty("display");
          visibleCount++;
        } else {
          row.style.setProperty(
            "display",
            "none",
            "important"
          );
        }
      });

      if (!emptyState) return;

      if (rows.length === 0) {
        showEmptyState(
          "Belum ada laporan yang memenuhi syarat penanganan."
        );
      } else if (visibleCount === 0) {
        showEmptyState(
          "Tidak ada laporan yang cocok dengan pencarian atau filter."
        );
      } else {
        emptyState.hidden = true;
        emptyState.style.display = "none";
      }
    }

    // Memuat laporan yang sudah valid dan belum selesai ditangani.
    async function refreshHandlingReports() {
      if (refreshInProgress) return;

      refreshInProgress = true;

      try {
        const latestReports =
          await loadReportsFromDatabase();

        reports = latestReports.filter(
          isEligibleForHandling
        );

        // Mengurutkan laporan dari yang paling baru.
        reports.sort((a, b) => {
          const dateA =
            parseTimestamp(a.reportDate)?.getTime() || 0;

          const dateB =
            parseTimestamp(b.reportDate)?.getTime() || 0;

          return dateB - dateA;
        });

        const fragment =
          document.createDocumentFragment();

        reports.forEach((report) => {
          fragment.appendChild(
            createReportRow(report)
          );
        });

        // Mengganti seluruh isi tabel menggunakan data database.
        tableBody.replaceChildren(fragment);

        filterHandling();

        console.log(
          "[SIPFAS] Antrean penanganan diperbarui:",
          reports.length
        );

      } catch (error) {
        console.error(
          "[SIPFAS] Gagal memuat antrean penanganan:",
          error
        );

        // Tidak mempertahankan data contoh HTML ketika API gagal.
        tableBody.replaceChildren();

        showEmptyState(
          "Gagal mengambil daftar penanganan dari database. " +
          error.message
        );

      } finally {
        refreshInProgress = false;
      }
    }

    // Menyesuaikan label peran dari database.
    function formatRoleLabel(role) {
      const value = normalizeText(role);

      if (
        value === "administrator" ||
        value === "admin"
      ) {
        return "Administrator";
      }

      if (value.includes("petugas")) {
        return "Petugas Sarpras";
      }

      return String(role || "Petugas Sarpras");
    }

    // Membuat inisial nama petugas.
    function getInitials(name) {
      const parts = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      if (parts.length === 0) return "PT";

      if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
      }

      return (
        parts[0][0] +
        parts[parts.length - 1][0]
      ).toUpperCase();
    }

    // Mengubah alamat foto relatif menjadi URL proyek.
    function resolveProfilePhoto(photo) {
      if (!photo) return "";

      const value = String(photo).trim();

      if (
        value.startsWith("data:") ||
        value.startsWith("blob:") ||
        /^https?:\/\//i.test(value)
      ) {
        return value;
      }

      const projectRoot = new URL(
        "../../",
        window.location.href
      );

      return new URL(
        value.replace(/^\/+/, ""),
        projectRoot
      ).href;
    }

    // Mengambil identitas petugas dari session PHP.
    async function getActiveOfficerProfile(forceRefresh = false) {
      if (profileRequest && !forceRefresh) {
        return profileRequest;
      }

      profileRequest = (async () => {
        const response = await fetch(API.profile, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json"
          }
        });

        const raw = await response.text();

        let result;

        try {
          result = JSON.parse(raw);
        } catch {
          throw new Error(
            "Respons API profil bukan JSON."
          );
        }

        if (response.status === 401) {
          window.location.replace(LOGIN_URL);

          throw new Error(
            "Sesi login telah berakhir."
          );
        }

        if (!response.ok || result.success !== true) {
          throw new Error(
            result.message ||
            "Gagal mengambil profil petugas."
          );
        }

        const user = result.user || result.data;

        if (!user || !user.id_pengguna) {
          throw new Error(
            "Identitas pengguna dari database tidak lengkap."
          );
        }

        const name = String(
          user.nama_lengkap ||
          user.nama_pengguna ||
          "Petugas SIPFAS"
        ).trim();

        return {
          id: String(user.id_pengguna),
          name,
          username: String(user.nama_pengguna || ""),
          email: String(user.email || ""),
          role: formatRoleLabel(user.nama_peran),
          avatar: resolveProfilePhoto(user.foto_profil),
          initials: getInitials(name)
        };
      })();

      try {
        activeOfficerProfile = await profileRequest;

        renderOfficerProfile(activeOfficerProfile);

        return activeOfficerProfile;

      } finally {
        profileRequest = null;
      }
    }

    // Memasang foto profil atau inisial petugas.
    function renderAvatarElement(element, profile) {
      if (!element) return;

      if (element.tagName === "IMG") {
        element.alt = "Foto " + profile.name;

        if (profile.avatar) {
          element.src = profile.avatar;
        } else {
          element.removeAttribute("src");
        }

        return;
      }

      const svgIcon = element.querySelector("svg");

      let image = element.querySelector(
        ".profile-header-photo, img"
      );

      let initials = element.querySelector(
        ".profile-header-initials"
      );

      if (profile.avatar) {
        if (svgIcon) {
          svgIcon.style.display = "none";
        }

        initials?.remove();

        if (!image) {
          image = document.createElement("img");
          image.className = "profile-header-photo";
          element.appendChild(image);
        }

        image.src = profile.avatar;
        image.alt = "Foto " + profile.name;

        image.onerror = () => {
          image.remove();

          const fallback = document.createElement("span");

          fallback.className = "profile-header-initials";
          fallback.textContent = profile.initials;

          element.appendChild(fallback);
        };

        Object.assign(image.style, {
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "cover",
          borderRadius: "50%"
        });

        element.style.overflow = "hidden";

      } else {
        image?.remove();

        if (svgIcon) {
          svgIcon.style.display = "none";
        }

        if (!initials) {
          initials = document.createElement("span");
          initials.className = "profile-header-initials";
          element.appendChild(initials);
        }

        initials.textContent = profile.initials;

        Object.assign(initials.style, {
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontWeight: "700",
          fontSize: "14px"
        });
      }

      element.setAttribute(
        "aria-label",
        profile.avatar
          ? "Foto profil " + profile.name
          : "Profil " + profile.name
      );
    }

    // Menyinkronkan nama, peran, email, dan foto petugas.
    function renderOfficerProfile(profile) {
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
        "[data-user-name]"
      ];

      document.querySelectorAll(
        nameSelectors.join(", ")
      ).forEach((element) => {
        element.textContent = profile.name;
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
        "[data-user-role]"
      ];

      document.querySelectorAll(
        roleSelectors.join(", ")
      ).forEach((element) => {
        element.textContent = profile.role;
      });

      const emailSelectors = [
        "#officerEmail",
        "#profileEmail",
        "#userEmail",
        ".profile-email",
        ".user-email",
        "[data-profile-email]"
      ];

      document.querySelectorAll(
        emailSelectors.join(", ")
      ).forEach((element) => {
        element.textContent = profile.email;
      });

      const avatarSelectors = [
        ".profile-area .profile-avatar",
        "#profileAvatar",
        "#userAvatar",
        "#officerAvatar",
        ".profile-avatar",
        ".user-avatar",
        ".avatar",
        "[data-profile-avatar]"
      ];

      document.querySelectorAll(
        avatarSelectors.join(", ")
      ).forEach((element) => {
        renderAvatarElement(element, profile);
      });
    }

    // Memuat ulang identitas petugas dari database.
    async function synchronizeOfficerProfile() {
      try {
        return await getActiveOfficerProfile(true);

      } catch (error) {
        console.error(
          "[SIPFAS] Gagal menyinkronkan profil petugas:",
          error
        );

        return null;
      }
    }

    // Mengatur pembukaan dan penutupan sidebar.
    function setSidebar(isOpen) {
      if (!sidebar) return;

      sidebar.classList.toggle("open", isOpen);

      pageOverlay?.classList.toggle("show", isOpen);
      pageOverlay?.classList.toggle("active", isOpen);

      menuToggle?.setAttribute(
        "aria-expanded",
        String(isOpen)
      );
    }

    // Menangani pencarian laporan.
    searchInput.addEventListener(
      "input",
      filterHandling
    );

    searchInput.addEventListener(
      "search",
      filterHandling
    );

    // Menangani filter prioritas.
    priorityFilter.addEventListener(
      "change",
      filterHandling
    );

    // Memperbarui daftar ketika penanganan berhasil disimpan.
    window.addEventListener(
      "sipfas:handling-saved",
      refreshHandlingReports
    );

    // Memperbarui antrean setelah verifikasi berhasil disimpan.
    window.addEventListener(
      "sipfas:verification-saved",
      refreshHandlingReports
    );

    // Memperbarui identitas setelah profil diubah.
    window.addEventListener(
      "sipfas:profile-updated",
      synchronizeOfficerProfile
    );

    // Memuat ulang data ketika halaman dibuka kembali.
    window.addEventListener("pageshow", () => {
      refreshHandlingReports();
      synchronizeOfficerProfile();
    });

    // Memuat ulang data ketika tab kembali aktif.
    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) {
          refreshHandlingReports();
          synchronizeOfficerProfile();
        }
      }
    );

    // Memperbarui data dari database setiap 15 detik.
    refreshTimer = window.setInterval(() => {
      if (!document.hidden) {
        refreshHandlingReports();
      }
    }, 15000);

    // Membersihkan timer ketika halaman ditinggalkan.
    window.addEventListener("pagehide", () => {
      if (refreshTimer !== null) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
    });

    // Mengatur tombol sidebar.
    menuToggle?.addEventListener("click", () => {
      const isOpen =
        sidebar?.classList.contains("open") ||
        sidebar?.classList.contains("active");

      setSidebar(!isOpen);
    });

    pageOverlay?.addEventListener(
      "click",
      () => setSidebar(false)
    );

    document.querySelectorAll(".nav-link").forEach(
      (link) => {
        link.addEventListener(
          "click",
          () => setSidebar(false)
        );
      }
    );

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setSidebar(false);
      }
    });

    // Menangani logout menggunakan session PHP.
    logoutLink?.addEventListener("click", async (event) => {
      event.preventDefault();

      if (!window.confirm(
        "Apakah Anda yakin ingin keluar dari sistem SIPFAS?"
      )) {
        return;
      }

      try {
        const response = await fetch(API.logout, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json"
          }
        });

        const payload = await response.json();

        if (!response.ok || payload.success !== true) {
          throw new Error(
            payload.message || "Logout gagal."
          );
        }

      } catch (error) {
        console.error(
          "[SIPFAS] Logout error:",
          error
        );

      } finally {
        window.location.replace(LOGIN_URL);
      }
    });

    // Menjalankan pemuatan awal halaman.
    synchronizeOfficerProfile();
    refreshHandlingReports();

    console.log(
      "[SIPFAS] Halaman Penanganan berhasil diinisialisasi."
    );
  }
})();
