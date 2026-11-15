// ============================================================
// SIPFAS - DETAIL LAPORAN.JS
// Menampilkan detail laporan dan perkembangan penanganan.
// Sinkronisasi otomatis dengan halaman Petugas.
// ============================================================

// 01. Konfigurasi penyimpanan.
const KUNCI_LAPORAN = "sipfasReports";
const KUNCI_PROFIL = "sipfasProfile";

// Menyimpan data terakhir untuk mendeteksi perubahan.
let dataLaporanTerakhir = null;
let dataProfilTerakhir = null;

// Menjalankan program setelah halaman selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  tampilkanDetailLaporan();
  updateDetailProfile();

  // Menyimpan kondisi data awal.
  dataLaporanTerakhir = localStorage.getItem(KUNCI_LAPORAN);
  dataProfilTerakhir = localStorage.getItem(KUNCI_PROFIL);

  // Memperbarui tampilan jika data berubah dari tab lain.
  window.addEventListener("storage", function (event) {
    if (event.key === KUNCI_LAPORAN || event.key === null) {
      dataLaporanTerakhir = localStorage.getItem(KUNCI_LAPORAN);
      tampilkanDetailLaporan();
    }

    if (event.key === KUNCI_PROFIL || event.key === null) {
      dataProfilTerakhir = localStorage.getItem(KUNCI_PROFIL);
      updateDetailProfile();
    }
  });

  // Memeriksa perubahan data secara otomatis setiap 1 detik.
  // Berguna ketika Petugas dan Pelapor membuka halaman
  // pada tab browser yang berbeda.
  setInterval(function () {
    const laporanSekarang = localStorage.getItem(KUNCI_LAPORAN);
    const profilSekarang = localStorage.getItem(KUNCI_PROFIL);

    // Memperbarui detail apabila data laporan berubah.
    if (laporanSekarang !== dataLaporanTerakhir) {
      dataLaporanTerakhir = laporanSekarang;
      tampilkanDetailLaporan();
    }

    // Memperbarui nama pengguna apabila profil berubah.
    if (profilSekarang !== dataProfilTerakhir) {
      dataProfilTerakhir = profilSekarang;
      updateDetailProfile();
    }
  }, 1000);
});

