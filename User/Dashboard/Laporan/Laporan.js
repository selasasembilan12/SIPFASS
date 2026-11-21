"use strict";

// ============================================================
// 00. KONFIGURASI API
// ============================================================

const URL_API_DAFTAR_FASILITAS = "../../../api/user/daftar-fasilitas.php";
const URL_API_SIMPAN_LAPORAN = "../../../api/user/simpan-laporan.php";

const KUNCI_LAPORAN_TERAKHIR = "laporanTerakhir";
const KUNCI_NOTIFIKASI = "sipfasFlashNotification";

let daftarFasilitasAktif = [];
let formLaporan = null;
let tombolKirimLaporan = null;
let sedangMengirimLaporan = false;

// ============================================================
// 01. INISIALISASI HALAMAN
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  mulaiFormLaporan();
  updateReportProfile();

  window.addEventListener("storage", function (event) {
    const keyFoto = buatKunciFotoProfilLaporan();

    if (
      event.key === "sipfasProfile" ||
      event.key === "sipfasActiveUser" ||
      event.key === keyFoto
    ) {
      updateReportProfile();
    }
  });

  window.addEventListener("sipfas:profile-updated", function (event) {
    updateReportProfile();

    if (event.detail && event.detail.photo) {
      tampilkanFotoHeaderLaporan(event.detail.photo);
    }
  });
});

// ============================================================
// 02. INISIALISASI FORM
// ============================================================

function mulaiFormLaporan() {
  formLaporan = document.querySelector(".form-card form");

  const kolomDeskripsi = document.getElementById("deskripsi");
  const jumlahKarakter = document.querySelector(".character-count");
  const pilihanLokasi = document.getElementById("lokasi");
  const pilihanFasilitas = document.getElementById("fasilitas");

  if (!formLaporan || !kolomDeskripsi || !pilihanLokasi || !pilihanFasilitas) {
    console.error("[SIPFAS] Elemen formulir laporan tidak lengkap.");
    return;
  }

  tombolKirimLaporan = formLaporan.querySelector("button[type='submit']");

  hitungKarakter(kolomDeskripsi, jumlahKarakter);

  kolomDeskripsi.addEventListener("input", function () {
    hitungKarakter(kolomDeskripsi, jumlahKarakter);
  });

  pilihanLokasi.addEventListener("change", function () {
    tampilkanFasilitasBerdasarkanLokasi(pilihanLokasi.value);
  });

  formLaporan.addEventListener("submit", function (event) {
    prosesKirimLaporan(event, formLaporan);
  });

  muatDataFasilitas();
}

// ============================================================
// 03. REQUEST API DAN PEMBACAAN JSON
// ============================================================

async function requestJSON(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  const rawText = await response.text();

  let result;

  try {
    result = JSON.parse(rawText);
  } catch (error) {
    console.error("[SIPFAS] Respons API bukan JSON:", rawText);

    throw new Error(
      "Server tidak memberikan respons JSON. Periksa alamat API dan log PHP.",
    );
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message ||
        `Permintaan gagal dengan status HTTP ${response.status}.`,
    );
  }

  return result;
}

// ============================================================
// 04. MEMUAT LOKASI DAN FASILITAS DARI DATABASE
// ============================================================

