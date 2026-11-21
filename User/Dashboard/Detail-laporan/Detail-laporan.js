"use strict";

// 01. KONFIGURASI API DAN PROFIL.

const API_DETAIL_LAPORAN = "../../../api/user/detail.laporan.php";

const KUNCI_PROFIL = "sipfasProfile";

let sedangMemuatDetail = false;
let permintaanTerakhir = 0;

// ============================================================
// 02. INISIALISASI
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  tampilkanDetailLaporan();

  updateDetailProfile();

  window.addEventListener("storage", function (event) {
    if (event.key === KUNCI_PROFIL || event.key === null) {
      updateDetailProfile();
    }
  });

  // Memperbarui data dari database setiap 30 detik.
  setInterval(function () {
    tampilkanDetailLaporan();
  }, 30000);

  // Memperbarui data ketika halaman dibuka kembali.
  window.addEventListener("pageshow", function () {
    tampilkanDetailLaporan();
    updateDetailProfile();
  });
});

// ============================================================
// 03. MENGAMBIL ID ATAU KODE LAPORAN DARI URL
// ============================================================

function ambilIdLaporan() {
  const parameterURL = new URLSearchParams(window.location.search);

  return String(parameterURL.get("id") || "").trim();
}

// ============================================================
// 04. MENGAMBIL DATA DARI DATABASE
// ============================================================

async function cariLaporan(identitasLaporan) {
  if (!identitasLaporan) {
    throw new Error("Identitas laporan tidak ditemukan.");
  }

  const url =
    API_DETAIL_LAPORAN +
    "?id=" +
    encodeURIComponent(identitasLaporan) +
    "&_=" +
    Date.now();

  const response = await fetch(url, {
    method: "GET",

    credentials: "same-origin",

    cache: "no-store",

    headers: {
      Accept: "application/json",
    },
  });

  const rawText = await response.text();

  let result;

  try {
    result = JSON.parse(rawText);
  } catch (error) {
    console.error("[SIPFAS] Respons API bukan JSON:", rawText);

    throw new Error("Respons server tidak valid. Periksa file API PHP.");
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message || "Gagal mengambil detail laporan dari database.",
    );
  }

  const data = result.data;

  if (!data || !data.id_laporan) {
    throw new Error("Data detail laporan tidak ditemukan.");
  }

  return ubahFormatDataDatabase(data);
}

// ============================================================
// 05. MENGUBAH DATA DATABASE MENJADI FORMAT TAMPILAN
// ============================================================

function ubahFormatDataDatabase(data) {
  const statusVerifikasi = data.status_verifikasi || "Menunggu";

  const statusPenanganan = data.status_penanganan || "Menunggu";

  const statusUtama = tentukanStatusDetail(statusVerifikasi, statusPenanganan);

  const tanggalDibuat = data.tanggal_dibuat || "";

  return {
    id: String(data.id_laporan),

    idLaporan: data.id_laporan,

    kodeLaporan: data.kode_laporan || "-",

    facility: data.nama_fasilitas || "-",

    namaFasilitas: data.nama_fasilitas || "-",

    location: data.nama_lokasi || "-",

    lokasiFasilitas: data.nama_lokasi || "-",

    date: formatTanggalDetail(tanggalDibuat),

    dateTime: formatTanggalLengkapDetail(tanggalDibuat),

    tanggalLaporan: tanggalDibuat,

    priority:
      data.prioritas_prediksi || data.prioritas_awal || "Belum Ditentukan",

    prioritas:
      data.prioritas_prediksi || data.prioritas_awal || "Belum Ditentukan",

    description: data.deskripsi_kerusakan || "-",

    deskripsi: data.deskripsi_kerusakan || "-",

    verificationStatus: statusVerifikasi,

    verificationDescription:
      data.catatan_verifikasi || deskripsiStatusVerifikasi(statusVerifikasi),

    verificationDate: data.waktu_verifikasi || "",

    handlingStatus: statusPenanganan,

    handlingDescription: deskripsiStatusPenanganan(statusPenanganan),

    handlingDate: data.tanggal_diperbarui || "",

    completedDate: apakahSelesai(statusPenanganan)
      ? data.tanggal_diperbarui || ""
      : "",

    tingkatKerusakan: data.tingkat_kerusakan_x1,

    dampakAkademik: data.dampak_akademik_x2,

    frekuensiPenggunaan: data.frekuensi_penggunaan_x3,

    catatanVerifikasi: data.catatan_verifikasi || "",

    status: statusUtama,

    mainStatus: statusUtama,
  };
}

