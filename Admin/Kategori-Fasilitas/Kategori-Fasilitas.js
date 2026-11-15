
/* =========================================================
   SIPFAS - ADMIN KATEGORI FASILITAS
   File: Kategori-Fasilitas.js

   Fitur:
   1. Pencarian kategori
   2. Filter status
   3. Edit kategori
   4. Hapus kategori
   5. Pagination
   6. Menghitung jumlah fasilitas
   7. LocalStorage
   8. Validasi kode dan nama kategori
========================================================= */

(() => {
  "use strict";

  // =====================================================
  // 1. KONFIGURASI
  // =====================================================

  const STORAGE_KEY = "sipfas_kategori_fasilitas";
  const FACILITY_KEY = "sipfas_fasilitas";

  const state = {
    categories: [],
    filteredCategories: [],
    selectedId: null,
    search: "",
    status: "all",
    currentPage: 1,
    pageSize: 5
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

  function getValue(object, keys, fallback = "") {
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

  function getUnit(text) {
    return String(text ?? "")
      .replace(/[\d.,\s]+/g, "")
      .trim() || "Unit";
  }


  // =====================================================
  // 3. LOCAL STORAGE
  // =====================================================

  function readStorage(key) {
    try {
      const raw = localStorage.getItem(key);

      if (raw === null) return null;

      const data = JSON.parse(raw);

      if (!Array.isArray(data)) {
        console.error("Format LocalStorage tidak valid:", key);
        return null;
      }

      return data;

    } catch (error) {
      console.error("Gagal membaca LocalStorage:", error);
      return null;
    }
  }

  function saveCategories() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.categories)
      );

      return true;

    } catch (error) {
      console.error("Gagal menyimpan kategori:", error);
      alert("Data kategori gagal disimpan.");
      return false;
    }
  }


  // =====================================================
  // 4. MEMBACA DATA AWAL DARI HTML
  // =====================================================

  function getInitialData() {

    const rows = $$("#category-table-body tr");

    return rows.map(row => {

      const cells = $$("td", row);

      const code =
        $(".category-code", row)?.textContent.trim() || "";

      const name =
        $(".category-name", row)?.textContent.trim() || "";

      const description =
        cells[3]?.textContent.trim() || "";

      const countText =
        $(".facility-count", row)?.textContent.trim() || "0 Unit";

      const match = countText.match(/\d+/);

      const total = match ? Number(match[0]) : 0;

      const status =
        $(".status-badge", row)?.textContent.trim() || "Aktif";

      return {
        id: code,
        kodeKategori: code,
        namaKategori: name,
        deskripsi: description,
        jumlahAwal: total,
        satuan: getUnit(countText),
        status: normalize(status) === "nonaktif"
          ? "nonaktif"
          : "aktif"
      };

    }).filter(item => item.kodeKategori);

  }


  // =====================================================
  // 5. MEMUAT DATA KATEGORI
  // =====================================================

  function loadCategories() {

    const stored = readStorage(STORAGE_KEY);

    if (stored !== null) {

      state.categories = stored.map(item => {

        const code = String(
          getValue(item, ["kodeKategori", "kode", "id"])
        );

        return {
          ...item,
          id: code,
          kodeKategori: code,
          namaKategori: String(
            getValue(item, ["namaKategori", "nama"])
          ),
          deskripsi: String(
            getValue(item, ["deskripsi", "keterangan"])
          ),
          status: normalize(item.status) === "nonaktif"
            ? "nonaktif"
            : "aktif"
        };

      });

    } else {

      state.categories = getInitialData();

      saveCategories();

    }

    applyFilter();

  }


  // =====================================================
  // 6. MENGHITUNG JUMLAH FASILITAS
  // =====================================================

  function getFacilityCount(category) {

    const facilities = readStorage(FACILITY_KEY);

    // Jika data fasilitas belum pernah disimpan,
    // gunakan jumlah awal dari HTML.

    if (facilities === null) {
      return category.jumlahAwal ?? 0;
    }

    // Jika data fasilitas tersedia, hitung berdasarkan
    // nama kategori yang digunakan oleh fasilitas.

    return facilities.filter(facility => {

      const categoryName = normalize(
        getValue(facility, [
          "kategori",
          "namaKategori",
          "nama_kategori"
        ])
      );

      return categoryName === normalize(category.namaKategori);

    }).length;

  }


  // =====================================================
  // 7. PENCARIAN DAN FILTER STATUS
  // =====================================================

  function applyFilter() {

    state.filteredCategories = state.categories.filter(item => {

      const code = normalize(item.kodeKategori);
      const name = normalize(item.namaKategori);
      const description = normalize(item.deskripsi);

      const matchesSearch =
        code.includes(state.search) ||
        name.includes(state.search) ||
        description.includes(state.search);

      const matchesStatus =
        state.status === "all" ||
        normalize(item.status) === state.status;

      return matchesSearch && matchesStatus;

    });

    state.currentPage = 1;

    renderTable();

  }


  // =====================================================
  // 8. MENAMPILKAN TABEL
  // =====================================================

  function renderTable() {

    const tbody = $("#category-table-body");

    if (!tbody) return;

    const totalPages = Math.max(
      1,
      Math.ceil(
        state.filteredCategories.length / state.pageSize
      )
    );

    state.currentPage = Math.min(
      Math.max(1, state.currentPage),
      totalPages
    );

    const start =
      (state.currentPage - 1) * state.pageSize;

    const displayed = state.filteredCategories.slice(
      start,
      start + state.pageSize
    );

    if (displayed.length === 0) {

      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="category-empty">
            Data kategori tidak ditemukan.
          </td>
        </tr>
      `;

    } else {

      tbody.innerHTML = displayed.map((item, index) => {

        const total = getFacilityCount(item);

        const unit = item.satuan || "Unit";

        const active = normalize(item.status) === "aktif";

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
                  <rect x="3" y="4" width="18" height="13" rx="1"/>
                  <path d="M8 21H16M12 17V21"/>
                </svg>
                ${total} ${escapeHTML(unit)}
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

      }).join("");

    }

    renderPagination(totalPages);

  }


  // =====================================================
  // 9. PAGINATION
  // =====================================================

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

    const totalPages = Math.max(
      1,
      Math.ceil(
        state.filteredCategories.length / state.pageSize
      )
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
  // 10. MEMBUKA MODAL EDIT
  // =====================================================

  function openEdit(id) {

    const item = state.categories.find(
      category => String(category.id) === String(id)
    );

    if (!item) {
      alert("Data kategori tidak ditemukan.");
      return;
    }

    state.selectedId = item.id;

    $("#edit-code").value = item.kodeKategori;

    $("#edit-name").value = item.namaKategori;

    $("#edit-description").value = item.deskripsi;

    $("#edit-total").value =
      `${getFacilityCount(item)} ${item.satuan || "Unit"}`;

    $("#edit-status").value = normalize(item.status);

    $("#edit-category-modal").checked = true;

  }


  // =====================================================
  // 11. MENYIMPAN PERUBAHAN EDIT
  // =====================================================

  function saveEdit() {

    if (state.selectedId === null) return;

    const code = $("#edit-code").value.trim();

    const name = $("#edit-name").value.trim();

    const description =
      $("#edit-description").value.trim();

    const status = normalize($("#edit-status").value);

    if (!code || !name || !description) {
      alert("Semua kolom wajib diisi.");
      return;
    }

    if (!["aktif", "nonaktif"].includes(status)) {
      alert("Status kategori tidak valid.");
      return;
    }

    const duplicateCode = state.categories.some(item => {

      return (
        normalize(item.kodeKategori) === normalize(code) &&
        String(item.id) !== String(state.selectedId)
      );

    });

    if (duplicateCode) {
      alert("Kode kategori sudah digunakan.");
      return;
    }

    const duplicateName = state.categories.some(item => {

      return (
        normalize(item.namaKategori) === normalize(name) &&
        String(item.id) !== String(state.selectedId)
      );

    });

    if (duplicateName) {
      alert("Nama kategori sudah digunakan.");
      return;
    }

    const index = state.categories.findIndex(
      item => String(item.id) === String(state.selectedId)
    );

    if (index === -1) return;

    const previous = state.categories[index];

    const oldName = previous.namaKategori;

    state.categories[index] = {
      ...previous,
      id: code,
      kodeKategori: code,
      namaKategori: name,
      deskripsi: description,
      status: status
    };

    if (!saveCategories()) {
      state.categories[index] = previous;
      return;
    }

    // Jika nama kategori berubah, sesuaikan relasi
    // nama kategori pada data fasilitas.

    if (normalize(oldName) !== normalize(name)) {

      const facilities = readStorage(FACILITY_KEY);

      if (facilities !== null) {

        const updatedFacilities = facilities.map(facility => {

          const currentName = normalize(
            getValue(facility, [
              "kategori",
              "namaKategori",
              "nama_kategori"
            ])
          );

          if (currentName !== normalize(oldName)) {
            return facility;
          }

          const updated = { ...facility };

          if ("kategori" in updated) {
            updated.kategori = name;
          }

          if ("namaKategori" in updated) {
            updated.namaKategori = name;
          }

          if ("nama_kategori" in updated) {
            updated.nama_kategori = name;
          }

          return updated;

        });

        try {
          localStorage.setItem(
            FACILITY_KEY,
            JSON.stringify(updatedFacilities)
          );
        } catch (error) {
          console.error("Gagal memperbarui relasi fasilitas:", error);
        }

      }

    }

    state.selectedId = null;

    $("#edit-category-modal").checked = false;

    applyFilter();

    alert("Kategori berhasil diperbarui.");

  }


  // =====================================================
  // 12. MEMBUKA MODAL HAPUS
  // =====================================================

  function openDelete(id) {

    const item = state.categories.find(
      category => String(category.id) === String(id)
    );

    if (!item) {
      alert("Data kategori tidak ditemukan.");
      return;
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


  // =====================================================
  // 13. MENGHAPUS KATEGORI
  // =====================================================

  function deleteCategory() {

    if (state.selectedId === null) return;

    const item = state.categories.find(
      category => String(category.id) === String(state.selectedId)
    );

    if (!item) return;

    const facilityCount = getFacilityCount(item);

    // Kategori yang masih digunakan tidak boleh dihapus.

    if (facilityCount > 0) {

      alert(
        `Kategori ${item.namaKategori} masih memiliki ` +
        `${facilityCount} fasilitas. Ubah statusnya menjadi ` +
        "Nonaktif jika kategori tidak lagi digunakan."
      );

      $("#delete-category-modal").checked = false;

      state.selectedId = null;

      return;

    }

    const previous = [...state.categories];

    state.categories = state.categories.filter(
      category => String(category.id) !== String(state.selectedId)
    );

    if (!saveCategories()) {

      state.categories = previous;

      return;

    }

    state.selectedId = null;

    $("#delete-category-modal").checked = false;

    applyFilter();

    alert("Kategori berhasil dihapus.");

  }


  // =====================================================
  // 14. EVENT LISTENER
  // =====================================================

  function bindEvents() {

    // -----------------------------------------------
    // PENCARIAN
    // -----------------------------------------------

    const searchInput = $("#search-category");

    searchInput?.addEventListener("input", function() {

      state.search = normalize(this.value);

      applyFilter();

    });


    // -----------------------------------------------
    // FILTER STATUS
    // -----------------------------------------------

    const statusFilter = $("#status-filter");

    statusFilter?.addEventListener("change", function() {

      state.status = this.value;

      applyFilter();

    });


    // -----------------------------------------------
    // TOMBOL EDIT DAN HAPUS
    // -----------------------------------------------

    const tbody = $("#category-table-body");

    tbody?.addEventListener("click", function(event) {

      const editButton = event.target.closest(".edit-btn");

      const deleteButton = event.target.closest(".delete-btn");


      if (editButton) {

        // Mencegah perilaku bawaan label.
        event.preventDefault();

        event.stopPropagation();

        openEdit(editButton.dataset.id);

        return;

      }


      if (deleteButton) {

        // Mencegah perilaku bawaan label.
        event.preventDefault();

        event.stopPropagation();

        openDelete(deleteButton.dataset.id);

        return;

      }

    });


    // -----------------------------------------------
    // AKSI MELALUI KEYBOARD
    // -----------------------------------------------

    tbody?.addEventListener("keydown", function(event) {

      if (
        event.key !== "Enter" &&
        event.key !== " "
      ) return;

      const button = event.target.closest(
        ".edit-btn, .delete-btn"
      );

      if (!button) return;

      event.preventDefault();

      if (button.classList.contains("edit-btn")) {

        openEdit(button.dataset.id);

      } else {

        openDelete(button.dataset.id);

      }

    });


    // -----------------------------------------------
    // SIMPAN EDIT
    // -----------------------------------------------

    $(".save-btn")?.addEventListener("click", function(event) {

      event.preventDefault();

      saveEdit();

    });


    // -----------------------------------------------
    // KONFIRMASI HAPUS
    // -----------------------------------------------

    $(".confirm-delete-btn")?.addEventListener(
      "click",
      function(event) {

        event.preventDefault();

        deleteCategory();

      }
    );


    // -----------------------------------------------
    // PAGINATION
    // -----------------------------------------------

    $(".pagination")?.addEventListener("click", function(event) {

      const button = event.target.closest("button[data-page]");

      if (!button || button.disabled) return;

      changePage(button.dataset.page);

    });


    // -----------------------------------------------
    // TUTUP MODAL DENGAN ESCAPE
    // -----------------------------------------------

    document.addEventListener("keydown", function(event) {

      if (event.key === "Escape") {

        $("#edit-category-modal").checked = false;

        $("#delete-category-modal").checked = false;

        state.selectedId = null;

      }

    });


    // -----------------------------------------------
    // SINKRONISASI ANTAR TAB
    // -----------------------------------------------

    window.addEventListener("storage", function(event) {

      if (
        event.key === STORAGE_KEY ||
        event.key === FACILITY_KEY
      ) {

        loadCategories();

      }

    });

  }


  // =====================================================
  // 15. INISIALISASI
  // =====================================================

  function init() {

    if (!$("#category-table-body")) return;

    loadCategories();

    bindEvents();

    console.log(
      "SIPFAS Kategori Fasilitas berhasil dijalankan."
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