async function muatDataFasilitas() {
  const pilihanLokasi = document.getElementById("lokasi");
  const pilihanFasilitas = document.getElementById("fasilitas");

  if (!pilihanLokasi || !pilihanFasilitas) return;

  pilihanLokasi.disabled = true;
  pilihanFasilitas.disabled = true;

  aturPilihan(pilihanLokasi, "Memuat lokasi fasilitas...", []);
  aturPilihan(pilihanFasilitas, "Pilih lokasi terlebih dahulu...", []);

  try {
    const response = await requestJSON(URL_API_DAFTAR_FASILITAS, {
      method: "GET",
    });

    const data = response.data || {};

    const lokasi = Array.isArray(data.lokasi) ? data.lokasi : [];

    daftarFasilitasAktif = Array.isArray(data.fasilitas) ? data.fasilitas : [];

    if (lokasi.length === 0 || daftarFasilitasAktif.length === 0) {
      aturPilihan(pilihanLokasi, "Belum ada lokasi fasilitas aktif", []);
      aturPilihan(pilihanFasilitas, "Belum ada fasilitas aktif", []);

      alert(
        "Data fasilitas belum tersedia. Silakan hubungi Administrator untuk memeriksa data fasilitas.",
      );

      return;
    }

    const opsiLokasi = lokasi
      .map(function (item) {
        return {
          value: String(item.id_lokasi ?? ""),
          label: String(item.nama_lokasi ?? ""),
        };
      })
      .filter(function (item) {
        return item.value && item.label;
      });

    aturPilihan(pilihanLokasi, "Pilih Lokasi Fasilitas Kampus...", opsiLokasi);

    pilihanLokasi.disabled = false;

    console.log("[SIPFAS] Data lokasi berhasil dimuat:", opsiLokasi.length);
    console.log(
      "[SIPFAS] Data fasilitas berhasil dimuat:",
      daftarFasilitasAktif.length,
    );
  } catch (error) {
    console.error("[SIPFAS] Gagal memuat fasilitas:", error);

    aturPilihan(pilihanLokasi, "Gagal memuat lokasi fasilitas", []);
    aturPilihan(pilihanFasilitas, "Data fasilitas tidak tersedia", []);

    alert(error.message || "Data fasilitas gagal dimuat dari database.");
  }
}

// ============================================================
// 05. MENGATUR PILIHAN SELECT
// ============================================================

function aturPilihan(selectElement, placeholder, options) {
  if (!selectElement) return;

  selectElement.replaceChildren();

  const placeholderOption = document.createElement("option");

  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  placeholderOption.disabled = true;
  placeholderOption.selected = true;

  selectElement.appendChild(placeholderOption);

  options.forEach(function (item) {
    const option = document.createElement("option");

    option.value = String(item.value);
    option.textContent = String(item.label);

    selectElement.appendChild(option);
  });
}

// ============================================================
// 06. MENAMPILKAN FASILITAS BERDASARKAN LOKASI
// ============================================================

function tampilkanFasilitasBerdasarkanLokasi(lokasiDipilih) {
  const pilihanFasilitas = document.getElementById("fasilitas");

  if (!pilihanFasilitas) return;

  const fasilitasTersedia = daftarFasilitasAktif.filter(function (item) {
    return String(item.id_lokasi) === String(lokasiDipilih);
  });

  const opsiFasilitas = fasilitasTersedia.map(function (item) {
    return {
      value: String(item.id_fasilitas),
      label: `${item.nama_fasilitas} (${item.kode_fasilitas})`,
    };
  });

  aturPilihan(
    pilihanFasilitas,
    fasilitasTersedia.length
      ? "Pilih fasilitas yang mengalami kerusakan..."
      : "Tidak ada fasilitas aktif di lokasi ini",
    opsiFasilitas,
  );

  pilihanFasilitas.disabled = fasilitasTersedia.length === 0;
}

// ============================================================
// 07. NORMALISASI TEKS
// ============================================================

function normalisasiTeks(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("id-ID");
}

// ============================================================
// 08. PENGHITUNG KARAKTER
// ============================================================

function hitungKarakter(kolom, tampilan) {
  if (!kolom || !tampilan) return;

  tampilan.textContent = `${kolom.value.length} / 300`;
}

// ============================================================
// 09. MENGAMBIL FASILITAS TERPILIH
// ============================================================

function ambilFasilitasTerpilih() {
  const idFasilitas = Number(document.getElementById("fasilitas")?.value || 0);

  if (!Number.isInteger(idFasilitas) || idFasilitas <= 0) {
    throw new Error("Silakan pilih fasilitas yang mengalami kerusakan.");
  }

  const fasilitas = daftarFasilitasAktif.find(function (item) {
    return Number(item.id_fasilitas) === idFasilitas;
  });

  if (!fasilitas) {
    throw new Error(
      "Fasilitas yang dipilih tidak ditemukan. Muat ulang halaman dan coba kembali.",
    );
  }

  return fasilitas;
}

// ============================================================
// 10. PEMETAAN NILAI X1 DAN X2
// Nilai numerik digunakan untuk dataset C4.5.
// ============================================================

