// 01. Menjalankan JavaScript setelah seluruh halaman selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  displayReportDetail();
});

// 02. Menggunakan nama penyimpanan yang sama dengan halaman lainnya.
const DETAIL_STORAGE_KEY = "sipfasReports";

// 03. Menyediakan data contoh lama untuk simulasi laporan sebelumnya.
const legacyReportDetail = {
  id: "LP-2024-085",
  facility: "Unit AC Split 2 PK Panasonic",
  location: "Ruang Kuliah IF-301, Gedung Informatika Lt. 3",
  date: "22 Okt 2024",
  dateTime: "22 Oktober 2024, 09:30 WIT",
  priority: "Tinggi",
  description:
    "AC mengeluarkan suara bising mendengung dan hembusan angin tidak dingin sama sekali sejak perkuliahan jam pertama pagi. Suhu ruangan gerah dan mengganggu kenyamanan mahasiswa.",
  mainStatus: "Diproses",
  verificationDescription: "Diverifikasi oleh Petugas Sarpras",
  verificationStatus: "Valid",
  handlingDescription: "Teknisi sedang melakukan perbaikan di lokasi",
  handlingStatus: "Diproses",
};

// 04. Mengambil ID laporan dari URL browser.
function getReportIdFromURL() {
  const urlParameters = new URLSearchParams(window.location.search);

  return urlParameters.get("id") || "LP-2024-085";
}

// 05. Mengambil seluruh laporan yang tersimpan di localStorage.
function getAllReportData() {
  const savedReports = localStorage.getItem(DETAIL_STORAGE_KEY);

  if (!savedReports) {
    return [];
  }

  const parsedReports = JSON.parse(savedReports);

  if (!Array.isArray(parsedReports)) {
    throw new Error("Format data laporan tidak valid.");
  }

  return parsedReports;
}

// 06. Mencari laporan berdasarkan ID yang dipilih pengguna.
function getReportById(reportId) {
  try {
    const reports = getAllReportData();

    const selectedReport = reports.find(function (report) {
      return String(report.id) === String(reportId);
    });

    // Mengembalikan data laporan apabila ditemukan.
    if (selectedReport) {
      if (reportId === "LP-2024-085") {
        return {
          ...legacyReportDetail,
          ...selectedReport,
          dateTime: selectedReport.dateTime || legacyReportDetail.dateTime,
          location: selectedReport.location || legacyReportDetail.location,
          description:
            selectedReport.description || legacyReportDetail.description,
          mainStatus:
            selectedReport.mainStatus ||
            selectedReport.status ||
            legacyReportDetail.mainStatus,
        };
      }

      return selectedReport;
    }

    // Memeriksa data sesi apabila laporan belum ditemukan.
    const lastReport = sessionStorage.getItem("laporanTerakhir");

    if (lastReport) {
      const parsedLastReport = JSON.parse(lastReport);

      if (String(parsedLastReport.id) === String(reportId)) {
        return parsedLastReport;
      }
    }

    // Menggunakan data contoh lama apabila sesuai ID.
    if (reportId === "LP-2024-085") {
      return legacyReportDetail;
    }

    return null;
  } catch (error) {
    console.error("Gagal mengambil data detail laporan:", error);
    return null;
  }
}

