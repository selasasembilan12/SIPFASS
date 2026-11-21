"use strict";

// ============================================================
// 00. KONFIGURASI
// ============================================================

const LAST_REPORT_KEY = "laporanTerakhir";
const FLASH_NOTIFICATION_KEY = "sipfasFlashNotification";

const API_DETAIL_LAPORAN = "../../../api/user/detail.laporan.php";

let sedangMemuatKonfirmasi = false;

// ============================================================
// 01. INISIALISASI
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  tampilkanKonfirmasiLaporan();
  tampilkanNotifikasiKonfirmasi();
});

// ============================================================
// 02. MENGAMBIL IDENTITAS LAPORAN
// ============================================================

function ambilIdentitasLaporan() {
  try {
    const dataSesi = sessionStorage.getItem(LAST_REPORT_KEY);

    if (!dataSesi) {
      return null;
    }

    const laporan = JSON.parse(dataSesi);

    if (!laporan || typeof laporan !== "object") {
      return null;
    }

    const idDatabase =
      laporan.idLaporan || laporan.id_laporan || laporan.idDatabase;

    if (
      idDatabase &&
      /^\d+$/.test(String(idDatabase)) &&
      Number(idDatabase) > 0
    ) {
      return String(idDatabase);
    }

    return null;
  } catch (error) {
    console.error("[SIPFAS] Gagal membaca identitas laporan:", error);
    return null;
  }
}

// ============================================================
// 03. MENGAMBIL DATA LAPORAN DARI DATABASE
// ============================================================

async function ambilDetailLaporan(idLaporan) {
  if (!idLaporan) {
    throw new Error("ID laporan tidak ditemukan.");
  }

  const url =
    API_DETAIL_LAPORAN +
    "?id=" +
    encodeURIComponent(idLaporan) +
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

    throw new Error("Respons server tidak valid. Periksa API detail laporan.");
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message || "Gagal mengambil informasi laporan dari database.",
    );
  }

  if (!result.data || !result.data.id_laporan) {
    throw new Error("Data laporan tidak ditemukan di database.");
  }

  return result.data;
}

// ============================================================
// 04. MENAMPILKAN INFORMASI LAPORAN
// ============================================================

function tampilkanInformasiLaporan(data) {
  const elemenKode = document.querySelector(".report-code");

  const elemenNama = document.querySelector(
    ".facility-row .information-value strong",
  );

  const elemenLokasi = document.querySelector(
    ".facility-row .information-value span",
  );

  const elemenPrioritas = document.querySelector(".priority-badge");

  const elemenStatus = document.querySelector(".status-badge");

  // KODE LAPORAN.

  if (elemenKode) {
    elemenKode.textContent = data.kode_laporan || "-";
  }

  // NAMA FASILITAS.

  if (elemenNama) {
    elemenNama.textContent = data.nama_fasilitas || "-";
  }

  // LOKASI FASILITAS.

  if (elemenLokasi) {
    elemenLokasi.textContent = "(" + (data.nama_lokasi || "-") + ")";
  }

  // PRIORITAS DARI HASIL MODEL C4.5.

  const prioritas =
    data.prioritas_prediksi || data.prioritas_awal || "Belum Ditentukan";

  if (elemenPrioritas) {
    elemenPrioritas.textContent = String(prioritas).replace(
      /^Prioritas\s+/i,
      "",
    );

    elemenPrioritas.classList.remove(
      "priority-low",
      "priority-medium",
      "priority-high",
    );

    const nilaiPrioritas = String(prioritas).toLowerCase();

    if (nilaiPrioritas.includes("tinggi")) {
      elemenPrioritas.classList.add("priority-high");
    } else if (nilaiPrioritas.includes("sedang")) {
      elemenPrioritas.classList.add("priority-medium");
    } else if (nilaiPrioritas.includes("rendah")) {
      elemenPrioritas.classList.add("priority-low");
    }
  }

  // STATUS VERIFIKASI.

  if (elemenStatus) {
    const statusVerifikasi = String(data.status_verifikasi || "Menunggu");

    const statusPenanganan = String(data.status_penanganan || "Menunggu");

    let statusUtama = "Menunggu Verifikasi";

    const verifikasi = statusVerifikasi.toLowerCase();
    const penanganan = statusPenanganan.toLowerCase();

    if (verifikasi.includes("tidak valid") || verifikasi.includes("ditolak")) {
      statusUtama = "Tidak Valid";
    } else if (
      penanganan.includes("selesai") ||
      penanganan.includes("ditangani")
    ) {
      statusUtama = "Selesai";
    } else if (
      penanganan.includes("proses") ||
      penanganan.includes("diproses")
    ) {
      statusUtama = "Diproses";
    } else if (
      verifikasi.includes("valid") ||
      verifikasi.includes("terverifikasi") ||
      verifikasi.includes("disetujui")
    ) {
      statusUtama = "Menunggu Penanganan";
    }

    elemenStatus.textContent = statusUtama;
  }
}

// ============================================================
// 05. MENGATUR TOMBOL DETAIL LAPORAN
// ============================================================

