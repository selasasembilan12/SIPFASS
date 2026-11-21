(() => {
  "use strict";

  /* ==================================================
     01. KONFIGURASI API
  ================================================== */

  const API_FASILITAS = "../../api/admin/data-fasilitas.php";
  const API_KATEGORI = "../../api/admin/kategori-fasilitas.php";

  const $ = (selector, parent = document) => parent.querySelector(selector);

  const state = {
    facilities: [],
    categories: [],
    selectedId: null,
    search: "",
    category: "semua",
    loading: false,
  };

  /* ==================================================
     02. UTILITAS
  ================================================== */

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

  function normalizeText(value) {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase("id-ID");
  }

  function getFrequencyNumber(value) {
    const match = String(value ?? "").match(/\d+/);

    return match ? Number(match[0]) : 0;
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

    return name.includes("jaringan") ? "category-gray" : "category-blue";
  }

  /* ==================================================
     03. REQUEST API
  ================================================== */

  async function requestJSON(url, options = {}) {
    const headers = {
      Accept: "application/json",

      ...(options.body ? { "Content-Type": "application/json" } : {}),

      ...(options.headers || {}),
    };

    let response;

    try {
      response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers,
      });
    } catch (error) {
      throw new Error(
        "Tidak dapat terhubung ke server. Periksa Apache, PHP, dan koneksi localhost.",
      );
    }

    const responseText = await response.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      console.error("Respons API bukan JSON:", responseText);

      throw new Error(
        "Server memberikan respons tidak valid. Periksa error PHP dan log server.",
      );
    }

    if (!response.ok || result.success !== true) {
      throw new Error(
        result.message || `Permintaan gagal dengan HTTP ${response.status}.`,
      );
    }

    return result.data ?? {};
  }

  /* ==================================================
     04. NORMALISASI DATA FASILITAS
  ================================================== */

  function normalizeFacility(row) {
    return {
      id: Number(row.id_fasilitas),

      kodeFasilitas: row.kode_fasilitas ?? "",

      namaFasilitas: row.nama_fasilitas ?? "",

      idKategori: Number(row.id_kategori),

      kategori: row.nama_kategori ?? "-",

      idLokasi: Number(row.id_lokasi ?? 0),

      lokasi: row.nama_lokasi ?? row.lokasi_ruangan ?? "",

      kodeLokasi: row.kode_lokasi ?? "",

      // NULL tidak boleh diubah menjadi 0.
      jumlahUnit:
        row.jumlah_unit === null ||
        row.jumlah_unit === undefined ||
        row.jumlah_unit === ""
          ? null
          : Number(row.jumlah_unit),

      frekuensi: getFrequencyNumber(row.frekuensi_penggunaan),

      status: row.status_fasilitas ?? "Aktif",
    };
  }

  /* ==================================================
     05. MEMUAT DATA DARI DATABASE
     Mengambil seluruh halaman API.
  ================================================== */

  async function loadData() {
    if (state.loading) return;

    state.loading = true;

    try {
      const limit = 100;

      const [firstPage, categoryData] = await Promise.all([
        requestJSON(`${API_FASILITAS}?page=1&limit=${limit}`),

        requestJSON(`${API_KATEGORI}?page=1&limit=100&status=Aktif`),
      ]);

      let allFacilities = firstPage.items ?? [];

      const totalPages = Number(firstPage.pagination?.total_pages ?? 1);

      // Mengambil halaman kedua dan seterusnya.
      for (let page = 2; page <= totalPages; page++) {
        const result = await requestJSON(
          `${API_FASILITAS}?page=${page}&limit=${limit}`,
        );

        allFacilities = allFacilities.concat(result.items ?? []);
      }

      state.facilities = allFacilities.map(normalizeFacility);

      state.categories = categoryData.items ?? [];

      populateCategoryOptions();

      renderTable();

      console.log("Total fasilitas:", state.facilities.length);

      console.log("Data fasilitas:", state.facilities);

      console.log("Data kategori:", state.categories);
    } finally {
      state.loading = false;
    }
  }

  /* ==================================================
     06. MENGISI DROPDOWN KATEGORI
  ================================================== */

  function populateCategoryOptions() {
    const editSelect = $("#editCategory");

    const filterSelect = $(".category-filter");

    const currentEdit = editSelect?.value ?? "";

    const currentFilter = filterSelect?.value ?? "semua";

    if (editSelect) {
      editSelect.innerHTML = state.categories
        .map(
          (category) => `
            <option value="${Number(category.id_kategori)}">
              ${escapeHTML(category.nama_kategori)}
            </option>
          `,
        )
        .join("");

      if (
        [...editSelect.options].some((option) => option.value === currentEdit)
      ) {
        editSelect.value = currentEdit;
      }
    }

    if (filterSelect) {
      filterSelect.innerHTML = `
        <option value="semua">Semua Kategori</option>

        ${state.categories
          .map(
            (category) => `
              <option value="${Number(category.id_kategori)}">
                ${escapeHTML(category.nama_kategori)}
              </option>
            `,
          )
          .join("")}
      `;

      if (
        [...filterSelect.options].some(
          (option) => option.value === currentFilter,
        )
      ) {
        filterSelect.value = currentFilter;
      }
    }
  }

  /* ==================================================
     07. FILTER DATA
  ================================================== */

  function getFilteredData() {
    return state.facilities.filter((item) => {
      const matchesSearch = [
        item.kodeFasilitas,
        item.namaFasilitas,
        item.kategori,
        item.lokasi,
      ].some((value) => normalizeText(value).includes(state.search));

      const matchesCategory =
        state.category === "semua" ||
        String(item.idKategori) === String(state.category);

      return matchesSearch && matchesCategory;
    });
  }

  /* ==================================================
     08. MENAMPILKAN TABEL
     Struktur kolom HTML tetap.
  ================================================== */

  function renderTable() {
    const tbody = $(".facility-table tbody");

    const emptyState = $(".empty-state");

    if (!tbody) return;

    const data = getFilteredData();

    if (emptyState) {
      emptyState.style.display = data.length === 0 ? "block" : "none";
    }

    if (data.length === 0) {
      tbody.innerHTML = "";
      return;
    }

    tbody.innerHTML = data
      .map((item, index) => {
        const days = Number(item.frekuensi);

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
              <span class="category-badge ${categoryClass(item.kategori)}">
                ${escapeHTML(item.kategori)}
              </span>
            </td>

            <td>
              ${escapeHTML(item.lokasi)}
            </td>

            <td>
              <span class="frequency-badge ${frequencyClass(days)}">
                <svg viewBox="0 0 24 24">
                  <path d="M13 2L5 13H11L10 22L19 10H13L13 2Z"/>
                </svg>

                ${days} Hari · ${frequencyLevel(days)}
              </span>
            </td>

            <td>
              <div class="action-buttons">

                <label
                  for="editModalToggle"
                  class="action-btn edit-btn"
                  title="Edit fasilitas"
                  data-id="${item.id}"
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
                  data-id="${item.id}"
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
      })
      .join("");
  }

  /* ==================================================
     09. MEMBUKA MODAL EDIT
  ================================================== */

  function openEdit(id) {
    const item = state.facilities.find(
      (facility) => String(facility.id) === String(id),
    );

    if (!item) {
      alert("Data fasilitas tidak ditemukan.");
      return;
    }

    state.selectedId = item.id;

    const editCode = $("#editCode");
    const editName = $("#editName");
    const editLocation = $("#editLocation");
    const editCategory = $("#editCategory");
    const editFrequency = $("#editFrequency");

    // Opsional: jika input sudah tersedia pada HTML.
    const editJumlahUnit = $("#editJumlahUnit");

    if (editCode) {
      editCode.value = item.kodeFasilitas;
    }

    if (editName) {
      editName.value = item.namaFasilitas;
    }

    if (editLocation) {
      editLocation.value = item.lokasi;
    }

    if (editCategory) {
      editCategory.value = String(item.idKategori);
    }

    if (editFrequency) {
      editFrequency.value = `${item.frekuensi} Hari`;
    }

    if (editJumlahUnit) {
      editJumlahUnit.value =
        item.jumlahUnit === null ? "" : String(item.jumlahUnit);
    }
  }

  /* ==================================================
     10. MENYIMPAN PERUBAHAN FASILITAS
  ================================================== */

  async function saveEdit() {
    if (state.selectedId === null) return;

    const code = $("#editCode")?.value.trim() ?? "";

    const name = $("#editName")?.value.trim() ?? "";

    const categoryId = Number($("#editCategory")?.value);

    const location = $("#editLocation")?.value.trim() ?? "";

    const days = getFrequencyNumber($("#editFrequency")?.value);

    // Input jumlah unit opsional.
    const quantityInput = $("#editJumlahUnit");

    if (!code || !name || !categoryId || !location) {
      alert("Semua kolom bertanda * wajib diisi.");
      return;
    }

    if (!Number.isInteger(days) || days < 0 || days > 7) {
      alert("Frekuensi penggunaan harus antara 0 sampai 7 hari.");
      return;
    }

    const original = state.facilities.find(
      (item) => item.id === state.selectedId,
    );

    if (!original) {
      alert("Data fasilitas tidak ditemukan.");
      return;
    }

    let jumlahUnit = null;

    if (quantityInput) {
      const rawQuantity = quantityInput.value.trim();

      if (rawQuantity !== "") {
        jumlahUnit = Number(rawQuantity);

        if (!Number.isSafeInteger(jumlahUnit) || jumlahUnit < 0) {
          alert("Jumlah unit harus berupa bilangan bulat nol atau lebih.");
          return;
        }
      }
    }

    const payload = {
      id_fasilitas: state.selectedId,
      kode_fasilitas: code,
      nama_fasilitas: name,
      id_kategori: categoryId,

      // API mencari id_lokasi berdasarkan nama.
      lokasi_ruangan: location,

      frekuensi_penggunaan: days,
      status_fasilitas: original.status,
    };

    // Kirim hanya jika input tersedia.
    if (quantityInput) {
      payload.jumlah_unit = jumlahUnit;
    }

    const button = $(".edit-modal-overlay .btn-save");

    if (button) button.disabled = true;

    try {
      await requestJSON(API_FASILITAS, {
        method: "PUT",

        body: JSON.stringify(payload),
      });

      $("#editModalToggle").checked = false;

      state.selectedId = null;

      await loadData();

      alert("Data fasilitas berhasil diperbarui.");
    } catch (error) {
      console.error("Gagal mengedit fasilitas:", error);

      alert(error.message || "Gagal memperbarui fasilitas.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  /* ==================================================
     11. MEMBUKA MODAL HAPUS
  ================================================== */

  function openDelete(id) {
    const item = state.facilities.find(
      (facility) => String(facility.id) === String(id),
    );

    if (!item) {
      alert("Data fasilitas tidak ditemukan.");
      return;
    }

    state.selectedId = item.id;

    const description = $(".delete-content p:first-child");

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

  /* ==================================================
     12. MENGHAPUS FASILITAS
  ================================================== */

  async function deleteFacility() {
    if (state.selectedId === null) return;

    const button = $(".delete-modal-overlay .btn-delete");

    if (button) button.disabled = true;

    try {
      await requestJSON(API_FASILITAS, {
        method: "DELETE",

        body: JSON.stringify({
          id_fasilitas: state.selectedId,
        }),
      });

      $("#deleteModalToggle").checked = false;

      state.selectedId = null;

      await loadData();

      alert("Data fasilitas berhasil dihapus.");
    } catch (error) {
      console.error("Gagal menghapus fasilitas:", error);

      alert(error.message || "Gagal menghapus fasilitas.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  /* ==================================================
     13. EVENT LISTENER
  ================================================== */

  function bindEvents() {
    const searchInput = $(".search-box input");

    const categoryFilter = $(".category-filter");

    const tbody = $(".facility-table tbody");

    searchInput?.addEventListener("input", (event) => {
      state.search = normalizeText(event.target.value);

      renderTable();
    });

    categoryFilter?.addEventListener("change", (event) => {
      state.category = event.target.value || "semua";

      renderTable();
    });

    tbody?.addEventListener("click", (event) => {
      const editButton = event.target.closest(".edit-btn");

      const deleteButton = event.target.closest(".delete-btn");

      if (editButton) {
        openEdit(editButton.dataset.id);
      }

      if (deleteButton) {
        openDelete(deleteButton.dataset.id);
      }
    });

    tbody?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const button = event.target.closest(".edit-btn, .delete-btn");

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

    $(".edit-modal-overlay .btn-save")?.addEventListener("click", saveEdit);

    $(".delete-modal-overlay .btn-delete")?.addEventListener(
      "click",
      deleteFacility,
    );

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if ($("#editModalToggle")) {
          $("#editModalToggle").checked = false;
        }

        if ($("#deleteModalToggle")) {
          $("#deleteModalToggle").checked = false;
        }

        state.selectedId = null;
      }
    });
  }

  /* ==================================================
     14. INISIALISASI
  ================================================== */

  async function init() {
    if (!$(".facility-table")) return;

    bindEvents();

    try {
      await loadData();

      console.log("SIPFAS: Data Fasilitas berhasil terhubung ke database.");
    } catch (error) {
      console.error("Gagal memuat data fasilitas:", error);

      alert(
        error.message ||
          "Data fasilitas gagal dimuat. Periksa koneksi server dan sesi Admin.",
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
