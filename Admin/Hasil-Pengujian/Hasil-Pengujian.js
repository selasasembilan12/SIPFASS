
/* =========================================================
   SIPFAS - ADMIN HASIL PENGUJIAN C4.5
   File: Hasil-Pengujian.js

   Sumber dataset:
   LocalStorage: sipfas_dataset_c45

   Fitur:
   1. Membaca dataset
   2. Split training 80% dan testing 20%
   3. Membentuk model C4.5
   4. Prediksi data testing
   5. Confusion Matrix 3x3
   6. Accuracy, Precision, Recall, F1-score
   7. Pagination hasil pengujian
   8. Evaluasi 27 kombinasi atribut
   9. Sinkronisasi dataset
========================================================= */

(() => {
  "use strict";

  const DATASET_API = "../../api/admin/dataset-c45.php";

  const CLASSES = ["Rendah", "Sedang", "Tinggi"];

  const ATTRIBUTES = [
    {
      key: "x1",
      name: "Tingkat Kerusakan",
      levels: ["Ringan", "Sedang", "Berat"]
    },
    {
      key: "x2",
      name: "Dampak Akademik",
      levels: ["Rendah", "Sedang", "Tinggi"]
    },
    {
      key: "x3",
      name: "Frekuensi Penggunaan",
      levels: ["Jarang", "Sedang", "Sering"]
    }
  ];

  const PAGE_SIZE = 5;

  const state = {
    dataset: [],
    training: [],
    testing: [],
    predictions: [],
    matrix: [],
    metrics: {},
    tree: null,
    page: 1,
    initialized: false
  };

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];


  // =====================================================
  // 1. HELPER
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

  function getLevelName(value, key) {
    return ATTRIBUTES.find(a => a.key === key)
      ?.levels[Number(value) - 1] || "-";
  }

  function getClassType(label) {
    if (label === "Tinggi") return "high";
    if (label === "Sedang") return "medium";
    return "low";
  }

  function percentage(value) {
    return `${(value * 100).toFixed(2)}%`;
  }

  function safeDivide(a, b) {
    return b === 0 ? 0 : a / b;
  }


  // =====================================================
  // 2. MEMBACA DATASET
  // =====================================================

  async function loadDataset() {
    const allItems = [];
    let page = 1;
    let total = Infinity;

    try {
      while (allItems.length < total) {
        const response = await fetch(
          `${DATASET_API}?page=${page}&limit=100`,
          { method: "GET", credentials: "same-origin", headers: { Accept: "application/json" } }
        );

        const result = await response.json();
        if (!response.ok || result.success !== true) {
          throw new Error(result.message || "Gagal mengambil dataset dari server.");
        }

        const data = result.data || {};
        const items = Array.isArray(data.items) ? data.items : [];
        allItems.push(...items);
        total = Number(data.pagination?.total ?? allItems.length);
        if (items.length === 0) break;
        page += 1;
      }

      state.dataset = allItems.map(item => ({
        id: item.id_data ?? item.kode_data,
        facility: item.nama_fasilitas ?? "Fasilitas",
        x1: Number(item.tingkat_kerusakan_x1),
        x2: Number(item.dampak_akademik_x2),
        x3: Number(item.frekuensi_penggunaan_x3),
        label: item.label_prioritas,
        ...item
      })).filter(item => (
        item.id && item.facility &&
        [1, 2, 3].includes(Number(item.x1)) &&
        [1, 2, 3].includes(Number(item.x2)) &&
        [1, 2, 3].includes(Number(item.x3)) &&
        CLASSES.includes(item.label)
      )).map(item => ({
        ...item,
        x1: Number(item.x1),
        x2: Number(item.x2),
        x3: Number(item.x3)
      }));

      return true;
    } catch (error) {
      console.error("Gagal membaca dataset dari API:", error);
      state.dataset = [];
      showApiError(error.message || "Dataset gagal dimuat dari server.");
      return false;
    }
  }

  function showApiError(message) {
    const target = $(".prediction-table tbody");
    if (target) {
      target.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px">${escapeHTML(message)}</td></tr>`;
    }
  }

  // =====================================================
  // 3. SPLIT DATA TRAINING DAN TESTING
  // =====================================================

  function splitDataset(data) {

    const shuffled = [...data];

    // Seed tetap agar pembagian data dapat direproduksi.
    let seed = 42;

    function random() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }

    for (let i = shuffled.length - 1; i > 0; i--) {

      const j = Math.floor(random() * (i + 1));

      [shuffled[i], shuffled[j]] =
        [shuffled[j], shuffled[i]];

    }

    const trainingCount = Math.floor(
      shuffled.length * 0.8
    );

    state.training = shuffled.slice(0, trainingCount);

    state.testing = shuffled.slice(trainingCount);

  }


  // =====================================================
  // 4. ENTROPY
  // =====================================================

  function entropy(data) {

    if (!data.length) return 0;

    const counts = {};

    data.forEach(item => {

      counts[item.label] =
        (counts[item.label] || 0) + 1;

    });

    let result = 0;

    Object.values(counts).forEach(count => {

      const probability = count / data.length;

      if (probability > 0) {

        result -= probability * Math.log2(probability);

      }

    });

    return result;

  }


  // =====================================================
  // 5. PARTITION
  // =====================================================

  function partition(data, attribute) {

    const groups = {};

    data.forEach(item => {

      const value = String(item[attribute]);

      if (!groups[value]) {
        groups[value] = [];
      }

      groups[value].push(item);

    });

    return groups;

  }


  // =====================================================
  // 6. INFORMATION GAIN
  // =====================================================

  function calculateGain(data, attribute) {

    if (!data.length) return 0;

    const initialEntropy = entropy(data);

    const groups = partition(data, attribute);

    let remainingEntropy = 0;

    Object.values(groups).forEach(group => {

      remainingEntropy +=
        (group.length / data.length) * entropy(group);

    });

    return initialEntropy - remainingEntropy;

  }


  // =====================================================
  // 7. SPLIT INFORMATION
  // =====================================================

  function calculateSplitInfo(data, attribute) {

    if (!data.length) return 0;

    const groups = partition(data, attribute);

    let result = 0;

    Object.values(groups).forEach(group => {

      const probability = group.length / data.length;

      if (probability > 0) {

        result -= probability * Math.log2(probability);

      }

    });

    return result;

  }


  // =====================================================
  // 8. GAIN RATIO
  // =====================================================

  function calculateGainRatio(data, attribute) {

    const gain = calculateGain(data, attribute);

    const splitInfo = calculateSplitInfo(
      data,
      attribute
    );

    if (splitInfo === 0) return 0;

    return gain / splitInfo;

  }


  // =====================================================
  // 9. MAJORITY CLASS
  // =====================================================

  function majorityClass(data) {

    const counts = {};

    CLASSES.forEach(label => {
      counts[label] = 0;
    });

    data.forEach(item => {
      counts[item.label]++;
    });

    return CLASSES.reduce((best, label) => {

      return counts[label] > counts[best]
        ? label
        : best;

    }, CLASSES[0]);

  }


  // =====================================================
  // 10. PEMBENTUKAN DECISION TREE C4.5
  // =====================================================

  function buildTree(data, availableAttributes, depth = 0) {

    if (!data.length) {
      return {
        type: "leaf",
        label: "Rendah"
      };
    }

    const labels = [
      ...new Set(data.map(item => item.label))
    ];

    if (labels.length === 1) {

      return {
        type: "leaf",
        label: labels[0]
      };

    }

    if (
      availableAttributes.length === 0 ||
      depth >= 3
    ) {

      return {
        type: "leaf",
        label: majorityClass(data)
      };

    }

    const candidates = availableAttributes.map(attribute => ({

      key: attribute,

      gain: calculateGain(data, attribute),

      splitInfo: calculateSplitInfo(data, attribute),

      gainRatio: calculateGainRatio(data, attribute)

    }));

    const validCandidates = candidates.filter(item =>
      item.splitInfo > 0
    );

    if (!validCandidates.length) {

      return {
        type: "leaf",
        label: majorityClass(data)
      };

    }

    // C4.5 menggunakan kandidat dengan Gain Ratio
    // tertinggi, dengan pemeriksaan Information Gain.
    const averageGain = validCandidates.reduce(
      (sum, item) => sum + item.gain,
      0
    ) / validCandidates.length;

    const eligible = validCandidates.filter(
      item => item.gain >= averageGain
    );

    const pool = eligible.length
      ? eligible
      : validCandidates;

    pool.sort((a, b) => b.gainRatio - a.gainRatio);

    const best = pool[0];

    if (best.gainRatio <= 0) {

      return {
        type: "leaf",
        label: majorityClass(data)
      };

    }

    const groups = partition(data, best.key);

    const remaining = availableAttributes.filter(
      key => key !== best.key
    );

    const branches = {};

    Object.entries(groups).forEach(([value, group]) => {

      branches[value] = buildTree(
        group,
        remaining,
        depth + 1
      );

    });

    return {
      type: "node",
      attribute: best.key,
      gainRatio: best.gainRatio,
      branches,
      fallback: majorityClass(data)
    };

  }


  // =====================================================
  // 11. PREDIKSI
  // =====================================================

  function predict(tree, item) {

    let current = tree;

    while (current && current.type === "node") {

      const value = String(item[current.attribute]);

      const next = current.branches[value];

      if (!next) {
        return current.fallback;
      }

      current = next;

    }

    return current?.label || "Rendah";

  }


  // =====================================================
  // 12. PELATIHAN DAN PENGUJIAN
  // =====================================================

  function runModel() {

    if (state.dataset.length < 2) {

      state.training = [];
      state.testing = [];
      state.predictions = [];
      state.tree = null;

      return false;

    }

    splitDataset(state.dataset);

    if (!state.training.length || !state.testing.length) {
      return false;
    }

    state.tree = buildTree(
      state.training,
      ATTRIBUTES.map(item => item.key)
    );

    state.predictions = state.testing.map(item => {

      const prediction = predict(state.tree, item);

      return {
        ...item,
        actual: item.label,
        predicted: prediction,
        correct: item.label === prediction
      };

    });

    return true;

  }


  // =====================================================
  // 13. CONFUSION MATRIX
  // =====================================================

  function calculateConfusionMatrix() {

    const matrix = CLASSES.map(() =>
      CLASSES.map(() => 0)
    );

    state.predictions.forEach(item => {

      const actualIndex = CLASSES.indexOf(item.actual);

      const predictedIndex = CLASSES.indexOf(
        item.predicted
      );

      if (actualIndex >= 0 && predictedIndex >= 0) {

        matrix[actualIndex][predictedIndex]++;

      }

    });

    state.matrix = matrix;

  }


  // =====================================================
  // 14. METRIK EVALUASI
  // =====================================================

  function calculateMetrics() {

    const total = state.predictions.length;

    const correct = state.predictions.filter(
      item => item.correct
    ).length;

    const accuracy = safeDivide(correct, total);

    const classMetrics = CLASSES.map((label, index) => {

      const TP = state.matrix[index][index];

      const FP = state.matrix.reduce(
        (sum, row, rowIndex) =>
          sum + (rowIndex === index ? 0 : row[index]),
        0
      );

      const FN = state.matrix[index].reduce(
        (sum, value, columnIndex) =>
          sum + (columnIndex === index ? 0 : value),
        0
      );

      const precision = safeDivide(TP, TP + FP);

      const recall = safeDivide(TP, TP + FN);

      const f1 = safeDivide(
        2 * precision * recall,
        precision + recall
      );

      return {
        label,
        TP,
        FP,
        FN,
        precision,
        recall,
        f1
      };

    });

    const macroPrecision =
      classMetrics.reduce(
        (sum, item) => sum + item.precision,
        0
      ) / CLASSES.length;

    const macroRecall =
      classMetrics.reduce(
        (sum, item) => sum + item.recall,
        0
      ) / CLASSES.length;

    const macroF1 =
      classMetrics.reduce(
        (sum, item) => sum + item.f1,
        0
      ) / CLASSES.length;

    state.metrics = {
      total,
      correct,
      wrong: total - correct,
      accuracy,
      error: total ? 1 - accuracy : 0,
      macroPrecision,
      macroRecall,
      macroF1,
      classMetrics
    };

  }


  // =====================================================
  // 15. KARTU METRIK
  // =====================================================

  function renderMetrics() {

    const cards = $$(".metric-card");

    if (cards.length < 5) return;

    const m = state.metrics;

    const values = [
      {
        value: percentage(m.accuracy),
        description: `${m.correct} dari ${m.total} kasus pengujian benar`,
        progress: m.accuracy * 100
      },
      {
        value: `${state.training.length} / ${state.testing.length}`,
        description: `${percentage(0.8)} Latih • ${percentage(0.2)} Uji (target)`,
        progress: 80
      },
      {
        value: percentage(m.macroPrecision),
        description: "Macro Precision 3 Kelas",
        progress: m.macroPrecision * 100
      },
      {
        value: percentage(m.macroRecall),
        description: "Macro Recall 3 Kelas",
        progress: m.macroRecall * 100
      },
      {
        value: percentage(m.error),
        description: `${m.wrong} kasus salah klasifikasi`,
        progress: m.error * 100
      }
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
        progress.style.width =
          `${Math.max(0, Math.min(100, item.progress))}%`;
      }

    });

    // Rasio aktual ditampilkan berdasarkan jumlah data.
    const ratio = $(".ratio-legend", cards[1]);

    if (ratio) {

      ratio.innerHTML = `
        <span><i class="legend-blue"></i>Latih ${state.training.length}</span>
        <span><i class="legend-lightblue"></i>Uji ${state.testing.length}</span>
      `;

    }

  }


  // =====================================================
  // 16. RENDER CONFUSION MATRIX
  // =====================================================

  function renderConfusionMatrix() {

    const table = $(".matrix-table");

    if (!table) return;

    const head = table.querySelector("thead");

    const body = table.querySelector("tbody");

    if (!head || !body) return;

    head.innerHTML = `
      <tr>
        <th rowspan="2" colspan="2" class="matrix-label">
          MATRIKS
        </th>
        <th colspan="3" class="matrix-super">
          PREDIKSI C4.5
        </th>
        <th rowspan="2" class="total-head">Total</th>
      </tr>
      <tr>
        ${CLASSES.map(label => `<th>${label}</th>`).join("")}
      </tr>
    `;

    let html = "";

    CLASSES.forEach((label, rowIndex) => {

      const row = state.matrix[rowIndex];

      const rowTotal = row.reduce(
        (sum, value) => sum + value,
        0
      );

      html += "<tr>";

      if (rowIndex === 0) {
        html += `
          <th rowspan="3" class="actual-label">
            <span>AKTUAL</span>
          </th>
        `;
      }

      html += `
        <th class="row-label">${label}</th>
      `;

      row.forEach((value, colIndex) => {

        html += `
          <td class="${rowIndex === colIndex ? "correct-cell" : ""}">
            ${value}
          </td>
        `;

      });

      html += `
        <td class="total-cell">${rowTotal}</td>
      `;

      html += "</tr>";

    });

    const columnTotals = CLASSES.map((_, columnIndex) => {

      return state.matrix.reduce(
        (sum, row) => sum + row[columnIndex],
        0
      );

    });

    html += `
      <tr class="matrix-total-row">
        <th colspan="2" class="row-label">
          Total Prediksi
        </th>

        ${columnTotals.map(value => `<td>${value}</td>`).join("")}

        <td class="grand-total">
          ${state.metrics.total}
        </td>
      </tr>
    `;

    body.innerHTML = html;

    const legend = $(".matrix-legend");

    if (legend) {

      legend.innerHTML = `
        <span>
          <i class="legend-correct"></i>
          Diagonal Utama: ${state.metrics.correct} Tepat
        </span>

        <span>
          <i class="legend-error"></i>
          Misklasifikasi: ${state.metrics.wrong} Kasus
        </span>
      `;

    }

    const description = $(".confusion-panel .panel-heading p");

    if (description) {

      description.textContent =
        `Matriks aktual dan prediksi berdasarkan ${state.metrics.total} data uji.`;

    }

  }


  // =====================================================
  // 17. TABEL DETAIL PREDIKSI
  // =====================================================

  function renderPredictions() {

    const tbody = $(".prediction-table tbody");

    if (!tbody) return;

    const total = state.predictions.length;

    const totalPages = Math.max(
      1,
      Math.ceil(total / PAGE_SIZE)
    );

    state.page = Math.min(
      Math.max(1, state.page),
      totalPages
    );

    const start = (state.page - 1) * PAGE_SIZE;

    const rows = state.predictions.slice(
      start,
      start + PAGE_SIZE
    );

    if (!rows.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center">
            Tidak ada data pengujian.
          </td>
        </tr>
      `;

    } else {

      tbody.innerHTML = rows.map(item => `

        <tr>

          <td>
            <strong>#${escapeHTML(item.id)}</strong>
          </td>

          <td>${getLevelName(item.x1, "x1")}</td>

          <td>${getLevelName(item.x2, "x2")}</td>

          <td>${getLevelName(item.x3, "x3")}</td>

          <td>
            <span class="class-badge ${getClassType(item.actual)}">
              ${item.actual}
            </span>
          </td>

          <td>
            <span class="class-badge ${getClassType(item.predicted)}">
              ${item.predicted}
            </span>
          </td>

          <td>
            <span class="status-badge ${item.correct ? "correct" : "wrong"}">
              ${item.correct ? "⊙ Benar" : "⊗ Salah"}
            </span>
          </td>

        </tr>

      `).join("");

    }

    renderPagination(totalPages);

    const note = $(".prediction-note");

    if (note) {

      note.textContent =
        `Menampilkan ${rows.length} dari ${total} data uji`;

    }

    const footer = $(".prediction-footer > span");

    if (footer) {

      footer.textContent =
        `Menampilkan baris ${total ? start + 1 : 0} s/d ${start + rows.length} dari ${total} kasus pengujian`;

    }

  }


  // =====================================================
  // 18. PAGINATION
  // =====================================================

  function renderPagination(totalPages) {

    const pagination = $(".prediction-footer .pagination");

    if (!pagination) return;

    let html = `
      <a href="#" class="page-control" data-page="prev">
        Sebelumnya
      </a>
    `;

    for (let i = 1; i <= totalPages; i++) {

      html += `
        <a
          href="#"
          class="page-number ${i === state.page ? "active" : ""}"
          data-page="${i}"
        >
          ${i}
        </a>
      `;

    }

    html += `
      <a href="#" class="page-control" data-page="next">
        Berikutnya
      </a>
    `;

    pagination.innerHTML = html;

  }


  // =====================================================
  // 19. EVALUASI 27 KOMBINASI ATRIBUT
  // =====================================================

  function renderDomainEvaluation() {

    const domainPanel = $(".domain-panel");

    if (!domainPanel) return;

    const combinations = [];

    for (let x1 = 1; x1 <= 3; x1++) {

      for (let x2 = 1; x2 <= 3; x2++) {

        for (let x3 = 1; x3 <= 3; x3++) {

          const matching = state.dataset.filter(item =>
            item.x1 === x1 &&
            item.x2 === x2 &&
            item.x3 === x3
          );

          const prediction = state.tree
            ? predict(state.tree, { x1, x2, x3 })
            : "-";

          combinations.push({
            x1,
            x2,
            x3,
            count: matching.length,
            prediction
          });

        }

      }

    }

    const observed = combinations.filter(
      item => item.count > 0
    ).length;

    const summary = $(".domain-summary", domainPanel);

    if (summary) {

      summary.innerHTML = `
        <span class="summary-match">
          <strong>${observed} Teramati</strong> dari 27 kombinasi
        </span>

        <span class="summary-adjust">
          <strong>${27 - observed} Belum Teramati</strong>
        </span>
      `;

    }

    const grid = $(".domain-grid", domainPanel);

    if (!grid) return;

    grid.innerHTML = [1, 2, 3].map(x1 => {

      const group = combinations.filter(
        item => item.x1 === x1
      );

      const observedGroup = group.filter(
        item => item.count > 0
      ).length;

      return `
        <article class="domain-card">

          <div class="domain-card-heading">

            <strong>
              Blok ${x1}: Kerusakan ${getLevelName(x1, "x1")}
            </strong>

            <span>${observedGroup}/9 Teramati</span>

          </div>

          <div class="rule-list">

            ${group.map(item => `

              <div class="rule-row">

                <span>
                  ${getLevelName(item.x1, "x1")} ×
                  ${getLevelName(item.x2, "x2")} ×
                  ${getLevelName(item.x3, "x3")}
                </span>

                <strong class="${item.count ? "rule-match" : "rule-pruned"}">
                  ${item.count
                    ? `${item.count} data · ${item.prediction}`
                    : "Belum ada data"}
                </strong>

              </div>

            `).join("")}

          </div>

        </article>
      `;

    }).join("");

    const note = $(".domain-note p", domainPanel);

    if (note) {

      note.textContent =
        `Dari 27 kombinasi teoretis atribut, ${observed} kombinasi ` +
        `memiliki data pada dataset. Kombinasi tanpa data belum ` +
        `memiliki dukungan empiris. Label prediksi pada kombinasi ` +
        `yang belum teramati merupakan hasil generalisasi model, ` +
        `bukan validasi pakar.`;

    }

    const heading = $(".domain-heading p", domainPanel);

    if (heading) {

      heading.textContent =
        "Pemetaan ruang kombinasi atribut X1, X2, dan X3 berdasarkan dataset yang tersedia.";

    }

  }


  // =====================================================
  // 20. KONDISI DATA TIDAK MENCUKUPI
  // =====================================================

  function showEmptyState() {

    const cards = $$(".metric-card");

    cards.forEach(card => {

      const value = $(".metric-value", card);

      const description = $(".metric-description", card);

      const progress = $(".progress-fill", card);

      if (value) value.textContent = "-";

      if (description) {
        description.textContent = "Data belum mencukupi";
      }

      if (progress) {
        progress.style.width = "0%";
      }

    });

    const matrixBody = $(".matrix-table tbody");

    if (matrixBody) {

      matrixBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:20px">
            Data pengujian belum tersedia.
          </td>
        </tr>
      `;

    }

    const predictionBody = $(".prediction-table tbody");

    if (predictionBody) {

      predictionBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:20px">
            Dataset minimal harus memiliki data training dan testing.
          </td>
        </tr>
      `;

    }

    const grid = $(".domain-grid");

    if (grid) {

      grid.innerHTML = `
        <article class="domain-card">
          Dataset belum mencukupi untuk evaluasi domain.
        </article>
      `;

    }

  }


  // =====================================================
  // 21. JALANKAN SEMUA PROSES
  // =====================================================

  async function runEvaluation() {

    const loaded = await loadDataset();
    if (!loaded) {
      showEmptyState();
      return;
    }

    state.page = 1;

    if (!runModel()) {

      showEmptyState();

      console.warn(
        "Dataset belum mencukupi untuk pengujian."
      );

      return;

    }

    calculateConfusionMatrix();

    calculateMetrics();

    renderMetrics();

    renderConfusionMatrix();

    renderPredictions();

    renderDomainEvaluation();

    state.initialized = true;

    console.log("Evaluasi SIPFAS berhasil.");

    console.log("Jumlah dataset:", state.dataset.length);

    console.log("Training:", state.training.length);

    console.log("Testing:", state.testing.length);

    console.log("Confusion Matrix:", state.matrix);

    console.log("Metrik evaluasi:", state.metrics);

  }


  // =====================================================
  // 22. EVENT LISTENER
  // =====================================================

  function bindEvents() {

    const pagination = $(".prediction-footer .pagination");

    pagination?.addEventListener("click", function(event) {

      const link = event.target.closest("[data-page]");

      if (!link) return;

      event.preventDefault();

      const value = link.dataset.page;

      const totalPages = Math.max(
        1,
        Math.ceil(state.predictions.length / PAGE_SIZE)
      );

      if (value === "prev") {

        state.page = Math.max(1, state.page - 1);

      } else if (value === "next") {

        state.page = Math.min(totalPages, state.page + 1);

      } else {

        state.page = Number(value);

      }

      renderPredictions();

    });


  }


  // =====================================================
  // 23. INISIALISASI
  // =====================================================

  function init() {

    if (!$(".metrics-grid") || !$(".matrix-table")) {
      return;
    }

    bindEvents();

    runEvaluation();

    console.log(
      "SIPFAS Hasil Pengujian C4.5 siap digunakan."
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
