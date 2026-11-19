"use strict";

/* ============================================================
   SIPFAS - BUAT LAPORAN KERUSAKAN
   Sumber data utama: DATABASE SIPFAS
   Tampilan HTML/CSS dipertahankan.
============================================================ */

const URL_API_DAFTAR_FASILITAS = "../../../api/user/daftar-fasilitas.php";
const URL_API_SIMPAN_LAPORAN = "../../../api/user/simpan-laporan.php";

let daftarFasilitasAktif = [];
let formLaporan = null;
let tombolKirimLaporan = null;

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

/* ============================================================
   01. INISIALISASI FORM
============================================================ */

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

/* ============================================================
   02. REQUEST API DAN PEMBACAAN JSON
============================================================ */

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

/* ============================================================
   03. MEMUAT LOKASI DAN FASILITAS DARI DATABASE
============================================================ */

async function muatDataFasilitas() {
  const pilihanLokasi = document.getElementById("lokasi");
  const pilihanFasilitas = document.getElementById("fasilitas");

  if (!pilihanLokasi || !pilihanFasilitas) return;

  pilihanLokasi.disabled = true;
  pilihanFasilitas.disabled = true;

  aturPilihan(pilihanLokasi, "Memuat lokasi fasilitas...", []);

  aturPilihan(pilihanFasilitas, "Pilih lokasi terlebih dahulu...", []);

  try {
    const response = await requestJSON(API_DAFTAR_FASILITAS, {
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
      .map((item) => ({
        value: String(item.value ?? item.label ?? ""),
        label: String(item.label ?? item.value ?? ""),
      }))
      .filter((item) => item.value && item.label);

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

function aturPilihan(selectElement, placeholder, options) {
  if (!selectElement) return;

  selectElement.replaceChildren();

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  placeholderOption.disabled = true;
  placeholderOption.selected = true;

  selectElement.appendChild(placeholderOption);

  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item.value);
    option.textContent = String(item.label);
    selectElement.appendChild(option);
  });
}

/* ============================================================
   04. MENAMPILKAN FASILITAS SESUAI LOKASI YANG DIPILIH
============================================================ */

function tampilkanFasilitasBerdasarkanLokasi(lokasiDipilih) {
  const pilihanFasilitas = document.getElementById("fasilitas");

  if (!pilihanFasilitas) return;

  const lokasiNormal = normalisasiTeks(lokasiDipilih);

  const fasilitasTersedia = daftarFasilitasAktif.filter((item) => {
    return normalisasiTeks(item.lokasi_ruangan) === lokasiNormal;
  });

  const opsiFasilitas = fasilitasTersedia.map((item) => ({
    value: String(item.id_fasilitas),
    label: `${item.nama_fasilitas} (${item.kode_fasilitas})`,
  }));

  aturPilihan(
    pilihanFasilitas,
    fasilitasTersedia.length
      ? "Pilih fasilitas yang mengalami kerusakan..."
      : "Tidak ada fasilitas aktif di lokasi ini",
    opsiFasilitas,
  );

  pilihanFasilitas.disabled = fasilitasTersedia.length === 0;
}

function normalisasiTeks(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("id-ID");
}

/* ============================================================
   05. PENGHITUNG KARAKTER
============================================================ */

function hitungKarakter(kolom, tampilan) {
  if (!kolom || !tampilan) return;
  tampilan.textContent = `${kolom.value.length} / 300`;
}

/* ============================================================
   06. MENGAMBIL FASILITAS TERPILIH
============================================================ */

function ambilFasilitasTerpilih() {
  const idFasilitas = Number(document.getElementById("fasilitas")?.value || 0);

  if (!Number.isInteger(idFasilitas) || idFasilitas <= 0) {
    throw new Error("Silakan pilih fasilitas yang mengalami kerusakan.");
  }

  const fasilitas = daftarFasilitasAktif.find(
    (item) => Number(item.id_fasilitas) === idFasilitas,
  );

  if (!fasilitas) {
    throw new Error(
      "Fasilitas yang dipilih tidak ditemukan. Muat ulang halaman dan coba kembali.",
    );
  }

  return fasilitas;
}

/* ============================================================
   07. PEMETAAN NILAI X1 DAN X2
   Nilai numerik digunakan agar sesuai dengan dataset C4.5.
============================================================ */

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

/* ============================================================
   08. PEMETAAN FREKUENSI FASILITAS MENJADI X3
   1 = Jarang, 2 = Sedang, 3 = Sering.
   Nilai tetap dihitung ulang oleh backend dari database.
============================================================ */

function konversiFrekuensiX3(frekuensi) {
  const nilai = normalisasiTeks(frekuensi);

  if (nilai.includes("sering")) return 3;
  if (nilai.includes("sedang")) return 2;
  if (nilai.includes("jarang")) return 1;

  const angka = Number((nilai.match(/\d+/) || [])[0]);

  if (Number.isFinite(angka)) {
    if (angka <= 2) return 1;
    if (angka <= 4) return 2;
    return 3;
  }

  return null;
}

/* ============================================================
   09. MENGHITUNG PRIORITAS AWAL
============================================================ */

function hitungPrioritasLaporan(x1, x2) {
  if (x1 === 3) return "Tinggi";
  if (x1 === 2 && x2 === 3) return "Tinggi";
  if (x1 === 2 || x2 === 3) return "Sedang";
  return "Rendah";
}

/* ============================================================
   10. MEMBUAT KODE LAPORAN
============================================================ */

function buatKodeLaporan() {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const waktu = Date.now();
  const acak = Math.floor(1000 + Math.random() * 9000);

  return `LP-${tahun}-${waktu}-${acak}`;
}

/* ============================================================
   11. MENYIAPKAN DATA LAPORAN UNTUK API
============================================================ */

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
    prioritas_awal: hitungPrioritasLaporan(penilaian.x1, penilaian.x2),

    // Data ini hanya untuk tampilan konfirmasi.
    _tampilan: {
      nama_fasilitas: fasilitas.nama_fasilitas,
      kode_fasilitas: fasilitas.kode_fasilitas,
      lokasi_ruangan: fasilitas.lokasi_ruangan,
      tingkat_label: penilaian.tingkatLabel,
      dampak_label: penilaian.dampakLabel,
    },
  };
}

