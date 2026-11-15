
/* ==================================================
   SIPFAS - ADMIN DATA FASILITAS
   Penyimpanan: LocalStorage
   Key: sipfas_fasilitas
================================================== */

(() => {
  "use strict";

  const STORAGE_KEY = "sipfas_fasilitas";

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  const state = {
    facilities: [],
    selectedId: null,
    search: "",
    category: "semua"
  };

  // ================================================
  // HELPER
  // ================================================

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]
    );
  }

  function normalizeText(value) {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase("id-ID");
  }

  function frequencyLevel(days) {
    const number = Number(days);

    if (number <= 2) return "Jarang";
    if (number <= 4) return "Sedang";
    return "Sering";
  }

  function frequencyClass(days) {
    const number = Number(days);

    if (number <= 2) return "frequency-rare";
    if (number <= 4) return "frequency-medium";
    return "frequency-often";
  }

  function categoryClass(category) {
    const name = normalizeText(category);

    if (name.includes("laboratorium")) {
      return "category-blue";
    }

    if (name.includes("jaringan")) {
      return "category-gray";
    }

    return "category-blue";
  }

  function getFrequencyNumber(value) {
    const match = String(value ?? "").match(/\d+/);

    if (!match) return 0;

    return Number(match[0]);
  }

  // ================================================
  // LOCAL STORAGE
  // ================================================

  function readStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw === null) return null;

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        console.error(
          "Format sipfas_fasilitas harus berupa array."
        );
        return null;
      }

      return parsed;
    } catch (error) {
      console.error("Gagal membaca data fasilitas:", error);
      return null;
    }
  }

  function saveStorage() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.facilities)
      );

      return true;
    } catch (error) {
      console.error("Gagal menyimpan fasilitas:", error);
      alert("Data gagal disimpan ke LocalStorage.");
      return false;
    }
  }

  // ================================================
  // DATA AWAL DARI HTML
  // ================================================

  function readInitialHTML() {
    return $$(".facility-table tbody tr")
      .filter(row => row.querySelector(".facility-code"))
      .map(row => {
        const cells = $$("td", row);

        const code = $(".facility-code", row)
          ?.textContent.trim() || "";

        const name = $(".facility-name", row)
          ?.textContent.trim() || "";

        const category = $(".category-badge", row)
          ?.textContent.trim() || "";

        const location = cells[4]
          ?.textContent.trim() || "";

        const frequencyText = $(".frequency-badge", row)
          ?.textContent.trim() || "";

        const days = getFrequencyNumber(frequencyText);

        return {
          id: code,
          kodeFasilitas: code,
          namaFasilitas: name,
          kategori: category,
          lokasi: location,
          frekuensi: days
        };
      });
  }

  // ================================================
  // LOAD DATA
  // ================================================

  function loadData() {
    const stored = readStorage();

    if (stored !== null) {
      state.facilities = stored;
    } else {
      state.facilities = readInitialHTML();
      saveStorage();
    }

    renderTable();
  }

  // ================================================
  // FILTER DAN PENCARIAN
  // ================================================

  function getFilteredData() {
    return state.facilities.filter(item => {
      const code = normalizeText(item.kodeFasilitas);
      const name = normalizeText(item.namaFasilitas);
      const location = normalizeText(item.lokasi);
      const category = normalizeText(item.kategori);

      const matchesSearch =
        code.includes(state.search) ||
        name.includes(state.search) ||
        location.includes(state.search);

      const matchesCategory =
        state.category === "semua" ||
        category === state.category;

      return matchesSearch && matchesCategory;
    });
  }

  // ================================================
  // RENDER TABEL
  // ================================================

  function renderTable() {
    const tbody = $(".facility-table tbody");
    const emptyState = $(".empty-state");

    if (!tbody) return;

    const data = getFilteredData();

    if (emptyState) {
      emptyState.style.display =
        data.length === 0 ? "block" : "none";
    }

    if (data.length === 0) {
      tbody.innerHTML = "";
      return;
    }

    tbody.innerHTML = data.map((item, index) => {
      const days = Number(item.frekuensi);
      const level = frequencyLevel(days);
      const freqClass = frequencyClass(days);
      const catClass = categoryClass(item.kategori);

      return `
        <tr>
          <td>${index + 1}</td>

          <td>
            <strong class="facility-code">
              ${escapeHTML(item.kodeFasilitas)}
            </strong>
          </td>

          <td>
            <strong class="facility-name">
              ${escapeHTML(item.namaFasilitas)}
            </strong>
          </td>

          <td>
            <span class="category-badge ${catClass}">
              ${escapeHTML(item.kategori)}
            </span>
          </td>

          <td>${escapeHTML(item.lokasi)}</td>

          <td>
            <span class="frequency-badge ${freqClass}">
              <svg viewBox="0 0 24 24">
                <path d="M13 2L5 13H11L10 22L19 10H13L13 2Z"/>
              </svg>
              ${days} Hari · ${level}
            </span>
          </td>

          <td>
            <div class="action-buttons">

              <label
                for="editModalToggle"
                class="action-btn edit-btn"
                title="Edit fasilitas"
                data-id="${escapeHTML(item.id)}"
                tabindex="0"
                role="button"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M16.5 3.5A2.12 2.12 0 0 1 19.5 6.5L8 18L4 19L5 15Z"/>
                </svg>
              </label>

              <label
                for="deleteModalToggle"
                class="action-btn delete-btn"
                title="Hapus fasilitas"
                data-id="${escapeHTML(item.id)}"
                tabindex="0"
                role="button"
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

  // ================================================
  // MODAL EDIT
  // ================================================

  function openEdit(id) {
    const item = state.facilities.find(
      facility => String(facility.id) === String(id)
    );

    if (!item) return;

    state.selectedId = item.id;

    $("#editCode").value = item.kodeFasilitas;
    $("#editName").value = item.namaFasilitas;
    $("#editLocation").value = item.lokasi;

    const categorySelect = $("#editCategory");

    const exists = [...categorySelect.options].some(
      option => option.value === item.kategori
    );

    if (!exists) {
      categorySelect.add(
        new Option(item.kategori, item.kategori)
      );
    }

    categorySelect.value = item.kategori;

    $("#editFrequency").value =
      `${item.frekuensi} Hari`;
  }

  function saveEdit() {
    if (state.selectedId === null) return;

    const code = $("#editCode").value.trim();
    const name = $("#editName").value.trim();
    const category = $("#editCategory").value;
    const location = $("#editLocation").value.trim();
    const days = getFrequencyNumber(
      $("#editFrequency").value
    );

    if (!code || !name || !category || !location) {
      alert("Semua kolom bertanda * wajib diisi.");
      return;
    }

    if (!Number.isInteger(days) || days < 0 || days > 7) {
      alert("Frekuensi penggunaan harus 0 sampai 7 hari.");
      return;
    }

    const duplicate = state.facilities.some(
      item =>
        normalizeText(item.kodeFasilitas) ===
          normalizeText(code) &&
        String(item.id) !== String(state.selectedId)
    );

    if (duplicate) {
      alert("Kode fasilitas sudah digunakan.");
      return;
    }

    const index = state.facilities.findIndex(
      item => String(item.id) === String(state.selectedId)
    );

    if (index === -1) return;

    const previous = state.facilities[index];

    state.facilities[index] = {
      ...previous,
      kodeFasilitas: code,
      namaFasilitas: name,
      kategori: category,
      lokasi: location,
      frekuensi: days
    };

    if (!saveStorage()) {
      state.facilities[index] = previous;
      return;
    }

    $("#editModalToggle").checked = false;
    state.selectedId = null;

    renderTable();

    alert("Data fasilitas berhasil diperbarui.");
  }

  // ================================================
  // MODAL HAPUS
  // ================================================

  function openDelete(id) {
    const item = state.facilities.find(
      facility => String(facility.id) === String(id)
    );

    if (!item) return;

    state.selectedId = item.id;

    const description = $(
      ".delete-content p:first-child"
    );

    if (description) {
      description.innerHTML = `
        Apakah kamu yakin ingin menghapus fasilitas
        <strong>
          ${escapeHTML(item.namaFasilitas)}
          (${escapeHTML(item.kodeFasilitas)})
        </strong>?
      `;
    }
  }

  function deleteFacility() {
    if (state.selectedId === null) return;

    const previous = [...state.facilities];

    state.facilities = state.facilities.filter(
      item => String(item.id) !== String(state.selectedId)
    );

    if (!saveStorage()) {
      state.facilities = previous;
      return;
    }

    $("#deleteModalToggle").checked = false;
    state.selectedId = null;

    renderTable();

    alert("Data fasilitas berhasil dihapus.");
  }

  // ================================================
  // EVENT LISTENER
  // ================================================

  function bindEvents() {
    const searchInput = $(".search-box input");
    const categoryFilter = $(".category-filter");
    const tbody = $(".facility-table tbody");

    if (searchInput) {
      searchInput.addEventListener("input", event => {
        state.search = normalizeText(event.target.value);
        renderTable();
      });
    }

    if (categoryFilter) {
      categoryFilter.addEventListener("change", event => {
        const value = normalizeText(event.target.value);

        state.category =
          value === "semua kategori" ? "semua" : value;

        renderTable();
      });
    }

    if (tbody) {
      tbody.addEventListener("click", event => {
        const editButton = event.target.closest(".edit-btn");
        const deleteButton = event.target.closest(".delete-btn");

        if (editButton) {
          openEdit(editButton.dataset.id);
        }

        if (deleteButton) {
          openDelete(deleteButton.dataset.id);
        }
      });

      tbody.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        const button = event.target.closest(
          ".edit-btn, .delete-btn"
        );

        if (!button) return;

        event.preventDefault();

        if (button.classList.contains("edit-btn")) {
          openEdit(button.dataset.id);
          $("#editModalToggle").checked = true;
        } else {
          openDelete(button.dataset.id);
          $("#deleteModalToggle").checked = true;
        }
      });
    }

    $(".edit-modal-overlay .btn-save")
      ?.addEventListener("click", saveEdit);

    $(".delete-modal-overlay .btn-delete")
      ?.addEventListener("click", deleteFacility);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        $("#editModalToggle").checked = false;
        $("#deleteModalToggle").checked = false;
        state.selectedId = null;
      }
    });

    window.addEventListener("storage", event => {
      if (event.key === STORAGE_KEY) {
        const data = readStorage();

        if (data !== null) {
          state.facilities = data;
          renderTable();
        }
      }
    });
  }

  // ================================================
  // INISIALISASI
  // ================================================

  function init() {
    if (!$(".facility-table")) return;

    loadData();
    bindEvents();

    console.log(
      "SIPFAS Data Fasilitas berhasil dijalankan."
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