// 07. Mengambil dan menampilkan detail laporan berdasarkan ID.
function displayReportDetail() {
  const reportId = getReportIdFromURL();

  const selectedReport = getReportById(reportId);

  // Memeriksa apakah laporan tersedia.
  if (!selectedReport) {
    showReportError("Data laporan dengan ID " + reportId + " tidak ditemukan.");
    return;
  }

  // Mengambil elemen HTML halaman Detail Laporan.
  const reportTitle = document.querySelector(".page-heading h1");

  const mainStatus = document.querySelector(".main-status span:last-child");

  const reportFields = document.querySelectorAll(".report-grid .report-field");

  const descriptionText = document.querySelector(".description-box");

  const statusRows = document.querySelectorAll(".status-information");

  // Memeriksa ketersediaan elemen HTML.
  if (
    !reportTitle ||
    !mainStatus ||
    reportFields.length < 4 ||
    !descriptionText ||
    statusRows.length < 2
  ) {
    console.error("Elemen HTML Detail Laporan tidak ditemukan.");
    return;
  }

  // 08. Mengambil nilai data laporan.
  const facility =
    selectedReport.facility || selectedReport.namaFasilitas || "-";

  const location =
    selectedReport.location || selectedReport.lokasiFasilitas || "-";

  const date =
    selectedReport.dateTime ||
    selectedReport.date ||
    selectedReport.tanggalLaporan ||
    "-";

  const priority =
    selectedReport.priority || selectedReport.prioritas || "Belum Ditentukan";

  const description =
    selectedReport.description || selectedReport.deskripsi || "-";

  const reportStatus =
    selectedReport.mainStatus || selectedReport.status || "Menunggu Verifikasi";

  // 09. Memperbarui judul dan status utama laporan.
  reportTitle.textContent = "Detail Laporan #" + reportId;

  mainStatus.textContent = reportStatus;

  // 10. Menampilkan informasi fasilitas dan lokasi.
  reportFields[0].querySelector("strong").textContent = facility;

  reportFields[1].querySelector("strong").textContent = location;

  // 11. Menampilkan tanggal laporan.
  reportFields[2].querySelector("strong").textContent = date;

  // 12. Menampilkan rekomendasi prioritas.
  const priorityBadge = reportFields[3].querySelector(".priority-badge");

  if (priorityBadge) {
    priorityBadge.textContent = priority.replace(/^Prioritas\s+/i, "");
  }

  // 13. Menampilkan deskripsi kerusakan.
  descriptionText.textContent = description;

  // 14. Menampilkan informasi verifikasi laporan.
  const verificationRow = statusRows[0];

  const verificationDescription =
    selectedReport.verificationDescription ||
    "Laporan sedang menunggu verifikasi petugas.";

  const verificationStatus = selectedReport.verificationStatus || "Menunggu";

  const verificationText = verificationRow.querySelector(
    ".status-description strong",
  );

  const verificationBadge = verificationRow.querySelector(
    ".verification-badge",
  );

  if (verificationText) {
    verificationText.textContent = verificationDescription;
  }

  if (verificationBadge) {
    const badgeText =
      verificationBadge.querySelector("span:last-child") || verificationBadge;

    badgeText.textContent = verificationStatus;
  }

  // 15. Menampilkan informasi penanganan laporan.
  const handlingRow = statusRows[1];

  const handlingDescription =
    selectedReport.handlingDescription ||
    "Laporan belum masuk tahap penanganan.";

  const handlingStatus = selectedReport.handlingStatus || "Menunggu";

  const handlingText = handlingRow.querySelector(".status-description strong");

  const handlingBadge = handlingRow.querySelector(".handling-badge");

  if (handlingText) {
    handlingText.textContent = handlingDescription;
  }

  if (handlingBadge) {
    const badgeText =
      handlingBadge.querySelector("span:last-child") || handlingBadge;

    badgeText.textContent = handlingStatus;
  }

  // 16. Menampilkan informasi laporan pada Console.
  console.log("===== DETAIL LAPORAN SIPFAS =====");
  console.log("ID:", reportId);
  console.log("Fasilitas:", facility);
  console.log("Lokasi:", location);
  console.log("Prioritas:", priority);
  console.log("Status:", reportStatus);
  console.log("=================================");
}

// 17. Menampilkan pemberitahuan apabila laporan tidak ditemukan.
function showReportError(message) {
  console.error(message);
  alert(message);
}

// 01. Menjalankan JavaScript setelah halaman selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  tampilkanDetailLaporan();
});

// 02. Menentukan nama penyimpanan laporan di LocalStorage.
const KUNCI_LAPORAN = "sipfasReports";

