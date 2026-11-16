// 01. Menjalankan Dashboard setelah HTML selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  initializeDashboard();
});

// 02. Menentukan nama penyimpanan data laporan dan profil.
const STORAGE_KEY = "sipfasReports";
const LOGIN_TOAST_KEY = "sipfasLoginToast";

// 03. Menyediakan data laporan awal untuk simulasi.
// const initialReports = [
//   {
//     id: "LP-2024-089",
//     date: "24 Okt 2024",
//     facility: "Proyektor Lab Komputer 2",
//     priority: "Tinggi",
//     status: "Menunggu Verifikasi",
//   },
//   {
//     id: "LP-2024-085",
//     date: "22 Okt 2024",
//     facility: "Unit AC Split 2 PK",
//     priority: "Tinggi",
//     status: "Diproses",
//   },
//   {
//     id: "LP-2024-081",
//     date: "18 Okt 2024",
//     facility: "Papan Tulis Whiteboard",
//     priority: "Sedang",
//     status: "Selesai",
//   },
//   {
//     id: "LP-2024-076",
//     date: "15 Okt 2024",
//     facility: "Stop Kontak Meja 04",
//     priority: "Rendah",
//     status: "Selesai",
//   },
//   {
//     id: "LP-2024-072",
//     date: "12 Okt 2024",
//     facility: "Kipas Angin Dinding",
//     priority: "Rendah",
//     status: "Tidak Valid",
//   },
//   {
//     id: "LP-2024-070",
//     date: "10 Okt 2024",
//     facility: "Kursi Kuliah Lipat",
//     priority: "Rendah",
//     status: "Selesai",
//   },
// ];

// ============================================================
// 04. INISIALISASI DASHBOARD
// ============================================================

function initializeDashboard() {
  const reportTableBody = document.querySelector(".report-table tbody");

  if (!reportTableBody) {
    console.error("Tabel laporan Dashboard tidak ditemukan.");
    return;
  }

  // Memuat statistik dan laporan.
  refreshDashboard();

  // Identitas pengguna diambil oleh profile-sync.js.
  // Tidak membaca LocalStorage untuk nama pengguna.

  createLoginNotificationStyle();
  showLoginNotification();

  // Memperbarui laporan apabila ada perubahan.
  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY || event.key === null) {
      refreshDashboard();
    }
  });

  console.log("Dashboard SIPFAS berhasil dijalankan.");
}

// ============================================================
// 05. MENGAMBIL DATA LAPORAN DARI LOCALSTORAGE
// Tidak memasukkan data dummy secara otomatis.
// ============================================================

function getDashboardReports() {
  try {
    const savedReports = localStorage.getItem(STORAGE_KEY);

    // Jika belum ada laporan, kembalikan array kosong.
    if (savedReports === null || savedReports.trim() === "") {
      return [];
    }

    // Mengubah JSON menjadi array JavaScript.
    const parsedReports = JSON.parse(savedReports);

    // Memastikan format data benar.
    if (!Array.isArray(parsedReports)) {
      throw new Error("Format data laporan tidak valid.");
    }

    // Mengambil laporan yang valid.
    return parsedReports.filter(function (report) {
      return report && typeof report === "object" && !Array.isArray(report);
    });
  } catch (error) {
    console.error("Gagal mengambil data laporan:", error);
    return [];
  }
}

// ============================================================
// 06. MENYESUAIKAN STRUKTUR DATA LAPORAN
// ============================================================

function normalizeDashboardReport(report) {
  const reportId = report.id || report.kodeLaporan || report.kode_laporan || "";

  const facilityName =
    report.facility ||
    report.namaFasilitas ||
    report.nama_fasilitas ||
    "Fasilitas tidak disebutkan";

  const rawDate =
    report.date ||
    report.tanggalLaporan ||
    report.tanggal_laporan ||
    report.createdAt ||
    report.created_at ||
    "";

  const rawStatus =
    report.status ||
    report.mainStatus ||
    report.statusLaporan ||
    report.status_laporan ||
    "Menunggu Verifikasi";

  return {
    id: String(reportId),
    facility: String(facilityName),
    date: formatReportDate(rawDate),
    sortDate: parseReportDate(rawDate),
    status: normalizeReportStatus(rawStatus),
  };
}

// ============================================================
// 07. MENYAMAKAN FORMAT STATUS LAPORAN
// ============================================================

function normalizeReportStatus(status) {
  const normalizedStatus = String(status).toLowerCase().trim();

  if (normalizedStatus.includes("menunggu")) {
    return "waiting";
  }

  if (normalizedStatus.includes("proses")) {
    return "processing";
  }

  if (normalizedStatus.includes("selesai")) {
    return "completed";
  }

  if (
    normalizedStatus.includes("tidak valid") ||
    normalizedStatus.includes("invalid") ||
    normalizedStatus.includes("ditolak")
  ) {
    return "invalid";
  }

  return "waiting";
}