// 02. Data simulasi untuk laporan awal.
// const dataSimulasi = [
//   {
//     id: "LP-2024-089",
//     facility: "Proyektor Lab Komputer 2",
//     location: "Laboratorium Komputer",
//     date: "24 Okt 2024",
//     dateTime: "24 Oktober 2024, 09:00 WIT",
//     priority: "Tinggi",
//     description:
//       "Proyektor mengalami gangguan tampilan dan gambar terkadang tidak muncul saat digunakan dalam kegiatan perkuliahan.",
//     status: "Menunggu Verifikasi",
//     verificationStatus: "Menunggu",
//     verificationDescription: "Laporan sedang menunggu verifikasi petugas.",
//     handlingStatus: "Menunggu",
//     handlingDescription: "Laporan belum masuk tahap penanganan.",
//   },
//   {
//     id: "LP-2024-085",
//     facility: "Unit AC Split 2 PK",
//     location: "Ruang Kuliah IF-301, Gedung Informatika Lt. 3",
//     date: "22 Okt 2024",
//     dateTime: "22 Oktober 2024, 09:30 WIT",
//     priority: "Tinggi",
//     description:
//       "AC mengeluarkan suara bising mendengung dan hembusan angin tidak dingin sama sekali sejak perkuliahan jam pertama pagi. Suhu ruangan gerah dan mengganggu kenyamanan mahasiswa.",
//     status: "Diproses",
//     verificationStatus: "Valid",
//     verificationDescription: "Diverifikasi oleh Petugas Sarpras.",
//     handlingStatus: "Diproses",
//     handlingDescription: "Teknisi sedang melakukan perbaikan di lokasi.",
//   },
//   {
//     id: "LP-2024-081",
//     facility: "Papan Tulis Whiteboard",
//     location: "Ruang Kuliah",
//     date: "18 Okt 2024",
//     dateTime: "18 Oktober 2024, 10:00 WIT",
//     priority: "Sedang",
//     description:
//       "Permukaan papan tulis mengalami kerusakan sehingga tulisan sulit dibersihkan dan mengganggu kegiatan pembelajaran.",
//     status: "Selesai",
//     verificationStatus: "Valid",
//     verificationDescription: "Laporan telah diverifikasi oleh Petugas Sarpras.",
//     handlingStatus: "Selesai",
//     handlingDescription: "Perbaikan fasilitas telah selesai dilakukan.",
//   },
//   {
//     id: "LP-2024-076",
//     facility: "Stop Kontak Meja 04",
//     location: "Gedung Informatika Lantai 1",
//     date: "15 Okt 2024",
//     dateTime: "15 Oktober 2024, 11:00 WIT",
//     priority: "Rendah",
//     description:
//       "Stop kontak pada meja mengalami gangguan dan tidak dapat digunakan untuk menghubungkan perangkat elektronik.",
//     status: "Selesai",
//     verificationStatus: "Valid",
//     verificationDescription: "Laporan telah diverifikasi oleh Petugas Sarpras.",
//     handlingStatus: "Selesai",
//     handlingDescription:
//       "Stop kontak telah diperbaiki dan dapat digunakan kembali.",
//   },
//   {
//     id: "LP-2024-072",
//     facility: "Kipas Angin Dinding",
//     location: "Ruang Kuliah",
//     date: "12 Okt 2024",
//     dateTime: "12 Oktober 2024, 09:00 WIT",
//     priority: "Rendah",
//     description:
//       "Kipas angin dinding dilaporkan mengalami gangguan putaran dan mengeluarkan suara tidak normal.",
//     status: "Tidak Valid",
//     verificationStatus: "Tidak Valid",
//     verificationDescription: "Laporan tidak memenuhi persyaratan verifikasi.",
//     handlingStatus: "Tidak Diproses",
//     handlingDescription: "Laporan tidak dilanjutkan ke tahap penanganan.",
//   },
//   {
//     id: "LP-2024-070",
//     facility: "Kursi Kuliah Lipat",
//     location: "Gedung Informatika Lantai 2",
//     date: "10 Okt 2024",
//     dateTime: "10 Oktober 2024, 08:30 WIT",
//     priority: "Rendah",
//     description:
//       "Kursi kuliah lipat mengalami kerusakan pada bagian sambungan sehingga kurang nyaman digunakan.",
//     status: "Selesai",
//     verificationStatus: "Valid",
//     verificationDescription: "Laporan telah diverifikasi oleh Petugas Sarpras.",
//     handlingStatus: "Selesai",
//     handlingDescription: "Kursi telah diperbaiki dan dapat digunakan kembali.",
//   },
// ];

// 03. Mengambil ID laporan dari URL.
function ambilIdLaporan() {
  const parameterURL = new URLSearchParams(window.location.search);
  return parameterURL.get("id");
}

// 04. Mengambil seluruh laporan dari LocalStorage.
function ambilSemuaLaporan() {
  const dataTersimpan = localStorage.getItem(KUNCI_LAPORAN);

  if (!dataTersimpan) {
    return [];
  }

  const daftarLaporan = JSON.parse(dataTersimpan);

  if (!Array.isArray(daftarLaporan)) {
    throw new Error("Format data laporan tidak valid.");
  }

  return daftarLaporan;
}

