(() => {
  "use strict";

  const API_URL = "../../api/admin/kategori-fasilitas.php";

  const state = {
    categories: [],
    filteredCategories: [],
    selectedId: null,
    search: "",
    status: "all",
    currentPage: 1,
    pageSize: 5,
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);

  const $$ = (selector, parent = document) => [
    ...parent.querySelectorAll(selector),
  ];

  const normalize = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase();

  const escapeHTML = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  /* ========================================================
     01. MAPPING DATA KATEGORI
  ======================================================== */

  function mapCategory(row) {
    const status = normalize(row.status_kategori ?? row.status);

    return {
      id: Number(row.id_kategori ?? row.id),

      kodeKategori: String(row.kode_kategori ?? row.kodeKategori ?? ""),

      namaKategori: String(row.nama_kategori ?? row.namaKategori ?? ""),

      deskripsi: String(row.deskripsi ?? ""),

      jumlahFasilitas: Number(row.jumlah_fasilitas ?? row.jumlahFasilitas ?? 0),

      jumlahUnit: Number(row.jumlah_unit ?? row.jumlahUnit ?? 0),

      status: status === "nonaktif" ? "nonaktif" : "aktif",
    };
  }

  /* ========================================================
     02. REQUEST API
  ======================================================== */

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",

      headers: {
        Accept: "application/json",

        ...(options.body ? { "Content-Type": "application/json" } : {}),

        ...(options.headers || {}),
      },

      ...options,
    });

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error("Respons server bukan JSON yang valid.");
    }

    if (!response.ok || result.success === false) {
      throw new Error(
        result.message || `Permintaan gagal (${response.status}).`,
      );
    }

    return result;
  }

  /* ========================================================
     03. LOAD DATA KATEGORI
  ======================================================== */

  async function loadCategories() {
    const params = new URLSearchParams({
      page: "1",
      limit: "100",
    });

    if (state.search) {
      params.set("search", state.search);
    }

    if (state.status !== "all") {
      params.set("status", state.status === "aktif" ? "Aktif" : "Nonaktif");
    }

    try {
      const result = await request(`${API_URL}?${params.toString()}`);

      const items = result.data?.items ?? result.data ?? [];

      state.categories = Array.isArray(items) ? items.map(mapCategory) : [];

      applyFilter(false);
    } catch (error) {
      console.error("Gagal memuat kategori:", error);

      const tbody = $("#category-table-body");

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="category-empty">
              ${escapeHTML(error.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  /* ========================================================
     04. FILTER KATEGORI
  ======================================================== */

  function applyFilter(resetPage = true) {
    state.filteredCategories = state.categories.filter((item) => {
      const matchesSearch = [
        item.kodeKategori,
        item.namaKategori,
        item.deskripsi,
      ].some((value) => normalize(value).includes(state.search));

      const matchesStatus =
        state.status === "all" || item.status === state.status;

      return matchesSearch && matchesStatus;
    });

    if (resetPage) {
      state.currentPage = 1;
    }

    renderTable();
  }

  /* ========================================================
     05. RENDER TABEL
  ======================================================== */

  function renderTable() {
    const tbody = $("#category-table-body");

    if (!tbody) return;

    const totalPages = Math.max(
      1,
      Math.ceil(state.filteredCategories.length / state.pageSize),
    );

    state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);

    const start = (state.currentPage - 1) * state.pageSize;

    const displayed = state.filteredCategories.slice(
      start,
      start + state.pageSize,
    );

    if (!displayed.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="category-empty">
            Data kategori tidak ditemukan.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = displayed
        .map((item, index) => {
          const active = item.status === "aktif";

          return `
            <tr data-id="${escapeHTML(item.id)}">

              <td>${start + index + 1}</td>

              <td>
                <strong class="category-code">
                  ${escapeHTML(item.kodeKategori)}
                </strong>
              </td>

              <td>
                <strong class="category-name">
                  ${escapeHTML(item.namaKategori)}
                </strong>
              </td>

              <td>
                ${escapeHTML(item.deskripsi)}
              </td>

              <td>
                <span class="facility-count">
                  <svg viewBox="0 0 24 24">
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="13"
                      rx="1"
                    />
                    <path d="M8 21H16M12 17V21"/>
                  </svg>

                  ${item.jumlahFasilitas} Unit
                </span>
              </td>

              <td>
                <span class="status-badge ${active ? "" : "inactive"}">
                  ${active ? "Aktif" : "Nonaktif"}
                </span>
              </td>

              <td>
                <div class="action-buttons">

                  <label
                    for="edit-category-modal"
                    class="action-btn edit-btn"
                    data-id="${escapeHTML(item.id)}"
                    title="Edit kategori"
                    role="button"
                    tabindex="0"
                    aria-label="Edit ${escapeHTML(item.namaKategori)}"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M16.5 3.5A2.12 2.12 0 0 1 19.5 6.5L8 18L4 19L5 15Z"/>
                    </svg>
                  </label>

                  <label
                    for="delete-category-modal"
                    class="action-btn delete-btn"
                    data-id="${escapeHTML(item.id)}"
                    title="Hapus kategori"
                    role="button"
                    tabindex="0"
                    aria-label="Hapus ${escapeHTML(item.namaKategori)}"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M4 7H20"/>
                      <path d="M10 11V17M14 11V17"/>
                      <path d="M5 7L6 21H18L19 7"/>
                      <path d="M9 7V4H15V7"/>
                    </svg>
                  </label>

                </div>
              </td>

            </tr>
          `;
        })
        .join("");
    }

    renderPagination(totalPages);
  }

  /* ========================================================
     06. PAGINATION
  ======================================================== */

  function renderPagination(totalPages) {
    const pagination = $(".pagination");

    if (!pagination) return;

    let html = `
      <button
        type="button"
        data-page="prev"
        aria-label="Halaman sebelumnya"
        ${state.currentPage === 1 ? "disabled" : ""}
      >
        ‹
      </button>
    `;

    for (let page = 1; page <= totalPages; page++) {
      html += `
        <button
          type="button"
          data-page="${page}"
          class="${page === state.currentPage ? "active" : ""}"
          ${page === state.currentPage ? 'aria-current="page"' : ""}
        >
          ${page}
        </button>
      `;
    }

    html += `
      <button
        type="button"
        data-page="next"
        aria-label="Halaman berikutnya"
        ${state.currentPage === totalPages ? "disabled" : ""}
      >
        ›
      </button>
    `;

    pagination.innerHTML = html;
  }

  function changePage(page) {
    const pages = Math.max(
      1,
      Math.ceil(state.filteredCategories.length / state.pageSize),
    );

    state.currentPage =
      page === "prev"
        ? state.currentPage - 1
        : page === "next"
          ? state.currentPage + 1
          : Number(page);

    state.currentPage = Math.max(1, Math.min(state.currentPage, pages));

    renderTable();
  }

  /* ========================================================
     07. TAMBAH KATEGORI
     POST DATA KE DATABASE MYSQL
  ======================================================== */

  function openAdd() {
    const form = $("#add-category-form");

    if (!form) {
      return alert("Form tambah kategori tidak ditemukan.");
    }

    form.reset();

    $("#add-status").value = "aktif";

    $("#add-category-modal").checked = true;

    setTimeout(() => {
      $("#add-code")?.focus();
    }, 100);
  }

  async function addCategory() {
    const code = $("#add-code").value.trim();
    const name = $("#add-name").value.trim();

    const description = $("#add-description").value.trim();

    const status = normalize($("#add-status").value);

    if (!code || !name) {
      return alert("Kode kategori dan nama kategori wajib diisi.");
    }

    if (!["aktif", "nonaktif"].includes(status)) {
      return alert("Status kategori tidak valid.");
    }

    const saveButton = $(".add-save-btn");

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Menyimpan...";
    }

    try {
      const result = await request(API_URL, {
        method: "POST",

        body: JSON.stringify({
          kode_kategori: code,
          nama_kategori: name,
          deskripsi: description,

          jumlah_unit: 0,

          status_kategori: status === "aktif" ? "Aktif" : "Nonaktif",
        }),
      });

      console.log("Kategori berhasil disimpan:", result);

      $("#add-category-modal").checked = false;

      $("#add-category-form").reset();

      state.search = "";
      state.status = "all";
      state.currentPage = 1;

      $("#search-category").value = "";
      $("#status-filter").value = "all";

      await loadCategories();

      alert("Kategori fasilitas berhasil ditambahkan.");
    } catch (error) {
      console.error("Gagal menambahkan kategori:", error);

      alert(error.message || "Kategori gagal ditambahkan.");
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Simpan Kategori";
      }
    }
  }

  /* ========================================================
     08. EDIT KATEGORI
  ======================================================== */

  function openEdit(id) {
    const item = state.categories.find(
      (category) => String(category.id) === String(id),
    );

    if (!item) {
      return alert("Data kategori tidak ditemukan.");
    }

    state.selectedId = item.id;

    $("#edit-code").value = item.kodeKategori;
    $("#edit-name").value = item.namaKategori;
    $("#edit-description").value = item.deskripsi;
    $("#edit-total").value = `${item.jumlahFasilitas} Unit`;

    $("#edit-status").value = item.status;

    $("#edit-category-modal").checked = true;
  }

  async function saveEdit() {
    if (state.selectedId === null) return;

    const code = $("#edit-code").value.trim();
    const name = $("#edit-name").value.trim();

    const description = $("#edit-description").value.trim();

    const status = normalize($("#edit-status").value);

    if (!code || !name || !description) {
      return alert("Semua kolom wajib diisi.");
    }

    if (!["aktif", "nonaktif"].includes(status)) {
      return alert("Status kategori tidak valid.");
    }

    const item = state.categories.find(
      (category) => String(category.id) === String(state.selectedId),
    );

    if (!item) {
      return alert("Data kategori tidak ditemukan.");
    }

    const saveButton = $(".save-btn:not(.add-save-btn)");

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Menyimpan...";
    }

    try {
      await request(API_URL, {
        method: "PUT",

        body: JSON.stringify({
          id_kategori: state.selectedId,
          kode_kategori: code,
          nama_kategori: name,
          deskripsi: description,

          // Mempertahankan jumlah unit sebelumnya.
          jumlah_unit: item.jumlahUnit,

          status_kategori: status === "aktif" ? "Aktif" : "Nonaktif",
        }),
      });

      $("#edit-category-modal").checked = false;

      state.selectedId = null;

      alert("Kategori berhasil diperbarui.");

      await loadCategories();
    } catch (error) {
      console.error(error);

      alert(error.message || "Kategori gagal diperbarui.");
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Simpan Perubahan";
      }
    }
  }

  /* ========================================================
     09. HAPUS KATEGORI
  ======================================================== */

  function openDelete(id) {
    const item = state.categories.find(
      (category) => String(category.id) === String(id),
    );

    if (!item) {
      return alert("Data kategori tidak ditemukan.");
    }

    state.selectedId = item.id;

    const text = $(".delete-confirm-text");

    if (text) {
      text.innerHTML = `
        Apakah kamu yakin ingin menghapus kategori

        <strong>
          ${escapeHTML(item.namaKategori)}
          (${escapeHTML(item.kodeKategori)})
        </strong>?

        Tindakan ini tidak dapat dibatalkan.
      `;
    }

    $("#delete-category-modal").checked = true;
  }

  async function deleteCategory() {
    if (state.selectedId === null) return;

    const item = state.categories.find(
      (category) => String(category.id) === String(state.selectedId),
    );

    if (!item) return;

    if (item.jumlahFasilitas > 0) {
      alert(
        `Kategori ${item.namaKategori} masih memiliki ${item.jumlahFasilitas} fasilitas. Ubah statusnya menjadi Nonaktif jika kategori tidak lagi digunakan.`,
      );

      $("#delete-category-modal").checked = false;

      state.selectedId = null;

      return;
    }

    const deleteButton = $(".confirm-delete-btn");

    if (deleteButton) {
      deleteButton.disabled = true;
      deleteButton.textContent = "Menghapus...";
    }

    try {
      await request(
        `${API_URL}?id_kategori=${encodeURIComponent(state.selectedId)}`,
        {
          method: "DELETE",
        },
      );

      $("#delete-category-modal").checked = false;

      state.selectedId = null;

      alert("Kategori berhasil dihapus.");

      await loadCategories();
    } catch (error) {
      console.error(error);

      alert(error.message || "Kategori gagal dihapus.");
    } finally {
      if (deleteButton) {
        deleteButton.disabled = false;
        deleteButton.textContent = "Hapus Kategori";
      }
    }
  }

  /* ========================================================
     10. EVENT LISTENER
  ======================================================== */

  function bindEvents() {
    /* ----------------------------------------
       TOMBOL TAMBAH KATEGORI
    ---------------------------------------- */

    $("#open-add-category")?.addEventListener("click", openAdd);

    /* ----------------------------------------
       FORM TAMBAH KATEGORI
    ---------------------------------------- */

    $("#add-category-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      addCategory();
    });

    /* ----------------------------------------
       SEARCH KATEGORI
    ---------------------------------------- */

    $("#search-category")?.addEventListener("input", function () {
      state.search = normalize(this.value);
      loadCategories();
    });

    /* ----------------------------------------
       FILTER STATUS
    ---------------------------------------- */

    $("#status-filter")?.addEventListener("change", function () {
      state.status = this.value;
      loadCategories();
    });

    /* ----------------------------------------
       AKSI TABEL
    ---------------------------------------- */

    const tbody = $("#category-table-body");

    tbody?.addEventListener("click", (event) => {
      const edit = event.target.closest(".edit-btn");

      const del = event.target.closest(".delete-btn");

      if (edit) {
        event.preventDefault();
        event.stopPropagation();

        openEdit(edit.dataset.id);
      } else if (del) {
        event.preventDefault();
        event.stopPropagation();

        openDelete(del.dataset.id);
      }
    });

    /* ----------------------------------------
       AKSESIBILITAS TOMBOL AKSI
    ---------------------------------------- */

    tbody?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const button = event.target.closest(".edit-btn, .delete-btn");

      if (!button) return;

      event.preventDefault();

      button.classList.contains("edit-btn")
        ? openEdit(button.dataset.id)
        : openDelete(button.dataset.id);
    });

    /* ----------------------------------------
       SIMPAN EDIT
    ---------------------------------------- */

    $(".save-btn:not(.add-save-btn)")?.addEventListener("click", (event) => {
      event.preventDefault();
      saveEdit();
    });

    /* ----------------------------------------
       KONFIRMASI HAPUS
    ---------------------------------------- */

    $(".confirm-delete-btn")?.addEventListener("click", (event) => {
      event.preventDefault();
      deleteCategory();
    });

    /* ----------------------------------------
       PAGINATION
    ---------------------------------------- */

    $(".pagination")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-page]");

      if (button && !button.disabled) {
        changePage(button.dataset.page);
      }
    });

    /* ----------------------------------------
       TUTUP MODAL DENGAN ESCAPE
    ---------------------------------------- */

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        $("#add-category-modal").checked = false;
        $("#edit-category-modal").checked = false;
        $("#delete-category-modal").checked = false;

        state.selectedId = null;
      }
    });
  }

  /* ========================================================
     11. INIT
  ======================================================== */

  function init() {
    if (!$("#category-table-body")) return;

    bindEvents();

    loadCategories();

    console.log("SIPFAS Kategori Fasilitas terhubung ke API.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