// 03. Menyediakan data simulasi untuk enam laporan awal.
const dataSimulasi = [
  {
    id: "LP-2024-089",
    facility: "Proyektor Lab Komputer 2",
    location: "Laboratorium Komputer",
    date: "24 Okt 2024",
    dateTime: "24 Oktober 2024, 09:00 WIT",
    priority: "Tinggi",
    description:
      "Proyektor mengalami gangguan tampilan dan gambar terkadang tidak muncul saat digunakan dalam kegiatan perkuliahan.",
    status: "Menunggu Verifikasi",
    verificationStatus: "Menunggu",
    verificationDescription: "Laporan sedang menunggu verifikasi petugas.",
    handlingStatus: "Menunggu",
    handlingDescription: "Laporan belum masuk tahap penanganan.",
  },
  {
    id: "LP-2024-085",
    facility: "Unit AC Split 2 PK",
    location: "Ruang Kuliah IF-301, Gedung Informatika Lt. 3",
    date: "22 Okt 2024",
    dateTime: "22 Oktober 2024, 09:30 WIT",
    priority: "Tinggi",
    description:
      "AC mengeluarkan suara bising mendengung dan hembusan angin tidak dingin sama sekali sejak perkuliahan jam pertama pagi. Suhu ruangan gerah dan mengganggu kenyamanan mahasiswa.",
    status: "Diproses",
    verificationStatus: "Valid",
    verificationDescription: "Diverifikasi oleh Petugas Sarpras.",
    handlingStatus: "Diproses",
    handlingDescription: "Teknisi sedang melakukan perbaikan di lokasi.",
  },
  {
    id: "LP-2024-081",
    facility: "Papan Tulis Whiteboard",
    location: "Ruang Kuliah",
    date: "18 Okt 2024",
    dateTime: "18 Oktober 2024, 10:00 WIT",
    priority: "Sedang",
    description:
      "Permukaan papan tulis mengalami kerusakan sehingga tulisan sulit dibersihkan dan mengganggu kegiatan pembelajaran.",
    status: "Selesai",
    verificationStatus: "Valid",
    verificationDescription: "Laporan telah diverifikasi oleh Petugas Sarpras.",
    handlingStatus: "Selesai",
    handlingDescription: "Perbaikan fasilitas telah selesai dilakukan.",
  },
  {
    id: "LP-2024-076",
    facility: "Stop Kontak Meja 04",
    location: "Gedung Informatika Lantai 1",
    date: "15 Okt 2024",
    dateTime: "15 Oktober 2024, 11:00 WIT",
    priority: "Rendah",
    description:
      "Stop kontak pada meja mengalami gangguan dan tidak dapat digunakan untuk menghubungkan perangkat elektronik.",
    status: "Selesai",
    verificationStatus: "Valid",
    verificationDescription: "Laporan telah diverifikasi oleh Petugas Sarpras.",
    handlingStatus: "Selesai",
    handlingDescription:
      "Stop kontak telah diperbaiki dan dapat digunakan kembali.",
  },
  {
    id: "LP-2024-072",
    facility: "Kipas Angin Dinding",
    location: "Ruang Kuliah",
    date: "12 Okt 2024",
    dateTime: "12 Oktober 2024, 09:00 WIT",
    priority: "Rendah",
    description:
      "Kipas angin dinding dilaporkan mengalami gangguan putaran dan mengeluarkan suara tidak normal.",
    status: "Tidak Valid",
    verificationStatus: "Tidak Valid",
    verificationDescription: "Laporan tidak memenuhi persyaratan verifikasi.",
    handlingStatus: "Tidak Diproses",
    handlingDescription: "Laporan tidak dilanjutkan ke tahap penanganan.",
  },
  {
    id: "LP-2024-070",
    facility: "Kursi Kuliah Lipat",
    location: "Gedung Informatika Lantai 2",
    date: "10 Okt 2024",
    dateTime: "10 Oktober 2024, 08:30 WIT",
    priority: "Rendah",
    description:
      "Kursi kuliah lipat mengalami kerusakan pada bagian sambungan sehingga kurang nyaman digunakan.",
    status: "Selesai",
    verificationStatus: "Valid",
    verificationDescription: "Laporan telah diverifikasi oleh Petugas Sarpras.",
    handlingStatus: "Selesai",
    handlingDescription: "Kursi telah diperbaiki dan dapat digunakan kembali.",
  },
];