function aturTombolDetail(data) {
  const tombolDetail = document.querySelector(".detail-button");

  if (!tombolDetail) return;

  const idDatabase = Number(data.id_laporan);

  if (!Number.isInteger(idDatabase) || idDatabase <= 0) {
    tombolDetail.style.pointerEvents = "none";
    tombolDetail.style.opacity = "0.5";
    return;
  }

  const urlDetail =
    "../Detail-laporan/Detail-laporan.html?id=" +
    encodeURIComponent(idDatabase);

  tombolDetail.href = urlDetail;

  tombolDetail.style.pointerEvents = "auto";
  tombolDetail.style.opacity = "1";

  tombolDetail.onclick = function (event) {
    event.preventDefault();
    window.location.href = urlDetail;
  };
}

// ============================================================
// 06. MENAMPILKAN KONFIRMASI LAPORAN
// ============================================================

async function tampilkanKonfirmasiLaporan() {
  if (sedangMemuatKonfirmasi) return;

  sedangMemuatKonfirmasi = true;

  try {
    const idLaporan = ambilIdentitasLaporan();

    if (!idLaporan) {
      throw new Error(
        "Identitas laporan tidak ditemukan. Silakan kembali ke halaman Laporan Saya.",
      );
    }

    // Data selalu diminta ulang dari database.
    const data = await ambilDetailLaporan(idLaporan);

    // Tampilkan informasi dari database.
    tampilkanInformasiLaporan(data);

    // Atur tautan detail berdasarkan ID database.
    aturTombolDetail(data);

    console.log("===== KONFIRMASI LAPORAN SIPFAS =====");

    console.log("ID Database:", data.id_laporan);
    console.log("Kode:", data.kode_laporan);
    console.log("Fasilitas:", data.nama_fasilitas);
    console.log("Lokasi:", data.nama_lokasi);
    console.log("X1:", data.tingkat_kerusakan_x1);
    console.log("X2:", data.dampak_akademik_x2);
    console.log("X3:", data.frekuensi_penggunaan_x3);
    console.log("Model C4.5:", data.id_pelatihan_awal);
    console.log("Prioritas:", data.prioritas_awal);
    console.log("Status:", data.status_verifikasi);

    console.log("=====================================");
  } catch (error) {
    console.error("[SIPFAS KONFIRMASI]", error);

    tampilkanErrorKonfirmasi(
      error.message || "Informasi laporan gagal dimuat dari database.",
    );
  } finally {
    sedangMemuatKonfirmasi = false;
  }
}

// ============================================================
// 07. MENAMPILKAN PESAN ERROR
// ============================================================

function tampilkanErrorKonfirmasi(pesan) {
  const kartu = document.querySelector(".confirmation-card");

  if (!kartu) {
    console.error(pesan);
    return;
  }

  let elemen = document.getElementById("error-konfirmasi");

  if (!elemen) {
    elemen = document.createElement("p");
    elemen.id = "error-konfirmasi";

    elemen.style.color = "#dc2626";
    elemen.style.fontSize = "13px";

    kartu.appendChild(elemen);
  }

  elemen.textContent = pesan;
}

// ============================================================
// 08. NOTIFIKASI KEBERHASILAN
// ============================================================

function tampilkanNotifikasiKonfirmasi() {
  const dataNotifikasi = sessionStorage.getItem(FLASH_NOTIFICATION_KEY);

  if (!dataNotifikasi) return;

  try {
    const notifikasi = JSON.parse(dataNotifikasi);

    if (!notifikasi || !notifikasi.title || !notifikasi.message) {
      throw new Error("Format notifikasi tidak valid.");
    }

    let elemen = document.getElementById("sipfasNotification");

    if (!elemen) {
      elemen = document.createElement("div");
      elemen.id = "sipfasNotification";

      document.body.appendChild(elemen);
    }

    const jenis = ["success", "warning", "error"].includes(notifikasi.type)
      ? notifikasi.type
      : "success";

    elemen.className = "sipfas-notification " + jenis;

    elemen.setAttribute("role", "alert");
    elemen.setAttribute("aria-live", "polite");

    elemen.replaceChildren();

    const ikon = document.createElement("span");

    ikon.className = "notification-icon";

    ikon.textContent =
      jenis === "success" ? "✓" : jenis === "error" ? "×" : "!";

    const konten = document.createElement("div");

    konten.className = "notification-content";

    const judul = document.createElement("strong");

    judul.className = "notification-title";
    judul.textContent = notifikasi.title;

    const pesan = document.createElement("span");

    pesan.className = "notification-message";
    pesan.textContent = notifikasi.message;

    konten.appendChild(judul);
    konten.appendChild(pesan);

    const tombolTutup = document.createElement("button");

    tombolTutup.type = "button";
    tombolTutup.className = "notification-close";
    tombolTutup.textContent = "×";

    tombolTutup.setAttribute("aria-label", "Tutup notifikasi");

    tombolTutup.addEventListener("click", function () {
      elemen.classList.remove("show");
    });

    elemen.appendChild(ikon);
    elemen.appendChild(konten);
    elemen.appendChild(tombolTutup);

    sessionStorage.removeItem(FLASH_NOTIFICATION_KEY);

    requestAnimationFrame(function () {
      elemen.classList.add("show");
    });

    setTimeout(function () {
      elemen.classList.remove("show");
    }, 4000);
  } catch (error) {
    console.error("[SIPFAS] Gagal menampilkan notifikasi:", error);

    sessionStorage.removeItem(FLASH_NOTIFICATION_KEY);
  }
}
