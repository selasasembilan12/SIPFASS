// 01. Menjalankan program setelah HTML selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  mulaiFormLaporan();
});

// 02. Nama penyimpanan bersama untuk seluruh data laporan.
const KUNCI_PENYIMPANAN_LAPORAN = "sipfasReports";

// 03. Memulai formulir dan mengaktifkan fitur penghitung karakter.
function mulaiFormLaporan() {
  const formulir = document.querySelector(".form-card form");
  const kolomDeskripsi = document.getElementById("deskripsi");
  const tampilanJumlahKarakter = document.querySelector(".character-count");

  // Memeriksa apakah elemen formulir tersedia.
  if (!formulir || !kolomDeskripsi) {
    console.error("Formulir laporan tidak ditemukan.");
    return;
  }

  // Menampilkan jumlah karakter saat halaman pertama dibuka.
  hitungKarakter(kolomDeskripsi, tampilanJumlahKarakter);

  // Memperbarui jumlah karakter setiap kali pengguna mengetik.
  kolomDeskripsi.addEventListener("input", function () {
    hitungKarakter(kolomDeskripsi, tampilanJumlahKarakter);
  });

  // Menjalankan proses pengiriman ketika formulir dikirim.
  formulir.addEventListener("submit", function (event) {
    prosesKirimLaporan(event, formulir);
  });
}

// 04. Menghitung jumlah karakter pada deskripsi kerusakan.
function hitungKarakter(kolom, tampilan) {
  if (!tampilan) return;

  tampilan.textContent = kolom.value.length + " / 300";
}

// 05. Mengambil kode dan nama lokasi serta fasilitas.
function ambilInfoFasilitas(formulir) {
  const pilihanLokasi = formulir.querySelector("#lokasi");
  const pilihanFasilitas = formulir.querySelector("#fasilitas");

  return {
    // Mengambil kode lokasi dari pilihan pengguna.
    kodeLokasi: pilihanLokasi.value,

    // Mengambil nama lokasi yang ditampilkan.
    namaLokasi: pilihanLokasi.options[pilihanLokasi.selectedIndex].text,

    // Mengambil kode fasilitas.
    kodeFasilitas: pilihanFasilitas.value,

    // Mengambil nama fasilitas yang ditampilkan.
    namaFasilitas:
      pilihanFasilitas.options[pilihanFasilitas.selectedIndex].text,
  };
}

// 06. Mengambil tingkat kerusakan dan dampak akademik.
function ambilPenilaianKerusakan(formulir) {
  const tingkat = formulir.querySelector('input[name="tingkat"]:checked');

  const dampak = formulir.querySelector('input[name="dampak"]:checked');

  return {
    tingkatKerusakan: tingkat ? tingkat.value : "",
    dampakAkademik: dampak ? dampak.value : "",
  };
}

// 07. Menghitung prioritas berdasarkan penilaian kerusakan.
function hitungPrioritasLaporan(tingkat, dampak) {
  if (tingkat === "berat") {
    return "Tinggi";
  }

  if (tingkat === "sedang" && dampak === "tinggi") {
    return "Tinggi";
  }

  if (tingkat === "sedang" || dampak === "tinggi") {
    return "Sedang";
  }

  return "Rendah";
}

// 08. Membuat kode laporan secara otomatis.
function buatKodeLaporan() {
  const tahun = new Date().getFullYear();
  const waktu = Date.now();
  const angkaAcak = Math.floor(100 + Math.random() * 900);

  return `LP-${tahun}-${waktu}-${angkaAcak}`;
}

// 09. Mengumpulkan seluruh data dari formulir laporan.
function kumpulkanDataLaporan(formulir) {
  // Mengambil informasi fasilitas.
  const fasilitas = ambilInfoFasilitas(formulir);

  // Mengambil hasil penilaian kerusakan.
  const penilaian = ambilPenilaianKerusakan(formulir);

  // Mengambil deskripsi dan menghapus spasi di awal serta akhir.
  const deskripsi = formulir.querySelector("#deskripsi").value.trim();

  // Menghitung prioritas laporan.
  const prioritas = hitungPrioritasLaporan(
    penilaian.tingkatKerusakan,
    penilaian.dampakAkademik,
  );

  // Mengambil tanggal dan waktu saat laporan dibuat.
  const sekarang = new Date();

  // Membuat tanggal untuk ditampilkan pada tabel riwayat.
  const tanggalTampilan = sekarang.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jayapura",
  });

  // Membuat tanggal dan waktu lengkap untuk halaman detail.
  const tanggalLengkap =
    sekarang.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jayapura",
    }) +
    ", " +
    sekarang.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jayapura",
    }) +
    " WIT";

  // Membuat kode unik untuk laporan.
  const kode = buatKodeLaporan();

  // Menggabungkan semua informasi menjadi satu objek laporan.
  return {
    // IDENTITAS LAPORAN
    id: kode,
    kodeLaporan: kode,

    // INFORMASI FASILITAS
    facility: fasilitas.namaFasilitas,
    namaFasilitas: fasilitas.namaFasilitas,
    facilityCode: fasilitas.kodeFasilitas,

    // INFORMASI LOKASI
    location: fasilitas.namaLokasi,
    lokasiFasilitas: fasilitas.namaLokasi,
    locationCode: fasilitas.kodeLokasi,

    // TANGGAL DAN WAKTU
    date: tanggalTampilan,
    dateTime: tanggalLengkap,
    tanggalLaporan: sekarang.toISOString(),
    createdAt: sekarang.toISOString(),

    // DESKRIPSI KERUSAKAN
    description: deskripsi,
    deskripsi: deskripsi,

    // PENILAIAN KERUSAKAN
    damageLevel: penilaian.tingkatKerusakan,
    tingkatKerusakan: penilaian.tingkatKerusakan,

    academicImpact: penilaian.dampakAkademik,
    dampakAkademik: penilaian.dampakAkademik,

    // PRIORITAS LAPORAN
    priority: prioritas,
    prioritas: "Prioritas " + prioritas,

    // STATUS LAPORAN
    status: "Menunggu Verifikasi",
    mainStatus: "Menunggu Verifikasi",

    // STATUS VERIFIKASI
    verificationStatus: "Menunggu",
    verificationDescription: "Laporan sedang menunggu verifikasi petugas.",

    // STATUS PENANGANAN
    handlingStatus: "Menunggu",
    handlingDescription: "Laporan belum masuk tahap penanganan.",
  };
}

