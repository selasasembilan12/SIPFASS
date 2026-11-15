"use strict";

/* =====================================================
   SIPFAS - JAVASCRIPT KONFIRMASI LAPORAN
   Fungsi: Mengambil dan menampilkan data laporan
===================================================== */

/* 01. MENENTUKAN NAMA PENYIMPANAN LAPORAN */

// Key untuk mengambil seluruh laporan dari LocalStorage.
const REPORT_STORAGE_KEY = "sipfasReports";

// Key untuk mengambil laporan terakhir dari SessionStorage.
const LAST_REPORT_KEY = "laporanTerakhir";

// Key untuk mengambil notifikasi sementara.
const FLASH_NOTIFICATION_KEY = "sipfasFlashNotification";

/* 02. MENJALANKAN PROGRAM SETELAH HTML DIMUAT */

document.addEventListener("DOMContentLoaded", function () {
  tampilkanKonfirmasiLaporan();
  tampilkanNotifikasiKonfirmasi();
});

/* 03. MENGAMBIL DATA LAPORAN TERAKHIR */

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

        // Menggunakan data sesi sebagai pengaman.
        return laporanSesi;
      }
    }

    // Jika data sesi tidak tersedia, ambil laporan terbaru.
    if (semuaLaporan.length > 0) {
      return semuaLaporan[0];
    }

    // Jika belum ada laporan.
    return null;
  } catch (error) {
    console.error("Gagal mengambil data laporan:", error);

    return null;
  }
}

/* 04. MENAMPILKAN INFORMASI LAPORAN PADA HALAMAN KONFIRMASI */

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

  /* 05. MENAMPILKAN KODE LAPORAN */

  const elemenKode = document.querySelector(".report-code");

  if (elemenKode) {
    elemenKode.textContent = kodeLaporan;
  }

  /* 06. MENAMPILKAN NAMA DAN LOKASI FASILITAS */

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

  /* 07. MENAMPILKAN REKOMENDASI PRIORITAS */

  const elemenPrioritas = document.querySelector(".priority-badge");

  if (elemenPrioritas) {
    elemenPrioritas.textContent = prioritas;
  }

  /* 08. MENAMPILKAN STATUS LAPORAN */

  const elemenStatus = document.querySelector(".status-badge");

  if (elemenStatus) {
    elemenStatus.textContent = status;
  }

  /* 09. MENGHUBUNGKAN TOMBOL LIHAT DETAIL */

  const tombolDetail = document.querySelector(".detail-button");

  if (tombolDetail) {
    tombolDetail.href =
      "../Detail-laporan/Detail-laporan.html?id=" +
      encodeURIComponent(kodeLaporan);
  }

  /* 10. MENAMPILKAN INFORMASI PROSES PADA CONSOLE */

  console.log("===== KONFIRMASI LAPORAN SIPFAS =====");
  console.log("Kode Laporan:", kodeLaporan);
  console.log("Nama Fasilitas:", namaFasilitas);
  console.log("Lokasi Fasilitas:", lokasiFasilitas);
  console.log("Prioritas:", prioritas);
  console.log("Status:", status);
  console.log("=====================================");
}

/* =====================================================
   11. MENAMPILKAN NOTIFIKASI KEBERHASILAN PENGIRIMAN
   Notifikasi diteruskan dari halaman Buat Laporan.
===================================================== */

function tampilkanNotifikasiKonfirmasi() {
  // Mengambil data notifikasi dari SessionStorage.
  const dataNotifikasi = sessionStorage.getItem(FLASH_NOTIFICATION_KEY);

  // Jika tidak ada notifikasi, hentikan proses.
  if (!dataNotifikasi) {
    return;
  }

  try {
    // Mengubah data JSON menjadi objek.
    const notifikasi = JSON.parse(dataNotifikasi);

    // Memastikan data notifikasi valid.
    if (
      !notifikasi ||
      typeof notifikasi !== "object" ||
      !notifikasi.title ||
      !notifikasi.message
    ) {
      throw new Error("Format notifikasi tidak valid.");
    }

    // Mengambil atau membuat elemen notifikasi.
    let elemenNotifikasi = document.getElementById("sipfasNotification");

    if (!elemenNotifikasi) {
      elemenNotifikasi = document.createElement("div");

      elemenNotifikasi.id = "sipfasNotification";

      document.body.appendChild(elemenNotifikasi);
    }

    // Mengatur jenis notifikasi.
    const jenis = ["success", "warning", "error"].includes(notifikasi.type)
      ? notifikasi.type
      : "success";

    elemenNotifikasi.className = "sipfas-notification " + jenis;

    elemenNotifikasi.setAttribute("role", "alert");
    elemenNotifikasi.setAttribute("aria-live", "polite");

    // Mengosongkan isi notifikasi sebelumnya.
    elemenNotifikasi.replaceChildren();

    // Membuat ikon notifikasi.
    const ikon = document.createElement("span");

    ikon.className = "notification-icon";

    ikon.textContent =
      jenis === "success" ? "✓" : jenis === "error" ? "×" : "!";

    // Membuat wadah konten.
    const konten = document.createElement("div");

    konten.className = "notification-content";

    // Membuat judul notifikasi.
    const judul = document.createElement("strong");

    judul.className = "notification-title";
    judul.textContent = notifikasi.title;

    // Membuat pesan notifikasi.
    const pesan = document.createElement("span");

    pesan.className = "notification-message";
    pesan.textContent = notifikasi.message;

    // Menggabungkan konten.
    konten.appendChild(judul);
    konten.appendChild(pesan);

    // Membuat tombol tutup.
    const tombolTutup = document.createElement("button");

    tombolTutup.type = "button";
    tombolTutup.className = "notification-close";
    tombolTutup.textContent = "×";

    tombolTutup.setAttribute("aria-label", "Tutup notifikasi");

    // Menangani tombol tutup.
    tombolTutup.addEventListener("click", function () {
      elemenNotifikasi.classList.remove("show");
    });

    // Memasukkan seluruh elemen ke notifikasi.
    elemenNotifikasi.appendChild(ikon);
    elemenNotifikasi.appendChild(konten);
    elemenNotifikasi.appendChild(tombolTutup);

    // Menghapus data notifikasi setelah berhasil dibaca.
    sessionStorage.removeItem(FLASH_NOTIFICATION_KEY);

    // Menampilkan notifikasi setelah elemen siap.
    requestAnimationFrame(function () {
      elemenNotifikasi.classList.add("show");
    });

    // Menghilangkan notifikasi otomatis setelah 4 detik.
    setTimeout(function () {
      elemenNotifikasi.classList.remove("show");
    }, 4000);

    console.log("[SIPFAS] Notifikasi pengiriman laporan berhasil ditampilkan.");
  } catch (error) {
    console.error("Gagal menampilkan notifikasi konfirmasi:", error);

    sessionStorage.removeItem(FLASH_NOTIFICATION_KEY);
  }
}
