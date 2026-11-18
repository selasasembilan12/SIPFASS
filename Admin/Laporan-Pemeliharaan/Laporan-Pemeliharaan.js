
/* =========================================================
   SIPFAS - ADMIN LAPORAN PEMELIHARAAN
   File: Laporan-Pemeliharaan.js

   LocalStorage:
   sipfas_laporan_pemeliharaan

   FITUR:
   1. Membaca data laporan dari HTML
   2. Menampilkan detail laporan
   3. Statistik laporan otomatis
   4. Pagination
   5. Penyimpanan LocalStorage
   6. Sinkronisasi perubahan data
========================================================= */

(() => {
  "use strict";

  // =====================================================
  // 1. KONFIGURASI
  // =====================================================

  const STORAGE_KEY = "sipfas_laporan_pemeliharaan";

  const state = {
    reports: [],
    currentPage: 1,
    pageSize: 5,
    selectedReport: null
  };

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];


  // =====================================================
  // 2. HELPER
  // =====================================================

  function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  }

  function normalize(value) {

    return String(value ?? "")
      .trim()
      .toLowerCase();

  }


  // =====================================================
  // =====================================================
  // 3. KONFIGURASI API DAN PEMETAAN DATA DATABASE
  // =====================================================

  const API_URL = "../../api/admin/laporan-pemeliharaan.php";

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).format(date);
  }

  function firstValue(...values) {
    return values.find(value => value !== undefined && value !== null && value !== "") ?? "-";
  }

  function mapReport(row) {
    const priority = firstValue(row.prioritas_sesudah, row.prioritas_sebelum, row.prioritas, "-");
    const rawConfidence = firstValue(
      row.nilai_kepercayaan, row.confidence, row.persentase_keyakinan,
      row.confidence_score, 0
    );
    const confidence = Number(String(rawConfidence).replace("%", "")) || 0;
    const verification = firstValue(row.hasil_verifikasi, "Menunggu Verifikasi");
    let handling = firstValue(row.status_penanganan, row.status_laporan, "Menunggu");
    if (row.waktu_selesai_penanganan) handling = "Selesai";
    else if (row.waktu_mulai_penanganan || row.tindak_lanjut_perbaikan) handling = "Dalam Perbaikan";

    return {
      id: firstValue(row.kode_laporan, row.id_laporan),
      date: formatDate(firstValue(row.waktu_laporan, row.tanggal_laporan, row.created_at)),
      facility: firstValue(row.nama_fasilitas),
      inventory: firstValue(row.kode_fasilitas, row.kode_inventaris),
      location: firstValue(row.lokasi_ruangan, row.lokasi),
      recommendation: priority === "-" ? "Belum ada rekomendasi" : `${priority}${confidence ? ` (${confidence.toFixed(1)}%)` : ""}`,
      priority,
      confidence,
      verification,
      verificationReason: firstValue(row.catatan_verifikasi, ""),
      handling,
      reporter: firstValue(row.nama_pelapor),
      description: firstValue(row.deskripsi_kerusakan, row.keterangan, "-")
    };
  }

  async function requestReports() {
    const allRows = [];
    let page = 1;
    let total = Infinity;
    do {
      const url = new URL(API_URL, window.location.href);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", "100");
      const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: { "Accept": "application/json" }
      });
      let result;
      try { result = await response.json(); }
      catch { throw new Error("Respons server bukan JSON yang valid."); }
      if (!response.ok || result.success !== true) {
        throw new Error(result.message || `Gagal memuat laporan (HTTP ${response.status}).`);
      }
      const data = result.data || {};
      const rows = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
      allRows.push(...rows.map(mapReport).filter(item => item.id !== "-"));
      total = Number(data.pagination?.total ?? allRows.length);
      page += 1;
      if (!rows.length) break;
    } while (allRows.length < total && page <= 100);
    return allRows;
  }

  // =====================================================
  // 4. MEMUAT DATA LAPORAN DARI API PHP
  // =====================================================

  async function loadReports() {
    const tbody = $(".report-table tbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:25px">Memuat data laporan...</td></tr>`;
    try {
      state.reports = await requestReports();
      state.currentPage = 1;
      renderTable();
      updateStatistics();
    } catch (error) {
      console.error("Gagal memuat laporan pemeliharaan:", error);
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:25px">${escapeHTML(error.message)} <button type="button" class="retry-report-load">Coba lagi</button></td></tr>`;
      updateStatistics();
    }
  }

  // 6. KELAS STATUS
  // =====================================================

  function getPriorityClass(priority) {

    const value = normalize(priority);

    if (value === "tinggi") {
      return "priority-high";
    }

    if (value === "sedang") {
      return "priority-medium";
    }

    return "priority-low";

  }


  function getVerificationClass(status) {

    const value = normalize(status);

    if (value.includes("terverifikasi") &&
        !value.includes("tidak")) {
      return "verified";
    }

    if (value.includes("tidak valid")) {
      return "verification-error";
    }

    if (value.includes("menunggu")) {
      return "waiting";
    }

    return "";

  }


  function getHandlingClass(status) {

    const value = normalize(status);

    if (value.includes("selesai")) {
      return "completed";
    }

    if (
      value.includes("perbaikan") ||
      value.includes("diproses")
    ) {
      return "processing";
    }

    if (
      value.includes("ditolak")
    ) {
      return "rejected";
    }

    return "pending";

  }


  // =====================================================
  // 7. RENDER TABEL
  // =====================================================

  function renderTable() {

    const tbody = $(".report-table tbody");

    if (!tbody) return;

    const totalPages = Math.max(
      1,
      Math.ceil(state.reports.length / state.pageSize)
    );

    state.currentPage = Math.min(
      Math.max(1, state.currentPage),
      totalPages
    );

    const start =
      (state.currentPage - 1) * state.pageSize;

    const displayed = state.reports.slice(
      start,
      start + state.pageSize
    );

    if (displayed.length === 0) {

      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:25px">
            Belum ada laporan pemeliharaan.
          </td>
        </tr>
      `;

    } else {

      tbody.innerHTML = displayed.map((item, index) => {

        const verificationClass =
          getVerificationClass(item.verification);

        const handlingClass =
          getHandlingClass(item.handling);

        return `

          <tr data-id="${escapeHTML(item.id)}">

            <td class="center">
              ${start + index + 1}
            </td>

            <td>
              <a
                href="#"
                class="report-id"
                data-id="${escapeHTML(item.id)}"
              >
                ${escapeHTML(item.id)}
              </a>
            </td>

            <td>
              ${escapeHTML(item.date)}
            </td>

            <td>
              <strong>
                ${escapeHTML(item.facility)}
              </strong>

              <small>
                ${escapeHTML(item.inventory)}
              </small>
            </td>

            <td>
              <span class="location-badge">
                ${escapeHTML(item.location)}
              </span>
            </td>

            <td>
              <span class="status-pill ${getPriorityClass(item.priority)}">
                <i></i>
                ${escapeHTML(item.recommendation)}
              </span>
            </td>

            <td>
              <span class="status-pill ${verificationClass}">
                <i></i>
                ${escapeHTML(item.verification)}
              </span>

              ${
                item.verificationReason
                  ? `<small>${escapeHTML(item.verificationReason)}</small>`
                  : ""
              }
            </td>

            <td>
              <span class="status-pill ${handlingClass}">
                <i></i>
                ${escapeHTML(item.handling)}
              </span>
            </td>

            <td class="center">

              <a
                href="#"
                class="action-btn view-report-btn"
                data-id="${escapeHTML(item.id)}"
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

      }).join("");

    }

    renderPagination(totalPages);

    updateArchiveCount();

  }


  // =====================================================
  // 8. PAGINATION
  // =====================================================

  function renderPagination(totalPages) {

    const pagination = $(".pagination");

    if (!pagination) return;

    let html = `

      <a
        href="#"
        class="page-btn ${state.currentPage === 1 ? "disabled" : ""}"
        data-page="prev"
        aria-label="Sebelumnya"
      >
        ‹
      </a>

    `;

    for (let page = 1; page <= totalPages; page++) {

      html += `

        <a
          href="#"
          class="page-btn ${page === state.currentPage ? "active" : ""}"
          data-page="${page}"
        >
          ${page}
        </a>

      `;

    }

    html += `

      <a
        href="#"
        class="page-btn ${state.currentPage === totalPages ? "disabled" : ""}"
        data-page="next"
        aria-label="Selanjutnya"
      >
        ›
      </a>

    `;

    pagination.innerHTML = html;

  }


  function changePage(value) {

    const totalPages = Math.max(
      1,
      Math.ceil(state.reports.length / state.pageSize)
    );

    if (value === "prev") {

      state.currentPage--;

    } else if (value === "next") {

      state.currentPage++;

    } else {

      state.currentPage = Number(value);

    }

    state.currentPage = Math.max(
      1,
      Math.min(state.currentPage, totalPages)
    );

    renderTable();

  }


  // =====================================================
  // 9. STATISTIK LAPORAN
  // =====================================================

  function updateStatistics() {

    const cards = $$(".stats-grid .stat-card");

    if (cards.length < 4) return;

    const total = state.reports.length;

    const waiting = state.reports.filter(item =>
      normalize(item.verification).includes("menunggu")
    ).length;

    const processing = state.reports.filter(item => {

      const status = normalize(item.handling);

      return (
        status.includes("perbaikan") ||
        status.includes("diproses")
      );

    }).length;

    const completed = state.reports.filter(item =>
      normalize(item.handling).includes("selesai")
    ).length;

    const values = [
      {
        count: total,
        note: `${total} laporan tersedia`
      },
      {
        count: waiting,
        note: `${total ? (waiting / total * 100).toFixed(1) : 0}% Menunggu Sarpras`
      },
      {
        count: processing,
        note: `${total ? (processing / total * 100).toFixed(1) : 0}% Tindakan Aktif`
      },
      {
        count: completed,
        note: `${total ? (completed / total * 100).toFixed(1) : 0}% Selesai`
      }
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

        const percent = total
          ? item.count / total * 100
          : 0;

        progress.style.width = `${percent}%`;

      }

    });

  }


  // =====================================================
  // 10. JUMLAH ARSIP
  // =====================================================

  function updateArchiveCount() {

    const badge = $(".archive-badge");

    if (badge) {

      badge.textContent =
        `${state.reports.length} Arsip Ditemukan`;

    }

  }


  // =====================================================
  // 11. MEMBUAT MODAL DETAIL
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

          <button
            type="button"
            class="report-close-btn"
          >
            Tutup
          </button>

        </div>

      </div>

    `;

    document.body.appendChild(modal);

  }


  // =====================================================
  // 12. MEMBUKA DETAIL LAPORAN
  // =====================================================

  function openReportDetail(id) {

    const item = state.reports.find(report =>
      String(report.id) === String(id)
    );

    if (!item) {

      alert("Data laporan tidak ditemukan.");

      return;

    }

    state.selectedReport = item;

    createModal();

    $("#report-modal-title").textContent = item.id;

    $("#report-modal-content").innerHTML = `

      <div class="report-detail-section">

        <h3>Informasi Laporan</h3>

        <div class="report-detail-grid">

          <div class="report-detail-item">
            <span>ID Laporan</span>
            <strong>${escapeHTML(item.id)}</strong>
          </div>

          <div class="report-detail-item">
            <span>Tanggal Masuk</span>
            <strong>${escapeHTML(item.date)}</strong>
          </div>

          <div class="report-detail-item">
            <span>Nama Fasilitas</span>
            <strong>${escapeHTML(item.facility)}</strong>
          </div>

          <div class="report-detail-item">
            <span>Kode Inventaris</span>
            <strong>${escapeHTML(item.inventory)}</strong>
          </div>

          <div class="report-detail-item full">
            <span>Lokasi Ruangan</span>
            <strong>${escapeHTML(item.location)}</strong>
          </div>

        </div>

      </div>

      <div class="report-detail-section">

        <h3>Rekomendasi Sistem C4.5</h3>

        <div class="report-detail-highlight">

          <span class="status-pill ${getPriorityClass(item.priority)}">
            <i></i>
            ${escapeHTML(item.priority)}
          </span>

          <strong>${Number(item.confidence).toFixed(1)}%</strong>

          <small>Nilai rekomendasi yang tercantum pada laporan</small>

        </div>

      </div>

      <div class="report-detail-section">

        <h3>Status Verifikasi dan Penanganan</h3>

        <div class="report-detail-grid">

          <div class="report-detail-item">
            <span>Status Verifikasi</span>
            <strong>${escapeHTML(item.verification)}</strong>
          </div>

          <div class="report-detail-item">
            <span>Status Penanganan</span>
            <strong>${escapeHTML(item.handling)}</strong>
          </div>

          <div class="report-detail-item full">
            <span>Catatan Verifikasi</span>
            <strong>
              ${escapeHTML(item.verificationReason || "Tidak ada catatan verifikasi pada data awal.")}
            </strong>
          </div>

        </div>

      </div>

      <div class="report-detail-disclaimer">
        Detail ini menampilkan informasi yang tersedia pada dataset
        laporan. Nilai rekomendasi tidak otomatis membuktikan bahwa
        proses verifikasi atau perbaikan telah dilakukan.
      </div>

    `;

    $("#report-detail-modal").classList.add("show");

    document.body.style.overflow = "hidden";

  }


  // =====================================================
  // 13. MENUTUP MODAL
  // =====================================================

  function closeReportDetail() {

    $("#report-detail-modal")?.classList.remove("show");

    document.body.style.overflow = "";

    state.selectedReport = null;

  }


  // =====================================================
  // 14. CSS TAMBAHAN MODAL
  // =====================================================

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
        width: min(650px, 100%);
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
        border: none;
        background: transparent;
        color: #68717c;
        font-size: 28px;
        cursor: pointer;
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
      }

      .report-detail-highlight {
        display: flex;
        align-items: center;
        gap: 13px;
        flex-wrap: wrap;
        padding: 15px;
        background: #f3f6fb;
        border-radius: 8px;
      }

      .report-detail-highlight strong {
        color: #203f65;
        font-size: 20px;
      }

      .report-detail-highlight small {
        color: #718096;
        font-size: 11px;
        width: 100%;
      }

      .report-detail-disclaimer {
        padding: 12px;
        background: #fff8e8;
        color: #795c20;
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
        border: none;
        border-radius: 7px;
        background: #244d7b;
        color: white;
        font-size: 12px;
        cursor: pointer;
      }

      .report-close-btn:hover {
        background: #183b62;
      }

      .view-report-btn,
      .report-id {
        cursor: pointer;
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


  // =====================================================
  // 15. EVENT LISTENER
  // =====================================================

  function bindEvents() {

    // AKSI DETAIL LAPORAN

    const tbody = $(".report-table tbody");

    tbody?.addEventListener("click", function(event) {

      const button = event.target.closest(
        ".view-report-btn, .report-id"
      );

      if (!button) return;

      event.preventDefault();

      const id = button.dataset.id ||
        button.closest("tr")?.dataset.id;

      if (id) {
        openReportDetail(id);
      }

    });


    // PAGINATION

    $(".pagination")?.addEventListener("click", function(event) {

      const button = event.target.closest("[data-page]");

      if (!button) return;

      event.preventDefault();

      if (button.classList.contains("disabled")) return;

      changePage(button.dataset.page);

    });


    // TUTUP MODAL

    document.addEventListener("click", function(event) {

      if (
        event.target.closest(".report-modal-close") ||
        event.target.closest(".report-close-btn") ||
        event.target.classList.contains("report-modal-backdrop")
      ) {

        closeReportDetail();

      }

    });


    // ESCAPE

    document.addEventListener("keydown", function(event) {

      if (event.key === "Escape") {
        closeReportDetail();
      }

    });


    // MUAT ULANG DATA JIKA REQUEST API GAGAL
    $(".report-table tbody")?.addEventListener("click", function(event) {
      if (event.target.closest(".retry-report-load")) loadReports();
    });

  }


  // =====================================================
  // 16. INISIALISASI
  // =====================================================

  function init() {

    if (!$(".report-table")) return;

    addModalCSS();

    loadReports();

    bindEvents();

    console.log(
      "SIPFAS Laporan Pemeliharaan berhasil dijalankan."
    );

    console.log(
      "Total laporan:",
      state.reports.length
    );

  }


  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );

  } else {

    init();

  }

})();