// ============================================================
// 06. MENAMPILKAN PESAN ERROR
// ============================================================

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

// ============================================================
// 07. MENGAMBIL NILAI PROPERTI
// ============================================================

function ambilNilai(objek, daftarProperti, nilaiDefault = "-") {
  for (const properti of daftarProperti) {
    const nilai = objek[properti];

    if (nilai !== undefined && nilai !== null && String(nilai).trim() !== "") {
      return nilai;
    }
  }

  return nilaiDefault;
}

// ============================================================
// 08. NORMALISASI STATUS
// ============================================================

function normalisasiStatus(status) {
  return String(status || "")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

// ============================================================
// 09. PEMERIKSAAN STATUS
// ============================================================

function apakahValid(status) {
  const nilai = normalisasiStatus(status);

  return [
    "valid",
    "terverifikasi",
    "diverifikasi",
    "disetujui",
    "diterima",
  ].includes(nilai);
}

function apakahTidakValid(status) {
  const nilai = normalisasiStatus(status);

  return ["tidak valid", "invalid", "ditolak", "tidak disetujui"].includes(
    nilai,
  );
}

function apakahSelesai(status) {
  const nilai = normalisasiStatus(status);

  return ["selesai", "completed", "berhasil", "ditangani"].includes(nilai);
}

function apakahDiproses(status) {
  const nilai = normalisasiStatus(status);

  return [
    "diproses",
    "sedang diproses",
    "dalam proses",
    "processing",
    "ditangani",
  ].includes(nilai);
}

// ============================================================
// 10. MENENTUKAN STATUS UTAMA
// ============================================================

function tentukanStatusDetail(verifikasi, penanganan) {
  const v = normalisasiStatus(verifikasi);

  const p = normalisasiStatus(penanganan);

  if (apakahTidakValid(v) || v.includes("tolak")) {
    return "Tidak Valid";
  }

  if (apakahSelesai(p)) {
    return "Selesai";
  }

  if (apakahDiproses(p) || apakahValid(v)) {
    return "Diproses";
  }

  return "Menunggu Verifikasi";
}

// ============================================================
// 11. DESKRIPSI STATUS VERIFIKASI
// ============================================================

function deskripsiStatusVerifikasi(status) {
  const nilai = normalisasiStatus(status);

  if (apakahTidakValid(nilai) || nilai.includes("tolak")) {
    return "Laporan tidak memenuhi persyaratan verifikasi.";
  }

  if (apakahValid(nilai)) {
    return "Laporan telah diperiksa oleh Petugas Sarpras.";
  }

  return "Laporan sedang menunggu verifikasi petugas.";
}

// ============================================================
// 12. DESKRIPSI STATUS PENANGANAN
// ============================================================

function deskripsiStatusPenanganan(status) {
  const nilai = normalisasiStatus(status);

  if (apakahSelesai(nilai)) {
    return "Penanganan fasilitas telah selesai dilakukan.";
  }

  if (apakahDiproses(nilai)) {
    return "Petugas sedang melakukan perbaikan fasilitas.";
  }

  return "Laporan belum masuk tahap penanganan.";
}

// ============================================================
// 13. FORMAT TANGGAL
// ============================================================

function formatTanggalDetail(value) {
  if (!value) return "-";

  const tanggal = new Date(String(value).replace(" ", "T"));

  if (Number.isNaN(tanggal.getTime())) {
    return String(value);
  }

  return tanggal.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",

    timeZone: "Asia/Makassar",
  });
}