// 04. Mengambil ID laporan dari alamat URL.
function ambilIdLaporan() {
  const parameterURL = new URLSearchParams(window.location.search);

  return parameterURL.get("id");
}

// 05. Mengambil seluruh data laporan dari LocalStorage.
function ambilSemuaLaporan() {
  const dataTersimpan = localStorage.getItem(KUNCI_LAPORAN);

  // Menggunakan array kosong jika belum ada data.
  if (!dataTersimpan) {
    return [];
  }

  // Mengubah data JSON menjadi array JavaScript.
  const daftarLaporan = JSON.parse(dataTersimpan);

  // Memastikan data yang diambil berbentuk array.
  if (!Array.isArray(daftarLaporan)) {
    throw new Error("Format data laporan tidak valid.");
  }

  return daftarLaporan;
}

// 06. Mencari data laporan berdasarkan ID.
function cariLaporan(idLaporan) {
  try {
    const daftarLaporan = ambilSemuaLaporan();

    // Mencari laporan yang ID-nya sesuai.
    const laporanTersimpan = daftarLaporan.find(function (laporan) {
      return String(laporan.id) === String(idLaporan);
    });

    // Mencari data simulasi berdasarkan ID.
    const laporanContoh = dataSimulasi.find(function (laporan) {
      return laporan.id === idLaporan;
    });

    // Jika laporan tersimpan ditemukan, gabungkan dengan data simulasi
    // agar laporan lama yang belum memiliki semua kolom tetap lengkap.
    if (laporanTersimpan) {
      return {
        ...(laporanContoh || {}),
        ...laporanTersimpan,
      };
    }

    // Menggunakan data simulasi jika belum ada di LocalStorage.
    if (laporanContoh) {
      return laporanContoh;
    }

    // Memeriksa data laporan terakhir dari sessionStorage.
    const dataSesi = sessionStorage.getItem("laporanTerakhir");

    if (dataSesi) {
      const laporanSesi = JSON.parse(dataSesi);

      if (String(laporanSesi.id) === String(idLaporan)) {
        return laporanSesi;
      }
    }

    return null;
  } catch (error) {
    console.error("Gagal mengambil detail laporan:", error);
    return null;
  }
}

// 07. Menampilkan informasi apabila laporan tidak ditemukan.
function tampilkanPesanError(pesan) {
  const halamanKonten = document.querySelector(".page-content");

  if (!halamanKonten) return;

  const pesanError = document.createElement("p");

  pesanError.textContent = pesan;
  pesanError.style.padding = "20px";
  pesanError.style.color = "#dc2626";
  pesanError.style.background = "#fff1f0";
  pesanError.style.borderRadius = "8px";

  halamanKonten.appendChild(pesanError);
}

