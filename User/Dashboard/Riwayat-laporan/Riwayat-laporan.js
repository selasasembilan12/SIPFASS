// 01. Konfigurasi API.
const API_DAFTAR_LAPORAN = "../../../api/user/daftar-laporan.php";
const KUNCI_PROFIL = "sipfasProfile";

// Menyimpan seluruh laporan dari database.
let seluruhLaporan = [];

// Mencegah permintaan API berjalan bersamaan.
let sedangMemuatLaporan = false;

// ============================================================
// 02. MENJALANKAN PROGRAM SETELAH HALAMAN SELESAI DIMUAT.
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  mulaiRiwayatLaporan();
});

// ============================================================
// 03. INISIALISASI HALAMAN LAPORAN SAYA.
// ============================================================

function mulaiRiwayatLaporan() {
  const pencarian = document.querySelector(".search-box input");
  const filter = document.querySelector(".filter-box select");
  const tombolRefresh = document.querySelector(".refresh-button");

  // Memperbarui profil pengguna.
  updateProfilRiwayat();

  // Mengambil data pertama kali.
  muatRiwayatLaporan();

  // Pencarian laporan.
  if (pencarian) {
    pencarian.addEventListener("input", function () {
      tampilkanRiwayatLaporan();
    });
  }

  // Filter status laporan.
  if (filter) {
    filter.addEventListener("change", function () {
      tampilkanRiwayatLaporan();
    });
  }

  // Tombol refresh mengambil data terbaru.
  if (tombolRefresh) {
    tombolRefresh.addEventListener("click", function (event) {
      event.preventDefault();
      muatRiwayatLaporan();
    });
  }

  // Memperbarui data saat kembali ke halaman.
  window.addEventListener("pageshow", function () {
    muatRiwayatLaporan();
  });

  // Memperbarui profil jika berubah dari tab lain.
  window.addEventListener("storage", function (event) {
    if (event.key === KUNCI_PROFIL || event.key === null) {
      updateProfilRiwayat();
    }
  });

  // Memperbarui laporan secara otomatis setiap 30 detik.
  setInterval(function () {
    muatRiwayatLaporan();
  }, 30000);
}

// ============================================================
// 04. MENGAMBIL DATA LAPORAN DARI DATABASE.
// ============================================================

async function muatRiwayatLaporan() {
  if (sedangMemuatLaporan) return;

  sedangMemuatLaporan = true;

  try {
    const response = await fetch(API_DAFTAR_LAPORAN + "?_=" + Date.now(), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok || result.success !== true) {
      throw new Error(
        result.message || "Gagal mengambil laporan dari database.",
      );
    }

    if (!result.data || !Array.isArray(result.data.laporan)) {
      throw new Error("Format data laporan dari server tidak sesuai.");
    }

    // Menyimpan laporan dari database.
    seluruhLaporan = result.data.laporan;

    // Menampilkan laporan.
    tampilkanRiwayatLaporan();

    console.log("===== SIPFAS LAPORAN SAYA =====");
    console.log("Jumlah laporan:", seluruhLaporan.length);
    console.log("Data laporan:", seluruhLaporan);
    console.log("================================");
  } catch (error) {
    console.error("[SIPFAS RIWAYAT]", error);

    // Tidak menghapus data lama jika pengambilan gagal.
    tampilkanPesanTabel(error.message || "Gagal memuat laporan dari database.");
  } finally {
    sedangMemuatLaporan = false;
  }
}

// ============================================================
// 05. MENAMPILKAN SELURUH LAPORAN.
// ============================================================

function tampilkanRiwayatLaporan() {
  const tbody = document.querySelector(".report-table tbody");

  if (!tbody) {
    console.error("[SIPFAS] Tabel laporan tidak ditemukan.");
    return;
  }

  const pencarian = document.querySelector(".search-box input");
  const filter = document.querySelector(".filter-box select");

  const kataKunci = pencarian ? pencarian.value.trim().toLowerCase() : "";

  const statusDipilih = filter
    ? filter.value.trim().toLowerCase()
    : "semua status";

  // Melakukan pencarian dan filter.
  const hasil = seluruhLaporan.filter(function (laporan) {
    const status = statusUtamaRiwayat(laporan);

    const teksPencarian = [
      laporan.kode_laporan,
      laporan.nama_fasilitas,
      laporan.nama_lokasi,
      laporan.deskripsi_kerusakan,
      laporan.prioritas_awal,
      laporan.prioritas_prediksi,
    ]
      .join(" ")
      .toLowerCase();

    const cocokPencarian = teksPencarian.includes(kataKunci);

    // Filter Semua Status.
    const cocokStatus =
      statusDipilih === "" ||
      statusDipilih === "semua" ||
      statusDipilih === "semua status" ||
      status.toLowerCase() === statusDipilih;

    return cocokPencarian && cocokStatus;
  });

  tbody.replaceChildren();

  // Jika tidak ada hasil.
  if (hasil.length === 0) {
    const pesan =
      seluruhLaporan.length === 0
        ? "Belum ada laporan yang dikirim."
        : "Tidak ditemukan laporan yang sesuai.";

    tampilkanPesanTabel(pesan);
    return;
  }

  // Membuat baris tabel.
  hasil.forEach(function (laporan) {
    const row = document.createElement("tr");

    // Kolom kode laporan.
    const kodeCell = document.createElement("td");
    kodeCell.className = "report-code";
    kodeCell.textContent = laporan.kode_laporan || "-";

    // Kolom tanggal.
    const tanggalCell = document.createElement("td");
    tanggalCell.className = "report-date";
    tanggalCell.textContent = formatTanggalRiwayat(laporan.tanggal_dibuat);

    // Kolom fasilitas.
    const fasilitasCell = document.createElement("td");
    fasilitasCell.className = "facility-name";
    fasilitasCell.textContent = laporan.nama_fasilitas || "-";

    // Kolom prioritas.
    const prioritasCell = document.createElement("td");

    prioritasCell.appendChild(
      buatBadgePrioritasRiwayat(
        laporan.prioritas_prediksi || laporan.prioritas_awal,
      ),
    );

    // Kolom status.
    const statusCell = document.createElement("td");

    statusCell.appendChild(buatBadgeStatusRiwayat(statusUtamaRiwayat(laporan)));

    // Kolom aksi.
    const aksiCell = document.createElement("td");

    const tombolDetail = document.createElement("a");

    tombolDetail.className = "detail-button";
    tombolDetail.textContent = "Detail";

    // Mengirim ID laporan database melalui URL.
    tombolDetail.href =
      "../Detail-laporan/Detail-laporan.html?id=" +
      encodeURIComponent(laporan.id_laporan);

    aksiCell.appendChild(tombolDetail);

    // Memasukkan seluruh kolom.
    row.append(
      kodeCell,
      tanggalCell,
      fasilitasCell,
      prioritasCell,
      statusCell,
      aksiCell,
    );

    tbody.appendChild(row);
  });

  console.log("[SIPFAS] Laporan ditampilkan:", hasil.length);
}