// ============================================================
// 08. MENGUBAH FORMAT TANGGAL KE BAHASA INDONESIA
// ============================================================

function formatReportDate(dateValue) {
  if (!dateValue) return "-";

  const dateString = String(dateValue);

  if (!/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    return dateString;
  }

  const dateObject = new Date(dateString);

  if (!isNaN(dateObject.getTime())) {
    return dateObject.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return dateString;
}

// ============================================================
// 09. MENGUBAH TANGGAL MENJADI ANGKA UNTUK PENGURUTAN
// ============================================================

function parseReportDate(dateValue) {
  if (!dateValue) return 0;

  const dateString = String(dateValue);

  const directDate = new Date(dateString);

  if (!isNaN(directDate.getTime())) {
    return directDate.getTime();
  }

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

  const match = dateString.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);

  if (match) {
    const day = Number(match[1]);
    const month = months[match[2].toLowerCase()];
    const year = Number(match[3]);

    if (month !== undefined) {
      return new Date(year, month, day).getTime();
    }
  }

  return 0;
}

// ============================================================
// 10. MEMUAT ULANG SELURUH DATA DASHBOARD
// ============================================================

function refreshDashboard() {
  const reports = getDashboardReports();

  const normalizedReports = reports.map(function (report) {
    return normalizeDashboardReport(report);
  });

  normalizedReports.sort(function (a, b) {
    return b.sortDate - a.sortDate;
  });

  renderDashboardStatistics(normalizedReports);
  renderRecentReports(normalizedReports);
  updateActivityDescription(normalizedReports.length);

  console.log("===== DASHBOARD SIPFAS =====");
  console.log("Total laporan:", normalizedReports.length);
  console.log("Data laporan:", normalizedReports);
  console.log("============================");
}

// ============================================================
// 11. MENGHITUNG JUMLAH LAPORAN BERDASARKAN STATUS
// ============================================================

function calculateReportStatistics(reports) {
  const statistics = {
    total: reports.length,
    waiting: 0,
    processing: 0,
    completed: 0,
    invalid: 0,
  };

  reports.forEach(function (report) {
    if (report.status === "waiting") {
      statistics.waiting++;
    } else if (report.status === "processing") {
      statistics.processing++;
    } else if (report.status === "completed") {
      statistics.completed++;
    } else if (report.status === "invalid") {
      statistics.invalid++;
    }
  });

  return statistics;
}

// ============================================================
// 12. MEMPERBARUI ANGKA KARTU STATISTIK
// ============================================================

function renderDashboardStatistics(reports) {
  const statistics = calculateReportStatistics(reports);

  const totalElement = document.querySelector(".total-number");
  const waitingElement = document.querySelector(".waiting-number");
  const processingElement = document.querySelector(".process-number");
  const completedElement = document.querySelector(".completed-number");

  if (totalElement) {
    totalElement.textContent = statistics.total;
  }

  if (waitingElement) {
    waitingElement.textContent = statistics.waiting;
  }

  if (processingElement) {
    processingElement.textContent = statistics.processing;
  }

  if (completedElement) {
    completedElement.textContent = statistics.completed;
  }
}

// ============================================================
// 13. MENAMPILKAN LAPORAN TERBARU
// ============================================================

function renderRecentReports(reports) {
  const reportTableBody = document.querySelector(".report-table tbody");

  if (!reportTableBody) return;

  reportTableBody.replaceChildren();

  const recentReports = reports;

  if (recentReports.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");

    emptyCell.colSpan = 4;
    emptyCell.textContent = "Belum ada laporan yang dikirim.";
    emptyCell.style.textAlign = "center";
    emptyCell.style.padding = "30px";
    emptyCell.style.color = "#667085";

    emptyRow.appendChild(emptyCell);
    reportTableBody.appendChild(emptyRow);

    return;
  }

  recentReports.forEach(function (report) {
    const row = document.createElement("tr");

    // Kolom nama fasilitas.
    // IKON DIHAPUS, HANYA MENAMPILKAN NAMA FASILITAS.
    const facilityCell = document.createElement("td");
    const facilityWrapper = document.createElement("div");
    const facilityText = document.createElement("strong");

    facilityWrapper.className = "facility-name";
    facilityText.textContent = report.facility;

    facilityWrapper.appendChild(facilityText);
    facilityCell.appendChild(facilityWrapper);

    // Kolom tanggal.
    const dateCell = document.createElement("td");
    dateCell.textContent = report.date;

    // Kolom status.
    const statusCell = document.createElement("td");
    const statusBadge = createDashboardStatusBadge(report.status);

    statusCell.appendChild(statusBadge);

    // Kolom tombol detail.
    const actionCell = document.createElement("td");
    const detailLink = document.createElement("a");

    detailLink.className = "detail-link";
    detailLink.textContent = "Detail ›";

    if (report.id) {
      detailLink.href =
        "../Detail-laporan/Detail-laporan.html?id=" +
        encodeURIComponent(report.id);
    } else {
      detailLink.href = "#";
      detailLink.setAttribute("aria-disabled", "true");

      detailLink.addEventListener("click", function (event) {
        event.preventDefault();
      });
    }

    actionCell.appendChild(detailLink);

    // Menggabungkan seluruh kolom.
    row.appendChild(facilityCell);
    row.appendChild(dateCell);
    row.appendChild(statusCell);
    row.appendChild(actionCell);

    reportTableBody.appendChild(row);
  });
}

