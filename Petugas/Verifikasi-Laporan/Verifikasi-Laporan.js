
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initializeVerificationPage);

  function initializeVerificationPage() {

    // Mengatur endpoint dan konfigurasi halaman.
    const API = {
      reports: "../../api/petugas/daftar-verifikasi.php",
      profile: "../../api/shared/profil-login.php",
      logout: "../../api/auth/logout.php"
    };

    const LOGIN_PAGE = "../../auth/Login.html";
    const DETAIL_URL =
      "../Detail-Verifikasi-Laporan/Detail-Verifikasi-Laporan.html";

    const SELECTED_REPORT_KEY = "sipfas_selected_report";
    const TIME_ZONE = "Asia/Makassar";

    // Mengambil elemen HTML yang digunakan halaman.
    const $ = (id) => document.getElementById(id);

    const searchInput = $("searchReport");
    const priorityFilter = $("priorityFilter");
    const table = document.querySelector(".verification-table");
    const tableBody = table?.querySelector("tbody");
    const emptyState = $("emptyState");

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
    let currentOfficerProfile = null;
    let refreshTimer = null;
    let clockTimer = null;
    let refreshInProgress = false;

    // Menormalisasi teks agar pencarian tidak sensitif terhadap huruf besar.
    function normalizeText(value) {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    // Mengambil nilai pertama yang tersedia dari beberapa nama kolom.
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

    // Menormalkan kode laporan dari database.
    function normalizeCode(value) {
      return String(value ?? "")
        .replace(/\s+/g, "")
        .trim()
        .toUpperCase();
    }

    // Menentukan hasil keputusan verifikasi.
    function normalizeDecision(value) {
      const decision = normalizeText(value);

      if (
        ["valid", "laporan valid", "terverifikasi",
          "selesai diverifikasi"].includes(decision)
      ) {
        return "valid";
      }

      if (
        ["invalid", "tidak valid", "laporan tidak valid",
          "ditolak"].includes(decision)
      ) {
        return "invalid";
      }

      return "";
    }

    // Menentukan kategori prioritas laporan.
    function normalizePriority(value) {
      const priority = normalizeText(value);

      if (priority.includes("tinggi")) return "tinggi";
      if (priority.includes("sedang")) return "sedang";
      if (priority.includes("rendah")) return "rendah";

      return "";
    }

    // Mengubah tanggal database menjadi objek Date.
    function parseDate(value) {
      if (!value) return null;

      const date = new Date(
        String(value).replace(" ", "T")
      );

      return Number.isNaN(date.getTime()) ? null : date;
    }

    // Memformat tanggal sesuai zona waktu WIT.
    function formatDate(value) {
      const date = parseDate(value);

      if (!date) return "—";

      return new Intl.DateTimeFormat("id-ID", {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(date);
    }

    // Memformat waktu pembaruan terakhir.
    function formatUpdateTime(value) {
      const date = parseDate(value);

      if (!date) return "Belum ada pembaruan";

      const time = new Intl.DateTimeFormat("id-ID", {
        timeZone: TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      }).format(date);

      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());

      const reportDay = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(date);

      if (today === reportDay) {
        return `Hari ini, ${time} WITA`;
      }

      const formattedDate = new Intl.DateTimeFormat("id-ID", {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "long",
        year: "numeric"
      }).format(date);

      return `${formattedDate}, pukul ${time} WITA`;
    }

    // Mengambil data JSON dari server.
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

      const payload = await response.json();

      if (response.status === 401) {
        window.location.replace(LOGIN_PAGE);
        throw new Error("Sesi login telah berakhir.");
      }

      if (!response.ok || payload?.success !== true) {
        throw new Error(
          payload?.message || "Gagal mengambil data server."
        );
      }

      return payload;
    }

    // Mengambil daftar laporan dari database.
    async function loadReports() {
      const payload = await fetchJson(API.reports);

      const result = Array.isArray(payload.data)
        ? payload.data
        : [];

      return result.map(normalizeReport);
    }

    // Menyesuaikan struktur data laporan dengan kebutuhan tabel.
    function normalizeReport(report) {
      return {
        ...report,

        id: normalizeCode(
          firstValue(report, [
            "kode_laporan",
            "nomor_laporan",
            "id_laporan"
          ])
        ),

        reporterName: String(
          firstValue(report, [
            "nama_pelapor",
            "nama_lengkap"
          ], "Tidak diketahui")
        ),

        reporterNim: String(
          firstValue(report, [
            "nomor_identitas",
            "nim"
          ])
        ),

        facility: String(
          firstValue(report, [
            "nama_fasilitas"
          ], "Fasilitas tidak diketahui")
        ),

        location: String(
          firstValue(report, [
            "nama_lokasi",
            "lokasi_ruangan"
          ], "Lokasi tidak diketahui")
        ),

        date: firstValue(report, [
          "tanggal_dibuat",
          "tanggal_laporan"
        ]),

        priority: normalizePriority(
          firstValue(report, [
            "prioritas_awal",
            "prioritas_prediksi",
            "prioritas",
            "prioritas_sesudah"
          ])
        ),

        verificationStatus: normalizeText(
          report.status_verifikasi
        ),

        verificationResult: normalizeDecision(
          report.hasil_verifikasi
        ),

        verificationId: report.id_riwayat_verifikasi
      };
    }

    // Memastikan laporan memang masih menunggu verifikasi.
    function isPendingVerification(report) {
      const status = report.verificationStatus;
      const result = report.verificationResult;

      // Laporan yang sudah memiliki hasil verifikasi tidak ditampilkan.
      if (result === "valid" || result === "invalid") {
        return false;
      }

      // Laporan yang sudah memiliki riwayat verifikasi tidak ditampilkan.
      if (report.verificationId !== null &&
          report.verificationId !== undefined &&
          report.verificationId !== "") {
        return false;
      }

      // Mengeluarkan laporan yang sudah dinyatakan valid atau ditolak.
      if (
        status.includes("valid") ||
        status.includes("terverifikasi") ||
        status.includes("ditolak") ||
        status.includes("selesai")
      ) {
        return false;
      }

      // Laporan tanpa hasil verifikasi tetap berada dalam antrean.
      return true;
    }

    // Mengambil laporan yang masih menunggu verifikasi.
    function getPendingReports() {
      return reports
        .filter(isPendingVerification)
        .sort((a, b) => {
          const dateA = parseDate(a.date)?.getTime() || 0;
          const dateB = parseDate(b.date)?.getTime() || 0;

          return dateB - dateA;
        });
    }

    // Membuat elemen tabel dengan teks aman.
    function createCell(value, className = "") {
      const cell = document.createElement("td");

      cell.textContent = value || "—";

      if (className) {
        cell.className = className;
      }

      return cell;
    }

    // Membuat tampilan nama pelapor dan nomor identitas.
    function createReporterCell(report) {
      const cell = document.createElement("td");

      const name = document.createElement("strong");
      name.textContent = report.reporterName;

      const identity = document.createElement("small");
      identity.textContent = report.reporterNim || "Identitas tidak tersedia";

      cell.append(name, identity);

      return cell;
    }

    // Membuat tampilan fasilitas tanpa mengubah struktur CSS utama.
    function createFacilityCell(report) {
      const cell = document.createElement("td");

      const wrapper = document.createElement("span");
      wrapper.className = "facility-with-icon";

      const name = document.createElement("span");
      name.textContent = report.facility;

      wrapper.appendChild(name);
      cell.appendChild(wrapper);

      return cell;
    }

    // Membuat badge prioritas.
    function createPriorityBadge(priority) {
      const badge = document.createElement("span");

      const labels = {
        tinggi: "Tinggi",
        sedang: "Sedang",
        rendah: "Rendah"
      };

      const classes = {
        tinggi: "high",
        sedang: "medium",
        rendah: "low"
      };

      badge.className = "pill";

      if (classes[priority]) {
        badge.classList.add(classes[priority]);
      }

      badge.textContent = labels[priority] || "Belum Dinilai";

      return badge;
    }

    // Membuat status antrean verifikasi.
    function createStatusBadge() {
      const badge = document.createElement("span");

      badge.className = "status-pill";
      badge.textContent = "Menunggu Verifikasi";

      return badge;
    }

    // Membuat tombol untuk membuka detail laporan.
    function createActionButton(report) {
      const button = document.createElement("a");

      const target = new URL(
        DETAIL_URL,
        window.location.href
      );

      target.searchParams.set("kode", report.id);

      button.href = target.href;
      button.className = "check-button";
      button.textContent = "Periksa";

      return button;
    }

    // Menyimpan laporan terpilih untuk kompatibilitas dengan halaman detail.
    function saveSelectedReport(report) {
      try {
        const selected = {
          id: report.id,
          reportCode: report.id,

          reporter: report.reporterName,
          reporterName: report.reporterName,
          reporterNim: report.reporterNim,

          facility: report.facility,
          facilityName: report.facility,

          location: report.location,
          facilityLocation: report.location,

          date: report.date,
          priority: report.priority,

          description: report.deskripsi_kerusakan || "",

          selectedAt: new Date().toISOString()
        };

        localStorage.setItem(
          SELECTED_REPORT_KEY,
          JSON.stringify(selected)
        );

        return true;

      } catch (error) {
        console.error(
          "[SIPFAS] Gagal menyimpan laporan terpilih:",
          error
        );

        return false;
      }
    }

    // Menampilkan laporan ke tabel HTML.
    function renderReports() {
      const keyword = normalizeText(searchInput.value);
      const selectedPriority = normalizePriority(
        priorityFilter.value
      );

      const pendingReports = getPendingReports();

      const filteredReports = pendingReports.filter((report) => {
        const searchableText = normalizeText([
          report.id,
          report.reporterName,
          report.reporterNim,
          report.facility,
          report.location,
          report.deskripsi_kerusakan,
          report.priority
        ].join(" "));

        const matchesSearch =
          !keyword ||
          keyword.split(/\s+/).every((word) =>
            searchableText.includes(word)
          );

        const matchesPriority =
          !selectedPriority ||
          report.priority === selectedPriority;

        return matchesSearch && matchesPriority;
      });

      // Menghapus data contoh dari HTML dan menggantinya dengan database.
      tableBody.replaceChildren();

      if (filteredReports.length === 0) {
        if (emptyState) {
          emptyState.hidden = false;
          emptyState.style.display = "block";

          emptyState.textContent = pendingReports.length === 0
            ? "Belum ada laporan yang menunggu verifikasi."
            : "Tidak ada laporan yang cocok dengan pencarian atau filter.";
        }

        return;
      }

      if (emptyState) {
        emptyState.hidden = true;
        emptyState.style.display = "none";
      }

      const fragment = document.createDocumentFragment();

      filteredReports.forEach((report) => {
        const row = document.createElement("tr");

        row.dataset.reportCode = report.id;
        row.dataset.priority = report.priority;

        row.appendChild(
          createCell(report.id, "report-code")
        );

        row.appendChild(
          createReporterCell(report)
        );

        row.appendChild(
          createFacilityCell(report)
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

        const statusCell = document.createElement("td");
        statusCell.appendChild(createStatusBadge());
        row.appendChild(statusCell);

        const actionCell = document.createElement("td");
        actionCell.appendChild(createActionButton(report));
        row.appendChild(actionCell);

        fragment.appendChild(row);
      });

      tableBody.appendChild(fragment);
    }

    // Memuat dan memperbarui antrean laporan.
    async function refreshReports() {
      if (refreshInProgress) return;

      refreshInProgress = true;

      try {
        const latestReports = await loadReports();

        reports = latestReports;

        renderReports();
        updateLatestVerificationDisplay();

        console.log(
          "[SIPFAS] Antrean verifikasi diperbarui:",
          getPendingReports().length
        );

      } catch (error) {
        console.error(
          "[SIPFAS] Gagal memuat antrean verifikasi:",
          error
        );

        if (reports.length === 0) {
          tableBody.replaceChildren();

          const row = document.createElement("tr");
          const cell = document.createElement("td");

          cell.colSpan = 8;
          cell.textContent =
            "Gagal mengambil data laporan. Periksa koneksi server.";

          cell.style.textAlign = "center";

          row.appendChild(cell);
          tableBody.appendChild(row);
        }

      } finally {
        refreshInProgress = false;
      }
    }

    // Menampilkan jam aktual perangkat dalam zona waktu Manado (WITA).
    function updateLatestVerificationDisplay() {
      const element = document.querySelector(
        "#lastUpdate, #lastUpdated, .last-update, .update-terakhir, [data-last-update]"
      );

      if (element) {
        element.textContent =
          `Update Terakhir: ${formatUpdateTime(new Date())}`;
      }
    }

    // Mengambil inisial nama petugas jika tidak ada foto.
    function getInitials(name) {
      const parts = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      if (!parts.length) return "PT";

      if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
      }

      return (
        parts[0][0] +
        parts[parts.length - 1][0]
      ).toUpperCase();
    }

    // Menyesuaikan path foto dengan root proyek SIPFAS.
    function resolvePhoto(path) {
      const value = String(path || "").trim();

      if (!value) return "";

      if (/^(https?:|data:|blob:)/i.test(value)) {
        return value;
      }

      return new URL(
        "../../" + value.replace(/^\/+/, ""),
        window.location.href
      ).href;
    }

    // Menampilkan foto atau inisial petugas.
    function renderAvatar(element, profile) {
      if (!element) return;

      const photo = resolvePhoto(profile.avatar);

      if (element.tagName === "IMG") {
        element.alt = `Foto ${profile.name}`;

        if (photo) {
          element.src = photo;
        }

        return;
      }

      let image = element.querySelector(
        ".profile-header-photo, img"
      );

      let initials = element.querySelector(
        ".profile-header-initials"
      );

      const svg = element.querySelector("svg");

      if (photo) {
        if (!image) {
          image = document.createElement("img");
          image.className = "profile-header-photo";
          element.appendChild(image);
        }

        initials?.remove();

        if (svg) svg.style.display = "none";

        image.src = photo;
        image.alt = `Foto ${profile.name}`;

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

      } else {
        image?.remove();

        if (svg) svg.style.display = "none";

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
          fontWeight: "700"
        });
      }

      element.style.overflow = "hidden";
      element.setAttribute(
        "aria-label",
        `Profil ${profile.name}`
      );
    }

    // Mengambil profil petugas langsung dari session PHP.
    async function synchronizeOfficerProfile() {
      try {
        const payload = await fetchJson(API.profile);

        const user = payload.user || payload.data;

        if (!user) {
          throw new Error("Data profil petugas tidak tersedia.");
        }

        const name = String(
          user.nama_lengkap ||
          user.nama_pengguna ||
          "Petugas SIPFAS"
        ).trim();

        const role = String(
          user.nama_peran || "Petugas Sarpras"
        ).trim();

        currentOfficerProfile = {
          id: String(user.id_pengguna || ""),
          name,
          role,
          email: String(user.email || ""),
          avatar: String(user.foto_profil || ""),
          initials: getInitials(name)
        };

        const profile = currentOfficerProfile;

        document.querySelectorAll(
          "#officerName, #petugasName, #profileName, #userName, .officer-name, .petugas-name, .profile-name, .user-name, .account-name, [data-profile-name]"
        ).forEach((element) => {
          element.textContent = profile.name;
        });

        document.querySelectorAll(
          "#officerRole, #petugasRole, #profileRole, #userRole, .officer-role, .petugas-role, .profile-role, .user-role, .account-role, [data-profile-role]"
        ).forEach((element) => {
          element.textContent = profile.role;
        });

        document.querySelectorAll(
          "#officerEmail, #profileEmail, #userEmail, .profile-email, .user-email, [data-profile-email]"
        ).forEach((element) => {
          element.textContent = profile.email;
        });

        document.querySelectorAll(
          ".profile-area .profile-avatar, #profileAvatar, #userAvatar, #officerAvatar, .profile-avatar, .user-avatar, .avatar, [data-profile-avatar]"
        ).forEach((element) => {
          renderAvatar(element, profile);
        });

      } catch (error) {
        console.error(
          "[SIPFAS] Gagal menyinkronkan profil petugas:",
          error
        );
      }
    }

    // Menjalankan logout melalui endpoint PHP.
    async function performLogout(event) {
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
          throw new Error(payload.message || "Logout gagal.");
        }

        window.location.replace(LOGIN_PAGE);

      } catch (error) {
        console.error("[SIPFAS] Logout gagal:", error);

        window.alert(
          error.message || "Tidak dapat mengakhiri sesi."
        );
      }
    }

    // Mengatur pembukaan dan penutupan sidebar.
    function setSidebar(isOpen) {
      if (!sidebar) return;

      sidebar.classList.toggle("open", isOpen);
      pageOverlay?.classList.toggle("show", isOpen);

      menuToggle?.setAttribute(
        "aria-expanded",
        String(isOpen)
      );
    }

    // Menangani pencarian laporan.
    searchInput.addEventListener("input", renderReports);
    searchInput.addEventListener("search", renderReports);

    // Menangani filter prioritas.
    priorityFilter.addEventListener("change", renderReports);

    // Menangani klik tombol Periksa.
    tableBody.addEventListener("click", (event) => {
      const button = event.target.closest(".check-button");

      if (!button) return;

      const row = button.closest("tr");
      const code = normalizeCode(row?.dataset.reportCode);

      const report = reports.find(
        (item) => item.id === code
      );

      if (!report) {
        event.preventDefault();
        window.alert("Data laporan tidak ditemukan.");
        return;
      }

      if (!isPendingVerification(report)) {
        event.preventDefault();
        window.alert(
          "Laporan ini sudah tidak berada dalam antrean verifikasi."
        );
        refreshReports();
        return;
      }

      // Menyimpan metadata laporan untuk kompatibilitas halaman detail.
      if (!saveSelectedReport(report)) {
        event.preventDefault();
        window.alert(
          "Data laporan gagal disimpan pada browser."
        );
      }
    });

    // Memperbarui data saat pengguna kembali ke halaman.
    window.addEventListener("pageshow", () => {
      refreshReports();
      synchronizeOfficerProfile();
    });

    // Memperbarui antrean setelah proses verifikasi berhasil.
    window.addEventListener(
      "sipfas:verification-saved",
      refreshReports
    );

    // Memperbarui profil setelah pengguna mengubah identitas atau foto.
    window.addEventListener(
      "sipfas:profile-updated",
      synchronizeOfficerProfile
    );

    // Menangani pembaruan ketika tab kembali aktif.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        refreshReports();
        synchronizeOfficerProfile();
      }
    });

    // Jam pada label diperbarui setiap detik, terpisah dari pemuatan data.
    updateLatestVerificationDisplay();
    clockTimer = window.setInterval(() => {
      if (!document.hidden) {
        updateLatestVerificationDisplay();
      }
    }, 1000);

    // Memperbarui data laporan dari database setiap 15 detik.
    refreshTimer = window.setInterval(() => {
      if (!document.hidden) {
        refreshReports();
      }
    }, 15000);

    // Membersihkan interval ketika halaman ditinggalkan.
    window.addEventListener("pagehide", () => {
      if (refreshTimer !== null) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }

      if (clockTimer !== null) {
        clearInterval(clockTimer);
        clockTimer = null;
      }
    });

    // Mengatur sidebar pada perangkat mobile.
    menuToggle?.addEventListener("click", () => {
      setSidebar(!sidebar?.classList.contains("open"));
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

    // Menghubungkan tombol logout.
    logoutLink?.addEventListener("click", performLogout);

    // Menjalankan proses awal halaman.
    synchronizeOfficerProfile();
    refreshReports();

    console.log("[SIPFAS] Halaman Verifikasi Laporan aktif.");
  }
})();
