
/* =========================================================
   SIPFAS - ADMIN DASHBOARD
   File: Dashboard.js

   FITUR:
   1. Filter status laporan
   2. Pagination tabel
   3. Detail laporan melalui modal
   4. Refresh data
   5. Membaca LocalStorage
   6. Memperbarui statistik
   7. Logout menuju halaman Login
========================================================= */

(() => {
  "use strict";

  // =====================================================
  // 1. KONFIGURASI
  // =====================================================

  const STORAGE = {
    fasilitas: "sipfas_fasilitas",
    pengguna: "sipfas_pengguna",
    laporan: "sipfas_laporan_pemeliharaan",
    pengujian: "sipfas_hasil_pengujian",
    model: "sipfas_model_c45"
  };

  const state = {
    reports: [],
    filteredReports: [],
    currentPage: 1,
    pageSize: 5,
    currentFilter: "semua"
  };

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  // =====================================================
  // 2. MEMBACA LOCAL STORAGE
  // =====================================================

  function getStorage(key) {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error("Gagal membaca LocalStorage:", key, error);
      return null;
    }
  }

  function getArray(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  function getValue(object, keys, fallback = "-") {
    for (const key of keys) {
      if (
        object &&
        object[key] !== undefined &&
        object[key] !== null &&
        object[key] !== ""
      ) {
        return object[key];
      }
    }
    return fallback;
  }

  // =====================================================
  // 3. NORMALISASI STATUS
  // =====================================================

  function normalizeStatus(status) {
    const value = String(status || "").trim().toLowerCase();

    if (["menunggu", "pending", "baru", "diajukan"].includes(value)) {
      return "menunggu";
    }

    if (["diproses", "proses", "in progress", "dikerjakan"].includes(value)) {
      return "diproses";
    }

    if (["selesai", "done", "completed"].includes(value)) {
      return "selesai";
    }

    if (value === "semua") return "semua";

    return value || "menunggu";
  }

  // =====================================================
  // 4. MEMBACA DATA LAPORAN DARI HTML
  // =====================================================

  function getReportsFromHTML() {
    const rows = $$(".report-table tbody tr");

    return rows.map((row, index) => {
      const cells = $$("td", row);

      const priority = cells[4]?.innerText
        .replace("●", "")
        .trim() || "-";

      const status = cells[5]?.innerText.trim() || "Menunggu";

      return {
        id: cells[0]?.innerText.trim() || `LAP-${index + 1}`,
        facility: $("strong", cells[1])?.innerText.trim() || "-",
        assetCode: $("small", cells[1])?.innerText
          .replace("Kode:", "").trim() || "-",
        location: cells[2]?.innerText.trim() || "-",
        date: cells[3]?.innerText.trim() || "-",
        priority,
        status: normalizeStatus(status),
        description:
          "Informasi laporan berdasarkan data yang ditampilkan pada Dashboard.",
        reporter: "-"
      };
    });
  }

  // =====================================================
  // 5. NORMALISASI DATA LOCAL STORAGE
  // =====================================================

  function normalizeReport(item, index) {
    return {
      id: String(getValue(item, [
        "idLaporan", "id_laporan", "kodeLaporan",
        "kode_laporan", "id"
      ], `LAP-${index + 1}`)),

      facility: String(getValue(item, [
        "namaFasilitas", "nama_fasilitas", "fasilitas",
        "namaAset", "nama_aset", "nama"
      ])),

      assetCode: String(getValue(item, [
        "kodeAset", "kode_aset", "kodeFasilitas",
        "kode_fasilitas", "kode"
      ])),

      location: String(getValue(item, [
        "lokasi", "ruangan", "tempat"
      ])),

      date: String(getValue(item, [
        "tanggalDiajukan", "tanggal_diajukan",
        "tanggalLaporan", "tanggal_laporan",
        "tanggal", "createdAt"
      ])),

      priority: String(getValue(item, [
        "rekomendasiC45", "rekomendasi_c45",
        "prioritas", "tingkatKerusakan",
        "hasilKlasifikasi"
      ])),

      status: normalizeStatus(getValue(item, [
        "status", "statusPenanganan", "status_penanganan"
      ], "menunggu")),

      description: String(getValue(item, [
        "deskripsi", "keterangan", "keluhan", "uraian"
      ])),

      reporter: String(getValue(item, [
        "namaPelapor", "nama_pelapor", "pelapor"
      ]))
    };
  }

  // =====================================================
  // 6. MEMUAT DATA LAPORAN
  // =====================================================

  function loadReports() {
    const storedData = getStorage(STORAGE.laporan);

    if (storedData !== null) {
      state.reports = getArray(storedData).map(normalizeReport);
    } else {
      state.reports = getReportsFromHTML();
    }

    applyFilter();
  }

  // =====================================================
  // 7. FILTER STATUS
  // =====================================================

  function applyFilter() {
    if (state.currentFilter === "semua") {
      state.filteredReports = [...state.reports];
    } else {
      state.filteredReports = state.reports.filter(report =>
        normalizeStatus(report.status) === state.currentFilter
      );
    }

    state.currentPage = 1;
    renderTable();
  }

  // =====================================================
  // 8. HELPER HTML
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

  // =====================================================
  // 9. MENAMPILKAN TABEL
  // =====================================================

  function renderTable() {
    const tbody = $(".report-table tbody");
    if (!tbody) return;

    const totalPages = Math.max(
      1,
      Math.ceil(state.filteredReports.length / state.pageSize)
    );

    state.currentPage = Math.min(
      Math.max(1, state.currentPage),
      totalPages
    );

    const start = (state.currentPage - 1) * state.pageSize;

    const displayedReports = state.filteredReports.slice(
      start,
      start + state.pageSize
    );

    if (displayedReports.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="dashboard-empty">
            Tidak ada laporan dengan status tersebut.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = displayedReports.map(report => {
        const status = normalizeStatus(report.status);

        let statusClass = "pill-wait";
        let statusText = "Menunggu";

        if (status === "diproses") {
          statusClass = "pill-progress";
          statusText = "Diproses";
        }

        if (status === "selesai") {
          statusClass = "pill-done";
          statusText = "Selesai";
        }

        let priorityClass = "badge-low-green";

        if (normalizeStatus(report.priority) === "tinggi") {
          priorityClass = "badge-high";
        }

        if (normalizeStatus(report.priority) === "sedang") {
          priorityClass = "badge-medium";
        }

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
                data-report-id="${escapeHTML(report.id)}"
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
      }).join("");
    }

    renderPagination(totalPages);
  }

  // =====================================================
  // 10. PAGINATION
  // =====================================================

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

  function changePage(page) {
    const totalPages = Math.max(
      1,
      Math.ceil(state.filteredReports.length / state.pageSize)
    );

    if (page === "prev") {
      state.currentPage--;
    } else if (page === "next") {
      state.currentPage++;
    } else {
      state.currentPage = Number(page);
    }

    state.currentPage = Math.max(
      1,
      Math.min(state.currentPage, totalPages)
    );

    renderTable();
  }

  // =====================================================
  // 11. MODAL DETAIL LAPORAN
  // =====================================================

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

  function openDetail(report) {
    createModal();

    const modal = $(".dashboard-modal");
    const body = $(".dashboard-modal-body", modal);

    body.innerHTML = `
      <div class="dashboard-detail-item">
        <span>ID Laporan</span>
        <strong>${escapeHTML(report.id)}</strong>
      </div>

      <div class="dashboard-detail-item">
        <span>Nama Fasilitas</span>
        <strong>${escapeHTML(report.facility)}</strong>
      </div>

      <div class="dashboard-detail-item">
        <span>Kode Aset</span>
        <strong>${escapeHTML(report.assetCode)}</strong>
      </div>

      <div class="dashboard-detail-item">
        <span>Lokasi</span>
        <strong>${escapeHTML(report.location)}</strong>
      </div>

      <div class="dashboard-detail-item">
        <span>Tanggal Diajukan</span>
        <strong>${escapeHTML(report.date)}</strong>
      </div>

      <div class="dashboard-detail-item">
        <span>Rekomendasi C4.5</span>
        <strong>${escapeHTML(report.priority)}</strong>
      </div>

      <div class="dashboard-detail-item">
        <span>Status Penanganan</span>
        <strong>${escapeHTML(report.status)}</strong>
      </div>

      <div class="dashboard-detail-item">
        <span>Nama Pelapor</span>
        <strong>${escapeHTML(report.reporter)}</strong>
      </div>

      <div class="dashboard-detail-description">
        <strong>Deskripsi Laporan</strong>
        <p>${escapeHTML(report.description)}</p>
      </div>
    `;

    modal.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    const modal = $(".dashboard-modal");

    if (modal) {
      modal.classList.remove("show");
    }

    document.body.style.overflow = "";
  }

  // =====================================================
  // 12. REFRESH DATA
  // =====================================================

  function refreshDashboard() {
    loadReports();
    updateStatistics();
  }

  // =====================================================
  // 13. STATISTIK DASHBOARD
  // =====================================================

  function updateStatistics() {
    const facilities = getArray(getStorage(STORAGE.fasilitas));
    const users = getArray(getStorage(STORAGE.pengguna));
    const reports = state.reports;

    const cards = $$(".summary-card");

    // Total fasilitas
    if (
      localStorage.getItem(STORAGE.fasilitas) !== null &&
      cards[0]
    ) {
      const number = $(".summary-number", cards[0]);

      if (number) {
        number.innerHTML = `${facilities.length} <small>Unit</small>`;
      }
    }

    // Total pengguna
    if (
      localStorage.getItem(STORAGE.pengguna) !== null &&
      cards[1]
    ) {
      const number = $(".summary-number", cards[1]);

      if (number) {
        number.innerHTML = `${users.length} <small>Akun</small>`;
      }
    }

    // Statistik laporan
    if (
      localStorage.getItem(STORAGE.laporan) !== null &&
      cards[2]
    ) {
      const counts = {
        menunggu: 0,
        diproses: 0,
        selesai: 0
      };

      reports.forEach(report => {
        const status = normalizeStatus(report.status);

        if (counts[status] !== undefined) {
          counts[status]++;
        }
      });

      const number = $(".summary-number", cards[2]);

      if (number) {
        number.innerHTML =
          `${reports.length} <small>Total Kasus</small>`;
      }

      const stats = $$(".report-stats strong", cards[2]);

      if (stats[0]) stats[0].textContent = counts.menunggu;
      if (stats[1]) stats[1].textContent = counts.diproses;
      if (stats[2]) stats[2].textContent = counts.selesai;
    }
  }

  // =====================================================
  // 14. LOGOUT
  // =====================================================

  function handleLogout() {
    const logoutLink = $$(".sidebar-bottom .nav-link")
      .find(link =>
        link.textContent.trim().toLowerCase().includes("keluar")
      );

    if (!logoutLink) {
      console.warn("Tombol Keluar tidak ditemukan.");
      return;
    }

    logoutLink.addEventListener("click", function(event) {
      event.preventDefault();

      const confirmation = window.confirm(
        "Apakah kamu yakin ingin keluar dari SIPFAS?"
      );

      if (!confirmation) return;

      // Menghapus sesi login saja.
      // Data fasilitas, laporan, dan pengguna tetap tersimpan.
      sessionStorage.removeItem("sipfasActiveUser");
      sessionStorage.removeItem("sipfasPendingLogin");
      sessionStorage.removeItem("sipfasOTP");

      // Mengarahkan ke login.html.
      window.location.replace("../../auth/login.html");
    });
  }

  // =====================================================
  // 15. EVENT LISTENER
  // =====================================================

  function bindEvents() {

    // FILTER STATUS
    const filter = $("#statusFilter");

    if (filter) {
      filter.addEventListener("change", function() {
        state.currentFilter = normalizeStatus(this.value);

        if (this.value === "semua") {
          state.currentFilter = "semua";
        }

        applyFilter();
      });
    }

    // PAGINATION
    const pagination = $(".pagination");

    if (pagination) {
      pagination.addEventListener("click", function(event) {
        const button = event.target.closest("button[data-page]");

        if (!button || button.disabled) return;

        changePage(button.dataset.page);
      });
    }

    // DETAIL LAPORAN
    const tbody = $(".report-table tbody");

    if (tbody) {
      tbody.addEventListener("click", function(event) {
        const button = event.target.closest(".eye-btn");

        if (!button) return;

        event.preventDefault();

        const id = button.dataset.reportId;

        const report = state.reports.find(item =>
          String(item.id) === String(id)
        );

        if (report) {
          openDetail(report);
        }
      });
    }

    // TUTUP MODAL
    document.addEventListener("click", function(event) {
      if (
        event.target.closest(".dashboard-modal-close") ||
        event.target.classList.contains("dashboard-modal-backdrop")
      ) {
        closeModal();
      }
    });

    // TOMBOL REFRESH
    const refreshButton = $(".refresh-btn");

    if (refreshButton) {
      refreshButton.removeAttribute("onclick");

      refreshButton.addEventListener("click", function() {
        refreshDashboard();

        const label = $("span", this);

        if (label) {
          label.textContent = "Data Diperbarui";

          setTimeout(() => {
            label.textContent = "Segarkan Data";
          }, 1200);
        }
      });
    }

    // LOGOUT
    handleLogout();

    // PERUBAHAN LOCAL STORAGE DARI TAB LAIN
    window.addEventListener("storage", function(event) {
      if (
        !event.key ||
        Object.values(STORAGE).includes(event.key)
      ) {
        refreshDashboard();
      }
    });

    // TUTUP MODAL DENGAN ESCAPE
    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape") {
        closeModal();
      }
    });
  }

  // =====================================================
  // 16. CSS MODAL OTOMATIS
  // =====================================================

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
        width: min(500px, 100%);
        max-height: 85vh;
        overflow-y: auto;
        background: white;
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
        border: none;
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

      .eye-btn {
        cursor: pointer;
      }

      @media(max-width: 500px) {
        .dashboard-detail-item {
          grid-template-columns: 1fr;
          gap: 3px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // =====================================================
  // 17. INISIALISASI DASHBOARD
  // =====================================================

  function init() {
    if (!$(".app-layout")) return;

    addModalCSS();
    bindEvents();
    loadReports();
    updateStatistics();

    console.log("SIPFAS Dashboard Admin berhasil dijalankan.");
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