// ============================================================
// 14. MEMBUAT BADGE STATUS LAPORAN
// ============================================================

function createDashboardStatusBadge(status) {
  const badge = document.createElement("span");

  badge.className = "status-badge";

  const statusConfiguration = {
    waiting: {
      className: "status-waiting",
      label: "Menunggu",
    },

    processing: {
      className: "status-processing",
      label: "Diproses",
    },

    completed: {
      className: "status-completed",
      label: "Selesai",
    },

    invalid: {
      className: "status-invalid",
      label: "Tidak Valid",
    },
  };

  const configuration =
    statusConfiguration[status] || statusConfiguration.waiting;

  badge.classList.add(configuration.className);

  if (status === "waiting" || status === "processing") {
    const dot = document.createElement("span");

    dot.className = "status-dot";
    badge.appendChild(dot);
  }

  if (status === "invalid") {
    const invalidIcon = document.createElement("span");

    invalidIcon.className = "invalid-icon";
    invalidIcon.textContent = "⊗";

    badge.appendChild(invalidIcon);
  }

  badge.appendChild(document.createTextNode(configuration.label));

  return badge;
}

// ============================================================
// 15. MEMPERBARUI KETERANGAN JUMLAH AKTIVITAS
// ============================================================

function updateActivityDescription(totalReports) {
  const description = document.querySelector(".section-heading p");

  if (!description) return;

  if (totalReports === 0) {
    description.textContent = "Belum ada aktivitas permohonan sarana Anda.";
  } else {
    const displayedCount = Math.min(totalReports, 5);

    description.textContent =
      "Menampilkan " +
      displayedCount +
      " dari " +
      totalReports +
      " laporan terbaru Anda.";
  }
}

// ============================================================
// 16. MEMPERBARUI IDENTITAS PENGGUNA
// ============================================================

function updateDashboardProfile() {
  try {
    const dataProfil = localStorage.getItem(PROFILE_KEY);

    if (!dataProfil) {
      console.log("Data profil belum tersedia.");
      return;
    }

    const profil = JSON.parse(dataProfil);

    if (!profil || typeof profil !== "object") {
      console.error("Format data profil tidak valid.");
      return;
    }

    const namaPengguna = String(profil.name || "").trim();

    if (!namaPengguna) return;

    // Memperbarui nama pada header Dashboard.
    document.querySelectorAll(".header-name").forEach(function (elemen) {
      elemen.textContent = namaPengguna;
    });

    // Memperbarui nama pada bagian sapaan.
    const sapaan = document.querySelector(".welcome-name");

    if (sapaan) {
      sapaan.textContent = "Selamat Datang, " + namaPengguna;
    }

    console.log("Identitas pengguna berhasil diperbarui:", namaPengguna);
  } catch (error) {
    console.error("Gagal memperbarui identitas pengguna:", error);
  }
}

// ============================================================
// 17. MENAMPILKAN NOTIFIKASI LOGIN BERHASIL
// ============================================================

function showLoginNotification() {
  // Mengambil notifikasi dari proses verifikasi login.
  const notificationData = sessionStorage.getItem("sipfasLoginNotification");

  if (!notificationData) return;

  let notification;

  try {
    notification = JSON.parse(notificationData);
  } catch (error) {
    console.error("Data notifikasi login tidak valid.");
    sessionStorage.removeItem("sipfasLoginNotification");
    return;
  }

  // Menghapus data agar notifikasi tidak muncul berulang.
  sessionStorage.removeItem("sipfasLoginNotification");

  // Membuat desain notifikasi.
  const notificationBox = document.createElement("div");

  notificationBox.className = "sipfas-login-notification";

  notificationBox.innerHTML = `
    <div class="sipfas-login-title"></div>
    <div class="sipfas-login-message"></div>
  `;

  // Mengisi judul dan pesan notifikasi.
  notificationBox.querySelector(".sipfas-login-title").textContent =
    notification.title;

  notificationBox.querySelector(".sipfas-login-message").textContent =
    notification.message;

  document.body.appendChild(notificationBox);

  // Memunculkan notifikasi.
  requestAnimationFrame(function () {
    notificationBox.classList.add("show");
  });

  // Menghilangkan notifikasi otomatis setelah 4 detik.
  setTimeout(function () {
    notificationBox.classList.remove("show");

    notificationBox.classList.add("hide");

    setTimeout(function () {
      notificationBox.remove();
    }, 400);
  }, 4000);
}

