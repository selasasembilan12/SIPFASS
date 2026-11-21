(() => {
  "use strict";

  // ==========================================================
  // 01. KONFIGURASI
  // ==========================================================

  const RESULT_API = "../../api/admin/hasil-pengujian.php";
  const DATASET_API = "../../api/admin/dataset-c45.php";

  const CLASSES = ["Rendah", "Sedang", "Tinggi"];
  const PAGE_SIZE = 5;

  const ATTRIBUTES = [
    {
      key: "x1",
      levels: ["Ringan", "Sedang", "Berat"],
    },
    {
      key: "x2",
      levels: ["Rendah", "Sedang", "Tinggi"],
    },
    {
      key: "x3",
      levels: ["Jarang", "Sedang", "Sering"],
    },
  ];

  const state = {
    history: [],
    activeModel: null,
    dataset: [],
    details: [],
    predictions: [],
    matrix: createEmptyMatrix(),
    page: 1,
    loading: false,
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);

  const $$ = (selector, parent = document) => [
    ...parent.querySelectorAll(selector),
  ];

  // ==========================================================
  // 02. HELPER
  // ==========================================================

  function createEmptyMatrix() {
    const matrix = {};

    CLASSES.forEach((actual) => {
      matrix[actual] = {};

      CLASSES.forEach((predicted) => {
        matrix[actual][predicted] = 0;
      });
    });

    return matrix;
  }

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

  function numberValue(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
  }

  function formatPercent(value) {
    return `${numberValue(value).toFixed(2)}%`;
  }

  function getLevelName(value, key) {
    const attribute = ATTRIBUTES.find((item) => item.key === key);

    return attribute?.levels[numberValue(value, 0) - 1] || "-";
  }

  function getClassType(label) {
    if (label === "Tinggi") return "high";

    if (label === "Sedang") return "medium";

    return "low";
  }

  function showMessage(message, type = "error") {
    console[type === "error" ? "error" : "log"](
      `[SIPFAS HASIL PENGUJIAN] ${message}`,
    );

    const tbody = $(".prediction-table tbody");

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7"
              style="text-align:center;padding:20px">
            ${escapeHTML(message)}
          </td>
        </tr>
      `;
    }
  }

  // ==========================================================
  // 03. REQUEST API
  // ==========================================================

  async function requestJSON(url) {
    let response;

    try {
      response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",

        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      throw new Error(
        "Server tidak dapat dihubungi. Periksa Apache dan koneksi database.",
      );
    }

    const raw = await response.text();

    let result;

    try {
      result = JSON.parse(raw);
    } catch (error) {
      console.error("Respons API bukan JSON:", raw);

      throw new Error(
        "Respons API tidak valid. Periksa file PHP dan log Apache.",
      );
    }

    if (!response.ok || result.success !== true) {
      throw new Error(
        result.message || `Permintaan gagal (HTTP ${response.status}).`,
      );
    }

    return result.data || {};
  }

  // ==========================================================
  // 04. AMBIL RIWAYAT DAN MODEL AKTIF
  // ==========================================================

  async function loadHistory() {
    const data = await requestJSON(RESULT_API);

    state.history = Array.isArray(data.items) ? data.items : [];

    state.activeModel = data.active_model || null;

    return state.activeModel;
  }

  // ==========================================================
  // 05. AMBIL DATASET DARI DATABASE
  //
  // Dataset hanya digunakan untuk menampilkan atribut
  // X1, X2, X3 dan menghitung jumlah kombinasi domain.
  //
  // Tidak melakukan pelatihan atau pengujian ulang.
  // ==========================================================

  async function loadDataset() {
    const allItems = [];

    let page = 1;

    let total = Infinity;

    while (allItems.length < total) {
      const params = new URLSearchParams({
        page: String(page),
        limit: "100",
      });

      const data = await requestJSON(`${DATASET_API}?${params.toString()}`);

      const items = Array.isArray(data.items) ? data.items : [];

      allItems.push(...items);

      total = numberValue(data.pagination?.total, allItems.length);

      if (items.length === 0) break;

      page += 1;
    }

    state.dataset = allItems
      .map((item) => ({
        id: String(item.id_data ?? ""),

        facility: item.nama_fasilitas || "Fasilitas",

        x1: numberValue(item.tingkat_kerusakan_x1, NaN),

        x2: numberValue(item.dampak_akademik_x2, NaN),

        x3: numberValue(item.frekuensi_penggunaan_x3, NaN),

        label: item.label_prioritas || "",
      }))
      .filter(
        (item) =>
          item.id &&
          [1, 2, 3].includes(item.x1) &&
          [1, 2, 3].includes(item.x2) &&
          [1, 2, 3].includes(item.x3) &&
          CLASSES.includes(item.label),
      );

    return state.dataset;
  }

  // ==========================================================
  // 06. AMBIL DETAIL MODEL AKTIF
  // ==========================================================

  async function loadActiveDetails() {
    const id = numberValue(state.activeModel?.id_pelatihan);

    if (id < 1) {
      throw new Error("ID model aktif tidak valid.");
    }

    const params = new URLSearchParams({
      id_pelatihan: String(id),
    });

    const data = await requestJSON(`${RESULT_API}?${params.toString()}`);

    const history = data.history || {};

    const details = Array.isArray(data.details) ? data.details : [];

    const predictions = Array.isArray(data.predictions) ? data.predictions : [];

    // Mencocokkan ID detail pengujian dengan dataset.
    const datasetById = new Map(state.dataset.map((item) => [item.id, item]));

    // ------------------------------------------
    // DATA LATIH DAN DATA UJI
    // ------------------------------------------

    state.details = details.map((row) => {
      const dataset = datasetById.get(String(row.id_data)) || {};

      return {
        id: String(row.id_data ?? ""),

        kind: String(row.jenis_data ?? ""),

        actual: String(row.label_sebenarnya ?? ""),

        predicted: row.label_prediksi == null ? "" : String(row.label_prediksi),

        correct:
          row.status_prediksi == null
            ? null
            : numberValue(row.status_prediksi) === 1,

        x1: numberValue(dataset.x1, NaN),

        x2: numberValue(dataset.x2, NaN),

        x3: numberValue(dataset.x3, NaN),

        facility: dataset.facility || "Fasilitas",
      };
    });

    // ------------------------------------------
    // HASIL PREDIKSI DATA UJI
    // ------------------------------------------

    state.predictions = predictions.map((row) => {
      const dataset = datasetById.get(String(row.id_data)) || {};

      return {
        id: String(row.id_data ?? ""),

        x1: numberValue(dataset.x1, NaN),

        x2: numberValue(dataset.x2, NaN),

        x3: numberValue(dataset.x3, NaN),

        actual: String(row.actual ?? ""),

        predicted: String(row.predicted ?? ""),

        correct: row.correct === true || numberValue(row.correct) === 1,
      };
    });

    // ------------------------------------------
    // CONFUSION MATRIX DARI DATABASE
    // ------------------------------------------

    state.matrix = normalizeMatrix(data.confusion_matrix);

    // Gunakan data model yang baru diterima.
    state.activeModel = {
      ...state.activeModel,
      ...history,
    };
  }

  // ==========================================================
  // 07. NORMALISASI CONFUSION MATRIX
  // ==========================================================

  function normalizeMatrix(source) {
    const matrix = createEmptyMatrix();

    if (!source || typeof source !== "object") {
      return matrix;
    }

    CLASSES.forEach((actual) => {
      CLASSES.forEach((predicted) => {
        matrix[actual][predicted] = numberValue(source?.[actual]?.[predicted]);
      });
    });

    return matrix;
  }

  // ==========================================================
  // 08. RINGKASAN DATA PENGUJIAN
  // ==========================================================

  function getSummary() {
    const total = state.predictions.length;

    const correct = state.predictions.filter((item) => item.correct).length;

    const wrong = total - correct;

    return {
      total,
      correct,
      wrong,
    };
  }

  // ==========================================================
  // 09. RENDER KARTU METRIK
  //
  // Nilai metrik dibaca dari riwayat pelatihan database.
  // ==========================================================

  function renderMetrics() {
    const cards = $$(".metric-card");

    if (cards.length < 5 || !state.activeModel) {
      return;
    }

    const model = state.activeModel;

    const summary = getSummary();

    const accuracy = numberValue(model.akurasi);

    const precision = numberValue(model.presisi);

    const recall = numberValue(model.recall);

    const errorRate = numberValue(model.tingkat_kesalahan);

    const trainCount = numberValue(model.jumlah_data_latih);

    const testCount = numberValue(model.jumlah_data_uji);

    const trainPercent = numberValue(model.persentase_latih);

    const testPercent = numberValue(model.persentase_uji);

    const values = [
      {
        value: formatPercent(accuracy),

        description: `${summary.correct} dari ${summary.total} kasus pengujian tepat`,

        progress: accuracy,
      },

      {
        value: `${trainCount} / ${testCount}`,

        description: `${trainPercent}% Latih • ${testPercent}% Uji (aktual)`,

        progress: trainPercent,
      },

      {
        value: formatPercent(precision),

        description: "Macro Precision 3 Kelas",

        progress: precision,
      },

      {
        value: formatPercent(recall),

        description: "Macro Recall 3 Kelas",

        progress: recall,
      },

      {
        value: formatPercent(errorRate),

        description: `${summary.wrong} kasus salah klasifikasi`,

        progress: errorRate,
      },
    ];

    values.forEach((item, index) => {
      const card = cards[index];

      const value = $(".metric-value", card);

      const description = $(".metric-description", card);

      const progress = $(".progress-fill", card);

      if (value) {
        value.textContent = item.value;
      }

      if (description) {
        description.textContent = item.description;
      }

      if (progress) {
        progress.style.width = `${Math.max(0, Math.min(100, item.progress))}%`;
      }
    });

    // ------------------------------------------
    // RASIO DATA LATIH DAN UJI
    // ------------------------------------------

    const ratio = $(".ratio-legend", cards[1]);

    if (ratio) {
      ratio.innerHTML = `
        <span>
          <i class="legend-blue"></i>
          Latih ${trainCount} (${trainPercent}%)
        </span>

        <span>
          <i class="legend-lightblue"></i>
          Uji ${testCount} (${testPercent}%)
        </span>
      `;
    }
  }

  // ==========================================================
  // 10. RENDER CONFUSION MATRIX
  // ==========================================================

  function renderConfusionMatrix() {
    const table = $(".matrix-table");

    if (!table) return;

    const head = table.querySelector("thead");

    const body = table.querySelector("tbody");

    if (!head || !body) return;

    head.innerHTML = `
      <tr>
        <th rowspan="2"
            colspan="2"
            class="matrix-label">
          MATRIKS
        </th>

        <th colspan="3"
            class="matrix-super">
          PREDIKSI C4.5
        </th>

        <th rowspan="2"
            class="total-head">
          Total
        </th>
      </tr>

      <tr>
        ${CLASSES.map((label) => `<th>${label}</th>`).join("")}
      </tr>
    `;

    let html = "";

    CLASSES.forEach((actual, rowIndex) => {
      const row = CLASSES.map((predicted) => state.matrix[actual][predicted]);

      const rowTotal = row.reduce((sum, value) => sum + value, 0);

      html += "<tr>";

      if (rowIndex === 0) {
        html += `
          <th rowspan="3"
              class="actual-label">
            <span>AKTUAL</span>
          </th>
        `;
      }

      html += `
        <th class="row-label">
          ${actual}
        </th>
      `;

      row.forEach((value, columnIndex) => {
        html += `
          <td class="${rowIndex === columnIndex ? "correct-cell" : ""}">
            ${value}
          </td>
        `;
      });

      html += `
        <td class="total-cell">
          ${rowTotal}
        </td>
      `;

      html += "</tr>";
    });

    // ------------------------------------------
    // TOTAL PREDIKSI
    // ------------------------------------------

    const columnTotals = CLASSES.map((predicted) =>
      CLASSES.reduce((sum, actual) => sum + state.matrix[actual][predicted], 0),
    );

    const summary = getSummary();

    html += `
      <tr class="matrix-total-row">

        <th colspan="2"
            class="row-label">
          Total Prediksi
        </th>

        ${columnTotals.map((value) => `<td>${value}</td>`).join("")}

        <td class="grand-total">
          ${summary.total}
        </td>

      </tr>
    `;

    body.innerHTML = html;

    // ------------------------------------------
    // KETERANGAN MATRIX
    // ------------------------------------------

    const legend = $(".matrix-legend");

    if (legend) {
      legend.innerHTML = `
        <span>
          <i class="legend-correct"></i>
          Diagonal Utama: ${summary.correct} Tepat
        </span>

        <span>
          <i class="legend-error"></i>
          Misklasifikasi: ${summary.wrong} Kasus
        </span>
      `;
    }

    const description = $(".confusion-panel .panel-heading p");

    if (description) {
      description.textContent = `Matriks aktual dan prediksi berdasarkan ${summary.total} data uji dari model pelatihan #${numberValue(state.activeModel?.id_pelatihan)}.`;
    }
  }

  // ==========================================================
  // 11. RENDER DETAIL PREDIKSI DATA UJI
  // ==========================================================

  function renderPredictions() {
    const tbody = $(".prediction-table tbody");

    if (!tbody) return;

    const total = state.predictions.length;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    state.page = Math.min(Math.max(1, state.page), totalPages);

    const start = (state.page - 1) * PAGE_SIZE;

    const rows = state.predictions.slice(start, start + PAGE_SIZE);

    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7"
              style="text-align:center">
            Belum ada detail data pengujian.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = rows
        .map(
          (item) => `
            <tr>

              <td>
                <strong>
                  #${escapeHTML(item.id)}
                </strong>
              </td>

              <td>
                ${escapeHTML(getLevelName(item.x1, "x1"))}
              </td>

              <td>
                ${escapeHTML(getLevelName(item.x2, "x2"))}
              </td>

              <td>
                ${escapeHTML(getLevelName(item.x3, "x3"))}
              </td>

              <td>
                <span class="class-badge ${getClassType(item.actual)}">
                  ${escapeHTML(item.actual)}
                </span>
              </td>

              <td>
                <span class="class-badge ${getClassType(item.predicted)}">
                  ${escapeHTML(item.predicted)}
                </span>
              </td>

              <td>
                <span class="status-badge ${
                  item.correct ? "correct" : "wrong"
                }">
                  ${item.correct ? "⊙ Benar" : "⊗ Salah"}
                </span>
              </td>

            </tr>
          `,
        )
        .join("");
    }

    renderPagination(totalPages);

    const note = $(".prediction-note");

    if (note) {
      note.textContent = `Menampilkan ${rows.length} dari ${total} data uji`;
    }

    const footer = $(".prediction-footer > span");

    if (footer) {
      footer.textContent = `Menampilkan baris ${total ? start + 1 : 0} s/d ${start + rows.length} dari ${total} kasus pengujian`;
    }
  }

  // ==========================================================
  // 12. PAGINATION
  // ==========================================================

  function renderPagination(totalPages) {
    const pagination = $(".prediction-footer .pagination");

    if (!pagination) return;

    let html = `
      <a href="#"
         class="page-control"
         data-page="prev">
        Sebelumnya
      </a>
    `;

    for (let page = 1; page <= totalPages; page += 1) {
      html += `
        <a
          href="#"
          class="page-number ${page === state.page ? "active" : ""}"
          data-page="${page}">
          ${page}
        </a>
      `;
    }

    html += `
      <a href="#"
         class="page-control"
         data-page="next">
        Berikutnya
      </a>
    `;

    pagination.innerHTML = html;
  }

  // ==========================================================
  // 13. PREDIKSI KOMBINASI DOMAIN DARI POHON TERSIMPAN
  //
  // Tidak membuat pohon baru.
  // Hanya membaca struktur pohon dari database.
  // ==========================================================

  function predictWithStoredTree(tree, input) {
    let current = tree;

    let guard = 0;

    while (current && current.type === "node" && guard < 10) {
      guard += 1;

      const attribute = current.attribute;

      const value = String(input[attribute]);

      const branches = current.branches || {};

      if (!Object.prototype.hasOwnProperty.call(branches, value)) {
        return String(current.fallback || "-");
      }

      current = branches[value];
    }

    return String(current?.label || "-");
  }

  // ==========================================================
  // 14. RENDER EVALUASI 27 KOMBINASI
  // ==========================================================

  function renderDomainEvaluation() {
    const panel = $(".domain-panel");

    if (!panel) return;

    const tree = state.activeModel?.struktur_pohon;

    const combinations = [];

    for (let x1 = 1; x1 <= 3; x1 += 1) {
      for (let x2 = 1; x2 <= 3; x2 += 1) {
        for (let x3 = 1; x3 <= 3; x3 += 1) {
          const count = state.dataset.filter(
            (item) => item.x1 === x1 && item.x2 === x2 && item.x3 === x3,
          ).length;

          combinations.push({
            x1,
            x2,
            x3,
            count,

            prediction: tree
              ? predictWithStoredTree(tree, { x1, x2, x3 })
              : "-",
          });
        }
      }
    }

    const observed = combinations.filter((item) => item.count > 0).length;

    const summary = $(".domain-summary", panel);

    if (summary) {
      summary.innerHTML = `
        <span class="summary-match">
          <strong>${observed} Teramati</strong>
          dari 27 kombinasi
        </span>

        <span class="summary-adjust">
          <strong>${27 - observed} Belum Teramati</strong>
        </span>
      `;
    }

    const grid = $(".domain-grid", panel);

    if (!grid) return;

    grid.innerHTML = [1, 2, 3]
      .map((x1) => {
        const group = combinations.filter((item) => item.x1 === x1);

        const observedGroup = group.filter((item) => item.count > 0).length;

        return `
          <article class="domain-card">

            <div class="domain-card-heading">

              <strong>
                Blok ${x1}: Kerusakan
                ${getLevelName(x1, "x1")}
              </strong>

              <span>
                ${observedGroup}/9 Teramati
              </span>

            </div>

            <div class="rule-list">

              ${group
                .map(
                  (item) => `
                    <div class="rule-row">

                      <span>
                        ${getLevelName(item.x1, "x1")}
                        ×
                        ${getLevelName(item.x2, "x2")}
                        ×
                        ${getLevelName(item.x3, "x3")}
                      </span>

                      <strong class="${
                        item.count ? "rule-match" : "rule-pruned"
                      }">

                        ${
                          item.count
                            ? `${item.count} data · ${escapeHTML(item.prediction)}`
                            : "Belum ada data"
                        }

                      </strong>

                    </div>
                  `,
                )
                .join("")}

            </div>

          </article>
        `;
      })
      .join("");

    const note = $(".domain-note p", panel);

    if (note) {
      note.textContent = `Dari 27 kombinasi teoretis atribut, ${observed} kombinasi memiliki data pada dataset. Prediksi untuk setiap kombinasi dibaca dari struktur Decision Tree yang tersimpan pada model aktif. Kombinasi tanpa data belum memiliki dukungan empiris.`;
    }

    const heading = $(".domain-heading p", panel);

    if (heading) {
      heading.textContent =
        "Pemetaan 27 kombinasi atribut X1, X2, dan X3 berdasarkan dataset dan pohon keputusan tersimpan.";
    }
  }

  // ==========================================================
  // 15. KONDISI BELUM ADA MODEL
  // ==========================================================

  function showEmptyState(
    message = "Belum ada model C4.5 aktif. Jalankan pelatihan terlebih dahulu dari halaman Pelatihan C4.5.",
  ) {
    $$(".metric-card").forEach((card) => {
      const value = $(".metric-value", card);

      const description = $(".metric-description", card);

      const progress = $(".progress-fill", card);

      if (value) {
        value.textContent = "-";
      }

      if (description) {
        description.textContent = "Data belum tersedia";
      }

      if (progress) {
        progress.style.width = "0%";
      }
    });

    const matrixBody = $(".matrix-table tbody");

    if (matrixBody) {
      matrixBody.innerHTML = `
        <tr>
          <td colspan="6"
              style="text-align:center;padding:20px">
            ${escapeHTML(message)}
          </td>
        </tr>
      `;
    }

    const predictionBody = $(".prediction-table tbody");

    if (predictionBody) {
      predictionBody.innerHTML = `
        <tr>
          <td colspan="7"
              style="text-align:center;padding:20px">
            ${escapeHTML(message)}
          </td>
        </tr>
      `;
    }

    const grid = $(".domain-grid");

    if (grid) {
      grid.innerHTML = `
        <article class="domain-card">
          ${escapeHTML(message)}
        </article>
      `;
    }

    const summary = $(".domain-summary");

    if (summary) {
      summary.textContent = "Model belum tersedia";
    }

    const note = $(".prediction-note");

    if (note) {
      note.textContent = "Belum ada data pengujian";
    }

    const footer = $(".prediction-footer > span");

    if (footer) {
      footer.textContent = "Belum ada hasil pengujian tersimpan";
    }
  }

  // ==========================================================
  // 16. PROSES UTAMA
  //
  // Urutan:
  // 1. Ambil model aktif.
  // 2. Ambil dataset untuk informasi atribut.
  // 3. Ambil hasil detail model aktif.
  // 4. Tampilkan seluruh hasil dari database.
  // ==========================================================

  async function runEvaluation() {
    if (state.loading) return;

    state.loading = true;

    try {
      await loadHistory();

      if (!state.activeModel) {
        showEmptyState();
        return;
      }

      // Dataset hanya untuk mencocokkan atribut X1-X3.
      await loadDataset();

      // Hasil pelatihan dan pengujian diambil dari database.
      await loadActiveDetails();

      state.page = 1;

      renderMetrics();

      renderConfusionMatrix();

      renderPredictions();

      renderDomainEvaluation();

      console.info("Hasil pengujian berhasil dibaca dari database.", {
        id_pelatihan: state.activeModel.id_pelatihan,

        dataset: numberValue(state.activeModel.jumlah_dataset),

        training: numberValue(state.activeModel.jumlah_data_latih),

        testing: numberValue(state.activeModel.jumlah_data_uji),

        accuracy: state.activeModel.akurasi,

        predictions: state.predictions.length,
      });
    } catch (error) {
      console.error("Gagal memuat hasil pengujian:", error);

      showEmptyState(error.message || "Hasil pengujian gagal dimuat.");
    } finally {
      state.loading = false;
    }
  }

  // ==========================================================
  // 17. EVENT LISTENER PAGINATION
  // ==========================================================

  function bindEvents() {
    const pagination = $(".prediction-footer .pagination");

    pagination?.addEventListener("click", (event) => {
      const link = event.target.closest("[data-page]");

      if (!link) return;

      event.preventDefault();

      const value = link.dataset.page;

      const totalPages = Math.max(
        1,
        Math.ceil(state.predictions.length / PAGE_SIZE),
      );

      if (value === "prev") {
        state.page = Math.max(1, state.page - 1);
      } else if (value === "next") {
        state.page = Math.min(totalPages, state.page + 1);
      } else {
        state.page = Math.min(totalPages, Math.max(1, numberValue(value, 1)));
      }

      renderPredictions();
    });
  }

  // ==========================================================
  // 18. INISIALISASI
  // ==========================================================

  function init() {
    if (!$(".metrics-grid") || !$(".matrix-table") || !$(".prediction-table")) {
      return;
    }

    bindEvents();

    runEvaluation();

    console.info("SIPFAS Hasil Pengujian siap. Sumber hasil: database MySQL.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
