(() => {
  "use strict";

  // =====================================================
  // 01. KONFIGURASI
  // =====================================================

  const API_URL = "../../api/admin/laporan-pemeliharaan.php";

  const PAGE_SIZE = 5;

  const state = {
    reports: [],
    currentPage: 1,
    totalPages: 1,
    total: 0,
    statistics: {
      total: 0,
      menunggu: 0,
      diproses: 0,
      selesai: 0,
    },
    selectedReport: null,
    search: "",
    statusVerifikasi: "",
    statusPenanganan: "",
    loading: false,
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);

  const $$ = (selector, parent = document) => [
    ...parent.querySelectorAll(selector),
  ];

  // =====================================================
  // 02. UTILITAS
  // =====================================================

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[char],
    );
  }

  function normalize(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function getPriorityClass(priority) {
    const value = normalize(priority);

    if (value === "tinggi") {
      return "priority-high";
    }

    if (value === "sedang") {
      return "priority-medium";
    }

    if (value === "rendah") {
      return "priority-low";
    }

    return "pending";
  }

  function getVerificationClass(status) {
    const value = normalize(status);

    if (value.includes("tidak valid") || value.includes("ditolak")) {
      return "verification-error";
    }

    if (value.includes("terverifikasi") || value === "valid") {
      return "verified";
    }

    if (value.includes("menunggu")) {
      return "waiting";
    }

    return "waiting";
  }

  function getHandlingClass(status) {
    const value = normalize(status);

    if (value.includes("selesai")) {
      return "completed";
    }

    if (
      value.includes("proses") ||
      value.includes("perbaikan") ||
      value.includes("ditangani")
    ) {
      return "processing";
    }

    if (value.includes("ditolak") || value.includes("tidak valid")) {
      return "rejected";
    }

    return "pending";
  }

  function showError(message) {
    console.error("[SIPFAS LAPORAN]", message);
  }

  // =====================================================
  // 03. REQUEST API
  // =====================================================

  async function requestAPI(params = {}) {
    const url = new URL(API_URL, window.location.href);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    let response;

    try {
      response = await fetch(url.toString(), {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      throw new Error(
        "Tidak dapat menghubungi server. Periksa Apache dan koneksi database XAMPP.",
      );
    }

    const raw = await response.text();

    let result;

    try {
      result = JSON.parse(raw);
    } catch (error) {
      console.error("[SIPFAS] Respons API bukan JSON:", raw);

      throw new Error("Respons server tidak valid. Periksa file PHP.");
    }

    if (!response.ok || result.success !== true) {
      throw new Error(
        result.message || `Gagal mengambil laporan. HTTP ${response.status}.`,
      );
    }

    return result.data || {};
  }

  // =====================================================
  // 04. MEMUAT LAPORAN DARI DATABASE
  // =====================================================

  async function loadReports() {
    if (state.loading) return;

    state.loading = true;

    const tbody = $(".report-table tbody");

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:25px">
            Memuat laporan dari database...
          </td>
        </tr>
      `;
    }

    try {
      const data = await requestAPI({
        page: state.currentPage,
        limit: PAGE_SIZE,
        search: state.search,
        status_verifikasi: state.statusVerifikasi,
        status_penanganan: state.statusPenanganan,
      });

      state.reports = Array.isArray(data.items) ? data.items : [];

      const pagination = data.pagination || {};

      state.currentPage = Number(pagination.page || 1);

      state.totalPages = Math.max(1, Number(pagination.total_pages || 1));

      state.total = Number(pagination.total || 0);

      state.statistics = data.statistics || {
        total: 0,
        menunggu: 0,
        diproses: 0,
        selesai: 0,
      };

      renderTable();
      renderStatistics();
      renderPagination();
      updateArchiveCount();
    } catch (error) {
      showError(error);

      state.reports = [];

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align:center;padding:25px">
              ${escapeHTML(error.message)}
              <br>
              <button
                type="button"
                class="retry-report-load"
                style="margin-top:10px"
              >
                Coba Lagi
              </button>
            </td>
          </tr>
        `;
      }

      updateStatistics();
      updateArchiveCount();
    } finally {
      state.loading = false;
    }
  }

  // =====================================================
  // 05. MENAMPILKAN TABEL LAPORAN
  // =====================================================

  function renderTable() {
    const tbody = $(".report-table tbody");

    if (!tbody) return;

    if (state.reports.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:25px">
            Belum ada laporan pemeliharaan dari User.
          </td>
        </tr>
      `;
      return;
    }

    const start = (state.currentPage - 1) * PAGE_SIZE;

    tbody.innerHTML = state.reports
      .map((item, index) => {
        const priority = item.prioritas_rekomendasi || "-";

        const verification = item.status_verifikasi || "Menunggu";

        const handling = item.status_penanganan || "Menunggu";

        return `
        <tr data-id="${Number(item.id_laporan)}">

          <td class="center">
            ${start + index + 1}
          </td>

          <td>
            <a
              href="#"
              class="report-id"
              data-id="${Number(item.id_laporan)}"
            >
              ${escapeHTML(item.kode_laporan)}
            </a>
          </td>

          <td>
            ${escapeHTML(formatDate(item.tanggal_dibuat))}
          </td>

          <td>
            <strong>
              ${escapeHTML(item.nama_fasilitas || "-")}
            </strong>

            <small>
              ${escapeHTML(item.kode_fasilitas || "-")}
            </small>
          </td>

          <td>
            <span class="location-badge">
              ${escapeHTML(item.nama_lokasi || "-")}
            </span>
          </td>

          <td>
            <span class="status-pill ${getPriorityClass(priority)}">
              <i></i>
              ${escapeHTML(priority === "-" ? "Belum tersedia" : priority)}
            </span>
          </td>

          <td>
            <span class="status-pill ${getVerificationClass(verification)}">
              <i></i>
              ${escapeHTML(verification)}
            </span>
          </td>

          <td>
            <span class="status-pill ${getHandlingClass(handling)}">
              <i></i>
              ${escapeHTML(handling)}
            </span>
          </td>

          <td class="center">
            <a
              href="#"
              class="action-btn view-report-btn"
              data-id="${Number(item.id_laporan)}"
              aria-label="Lihat laporan"
              title="Lihat detail laporan"
            >
              <svg viewBox="0 0 24 24">
                <path
                  d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                />
                <circle cx="12" cy="12" r="2.5"/>
              </svg>
            </a>
          </td>

        </tr>
      `;
      })
      .join("");
  }

  // =====================================================
  // 06. STATISTIK DARI DATABASE
  // =====================================================

  function renderStatistics() {
    const cards = $$(".stats-grid .stat-card");

    if (cards.length < 4) return;

    const total = Number(state.statistics.total || 0);

    const waiting = Number(state.statistics.menunggu || 0);

    const processing = Number(state.statistics.diproses || 0);

    const completed = Number(state.statistics.selesai || 0);

    const values = [
      {
        count: total,
        note: `${total} laporan tersedia`,
      },
      {
        count: waiting,
        note: `${total ? ((waiting / total) * 100).toFixed(1) : "0.0"}% Menunggu Sarpras`,
      },
      {
        count: processing,
        note: `${total ? ((processing / total) * 100).toFixed(1) : "0.0"}% Tindakan Aktif`,
      },
      {
        count: completed,
        note: `${total ? ((completed / total) * 100).toFixed(1) : "0.0"}% Selesai`,
      },
    ];

    values.forEach((item, index) => {
      const card = cards[index];

      const number = $(".stat-value", card);

      const note = $(".stat-note", card);

      const progress = $(".progress-fill", card);

      if (number) {
        number.textContent = item.count;
      }

      if (note) {
        note.textContent = item.note;
      }

      if (progress) {
        const percent = total > 0 ? (item.count / total) * 100 : 0;

        progress.style.width = `${Math.min(100, percent)}%`;
      }
    });
  }

  function updateStatistics() {
    state.statistics = {
      total: 0,
      menunggu: 0,
      diproses: 0,
      selesai: 0,
    };

    renderStatistics();
  }

  // =====================================================
  // 07. PAGINATION DATABASE
  // =====================================================

  function renderPagination() {
    const pagination = $(".pagination");

    if (!pagination) return;

    const current = state.currentPage;

    const total = state.totalPages;

    let pages = [];

    if (total <= 7) {
      pages = Array.from({ length: total }, (_, index) => index + 1);
    } else {
      pages = [...new Set([1, current - 1, current, current + 1, total])]
        .filter((page) => page >= 1 && page <= total)
        .sort((a, b) => a - b);
    }

    let html = `
      <a
        href="#"
        class="page-btn ${current <= 1 ? "disabled" : ""}"
        data-page="prev"
        aria-label="Sebelumnya"
      >
        ‹
      </a>
    `;

    let previous = 0;

    pages.forEach((page) => {
      if (previous && page - previous > 1) {
        html += `<span class="page-dots">...</span>`;
      }

      html += `
        <a
          href="#"
          class="page-btn ${page === current ? "active" : ""}"
          data-page="${page}"
        >
          ${page}
        </a>
      `;

      previous = page;
    });

    html += `
      <a
        href="#"
        class="page-btn ${current >= total ? "disabled" : ""}"
        data-page="next"
        aria-label="Selanjutnya"
      >
        ›
      </a>
    `;

    pagination.innerHTML = html;
  }

  async function changePage(value) {
    let nextPage = state.currentPage;

    if (value === "prev") {
      nextPage--;
    } else if (value === "next") {
      nextPage++;
    } else {
      nextPage = Number(value);
    }

    if (
      nextPage < 1 ||
      nextPage > state.totalPages ||
      nextPage === state.currentPage
    ) {
      return;
    }

    state.currentPage = nextPage;

    await loadReports();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // =====================================================
  // 08. JUMLAH ARSIP
  // =====================================================

  function updateArchiveCount() {
    const badge = $(".archive-badge");

    if (badge) {
      badge.textContent = `${state.total} Arsip Ditemukan`;
    }
  }

  // =====================================================
  // 09. MODAL DETAIL LAPORAN
  // =====================================================

  function createModal() {
    if ($("#report-detail-modal")) return;

    const modal = document.createElement("div");

    modal.id = "report-detail-modal";

    modal.innerHTML = `
      <div class="report-modal-backdrop"></div>

      <div class="report-modal-card">

        <div class="report-modal-header">

          <div>
            <small>DETAIL LAPORAN PEMELIHARAAN</small>
            <h2 id="report-modal-title">Detail Laporan</h2>
          </div>

          <button
            type="button"
            class="report-modal-close"
            aria-label="Tutup"
          >
            &times;
          </button>

        </div>

        <div
          class="report-modal-body"
          id="report-modal-content"
        ></div>

        <div class="report-modal-footer">
          <button type="button" class="report-close-btn">
            Tutup
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
  }

  function addModalCSS() {
    if ($("#report-modal-style")) return;

    const style = document.createElement("style");

    style.id = "report-modal-style";

    style.textContent = `
      #report-detail-modal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      #report-detail-modal.show {
        display: flex;
      }

      .report-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, .58);
      }

      .report-modal-card {
        position: relative;
        width: min(680px, 100%);
        max-height: 90vh;
        overflow-y: auto;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 15px 45px rgba(0,0,0,.2);
      }

      .report-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid #e9edf2;
      }

      .report-modal-header small {
        color: #718096;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .8px;
      }

      .report-modal-header h2 {
        margin: 6px 0 0;
        color: #203f65;
        font-size: 19px;
      }

      .report-modal-close {
        background: transparent;
        color: #68717c;
        font-size: 28px;
      }

      .report-modal-body {
        padding: 22px 24px;
      }

      .report-detail-section {
        margin-bottom: 23px;
      }

      .report-detail-section h3 {
        margin: 0 0 14px;
        color: #203f65;
        font-size: 14px;
      }

      .report-detail-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .report-detail-item {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px;
        background: #f7f9fc;
        border-radius: 7px;
        min-width: 0;
      }

      .report-detail-item.full {
        grid-column: 1 / -1;
      }

      .report-detail-item span {
        color: #718096;
        font-size: 11px;
      }

      .report-detail-item strong {
        color: #25364a;
        font-size: 12px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }

      .report-detail-disclaimer {
        padding: 12px;
        background: #f3f6fb;
        color: #53657b;
        border-radius: 7px;
        font-size: 11px;
        line-height: 1.6;
      }

      .report-modal-footer {
        display: flex;
        justify-content: flex-end;
        padding: 15px 24px;
        border-top: 1px solid #e9edf2;
      }

      .report-close-btn {
        padding: 10px 20px;
        border-radius: 7px;
        background: #244d7b;
        color: white;
        font-size: 12px;
      }

      .report-close-btn:hover {
        background: #183b62;
      }

      @media(max-width: 550px) {
        .report-detail-grid {
          grid-template-columns: 1fr;
        }

        .report-detail-item.full {
          grid-column: auto;
        }

        .report-modal-body {
          padding: 17px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function detailItem(label, value, full = false) {
    return `
      <div class="report-detail-item ${full ? "full" : ""}">
        <span>${escapeHTML(label)}</span>
        <strong>${escapeHTML(value || "-")}</strong>
      </div>
    `;
  }

  function openReportDetail(id) {
    const item = state.reports.find(
      (report) => Number(report.id_laporan) === Number(id),
    );

    if (!item) {
      alert("Data laporan tidak ditemukan.");
      return;
    }

    state.selectedReport = item;

    createModal();

    $("#report-modal-title").textContent =
      item.kode_laporan || "Detail Laporan";

    const priority = item.prioritas_rekomendasi || "-";

    $("#report-modal-content").innerHTML = `
      <div class="report-detail-section">
        <h3>Informasi Laporan</h3>

        <div class="report-detail-grid">
          ${detailItem("Kode Laporan", item.kode_laporan)}
          ${detailItem("Tanggal Masuk", formatDate(item.tanggal_dibuat))}
          ${detailItem("Nama Pelapor", item.nama_pelapor)}
          ${detailItem("Nomor Identitas", item.nomor_identitas)}
          ${detailItem("Nama Fasilitas", item.nama_fasilitas)}
          ${detailItem("Kode Inventaris", item.kode_fasilitas)}
          ${detailItem("Lokasi Ruangan", item.nama_lokasi, true)}
          ${detailItem("Deskripsi Kerusakan", item.deskripsi_kerusakan, true)}
        </div>
      </div>

      <div class="report-detail-section">
        <h3>Atribut Laporan</h3>

        <div class="report-detail-grid">
          ${detailItem("X1 - Tingkat Kerusakan", item.tingkat_kerusakan_x1)}
          ${detailItem("X2 - Dampak Akademik", item.dampak_akademik_x2)}
          ${detailItem("X3 - Frekuensi Penggunaan", item.frekuensi_penggunaan_x3)}
          ${detailItem("Prioritas Rekomendasi C4.5", priority)}
        </div>
      </div>

      <div class="report-detail-section">
        <h3>Status Verifikasi dan Penanganan</h3>

        <div class="report-detail-grid">
          ${detailItem("Status Verifikasi", item.status_verifikasi)}
          ${detailItem("Status Penanganan", item.status_penanganan)}
          ${detailItem("Nama Verifikator", item.nama_verifikator)}
          ${detailItem("Waktu Verifikasi", formatDate(item.waktu_verifikasi))}
          ${detailItem("Catatan Verifikasi", item.catatan_verifikasi, true)}
          ${detailItem("Nama Petugas Penanggung Jawab", item.nama_petugas)}
          ${detailItem("Tindak Lanjut Perbaikan", item.tindak_lanjut_perbaikan, true)}
          ${detailItem("Catatan Petugas", item.catatan_petugas, true)}
          ${detailItem("Waktu Mulai Penanganan", formatDate(item.waktu_mulai_penanganan))}
          ${detailItem("Waktu Selesai Penanganan", formatDate(item.waktu_selesai_penanganan))}
        </div>
      </div>

      <div class="report-detail-disclaimer">
        Halaman ini digunakan Administrator untuk memantau laporan.
        Verifikasi dan pembaruan penanganan tetap dilakukan oleh Petugas.
        Rekomendasi C4.5 ditampilkan berdasarkan hasil klasifikasi
        yang tersimpan pada database.
      </div>
    `;

    addModalCSS();

    $("#report-detail-modal").classList.add("show");

    document.body.style.overflow = "hidden";
  }

  function closeReportDetail() {
    $("#report-detail-modal")?.classList.remove("show");

    document.body.style.overflow = "";

    state.selectedReport = null;
  }

  // =====================================================
  // 10. EVENT LISTENER
  // =====================================================

  function bindEvents() {
    const tbody = $(".report-table tbody");

    // DETAIL LAPORAN

    tbody?.addEventListener("click", (event) => {
      const button = event.target.closest(".view-report-btn, .report-id");

      if (button) {
        event.preventDefault();

        openReportDetail(button.dataset.id);

        return;
      }

      if (event.target.closest(".retry-report-load")) {
        loadReports();
      }
    });

    // PAGINATION

    $(".pagination")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-page]");

      if (!button) return;

      event.preventDefault();

      if (button.classList.contains("disabled")) return;

      changePage(button.dataset.page);
    });

    // MENUTUP MODAL

    document.addEventListener("click", (event) => {
      if (
        event.target.closest(".report-modal-close") ||
        event.target.closest(".report-close-btn") ||
        event.target.classList.contains("report-modal-backdrop")
      ) {
        closeReportDetail();
      }
    });

    // TOMBOL ESCAPE

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeReportDetail();
      }
    });

    // PENCARIAN JIKA INPUT TERSEDIA DI HTML

    const searchInput = $("#searchInput");

    let searchTimer;

    searchInput?.addEventListener("input", (event) => {
      window.clearTimeout(searchTimer);

      searchTimer = window.setTimeout(() => {
        state.search = event.target.value.trim();
        state.currentPage = 1;
        loadReports();
      }, 350);
    });

    // FILTER STATUS JIKA SELECT TERSEDIA

    $("#filterVerification")?.addEventListener("change", (event) => {
      state.statusVerifikasi = event.target.value;
      state.currentPage = 1;
      loadReports();
    });

    $("#filterHandling")?.addEventListener("change", (event) => {
      state.statusPenanganan = event.target.value;
      state.currentPage = 1;
      loadReports();
    });
  }

  // =====================================================
  // 11. INISIALISASI
  // =====================================================

  async function init() {
    if (!$(".report-table")) return;

    bindEvents();

    addModalCSS();

    await loadReports();

    console.log(
      "[SIPFAS] Admin Laporan Pemeliharaan terhubung ke database MySQL.",
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