// ============================================================
// 06. MENENTUKAN STATUS UTAMA LAPORAN.
// ============================================================

function statusUtamaRiwayat(laporan) {
  const verifikasi = normalisasiStatusRiwayat(laporan.status_verifikasi);

  const penanganan = normalisasiStatusRiwayat(laporan.status_penanganan);

  // Laporan ditolak atau tidak valid.
  if (
    verifikasi.includes("tolak") ||
    verifikasi.includes("tidak valid") ||
    verifikasi.includes("invalid")
  ) {
    return "Tidak Valid";
  }

  // Penanganan selesai.
  if (penanganan.includes("selesai")) {
    return "Selesai";
  }

  // Penanganan atau verifikasi berjalan.
  if (
    penanganan.includes("proses") ||
    penanganan.includes("ditangani") ||
    verifikasi.includes("proses") ||
    verifikasi.includes("diverifikasi") ||
    verifikasi.includes("diterima") ||
    verifikasi === "valid"
  ) {
    return "Diproses";
  }

  // Kondisi awal.
  return "Menunggu Verifikasi";
}

// ============================================================
// 07. NORMALISASI STATUS.
// ============================================================

function normalisasiStatusRiwayat(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

// ============================================================
// 08. MEMBUAT BADGE PRIORITAS.
// ============================================================

function buatBadgePrioritasRiwayat(nilai) {
  const badge = document.createElement("span");

  const prioritas = normalisasiStatusRiwayat(nilai);

  badge.className = "priority-badge";

  if (prioritas.includes("tinggi")) {
    badge.classList.add("priority-high");
    badge.textContent = "Tinggi";
  } else if (prioritas.includes("sedang")) {
    badge.classList.add("priority-medium");
    badge.textContent = "Sedang";
  } else if (prioritas.includes("rendah")) {
    badge.classList.add("priority-low");
    badge.textContent = "Rendah";
  } else {
    badge.textContent = "Belum Ditentukan";
  }

  return badge;
}

// ============================================================
// 09. MEMBUAT BADGE STATUS.
// ============================================================

function buatBadgeStatusRiwayat(status) {
  const badge = document.createElement("span");

  badge.className = "status-badge";

  if (status === "Selesai") {
    badge.classList.add("status-completed");
  } else if (status === "Diproses") {
    badge.classList.add("status-processing");

    const dot = document.createElement("span");
    dot.className = "status-dot";

    badge.appendChild(dot);
  } else if (status === "Tidak Valid") {
    badge.classList.add("status-invalid");

    const icon = document.createElement("span");
    icon.className = "invalid-icon";
    icon.textContent = "⊗";

    badge.appendChild(icon);
  } else {
    badge.classList.add("status-waiting");

    const dot = document.createElement("span");
    dot.className = "status-dot";

    badge.appendChild(dot);
  }

  badge.appendChild(document.createTextNode(status));

  return badge;
}

// ============================================================
// 10. FORMAT TANGGAL LAPORAN.
// ============================================================

function formatTanggalRiwayat(value) {
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

// ============================================================
// 11. MENAMPILKAN PESAN PADA TABEL.
// ============================================================

function tampilkanPesanTabel(pesan) {
  const tbody = document.querySelector(".report-table tbody");

  if (!tbody) return;

  tbody.replaceChildren();

  const row = document.createElement("tr");
  const cell = document.createElement("td");

  cell.colSpan = 6;
  cell.textContent = pesan;
  cell.style.textAlign = "center";
  cell.style.padding = "25px";

  row.appendChild(cell);
  tbody.appendChild(row);
}

// ============================================================
// 12. SINKRONISASI PROFIL PENGGUNA.
// ============================================================

function updateProfilRiwayat() {
  try {
    const dataProfil = localStorage.getItem(KUNCI_PROFIL);

    if (!dataProfil) return;

    const profil = JSON.parse(dataProfil);

    const nama = String(
      profil.name || profil.fullName || profil.nama || "",
    ).trim();

    if (nama) {
      document.querySelectorAll(".header-name").forEach(function (element) {
        element.textContent = nama;
      });
    }
  } catch (error) {
    console.error("[SIPFAS] Gagal memperbarui profil:", error);
  }
}
