
/* =========================================================
   SIPFAS - ADMIN DATASET C4.5
   File: Dataset-C45.js
   Penyimpanan: LocalStorage

   FITUR:
   1. Tambah data simulasi
   2. Detail data (ikon mata)
   3. Hapus data
   4. Undo hapus
   5. Pencarian
   6. Filter X1, X2, X3, Y
   7. Pagination
   8. Statistik otomatis
   9. Penyimpanan LocalStorage
========================================================= */

(() => {
  "use strict";

  // =====================================================
  // 1. KONFIGURASI
  // =====================================================

  const STORAGE_KEY = "sipfas_dataset_c45";

  const state = {
    data: [],
    filtered: [],
    search: "",
    x1: "semua",
    x2: "semua",
    x3: "semua",
    y: "semua",
    currentPage: 1,
    pageSize: 10,
    deletedItem: null,
    undoTimer: null
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
    return String(value ?? "").trim().toLowerCase();
  }

  function getLevel(value) {
    const text = normalize(value);

    if (
      text.includes("ringan") ||
      text.includes("jarang") ||
      text.includes("rendah")
    ) return 1;

    if (text.includes("sedang")) return 2;

    if (
      text.includes("berat") ||
      text.includes("sering") ||
      text.includes("tinggi")
    ) return 3;

    return 0;
  }

  function getLevelName(value, attribute) {

    const levels = {
      x1: ["", "Ringan", "Sedang", "Berat"],
      x2: ["", "Rendah", "Sedang", "Tinggi"],
      x3: ["", "Jarang", "Sedang", "Sering"]
    };

    return levels[attribute][Number(value)] || "";

  }


  // =====================================================
  // 3. PERHITUNGAN
  // =====================================================

  function calculateScore(x1, x2, x3) {

    return (
      0.4 * Number(x1) +
      0.4 * Number(x2) +
      0.2 * Number(x3)
    );

  }

  function determinePriority(score) {

    if (score < 1.7) return "Rendah";

    if (score < 2.4) return "Sedang";

    return "Tinggi";

  }

  function getPriorityClass(priority) {

    if (priority === "Tinggi") return "priority-high";

    if (priority === "Sedang") return "priority-medium";

    return "priority-low";

  }


  // =====================================================
  // 4. LOCAL STORAGE
  // =====================================================

  function readStorage() {

    try {

      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw === null) return null;

      const parsed = JSON.parse(raw);

      return Array.isArray(parsed) ? parsed : null;

    } catch (error) {

      console.error("Gagal membaca dataset:", error);

      return null;

    }

  }

  function saveStorage() {

    try {

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.data)
      );

      return true;

    } catch (error) {

      console.error("Gagal menyimpan dataset:", error);

      alert("Dataset gagal disimpan.");

      return false;

    }

  }


  // =====================================================
  // 5. DATA AWAL DARI HTML
  // =====================================================

  function getInitialData() {

    const rows = $$(".dataset-table tbody tr");

    return rows.map(row => {

      const id = row.querySelector(".case-id")
        ?.textContent.trim().replace("#", "") || "";

      const facility =
        row.querySelector(".facility")?.textContent.trim() || "";

      const chips = $$(".chip", row);

      const x1 = getLevel(chips[0]?.textContent);

      const x2 = getLevel(chips[1]?.textContent);

      const x3 = getLevel(chips[2]?.textContent);

      const score = calculateScore(x1, x2, x3);

      return {
        id,
        facility,
        x1,
        x2,
        x3,
        score: Number(score.toFixed(2)),
        label: determinePriority(score)
      };

    }).filter(item =>
      item.id &&
      item.facility &&
      item.x1 &&
      item.x2 &&
      item.x3
    );

  }


  // =====================================================
  // 6. NORMALISASI DATA
  // =====================================================

  function normalizeData(item) {

    const x1 = Number(item.x1);
    const x2 = Number(item.x2);
    const x3 = Number(item.x3);

    const score = calculateScore(x1, x2, x3);

    return {
      id: String(item.id),
      facility: String(item.facility),
      x1,
      x2,
      x3,
      score: Number(score.toFixed(2)),
      label: determinePriority(score)
    };

  }


  // =====================================================
  // 7. MEMUAT DATA
  // =====================================================

  function loadData() {

    const stored = readStorage();

    if (stored !== null) {

      state.data = stored.map(normalizeData);

    } else {

      state.data = getInitialData();

      saveStorage();

    }

    applyFilter();

  }


  // =====================================================
  // 8. FILTER DAN PENCARIAN
  // =====================================================

  function applyFilter() {

    state.filtered = state.data.filter(item => {

      const matchesSearch =
        item.id.toLowerCase().includes(state.search) ||
        item.facility.toLowerCase().includes(state.search);

      const matchesX1 =
        state.x1 === "semua" ||
        getLevelName(item.x1, "x1").toLowerCase() === state.x1;

      const matchesX2 =
        state.x2 === "semua" ||
        getLevelName(item.x2, "x2").toLowerCase() === state.x2;

      const matchesX3 =
        state.x3 === "semua" ||
        getLevelName(item.x3, "x3").toLowerCase() === state.x3;

      const matchesY =
        state.y === "semua" ||
        item.label.toLowerCase() === state.y;

      return (
        matchesSearch &&
        matchesX1 &&
        matchesX2 &&
        matchesX3 &&
        matchesY
      );

    });

    state.currentPage = 1;

    renderTable();

    updateStatistics();

  }


  // =====================================================
  // 9. CHIP ATRIBUT
  // =====================================================

  function renderChip(value, attribute) {

    return `
      <span class="chip">
        ${escapeHTML(getLevelName(value, attribute))}
        (${value})
      </span>
    `;

  }


  // =====================================================
  // 10. TABEL DATASET
  // =====================================================

  function renderTable() {

    const tbody = $(".dataset-table tbody");

    if (!tbody) return;

    const totalPages = Math.max(
      1,
      Math.ceil(state.filtered.length / state.pageSize)
    );

    state.currentPage = Math.min(
      Math.max(1, state.currentPage),
      totalPages
    );

    const start =
      (state.currentPage - 1) * state.pageSize;

    const displayed = state.filtered.slice(
      start,
      start + state.pageSize
    );

    if (displayed.length === 0) {

      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;padding:25px">
            Data dataset tidak ditemukan.
          </td>
        </tr>
      `;

    } else {

      tbody.innerHTML = displayed.map(item => `

        <tr data-id="${escapeHTML(item.id)}">

          <td>
            <a href="#" class="case-id">
              #${escapeHTML(item.id)}
            </a>
          </td>

          <td class="facility">
            ${escapeHTML(item.facility)}
          </td>

          <td class="center">
            ${renderChip(item.x1, "x1")}
          </td>

          <td class="center">
            ${renderChip(item.x2, "x2")}
          </td>

          <td class="center">
            ${renderChip(item.x3, "x3")}
          </td>

          <td class="center">
            <span class="score">
              ${item.score.toFixed(2)}
            </span>
          </td>

          <td class="center">
            <span class="priority ${getPriorityClass(item.label)}">
              ${escapeHTML(item.label)}
            </span>
          </td>

          <td class="center">
            <span class="action-group">

              <a
                href="#"
                class="eye-btn"
                data-id="${escapeHTML(item.id)}"
                aria-label="Lihat detail"
                title="Lihat detail"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M2.5 12C4.4 8.9 7.7 7 12 7C16.3 7 19.6 8.9 21.5 12C19.6 15.1 16.3 17 12 17C7.7 17 4.4 15.1 2.5 12Z"/>
                  <circle cx="12" cy="12" r="2.5"/>
                </svg>
              </a>

              <a
                href="#"
                class="trash-btn"
                data-id="${escapeHTML(item.id)}"
                aria-label="Hapus data"
                title="Hapus data"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M4.5 7H19.5"/>
                  <path d="M9.5 7V4.8H14.5V7"/>
                  <path d="M6.5 7L7.4 19.2H16.6L17.5 7"/>
                </svg>
              </a>

            </span>
          </td>

        </tr>

      `).join("");

    }

    renderPagination(totalPages);

  }


  // =====================================================
  // 11. PAGINATION
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
      Math.ceil(state.filtered.length / state.pageSize)
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
  // 12. STATISTIK
  // =====================================================

  function updateStatistics() {

    const cards = $$(".summary-card");

    if (cards.length < 4) return;

    const total = state.data.length;

    const high = state.data.filter(
      item => item.label === "Tinggi"
    ).length;

    const medium = state.data.filter(
      item => item.label === "Sedang"
    ).length;

    const low = state.data.filter(
      item => item.label === "Rendah"
    ).length;

    const values = [
      { count: total, label: "Kasus Simulasi" },
      {
        count: high,
        label: `${total ? (high / total * 100).toFixed(1) : 0}% dari total`
      },
      {
        count: medium,
        label: `${total ? (medium / total * 100).toFixed(1) : 0}% dari total`
      },
      {
        count: low,
        label: `${total ? (low / total * 100).toFixed(1) : 0}% dari total`
      }
    ];

    values.forEach((item, index) => {

      const number = $(".summary-number", cards[index]);

      if (number) {
        number.innerHTML =
          `${item.count}<small>${item.label}</small>`;
      }

      const bar = $(".progress-bar", cards[index]);

      if (bar) {

        const percentage = total
          ? item.count / total * 100
          : 0;

        bar.style.width = `${percentage}%`;

      }

    });

  }


  // =====================================================
  // 13. MODAL
  // =====================================================

  function createModal() {

    if ($("#dataset-modal")) return;

    const modal = document.createElement("div");

    modal.id = "dataset-modal";

    // PERBAIKAN UTAMA:
    // Modal memiliki class dataset-modal.
    // CSS mengatur .dataset-modal.show.

    modal.className = "dataset-modal";

    modal.innerHTML = `

      <div class="dataset-modal-backdrop"></div>

      <div class="dataset-modal-box">

        <div class="dataset-modal-header">

          <h2 id="dataset-modal-title"></h2>

          <button
            type="button"
            class="dataset-modal-close"
            aria-label="Tutup"
          >&times;</button>

        </div>

        <div class="dataset-modal-body"></div>

      </div>

    `;

    document.body.appendChild(modal);

  }


  function openModal(title, content) {

    createModal();

    $("#dataset-modal-title").textContent = title;

    $(".dataset-modal-body").innerHTML = content;

    $("#dataset-modal").classList.add("show");

    document.body.style.overflow = "hidden";

  }


  function closeModal() {

    $("#dataset-modal")?.classList.remove("show");

    document.body.style.overflow = "";

  }


  // =====================================================
  // 14. TAMBAH DATA
  // =====================================================

  function openAddModal() {

    openModal("Tambah Data Simulasi", `

      <form id="dataset-form">

        <div class="dataset-form-group">
          <label>Nama Fasilitas</label>
          <input
            type="text"
            id="newFacility"
            placeholder="Masukkan nama fasilitas"
            required
          />
        </div>

        <div class="dataset-form-group">
          <label>X1 - Tingkat Kerusakan</label>
          <select id="newX1" required>
            <option value="">Pilih tingkat kerusakan</option>
            <option value="1">Ringan (1)</option>
            <option value="2">Sedang (2)</option>
            <option value="3">Berat (3)</option>
          </select>
        </div>

        <div class="dataset-form-group">
          <label>X2 - Dampak Akademik</label>
          <select id="newX2" required>
            <option value="">Pilih dampak akademik</option>
            <option value="1">Rendah (1)</option>
            <option value="2">Sedang (2)</option>
            <option value="3">Tinggi (3)</option>
          </select>
        </div>

        <div class="dataset-form-group">
          <label>X3 - Frekuensi Penggunaan</label>
          <select id="newX3" required>
            <option value="">Pilih frekuensi penggunaan</option>
            <option value="1">Jarang (1)</option>
            <option value="2">Sedang (2)</option>
            <option value="3">Sering (3)</option>
          </select>
        </div>

        <div class="dataset-score-preview" id="scorePreview">
          Pilih ketiga atribut untuk melihat skor.
        </div>

        <div class="dataset-modal-actions">

          <button
            type="button"
            class="dataset-cancel-btn"
          >Batal</button>

          <button
            type="submit"
            class="dataset-submit-btn"
          >Simpan Data</button>

        </div>

      </form>

    `);

    bindAddForm();

  }


  function updateScorePreview() {

    const x1 = Number($("#newX1")?.value);

    const x2 = Number($("#newX2")?.value);

    const x3 = Number($("#newX3")?.value);

    const preview = $("#scorePreview");

    if (!preview) return;

    if (!x1 || !x2 || !x3) {

      preview.textContent =
        "Pilih ketiga atribut untuk melihat skor.";

      return;

    }

    const score = calculateScore(x1, x2, x3);

    const label = determinePriority(score);

    preview.innerHTML = `
      <strong>Skor: ${score.toFixed(2)}</strong>
      <br>
      Label Prioritas:
      <span class="priority ${getPriorityClass(label)}">
        ${label}
      </span>
    `;

  }


  function bindAddForm() {

    ["newX1", "newX2", "newX3"].forEach(id => {

      $("#" + id)?.addEventListener(
        "change",
        updateScorePreview
      );

    });

    $("#dataset-form")?.addEventListener("submit", function(event) {

      event.preventDefault();

      const facility = $("#newFacility").value.trim();

      const x1 = Number($("#newX1").value);

      const x2 = Number($("#newX2").value);

      const x3 = Number($("#newX3").value);

      if (!facility || !x1 || !x2 || !x3) {
        alert("Semua kolom wajib diisi.");
        return;
      }

      const duplicate = state.data.some(item =>
        normalize(item.facility) === normalize(facility)
      );

      if (duplicate) {
        alert("Nama fasilitas sudah tersedia.");
        return;
      }

      const numbers = state.data.map(item => {
        const match = item.id.match(/DS-(\d+)/);
        return match ? Number(match[1]) : 0;
      });

      const nextNumber = Math.max(0, ...numbers) + 1;

      const id = "DS-" +
        String(nextNumber).padStart(3, "0");

      const score = calculateScore(x1, x2, x3);

      const newItem = {
        id,
        facility,
        x1,
        x2,
        x3,
        score: Number(score.toFixed(2)),
        label: determinePriority(score)
      };

      state.data.push(newItem);

      if (!saveStorage()) {
        state.data.pop();
        return;
      }

      closeModal();

      applyFilter();

      alert(`Data ${id} berhasil ditambahkan.`);

    });

    $(".dataset-cancel-btn")?.addEventListener(
      "click",
      closeModal
    );

  }


  // =====================================================
  // 15. DETAIL DATA
  // =====================================================

  function openDetail(id) {

    const item = state.data.find(
      data => data.id === id
    );

    if (!item) {
      alert("Data tidak ditemukan.");
      return;
    }

    const scoreFormula =
      `(0.4 × ${item.x1}) + ` +
      `(0.4 × ${item.x2}) + ` +
      `(0.2 × ${item.x3})`;

    openModal("Detail Data Dataset", `

      <div class="dataset-detail-item">
        <span>ID Kasus</span>
        <strong>#${escapeHTML(item.id)}</strong>
      </div>

      <div class="dataset-detail-item">
        <span>Jenis Fasilitas</span>
        <strong>${escapeHTML(item.facility)}</strong>
      </div>

      <div class="dataset-detail-item">
        <span>X1 - Kerusakan</span>
        <strong>${getLevelName(item.x1, "x1")} (${item.x1})</strong>
      </div>

      <div class="dataset-detail-item">
        <span>X2 - Dampak Akademik</span>
        <strong>${getLevelName(item.x2, "x2")} (${item.x2})</strong>
      </div>

      <div class="dataset-detail-item">
        <span>X3 - Frekuensi</span>
        <strong>${getLevelName(item.x3, "x3")} (${item.x3})</strong>
      </div>

      <div class="dataset-detail-item">
        <span>Perhitungan</span>
        <strong>${scoreFormula}</strong>
      </div>

      <div class="dataset-detail-item">
        <span>Skor Matematis</span>
        <strong>${item.score.toFixed(2)}</strong>
      </div>

      <div class="dataset-detail-item">
        <span>Label Prioritas</span>
        <strong>
          <span class="priority ${getPriorityClass(item.label)}">
            ${item.label}
          </span>
        </strong>
      </div>

      <div class="dataset-detail-note">
        Formula pembobotan:
        <strong>0.4X1 + 0.4X2 + 0.2X3</strong>
      </div>

      <div class="dataset-modal-actions">
        <button
          type="button"
          class="dataset-cancel-btn"
        >Tutup</button>
      </div>

    `);

    $(".dataset-cancel-btn")?.addEventListener(
      "click",
      closeModal
    );

  }


  // =====================================================
  // 16. HAPUS DATA DAN UNDO
  // =====================================================

  function showUndoNotification(item) {

    $("#dataset-undo-notification")?.remove();

    const notification = document.createElement("div");

    notification.id = "dataset-undo-notification";

    notification.innerHTML = `

      <span>
        Data ${escapeHTML(item.id)} berhasil dihapus.
      </span>

      <button type="button" id="undo-delete-btn">
        URUNGKAN
      </button>

      <button
        type="button"
        id="close-undo-btn"
        aria-label="Tutup"
      >×</button>

    `;

    document.body.appendChild(notification);

    $("#undo-delete-btn")?.addEventListener(
      "click",
      undoDelete
    );

    $("#close-undo-btn")?.addEventListener(
      "click",
      () => {
        clearTimeout(state.undoTimer);
        notification.remove();
      }
    );

    clearTimeout(state.undoTimer);

    state.undoTimer = setTimeout(() => {
      notification.remove();
      state.deletedItem = null;
    }, 15000);

  }


  function deleteData(id) {

    const item = state.data.find(
      data => data.id === id
    );

    if (!item) return;

    const confirmation = confirm(
      `Apakah kamu yakin ingin menghapus ${id}?\n\n` +
      `${item.facility}`
    );

    if (!confirmation) return;

    const previous = [...state.data];

    state.data = state.data.filter(
      data => data.id !== id
    );

    if (!saveStorage()) {
      state.data = previous;
      return;
    }

    state.deletedItem = {
      item,
      originalIndex: previous.findIndex(data => data.id === id)
    };

    applyFilter();

    showUndoNotification(item);

  }


  function undoDelete() {

    if (!state.deletedItem) return;

    const { item, originalIndex } = state.deletedItem;

    if (state.data.some(data => data.id === item.id)) {
      return;
    }

    const previous = [...state.data];

    state.data.splice(originalIndex, 0, item);

    if (!saveStorage()) {
      state.data = previous;
      return;
    }

    clearTimeout(state.undoTimer);

    state.deletedItem = null;

    $("#dataset-undo-notification")?.remove();

    applyFilter();

    alert(`Data ${item.id} berhasil dikembalikan.`);

  }


  // =====================================================
  // 17. EVENT LISTENER
  // =====================================================

  function bindEvents() {

    // SEARCH

    $("#searchInput")?.addEventListener("input", function() {

      state.search = normalize(this.value);

      applyFilter();

    });


    // FILTER X1

    $("#filterX1")?.addEventListener("change", function() {

      state.x1 = normalize(this.value);

      applyFilter();

    });


    // FILTER X2

    $("#filterX2")?.addEventListener("change", function() {

      state.x2 = normalize(this.value);

      applyFilter();

    });


    // FILTER X3

    $("#filterX3")?.addEventListener("change", function() {

      state.x3 = normalize(this.value);

      applyFilter();

    });


    // FILTER Y

    $("#filterY")?.addEventListener("change", function() {

      state.y = normalize(this.value);

      applyFilter();

    });


    // TAMBAH DATA

    $(".add-btn")?.addEventListener(
      "click",
      openAddModal
    );


    // TOMBOL DATA PENELITIAN

    $(".guide-btn")?.addEventListener("click", function() {

      alert(
        "Dataset penelitian belum dihubungkan. " +
        "Halaman ini masih menggunakan data simulasi."
      );

    });


    // AKSI TABEL

    const tbody = $(".dataset-table tbody");

    tbody?.addEventListener("click", function(event) {

      const eyeButton = event.target.closest(".eye-btn");

      const trashButton = event.target.closest(".trash-btn");

      const caseLink = event.target.closest(".case-id");


      if (eyeButton) {

        event.preventDefault();

        openDetail(eyeButton.dataset.id);

        return;

      }


      if (trashButton) {

        event.preventDefault();

        deleteData(trashButton.dataset.id);

        return;

      }


      if (caseLink) {

        event.preventDefault();

        const id = caseLink.closest("tr")?.dataset.id;

        if (id) openDetail(id);

      }

    });


    // PAGINATION

    $(".pagination")?.addEventListener("click", function(event) {

      const button = event.target.closest("button[data-page]");

      if (!button || button.disabled) return;

      changePage(button.dataset.page);

    });


    // TUTUP MODAL

    document.addEventListener("click", function(event) {

      if (
        event.target.closest(".dataset-modal-close") ||
        event.target.classList.contains("dataset-modal-backdrop")
      ) {
        closeModal();
      }

    });


    // ESCAPE

    document.addEventListener("keydown", function(event) {

      if (event.key === "Escape") {
        closeModal();
      }

    });


    // SINKRONISASI TAB

    window.addEventListener("storage", function(event) {

      if (
        event.key === STORAGE_KEY ||
        event.key === null
      ) {
        loadData();
      }

    });

  }


  // =====================================================
  // 18. CSS TAMBAHAN
  // =====================================================

  function addModalCSS() {

    if ($("#dataset-modal-style")) return;

    const style = document.createElement("style");

    style.id = "dataset-modal-style";

    style.textContent = `

      .dataset-modal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .dataset-modal.show {
        display: flex;
      }

      .dataset-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, .55);
      }

      .dataset-modal-box {
        position: relative;
        width: min(480px, 100%);
        max-height: 90vh;
        overflow-y: auto;
        background: white;
        border-radius: 12px;
        box-shadow: 0 15px 40px rgba(0,0,0,.2);
      }

      .dataset-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 22px;
        border-bottom: 1px solid #edf0f4;
      }

      .dataset-modal-header h2 {
        font-size: 16px;
        color: #203f65;
      }

      .dataset-modal-close {
        border: none;
        background: transparent;
        font-size: 25px;
        cursor: pointer;
        color: #68717c;
      }

      .dataset-modal-body {
        padding: 22px;
      }

      .dataset-form-group {
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin-bottom: 15px;
      }

      .dataset-form-group label {
        font-size: 12px;
        font-weight: 600;
        color: #344054;
      }

      .dataset-form-group input,
      .dataset-form-group select {
        width: 100%;
        padding: 11px 12px;
        border: 1px solid #dce2ea;
        border-radius: 7px;
        font-size: 13px;
        background: white;
        outline: none;
      }

      .dataset-form-group input:focus,
      .dataset-form-group select:focus {
        border-color: #345f96;
      }

      .dataset-score-preview {
        padding: 13px;
        margin: 15px 0;
        background: #f2f6fb;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.8;
      }

      .dataset-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
      }

      .dataset-modal-actions button {
        border: none;
        padding: 10px 17px;
        border-radius: 7px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
      }

      .dataset-cancel-btn {
        background: #edf0f4;
        color: #475467;
      }

      .dataset-submit-btn {
        background: #244d7b;
        color: white;
      }

      .dataset-detail-item {
        display: grid;
        grid-template-columns: 155px 1fr;
        gap: 10px;
        padding: 10px 0;
        border-bottom: 1px solid #edf0f4;
        font-size: 12px;
      }

      .dataset-detail-item span {
        color: #667085;
      }

      .dataset-detail-item strong {
        color: #202b3c;
        overflow-wrap: anywhere;
      }

      .dataset-detail-note {
        margin-top: 17px;
        padding: 13px;
        background: #f2f6fb;
        border-radius: 7px;
        font-size: 12px;
        line-height: 1.7;
      }

      #dataset-undo-notification {
        position: fixed;
        bottom: 25px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 13px 18px;
        background: #203f65;
        color: white;
        border-radius: 8px;
        box-shadow: 0 5px 20px rgba(0,0,0,.2);
        font-size: 13px;
      }

      #dataset-undo-notification button {
        border: none;
        background: transparent;
        color: white;
        cursor: pointer;
        font-weight: bold;
      }

      #dataset-undo-notification #undo-delete-btn {
        color: #fcd34d;
      }

      .dataset-modal-close:hover {
        color: #c0392b;
      }

      .dataset-cancel-btn:hover {
        background: #dce2ea;
      }

      .dataset-submit-btn:hover {
        background: #183b62;
      }

      .eye-btn,
      .trash-btn,
      .case-id {
        cursor: pointer;
      }

      @media(max-width: 500px) {
        .dataset-detail-item {
          grid-template-columns: 1fr;
          gap: 4px;
        }

        #dataset-undo-notification {
          width: calc(100% - 30px);
          justify-content: space-between;
          gap: 5px;
        }
      }

    `;

    document.head.appendChild(style);

  }


  // =====================================================
  // 19. INISIALISASI
  // =====================================================

  function init() {

    if (!$(".dataset-table")) return;

    addModalCSS();

    loadData();

    bindEvents();

    console.log(
      "SIPFAS Dataset C4.5 berhasil dijalankan."
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
