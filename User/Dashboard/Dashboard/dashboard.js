// 01. Menjalankan Dashboard setelah HTML selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  initializeDashboard();
});

// 02. Menentukan nama penyimpanan data laporan dan profil.
const STORAGE_KEY = "sipfasReports";
const PROFILE_KEY = "sipfasProfile";

// 03. Menyediakan data laporan awal untuk simulasi.
const initialReports = [
  {
    id: "LP-2024-089",
    date: "24 Okt 2024",
    facility: "Proyektor Lab Komputer 2",
    priority: "Tinggi",
    status: "Menunggu Verifikasi",
  },
  {
    id: "LP-2024-085",
    date: "22 Okt 2024",
    facility: "Unit AC Split 2 PK",
    priority: "Tinggi",
    status: "Diproses",
  },
  {
    id: "LP-2024-081",
    date: "18 Okt 2024",
    facility: "Papan Tulis Whiteboard",
    priority: "Sedang",
    status: "Selesai",
  },
  {
    id: "LP-2024-076",
    date: "15 Okt 2024",
    facility: "Stop Kontak Meja 04",
    priority: "Rendah",
    status: "Selesai",
  },
  {
    id: "LP-2024-072",
    date: "12 Okt 2024",
    facility: "Kipas Angin Dinding",
    priority: "Rendah",
    status: "Tidak Valid",
  },
  {
    id: "LP-2024-070",
    date: "10 Okt 2024",
    facility: "Kursi Kuliah Lipat",
    priority: "Rendah",
    status: "Selesai",
  },
];

// 04. Menginisialisasi seluruh fungsi Dashboard.
function initializeDashboard() {
  const reportTableBody = document.querySelector(".report-table tbody");

  if (!reportTableBody) {
    console.error("Tabel laporan Dashboard tidak ditemukan.");
    return;
  }

  // Memuat data laporan dan identitas pengguna.
  refreshDashboard();
  updateDashboardProfile();

  // Memperbarui laporan dan profil apabila data berubah dari tab lain.
  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY || event.key === null) {
      refreshDashboard();
    }

    if (event.key === PROFILE_KEY || event.key === null) {
      updateDashboardProfile();
    }
  });

  console.log("Dashboard SIPFAS berhasil dijalankan.");
}

// 05. Mengambil data laporan dari LocalStorage.
function getDashboardReports() {
  try {
    const savedReports = localStorage.getItem(STORAGE_KEY);

    if (savedReports === null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialReports));
      return [...initialReports];
    }

    const parsedReports = JSON.parse(savedReports);

    if (!Array.isArray(parsedReports)) {
      throw new Error("Format data laporan tidak valid.");
    }

    return parsedReports.filter(function (report) {
      return report && typeof report === "object";
    });
  } catch (error) {
    console.error("Gagal mengambil data laporan:", error);
    return [];
  }
}

// 06. Menyesuaikan struktur data laporan dari berbagai halaman.
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

// 07. Menyamakan format status laporan.
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

// 08. Mengubah tanggal laporan ke format Indonesia.
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

// 09. Mengubah tanggal laporan menjadi angka untuk pengurutan.
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

// 10. Memuat ulang seluruh data dan tampilan Dashboard.
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

// 11. Menghitung jumlah laporan berdasarkan status.
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

// 12. Memperbarui angka pada kartu statistik Dashboard.
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

// 13. Menampilkan lima laporan terbaru pada tabel Dashboard.
function renderRecentReports(reports) {
  const reportTableBody = document.querySelector(".report-table tbody");

  if (!reportTableBody) return;

  reportTableBody.replaceChildren();

  // Menampilkan seluruh laporan tanpa batas jumlah.
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

    // Membuat kolom nama fasilitas.
    const facilityCell = document.createElement("td");
    const facilityWrapper = document.createElement("div");
    const facilityIcon = createFacilityIcon();
    const facilityText = document.createElement("strong");

    facilityWrapper.className = "facility-name";
    facilityText.textContent = report.facility;

    facilityWrapper.appendChild(facilityIcon);
    facilityWrapper.appendChild(facilityText);
    facilityCell.appendChild(facilityWrapper);

    // Membuat kolom tanggal laporan.
    const dateCell = document.createElement("td");
    dateCell.textContent = report.date;

    // Membuat kolom status laporan.
    const statusCell = document.createElement("td");
    const statusBadge = createDashboardStatusBadge(report.status);

    statusCell.appendChild(statusBadge);

    // Membuat kolom tombol detail laporan.
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

    // Menggabungkan seluruh kolom ke dalam baris tabel.
    row.appendChild(facilityCell);
    row.appendChild(dateCell);
    row.appendChild(statusCell);
    row.appendChild(actionCell);

    reportTableBody.appendChild(row);
  });
}

// 14. Membuat ikon fasilitas menggunakan SVG.
function createFacilityIcon() {
  const svgNamespace = "http://www.w3.org/2000/svg";

  const icon = document.createElementNS(svgNamespace, "svg");

  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(svgNamespace, "path");

  path.setAttribute("d", "M4 5h16v14H4z M8 9h8 M8 13h8 M8 17h5");

  icon.appendChild(path);

  return icon;
}

// 15. Membuat badge sesuai status perkembangan laporan.
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

  // Menambahkan titik indikator status.
  if (status === "waiting" || status === "processing") {
    const dot = document.createElement("span");

    dot.className = "status-dot";
    badge.appendChild(dot);
  }

  // Menambahkan ikon laporan tidak valid.
  if (status === "invalid") {
    const invalidIcon = document.createElement("span");

    invalidIcon.className = "invalid-icon";
    invalidIcon.textContent = "⊗";

    badge.appendChild(invalidIcon);
  }

  badge.appendChild(document.createTextNode(configuration.label));

  return badge;
}

// 16. Memperbarui keterangan jumlah aktivitas laporan.
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

// 17. Mengambil dan menampilkan identitas terbaru pengguna.
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

    // Memperbarui nama pada bagian header Dashboard.
    document.querySelectorAll(".header-name").forEach(function (elemen) {
      elemen.textContent = namaPengguna;
    });

    // Memperbarui nama pada bagian sapaan Dashboard.
    const sapaan = document.querySelector(".welcome-name");

    if (sapaan) {
      sapaan.textContent = "Selamat Datang, " + namaPengguna;
    }

    console.log("Identitas pengguna berhasil diperbarui:", namaPengguna);
  } catch (error) {
    console.error("Gagal memperbarui identitas pengguna:", error);
  }
}
