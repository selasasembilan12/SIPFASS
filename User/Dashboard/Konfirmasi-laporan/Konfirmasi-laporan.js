/* =====================================================
   SIPFAS - JAVASCRIPT KONFIRMASI LAPORAN
   Fungsi: Mengambil dan menampilkan data laporan
===================================================== */

/* 01. Menentukan nama penyimpanan laporan. */

// Key untuk mengambil seluruh laporan dari LocalStorage.
const REPORT_STORAGE_KEY = "sipfasReports";

// Key untuk mengambil laporan terakhir dari SessionStorage.
const LAST_REPORT_KEY = "laporanTerakhir";

/* 02. Menjalankan program setelah HTML selesai dimuat. */

document.addEventListener("DOMContentLoaded", function () {
  tampilkanKonfirmasiLaporan();
});

/* 03. Mengambil data laporan yang terakhir dikirim. */

function ambilLaporanTerakhir() {
  try {
    // Mengambil data laporan sementara dari SessionStorage.
    const dataSesi = sessionStorage.getItem(LAST_REPORT_KEY);

    // Mengambil seluruh data laporan dari LocalStorage.
    const dataPenyimpanan = localStorage.getItem(REPORT_STORAGE_KEY);

    // Mengubah data JSON menjadi array JavaScript.
    const semuaLaporan = dataPenyimpanan ? JSON.parse(dataPenyimpanan) : [];

    // Memastikan data laporan berbentuk array.
    if (!Array.isArray(semuaLaporan)) {
      throw new Error("Format data laporan tidak valid.");
    }

    // Mengambil laporan terakhir dari SessionStorage.
    if (dataSesi) {
      const laporanSesi = JSON.parse(dataSesi);

      // Memastikan data sesi berbentuk objek.
      if (
        laporanSesi &&
        typeof laporanSesi === "object" &&
        !Array.isArray(laporanSesi)
      ) {
        // Memastikan laporan juga tersimpan di LocalStorage.
        const laporanTersimpan = semuaLaporan.find(function (laporan) {
          return laporan.id === laporanSesi.id;
        });

        // Menggunakan data LocalStorage sebagai sumber utama.
        if (laporanTersimpan) {
          return laporanTersimpan;
        }

        // Menggunakan data sesi jika laporan belum ditemukan.
        // Berguna sebagai pengaman saat sinkronisasi penyimpanan.
        return laporanSesi;
      }
    }

    // Jika data sesi tidak tersedia, ambil laporan terbaru.
    if (semuaLaporan.length > 0) {
      return semuaLaporan[0];
    }

    // Jika belum ada laporan sama sekali.
    return null;
  } catch (error) {
    console.error("Gagal mengambil data laporan:", error);

    return null;
  }
}

/* 04. Menampilkan informasi laporan pada halaman konfirmasi. */

function tampilkanKonfirmasiLaporan() {
  // Mengambil laporan yang terakhir dikirim.
  const laporan = ambilLaporanTerakhir();

  // Menghentikan proses jika tidak ada laporan.
  if (!laporan) {
    alert(
      "Data laporan tidak ditemukan. Silakan buat laporan terlebih dahulu.",
    );

    window.location.href = "../Dashboard/dashboard.html";

    return;
  }

  // Memastikan data menggunakan nama properti yang sesuai.
  const kodeLaporan = laporan.id || laporan.kodeLaporan || "-";

  const namaFasilitas = laporan.facility || laporan.namaFasilitas || "-";

  const lokasiFasilitas = laporan.location || laporan.lokasiFasilitas || "-";

  const prioritas = laporan.priority || laporan.prioritas || "Belum ditentukan";

  const status = laporan.status || laporan.mainStatus || "Menunggu Verifikasi";

  /* 05. Menampilkan kode laporan. */

  const elemenKode = document.querySelector(".report-code");

  if (elemenKode) {
    elemenKode.textContent = kodeLaporan;
  }

  /* 06. Menampilkan nama dan lokasi fasilitas. */

  const elemenNamaFasilitas = document.querySelector(
    ".facility-row .information-value strong",
  );

  const elemenLokasiFasilitas = document.querySelector(
    ".facility-row .information-value span",
  );

  if (elemenNamaFasilitas) {
    elemenNamaFasilitas.textContent = namaFasilitas;
  }

  if (elemenLokasiFasilitas) {
    elemenLokasiFasilitas.textContent = "(" + lokasiFasilitas + ")";
  }

  /* 07. Menampilkan rekomendasi prioritas. */

  const elemenPrioritas = document.querySelector(".priority-badge");

  if (elemenPrioritas) {
    elemenPrioritas.textContent = prioritas;
  }

  /* 08. Menampilkan status laporan. */

  const elemenStatus = document.querySelector(".status-badge");

  if (elemenStatus) {
    elemenStatus.textContent = status;
  }

  /* 09. Menghubungkan tombol Lihat Detail dengan laporan terkait. */

  const tombolDetail = document.querySelector(".detail-button");

  if (tombolDetail) {
    tombolDetail.href =
      "../Detail-laporan/Detail-laporan.html?id=" +
      encodeURIComponent(kodeLaporan);
  }

  /* 10. Menampilkan informasi proses pada Console. */

  console.log("===== KONFIRMASI LAPORAN SIPFAS =====");

  console.log("Kode Laporan:", kodeLaporan);

  console.log("Nama Fasilitas:", namaFasilitas);

  console.log("Lokasi Fasilitas:", lokasiFasilitas);

  console.log("Prioritas:", prioritas);

  console.log("Status:", status);

  console.log("=====================================");
}
