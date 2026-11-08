/* 01. Menjalankan fungsi Dashboard setelah HTML selesai dimuat. */
document.addEventListener("DOMContentLoaded", function () {
  initializeDashboard();
});

/* 02. Menentukan nama penyimpanan utama seluruh data laporan. */
const STORAGE_KEY = "sipfasReports";

/* 03. Menyediakan data laporan awal untuk simulasi sebelum database dibuat.
   Data awal disamakan dengan data pada halaman Riwayat Laporan. */
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

/* 04. Menginisialisasi seluruh fungsi Dashboard. */
function initializeDashboard() {
  const reportTableBody = document.querySelector(".report-table tbody");

  // Memastikan tabel laporan tersedia pada halaman.
  if (!reportTableBody) {
    console.error("Tabel laporan Dashboard tidak ditemukan.");
    return;
  }

  // Memuat data dan memperbarui seluruh tampilan Dashboard.
  refreshDashboard();

  // Memperbarui Dashboard apabila data berubah dari tab lain.
  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY) {
      refreshDashboard();
    }
  });
}

/* 05. Mengambil data laporan dari LocalStorage. */
function getDashboardReports() {
  try {
    const savedReports = localStorage.getItem(STORAGE_KEY);

    // Menyimpan data awal apabila belum ada penyimpanan laporan.
    if (savedReports === null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialReports));

      return [...initialReports];
    }

    // Mengubah data JSON menjadi array JavaScript.
    const parsedReports = JSON.parse(savedReports);

    // Memastikan data laporan berbentuk array.
    if (!Array.isArray(parsedReports)) {
      throw new Error("Format data laporan tidak valid.");
    }

    // Mengembalikan seluruh data laporan yang tersimpan.
    return parsedReports.filter(function (report) {
      return report && typeof report === "object";
    });
  } catch (error) {
    console.error("Gagal mengambil data laporan:", error);

    return [];
  }
}

/* 06. Menyesuaikan struktur data laporan dari berbagai halaman.
   Mendukung format Riwayat Laporan dan Buat Laporan. */