/* ============================================================
   12. MENGIRIM DATA KE DATABASE
============================================================ */

async function kirimLaporanKeDatabase(payload) {
  const dataKirim = {
    kode_laporan: payload.kode_laporan,
    id_fasilitas: payload.id_fasilitas,
    deskripsi_kerusakan: payload.deskripsi_kerusakan,
    tingkat_kerusakan_x1: payload.tingkat_kerusakan_x1,
    dampak_akademik_x2: payload.dampak_akademik_x2,
    prioritas_awal: payload.prioritas_awal,
  };

  return requestJSON(API_SIMPAN_LAPORAN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dataKirim),
  });
}

/* ============================================================
   13. MENYIAPKAN DATA KONFIRMASI
============================================================ */

function simpanDataKonfirmasi(payload, responseData) {
  const sekarang = new Date();
  const info = payload._tampilan;

  const tanggal = sekarang.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });

  const tanggalLengkap =
    sekarang.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Makassar",
    }) +
    ", " +
    sekarang.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Makassar",
    }) +
    " WIT";

  const laporanKonfirmasi = {
    id: payload.kode_laporan,
    kodeLaporan: payload.kode_laporan,
    idLaporan: responseData.id_laporan || null,

    facility: info.nama_fasilitas,
    namaFasilitas: info.nama_fasilitas,
    facilityCode: info.kode_fasilitas,

    location: info.lokasi_ruangan,
    lokasiFasilitas: info.lokasi_ruangan,

    date: tanggal,
    dateTime: tanggalLengkap,
    tanggalLaporan: sekarang.toISOString(),
    createdAt: sekarang.toISOString(),

    description: payload.deskripsi_kerusakan,
    deskripsi: payload.deskripsi_kerusakan,

    damageLevel: info.tingkat_label,
    tingkatKerusakan: info.tingkat_label,
    academicImpact: info.dampak_label,
    dampakAkademik: info.dampak_label,

    priority: payload.prioritas_awal,
    prioritas: `Prioritas ${payload.prioritas_awal}`,

    status: "Menunggu Verifikasi",
    mainStatus: "Menunggu Verifikasi",
    verificationStatus: "Menunggu",
    verificationDescription: "Laporan sedang menunggu verifikasi petugas.",
    handlingStatus: "Menunggu",
    handlingDescription: "Laporan belum masuk tahap penanganan.",
  };

  sessionStorage.setItem("laporanTerakhir", JSON.stringify(laporanKonfirmasi));

  sessionStorage.setItem(
    "sipfasFlashNotification",
    JSON.stringify({
      type: "success",
      title: "Laporan Berhasil Dikirim",
      message: `Laporan ${payload.kode_laporan} berhasil disimpan ke database.`,
    }),
  );
}

