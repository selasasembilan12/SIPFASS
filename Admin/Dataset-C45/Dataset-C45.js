/* =========================================================
   SIPFAS - ADMIN DATASET C4.5
   File: Admin/Dataset-C45/Dataset-C45.js

   Terhubung dengan:
   api/admin/dataset-c45.php

   Fitur:
   - Read dataset
   - Create dataset
   - Update dataset
   - Delete dataset
   - Search dan filter
   - Pagination
   - Import CSV
   - Statistik dataset
========================================================= */

(() => {
  "use strict";

  const API = "../../api/admin/dataset-c45.php";

  const state = {
    items: [],
    page: 1,
    limit: 10,
    totalPages: 1,
    search: "",
    filters: {
      x1: "",
      x2: "",
      x3: "",
      label: "",
    },
    editing: null,
    loading: false,
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);

  const escapeHTML = (value) =>
    String(value ?? "").replace(
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

  /* =======================================================
     01. REQUEST API
  ======================================================= */

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
      },
      ...options,
    });

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error("Respons server tidak valid.");
    }

    if (!response.ok || result.success === false) {
      throw new Error(result.message || "Permintaan ke server gagal.");
    }

    return result;
  }

  /* =======================================================
     02. NOTIFIKASI
  ======================================================= */

  function notify(message, type = "success") {
    const box = $("#c45-feedback");

    if (!box) return;

    box.textContent = message;
    box.className = `c45-feedback ${type}`;
    box.hidden = false;

    window.clearTimeout(notify.timer);

    notify.timer = window.setTimeout(() => {
      box.hidden = true;
    }, 4000);
  }

  /* =======================================================
     03. MEMBANGUN TAMPILAN
  ======================================================= */

  function buildInterface(root) {
    root.innerHTML = `
      <section class="c45-container">

        <div class="c45-header">
          <div>
            <h2>Dataset C4.5</h2>
            <p>
              Pengelolaan data pelatihan klasifikasi
              prioritas perbaikan fasilitas.
            </p>
          </div>

          <div class="c45-actions">
            <button type="button" id="c45-import-button">
              Import Dataset
            </button>

            <button type="button" id="c45-add-button">
              + Tambah Data
            </button>

            <input
              type="file"
              id="c45-file-input"
              accept=".csv,text/csv"
              hidden
            >
          </div>
        </div>

        <div id="c45-feedback"
             class="c45-feedback"
             hidden></div>

        <div class="c45-statistics">

          <div class="c45-stat-card">
            <span>Total Dataset</span>
            <strong id="c45-total">0</strong>
          </div>

          <div class="c45-stat-card">
            <span>Prioritas Rendah</span>
            <strong id="c45-low">0</strong>
          </div>

          <div class="c45-stat-card">
            <span>Prioritas Sedang</span>
            <strong id="c45-medium">0</strong>
          </div>

          <div class="c45-stat-card">
            <span>Prioritas Tinggi</span>
            <strong id="c45-high">0</strong>
          </div>

        </div>

        <div class="c45-filter-panel">

          <input
            type="search"
            id="c45-search"
            placeholder="Cari kode atau nama fasilitas..."
          >

          <select id="c45-filter-x1">
            <option value="">Semua Kerusakan</option>
            <option value="1">Ringan</option>
            <option value="2">Sedang</option>
            <option value="3">Berat</option>
          </select>

          <select id="c45-filter-x2">
            <option value="">Semua Dampak</option>
            <option value="1">Rendah</option>
            <option value="2">Sedang</option>
            <option value="3">Tinggi</option>
          </select>

          <select id="c45-filter-x3">
            <option value="">Semua Frekuensi</option>
            <option value="1">Jarang</option>
            <option value="2">Sedang</option>
            <option value="3">Sering</option>
          </select>

          <select id="c45-filter-label">
            <option value="">Semua Prioritas</option>
            <option value="Rendah">Rendah</option>
            <option value="Sedang">Sedang</option>
            <option value="Tinggi">Tinggi</option>
          </select>

          <button type="button" id="c45-reset-filter">
            Reset
          </button>

        </div>

        <div class="c45-table-wrapper">

          <table class="c45-table">

            <thead>
              <tr>
                <th>No.</th>
                <th>Kode Data</th>
                <th>Nama Fasilitas</th>
                <th>X1</th>
                <th>X2</th>
                <th>X3</th>
                <th>Label Y</th>
                <th>Sumber</th>
                <th>Aksi</th>
              </tr>
            </thead>

            <tbody id="c45-table-body">
              <tr>
                <td colspan="9">Memuat dataset...</td>
              </tr>
            </tbody>

          </table>

        </div>

        <div class="c45-footer">
          <span id="c45-page-info">Halaman 1</span>

          <div>
            <button type="button" id="c45-prev">Sebelumnya</button>
            <button type="button" id="c45-next">Selanjutnya</button>
          </div>
        </div>

        <div class="c45-modal" id="c45-modal" hidden>

          <div class="c45-modal-backdrop"
               data-close-modal></div>

          <div class="c45-modal-box">

            <div class="c45-modal-header">
              <h3 id="c45-modal-title">Tambah Dataset</h3>

              <button type="button"
                      id="c45-close-modal">×</button>
            </div>

            <form id="c45-form">

              <label>
                Kode Dataset
                <input
                  type="text"
                  name="kode_data"
                  required
                  maxlength="30"
                  placeholder="DS-101"
                >
              </label>

              <label>
                Nama Fasilitas
                <input
                  type="text"
                  name="nama_fasilitas"
                  required
                  maxlength="150"
                >
              </label>

              <label>
                X1 - Tingkat Kerusakan
                <select name="tingkat_kerusakan_x1" required>
                  <option value="">Pilih kategori</option>
                  <option value="1">Ringan</option>
                  <option value="2">Sedang</option>
                  <option value="3">Berat</option>
                </select>
              </label>

              <label>
                X2 - Dampak Akademik
                <select name="dampak_akademik_x2" required>
                  <option value="">Pilih kategori</option>
                  <option value="1">Rendah</option>
                  <option value="2">Sedang</option>
                  <option value="3">Tinggi</option>
                </select>
              </label>

              <label>
                X3 - Frekuensi Penggunaan
                <select name="frekuensi_penggunaan_x3" required>
                  <option value="">Pilih kategori</option>
                  <option value="1">Jarang</option>
                  <option value="2">Sedang</option>
                  <option value="3">Sering</option>
                </select>
              </label>

              <label>
                Y - Label Prioritas
                <select name="label_prioritas" required>
                  <option value="">Pilih label</option>
                  <option value="Rendah">Rendah</option>
                  <option value="Sedang">Sedang</option>
                  <option value="Tinggi">Tinggi</option>
                </select>
              </label>

              <label>
                Sumber Data
                <input
                  type="text"
                  name="sumber_data"
                  value="Input Manual"
                  maxlength="50"
                >
              </label>

              <div class="c45-modal-actions">
                <button type="button"
                        id="c45-cancel">Batal</button>

                <button type="submit"
                        id="c45-save">Simpan Dataset</button>
              </div>

            </form>

          </div>
        </div>

      </section>
    `;

    addStyles();
  }

  /* =======================================================
     04. CSS INTERNAL
  ======================================================= */

  function addStyles() {
    if ($("#c45-style")) return;

    const style = document.createElement("style");
    style.id = "c45-style";

    style.textContent = `
      .c45-container {
        width: 100%;
        color: #25364a;
      }

      .c45-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 22px;
      }

      .c45-header h2 {
        font-size: 23px;
        margin: 0 0 6px;
      }

      .c45-header p {
        margin: 0;
        color: #718096;
        font-size: 13px;
      }

      .c45-actions {
        display: flex;
        gap: 9px;
        flex-wrap: wrap;
      }

      .c45-container button {
        cursor: pointer;
        border: 1px solid #dce3ec;
        border-radius: 7px;
        padding: 10px 14px;
        background: white;
        color: #29496f;
        font-weight: 600;
      }

      .c45-actions #c45-add-button {
        color: white;
        background: #234f82;
        border-color: #234f82;
      }

      .c45-statistics {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-bottom: 20px;
      }

      .c45-stat-card {
        background: white;
        padding: 18px;
        border: 1px solid #e8edf3;
        border-radius: 10px;
      }

      .c45-stat-card span {
        display: block;
        color: #718096;
        font-size: 12px;
        margin-bottom: 9px;
      }

      .c45-stat-card strong {
        font-size: 25px;
      }

      .c45-filter-panel {
        display: grid;
        grid-template-columns: 2fr repeat(4, 1fr) auto;
        gap: 9px;
        margin-bottom: 17px;
      }

      .c45-filter-panel input,
      .c45-filter-panel select,
      .c45-modal input,
      .c45-modal select {
        width: 100%;
        min-width: 0;
        padding: 10px;
        border: 1px solid #dce3ec;
        border-radius: 7px;
        background: white;
        box-sizing: border-box;
        font: inherit;
        font-size: 13px;
      }

      .c45-table-wrapper {
        overflow-x: auto;
        background: white;
        border: 1px solid #e8edf3;
        border-radius: 10px;
      }

      .c45-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 900px;
        font-size: 12px;
      }

      .c45-table th {
        background: #f5f8fc;
        color: #52647a;
        padding: 14px 11px;
        text-align: left;
        white-space: nowrap;
      }

      .c45-table td {
        padding: 13px 11px;
        border-top: 1px solid #edf1f5;
      }

      .c45-table tbody tr:hover {
        background: #f9fbfd;
      }

      .c45-pill {
        display: inline-block;
        padding: 5px 9px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 11px;
      }

      .c45-pill.rendah {
        background: #e9f7ef;
        color: #187444;
      }

      .c45-pill.sedang {
        background: #fff5dc;
        color: #956500;
      }

      .c45-pill.tinggi {
        background: #fdecec;
        color: #bf3030;
      }

      .c45-row-actions {
        display: flex;
        gap: 5px;
      }

      .c45-row-actions button {
        padding: 6px 9px;
        font-size: 11px;
      }

      .c45-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-top: 16px;
        font-size: 12px;
      }

      .c45-feedback {
        padding: 12px;
        margin: 12px 0;
        border-radius: 7px;
        font-size: 13px;
      }

      .c45-feedback.success {
        background: #eaf8ef;
        color: #187444;
      }

      .c45-feedback.error {
        background: #fff0f0;
        color: #bd3333;
      }

      .c45-modal[hidden] {
        display: none;
      }

      .c45-modal {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 15px;
      }

      .c45-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 30, 48, .55);
      }

      .c45-modal-box {
        position: relative;
        background: white;
        width: min(520px, 100%);
        max-height: 90vh;
        overflow-y: auto;
        border-radius: 12px;
        padding: 22px;
      }

      .c45-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 17px;
      }

      .c45-modal-header h3 {
        margin: 0;
      }

      .c45-modal form {
        display: grid;
        gap: 13px;
      }

      .c45-modal form label {
        display: grid;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
      }

      .c45-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 9px;
        margin-top: 8px;
      }

      @media(max-width: 900px) {
        .c45-statistics {
          grid-template-columns: repeat(2, 1fr);
        }

        .c45-filter-panel {
          grid-template-columns: repeat(2, 1fr);
        }

        #c45-search {
          grid-column: span 2;
        }
      }

      @media(max-width: 500px) {
        .c45-statistics {
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .c45-filter-panel {
          grid-template-columns: 1fr;
        }

        #c45-search {
          grid-column: auto;
        }

        .c45-footer {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =======================================================
     05. MEMUAT DATA
  ======================================================= */

  async function loadDataset() {
    if (state.loading) return;

    state.loading = true;

    const tbody = $("#c45-table-body");

    if (tbody) {
      tbody.innerHTML = `
        <tr><td colspan="9">Memuat data...</td></tr>
      `;
    }

    try {
      const params = new URLSearchParams({
        page: state.page,
        limit: state.limit,
        search: state.search,
        ...state.filters,
      });

      const result = await request(`${API}?${params.toString()}`);

      const data = result.data || {};

      state.items = data.items || [];

      const pagination = data.pagination || {};

      state.page = Number(pagination.page || 1);
      state.totalPages = Number(pagination.total_pages || 1);

      renderTable();
      renderStatistics(data.statistics || {});
      renderPagination(pagination);
    } catch (error) {
      console.error(error);

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9">
              ${escapeHTML(error.message)}
            </td>
          </tr>
        `;
      }

      notify(error.message, "error");
    } finally {
      state.loading = false;
    }
  }

  /* =======================================================
     06. RENDER TABEL
  ======================================================= */

  function renderTable() {
    const tbody = $("#c45-table-body");

    if (!tbody) return;

    if (!state.items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:30px">
            Dataset tidak ditemukan.
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML = state.items
      .map((item, index) => {
        const label = String(item.label_prioritas || "");
        const className = label.toLowerCase();

        const rowNumber = (state.page - 1) * state.limit + index + 1;

        return `
        <tr>
          <td>${rowNumber}</td>

          <td><strong>${escapeHTML(item.kode_data)}</strong></td>

          <td>${escapeHTML(item.nama_fasilitas)}</td>

          <td>${escapeHTML(item.tingkat_kerusakan_x1)}</td>

          <td>${escapeHTML(item.dampak_akademik_x2)}</td>

          <td>${escapeHTML(item.frekuensi_penggunaan_x3)}</td>

          <td>
            <span class="c45-pill ${escapeHTML(className)}">
              ${escapeHTML(label)}
            </span>
          </td>

          <td>${escapeHTML(item.sumber_data)}</td>

          <td>
            <div class="c45-row-actions">
              <button
                type="button"
                data-action="edit"
                data-id="${escapeHTML(item.id_data)}">
                Edit
              </button>

              <button
                type="button"
                data-action="delete"
                data-id="${escapeHTML(item.id_data)}">
                Hapus
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join("");
  }

  /* =======================================================
     07. STATISTIK
  ======================================================= */

  function renderStatistics(stats) {
    $("#c45-total").textContent = Number(stats.total || 0);

    $("#c45-low").textContent = Number(stats.rendah || 0);

    $("#c45-medium").textContent = Number(stats.sedang || 0);

    $("#c45-high").textContent = Number(stats.tinggi || 0);
  }

  /* =======================================================
     08. PAGINATION
  ======================================================= */

  function renderPagination(data) {
    const total = Number(data.total || 0);

    const page = Number(data.page || 1);

    const pages = Number(data.total_pages || 1);

    $("#c45-page-info").textContent =
      `Halaman ${page} dari ${pages} | Total ${total} data`;

    $("#c45-prev").disabled = page <= 1;

    $("#c45-next").disabled = page >= pages;
  }

  /* =======================================================
     09. MODAL
  ======================================================= */

  function openModal(item = null) {
    state.editing = item;

    const modal = $("#c45-modal");
    const form = $("#c45-form");

    form.reset();

    $("#c45-modal-title").textContent = item
      ? "Edit Dataset"
      : "Tambah Dataset";

    if (item) {
      const fields = [
        "kode_data",
        "nama_fasilitas",
        "tingkat_kerusakan_x1",
        "dampak_akademik_x2",
        "frekuensi_penggunaan_x3",
        "label_prioritas",
        "sumber_data",
      ];

      fields.forEach((name) => {
        const field = form.elements[name];

        if (field) {
          field.value = item[name] ?? "";
        }
      });
    }

    modal.hidden = false;
  }

  function closeModal() {
    $("#c45-modal").hidden = true;
    state.editing = null;
  }

  /* =======================================================
     10. SIMPAN DATA
  ======================================================= */

  async function saveDataset(event) {
    event.preventDefault();

    const form = event.currentTarget;

    const payload = Object.fromEntries(new FormData(form).entries());

    const editing = state.editing;

    if (editing) {
      payload.id_data = editing.id_data;
    }

    const button = $("#c45-save");

    button.disabled = true;
    button.textContent = "Menyimpan...";

    try {
      await request(API, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      closeModal();

      notify(
        editing
          ? "Dataset berhasil diperbarui."
          : "Dataset berhasil ditambahkan.",
      );

      await loadDataset();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Simpan Dataset";
    }
  }

  /* =======================================================
     11. EDIT DATA
  ======================================================= */

  function editDataset(id) {
    const item = state.items.find((row) => String(row.id_data) === String(id));

    if (!item) {
      notify("Data tidak ditemukan.", "error");
      return;
    }

    openModal(item);
  }

  /* =======================================================
     12. HAPUS DATA
  ======================================================= */

  async function deleteDataset(id) {
    const item = state.items.find((row) => String(row.id_data) === String(id));

    if (!item) return;

    const confirmed = window.confirm(`Hapus dataset ${item.kode_data}?`);

    if (!confirmed) return;

    try {
      await request(API, {
        method: "DELETE",
        body: JSON.stringify({
          id_data: Number(id),
        }),
      });

      notify("Dataset berhasil dihapus.");

      await loadDataset();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  /* =======================================================
     13. IMPORT CSV
  ======================================================= */

  async function importDataset(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      notify("File harus berformat CSV.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Import file ${file.name} ke dataset utama?`,
    );

    if (!confirmed) return;

    const form = new FormData();

    form.append("file_dataset", file);

    const button = $("#c45-import-button");

    button.disabled = true;
    button.textContent = "Mengimpor...";

    try {
      const result = await request(`${API}?action=import`, {
        method: "POST",
        body: form,
      });

      const imported = result.data || {};

      notify(
        `Berhasil menambahkan ${imported.jumlah_ditambahkan || 0} data. Duplikat dilewati: ${imported.jumlah_duplikat_dilewati || 0}.`,
      );

      state.page = 1;

      await loadDataset();
    } catch (error) {
      notify(error.message, "error");

      console.error("Import CSV:", error);
    } finally {
      button.disabled = false;
      button.textContent = "Import Dataset";

      $("#c45-file-input").value = "";
    }
  }

  /* =======================================================
     14. FILTER
  ======================================================= */

  function applyFilters() {
    state.search = $("#c45-search").value.trim();

    state.filters = {
      x1: $("#c45-filter-x1").value,
      x2: $("#c45-filter-x2").value,
      x3: $("#c45-filter-x3").value,
      label: $("#c45-filter-label").value,
    };

    state.page = 1;

    loadDataset();
  }

  function resetFilters() {
    $("#c45-search").value = "";

    $("#c45-filter-x1").value = "";
    $("#c45-filter-x2").value = "";
    $("#c45-filter-x3").value = "";
    $("#c45-filter-label").value = "";

    state.search = "";

    state.filters = {
      x1: "",
      x2: "",
      x3: "",
      label: "",
    };

    state.page = 1;

    loadDataset();
  }

  /* =======================================================
     15. EVENT LISTENER
  ======================================================= */

  function bindEvents(root) {
    $("#c45-add-button").addEventListener("click", () => openModal());

    $("#c45-import-button").addEventListener("click", () =>
      $("#c45-file-input").click(),
    );

    $("#c45-file-input").addEventListener("change", (event) =>
      importDataset(event.target.files?.[0]),
    );

    $("#c45-form").addEventListener("submit", saveDataset);

    $("#c45-close-modal").addEventListener("click", closeModal);

    $("#c45-cancel").addEventListener("click", closeModal);

    $("#c45-modal").addEventListener("click", (event) => {
      if (event.target.hasAttribute("data-close-modal")) {
        closeModal();
      }
    });

    $("#c45-table-body").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");

      if (!button) return;

      const action = button.dataset.action;
      const id = button.dataset.id;

      if (action === "edit") {
        editDataset(id);
      }

      if (action === "delete") {
        deleteDataset(id);
      }
    });

    $("#c45-search").addEventListener("input", debounce(applyFilters, 350));

    [
      "#c45-filter-x1",
      "#c45-filter-x2",
      "#c45-filter-x3",
      "#c45-filter-label",
    ].forEach((selector) => {
      $(selector).addEventListener("change", applyFilters);
    });

    $("#c45-reset-filter").addEventListener("click", resetFilters);

    $("#c45-prev").addEventListener("click", () => {
      if (state.page > 1) {
        state.page--;
        loadDataset();
      }
    });

    $("#c45-next").addEventListener("click", () => {
      if (state.page < state.totalPages) {
        state.page++;
        loadDataset();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    });
  }

  /* =======================================================
     16. DEBOUNCE
  ======================================================= */

  function debounce(callback, delay) {
    let timer;

    return (...args) => {
      clearTimeout(timer);

      timer = setTimeout(() => callback(...args), delay);
    };
  }

  /* =======================================================
     17. INISIALISASI
  ======================================================= */

  async function init() {
    const root = $("#dataset-c45-app");

    if (!root) return;

    buildInterface(root);

    bindEvents(root);

    await loadDataset();

    console.log("[SIPFAS] Modul Dataset C4.5 berhasil diinisialisasi.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
