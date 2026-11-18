// 01. Menjalankan program setelah HTML selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  mulaiFormLaporan();
});

// 02. Nama penyimpanan bersama untuk seluruh data laporan.
const KUNCI_PENYIMPANAN_LAPORAN = "sipfasReports";

// 03. Alamat API penyimpanan laporan ke database.
const URL_API_SIMPAN_LAPORAN = "../../api/user/simpan-laporan.php";

// 04. Memulai formulir dan mengaktifkan fitur penghitung karakter.
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

// 05. Menghitung jumlah karakter pada deskripsi kerusakan.
function hitungKarakter(kolom, tampilan) {
  if (!tampilan) return;

  tampilan.textContent = kolom.value.length + " / 300";
}

// 06. Mengambil kode dan nama lokasi serta fasilitas.
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

// 07. Mengambil tingkat kerusakan dan dampak akademik.
function ambilPenilaianKerusakan(formulir) {
  const tingkat = formulir.querySelector('input[name="tingkat"]:checked');

  const dampak = formulir.querySelector('input[name="dampak"]:checked');

  return {
    tingkatKerusakan: tingkat ? tingkat.value : "",
    dampakAkademik: dampak ? dampak.value : "",
  };
}

// 08. Menghitung prioritas berdasarkan penilaian kerusakan.
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

// 09. Membuat kode laporan secara otomatis.
function buatKodeLaporan() {
  const tahun = new Date().getFullYear();
  const waktu = Date.now();
  const angkaAcak = Math.floor(100 + Math.random() * 900);

  return `LP-${tahun}-${waktu}-${angkaAcak}`;
}

// 10. Mengumpulkan seluruh data dari formulir laporan.
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

// 11. Mengirim laporan ke database melalui API.
async function kirimLaporanKeDatabase(dataLaporan) {
  const response = await fetch(URL_API_SIMPAN_LAPORAN, {
    method: "POST",

    credentials: "same-origin",

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },

    body: JSON.stringify({
      kode_laporan: dataLaporan.kodeLaporan,

      id_fasilitas: dataLaporan.facilityCode,

      deskripsi_kerusakan: dataLaporan.deskripsi,

      tingkat_kerusakan_x1: dataLaporan.tingkatKerusakan,

      dampak_akademik_x2: dataLaporan.dampakAkademik,

      prioritas_awal: dataLaporan.priority,
    }),
  });

  // Membaca response JSON dari server.
  let hasil;

  try {
    hasil = await response.json();
  } catch (error) {
    throw new Error("Server tidak memberikan respons JSON yang valid.");
  }

  // Memeriksa status response.
  if (!response.ok || !hasil.success) {
    throw new Error(hasil.message || "Laporan gagal disimpan ke database.");
  }

  return hasil;
}

// 12. Menyimpan laporan ke dalam LocalStorage.
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

