(() => {
  "use strict";

  // ==========================================================
  // 01. KONFIGURASI
  // ==========================================================

  const API = "../../api/admin/dataset-c45.php";

  const LIMIT = 25;

  const state = {
    items: [],
    facilities: [],

    page: 1,
    totalPages: 1,
    total: 0,

    csrfToken: "",

    editingId: null,

    search: "",

    filters: {
      x1: "",
      x2: "",
      x3: "",
      label: "",
    },
  };

  const $ = (selector) => document.querySelector(selector);

  // ==========================================================
  // 02. UTILITAS
  // ==========================================================

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

  function namaX1(value) {
    return (
      {
        1: "Ringan",
        2: "Sedang",
        3: "Berat",
      }[Number(value)] || "-"
    );
  }

  function namaX2(value) {
    return (
      {
        1: "Rendah",
        2: "Sedang",
        3: "Tinggi",
      }[Number(value)] || "-"
    );
  }

  function namaX3(value) {
    return (
      {
        1: "Jarang",
        2: "Sedang",
        3: "Sering",
      }[Number(value)] || "-"
    );
  }

  function kelasLabel(label) {
    const value = String(label || "").toLowerCase();

    if (value === "tinggi") return "priority-high";

    if (value === "sedang") return "priority-medium";

    return "priority-low";
  }

  // Mengikuti aturan konversi pada C45Service.php.

  function hitungX3(frekuensi) {
    const nilai = Number(frekuensi);

    // Validasi jumlah hari penggunaan.
    if (!Number.isInteger(nilai) || nilai < 0 || nilai > 7) {
      return null;
    }

    // 0-2 hari = Jarang.
    if (nilai <= 2) return 1;

    // 3-4 hari = Sedang.
    if (nilai <= 4) return 2;

    // 5-7 hari = Sering.
    return 3;
  }

  // ==========================================================
  // 03. MENYESUAIKAN ELEMEN HTML
  // ==========================================================

  function ensureDomHooks() {
    // Tabel dataset.
    const tbody = $("#datasetTableBody") || $(".dataset-table tbody");

    if (tbody) {
      tbody.id = "datasetTableBody";
    }

    // Pagination.
    const pagination = $("#datasetPagination") || $(".panel-foot .pagination");

    if (pagination) {
      pagination.id = "datasetPagination";
    }

    // Statistik.
    const cards = document.querySelectorAll(".summary-card");

    if (cards.length >= 4) {
      const selectors = ["#statTotal", "#statHigh", "#statMedium", "#statLow"];

      cards.forEach((card, index) => {
        const number = card.querySelector(".summary-number");

        if (number && !number.id) {
          number.id = selectors[index].substring(1);
        }
      });
    }

    // Notifikasi.
    if (!$("#datasetNotification")) {
      const notification = document.createElement("div");

      notification.id = "datasetNotification";

      notification.className = "dataset-notification";

      notification.hidden = true;

      notification.setAttribute("role", "status");

      notification.setAttribute("aria-live", "polite");

      document.body.appendChild(notification);
    }
  }

  // ==========================================================
  // 04. NOTIFIKASI
  // ==========================================================

  function tampilkanNotifikasi(pesan, tipe = "success") {
    const box = $("#datasetNotification");

    if (!box) {
      alert(pesan);
      return;
    }

    box.textContent = pesan;

    box.className = `dataset-notification ${tipe}`;

    box.hidden = false;

    window.clearTimeout(box._timer);

    box._timer = window.setTimeout(() => {
      box.hidden = true;
    }, 3500);
  }

  // ==========================================================
  // 05. REQUEST API
  // ==========================================================

  async function requestAPI(method = "GET", payload = null, params = {}) {
    const url = new URL(API, window.location.href);

    if (method === "GET") {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers = {
      Accept: "application/json",
    };

    const options = {
      method,

      credentials: "same-origin",

      cache: "no-store",

      headers,
    };

    if (["POST", "PUT", "DELETE"].includes(method)) {
      if (!state.csrfToken) {
        throw new Error(
          "Token keamanan belum tersedia. Silakan muat ulang halaman.",
        );
      }

      headers["Content-Type"] = "application/json";

      headers["X-CSRF-TOKEN"] = state.csrfToken;

      options.body = JSON.stringify(payload || {});
    }

    const response = await fetch(url.toString(), options);

    const raw = await response.text();

    let result;

    try {
      result = JSON.parse(raw);
    } catch {
      console.error("Respons API bukan JSON:", raw);

      throw new Error(
        "Respons server tidak valid. Periksa file PHP atau konfigurasi server.",
      );
    }

    if (!response.ok || result.success !== true) {
      throw new Error(
        result.message || `Permintaan gagal (${response.status}).`,
      );
    }

    return result.data || {};
  }

  // ==========================================================
  // 06. MEMUAT DATASET
  // ==========================================================

  async function loadDataset() {
    const tbody = $("#datasetTableBody");

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="center">
            Memuat data dari database...
          </td>
        </tr>
      `;
    }

    try {
      const data = await requestAPI("GET", null, {
        page: state.page,

        limit: LIMIT,

        search: state.search,

        x1: state.filters.x1,

        x2: state.filters.x2,

        x3: state.filters.x3,

        label: state.filters.label,
      });

      state.items = Array.isArray(data.items) ? data.items : [];

      state.facilities = Array.isArray(data.facilities) ? data.facilities : [];

      state.csrfToken = data.csrf_token || state.csrfToken;

      const pagination = data.pagination || {};

      state.page = Number(pagination.page || 1);

      state.totalPages = Number(pagination.total_pages || 1);

      state.total = Number(pagination.total || 0);

      renderTable();

      renderStatistics(data.statistics || {});

      renderPagination();

      updateFacilityOptions();
    } catch (error) {
      console.error("[SIPFAS DATASET C4.5]", error);

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="center">
              ${escapeHTML(error.message)}
            </td>
          </tr>
        `;
      }

      tampilkanNotifikasi(error.message, "error");
    }
  }

  // ==========================================================
  // 07. MENAMPILKAN TABEL
  // ==========================================================

  function renderTable() {
    const tbody = $("#datasetTableBody");

    if (!tbody) return;

    if (state.items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="center">
            Data dataset tidak ditemukan.
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML = state.items
      .map((item) => {
        const id = Number(item.id_data);

        const label = item.label_prioritas || "-";

        return `
        <tr data-id="${id}">

          <td>
            <button
              type="button"
              class="case-id"
              data-detail="${id}"
            >
              #${escapeHTML(item.kode_data)}
            </button>
          </td>

          <td class="facility">
            ${escapeHTML(item.nama_fasilitas || "-")}
          </td>

          <td class="center">
            <span class="chip">
              ${namaX1(item.tingkat_kerusakan_x1)}
              (${Number(item.tingkat_kerusakan_x1)})
            </span>
          </td>

          <td class="center">
            <span class="chip">
              ${namaX2(item.dampak_akademik_x2)}
              (${Number(item.dampak_akademik_x2)})
            </span>
          </td>

          <td class="center">
            <span class="chip">
              ${namaX3(item.frekuensi_penggunaan_x3)}
              (${Number(item.frekuensi_penggunaan_x3)})
            </span>
          </td>

          <td class="center">
            <span class="score">
              ${Number(item.skor || 0).toFixed(2)}
            </span>
          </td>

          <td class="center">
            <span class="priority ${kelasLabel(label)}">
              ${escapeHTML(label)}
            </span>
          </td>

          <td class="center">

            <span class="action-group">

              <!-- Tombol Lihat Detail -->
              <button
                type="button"
                class="eye-btn"
                data-detail="${id}"
                title="Lihat detail"
                aria-label="Lihat detail"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M2.5 12C4.4 8.9 7.7 7 12 7C16.3 7 19.6 8.9 21.5 12C19.6 15.1 16.3 17 12 17C7.7 17 4.4 15.1 2.5 12Z"/>
                  <circle cx="12" cy="12" r="2.5"/>
                </svg>
              </button>

              <!-- Tombol Hapus -->
              <button
                type="button"
                class="trash-btn"
                data-delete="${id}"
                title="Hapus dataset"
                aria-label="Hapus dataset"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M4.5 7H19.5"/>
                  <path d="M9.5 7V4.8H14.5V7"/>
                  <path d="M6.5 7L7.4 19.2H16.6L17.5 7"/>
                </svg>
              </button>

            </span>

          </td>

        </tr>
      `;
      })
      .join("");
  }

  // ==========================================================
  // 08. STATISTIK
  // ==========================================================

  function renderStatistics(stats) {
    const total = Number(stats.total || 0);

    const high = Number(stats.tinggi || 0);

    const medium = Number(stats.sedang || 0);

    const low = Number(stats.rendah || 0);

    function isiStatistik(selector, jumlah, keterangan) {
      const element = $(selector);

      if (!element) return;

      const persen = total > 0 ? ((jumlah / total) * 100).toFixed(1) : "0.0";

      element.innerHTML = `
        ${jumlah}
        <small>${escapeHTML(keterangan || `${persen}% dari total`)}</small>
      `;
    }

    isiStatistik("#statTotal", total, "Kasus Simulasi");

    isiStatistik("#statHigh", high);

    isiStatistik("#statMedium", medium);

    isiStatistik("#statLow", low);

    const barTotal = $(".bar-w100");

    const barHigh = $(".bar-w32");

    const barMedium = $(".bar-w45");

    const barLow = $(".bar-w23");

    if (barTotal) {
      barTotal.style.width = total > 0 ? "100%" : "0%";
    }

    if (barHigh) {
      barHigh.style.width = `${total ? (high / total) * 100 : 0}%`;
    }

    if (barMedium) {
      barMedium.style.width = `${total ? (medium / total) * 100 : 0}%`;
    }

    if (barLow) {
      barLow.style.width = `${total ? (low / total) * 100 : 0}%`;
    }
  }

  // ==========================================================
  // 09. PAGINATION
  // ==========================================================

  function renderPagination() {
    const container = $("#datasetPagination");

    if (!container) return;

    const current = state.page;

    const total = state.totalPages;

    let html = `
      <button
        type="button"
        data-page="${current - 1}"
        aria-label="Sebelumnya"
        ${current <= 1 ? "disabled" : ""}
      >
        ‹
      </button>
    `;

    const pages = new Set([1, current - 1, current, current + 1, total]);

    const sorted = [...pages]
      .filter((page) => page >= 1 && page <= total)
      .sort((a, b) => a - b);

    let previous = 0;

    sorted.forEach((page) => {
      if (previous && page - previous > 1) {
        html += `
          <span class="pagination-dots">...</span>
        `;
      }

      html += `
        <button
          type="button"
          data-page="${page}"
          class="${page === current ? "active" : ""}"
          ${page === current ? 'aria-current="page"' : ""}
        >
          ${page}
        </button>
      `;

      previous = page;
    });

    html += `
      <button
        type="button"
        data-page="${current + 1}"
        aria-label="Selanjutnya"
        ${current >= total ? "disabled" : ""}
      >
        ›
      </button>
    `;

    container.innerHTML = html;
  }

  // ==========================================================
  // 10. DROPDOWN FASILITAS
  // ==========================================================

  function updateFacilityOptions(selectedId = "") {
    const select = $("#datasetFacility");

    if (!select) return;

    select.innerHTML = `
      <option value="">Pilih fasilitas...</option>
    `;

    state.facilities.forEach((facility) => {
      const option = document.createElement("option");

      option.value = facility.id_fasilitas;

      option.textContent = `${facility.nama_fasilitas} (${facility.kode_fasilitas})`;

      select.appendChild(option);
    });

    if (selectedId) {
      select.value = String(selectedId);
    }

    updateFacilityInformation();
  }

  function updateFacilityInformation() {
    const select = $("#datasetFacility");

    if (!select) return;

    const facility = state.facilities.find(
      (item) => String(item.id_fasilitas) === select.value,
    );

    const category = $("#facilityCategory");

    const frequencyElement = $("#facilityFrequency");

    const x3Element = $("#facilityX3");

    if (!facility) {
      if (category) category.textContent = "-";

      if (frequencyElement) frequencyElement.textContent = "-";

      if (x3Element) x3Element.textContent = "-";

      return;
    }

    const frequency = Number(facility.frekuensi_penggunaan);

    const x3 = hitungX3(frequency);

    if (category) {
      category.textContent = facility.nama_kategori || "-";
    }

    if (frequencyElement) {
      frequencyElement.textContent = `${frequency} kali`;
    }

    if (x3Element) {
      x3Element.textContent = x3 ? `${namaX3(x3)} (${x3})` : "Tidak valid";
    }
  }

  // ==========================================================
  // 11. MEMBUAT MODAL TAMBAH DATASET
  // ==========================================================

  function ensureModal() {
    if ($("#datasetModal")) return;

    const modal = document.createElement("div");

    modal.id = "datasetModal";

    modal.className = "dataset-modal";

    modal.hidden = true;

    modal.innerHTML = `
      <div class="dataset-modal-overlay" data-close-modal></div>

      <section
        class="dataset-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="datasetModalTitle"
      >

        <div class="dataset-modal-header">

          <div>
            <h2 id="datasetModalTitle">
              Tambah Data Simulasi
            </h2>

            <p>Lengkapi atribut dataset kasus fasilitas.</p>
          </div>

          <button
            type="button"
            id="closeDatasetModal"
            class="modal-close-btn"
            aria-label="Tutup"
          >
            &times;
          </button>

        </div>

        <form id="datasetForm">

          <div class="dataset-modal-body">

            <div class="form-group">

              <label for="datasetFacility">
                Jenis Fasilitas
              </label>

              <select
                id="datasetFacility"
                name="id_fasilitas"
                required
              >
                <option value="">Pilih fasilitas...</option>
              </select>

            </div>

            <div class="facility-information">

              <div>
                <span>Kategori</span>
                <strong id="facilityCategory">-</strong>
              </div>

              <div>
                <span>Frekuensi penggunaan</span>
                <strong id="facilityFrequency">-</strong>
              </div>

              <div>
                <span>Nilai X3</span>
                <strong id="facilityX3">-</strong>
              </div>

            </div>

            <div class="form-group">

              <label for="datasetX1">
                X1 - Tingkat Kerusakan
              </label>

              <select
                id="datasetX1"
                name="tingkat_kerusakan_x1"
                required
              >
                <option value="">Pilih tingkat kerusakan...</option>
                <option value="1">1 - Ringan</option>
                <option value="2">2 - Sedang</option>
                <option value="3">3 - Berat</option>
              </select>

            </div>

            <div class="form-group">

              <label for="datasetX2">
                X2 - Dampak Akademik
              </label>

              <select
                id="datasetX2"
                name="dampak_akademik_x2"
                required
              >
                <option value="">Pilih dampak akademik...</option>
                <option value="1">1 - Rendah</option>
                <option value="2">2 - Sedang</option>
                <option value="3">3 - Tinggi</option>
              </select>

            </div>

            <p class="dataset-modal-note">
              X3 dan label prioritas (Y) dihitung otomatis
              berdasarkan data fasilitas dan aturan backend.
            </p>

          </div>

          <div class="dataset-modal-footer">

            <button
              type="button"
              id="cancelDataset"
              class="modal-cancel-btn"
            >
              Batal
            </button>

            <button
              type="submit"
              id="saveDataset"
              class="modal-save-btn"
            >
              Simpan Dataset
            </button>

          </div>

        </form>

      </section>
    `;

    document.body.appendChild(modal);
  }

  // ==========================================================
  // 12. MODAL TAMBAH DATASET
  // ==========================================================

  function openModal(item = null) {
    ensureModal();

    const modal = $("#datasetModal");

    const form = $("#datasetForm");

    if (!modal || !form) return;

    form.reset();

    state.editingId = item ? Number(item.id_data) : null;

    $("#datasetModalTitle").textContent = item
      ? "Edit Dataset C4.5"
      : "Tambah Data Simulasi";

    updateFacilityOptions(item?.id_fasilitas || "");

    if (item) {
      form.elements["tingkat_kerusakan_x1"].value = String(
        item.tingkat_kerusakan_x1,
      );

      form.elements["dampak_akademik_x2"].value = String(
        item.dampak_akademik_x2,
      );
    }

    modal.hidden = false;

    document.body.classList.add("modal-open");
  }

  function closeModal() {
    const modal = $("#datasetModal");

    if (modal) {
      modal.hidden = true;
    }

    document.body.classList.remove("modal-open");

    state.editingId = null;
  }

  // ==========================================================
  // 13. SIMPAN DATASET
  // ==========================================================

  async function saveDataset(event) {
    event.preventDefault();

    const form = $("#datasetForm");

    if (!form || !form.reportValidity()) return;

    const payload = {
      id_fasilitas: Number(form.elements["id_fasilitas"].value),

      tingkat_kerusakan_x1: Number(form.elements["tingkat_kerusakan_x1"].value),

      dampak_akademik_x2: Number(form.elements["dampak_akademik_x2"].value),
    };

    const button = $("#saveDataset");

    if (!button) return;

    button.disabled = true;

    button.textContent = "Menyimpan...";

    try {
      if (state.editingId) {
        payload.id_data = state.editingId;

        await requestAPI("PUT", payload);

        tampilkanNotifikasi("Dataset berhasil diperbarui.");
      } else {
        await requestAPI("POST", payload);

        tampilkanNotifikasi("Dataset berhasil ditambahkan.");
      }

      closeModal();

      state.page = 1;

      await loadDataset();
    } catch (error) {
      tampilkanNotifikasi(error.message, "error");
    } finally {
      button.disabled = false;

      button.textContent = "Simpan Dataset";
    }
  }

  // ==========================================================
  // 14. HAPUS DATASET
  // ==========================================================

  async function deleteDataset(id) {
    const item = state.items.find((row) => Number(row.id_data) === Number(id));

    if (!item) return;

    const yakin = confirm(
      `Hapus dataset ${item.kode_data} (${item.nama_fasilitas})?`,
    );

    if (!yakin) return;

    try {
      await requestAPI("DELETE", {
        id_data: Number(id),
      });

      tampilkanNotifikasi("Dataset berhasil dihapus.");

      if (state.items.length === 1 && state.page > 1) {
        state.page--;
      }

      await loadDataset();
    } catch (error) {
      tampilkanNotifikasi(error.message, "error");
    }
  }

  // ==========================================================
  // 15. DETAIL DATASET
  // ==========================================================

  function showDetail(id) {
    const item = state.items.find((row) => Number(row.id_data) === Number(id));

    if (!item) return;

    const tanggal = item.tanggal_dibuat || "-";

    alert(
      `DETAIL DATASET C4.5\n\n` +
        `Kode: ${item.kode_data}\n` +
        `Nama fasilitas: ${item.nama_fasilitas}\n` +
        `Kode fasilitas: ${item.kode_fasilitas || "-"}\n` +
        `Kategori: ${item.nama_kategori || "-"}\n\n` +
        `X1 Kerusakan: ${namaX1(item.tingkat_kerusakan_x1)}\n` +
        `X2 Dampak: ${namaX2(item.dampak_akademik_x2)}\n` +
        `X3 Frekuensi: ${namaX3(item.frekuensi_penggunaan_x3)}\n\n` +
        `Skor: ${Number(item.skor || 0).toFixed(2)}\n` +
        `Label Y: ${item.label_prioritas}\n\n` +
        `Sumber: ${item.sumber_data || "-"}\n` +
        `Tanggal dibuat: ${tanggal}`,
    );
  }

  // ==========================================================
  // 16. EVENT LISTENER
  // ==========================================================

  function bindEvents() {
    ensureModal();

    // Tambah dataset.
    $("#addDatasetBtn")?.addEventListener("click", () => {
      openModal();
    });

    // Tutup modal.
    $("#closeDatasetModal")?.addEventListener("click", closeModal);

    $("#cancelDataset")?.addEventListener("click", closeModal);

    $("#datasetModal")?.addEventListener("click", (event) => {
      if (event.target.matches("[data-close-modal]")) {
        closeModal();
      }
    });

    // Submit form.
    $("#datasetForm")?.addEventListener("submit", saveDataset);

    // Perubahan fasilitas.
    $("#datasetFacility")?.addEventListener(
      "change",
      updateFacilityInformation,
    );

    // Aksi tabel: hanya detail dan hapus.
    $("#datasetTableBody")?.addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-delete]");

      const detailButton = event.target.closest("[data-detail]");

      if (deleteButton) {
        deleteDataset(Number(deleteButton.dataset.delete));

        return;
      }

      if (detailButton) {
        showDetail(Number(detailButton.dataset.detail));
      }
    });

    // Pagination.
    $("#datasetPagination")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-page]");

      if (!button || button.disabled) return;

      const page = Number(button.dataset.page);

      if (page < 1 || page > state.totalPages) {
        return;
      }

      state.page = page;

      loadDataset();
    });

    // Pencarian dengan debounce.
    let searchTimer;

    $("#searchInput")?.addEventListener("input", (event) => {
      window.clearTimeout(searchTimer);

      searchTimer = window.setTimeout(() => {
        state.search = event.target.value.trim();

        state.page = 1;

        loadDataset();
      }, 350);
    });

    // Filter.
    const filterMap = {
      filterX1: "x1",

      filterX2: "x2",

      filterX3: "x3",

      filterY: "label",
    };

    Object.entries(filterMap).forEach(([elementId, key]) => {
      $(`#${elementId}`)?.addEventListener("change", (event) => {
        const value = event.target.value;

        if (key === "label") {
          state.filters[key] =
            value === "semua"
              ? ""
              : value.charAt(0).toUpperCase() + value.slice(1);
        } else {
          const map = {
            ringan: "1",

            rendah: "1",

            jarang: "1",

            sedang: "2",

            berat: "3",

            tinggi: "3",

            sering: "3",
          };

          state.filters[key] = value === "semua" ? "" : map[value] || "";
        }

        state.page = 1;

        loadDataset();
      });
    });

    // Tombol Escape untuk menutup modal.
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        $("#datasetModal") &&
        !$("#datasetModal").hidden
      ) {
        closeModal();
      }
    });
  }

  // ==========================================================
  // 17. INISIALISASI
  // ==========================================================

  async function init() {
    ensureDomHooks();

    ensureModal();

    bindEvents();

    await loadDataset();

    console.log("[SIPFAS] Dataset C4.5 berhasil diinisialisasi.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