function formatTanggalLengkapDetail(value) {
  if (!value) return "";

  const tanggal = new Date(String(value).replace(" ", "T"));

  if (Number.isNaN(tanggal.getTime())) {
    return String(value);
  }

  const tanggalFormat = tanggal.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });

  const waktuFormat = tanggal.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Makassar",
  });

  return tanggalFormat + ", " + waktuFormat + " WIT";
}

// ============================================================
// 14. MENGISI INFORMASI DETAIL LAPORAN
// ============================================================

function isiInformasiLaporan(laporan, idLaporan) {
  const judulLaporan = document.querySelector(".page-heading h1");

  const daftarField = document.querySelectorAll(".report-grid .report-field");

  const deskripsi = document.querySelector(".description-box");

  if (judulLaporan) {
    judulLaporan.textContent =
      "Detail Laporan #" + (laporan.kodeLaporan || idLaporan);
  }

  if (daftarField.length >= 4) {
    const nilaiFasilitas = daftarField[0].querySelector("strong");

    const nilaiLokasi = daftarField[1].querySelector("strong");

    const nilaiTanggal = daftarField[2].querySelector("strong");

    const badgePrioritas = daftarField[3].querySelector(".priority-badge");

    if (nilaiFasilitas) {
      nilaiFasilitas.textContent = laporan.facility;
    }

    if (nilaiLokasi) {
      nilaiLokasi.textContent = laporan.location;
    }

    if (nilaiTanggal) {
      nilaiTanggal.textContent = laporan.dateTime;
    }

    if (badgePrioritas) {
      const prioritas = String(laporan.priority).replace(/^Prioritas\s+/i, "");

      badgePrioritas.textContent = prioritas;

      badgePrioritas.className = "priority-badge";

      const normal = normalisasiStatus(prioritas);

      if (normal.includes("tinggi")) {
        badgePrioritas.style.background = "#fff0ef";
        badgePrioritas.style.color = "#dc2626";
      } else if (normal.includes("sedang")) {
        badgePrioritas.style.background = "#fff5df";
        badgePrioritas.style.color = "#a56a08";
      } else if (normal.includes("rendah")) {
        badgePrioritas.style.background = "#e7f2ff";
        badgePrioritas.style.color = "#2864ed";
      }
    }
  }

  if (deskripsi) {
    deskripsi.textContent = laporan.description;
  }
}

// ============================================================
// 15. STATUS UTAMA
// ============================================================

function tampilkanStatusUtama(status) {
  const elemenStatus = document.querySelector(".main-status");

  if (!elemenStatus) return;

  const teksStatus = elemenStatus.querySelector("span:last-child");

  if (teksStatus) {
    teksStatus.textContent = status;
  }

  elemenStatus.classList.remove("status-selesai", "status-invalid");

  const normal = normalisasiStatus(status);

  if (normal.includes("selesai")) {
    elemenStatus.classList.add("status-selesai");
  } else if (normal.includes("tidak valid") || normal.includes("ditolak")) {
    elemenStatus.classList.add("status-invalid");
  }
}

// ============================================================
// 16. MENGATUR TAHAPAN TIMELINE
// ============================================================