function ambilPenilaianKerusakan(formulir) {
  const tingkat = formulir.querySelector('input[name="tingkat"]:checked');
  const dampak = formulir.querySelector('input[name="dampak"]:checked');

  const mapTingkat = {
    ringan: 1,
    sedang: 2,
    berat: 3,
  };

  const mapDampak = {
    rendah: 1,
    sedang: 2,
    tinggi: 3,
  };

  if (!tingkat || !mapTingkat[tingkat.value]) {
    throw new Error("Tingkat kerusakan wajib dipilih.");
  }

  if (!dampak || !mapDampak[dampak.value]) {
    throw new Error("Dampak akademik wajib dipilih.");
  }

  return {
    tingkatLabel: tingkat.value,
    dampakLabel: dampak.value,
    x1: mapTingkat[tingkat.value],
    x2: mapDampak[dampak.value],
  };
}

// ============================================================
// 11. MEMBUAT KODE LAPORAN
// ============================================================

function buatKodeLaporan() {
  const sekarang = new Date();

  const tahun = sekarang.getFullYear();
  const waktu = Date.now();
  const acak = Math.floor(1000 + Math.random() * 9000);

  return `LP-${tahun}-${waktu}-${acak}`;
}

// ============================================================
// 12. MENYIAPKAN DATA LAPORAN
// ============================================================

function kumpulkanDataLaporan(formulir) {
  const fasilitas = ambilFasilitasTerpilih();
  const penilaian = ambilPenilaianKerusakan(formulir);

  const deskripsi = document.getElementById("deskripsi").value.trim();

  if (!deskripsi) {
    throw new Error("Deskripsi kerusakan wajib diisi.");
  }

  if (deskripsi.length > 300) {
    throw new Error("Deskripsi kerusakan maksimal 300 karakter.");
  }

  return {
    kode_laporan: buatKodeLaporan(),

    id_fasilitas: Number(fasilitas.id_fasilitas),

    deskripsi_kerusakan: deskripsi,

    tingkat_kerusakan_x1: penilaian.x1,

    dampak_akademik_x2: penilaian.x2,

    _tampilan: {
      nama_fasilitas: fasilitas.nama_fasilitas,
      kode_fasilitas: fasilitas.kode_fasilitas,
      lokasi_ruangan: fasilitas.nama_lokasi,
      tingkat_label: penilaian.tingkatLabel,
      dampak_label: penilaian.dampakLabel,
    },
  };
}

// ============================================================
// 13. MENGIRIM DATA KE DATABASE
// Prioritas tidak dikirim dari frontend.
// X3 dan prioritas dihitung di backend.
// ============================================================

async function kirimLaporanKeDatabase(payload) {
  const dataKirim = {
    kode_laporan: payload.kode_laporan,
    id_fasilitas: payload.id_fasilitas,
    deskripsi_kerusakan: payload.deskripsi_kerusakan,
    tingkat_kerusakan_x1: payload.tingkat_kerusakan_x1,
    dampak_akademik_x2: payload.dampak_akademik_x2,
  };

  return requestJSON(URL_API_SIMPAN_LAPORAN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dataKirim),
  });
}

// ============================================================
// 14. MENGAMBIL ID DATABASE DARI RESPONS API
// ============================================================

function ambilIdDatabase(dataRespons) {
  if (!dataRespons || typeof dataRespons !== "object") {
    return null;
  }

  const sumber = [
    dataRespons.id_laporan,
    dataRespons.idLaporan,
    dataRespons.id,
    dataRespons.data?.id_laporan,
    dataRespons.data?.idLaporan,
    dataRespons.data?.id,
  ];

  for (const nilai of sumber) {
    if (nilai !== undefined && nilai !== null && String(nilai).trim() !== "") {
      const id = Number(nilai);

      if (Number.isInteger(id) && id > 0) {
        return id;
      }
    }
  }

  return null;
}

// ============================================================
// 15. MENYIMPAN IDENTITAS LAPORAN UNTUK HALAMAN KONFIRMASI
// Data utama akan dimuat ulang dari database.
// ============================================================

function simpanDataKonfirmasi(payload, hasilAPI) {
  const data = hasilAPI && typeof hasilAPI === "object" ? hasilAPI : {};
  const idDatabase = ambilIdDatabase(data);

  if (!idDatabase) {
    throw new Error(
      "Laporan tersimpan, tetapi server tidak mengembalikan ID database. Periksa respons API sebelum mengirim ulang agar tidak membuat laporan duplikat.",
    );
  }

  const laporanKonfirmasi = {
    idLaporan: idDatabase,
    id_laporan: idDatabase,
    idDatabase: idDatabase,
    id: payload.kode_laporan,
    kodeLaporan: payload.kode_laporan,
    kode_laporan: payload.kode_laporan,
  };

  sessionStorage.setItem(
    KUNCI_LAPORAN_TERAKHIR,
    JSON.stringify(laporanKonfirmasi),
  );

  sessionStorage.setItem(
    KUNCI_NOTIFIKASI,
    JSON.stringify({
      type: "success",
      title: "Laporan Berhasil Dikirim",
      message: `Laporan ${payload.kode_laporan} berhasil disimpan ke database.`,
    }),
  );

  return laporanKonfirmasi;
}

