/* =========================================================
   SIPFAS - ADMIN DASHBOARD
   File: Dashboard.js

   FITUR:
   1. Mengambil statistik dari database.
   2. Mengambil laporan kerusakan terbaru.
   3. Sinkronisasi nama dan foto profil Admin.
   4. Foto profil mengikuti data terbaru dari database.
   5. Filter status laporan.
   6. Pagination laporan.
   7. Modal detail laporan.
   8. Tombol refresh dashboard.
   9. Logout Admin.

   SINKRONISASI PROFIL:
   Menggunakan API:
   ../../api/shared/profil-login.php

   Foto profil diperbarui setelah data berhasil
   disimpan melalui halaman Profil Saya.
========================================================= */

(() => {
  "use strict";

  /* =======================================================
     01. KONFIGURASI API
  ======================================================= */

  const API = {
    dashboard: "../../api/admin/dashboard.php",
    profile: "../../api/shared/profil-login.php",
    logout: "../../api/auth/logout.php",
  };

  /* =======================================================
     02. STATE APLIKASI
  ======================================================= */

  const state = {
    reports: [],
    filteredReports: [],

    currentPage: 1,
    pageSize: 5,
    currentFilter: "semua",

    statistics: null,
    model: null,

    profile: null,

    isRefreshing: false,
  };

  /* =======================================================
     03. HELPER DOM
  ======================================================= */

  const $ = (selector, parent = document) => parent.querySelector(selector);

  const $$ = (selector, parent = document) => [
    ...parent.querySelectorAll(selector),
  ];

  /* =======================================================
     04. REQUEST API
  ======================================================= */

  async function requestJSON(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",

      headers: {
        Accept: "application/json",

        ...(options.body ? { "Content-Type": "application/json" } : {}),

        ...(options.headers || {}),
      },

      ...options,
    });

    let payload;

    try {
      payload = await response.json();
    } catch {
      throw new Error("Server tidak mengembalikan JSON yang valid.");
    }

    if (!response.ok || payload?.success === false) {
      throw new Error(
        payload?.message || `Permintaan gagal (${response.status}).`,
      );
    }

    return payload;
  }

  /* =======================================================
     05. HELPER KEAMANAN HTML
  ======================================================= */

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  }

  /* =======================================================
     06. HELPER MENGAMBIL NILAI
  ======================================================= */

  function firstValue(object, keys, fallback = "—") {
    for (const key of keys) {
      const value = object?.[key];

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }

    return fallback;
  }

  /* =======================================================
     07. NORMALISASI STATUS LAPORAN
  ======================================================= */

  function normalizeStatus(value) {
    const status = String(value ?? "")
      .trim()
      .toLowerCase();

    if (
      [
        "menunggu",
        "diajukan",
        "baru",
        "pending",
        "menunggu verifikasi",
      ].includes(status)
    ) {
      return "menunggu";
    }

    if (
      [
        "diproses",
        "proses",
        "dalam penanganan",
        "sedang dikerjakan",
        "in progress",
      ].includes(status)
    ) {
      return "diproses";
    }

    if (["selesai", "completed", "done"].includes(status)) {
      return "selesai";
    }

    return status || "menunggu";
  }

  /* =======================================================
     08. NORMALISASI PRIORITAS
  ======================================================= */

  function normalizePriority(value) {
    const priority = String(value ?? "")
      .trim()
      .toLowerCase();

    if (priority.includes("tinggi") || priority === "high") {
      return "Tinggi";
    }

    if (priority.includes("sedang") || priority === "medium") {
      return "Sedang";
    }

    if (priority.includes("rendah") || priority === "low") {
      return "Rendah";
    }

    return value ? String(value) : "Belum Dinilai";
  }

  /* =======================================================
     09. FORMAT TANGGAL
  ======================================================= */

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jayapura",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  /* =======================================================
     10. NORMALISASI DATA LAPORAN
  ======================================================= */

  function normalizeReport(row) {
    const statusSource = firstValue(
      row,
      ["status_laporan", "status_penanganan"],
      "Menunggu",
    );

    const handlingDone = Boolean(row.waktu_selesai_penanganan);

    let status = normalizeStatus(statusSource);

    if (handlingDone) {
      status = "selesai";
    } else if (row.waktu_mulai_penanganan && status === "menunggu") {
      status = "diproses";
    }

    return {
      id: firstValue(row, ["kode_laporan", "id_laporan"], "—"),

      idLaporan: row.id_laporan,

      facility: firstValue(row, ["nama_fasilitas"]),

      assetCode: firstValue(row, ["kode_fasilitas"]),

      location: firstValue(row, ["lokasi_ruangan"]),

      date: formatDate(
        firstValue(
          row,
          ["tanggal_dibuat", "tanggal_laporan", "waktu_lapor"],
          "",
        ),
      ),

      priority: normalizePriority(
        firstValue(row, ["prioritas_sesudah", "prioritas_sebelum"], ""),
      ),

      status,

      reporter: firstValue(row, ["nama_pelapor"]),

      reporterIdentity: firstValue(row, ["nomor_identitas"]),

      description: firstValue(row, [
        "deskripsi_kerusakan",
        "deskripsi",
        "keterangan",
      ]),

      verification: firstValue(row, ["hasil_verifikasi"]),

      verificationNote: firstValue(row, ["catatan_verifikasi"]),

      handlingNote: firstValue(row, [
        "tindak_lanjut_perbaikan",
        "catatan_petugas",
      ]),

      startedAt: firstValue(row, ["waktu_mulai_penanganan"], ""),

      completedAt: firstValue(row, ["waktu_selesai_penanganan"], ""),
    };
  }

  /* =======================================================
     11. PATH FOTO PROFIL
     
     PERBAIKAN PENTING:
     Foto disimpan di folder uploads/profil.
     Path harus mengarah ke root proyek SIPFAS.
  ======================================================= */

  function resolvePhotoURL(path) {
    if (!path) return "";

    const value = String(path).trim();

    if (!value) return "";

    // Jika berupa URL lengkap.
    if (/^(https?:|data:|blob:)/i.test(value)) {
      return value;
    }

    // Jika berupa path relatif dari root proyek.
    const cleanPath = value
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/^(\.\/)+/, "");

    const projectRoot = new URL("../../", window.location.href);

    return new URL(cleanPath, projectRoot).href;
  }

  /* =======================================================
     12. RENDER PROFIL ADMIN
     
     Mengambil nama dan foto terbaru dari database.
     Tidak menggunakan preview foto sementara.
  ======================================================= */

  function renderAdminProfile(user) {
    if (!user) return;

    state.profile = user;

    const name = user.nama_lengkap || user.nama_pengguna || "Administrator";

    const photo = resolvePhotoURL(user.foto_profil || "");

    // Sinkronisasi nama pada seluruh elemen header.
    $$(".topbar-user-name").forEach((element) => {
      element.textContent = name;
    });

    // Sinkronisasi avatar pada seluruh elemen header.
    $$(".topbar-user-avatar").forEach((avatar) => {
      let image = $(".admin-header-photo", avatar);

      const icon = $("svg", avatar);

      if (photo) {
        if (!image) {
          image = document.createElement("img");

          image.className = "admin-header-photo";

          image.alt = "Foto profil administrator";

          avatar.appendChild(image);
        }

        image.onerror = () => {
          console.warn("[SIPFAS] Foto profil tidak dapat ditampilkan:", photo);

          image.remove();

          if (icon) {
            icon.style.display = "";
          }
        };

        // Menghindari cache foto lama.
        image.src =
          photo + (photo.includes("?") ? "&" : "?") + "v=" + Date.now();

        image.style.width = "100%";
        image.style.height = "100%";
        image.style.display = "block";
        image.style.objectFit = "cover";
        image.style.objectPosition = "center";
        image.style.borderRadius = "50%";

        if (icon) {
          icon.style.display = "none";
        }
      } else {
        image?.remove();

        if (icon) {
          icon.style.display = "";
        }
      }
    });

    console.log("[SIPFAS] Profil Admin berhasil diperbarui:", name);
  }

  /* =======================================================
     13. LOAD PROFIL ADMIN
     
     Mengambil data terbaru dari database setiap kali
     Dashboard dibuka atau tombol Refresh ditekan.
  ======================================================= */

  async function loadAdminProfile() {
    try {
      const payload = await requestJSON(API.profile);

      // Mendukung beberapa bentuk respons API.
      const user = payload.user || payload.data?.user || payload.data || {};

      renderAdminProfile(user);

      return user;
    } catch (error) {
      console.warn("[SIPFAS] Profil Admin tidak dapat dimuat:", error.message);

      throw error;
    }
  }

  /* =======================================================
     14. RENDER KARTU STATISTIK
  ======================================================= */

  function renderSummary() {
    const cards = $$(".summary-card");

    const stats = state.statistics || {};

    const model = state.model || {};

    // KARTU 1: TOTAL FASILITAS
    if (cards[0]) {
      const number = $(".summary-number", cards[0]);

      if (number) {
        number.innerHTML = `${Number(stats.total_fasilitas || 0)} <small>Unit</small>`;
      }

      const meta = $(".summary-meta", cards[0]);

      if (meta) {
        meta.lastChild.textContent = ` Terbagi ${Number(stats.total_kategori || 0)} Kategori`;
      }

      const active = $(
        "strong",
        $(".summary-card-bottom", cards[0]) || cards[0],
      );

      if (active) {
        const total = Number(stats.total_fasilitas || 0);

        const percent = total
          ? Math.round((Number(stats.fasilitas_aktif || 0) / total) * 100)
          : 0;

        active.textContent = `${percent}% Aktif`;
      }
    }

    // KARTU 2: TOTAL PENGGUNA
    if (cards[1]) {
      const number = $(".summary-number", cards[1]);

      if (number) {
        number.innerHTML = `${Number(stats.total_pengguna || 0)} <small>Akun</small>`;
      }

      const tags = $$(".mini-tags span", cards[1]);

      const values = [
        `${Number(stats.total_admin || 0)} Admin`,
        `${Number(stats.total_petugas || 0)} Petugas`,
        `${Number(stats.total_pelapor || 0)} Pelapor`,
      ];

      tags.forEach((tag, index) => {
        if (values[index] !== undefined) {
          tag.textContent = values[index];
        }
      });
    }

    // KARTU 3: LAPORAN KERUSAKAN
    if (cards[2]) {
      const number = $(".summary-number", cards[2]);

      if (number) {
        number.innerHTML = `${Number(stats.total_laporan || 0)} <small>Total Kasus</small>`;
      }

      const counts = [
        stats.laporan_menunggu,
        stats.laporan_diproses,
        stats.laporan_selesai,
      ];

      $$(".report-stats strong", cards[2]).forEach((node, index) => {
        node.textContent = Number(counts[index] || 0);
      });
    }

    // KARTU 4: MODEL C4.5
    if (cards[3]) {
      const number = $(".summary-number", cards[3]);

      const accuracy = model.akurasi;

      if (number) {
        number.innerHTML = `${
          accuracy === null || accuracy === undefined
            ? "—"
            : `${Number(accuracy).toFixed(2)}%`
        } <small>Akurasi</small>`;
      }

      const bottom = $(".summary-card-bottom", cards[3]);

      if (bottom) {
        const spans = $$("span", bottom);

        if (spans.length > 1) {
          spans[1].textContent = `${Number(model.jumlah_data_uji || 0)} Data Uji`;
        }
      }
    }
  }

  /* =======================================================
     15. RENDER TABEL LAPORAN
  ======================================================= */

  function renderTable() {
    const tbody = $(".report-table tbody");

    if (!tbody) return;

    const totalPages = Math.max(
      1,
      Math.ceil(state.filteredReports.length / state.pageSize),
    );

    state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);

    const start = (state.currentPage - 1) * state.pageSize;

    const rows = state.filteredReports.slice(start, start + state.pageSize);

    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="dashboard-empty">
            Tidak ada laporan untuk ditampilkan.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = rows
        .map((report) => {
          const statusClass =
            report.status === "selesai"
              ? "pill-done"
              : report.status === "diproses"
                ? "pill-progress"
                : "pill-wait";

          const statusText =
            report.status === "selesai"
              ? "Selesai"
              : report.status === "diproses"
                ? "Diproses"
                : "Menunggu";

          const priorityClass =
            report.priority === "Tinggi"
              ? "badge-high"
              : report.priority === "Sedang"
                ? "badge-medium"
                : "badge-low-green";

          return `
          <tr>
            <td>
              <span class="report-id">
                ${escapeHTML(report.id)}
              </span>
            </td>

            <td>
              <strong>${escapeHTML(report.facility)}</strong>
              <small>Kode: ${escapeHTML(report.assetCode)}</small>
            </td>

            <td>${escapeHTML(report.location)}</td>

            <td>${escapeHTML(report.date)}</td>

            <td>
              <span class="badge ${priorityClass}">
                ● ${escapeHTML(report.priority)}
              </span>
            </td>

            <td>
              <span class="pill ${statusClass}">
                ${statusText}
              </span>
            </td>

            <td>
              <a
                href="#"
                class="eye-btn"
                data-report-id="${escapeHTML(report.idLaporan)}"
                aria-label="Lihat detail"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M2.5 12C4.4 8.9 7.7 7 12 7C16.3 7 19.6 8.9 21.5 12C19.6 15.1 16.3 17 12 17C7.7 17 4.4 15.1 2.5 12Z"/>
                  <circle cx="12" cy="12" r="2.5"/>
                </svg>
              </a>
            </td>
          </tr>
        `;
        })
        .join("");
    }

    renderPagination(totalPages);
  }

  /* =======================================================
     16. PAGINATION
  ======================================================= */

  function renderPagination(totalPages) {
    const pagination = $(".pagination");

    if (!pagination) return;

    let html = `
      <button
        type="button"
        data-page="prev"
        aria-label="Sebelumnya"
        ${state.currentPage === 1 ? "disabled" : ""}
      >‹</button>
    `;

    for (let page = 1; page <= totalPages; page++) {
      html += `
        <button
          type="button"
          data-page="${page}"
          class="${page === state.currentPage ? "active" : ""}"
          ${page === state.currentPage ? 'aria-current="page"' : ""}
        >${page}</button>
      `;
    }

    html += `
      <button
        type="button"
        data-page="next"
        aria-label="Selanjutnya"
        ${state.currentPage === totalPages ? "disabled" : ""}
      >›</button>
    `;

    pagination.innerHTML = html;
  }

  /* =======================================================
     17. FILTER LAPORAN
  ======================================================= */

  function applyFilter() {
    state.filteredReports =
      state.currentFilter === "semua"
        ? [...state.reports]
        : state.reports.filter(
            (report) => report.status === state.currentFilter,
          );

    state.currentPage = 1;

    renderTable();
  }

  /* =======================================================
     18. MODAL DETAIL LAPORAN
  ======================================================= */

  function createModal() {
    if ($(".dashboard-modal")) return;

    const modal = document.createElement("div");

    modal.className = "dashboard-modal";

    modal.innerHTML = `
      <div class="dashboard-modal-backdrop"></div>

      <div class="dashboard-modal-box">

        <div class="dashboard-modal-header">
          <h2>Detail Laporan</h2>

          <button
            type="button"
            class="dashboard-modal-close"
          >&times;</button>
        </div>

        <div class="dashboard-modal-body"></div>

      </div>
    `;

    document.body.appendChild(modal);
  }

  /* =======================================================
     19. BUKA DETAIL LAPORAN
  ======================================================= */

  function openDetail(report) {
    createModal();

    const modal = $(".dashboard-modal");

    const body = $(".dashboard-modal-body", modal);

    const items = [
      ["ID Laporan", report.id],
      ["Nama Fasilitas", report.facility],
      ["Kode Fasilitas", report.assetCode],
      ["Lokasi", report.location],
      ["Tanggal Diajukan", report.date],
      ["Rekomendasi C4.5", report.priority],
      ["Status Penanganan", report.status],
      ["Nama Pelapor", report.reporter],
      ["Nomor Identitas", report.reporterIdentity],
      ["Hasil Verifikasi", report.verification],
      ["Catatan Verifikasi", report.verificationNote],
      ["Tindak Lanjut", report.handlingNote],
    ];

    body.innerHTML =
      items
        .map(
          ([label, value]) => `
      <div class="dashboard-detail-item">
        <span>${escapeHTML(label)}</span>
        <strong>${escapeHTML(value)}</strong>
      </div>
    `,
        )
        .join("") +
      `
      <div class="dashboard-detail-description">
        <strong>Deskripsi Laporan</strong>
        <p>${escapeHTML(report.description)}</p>
      </div>
    `;

    modal.classList.add("show");

    document.body.style.overflow = "hidden";
  }

  /* =======================================================
     20. TUTUP MODAL
  ======================================================= */

  function closeModal() {
    $(".dashboard-modal")?.classList.remove("show");

    document.body.style.overflow = "";
  }

  /* =======================================================
     21. LOAD DASHBOARD DARI DATABASE
  ======================================================= */

  async function loadDashboard() {
    const payload = await requestJSON(API.dashboard);

    const data = payload.data || {};

    state.statistics = data.statistics || {};

    state.model = data.model || null;

    state.reports = (data.latest_reports || []).map(normalizeReport);

    renderSummary();

    applyFilter();
  }

  /* =======================================================
     22. LOGOUT ADMIN
  ======================================================= */

  async function logout() {
    const confirmed = window.confirm(
      "Apakah Anda yakin ingin keluar dari SIPFAS?",
    );

    if (!confirmed) return;

    try {
      const payload = await requestJSON(API.logout, {
        method: "POST",
      });

      window.location.replace(
        payload.data?.redirect || "../../auth/login.html",
      );
    } catch (error) {
      alert(error.message || "Gagal keluar. Silakan coba kembali.");
    }
  }

  /* =======================================================
     23. REFRESH DASHBOARD DAN PROFIL
     
     Mengambil ulang:
     - Statistik dashboard.
     - Laporan terbaru.
     - Nama administrator.
     - Foto profil administrator.
  ======================================================= */

  async function refreshDashboard(button) {
    if (state.isRefreshing) return;

    state.isRefreshing = true;

    const label = $("span", button);

    const original = label?.textContent || "Segarkan Data";

    if (label) {
      label.textContent = "Memuat...";
    }

    button.disabled = true;

    try {
      // Memuat dashboard dan profil secara bersamaan.
      await Promise.all([loadDashboard(), loadAdminProfile()]);

      if (label) {
        label.textContent = "Data Diperbarui";
      }
    } catch (error) {
      console.error("[SIPFAS] Refresh gagal:", error);

      if (label) {
        label.textContent = "Gagal Memuat";
      }

      alert(error.message || "Gagal memperbarui dashboard.");
    } finally {
      button.disabled = false;

      state.isRefreshing = false;

      window.setTimeout(() => {
        if (label) {
          label.textContent = original;
        }
      }, 1500);
    }
  }

  /* =======================================================
     24. EVENT LISTENER
  ======================================================= */

  function bindEvents() {
    // FILTER STATUS LAPORAN.
    $("#statusFilter")?.addEventListener("change", (event) => {
      const value = event.target.value;

      state.currentFilter =
        value === "Semua" || value === "semua"
          ? "semua"
          : normalizeStatus(value);

      applyFilter();
    });

    // PAGINATION.
    $(".pagination")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-page]");

      if (!button || button.disabled) return;

      const totalPages = Math.max(
        1,
        Math.ceil(state.filteredReports.length / state.pageSize),
      );

      if (button.dataset.page === "prev") {
        state.currentPage--;
      } else if (button.dataset.page === "next") {
        state.currentPage++;
      } else {
        state.currentPage = Number(button.dataset.page);
      }

      state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);

      renderTable();
    });

    // DETAIL LAPORAN.
    $(".report-table tbody")?.addEventListener("click", (event) => {
      const button = event.target.closest(".eye-btn");

      if (!button) return;

      event.preventDefault();

      const report = state.reports.find(
        (item) => String(item.idLaporan) === String(button.dataset.reportId),
      );

      if (report) {
        openDetail(report);
      }
    });

    // TUTUP MODAL.
    document.addEventListener("click", (event) => {
      if (
        event.target.closest(".dashboard-modal-close") ||
        event.target.classList.contains("dashboard-modal-backdrop")
      ) {
        closeModal();
      }
    });

    // TUTUP MODAL DENGAN ESCAPE.
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    });

    // TOMBOL SEGARKAN DATA.
    $(".refresh-btn")?.addEventListener("click", function () {
      refreshDashboard(this);
    });

    // LOGOUT.
    $$(".sidebar-bottom .nav-link").forEach((link) => {
      if (link.textContent.trim().toLowerCase().includes("keluar")) {
        link.addEventListener("click", (event) => {
          event.preventDefault();

          logout();
        });
      }
    });

    // SINKRONISASI JIKA ADA PEMBARUAN PROFIL
    // PADA HALAMAN YANG SAMA.
    window.addEventListener("sipfas:admin-profile-updated", async () => {
      try {
        await loadAdminProfile();
      } catch (error) {
        console.warn("[SIPFAS] Sinkronisasi profil gagal:", error.message);
      }
    });

    // SINKRONISASI KETIKA KEMBALI KE DASHBOARD.
    window.addEventListener("pageshow", async () => {
      try {
        await loadAdminProfile();
      } catch (error) {
        console.warn("[SIPFAS] Gagal memuat ulang profil:", error.message);
      }
    });
  }

  /* =======================================================
     25. CSS MODAL
  ======================================================= */

  function addModalCSS() {
    if ($("#dashboard-modal-style")) return;

    const style = document.createElement("style");

    style.id = "dashboard-modal-style";

    style.textContent = `
      .dashboard-modal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .dashboard-modal.show {
        display: flex;
      }

      .dashboard-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,.5);
      }

      .dashboard-modal-box {
        position: relative;
        width: min(500px,100%);
        max-height: 85vh;
        overflow-y: auto;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 15px 40px rgba(0,0,0,.2);
      }

      .dashboard-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 22px;
        border-bottom: 1px solid #edf0f4;
      }

      .dashboard-modal-header h2 {
        font-size: 16px;
        color: #203f65;
      }

      .dashboard-modal-close {
        border: 0;
        background: transparent;
        font-size: 25px;
        cursor: pointer;
        color: #68717c;
      }

      .dashboard-modal-body {
        padding: 20px 22px;
      }

      .dashboard-detail-item {
        display: grid;
        grid-template-columns: 140px 1fr;
        gap: 12px;
        padding: 9px 0;
        border-bottom: 1px solid #f0f2f5;
        font-size: 12px;
      }

      .dashboard-detail-item span {
        color: #68717c;
      }

      .dashboard-detail-item strong {
        color: #20262d;
        overflow-wrap: anywhere;
      }

      .dashboard-detail-description {
        margin-top: 18px;
        padding: 14px;
        border-radius: 8px;
        background: #f4f7fb;
        font-size: 12px;
      }

      .dashboard-detail-description p {
        margin-top: 7px;
        line-height: 1.7;
      }

      .dashboard-empty {
        text-align: center;
        padding: 25px !important;
        color: #68717c;
      }

      .pagination button:disabled {
        opacity: .35;
        cursor: not-allowed;
      }

      .topbar-user-avatar {
        position: relative;
        overflow: hidden;
        flex-shrink: 0;
      }

      .topbar-user-avatar .admin-header-photo {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        border-radius: 50%;
      }

      @media(max-width:500px) {
        .dashboard-detail-item {
          grid-template-columns: 1fr;
          gap: 3px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =======================================================
     26. INISIALISASI DASHBOARD
  ======================================================= */

  async function init() {
    if (!$(".app-layout")) return;

    addModalCSS();

    bindEvents();

    try {
      // Dashboard dan profil dimuat bersamaan.
      await Promise.all([loadDashboard(), loadAdminProfile()]);

      console.log("[SIPFAS] Dashboard Admin berhasil dimuat.");
    } catch (error) {
      console.error("[SIPFAS] Gagal memuat dashboard:", error);

      const tbody = $(".report-table tbody");

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="dashboard-empty">
              ${escapeHTML(error.message)}
            </td>
          </tr>
        `;
      }

      alert(`Dashboard gagal dimuat: ${error.message}`);
    }
  }

  /* =======================================================
     27. JALANKAN APLIKASI
  ======================================================= */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