// ============================================================
// 18. DESAIN NOTIFIKASI LOGIN
// ============================================================

function createLoginNotificationStyle() {
  if (document.getElementById("sipfasLoginNotificationStyle")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "sipfasLoginNotificationStyle";

  style.textContent = `
    .sipfas-login-notification {
      position: fixed;
      top: 25px;
      left: 50%;
      z-index: 99999;

      width: 580px;
      max-width: calc(100% - 30px);

      padding: 28px 26px;

      background: #211b1f;
      color: #ffffff;

      border: 1px solid #51434d;
      border-radius: 17px;

      box-shadow: 0 8px 28px rgba(0,0,0,0.30);

      font-family: Arial, sans-serif;

      opacity: 0;
      visibility: hidden;

      transform: translate(-50%, -20px);

      transition:
        opacity 0.35s ease,
        transform 0.35s ease,
        visibility 0.35s ease;
    }

    .sipfas-login-notification.show {
      opacity: 1;
      visibility: visible;
      transform: translate(-50%, 0);
    }

    .sipfas-login-notification.hide {
      opacity: 0;
      visibility: hidden;
      transform: translate(-50%, -15px);
    }

    .sipfas-login-title {
      font-size: 20px;
      font-weight: 700;
      line-height: 1.5;
      margin-bottom: 12px;
      color: #ffffff;
    }

    .sipfas-login-message {
      font-size: 16px;
      font-weight: 400;
      line-height: 1.7;
      color: #f1eaf0;
    }

    @media (max-width: 600px) {
      .sipfas-login-notification {
        padding: 23px 20px;
      }

      .sipfas-login-title {
        font-size: 18px;
      }

      .sipfas-login-message {
        font-size: 14px;
      }
    }
  `;

  document.head.appendChild(style);
}

// ============================================================
// 19. MENAMPILKAN TOAST LOGIN BERHASIL
// ============================================================

function showLoginToast() {
  let notification;

  try {
    const savedNotification = sessionStorage.getItem(LOGIN_TOAST_KEY);

    if (!savedNotification) return;

    notification = JSON.parse(savedNotification);

    // Menghapus pesan agar tidak muncul berulang kali.
    sessionStorage.removeItem(LOGIN_TOAST_KEY);
  } catch (error) {
    console.error("Gagal membaca notifikasi login:", error);

    sessionStorage.removeItem(LOGIN_TOAST_KEY);
    return;
  }

  if (
    !notification ||
    notification.type !== "success" ||
    !notification.createdAt
  ) {
    return;
  }

  // Menghindari notifikasi lama muncul kembali.
  const notificationAge = Date.now() - notification.createdAt;

  if (notificationAge > 60000 || notificationAge < 0) {
    return;
  }

  // Menghapus toast sebelumnya jika ada.
  const oldToast = document.getElementById("sipfasLoginToast");

  if (oldToast) {
    oldToast.remove();
  }

  // Membuat elemen notifikasi.
  const toast = document.createElement("div");

  toast.id = "sipfasLoginToast";
  toast.className = "sipfas-toast";

  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  // Membuat ikon berhasil.
  const iconWrapper = document.createElement("div");

  iconWrapper.className = "sipfas-toast-icon";

  iconWrapper.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6L9 17l-5-5"></path>
    </svg>
  `;

  // Membuat bagian teks.
  const content = document.createElement("div");

  content.className = "sipfas-toast-content";

  const title = document.createElement("strong");

  title.className = "sipfas-toast-title";
  title.textContent = notification.title || "Login Berhasil";

  const message = document.createElement("span");

  message.className = "sipfas-toast-message";
  message.textContent =
    notification.message || "Kamu berhasil masuk ke SIPFAS.";

  content.appendChild(title);
  content.appendChild(message);

  toast.appendChild(iconWrapper);
  toast.appendChild(content);

  document.body.appendChild(toast);

  // Memunculkan notifikasi dengan animasi.
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      toast.classList.add("show");
    });
  });

  // Menghilangkan notifikasi setelah 4 detik.
  setTimeout(function () {
    toast.classList.remove("show");
    toast.classList.add("hide");

    setTimeout(function () {
      toast.remove();
    }, 400);
  }, 4000);

  console.log("Notifikasi Login Berhasil ditampilkan.");
}