/* ============================================================
   14. PROSES SUBMIT FORM
============================================================ */

async function prosesKirimLaporan(event, formulir) {
  event.preventDefault();

  if (!formulir.checkValidity()) {
    formulir.reportValidity();
    return;
  }

  if (tombolKirimLaporan?.disabled) return;

  let payload;

  try {
    payload = kumpulkanDataLaporan(formulir);
  } catch (error) {
    alert(error.message);
    return;
  }

  const teksTombol = tombolKirimLaporan ? tombolKirimLaporan.innerHTML : "";

  if (tombolKirimLaporan) {
    tombolKirimLaporan.disabled = true;
    tombolKirimLaporan.textContent = "Mengirim...";
  }

  try {
    const hasil = await kirimLaporanKeDatabase(payload);

    simpanDataKonfirmasi(payload, hasil.data || {});

    console.log("[SIPFAS] Laporan berhasil disimpan:", hasil.data);

    alert(
      "Laporan berhasil dikirim!\n\n" +
        `Kode Laporan: ${payload.kode_laporan}\n` +
        `Fasilitas: ${payload._tampilan.nama_fasilitas}\n` +
        `Prioritas: ${payload.prioritas_awal}\n` +
        "Status: Menunggu Verifikasi",
    );

    window.location.href = "../Konfirmasi-laporan/Konfirmasi-laporan.html";
  } catch (error) {
    console.error("[SIPFAS] Gagal mengirim laporan:", error);

    alert(
      error.message ||
        "Laporan gagal disimpan. Silakan periksa koneksi dan coba kembali.",
    );
  } finally {
    if (tombolKirimLaporan) {
      tombolKirimLaporan.disabled = false;
      tombolKirimLaporan.innerHTML = teksTombol;
    }
  }
}

/* ============================================================
   15. SINKRONISASI PROFIL PENGGUNA
   Bagian ini mempertahankan perilaku profil yang sudah ada.
============================================================ */

function buatKunciFotoProfilLaporan() {
  try {
    const dataAkunAktif = sessionStorage.getItem("sipfasActiveUser");

    if (!dataAkunAktif) return "sipfasProfilePhoto";

    const akunAktif = JSON.parse(dataAkunAktif);
    if (!akunAktif) return "sipfasProfilePhoto";

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

function tampilkanFotoHeaderLaporan(sumberFoto) {
  const avatar = document.querySelector(".header-avatar");
  if (!avatar) return;

  const ikonDefault = avatar.querySelector("svg");

  if (sumberFoto) {
    avatar.style.backgroundImage = `url("${sumberFoto}")`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
    avatar.style.backgroundRepeat = "no-repeat";

    if (ikonDefault) ikonDefault.style.display = "none";
  } else {
    avatar.style.backgroundImage = "none";
    avatar.style.backgroundSize = "";
    avatar.style.backgroundPosition = "";
    avatar.style.backgroundRepeat = "";

    if (ikonDefault) ikonDefault.style.display = "";
  }
}

function updateReportProfile() {
  try {
    const dataProfil = localStorage.getItem("sipfasProfile");

    if (dataProfil) {
      const profil = JSON.parse(dataProfil);

      if (profil && profil.name) {
        document.querySelectorAll(".header-name").forEach((element) => {
          element.textContent = profil.name;
        });
      }
    }

    const fotoProfil = localStorage.getItem(buatKunciFotoProfilLaporan());

    tampilkanFotoHeaderLaporan(fotoProfil);
  } catch (error) {
    console.error("[SIPFAS] Gagal memperbarui profil pengguna:", error);
  }
}