// 10. Menyimpan laporan ke dalam LocalStorage.
function simpanLaporan(dataLaporan) {
  // Mengambil data laporan yang sudah tersimpan.
  const dataTersimpan = localStorage.getItem(KUNCI_PENYIMPANAN_LAPORAN);

  let daftarLaporan = [];

  // Memeriksa apakah sudah ada laporan sebelumnya.
  if (dataTersimpan !== null) {
    try {
      // Mengubah data JSON menjadi array JavaScript.
      daftarLaporan = JSON.parse(dataTersimpan);

      // Memastikan data yang diambil berbentuk array.
      if (!Array.isArray(daftarLaporan)) {
        throw new Error("Format data laporan tidak valid.");
      }
    } catch (error) {
      console.error("Data LocalStorage rusak:", error);

      throw new Error(
        "Data laporan sebelumnya tidak dapat dibaca. Penyimpanan dibatalkan.",
      );
    }
  }

  // Memastikan seluruh data laporan berbentuk objek.
  if (
    !daftarLaporan.every(function (laporan) {
      return laporan && typeof laporan === "object";
    })
  ) {
    throw new Error("Terdapat data laporan yang tidak valid.");
  }

  // Memeriksa apakah kode laporan sudah pernah digunakan.
  const laporanSudahAda = daftarLaporan.some(function (laporan) {
    return laporan.id === dataLaporan.id;
  });

  if (laporanSudahAda) {
    throw new Error("Kode laporan sudah digunakan.");
  }

  // Menambahkan laporan terbaru ke urutan paling atas.
  daftarLaporan.unshift(dataLaporan);

  // Menyimpan kembali seluruh laporan ke LocalStorage.
  localStorage.setItem(
    KUNCI_PENYIMPANAN_LAPORAN,
    JSON.stringify(daftarLaporan),
  );

  // Memeriksa apakah data berhasil tersimpan.
  const hasilPenyimpanan = localStorage.getItem(KUNCI_PENYIMPANAN_LAPORAN);

  if (hasilPenyimpanan === null) {
    throw new Error("Penyimpanan laporan gagal.");
  }

  return dataLaporan;
}

// 11. Memvalidasi dan memproses pengiriman laporan.
function prosesKirimLaporan(event, formulir) {
  // Mencegah pengiriman formulir secara otomatis oleh HTML.
  event.preventDefault();

  // Memeriksa kelengkapan input berdasarkan aturan HTML.
  if (!formulir.checkValidity()) {
    formulir.reportValidity();
    return;
  }

  // Mengambil kolom deskripsi kerusakan.
  const kolomDeskripsi = formulir.querySelector("#deskripsi");

  // Menolak deskripsi yang hanya berisi spasi.
  if (kolomDeskripsi.value.trim() === "") {
    alert("Deskripsi kerusakan wajib diisi dengan benar.");
    kolomDeskripsi.focus();
    return;
  }

  // Mengumpulkan seluruh data dari formulir.
  const dataLaporan = kumpulkanDataLaporan(formulir);

  // Menyimpan laporan ke LocalStorage.
  try {
    simpanLaporan(dataLaporan);
  } catch (error) {
    console.error("Laporan gagal disimpan:", error);

    alert(error.message || "Laporan gagal disimpan. Silakan coba kembali.");

    return;
  }

  // Menyimpan laporan terakhir untuk halaman konfirmasi.
  try {
    sessionStorage.setItem("laporanTerakhir", JSON.stringify(dataLaporan));
  } catch (error) {
    console.error("Gagal menyimpan sesi konfirmasi:", error);

    alert(
      "Laporan sudah tersimpan, tetapi informasi konfirmasi gagal disiapkan. Silakan periksa riwayat laporan.",
    );

    return;
  }

  // Menampilkan hasil pengiriman pada Console.
  console.log("===== PENGIRIMAN LAPORAN SIPFAS =====");
  console.log("Kode laporan:", dataLaporan.id);
  console.log("Nama fasilitas:", dataLaporan.facility);
  console.log("Kode fasilitas:", dataLaporan.facilityCode);
  console.log("Lokasi:", dataLaporan.location);
  console.log("Kode lokasi:", dataLaporan.locationCode);
  console.log("Tanggal:", dataLaporan.dateTime);
  console.log("Prioritas:", dataLaporan.priority);
  console.log("Status:", dataLaporan.status);
  console.log("=====================================");

  // Mengarahkan pengguna ke halaman konfirmasi.
  window.location.href = "../Konfirmasi-laporan/Konfirmasi-laporan.html";
}
