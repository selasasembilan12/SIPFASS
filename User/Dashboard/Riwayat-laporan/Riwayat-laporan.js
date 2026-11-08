// 01. Menjalankan JavaScript setelah HTML selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  mulaiRiwayatLaporan();
});

// 02. Nama penyimpanan yang sama dengan halaman Dashboard dan Buat Laporan.
// 02. Menentukan nama penyimpanan laporan dan profil pengguna.
const KUNCI_PENYIMPANAN = "sipfasReports";
const PROFILE_KEY = "sipfasProfile";

// 03. Data simulasi awal apabila LocalStorage masih kosong.
const dataLaporanAwal = [
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

/* 04. Memulai halaman Riwayat Laporan dan sinkronisasi profil. */

function mulaiRiwayatLaporan() {
  const kolomPencarian = document.querySelector(".search-box input");
  const pilihanStatus = document.querySelector(".filter-box select");
  const tombolRefresh = document.querySelector(".refresh-button");
  const isiTabel = document.querySelector(".report-table tbody");

  // Memastikan seluruh elemen HTML tersedia.
  if (!kolomPencarian || !pilihanStatus || !tombolRefresh || !isiTabel) {
    console.error("Elemen Riwayat Laporan tidak ditemukan.");
    return;
  }

  // Menampilkan data profil terbaru pada bagian header.
  perbaruiProfilRiwayat();

  // Menampilkan seluruh data laporan.
  tampilkanRiwayatLaporan();

  // Memperbarui nama dan laporan apabila data berubah dari tab lain.
  window.addEventListener("storage", function (event) {
    if (event.key === PROFILE_KEY || event.key === null) {
      perbaruiProfilRiwayat();
    }

    if (event.key === KUNCI_PENYIMPANAN || event.key === null) {
      tampilkanRiwayatLaporan();
    }
  });

  // Menjalankan pencarian ketika pengguna mengetik.
  kolomPencarian.addEventListener("input", tampilkanRiwayatLaporan);

  // Menjalankan filter ketika pengguna memilih status.
  pilihanStatus.addEventListener("change", tampilkanRiwayatLaporan);

  // Memuat ulang data ketika tombol refresh diklik.
  tombolRefresh.addEventListener("click", function (event) {
    event.preventDefault();
    tampilkanRiwayatLaporan();
    perbaruiProfilRiwayat();
  });
}

/* =========================================================
   05. MENGAMBIL DATA DARI LOCALSTORAGE
========================================================= */

function ambilDataLaporan() {
  try {
    const dataTersimpan = localStorage.getItem(KUNCI_PENYIMPANAN);

    // Menyimpan data simulasi jika penyimpanan masih kosong.
    if (dataTersimpan === null) {
      localStorage.setItem(KUNCI_PENYIMPANAN, JSON.stringify(dataLaporanAwal));

      return [...dataLaporanAwal];
    }

    // Mengubah JSON menjadi array JavaScript.
    const dataLaporan = JSON.parse(dataTersimpan);

    // Memeriksa bentuk data yang tersimpan.
    if (
      !Array.isArray(dataLaporan) ||
      !dataLaporan.every(function (laporan) {
        return (
          laporan && typeof laporan === "object" && !Array.isArray(laporan)
        );
      })
    ) {
      throw new Error("Format data laporan tidak valid.");
    }

    return dataLaporan;
  } catch (error) {
    console.error("Gagal membaca data laporan:", error);

    return [];
  }
}

/* =========================================================
   06. MENYERAGAMKAN DATA LAPORAN
========================================================= */

function rapikanDataLaporan(laporan) {
  // Membaca ID dari beberapa kemungkinan nama properti.
  const kode = laporan.id || laporan.kodeLaporan || laporan.kode_laporan || "";

  // Membaca nama fasilitas.
  const fasilitas =
    laporan.facility ||
    laporan.namaFasilitas ||
    laporan.nama_fasilitas ||
    "Fasilitas tidak disebutkan";

  // Membaca lokasi fasilitas.
  const lokasi =
    laporan.location ||
    laporan.lokasiFasilitas ||
    laporan.lokasi_fasilitas ||
    "";

  // Membaca tanggal laporan.
  const tanggal =
    laporan.date ||
    laporan.tanggalLaporan ||
    laporan.tanggal_laporan ||
    laporan.createdAt ||
    laporan.created_at ||
    "";

  // Membaca prioritas laporan.
  const prioritas = laporan.priority || laporan.prioritas || "Belum Ditentukan";

  // Membaca status laporan.
  const status =
    laporan.status ||
    laporan.mainStatus ||
    laporan.statusLaporan ||
    laporan.status_laporan ||
    "Menunggu Verifikasi";

  return {
    ...laporan,
    id: String(kode),
    facility: String(fasilitas),
    location: String(lokasi),
    date: formatTanggalLaporan(tanggal),
    sortDate: bacaTanggalLaporan(tanggal),
    priority: formatPrioritas(prioritas),
    status: formatStatus(status),
  };
}

/* =========================================================
   07. MENYERAGAMKAN FORMAT PRIORITAS
========================================================= */

function formatPrioritas(prioritas) {
  const nilai = String(prioritas)
    .replace(/^Prioritas\s+/i, "")
    .trim()
    .toLowerCase();

  const daftarPrioritas = {
    tinggi: "Tinggi",
    sedang: "Sedang",
    rendah: "Rendah",
  };

  return daftarPrioritas[nilai] || "Belum Ditentukan";
}

/* =========================================================
   08. MENYERAGAMKAN FORMAT STATUS
========================================================= */

function formatStatus(status) {
  const nilai = String(status).toLowerCase().trim();

  if (nilai.includes("menunggu")) {
    return "Menunggu Verifikasi";
  }

  if (nilai.includes("proses")) {
    return "Diproses";
  }

  if (nilai.includes("selesai")) {
    return "Selesai";
  }

  if (
    nilai.includes("tidak valid") ||
    nilai.includes("invalid") ||
    nilai.includes("ditolak")
  ) {
    return "Tidak Valid";
  }

  return "Menunggu Verifikasi";
}

/* =========================================================
   09. MEMBACA DAN MENGUBAH FORMAT TANGGAL
========================================================= */

function bacaTanggalLaporan(tanggal) {
  if (!tanggal) return 0;

  // Mencoba membaca tanggal ISO atau format bawaan JavaScript.
  const tanggalLangsung = new Date(tanggal);

  if (!isNaN(tanggalLangsung.getTime())) {
    return tanggalLangsung.getTime();
  }

  // Daftar bulan dalam bahasa Indonesia.
  const bulan = {
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

  // Membaca tanggal seperti 24 Okt 2024.
  const cocok = String(tanggal).match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);

  if (cocok) {
    const hari = Number(cocok[1]);
    const namaBulan = cocok[2].toLowerCase();
    const tahun = Number(cocok[3]);

    if (bulan[namaBulan] !== undefined) {
      return new Date(tahun, bulan[namaBulan], hari).getTime();
    }
  }

  return 0;
}

// Mengubah tanggal menjadi format yang ditampilkan pada tabel.
function formatTanggalLaporan(tanggal) {
  if (!tanggal) return "-";

  const waktu = bacaTanggalLaporan(tanggal);

  if (!waktu) return String(tanggal);

  return new Date(waktu).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jayapura",
  });
}

