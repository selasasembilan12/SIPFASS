"use strict";

const API_DASHBOARD = "../../../api/user/dashboard.php";
const PROFILE_KEY = "sipfasProfile";

document.addEventListener("DOMContentLoaded", function () {
  initializeDashboard();

  window.addEventListener("pageshow", function () {
    muatDashboard();
  });

  window.addEventListener("storage", function (event) {
    if (event.key === PROFILE_KEY || event.key === null) {
      updateDashboardProfile();
    }
  });
});

/* ============================================================
   01. INISIALISASI
============================================================ */

function initializeDashboard() {
  updateDashboardProfile();
  muatDashboard();

  // Refresh berkala agar status terbaru ikut tampil.
  setInterval(muatDashboard, 30000);
}

/* ============================================================
   02. MENGAMBIL DATA DASHBOARD DARI DATABASE
============================================================ */

async function muatDashboard() {
  try {
    const response = await fetch(API_DASHBOARD + "?_=" + Date.now(), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok || result.success !== true) {
      throw new Error(result.message || "Gagal memuat Dashboard.");
    }

    const data = result.data || {};

    tampilkanProfilDashboard(data.profil || {});
    tampilkanStatistikDashboard(data.ringkasan || {});
    tampilkanLaporanTerbaru(data.laporan_terbaru || []);
  } catch (error) {
    console.error("[SIPFAS DASHBOARD]", error);

    const heading = document.querySelector(".section-heading p");

    if (heading) {
      heading.textContent = "Data Dashboard belum dapat dimuat dari server.";
    }
  }
}

/* ============================================================
   03. PROFIL
============================================================ */

function tampilkanProfilDashboard(profil) {
  if (profil.nama_lengkap) {
    document.querySelectorAll(".header-name").forEach((element) => {
      element.textContent = profil.nama_lengkap;
    });

    const welcome = document.querySelector(".welcome-name");

    if (welcome) {
      welcome.textContent = "Selamat Datang, " + profil.nama_lengkap;
    }
  }

  if (profil.foto_profil) {
    const avatar = document.querySelector(".header-avatar");

    if (avatar) {
      const foto = /^(https?:|data:|blob:)/i.test(profil.foto_profil)
        ? profil.foto_profil
        : "../../../" + profil.foto_profil.replace(/^\/+/, "");

      avatar.style.backgroundImage = `url("${foto}")`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";

      const icon = avatar.querySelector("svg");

      if (icon) icon.style.display = "none";
    }
  }
}

/* ============================================================
   04. STATISTIK
============================================================ */

function tampilkanStatistikDashboard(data) {
  setText(".total-number", data.total_laporan ?? 0);
  setText(".waiting-number", data.menunggu ?? 0);
  setText(".process-number", data.diproses ?? 0);
  setText(".completed-number", data.selesai ?? 0);

  updateActivityDescription(Number(data.total_laporan || 0));
}

function setText(selector, value) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = String(value);
  }
}

/* ============================================================
   05. LAPORAN TERBARU
============================================================ */

function tampilkanLaporanTerbaru(data) {
  const tbody = document.querySelector(".report-table tbody");

  if (!tbody) return;

  tbody.replaceChildren();

  if (!Array.isArray(data) || data.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 4;
    cell.textContent = "Belum ada laporan yang dikirim.";
    cell.style.textAlign = "center";

    row.appendChild(cell);
    tbody.appendChild(row);

    return;
  }

  data.forEach((laporan) => {
    const row = document.createElement("tr");

    const facilityCell = document.createElement("td");
    const dateCell = document.createElement("td");
    const statusCell = document.createElement("td");
    const actionCell = document.createElement("td");

    const facility = document.createElement("div");
    facility.className = "facility-name";
    facility.textContent = laporan.nama_fasilitas || "-";

    const code = document.createElement("small");
    code.textContent = laporan.kode_laporan || "";

    facilityCell.appendChild(facility);
    facilityCell.appendChild(code);

    dateCell.textContent = formatTanggal(laporan.tanggal_dibuat);

    statusCell.appendChild(createDashboardStatusBadge(tentukanStatus(laporan)));

    const link = document.createElement("a");

    link.className = "detail-link";
    link.textContent = "Detail";
    link.href =
      "../Detail-laporan/Detail-laporan.html?id=" +
      encodeURIComponent(laporan.id_laporan);

    actionCell.appendChild(link);

    row.appendChild(facilityCell);
    row.appendChild(dateCell);
    row.appendChild(statusCell);
    row.appendChild(actionCell);

    tbody.appendChild(row);
  });
}

/* ============================================================
   06. MENENTUKAN STATUS UTAMA
============================================================ */

function tentukanStatus(laporan) {
  const verifikasi = String(laporan.status_verifikasi || "").toLowerCase();
  const penanganan = String(laporan.status_penanganan || "").toLowerCase();

  if (verifikasi.includes("tolak") || verifikasi.includes("tidak valid")) {
    return "invalid";
  }

  if (penanganan.includes("selesai")) {
    return "completed";
  }

  if (
    penanganan.includes("proses") ||
    penanganan.includes("ditangani") ||
    verifikasi.includes("proses") ||
    verifikasi.includes("diverifikasi") ||
    verifikasi.includes("diterima")
  ) {
    return "processing";
  }

  return "waiting";
}

/* ============================================================
   07. BADGE STATUS
============================================================ */

function createDashboardStatusBadge(status) {
  const badge = document.createElement("span");
  badge.className = "status-badge";

  const konfigurasi = {
    waiting: ["status-waiting", "Menunggu"],
    processing: ["status-processing", "Diproses"],
    completed: ["status-completed", "Selesai"],
    invalid: ["status-invalid", "Tidak Valid"],
  };

  const config = konfigurasi[status] || konfigurasi.waiting;

  badge.classList.add(config[0]);

  if (status === "waiting" || status === "processing") {
    const dot = document.createElement("span");
    dot.className = "status-dot";
    badge.appendChild(dot);
  }

  if (status === "invalid") {
    const icon = document.createElement("span");
    icon.className = "invalid-icon";
    icon.textContent = "⊗";
    badge.appendChild(icon);
  }

  badge.appendChild(document.createTextNode(config[1]));

  return badge;
}

/* ============================================================
   08. TANGGAL
============================================================ */

function formatTanggal(value) {
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

/* ============================================================
   09. KETERANGAN AKTIVITAS
============================================================ */

function updateActivityDescription(total) {
  const description = document.querySelector(".section-heading p");

  if (!description) return;

  if (total === 0) {
    description.textContent = "Belum ada aktivitas permohonan sarana Anda.";
  } else {
    description.textContent =
      "Menampilkan " +
      Math.min(total, 5) +
      " dari " +
      total +
      " laporan terbaru Anda.";
  }
}

/* ============================================================
   10. SINKRONISASI PROFIL LOKAL
============================================================ */

function updateDashboardProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);

    if (!raw) return;

    const profile = JSON.parse(raw);

    if (profile && profile.name) {
      document.querySelectorAll(".header-name").forEach((element) => {
        element.textContent = profile.name;
      });

      const welcome = document.querySelector(".welcome-name");

      if (welcome) {
        welcome.textContent = "Selamat Datang, " + profile.name;
      }
    }
  } catch (error) {
    console.error("Gagal membaca profil:", error);
  }
}