function normalizeDashboardReport(report) {
  // Mengambil kode laporan dari beberapa kemungkinan nama properti.
  const reportId = report.id || report.kodeLaporan || report.kode_laporan || "";

  // Mengambil nama fasilitas dari data laporan.
  const facilityName =
    report.facility ||
    report.namaFasilitas ||
    report.nama_fasilitas ||
    "Fasilitas tidak disebutkan";

  // Mengambil tanggal laporan.
  const rawDate =
    report.date ||
    report.tanggalLaporan ||
    report.tanggal_laporan ||
    report.createdAt ||
    report.created_at ||
    "";

  // Mengambil status utama laporan.
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

/* 07. Menyamakan format status laporan agar dapat dihitung Dashboard. */
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

/* 08. Mengubah tanggal laporan ke format yang sesuai untuk Dashboard. */
function formatReportDate(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const dateString = String(dateValue);

  // Mempertahankan tanggal yang sudah berbentuk teks.
  if (!/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    return dateString;
  }

  const dateObject = new Date(dateString);

  // Memformat tanggal ISO menjadi tanggal Indonesia.
  if (!isNaN(dateObject.getTime())) {
    return dateObject.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return dateString;
}

/* 09. Mengubah tanggal laporan menjadi angka untuk pengurutan terbaru. */
function parseReportDate(dateValue) {
  if (!dateValue) {
    return 0;
  }

  const dateString = String(dateValue);

  // Membaca tanggal berformat ISO atau format yang dikenali browser.
  const directDate = new Date(dateString);

  if (!isNaN(directDate.getTime())) {
    return directDate.getTime();
  }

  // Menyediakan nama bulan Indonesia untuk tanggal berbentuk teks.
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

  // Mengambil tanggal, bulan, dan tahun dari teks.
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

/* 10. Memuat ulang seluruh data dan tampilan Dashboard. */
function refreshDashboard() {
  // Mengambil laporan dari LocalStorage.
  const reports = getDashboardReports();

  // Menyesuaikan format data agar seragam.
  const normalizedReports = reports.map(function (report) {
    return normalizeDashboardReport(report);
  });

  // Mengurutkan laporan berdasarkan tanggal terbaru.
  normalizedReports.sort(function (a, b) {
    return b.sortDate - a.sortDate;
  });

  // Memperbarui angka statistik Dashboard.
  renderDashboardStatistics(normalizedReports);

  // Memperbarui tabel lima laporan terbaru.
  renderRecentReports(normalizedReports);

  // Menampilkan informasi aktivitas laporan.
  updateActivityDescription(normalizedReports.length);

  // Menampilkan informasi proses pada Console.
  console.log("===== DASHBOARD SIPFAS =====");
  console.log("Total laporan:", normalizedReports.length);
  console.log("Data laporan:", normalizedReports);
  console.log("============================");
}

/* 11. Menghitung jumlah laporan berdasarkan statusnya. */
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

/* 12. Menampilkan hasil perhitungan pada empat kartu statistik. */
function renderDashboardStatistics(reports) {
  const statistics = calculateReportStatistics(reports);

  // Mengambil elemen angka pada setiap kartu statistik.
  const totalElement = document.querySelector(".total-number");

  const waitingElement = document.querySelector(".waiting-number");

  const processingElement = document.querySelector(".process-number");

  const completedElement = document.querySelector(".completed-number");

  // Memperbarui angka total laporan.
  if (totalElement) {
    totalElement.textContent = statistics.total;
  }

  // Memperbarui jumlah laporan menunggu verifikasi.
  if (waitingElement) {
    waitingElement.textContent = statistics.waiting;
  }

  // Memperbarui jumlah laporan yang sedang diproses.
  if (processingElement) {
    processingElement.textContent = statistics.processing;
  }

  // Memperbarui jumlah laporan yang telah selesai.
  if (completedElement) {
    completedElement.textContent = statistics.completed;
  }
}

/* 13. Menampilkan lima laporan terbaru pada tabel Dashboard. */
function renderRecentReports(reports) {
  const reportTableBody = document.querySelector(".report-table tbody");

  if (!reportTableBody) {
    return;
  }

  // Menghapus data tabel lama sebelum menampilkan data terbaru.
  reportTableBody.replaceChildren();

  // Mengambil maksimal lima laporan terbaru.
  const recentReports = reports.slice(0, 5);

  // Menampilkan pesan apabila belum terdapat laporan.
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

  // Membuat baris tabel untuk setiap laporan terbaru.
  recentReports.forEach(function (report) {
    const row = document.createElement("tr");

    // Kolom nama fasilitas.
    const facilityCell = document.createElement("td");

    const facilityWrapper = document.createElement("div");

    facilityWrapper.className = "facility-name";

    // Membuat ikon fasilitas.
    const facilityIcon = createFacilityIcon();

    const facilityText = document.createElement("strong");

    facilityText.textContent = report.facility;

    facilityWrapper.appendChild(facilityIcon);

    facilityWrapper.appendChild(facilityText);

    facilityCell.appendChild(facilityWrapper);

    // Kolom tanggal laporan.
    const dateCell = document.createElement("td");

    dateCell.textContent = report.date;

    // Kolom status laporan.
    const statusCell = document.createElement("td");

    const statusBadge = createDashboardStatusBadge(report.status);

    statusCell.appendChild(statusBadge);

    // Kolom tombol detail laporan.
    const actionCell = document.createElement("td");

    const detailLink = document.createElement("a");

    detailLink.className = "detail-link";

    detailLink.textContent = "Detail ›";

    // Mengirim ID laporan melalui parameter URL.
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

    // Menggabungkan seluruh kolom ke dalam satu baris.
    row.appendChild(facilityCell);

    row.appendChild(dateCell);

    row.appendChild(statusCell);

    row.appendChild(actionCell);

    // Memasukkan baris ke dalam tabel Dashboard.
    reportTableBody.appendChild(row);
  });
}

/* 14. Membuat ikon fasilitas menggunakan elemen SVG. */
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

/* 15. Membuat badge status sesuai perkembangan laporan. */
function createDashboardStatusBadge(status) {
  const badge = document.createElement("span");

  badge.className = "status-badge";

  // Menentukan tampilan berdasarkan status laporan.
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

  // Membuat titik indikator untuk status menunggu dan diproses.
  if (status === "waiting" || status === "processing") {
    const dot = document.createElement("span");

    dot.className = "status-dot";

    badge.appendChild(dot);
  }

  // Membuat ikon khusus untuk laporan tidak valid.
  if (status === "invalid") {
    const invalidIcon = document.createElement("span");

    invalidIcon.className = "invalid-icon";

    invalidIcon.textContent = "⊗";

    badge.appendChild(invalidIcon);
  }

  // Menampilkan keterangan status laporan.
  badge.appendChild(document.createTextNode(configuration.label));

  return badge;
}

/* 16. Memperbarui keterangan jumlah aktivitas laporan terbaru. */
function updateActivityDescription(totalReports) {
  const description = document.querySelector(".section-heading p");

  if (!description) {
    return;
  }

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