/* =========================================================
   10. MENAMPILKAN RIWAYAT LAPORAN
========================================================= */

function tampilkanRiwayatLaporan() {
  const isiTabel = document.querySelector(".report-table tbody");
  const kolomPencarian = document.querySelector(".search-box input");
  const pilihanStatus = document.querySelector(".filter-box select");

  if (!isiTabel || !kolomPencarian || !pilihanStatus) return;

  // Mengambil dan menyeragamkan seluruh data laporan.
  const semuaLaporan = ambilDataLaporan().map(rapikanDataLaporan);

  // Mengurutkan laporan dari tanggal terbaru.
  semuaLaporan.sort(function (a, b) {
    return b.sortDate - a.sortDate;
  });

  // Mengambil kata kunci pencarian.
  const kataKunci = kolomPencarian.value.toLowerCase().trim();

  // Mengambil status yang dipilih.
  const statusDipilih = pilihanStatus.value;

  // Mencari dan menyaring laporan.
  const hasilFilter = semuaLaporan.filter(function (laporan) {
    const cocokPencarian =
      laporan.id.toLowerCase().includes(kataKunci) ||
      laporan.facility.toLowerCase().includes(kataKunci) ||
      laporan.location.toLowerCase().includes(kataKunci) ||
      laporan.date.toLowerCase().includes(kataKunci) ||
      laporan.priority.toLowerCase().includes(kataKunci) ||
      laporan.status.toLowerCase().includes(kataKunci);

    const cocokStatus =
      statusDipilih === "Semua Status" ||
      laporan.status === formatStatus(statusDipilih);

    return cocokPencarian && cocokStatus;
  });

  // Menghapus isi tabel sebelumnya.
  isiTabel.replaceChildren();

  // Menampilkan pesan jika data tidak ditemukan.
  if (hasilFilter.length === 0) {
    const barisKosong = document.createElement("tr");
    const kolomKosong = document.createElement("td");

    kolomKosong.colSpan = 6;
    kolomKosong.textContent = "Data laporan tidak ditemukan.";
    kolomKosong.style.textAlign = "center";
    kolomKosong.style.padding = "30px";
    kolomKosong.style.color = "#687d9d";

    barisKosong.appendChild(kolomKosong);
    isiTabel.appendChild(barisKosong);

    return;
  }

  // Menampilkan setiap laporan pada tabel.
  hasilFilter.forEach(function (laporan) {
    const baris = document.createElement("tr");

    // Kolom kode laporan.
    const kolomKode = document.createElement("td");
    kolomKode.className = "report-code";
    kolomKode.textContent = laporan.id || "-";

    // Kolom tanggal.
    const kolomTanggal = document.createElement("td");
    kolomTanggal.className = "report-date";
    kolomTanggal.textContent = laporan.date;

    // Kolom fasilitas.
    const kolomFasilitas = document.createElement("td");
    kolomFasilitas.className = "facility-name";
    kolomFasilitas.textContent = laporan.facility;

    // Kolom prioritas.
    const kolomPrioritas = document.createElement("td");
    kolomPrioritas.appendChild(buatBadgePrioritas(laporan.priority));

    // Kolom status.
    const kolomStatus = document.createElement("td");
    kolomStatus.appendChild(buatBadgeStatus(laporan.status));

    // Kolom aksi atau tombol detail.
    const kolomAksi = document.createElement("td");
    const tombolDetail = document.createElement("a");

    tombolDetail.className = "detail-button";
    tombolDetail.href =
      "../Detail-laporan/Detail-laporan.html?id=" +
      encodeURIComponent(laporan.id);

    tombolDetail.textContent = "Detail";

    // Membuat ikon mata pada tombol detail.
    tombolDetail.appendChild(buatIkonMata());

    kolomAksi.appendChild(tombolDetail);

    // Menggabungkan seluruh kolom.
    baris.append(
      kolomKode,
      kolomTanggal,
      kolomFasilitas,
      kolomPrioritas,
      kolomStatus,
      kolomAksi,
    );

    isiTabel.appendChild(baris);
  });

  // Menampilkan informasi pada Console.
  console.log("===== RIWAYAT LAPORAN SIPFAS =====");
  console.log("Total laporan:", semuaLaporan.length);
  console.log("Hasil pencarian:", hasilFilter.length);
  console.log("Kata kunci:", kataKunci || "Tidak ada");
  console.log("Filter status:", statusDipilih);
  console.log("Data laporan:", hasilFilter);
  console.log("==================================");
}

