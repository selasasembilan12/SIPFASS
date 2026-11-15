
/* =========================================================
   SIPFAS - ADMIN PELATIHAN C4.5
   File: Pelatihan-C45.js

   Sumber:
   LocalStorage: sipfas_dataset_c45

   Fitur:
   1. Membaca dataset
   2. Pembagian data training 80% dan testing 20%
   3. Menghitung entropy
   4. Menghitung information gain
   5. Menghitung split information
   6. Menghitung gain ratio
   7. Menentukan root node
   8. Memperbarui tabel evaluasi
   9. Memperbarui statistik
   10. Visualisasi hasil pohon keputusan
========================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "sipfas_dataset_c45";

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

  const state = {
    dataset: [],
    training: [],
    testing: [],
    evaluations: [],
    root: null,
    tree: null
  };

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

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


  // =====================================================
  // 1. MEMBACA DATASET
  // =====================================================

  function loadDataset() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        state.dataset = [];
        return;
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        throw new Error("Format dataset tidak valid.");
      }

      state.dataset = parsed.filter(item =>
        item &&
        Number(item.x1) >= 1 &&
        Number(item.x1) <= 3 &&
        Number(item.x2) >= 1 &&
        Number(item.x2) <= 3 &&
        Number(item.x3) >= 1 &&
        Number(item.x3) <= 3 &&
        ["Tinggi", "Sedang", "Rendah"].includes(item.label)
      ).map(item => ({
        ...item,
        x1: Number(item.x1),
        x2: Number(item.x2),
        x3: Number(item.x3),
        label: item.label
      }));

    } catch (error) {
      console.error("Gagal memuat dataset:", error);
      state.dataset = [];
    }
  }


  // =====================================================
  // 2. PEMBAGIAN TRAINING DAN TESTING
  // =====================================================

  function splitDataset(data) {
    const shuffled = [...data];

    // Pengacakan deterministik agar hasil dapat direproduksi.
    let seed = 42;

    function random() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const trainCount = Math.floor(shuffled.length * 0.8);

    state.training = shuffled.slice(0, trainCount);
    state.testing = shuffled.slice(trainCount);
  }


  // =====================================================
  // 3. ENTROPY
  // =====================================================

  function entropy(data) {
    if (!data.length) return 0;

    const counts = {};

    data.forEach(item => {
      counts[item.label] = (counts[item.label] || 0) + 1;
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
  // 4. PEMBAGIAN BERDASARKAN ATRIBUT
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
  // 5. INFORMATION GAIN
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
  // 6. SPLIT INFORMATION
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
  // 7. GAIN RATIO
  // =====================================================

  function calculateGainRatio(data, attribute) {
    const gain = calculateGain(data, attribute);
    const splitInfo = calculateSplitInfo(data, attribute);

    if (splitInfo === 0) return 0;

    return gain / splitInfo;
  }


  // =====================================================
  // 8. EVALUASI SEMUA ATRIBUT
  // =====================================================

  function evaluateAttributes(data) {
    const initialEntropy = entropy(data);

    return ATTRIBUTES.map(attribute => {

      const gain = calculateGain(data, attribute.key);

      const splitInfo = calculateSplitInfo(
        data,
        attribute.key
      );

      const gainRatio = calculateGainRatio(
        data,
        attribute.key
      );

      return {
        ...attribute,
        entropy: initialEntropy,
        gain,
        splitInfo,
        gainRatio
      };

    });
  }


  // =====================================================
  // 9. MENENTUKAN ROOT NODE
  // =====================================================

  function determineRoot(evaluations) {
    if (!evaluations.length) return null;

    const sorted = [...evaluations].sort(
      (a, b) => b.gainRatio - a.gainRatio
    );

    return sorted[0];
  }


  // =====================================================
  // 10. PEMBENTUKAN DECISION TREE
  // =====================================================

  function majorityClass(data) {
    const counts = {};

    data.forEach(item => {
      counts[item.label] = (counts[item.label] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "Tidak diketahui";
  }

  function buildTree(data, availableAttributes, depth = 0) {

    if (!data.length) {
      return { type: "leaf", label: "Tidak diketahui" };
    }

    const labels = [...new Set(data.map(item => item.label))];

    if (labels.length === 1) {
      return { type: "leaf", label: labels[0] };
    }

    if (!availableAttributes.length || depth >= 3) {
      return {
        type: "leaf",
        label: majorityClass(data)
      };
    }

    const evaluations = evaluateAttributes(
      data.map(item => item)
    ).filter(item =>
      availableAttributes.includes(item.key)
    );

    const best = determineRoot(evaluations);

    if (!best || best.gainRatio <= 0) {
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
      name: best.name,
      gainRatio: best.gainRatio,
      branches
    };
  }


  // =====================================================
  // 11. MEMBANGUN MODEL
  // =====================================================

  function trainModel() {

    if (state.dataset.length < 2) {
      state.training = [];
      state.testing = [];
      state.evaluations = [];
      state.root = null;
      state.tree = null;
      return false;
    }

    splitDataset(state.dataset);

    if (!state.training.length) return false;

    state.evaluations = evaluateAttributes(
      state.training
    );

    state.root = determineRoot(
      state.evaluations
    );

    state.tree = buildTree(
      state.training,
      ATTRIBUTES.map(item => item.key)
    );

    return true;
  }


  // =====================================================
  // 12. STATISTIK
  // =====================================================

  function updateStatistics() {

    const cards = $$(".stat-card");

    if (cards.length < 4) return;

    const total = state.dataset.length;
    const train = state.training.length;
    const test = state.testing.length;

    const values = [
      total,
      train,
      test,
      state.root ? state.root.name : "-"
    ];

    cards.forEach((card, index) => {
      const value = $(".stat-value", card);

      if (!value) return;

      if (index === 3) {
        value.textContent = values[index];
      } else {
        value.textContent = values[index];

        const percentage = total
          ? (values[index] / total * 100).toFixed(1)
          : "0.0";

        const small = document.createElement("small");

        small.textContent = `${percentage}%`;

        value.appendChild(small);
      }
    });

    const rootNote = $(".root-note");

    if (rootNote) {
      rootNote.textContent = state.root
        ? `Gain Ratio: ${state.root.gainRatio.toFixed(3)} (Tertinggi)`
        : "Belum tersedia";
    }

  }


  // =====================================================
  // 13. TABEL EVALUASI ATRIBUT
  // =====================================================

  function renderEvaluation() {

    const tbody = $(".evaluation-table tbody");

    if (!tbody) return;

    if (!state.evaluations.length || !state.root) {

      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:20px">
            Dataset belum mencukupi untuk pelatihan.
          </td>
        </tr>
      `;

      return;
    }

    const maxGainRatio = state.root.gainRatio;

    tbody.innerHTML = state.evaluations.map(item => {

      const selected =
        item.key === state.root.key;

      return `
        <tr class="${selected ? "selected-row" : ""}">

          <td>
            <strong>${item.key.toUpperCase()}</strong>
          </td>

          <td class="attribute-name">
            ${escapeHTML(item.name)}
          </td>

          <td>${item.entropy.toFixed(3)}</td>

          <td>${item.gain.toFixed(3)}</td>

          <td>${item.splitInfo.toFixed(3)}</td>

          <td>
            <strong class="ratio">
              ${item.gainRatio.toFixed(3)}
            </strong>
          </td>

          <td>
            <span class="node-choice ${selected ? "selected" : ""}">
              ${selected ? "Root Node Terpilih" : "Kandidat Sub-Node"}
            </span>
          </td>

        </tr>
      `;

    }).join("");

    const entropyPill = $(".entropy-pill");

    if (entropyPill) {
      entropyPill.textContent =
        `Total Entropy Awal (S): ${entropy(state.training).toFixed(3)}`;
    }

    const foot = $(".evaluation-foot");

    if (foot) {
      const spans = $$("span", foot);

      if (spans[0]) {
        spans[0].textContent =
          `Kriteria Keputusan: max(GainRatio) = ${maxGainRatio.toFixed(3)} pada variabel ${state.root.name}.`;
      }

      if (spans[1]) {
        spans[1].textContent =
          `Jumlah Data Latih: ${state.training.length}`;
      }
    }

  }


  // =====================================================
  // 14. VISUALISASI POHON KEPUTUSAN
  // =====================================================

  function renderTreeNode(node, branchLabel = "") {

    if (!node) return "";

    if (node.type === "leaf") {

      const className = node.label === "Tinggi"
        ? "priority-high"
        : node.label === "Sedang"
          ? "priority-medium"
          : "priority-low";

      return `
        <div class="branch-card terminal">
          <small>HASIL KLASIFIKASI</small>
          <strong class="priority ${className}">
            Prioritas ${escapeHTML(node.label)}
          </strong>
        </div>
      `;

    }

    const branches = Object.entries(node.branches);

    return `
      <div class="branch">
        <span class="branch-label">
          ${escapeHTML(branchLabel)}
        </span>

        <div class="branch-card">
          <div>
            <small>SUB-SIMPUL</small>
            <strong>${escapeHTML(node.name)}</strong>
          </div>
        </div>

        <div class="leaf-pair">
          ${branches.map(([value, child]) => `
            <div>
              <small>${escapeHTML(getLevelName(
                value,
                node.attribute
              ))}</small>

              ${renderTreeNode(child, value)}
            </div>
          `).join("")}
        </div>
      </div>
    `;

  }


  function renderDecisionTree() {

    const canvas = $(".tree-canvas");

    if (!canvas) return;

    if (!state.tree || !state.root) {

      canvas.innerHTML = `
        <p style="text-align:center;padding:30px">
          Decision Tree belum dapat dibentuk.
        </p>
      `;

      return;
    }

    const root = state.root;

    const rootGroups = partition(
      state.training,
      root.key
    );

    const branches = Object.entries(rootGroups);

    canvas.innerHTML = `

      <div class="tree-root">

        <span class="tree-root-icon">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="2.5"/>
            <circle cx="5" cy="19" r="2.5"/>
            <circle cx="19" cy="19" r="2.5"/>
            <path d="M12 7.5v4M5 16.5v-3h14v3M12 11.5v2"/>
          </svg>
        </span>

        <div>
          <small>SIMPUL UTAMA (ROOT)</small>
          <strong>${escapeHTML(root.name)}</strong>
        </div>

      </div>

      <div class="tree-branches">

        ${branches.map(([value, group]) => {

          const child = state.tree.type === "node"
            ? state.tree.branches[value]
            : state.tree;

          return `
            <div class="branch">

              <span class="branch-label">
                ${escapeHTML(getLevelName(value, root.key))}
              </span>

              ${renderTreeNode(child, value)}

              <small>
                ${group.length} data latih
              </small>

            </div>
          `;

        }).join("")}

      </div>

    `;

  }


  // =====================================================
  // 15. NOTIFIKASI HASIL PELATIHAN
  // =====================================================

  function showTrainingMessage() {

    const existing = $("#training-message");

    existing?.remove();

    const message = document.createElement("div");

    message.id = "training-message";

    message.style.cssText = `
      padding: 14px 16px;
      margin-bottom: 15px;
      border-radius: 7px;
      background: #edf5ff;
      color: #244d7b;
      font-size: 12px;
      line-height: 1.7;
    `;

    message.textContent =
      `Pelatihan selesai. ${state.training.length} data digunakan ` +
      `untuk training dan ${state.testing.length} data disisihkan ` +
      `untuk testing. Root node: ${state.root.name}.`;

    $(".stats-grid")?.after(message);

  }


  // =====================================================
  // 16. JALANKAN PELATIHAN
  // =====================================================

  function runTraining() {

    loadDataset();

    if (state.dataset.length < 2) {

      alert(
        "Dataset minimal harus memiliki dua data untuk pelatihan."
      );

      return;
    }

    if (!trainModel()) {

      alert("Pelatihan tidak dapat dijalankan.");

      return;
    }

    updateStatistics();

    renderEvaluation();

    renderDecisionTree();

    showTrainingMessage();

    $("#training-message")?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

  }


  // =====================================================
  // 17. EVENT LISTENER
  // =====================================================

  function bindEvents() {

    const trainButton = $(
      '.btn-primary[href="#evaluasi-atribut"]'
    );

    trainButton?.addEventListener("click", function(event) {

      event.preventDefault();

      runTraining();

    });

    // Sinkronisasi jika dataset berubah di tab lain.

    window.addEventListener("storage", function(event) {

      if (event.key === STORAGE_KEY) {

        loadDataset();

        if (state.dataset.length >= 2) {

          trainModel();

          updateStatistics();

          renderEvaluation();

          renderDecisionTree();

        } else {

          updateStatistics();

          renderEvaluation();

          renderDecisionTree();

        }

      }

    });

  }


  // =====================================================
  // 18. INISIALISASI
  // =====================================================

  function init() {

    if (!$(".evaluation-table")) return;

    loadDataset();

    if (state.dataset.length >= 2) {

      trainModel();

      updateStatistics();

      renderEvaluation();

      renderDecisionTree();

    } else {

      updateStatistics();

      renderEvaluation();

      renderDecisionTree();

    }

    bindEvents();

    console.log(
      "SIPFAS Pelatihan C4.5 berhasil diinisialisasi."
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
