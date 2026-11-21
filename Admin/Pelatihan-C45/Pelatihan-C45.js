(() => {
  "use strict";

  // =======================================================
  // 01. KONFIGURASI API
  // =======================================================

  const TRAINING_API = "../../api/admin/pelatihan-c45.php";

  const ATTRIBUTE_NAMES = {
    x1: "Tingkat Kerusakan",
    x2: "Dampak Akademik",
    x3: "Frekuensi Penggunaan",
  };

  const ATTRIBUTE_LEVELS = {
    x1: ["Ringan", "Sedang", "Berat"],
    x2: ["Rendah", "Sedang", "Tinggi"],
    x3: ["Jarang", "Sedang", "Sering"],
  };

  // =======================================================
  // 02. STATE
  // =======================================================

  const state = {
    csrfToken: "",

    datasetCount: 0,
    trainingCount: 0,
    testingCount: 0,

    trainPercent: 80,
    testPercent: 20,

    rootAttribute: null,
    rootName: "-",

    evaluations: [],
    tree: null,

    accuracy: null,
    activeModelId: null,
  };

  // =======================================================
  // 03. HELPER DOM
  // =======================================================

  const $ = (selector, parent = document) => parent.querySelector(selector);

  const $$ = (selector, parent = document) => [
    ...parent.querySelectorAll(selector),
  ];

  // =======================================================
  // 04. MENCEGAH HTML INJECTION
  // =======================================================

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

  // =======================================================
  // 05. FORMAT ANGKA
  // =======================================================

  function formatNumber(value, digits = 3) {
    const number = Number(value);

    return Number.isFinite(number) ? number.toFixed(digits) : "0.000";
  }

  // =======================================================
  // 06. MENGUBAH NILAI ATRIBUT KE NAMA KATEGORI
  // =======================================================

  function getLevelName(value, attribute) {
    const levels = ATTRIBUTE_LEVELS[attribute];

    const index = Number(value) - 1;

    return levels && index >= 0 && index < levels.length
      ? levels[index]
      : String(value);
  }

  // =======================================================
  // 07. REQUEST API
  // =======================================================

  async function request(url, options = {}) {
    const headers = {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(url, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers,
    });

    let result;

    try {
      result = await response.json();
    } catch (error) {
      throw new Error("Respons server tidak valid. Periksa endpoint PHP.");
    }

    if (!response.ok || result.success === false) {
      throw new Error(result.message || "Permintaan ke server gagal.");
    }

    return result;
  }

  // =======================================================
  // 08. MENAMPILKAN NOTIFIKASI
  // =======================================================

  function showMessage(message, type = "info") {
    let box = $("#training-message");

    if (!box) {
      box = document.createElement("div");

      box.id = "training-message";

      const container = $(".stats-grid");

      if (container) {
        container.after(box);
      } else {
        return;
      }
    }

    box.style.cssText = `
      padding: 14px 16px;
      margin: 0 0 15px;
      border-radius: 7px;
      font-size: 12px;
      line-height: 1.7;
      background: ${type === "error" ? "#fff0f0" : "#edf5ff"};
      color: ${type === "error" ? "#9b2525" : "#244d7b"};
    `;

    box.textContent = message;
  }

  // =======================================================
  // 09. MEMPERBARUI STATISTIK
  // =======================================================

  function updateStatistics() {
    const cards = $$(".stat-card");

    if (cards.length < 4) return;

    const values = [
      state.datasetCount,
      state.trainingCount,
      state.testingCount,
      state.rootName,
    ];

    cards.forEach((card, index) => {
      const value = $(".stat-value", card);

      if (!value) return;

      value.textContent = String(values[index] ?? "-");

      if (index < 3) {
        const total = state.datasetCount || 0;

        const percent = total
          ? ((Number(values[index]) / total) * 100).toFixed(1)
          : "0.0";

        const small = document.createElement("small");

        small.textContent = `${percent}%`;

        value.appendChild(small);
      }
    });

    const note = $(".root-note");

    if (note) {
      const selected = state.evaluations.find(
        (item) => item.attribute === state.rootAttribute,
      );

      note.textContent = selected
        ? `Gain Ratio: ${formatNumber(selected.gain_ratio)} (Tertinggi)`
        : "Model belum tersedia";
    }
  }

  // =======================================================
  // 10. MENAMPILKAN EVALUASI ATRIBUT
  // =======================================================

  function renderEvaluation() {
    const tbody = $(".evaluation-table tbody");

    if (!tbody) return;

    if (!state.evaluations.length || !state.rootAttribute) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:20px">
            Belum ada hasil pelatihan.
            Klik tombol Mulai Pelatihan C4.5.
          </td>
        </tr>
      `;

      const pill = $(".entropy-pill");

      if (pill) {
        pill.textContent = "Total Entropy Awal (S): -";
      }

      return;
    }

    tbody.innerHTML = state.evaluations
      .map((item) => {
        const selected = item.attribute === state.rootAttribute;

        return `
        <tr class="${selected ? "selected-row" : ""}">

          <td>
            <strong>
              ${escapeHTML(String(item.attribute).toUpperCase())}
            </strong>
          </td>

          <td class="attribute-name">
            ${escapeHTML(ATTRIBUTE_NAMES[item.attribute] || item.attribute)}
          </td>

          <td>
            ${formatNumber(item.entropy)}
          </td>

          <td>
            ${formatNumber(item.information_gain)}
          </td>

          <td>
            ${formatNumber(item.split_information)}
          </td>

          <td>
            <strong class="ratio">
              ${formatNumber(item.gain_ratio)}
            </strong>
          </td>

          <td>
            <span class="node-choice ${selected ? "selected" : ""}">
              ${selected ? "Root Node Terpilih" : "Kandidat Sub-Node"}
            </span>
          </td>

        </tr>
      `;
      })
      .join("");

    const first = state.evaluations[0];

    const pill = $(".entropy-pill");

    if (pill) {
      pill.textContent = `Total Entropy Awal (S): ${formatNumber(
        first.entropy,
      )}`;
    }

    const foot = $(".evaluation-foot");

    if (foot) {
      const spans = $$("span", foot);

      if (spans[0]) {
        const selected = state.evaluations.find(
          (item) => item.attribute === state.rootAttribute,
        );

        spans[0].textContent = selected
          ? `Kriteria Keputusan: max(GainRatio) = ${formatNumber(
              selected.gain_ratio,
            )} pada variabel ${state.rootName}.`
          : "Kriteria keputusan belum tersedia.";
      }

      if (spans[1]) {
        spans[1].textContent = `Jumlah Data Latih: ${state.trainingCount}`;
      }
    }
  }

  // =======================================================
  // 11. MEMBENTUK TAMPILAN SUBTREE
  // =======================================================

  function renderSubtree(node, branchLabel = "") {
    if (!node) return "";

    // -----------------------------------------------
    // NODE DAUN
    // -----------------------------------------------

    if (node.type === "leaf") {
      const label = String(node.label || "Tidak diketahui");

      const priorityClass =
        label === "Tinggi"
          ? "priority-high"
          : label === "Sedang"
            ? "priority-medium"
            : "priority-low";

      return `
        <div class="branch-card terminal">

          <small>HASIL KLASIFIKASI</small>

          <strong class="priority ${priorityClass}">
            Prioritas ${escapeHTML(label)}
          </strong>

        </div>
      `;
    }

    // -----------------------------------------------
    // NODE KEPUTUSAN
    // -----------------------------------------------

    const attribute = node.attribute;

    const branches = Object.entries(node.branches || {});

    return `
      <div class="branch">

        ${
          branchLabel
            ? `
              <span class="branch-label">
                ${escapeHTML(branchLabel)}
              </span>
            `
            : ""
        }

        <div class="branch-card">

          <div>
            <small>SUB-SIMPUL</small>

            <strong>
              ${escapeHTML(
                node.attribute_name || ATTRIBUTE_NAMES[attribute] || attribute,
              )}
            </strong>
          </div>

        </div>

        <div class="leaf-pair">

          ${branches
            .map(
              ([value, child]) => `
            <div>

              <small>
                ${escapeHTML(getLevelName(value, attribute))}
              </small>

              ${renderSubtree(child)}

            </div>
          `,
            )
            .join("")}

        </div>

      </div>
    `;
  }

  // =======================================================
  // 12. MENAMPILKAN POHON KEPUTUSAN
  // =======================================================

  function renderDecisionTree() {
    const canvas = $(".tree-canvas");

    if (!canvas) return;

    if (!state.tree) {
      canvas.innerHTML = `
        <p style="text-align:center;padding:30px">
          Decision Tree belum tersedia.
          Jalankan pelatihan untuk membentuk pohon keputusan.
        </p>
      `;

      return;
    }

    // -----------------------------------------------
    // JIKA ROOT LANGSUNG BERUPA LEAF
    // -----------------------------------------------

    if (state.tree.type === "leaf") {
      canvas.innerHTML = renderSubtree(state.tree);
      return;
    }

    // -----------------------------------------------
    // ROOT NODE
    // -----------------------------------------------

    const rootAttribute = state.tree.attribute;

    const branches = Object.entries(state.tree.branches || {});

    canvas.innerHTML = `
      <div class="tree-root">

        <span class="tree-root-icon">

          <svg viewBox="0 0 24 24">

            <circle cx="12" cy="5" r="2.5"/>
            <circle cx="5" cy="19" r="2.5"/>
            <circle cx="19" cy="19" r="2.5"/>

            <path d="
              M12 7.5v4
              M5 16.5v-3h14v3
              M12 11.5v2
            "/>

          </svg>

        </span>

        <div>

          <small>SIMPUL UTAMA (ROOT)</small>

          <strong>
            ${escapeHTML(state.rootName)}
          </strong>

        </div>

      </div>

      <div class="tree-branches">

        ${branches
          .map(
            ([value, child]) => `
          <div class="branch">

            <span class="branch-label">
              ${escapeHTML(getLevelName(value, rootAttribute))}
            </span>

            ${renderSubtree(child)}

          </div>
        `,
          )
          .join("")}

      </div>
    `;
  }

  // =======================================================
  // 13. MEMASUKKAN HASIL PELATIHAN KE STATE
  // =======================================================

  function applyTrainingResult(data) {
    state.activeModelId = data.id_pelatihan || null;

    state.datasetCount = Number(data.dataset_count || 0);

    state.trainingCount = Number(data.training_count || 0);

    state.testingCount = Number(data.testing_count || 0);

    state.trainPercent = Number(data.training_percentage || 80);

    state.testPercent = Number(data.testing_percentage || 20);

    state.rootAttribute = data.root_attribute || null;

    state.rootName =
      data.root_attribute_name || ATTRIBUTE_NAMES[state.rootAttribute] || "-";

    state.tree = data.decision_tree || null;

    state.evaluations = (data.root_evaluations || []).map((item) => {
      const attribute = String(
        item.attribute || item.nama_atribut || "",
      ).toLowerCase();

      return {
        attribute,

        entropy: Number(item.entropy ?? item.nilai_entropy ?? 0),

        information_gain: Number(
          item.information_gain ?? item.perolehan_informasi ?? 0,
        ),

        split_information: Number(
          item.split_information ?? item.nilai_informasi_pemisah ?? 0,
        ),

        gain_ratio: Number(item.gain_ratio ?? item.rasio_gain ?? 0),
      };
    });

    state.accuracy = data.evaluation
      ? Number(data.evaluation.accuracy) * 100
      : data.akurasi !== undefined
        ? Number(data.akurasi)
        : null;

    updateStatistics();

    renderEvaluation();

    renderDecisionTree();
  }

  // =======================================================
  // 14. MEMUAT MODEL AKTIF DARI DATABASE
  // =======================================================

  async function loadCurrentModel() {
    const result = await request(TRAINING_API, {
      method: "GET",
    });

    const data = result.data || {};

    state.csrfToken = data.csrf_token || "";

    // -----------------------------------------------
    // JIKA MODEL AKTIF TERSEDIA
    // -----------------------------------------------

    if (data.active_model) {
      const model = data.active_model;

      applyTrainingResult({
        id_pelatihan: model.id_pelatihan,

        dataset_count: model.jumlah_dataset,

        training_count: model.jumlah_data_latih,

        testing_count: model.jumlah_data_uji,

        training_percentage: model.persentase_latih,

        testing_percentage: model.persentase_uji,

        root_attribute: model.atribut_akar,

        root_attribute_name:
          ATTRIBUTE_NAMES[model.atribut_akar] || model.atribut_akar,

        decision_tree: model.struktur_pohon,

        akurasi: model.akurasi,

        root_evaluations: data.active_evaluations || [],
      });

      showMessage(
        `Model C4.5 aktif dimuat dari database. ` +
          `ID pelatihan: ${model.id_pelatihan}. ` +
          `Akurasi pengujian: ${formatNumber(model.akurasi, 2)}%.`,
      );
    } else {
      // ---------------------------------------------
      // BELUM ADA MODEL AKTIF
      // ---------------------------------------------

      state.datasetCount = 0;
      state.trainingCount = 0;
      state.testingCount = 0;

      state.rootAttribute = null;
      state.rootName = "-";

      state.evaluations = [];
      state.tree = null;

      state.activeModelId = null;

      updateStatistics();

      renderEvaluation();

      renderDecisionTree();

      showMessage(
        "Belum ada model C4.5 aktif. " +
          "Klik Mulai Pelatihan C4.5 untuk melatih " +
          "dataset yang tersimpan di database.",
      );
    }
  }

  // =======================================================
  // 15. MENJALANKAN PELATIHAN C4.5 MELALUI PHP
  // =======================================================

  async function runTraining() {
    const button = $('.btn-primary[href="#evaluasi-atribut"]');

    // -----------------------------------------------
    // MENGUNCI TOMBOL SELAMA PELATIHAN
    // -----------------------------------------------

    if (button) {
      button.dataset.originalText = button.textContent.trim();

      button.style.pointerEvents = "none";

      button.style.opacity = "0.65";

      const span = button.querySelector("span");

      if (span) {
        span.textContent = "Sedang Melatih...";
      }
    }

    try {
      // ---------------------------------------------
      // MEMASTIKAN TOKEN CSRF TERSEDIA
      // ---------------------------------------------

      if (!state.csrfToken) {
        await loadCurrentModel();
      }

      if (!state.csrfToken) {
        throw new Error(
          "Token keamanan CSRF tidak ditemukan. Muat ulang halaman.",
        );
      }

      // ---------------------------------------------
      // MENGIRIM PERMINTAAN KE API PHP
      // ---------------------------------------------

      const result = await request(TRAINING_API, {
        method: "POST",

        headers: {
          "X-CSRF-Token": state.csrfToken,
        },

        body: JSON.stringify({
          persentase_latih: 80,
          seed: 42,
        }),
      });

      const data = result.data || {};

      // ---------------------------------------------
      // MENAMPILKAN HASIL DARI SERVER
      // ---------------------------------------------

      applyTrainingResult(data);

      const accuracy = data.evaluation
        ? Number(data.evaluation.accuracy) * 100
        : 0;

      showMessage(
        `Pelatihan C4.5 berhasil. ` +
          `${data.training_count} data latih, ` +
          `${data.testing_count} data uji, ` +
          `Root Node: ${data.root_attribute_name}, ` +
          `Akurasi: ${formatNumber(accuracy, 2)}%. ` +
          `Model tersimpan dengan ID ${data.id_pelatihan}. ` +
          `Model sebelumnya telah diarsipkan.`,
      );

      console.log("===== HASIL PELATIHAN C4.5 =====");

      console.log("ID Pelatihan:", data.id_pelatihan);

      console.log("Jumlah Dataset:", data.dataset_count);

      console.log("Jumlah Data Latih:", data.training_count);

      console.log("Jumlah Data Uji:", data.testing_count);

      console.log("Root Attribute:", data.root_attribute);

      console.log("Evaluasi Atribut:", data.root_evaluations);

      console.log("Decision Tree:", data.decision_tree);

      console.log("Akurasi:", accuracy + "%");

      console.log("===============================");
    } catch (error) {
      // ---------------------------------------------
      // MENAMPILKAN ERROR
      // ---------------------------------------------

      console.error("[SIPFAS PELATIHAN C4.5]", error);

      showMessage(error.message || "Pelatihan C4.5 gagal dijalankan.", "error");
    } finally {
      // ---------------------------------------------
      // MEMBUKA KEMBALI TOMBOL
      // ---------------------------------------------

      if (button) {
        button.style.pointerEvents = "";

        button.style.opacity = "";

        const span = button.querySelector("span");

        if (span) {
          span.textContent =
            button.dataset.originalText || "Mulai Pelatihan C4.5";
        }
      }
    }
  }

  // =======================================================
  // 16. EVENT TOMBOL PELATIHAN
  // =======================================================

  function bindEvents() {
    const button = $('.btn-primary[href="#evaluasi-atribut"]');

    if (!button) return;

    button.addEventListener("click", function (event) {
      event.preventDefault();

      runTraining();
    });
  }

  // =======================================================
  // 17. INISIALISASI HALAMAN
  // =======================================================

  async function init() {
    if (!$(".evaluation-table")) {
      return;
    }

    bindEvents();

    try {
      await loadCurrentModel();
    } catch (error) {
      console.error("[SIPFAS] Gagal memuat model C4.5:", error);

      showMessage(
        error.message || "Data pelatihan gagal dimuat dari server.",
        "error",
      );

      renderEvaluation();

      renderDecisionTree();
    }
  }

  // =======================================================
  // 18. MENJALANKAN INISIALISASI
  // =======================================================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