/* =========================================================
   11. MEMBUAT BADGE PRIORITAS
========================================================= */

function buatBadgePrioritas(prioritas) {
  const badge = document.createElement("span");
  const titik = document.createElement("span");

  const kelasPrioritas = {
    Tinggi: "priority-high",
    Sedang: "priority-medium",
    Rendah: "priority-low",
  };

  badge.className =
    "priority-badge " + (kelasPrioritas[prioritas] || "priority-low");

  titik.className = "badge-dot";

  badge.append(titik, document.createTextNode(prioritas));

  return badge;
}

/* =========================================================
   12. MEMBUAT BADGE STATUS
========================================================= */

function buatBadgeStatus(status) {
  const badge = document.createElement("span");

  const kelasStatus = {
    "Menunggu Verifikasi": "status-waiting",
    Diproses: "status-process",
    Selesai: "status-completed",
    "Tidak Valid": "status-invalid",
  };

  badge.className = "status-badge " + (kelasStatus[status] || "status-waiting");

  // Membuat ikon silang untuk laporan tidak valid.
  if (status === "Tidak Valid") {
    const ikon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    ikon.setAttribute("viewBox", "0 0 24 24");

    const lingkaran = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );

    lingkaran.setAttribute("cx", "12");
    lingkaran.setAttribute("cy", "12");
    lingkaran.setAttribute("r", "9");

    const silang = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );

    silang.setAttribute("d", "m9 9 6 6m0-6-6 6");

    ikon.append(lingkaran, silang);
    badge.appendChild(ikon);
  }

  badge.appendChild(document.createTextNode(status));

  return badge;
}

/* =========================================================
   13. MEMBUAT IKON MATA UNTUK TOMBOL DETAIL
========================================================= */

function buatIkonMata() {
  const ikon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  ikon.setAttribute("viewBox", "0 0 24 24");
  ikon.setAttribute("aria-hidden", "true");

  const jalur = document.createElementNS("http://www.w3.org/2000/svg", "path");

  jalur.setAttribute("d", "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z");

  const lingkaran = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );

  lingkaran.setAttribute("cx", "12");
  lingkaran.setAttribute("cy", "12");
  lingkaran.setAttribute("r", "3");

  ikon.append(jalur, lingkaran);

  return ikon;
}

/* 14. Mengambil dan memperbarui nama pengguna dari LocalStorage. */

function perbaruiProfilRiwayat() {
  try {
    // Mengambil data profil yang tersimpan.
    const dataProfil = localStorage.getItem(PROFILE_KEY);

    if (!dataProfil) {
      console.log("Data profil belum tersedia.");
      return;
    }

    // Mengubah JSON menjadi objek JavaScript.
    const profil = JSON.parse(dataProfil);

    // Memastikan nama pengguna tersedia.
    if (!profil || typeof profil.name !== "string") {
      return;
    }

    const namaPengguna = profil.name.trim();

    if (!namaPengguna) return;

    // Memperbarui nama pengguna pada bagian header.
    document.querySelectorAll(".header-name").forEach(function (elemen) {
      elemen.textContent = namaPengguna;
    });

    console.log(
      "Nama pengguna pada Riwayat Laporan berhasil diperbarui:",
      namaPengguna,
    );
  } catch (error) {
    console.error("Gagal memperbarui profil Riwayat Laporan:", error);
  }
}