// ============================================================
// 16. PROSES SUBMIT FORM
// ============================================================

async function prosesKirimLaporan(event, formulir) {
  event.preventDefault();

  if (sedangMengirimLaporan) return;

  if (!formulir.checkValidity()) {
    formulir.reportValidity();
    return;
  }

  let payload;

  try {
    payload = kumpulkanDataLaporan(formulir);
  } catch (error) {
    alert(error.message);
    return;
  }

  sedangMengirimLaporan = true;

  const teksTombol = tombolKirimLaporan ? tombolKirimLaporan.innerHTML : "";

  if (tombolKirimLaporan) {
    tombolKirimLaporan.disabled = true;
    tombolKirimLaporan.textContent = "Mengirim...";
  }

  try {
    const hasil = await kirimLaporanKeDatabase(payload);

    console.log("[SIPFAS] Respons penyimpanan database:", hasil);

    const dataRespons = hasil.data || {};

    simpanDataKonfirmasi(payload, dataRespons);

    console.log("[SIPFAS] Laporan berhasil disimpan:", dataRespons);

    alert(
      "Laporan berhasil dikirim!\n\n" +
        `Kode Laporan: ${payload.kode_laporan}\n` +
        `Fasilitas: ${payload._tampilan.nama_fasilitas}\n` +
        `Prioritas C4.5: ${dataRespons.prioritas_awal || "Belum Ditentukan"}\n` +
        "Status: Menunggu Verifikasi",
    );

    window.location.href = "../Konfirmasi-laporan/Konfirmasi-laporan.html";
  } catch (error) {
    console.error("[SIPFAS] Gagal menyelesaikan pengiriman laporan:", error);

    alert(
      error.message ||
        "Laporan gagal dikirim. Periksa koneksi dan coba kembali.",
    );
  } finally {
    sedangMengirimLaporan = false;

    if (tombolKirimLaporan) {
      tombolKirimLaporan.disabled = false;
      tombolKirimLaporan.innerHTML = teksTombol;
    }
  }
}

// ============================================================
// 17. SINKRONISASI PROFIL PENGGUNA
// ============================================================

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
    console.error("[SIPFAS] Gagal mengambil identitas foto:", error);

    return "sipfasProfilePhoto";
  }
}

// ============================================================
// 18. MEMPERBARUI FOTO HEADER
// ============================================================

function tampilkanFotoHeaderLaporan(sumberFoto) {
  const avatar = document.querySelector(".header-avatar");

  if (!avatar) return;

  const ikonDefault = avatar.querySelector("svg");

  if (sumberFoto) {
    avatar.style.backgroundImage = `url("${sumberFoto}")`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
    avatar.style.backgroundRepeat = "no-repeat";

    if (ikonDefault) {
      ikonDefault.style.display = "none";
    }
  } else {
    avatar.style.backgroundImage = "none";
    avatar.style.backgroundSize = "";
    avatar.style.backgroundPosition = "";
    avatar.style.backgroundRepeat = "";

    if (ikonDefault) {
      ikonDefault.style.display = "";
    }
  }
}

// ============================================================
// 19. MEMPERBARUI PROFIL PENGGUNA
// ============================================================

function updateReportProfile() {
  try {
    const dataProfil = localStorage.getItem("sipfasProfile");

    if (dataProfil) {
      const profil = JSON.parse(dataProfil);

      const namaPengguna = profil.name || profil.fullName || profil.nama || "";

      if (namaPengguna) {
        document.querySelectorAll(".header-name").forEach(function (element) {
          element.textContent = namaPengguna;
        });
      }
    }

    const fotoProfil = localStorage.getItem(buatKunciFotoProfilLaporan());

    tampilkanFotoHeaderLaporan(fotoProfil);
  } catch (error) {
    console.error("[SIPFAS] Gagal memperbarui profil pengguna:", error);
  }
}