// 08. Mengisi informasi laporan ke dalam halaman HTML.
function tampilkanDetailLaporan() {
  // Mengambil ID dari URL.
  const idLaporan = ambilIdLaporan();

  // Memeriksa apakah ID tersedia.
  if (!idLaporan) {
    tampilkanPesanError(
      "Kode laporan tidak ditemukan. Silakan pilih laporan dari Riwayat Laporan.",
    );
    return;
  }

  // Mencari data laporan berdasarkan ID.
  const laporan = cariLaporan(idLaporan);

  // Memeriksa apakah data laporan tersedia.
  if (!laporan) {
    tampilkanPesanError(
      "Data laporan dengan kode " + idLaporan + " tidak ditemukan.",
    );
    return;
  }

  // 09. Mengambil elemen HTML yang akan diperbarui.
  const judulLaporan = document.querySelector(".page-heading h1");
  const statusUtama = document.querySelector(".main-status span:last-child");
  const daftarField = document.querySelectorAll(".report-grid .report-field");
  const deskripsiKerusakan = document.querySelector(".description-box");
  const daftarStatus = document.querySelectorAll(".status-information");

  // Memeriksa kelengkapan elemen HTML.
  if (
    !judulLaporan ||
    !statusUtama ||
    daftarField.length < 4 ||
    !deskripsiKerusakan ||
    daftarStatus.length < 2
  ) {
    console.error("Elemen HTML Detail Laporan tidak lengkap.");
    return;
  }

  // 10. Menyiapkan informasi laporan.
  const namaFasilitas = laporan.facility || laporan.namaFasilitas || "-";

  const lokasiFasilitas = laporan.location || laporan.lokasiFasilitas || "-";

  const tanggalLaporan =
    laporan.dateTime || laporan.date || laporan.tanggalLaporan || "-";

  const prioritasLaporan =
    laporan.priority || laporan.prioritas || "Belum Ditentukan";

  const deskripsi = laporan.description || laporan.deskripsi || "-";

  const statusLaporan =
    laporan.mainStatus || laporan.status || "Menunggu Verifikasi";

  // 11. Menampilkan judul dan status utama laporan.
  judulLaporan.textContent = "Detail Laporan #" + idLaporan;

  statusUtama.textContent = statusLaporan;

  // 12. Menampilkan nama dan lokasi fasilitas.
  daftarField[0].querySelector("strong").textContent = namaFasilitas;

  daftarField[1].querySelector("strong").textContent = lokasiFasilitas;

  // 13. Menampilkan tanggal laporan.
  daftarField[2].querySelector("strong").textContent = tanggalLaporan;

  // 14. Menampilkan rekomendasi prioritas.
  const badgePrioritas = daftarField[3].querySelector(".priority-badge");

  if (badgePrioritas) {
    badgePrioritas.textContent = String(prioritasLaporan).replace(
      /^Prioritas\s+/i,
      "",
    );
  }

  // 15. Menampilkan deskripsi kerusakan.
  deskripsiKerusakan.textContent = deskripsi;

  // 16. Menampilkan informasi verifikasi.
  tampilkanStatusLaporan(
    daftarStatus[0],
    laporan.verificationDescription ||
      "Laporan sedang menunggu verifikasi petugas.",
    laporan.verificationStatus || "Menunggu",
    ".verification-badge",
  );

  // 17. Menampilkan informasi penanganan.
  tampilkanStatusLaporan(
    daftarStatus[1],
    laporan.handlingDescription || "Laporan belum masuk tahap penanganan.",
    laporan.handlingStatus || "Menunggu",
    ".handling-badge",
  );

  // 18. Menampilkan informasi laporan pada Console.
  console.log("===== DETAIL LAPORAN SIPFAS =====");
  console.log("ID Laporan:", idLaporan);
  console.log("Fasilitas:", namaFasilitas);
  console.log("Lokasi:", lokasiFasilitas);
  console.log("Tanggal:", tanggalLaporan);
  console.log("Prioritas:", prioritasLaporan);
  console.log("Status:", statusLaporan);
  console.log("=================================");
}

// 19. Mengatur keterangan dan badge status laporan.
function tampilkanStatusLaporan(barisStatus, keterangan, status, namaBadge) {
  // Mengambil keterangan status.
  const teksKeterangan = barisStatus.querySelector(
    ".status-description strong",
  );

  // Mengambil badge status.
  const badgeStatus = barisStatus.querySelector(namaBadge);

  // Memperbarui keterangan.
  if (teksKeterangan) {
    teksKeterangan.textContent = keterangan;
  }

  // Memperbarui tulisan badge tanpa menghapus ikon.
  if (badgeStatus) {
    const teksBadge = badgeStatus.querySelector("span:last-child");

    if (teksBadge) {
      teksBadge.textContent = status;
    } else {
      badgeStatus.textContent = status;
    }
  }
}
function updateDetailProfile() {
  try {
    const savedProfile = localStorage.getItem("sipfasProfile");

    if (!savedProfile) return;

    const profile = JSON.parse(savedProfile);

    const userName = String(profile.name || "").trim();

    const headerName = document.querySelector(".header-name");

    if (headerName && userName) {
      headerName.textContent = userName;
    }
  } catch (error) {
    console.error("Gagal mengambil profil:", error);
  }
}

document.addEventListener("DOMContentLoaded", updateDetailProfile);