// 13. Memvalidasi dan memproses pengiriman laporan.
async function prosesKirimLaporan(event, formulir) {
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

  // ==========================================================
  // MENGIRIM DATA KE DATABASE
  // ==========================================================

  try {
    await kirimLaporanKeDatabase(dataLaporan);
  } catch (error) {
    console.error("Laporan gagal disimpan ke database:", error);

    alert(
      error.message ||
        "Laporan gagal disimpan ke database. Silakan coba kembali.",
    );

    return;
  }

  // ==========================================================
  // SETELAH DATABASE BERHASIL, SIMPAN CACHE LOCALSTORAGE
  // ==========================================================

  try {
    simpanLaporan(dataLaporan);
  } catch (error) {
    console.error(
      "Laporan database berhasil, tetapi LocalStorage gagal:",
      error,
    );
  }

  // Menyimpan laporan terakhir untuk halaman konfirmasi.
  try {
    sessionStorage.setItem("laporanTerakhir", JSON.stringify(dataLaporan));
  } catch (error) {
    console.error("Gagal menyimpan sesi konfirmasi:", error);

    alert(
      "Laporan sudah berhasil tersimpan ke database, tetapi informasi konfirmasi gagal disiapkan. Silakan periksa riwayat laporan.",
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

  console.log("Status database: BERHASIL");

  console.log("=====================================");

  // NOTIFIKASI LAPORAN BERHASIL DIKIRIM.
  alert(
    "Laporan berhasil dikirim!\n\n" +
      "Kode Laporan: " +
      dataLaporan.kodeLaporan +
      "\n" +
      "Status: " +
      dataLaporan.status,
  );

  // Mengarahkan pengguna ke halaman konfirmasi.
  window.location.href = "../Konfirmasi-laporan/Konfirmasi-laporan.html";
}

// ============================================================
// SINKRONISASI PROFIL PENGGUNA PADA HALAMAN BUAT LAPORAN
// ============================================================

// 01. Menjalankan sinkronisasi setelah halaman selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  updateReportProfile();

  // Memperbarui profil jika data berubah dari halaman lain.
  window.addEventListener("storage", function (event) {
    const kunciFoto = buatKunciFotoProfilLaporan();

    if (
      event.key === "sipfasProfile" ||
      event.key === "sipfasActiveUser" ||
      event.key === kunciFoto
    ) {
      updateReportProfile();
    }
  });

  // Mendukung pembaruan profil melalui event SIPFAS.
  window.addEventListener("sipfas:profile-updated", function (event) {
    updateReportProfile();

    if (event.detail && event.detail.photo) {
      tampilkanFotoHeaderLaporan(event.detail.photo);
    }
  });
});

// 02. Mengambil key foto sesuai akun yang sedang login.
// Mengikuti mekanisme penyimpanan pada Profil.js.
function buatKunciFotoProfilLaporan() {
  try {
    const dataAkunAktif = sessionStorage.getItem("sipfasActiveUser");

    if (!dataAkunAktif) {
      return "sipfasProfilePhoto";
    }

    const akunAktif = JSON.parse(dataAkunAktif);

    if (!akunAktif) {
      return "sipfasProfilePhoto";
    }

    const identitas =
      akunAktif.id ||
      akunAktif.username ||
      akunAktif.email ||
      akunAktif.nim ||
      "pengguna";

    return "sipfasProfilePhoto_" + String(identitas).toLowerCase();
  } catch (error) {
    console.error("Gagal mengambil identitas foto:", error);

    return "sipfasProfilePhoto";
  }
}

// 03. Menampilkan foto profil pada avatar header.
function tampilkanFotoHeaderLaporan(sumberFoto) {
  const avatar = document.querySelector(".header-avatar");

  if (!avatar) return;

  const ikonDefault = avatar.querySelector("svg");

  if (sumberFoto) {
    // Menampilkan foto profil terbaru.
    avatar.style.backgroundImage = `url("${sumberFoto}")`;

    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
    avatar.style.backgroundRepeat = "no-repeat";

    // Menyembunyikan ikon avatar bawaan.
    if (ikonDefault) {
      ikonDefault.style.display = "none";
    }
  } else {
    // Mengembalikan tampilan avatar bawaan jika belum ada foto.
    avatar.style.backgroundImage = "none";
    avatar.style.backgroundSize = "";
    avatar.style.backgroundPosition = "";
    avatar.style.backgroundRepeat = "";

    if (ikonDefault) {
      ikonDefault.style.display = "";
    }
  }
}

// 04. Mengambil dan memperbarui identitas pengguna.
function updateReportProfile() {
  try {
    // Mengambil identitas pengguna.
    const dataProfil = localStorage.getItem("sipfasProfile");

    if (dataProfil) {
      const profil = JSON.parse(dataProfil);

      if (profil && profil.name) {
        document.querySelectorAll(".header-name").forEach(function (elemen) {
          elemen.textContent = profil.name;
        });
      }
    }

    // Mengambil foto profil berdasarkan akun aktif.
    const kunciFoto = buatKunciFotoProfilLaporan();

    const fotoProfil = localStorage.getItem(kunciFoto);

    // Memperbarui avatar pada header.
    tampilkanFotoHeaderLaporan(fotoProfil);

    console.log("Sinkronisasi profil halaman Buat Laporan berhasil.");
  } catch (error) {
    console.error("Gagal memperbarui profil pengguna:", error);
  }
}