function aturTahap(id, kondisi, badge, deskripsi, tanggal) {
  const elemen = document.getElementById(id);

  if (!elemen) return;

  elemen.classList.remove(
    "completed",
    "current",
    "pending",
    "rejected",
    "skipped",
  );

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

// ============================================================
// 17. MENGATUR PROGRESS
// ============================================================

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

// ============================================================
// 18. CATATAN PERKEMBANGAN
// ============================================================

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

// ============================================================
// 19. MENAMPILKAN TIMELINE
// ============================================================

function tampilkanTimeline(laporan, statusUtama) {
  const statusVerifikasi = laporan.verificationStatus || "Menunggu";

  const statusPenanganan = laporan.handlingStatus || "Menunggu";

  const deskripsiVerifikasi =
    laporan.verificationDescription ||
    "Laporan sedang menunggu verifikasi petugas.";

  const deskripsiPenanganan =
    laporan.handlingDescription || "Laporan belum masuk tahap penanganan.";

  const tanggalKirim = laporan.dateTime || "";

  const tanggalVerifikasi = laporan.verificationDate
    ? formatTanggalLengkapDetail(laporan.verificationDate)
    : "";

  const tanggalPenanganan = laporan.handlingDate
    ? formatTanggalLengkapDetail(laporan.handlingDate)
    : "";

  const tanggalSelesai = laporan.completedDate
    ? formatTanggalLengkapDetail(laporan.completedDate)
    : "";

  const verifikasiTidakValid =
    apakahTidakValid(statusVerifikasi) || apakahTidakValid(statusUtama);

  const verifikasiValid =
    apakahValid(statusVerifikasi) ||
    apakahValid(statusUtama) ||
    apakahDiproses(statusPenanganan) ||
    apakahSelesai(statusPenanganan);

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

  // KONDISI 1: TIDAK VALID.

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
      laporan.catatanVerifikasi ||
        "Laporan tidak memenuhi persyaratan verifikasi petugas.",
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

  // KONDISI 3: SEDANG DIPROSES.

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

  // KONDISI 4: MENUNGGU PENANGANAN.

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

// ============================================================
// 20. MENAMPILKAN DETAIL LAPORAN
// ============================================================

async function tampilkanDetailLaporan() {
  // Mencegah request yang tumpang tindih.
  if (sedangMemuatDetail) return;

  const identitasLaporan = ambilIdLaporan();

  // Menerima ID angka maupun kode LP-...
  if (!identitasLaporan) {
    tampilkanPesanError(
      "Identitas laporan tidak ditemukan. Silakan pilih laporan dari Laporan Saya.",
    );

    return;
  }

  sedangMemuatDetail = true;

  const nomorPermintaan = ++permintaanTerakhir;

  try {
    const laporan = await cariLaporan(identitasLaporan);

    // Memastikan halaman belum berganti identitas.
    if (nomorPermintaan !== permintaanTerakhir) {
      return;
    }

    const pesanError = document.getElementById("pesan-error-laporan");

    if (pesanError) {
      pesanError.remove();
    }

    // Mengisi informasi utama.
    isiInformasiLaporan(laporan, identitasLaporan);

    // Mengisi perkembangan laporan.
    tampilkanTimeline(laporan, laporan.mainStatus);

    console.log("===== DETAIL LAPORAN SIPFAS =====");

    console.log("ID Database:", laporan.idLaporan);

    console.log("Kode:", laporan.kodeLaporan);

    console.log("Fasilitas:", laporan.facility);

    console.log("Lokasi:", laporan.location);

    console.log("Status:", laporan.mainStatus);

    console.log("Verifikasi:", laporan.verificationStatus);

    console.log("Penanganan:", laporan.handlingStatus);

    console.log("=================================");
  } catch (error) {
    console.error("[SIPFAS DETAIL]", error);

    tampilkanPesanError(
      error.message || "Detail laporan gagal diambil dari database.",
    );
  } finally {
    sedangMemuatDetail = false;
  }
}

// ============================================================
// 21. SINKRONISASI PROFIL PENGGUNA
// ============================================================

function updateDetailProfile() {
  try {
    const savedProfile = localStorage.getItem(KUNCI_PROFIL);

    if (!savedProfile) return;

    const profile = JSON.parse(savedProfile);

    const userName = String(
      profile.name || profile.fullName || profile.nama || "",
    ).trim();

    document.querySelectorAll(".header-name").forEach(function (element) {
      if (userName) {
        element.textContent = userName;
      }
    });
  } catch (error) {
    console.error("[SIPFAS] Gagal mengambil profil:", error);
  }
}