// 05. Mencari laporan berdasarkan ID.
function cariLaporan(idLaporan) {
  try {
    const daftarLaporan = ambilSemuaLaporan();

    const laporanTersimpan = daftarLaporan.find(function (laporan) {
      return String(laporan.id) === String(idLaporan);
    });

    const laporanContoh = dataSimulasi.find(function (laporan) {
      return String(laporan.id) === String(idLaporan);
    });

    // Mengutamakan data terbaru dari LocalStorage.
    if (laporanTersimpan) {
      return {
        ...(laporanContoh || {}),
        ...laporanTersimpan,
      };
    }

    // Menggunakan data simulasi jika tersedia.
    if (laporanContoh) {
      return laporanContoh;
    }

    // Memeriksa data laporan terakhir dari sesi.
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

// 06. Menampilkan pesan jika laporan tidak ditemukan.
function tampilkanPesanError(pesan) {
  const halamanKonten = document.querySelector(".page-content");

  if (!halamanKonten) return;

  let pesanError = document.getElementById("pesan-error-laporan");

  if (!pesanError) {
    pesanError = document.createElement("p");
    pesanError.id = "pesan-error-laporan";

    pesanError.style.padding = "20px";
    pesanError.style.color = "#dc2626";
    pesanError.style.background = "#fff1f0";
    pesanError.style.borderRadius = "8px";

    halamanKonten.appendChild(pesanError);
  }

  pesanError.textContent = pesan;
}

// 07. Mengambil nilai teks dengan beberapa alternatif properti.
function ambilNilai(objek, daftarProperti, nilaiDefault = "-") {
  for (const properti of daftarProperti) {
    const nilai = objek[properti];

    if (nilai !== undefined && nilai !== null && String(nilai).trim() !== "") {
      return nilai;
    }
  }

  return nilaiDefault;
}

// 08. Menormalkan status.
function normalisasiStatus(status) {
  return String(status || "")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

// 09. Memeriksa status valid.
function apakahValid(status) {
  const nilai = normalisasiStatus(status);

  return ["valid", "terverifikasi", "diverifikasi", "disetujui"].includes(
    nilai,
  );
}

// 10. Memeriksa status tidak valid.
function apakahTidakValid(status) {
  const nilai = normalisasiStatus(status);

  return ["tidak valid", "invalid", "ditolak", "tidak disetujui"].includes(
    nilai,
  );
}

// 11. Memeriksa status selesai.
function apakahSelesai(status) {
  const nilai = normalisasiStatus(status);

  return ["selesai", "completed", "berhasil", "ditangani"].includes(nilai);
}

// 12. Memeriksa status sedang diproses.
function apakahDiproses(status) {
  const nilai = normalisasiStatus(status);

  return ["diproses", "sedang diproses", "dalam proses", "processing"].includes(
    nilai,
  );
}

// 13. Memperbarui isi teks HTML.
function ubahTeks(selector, teks) {
  const elemen = document.querySelector(selector);

  if (elemen) {
    elemen.textContent = teks;
  }
}

// 14. Memperbarui informasi detail laporan.
function isiInformasiLaporan(laporan, idLaporan) {
  const judulLaporan = document.querySelector(".page-heading h1");

  const daftarField = document.querySelectorAll(".report-grid .report-field");

  const deskripsi = document.querySelector(".description-box");

  const namaFasilitas = ambilNilai(laporan, ["facility", "namaFasilitas"]);

  const lokasiFasilitas = ambilNilai(laporan, ["location", "lokasiFasilitas"]);

  const tanggalLaporan = ambilNilai(laporan, [
    "dateTime",
    "date",
    "tanggalLaporan",
  ]);

  const prioritas = ambilNilai(
    laporan,
    ["priority", "prioritas"],
    "Belum Ditentukan",
  );

  const deskripsiKerusakan = ambilNilai(laporan, ["description", "deskripsi"]);

  if (judulLaporan) {
    judulLaporan.textContent = "Detail Laporan #" + idLaporan;
  }

  if (daftarField.length >= 4) {
    const nilaiFasilitas = daftarField[0].querySelector("strong");
    const nilaiLokasi = daftarField[1].querySelector("strong");
    const nilaiTanggal = daftarField[2].querySelector("strong");
    const badgePrioritas = daftarField[3].querySelector(".priority-badge");

    if (nilaiFasilitas) {
      nilaiFasilitas.textContent = namaFasilitas;
    }

    if (nilaiLokasi) {
      nilaiLokasi.textContent = lokasiFasilitas;
    }

    if (nilaiTanggal) {
      nilaiTanggal.textContent = tanggalLaporan;
    }

    if (badgePrioritas) {
      badgePrioritas.textContent = String(prioritas).replace(
        /^Prioritas\s+/i,
        "",
      );

      badgePrioritas.className = "priority-badge";

      const prioritasNormal = normalisasiStatus(prioritas);

      if (prioritasNormal.includes("tinggi")) {
        badgePrioritas.style.background = "#fff0ef";
        badgePrioritas.style.color = "#dc2626";
      } else if (prioritasNormal.includes("sedang")) {
        badgePrioritas.style.background = "#fff5df";
        badgePrioritas.style.color = "#a56a08";
      } else {
        badgePrioritas.style.background = "#e7f2ff";
        badgePrioritas.style.color = "#2864ed";
      }
    }
  }

  if (deskripsi) {
    deskripsi.textContent = deskripsiKerusakan;
  }
}

// 15. Mengubah tampilan status utama.
function tampilkanStatusUtama(status) {
  const elemenStatus = document.querySelector(".main-status");

  if (!elemenStatus) return;

  const teksStatus = elemenStatus.querySelector("span:last-child");

  if (teksStatus) {
    teksStatus.textContent = status;
  }

  elemenStatus.classList.remove("status-selesai", "status-invalid");

  const statusNormal = normalisasiStatus(status);

  if (statusNormal.includes("selesai") || statusNormal === "completed") {
    elemenStatus.classList.add("status-selesai");
  } else if (
    statusNormal.includes("tidak valid") ||
    statusNormal.includes("ditolak") ||
    statusNormal === "invalid"
  ) {
    elemenStatus.classList.add("status-invalid");
  }
}

// 16. Mengubah kondisi setiap tahapan timeline.
function aturTahap(id, kondisi, badge, deskripsi, tanggal) {
  const elemen = document.getElementById(id);

  if (!elemen) return;

  // Menghapus kondisi sebelumnya.
  elemen.classList.remove(
    "completed",
    "current",
    "pending",
    "rejected",
    "skipped",
  );

  // Memberikan kondisi terbaru.
  elemen.classList.add(kondisi);

  const teksBadge = elemen.querySelector(".timeline-badge");

  if (teksBadge) {
    teksBadge.textContent = badge;
  }

  const teksDeskripsi = elemen.querySelector(".timeline-content p");

  if (teksDeskripsi) {
    teksDeskripsi.textContent = deskripsi;
  }

  const teksTanggal = elemen.querySelector(".timeline-date");

  if (teksTanggal) {
    teksTanggal.textContent = tanggal || "";
    teksTanggal.style.display = tanggal ? "inline-block" : "none";
  }
}

// 17. Mengatur progress laporan.
function aturProgress(persentase, keterangan) {
  const angkaProgress = document.getElementById("progress-percentage");

  const garisProgress = document.getElementById("progress-fill");

  const keteranganProgress = document.getElementById("progress-caption");

  if (angkaProgress) {
    angkaProgress.textContent = persentase + "%";
  }

  if (garisProgress) {
    garisProgress.style.width = persentase + "%";

    if (persentase === 100) {
      garisProgress.style.background = "#16a36a";
    } else if (keterangan.toLowerCase().includes("tidak valid")) {
      garisProgress.style.background = "#dc4545";
    } else {
      garisProgress.style.background =
        "linear-gradient(90deg, #2864ed, #5a91ff)";
    }
  }

  if (keteranganProgress) {
    keteranganProgress.textContent = keterangan;
  }
}

// 18. Menampilkan catatan perkembangan.
function aturCatatan(teks, jenis = "") {
  const catatan = document.getElementById("tracking-note");

  if (!catatan) return;

  const paragraf = catatan.querySelector("p");

  if (paragraf) {
    paragraf.textContent = teks;
  }

  catatan.classList.remove("note-invalid", "note-completed");

  if (jenis) {
    catatan.classList.add(jenis);
  }
}

// 19. Mengatur seluruh timeline berdasarkan data laporan.
function tampilkanTimeline(laporan, statusUtama) {
  const statusVerifikasi = ambilNilai(
    laporan,
    ["verificationStatus", "statusVerifikasi"],
    "Menunggu",
  );

  const statusPenanganan = ambilNilai(
    laporan,
    ["handlingStatus", "statusPenanganan"],
    "Menunggu",
  );

  const deskripsiVerifikasi = ambilNilai(
    laporan,
    ["verificationDescription", "deskripsiVerifikasi"],
    "Laporan sedang menunggu verifikasi petugas.",
  );

  const deskripsiPenanganan = ambilNilai(
    laporan,
    ["handlingDescription", "deskripsiPenanganan"],
    "Laporan belum masuk tahap penanganan.",
  );

  const tanggalKirim = ambilNilai(
    laporan,
    ["dateTime", "date", "tanggalLaporan"],
    "",
  );

  const tanggalVerifikasi = ambilNilai(
    laporan,
    ["verificationDate", "tanggalVerifikasi", "verificationDateTime"],
    "",
  );

  const tanggalPenanganan = ambilNilai(
    laporan,
    ["handlingDate", "tanggalPenanganan", "handlingDateTime"],
    "",
  );

  const tanggalSelesai = ambilNilai(
    laporan,
    ["completedDate", "tanggalSelesai", "completionDate"],
    "",
  );

  // Memeriksa status dari seluruh sumber data.
  const verifikasiTidakValid =
    apakahTidakValid(statusVerifikasi) || apakahTidakValid(statusUtama);

  const verifikasiValid =
    apakahValid(statusVerifikasi) ||
    apakahValid(statusUtama) ||
    apakahDiproses(statusPenanganan) ||
    apakahSelesai(statusPenanganan) ||
    apakahDiproses(statusUtama) ||
    apakahSelesai(statusUtama);

  const penangananSelesai =
    apakahSelesai(statusPenanganan) || apakahSelesai(statusUtama);

  const penangananBerjalan =
    apakahDiproses(statusPenanganan) || apakahDiproses(statusUtama);

  // TAHAP 1: LAPORAN DIKIRIM.
  aturTahap(
    "step-submitted",
    "completed",
    "Selesai",
    "Laporan berhasil diterima oleh sistem SIPFAS.",
    tanggalKirim,
  );

  // KONDISI 1: LAPORAN TIDAK VALID.
  if (verifikasiTidakValid) {
    aturTahap(
      "step-verification",
      "rejected",
      "Tidak Valid",
      deskripsiVerifikasi,
      tanggalVerifikasi,
    );

    aturTahap(
      "step-handling",
      "skipped",
      "Tidak Dilanjutkan",
      "Laporan tidak dilanjutkan ke tahap penanganan.",
      "",
    );

    aturTahap(
      "step-completed",
      "skipped",
      "Tidak Berlaku",
      "Laporan tidak dapat diselesaikan karena tidak lolos verifikasi.",
      "",
    );

    aturProgress(
      50,
      "Laporan tidak valid dan tidak dilanjutkan ke tahap penanganan.",
    );

    aturCatatan(
      "Laporan tidak dapat diproses karena tidak memenuhi persyaratan verifikasi petugas.",
      "note-invalid",
    );

    tampilkanStatusUtama("Tidak Valid");

    return;
  }

  // TAHAP 2: VERIFIKASI.
  if (verifikasiValid) {
    aturTahap(
      "step-verification",
      "completed",
      "Terverifikasi",
      deskripsiVerifikasi,
      tanggalVerifikasi,
    );
  } else {
    aturTahap(
      "step-verification",
      "current",
      "Menunggu",
      deskripsiVerifikasi,
      tanggalVerifikasi,
    );

    aturTahap(
      "step-handling",
      "pending",
      "Belum Dimulai",
      "Laporan akan masuk ke tahap penanganan setelah diverifikasi.",
      "",
    );

    aturTahap(
      "step-completed",
      "pending",
      "Belum Selesai",
      "Laporan akan dinyatakan selesai setelah penanganan fasilitas selesai dilakukan.",
      "",
    );

    aturProgress(
      25,
      "Laporan telah diterima dan sedang menunggu verifikasi petugas.",
    );

    aturCatatan(
      "Laporan Anda telah masuk ke sistem. Silakan menunggu proses pemeriksaan oleh petugas.",
    );

    tampilkanStatusUtama("Menunggu Verifikasi");

    return;
  }

  // KONDISI 2: PENANGANAN SELESAI.
  if (penangananSelesai) {
    aturTahap(
      "step-handling",
      "completed",
      "Selesai",
      deskripsiPenanganan,
      tanggalPenanganan,
    );

    aturTahap(
      "step-completed",
      "completed",
      "Selesai",
      "Penanganan fasilitas telah selesai dilakukan.",
      tanggalSelesai,
    );

    aturProgress(100, "Seluruh tahapan laporan telah selesai dilakukan.");

    aturCatatan(
      "Laporan telah selesai ditangani. Terima kasih telah menggunakan layanan SIPFAS.",
      "note-completed",
    );

    tampilkanStatusUtama("Selesai");

    return;
  }

  // KONDISI 3: PENANGANAN SEDANG BERJALAN.
  if (penangananBerjalan) {
    aturTahap(
      "step-handling",
      "current",
      "Diproses",
      deskripsiPenanganan,
      tanggalPenanganan,
    );

    aturTahap(
      "step-completed",
      "pending",
      "Belum Selesai",
      "Menunggu penyelesaian proses penanganan fasilitas.",
      "",
    );

    aturProgress(
      75,
      "Laporan telah diverifikasi dan sedang dalam tahap penanganan.",
    );

    aturCatatan(
      "Laporan telah diverifikasi dan saat ini sedang ditangani oleh petugas.",
    );

    tampilkanStatusUtama("Diproses");

    return;
  }

  // KONDISI 4: SUDAH VALID, MENUNGGU PENANGANAN.
  aturTahap(
    "step-handling",
    "current",
    "Menunggu",
    deskripsiPenanganan,
    tanggalPenanganan,
  );

  aturTahap(
    "step-completed",
    "pending",
    "Belum Selesai",
    "Laporan akan dinyatakan selesai setelah penanganan fasilitas selesai dilakukan.",
    "",
  );

  aturProgress(50, "Laporan telah diverifikasi dan menunggu tahap penanganan.");

  aturCatatan(
    "Laporan telah lolos verifikasi. Tahap selanjutnya adalah penanganan fasilitas oleh petugas.",
  );

  tampilkanStatusUtama("Menunggu Penanganan");
}

// 20. Menampilkan seluruh detail laporan.
function tampilkanDetailLaporan() {
  const idLaporan = ambilIdLaporan();

  if (!idLaporan) {
    tampilkanPesanError(
      "Kode laporan tidak ditemukan. Silakan pilih laporan dari Riwayat Laporan.",
    );
    return;
  }

  const laporan = cariLaporan(idLaporan);

  if (!laporan) {
    tampilkanPesanError(
      "Data laporan dengan kode " + idLaporan + " tidak ditemukan.",
    );
    return;
  }

  // Menghapus pesan error jika data sudah ditemukan.
  const pesanError = document.getElementById("pesan-error-laporan");

  if (pesanError) {
    pesanError.remove();
  }

  // Mengisi informasi utama.
  isiInformasiLaporan(laporan, idLaporan);

  // Mengambil status utama.
  const statusUtama = ambilNilai(
    laporan,
    ["mainStatus", "status"],
    "Menunggu Verifikasi",
  );

  // Menampilkan timeline sesuai kondisi laporan.
  tampilkanTimeline(laporan, statusUtama);

  // Informasi untuk pemeriksaan melalui Console.
  console.log("===== DETAIL LAPORAN SIPFAS =====");
  console.log("ID Laporan:", idLaporan);
  console.log("Fasilitas:", laporan.facility || laporan.namaFasilitas);
  console.log("Lokasi:", laporan.location || laporan.lokasiFasilitas);
  console.log("Status Utama:", statusUtama);
  console.log("Status Verifikasi:", laporan.verificationStatus);
  console.log("Status Penanganan:", laporan.handlingStatus);
  console.log("=================================");
}

// 21. Memperbarui nama pengguna pada header.
function updateDetailProfile() {
  try {
    const savedProfile = localStorage.getItem(KUNCI_PROFIL);

    if (!savedProfile) return;

    const profile = JSON.parse(savedProfile);

    const userName = String(
      profile.name || profile.fullName || profile.nama || "",
    ).trim();

    const headerName = document.querySelector(".header-name");

    if (headerName && userName) {
      headerName.textContent = userName;
    }
  } catch (error) {
    console.error("Gagal mengambil profil:", error);
  }
}
