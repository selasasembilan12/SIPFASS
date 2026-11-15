
/* =========================================================
   SIPFAS - ADMIN MANAJEMEN PENGGUNA
   File: Manajemen-Pengguna.js

   FITUR:
   1. Tambah pengguna
   2. Edit pengguna
   3. Hapus pengguna
   4. Pencarian pengguna
   5. Filter berdasarkan peran
   6. Filter berdasarkan status
   7. Pagination
   8. Statistik pengguna
   9. Logout menuju Login SIPFAS
========================================================= */

(() => {
  "use strict";

  // =====================================================
  // 1. KONFIGURASI
  // =====================================================

  const STORAGE_KEY = "sipfas_pengguna";
  const LOGIN_URL = "../../auth/login.html";

  const state = {
    users: [],
    filteredUsers: [],
    selectedId: null,
    search: "",
    role: "semua",
    status: "semua",
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

  function generateId() {
    return "USR-" + Date.now() + "-" +
      Math.random().toString(36).slice(2, 7);
  }

  // =====================================================
  // 3. NORMALISASI DATA
  // =====================================================

  function normalizeUser(user, index = 0) {
    const identity = String(getValue(
      user,
      ["identity", "nim", "nip", "nomorIdentitas"],
      ""
    ));

    return {
      id: String(getValue(
        user,
        ["id"],
        identity || `USR-${index + 1}`
      )),

      nama: String(getValue(
        user,
        ["nama", "namaLengkap", "name"],
        "-"
      )),

      identity,

      username: String(getValue(
        user,
        ["username", "userName"],
        identity
      )),

      email: String(getValue(
        user,
        ["email"],
        "-"
      )),

      role: String(getValue(
        user,
        ["role", "peran"],
        "Pelapor"
      )),

      status: normalize(getValue(
        user,
        ["status"],
        "aktif"
      )) === "nonaktif" ? "Nonaktif" : "Aktif"
    };
  }

  // =====================================================
  // 4. LOCAL STORAGE
  // =====================================================

  function readStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw === null) return null;

      const data = JSON.parse(raw);

      if (!Array.isArray(data)) {
        console.error("Format data pengguna tidak valid.");
        return null;
      }

      return data;

    } catch (error) {
      console.error("Gagal membaca LocalStorage:", error);
      return null;
    }
  }

  function saveStorage() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.users)
      );

      return true;

    } catch (error) {
      console.error("Gagal menyimpan pengguna:", error);
      alert("Data pengguna gagal disimpan.");
      return false;
    }
  }

  // =====================================================
  // 5. MEMBACA DATA AWAL DARI HTML
  // =====================================================

  function getInitialUsers() {
    const rows = $$(".user-table tbody tr");

    return rows.map((row, index) => {
      const cells = $$("td", row);

      const nama =
        cells[1]?.querySelector("strong")?.textContent.trim() || "";

      const identity = cells[2]?.textContent.trim() || "";
      const email = cells[3]?.textContent.trim() || "";
      const role = cells[4]?.textContent.trim() || "Pelapor";
      const status = cells[5]?.textContent.trim() || "Aktif";

      return normalizeUser({
        id: identity || `USR-${index + 1}`,
        nama,
        identity,
        username: identity,
        email,
        role,
        status
      }, index);

    }).filter(user => user.nama !== "");
  }

  // =====================================================
  // 6. MEMUAT DATA
  // =====================================================

  function loadUsers() {
    const stored = readStorage();

    if (stored !== null) {
      state.users = stored.map(normalizeUser);
    } else {
      state.users = getInitialUsers();
      saveStorage();
    }

    applyFilter();
  }

  // =====================================================
  // 7. VALIDASI DATA
  // =====================================================

  function validateUser(data, excludeId = null) {
    if (
      !data.nama ||
      !data.identity ||
      !data.username ||
      !data.email ||
      !data.role
    ) {
      alert("Semua kolom wajib diisi.");
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      alert("Format email tidak valid.");
      return false;
    }

    const duplicateIdentity = state.users.some(user =>
      normalize(user.identity) === normalize(data.identity) &&
      String(user.id) !== String(excludeId)
    );

    if (duplicateIdentity) {
      alert("NIM/NIP sudah digunakan oleh pengguna lain.");
      return false;
    }

    const duplicateUsername = state.users.some(user =>
      normalize(user.username) === normalize(data.username) &&
      String(user.id) !== String(excludeId)
    );

    if (duplicateUsername) {
      alert("Username sudah digunakan.");
      return false;
    }

    const duplicateEmail = state.users.some(user =>
      normalize(user.email) === normalize(data.email) &&
      String(user.id) !== String(excludeId)
    );

    if (duplicateEmail) {
      alert("Email sudah digunakan.");
      return false;
    }

    if (
      !["Administrator", "Petugas Sarpras", "Pelapor"]
        .includes(data.role)
    ) {
      alert("Peran pengguna tidak valid.");
      return false;
    }

    return true;
  }

  // =====================================================
  // 8. FILTER DAN PENCARIAN
  // =====================================================

  function applyFilter() {
    state.filteredUsers = state.users.filter(user => {
      const searchText = [
        user.nama,
        user.identity,
        user.username,
        user.email
      ].join(" ").toLowerCase();

      const matchesSearch =
        searchText.includes(state.search);

      const matchesRole =
        state.role === "semua" ||
        normalize(user.role) === normalize(state.role);

      const matchesStatus =
        state.status === "semua" ||
        normalize(user.status) === normalize(state.status);

      return matchesSearch && matchesRole && matchesStatus;
    });

    state.currentPage = 1;

    renderTable();
    updateStatistics();
  }

  // =====================================================
  // 9. MENAMPILKAN TABEL
  // =====================================================

  function renderTable() {
    const tbody = $(".user-table tbody");
    if (!tbody) return;

    const totalPages = Math.max(
      1,
      Math.ceil(state.filteredUsers.length / state.pageSize)
    );

    state.currentPage = Math.min(
      Math.max(1, state.currentPage),
      totalPages
    );

    const start = (state.currentPage - 1) * state.pageSize;

    const displayed = state.filteredUsers.slice(
      start,
      start + state.pageSize
    );

    if (displayed.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="user-empty">
            Data pengguna tidak ditemukan.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = displayed.map((user, index) => {
        let roleClass = "role-pelapor";

        if (user.role === "Administrator") {
          roleClass = "role-admin";
        }

        if (user.role === "Petugas Sarpras") {
          roleClass = "role-petugas";
        }

        const active = normalize(user.status) === "aktif";

        const statusClass = active
          ? "status-active"
          : "status-inactive";

        return `
          <tr data-id="${escapeHTML(user.id)}">

            <td>${start + index + 1}</td>

            <td>
              <strong>${escapeHTML(user.nama)}</strong>
            </td>

            <td class="identity">
              ${escapeHTML(user.identity)}
            </td>

            <td>${escapeHTML(user.email)}</td>

            <td>
              <span class="role-badge ${roleClass}">
                ${escapeHTML(user.role)}
              </span>
            </td>

            <td>
              <span class="status-badge ${statusClass}">
                ${escapeHTML(user.status)}
              </span>
            </td>

            <td>
              <div class="action-buttons">

                <label
                  for="edit-user-modal"
                  class="action-btn edit-user-btn"
                  data-id="${escapeHTML(user.id)}"
                  title="Edit pengguna"
                  role="button"
                  tabindex="0"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z"/>
                  </svg>
                </label>

                <label
                  for="delete-user-modal"
                  class="action-btn delete-btn delete-user-btn"
                  data-id="${escapeHTML(user.id)}"
                  title="Hapus pengguna"
                  role="button"
                  tabindex="0"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/>
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
  // 10. PAGINATION
  // =====================================================

  function renderPagination(totalPages) {
    const pagination = $(".pagination");
    if (!pagination) return;

    let html = `
      <button
        type="button"
        data-page="prev"
        ${state.currentPage === 1 ? "disabled" : ""}
      >‹</button>
    `;

    for (let page = 1; page <= totalPages; page++) {
      html += `
        <button
          type="button"
          data-page="${page}"
          class="${page === state.currentPage ? "active" : ""}"
        >
          ${page}
        </button>
      `;
    }

    html += `
      <button
        type="button"
        data-page="next"
        ${state.currentPage === totalPages ? "disabled" : ""}
      >›</button>
    `;

    pagination.innerHTML = html;
  }

  function changePage(page) {
    const totalPages = Math.max(
      1,
      Math.ceil(state.filteredUsers.length / state.pageSize)
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
  // 11. STATISTIK PENGGUNA
  // =====================================================

  function updateStatistics() {
    const cards = $$(".summary-card");

    if (cards.length < 3) return;

    const total = state.users.length;

    const petugas = state.users.filter(user =>
      normalize(user.role) === "petugas sarpras"
    ).length;

    const pelapor = state.users.filter(user =>
      normalize(user.role) === "pelapor"
    ).length;

    const totalNumber = $(".summary-number", cards[0]);
    const petugasNumber = $(".summary-number", cards[1]);
    const pelaporNumber = $(".summary-number", cards[2]);

    if (totalNumber) {
      totalNumber.innerHTML =
        `${total} <small>Akun Terdaftar</small>`;
    }

    if (petugasNumber) {
      petugasNumber.innerHTML =
        `${petugas} <small>Teknisi / Staf</small>`;
    }

    if (pelaporNumber) {
      pelaporNumber.innerHTML =
        `${pelapor} <small>Orang</small>`;
    }

    const roleFilter = $(".filter-actions select");

    if (roleFilter && roleFilter.options.length > 0) {
      roleFilter.options[0].textContent =
        `Semua Peran (${total})`;
    }
  }

  // =====================================================
  // 12. MODAL TAMBAH PENGGUNA
  // =====================================================

  function addUser() {
    const form = $(".user-form");

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const password = $("#password").value;

    if (password.length < 6) {
      alert("Password minimal terdiri dari 6 karakter.");
      $("#password").focus();
      return;
    }

    const user = {
      id: generateId(),
      nama: $("#nama").value.trim(),
      identity: $("#identity").value.trim(),
      username: $("#username").value.trim(),
      email: $("#email").value.trim(),
      role: $("#role").value,
      status: $("#status").value
    };

    if (!validateUser(user)) return;

    state.users.push(user);

    if (!saveStorage()) {
      state.users.pop();
      return;
    }

    form.reset();
    $("#add-user-modal").checked = false;

    applyFilter();

    alert(
      "Pengguna berhasil ditambahkan. Password tidak disimpan dalam LocalStorage."
    );
  }

  // =====================================================
  // 13. MODAL EDIT PENGGUNA
  // =====================================================

  function openEdit(id) {
    const user = state.users.find(
      item => String(item.id) === String(id)
    );

    if (!user) {
      alert("Data pengguna tidak ditemukan.");
      return;
    }

    state.selectedId = user.id;

    $("#edit-nama").value = user.nama;
    $("#edit-identity").value = user.identity;
    $("#edit-username").value = user.username;
    $("#edit-email").value = user.email;
    $("#edit-role").value = user.role;
    $("#edit-status").value = user.status;

    $("#edit-user-modal").checked = true;
  }

  function saveEdit() {
    if (state.selectedId === null) return;

    const form = $(".edit-user-form");

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const updated = {
      id: state.selectedId,
      nama: $("#edit-nama").value.trim(),
      identity: $("#edit-identity").value.trim(),
      username: $("#edit-username").value.trim(),
      email: $("#edit-email").value.trim(),
      role: $("#edit-role").value,
      status: $("#edit-status").value
    };

    if (!validateUser(updated, state.selectedId)) return;

    const index = state.users.findIndex(
      item => String(item.id) === String(state.selectedId)
    );

    if (index === -1) return;

    const previous = state.users[index];

    state.users[index] = updated;

    if (!saveStorage()) {
      state.users[index] = previous;
      return;
    }

    state.selectedId = null;
    $("#edit-user-modal").checked = false;

    applyFilter();

    alert("Data pengguna berhasil diperbarui.");
  }

  // =====================================================
  // 14. MODAL HAPUS PENGGUNA
  // =====================================================

  function openDelete(id) {
    const user = state.users.find(
      item => String(item.id) === String(id)
    );

    if (!user) {
      alert("Data pengguna tidak ditemukan.");
      return;
    }

    state.selectedId = user.id;

    const description = $(".delete-modal-card p");

    if (description) {
      description.innerHTML = `
        Apakah Anda yakin ingin menghapus pengguna
        <strong>${escapeHTML(user.nama)}</strong>
        (${escapeHTML(user.identity)})?
        Data pengguna yang dihapus tidak dapat dikembalikan.
      `;
    }

    $("#delete-user-modal").checked = true;
  }

  function deleteUser() {
    if (state.selectedId === null) return;

    const index = state.users.findIndex(
      item => String(item.id) === String(state.selectedId)
    );

    if (index === -1) return;

    const user = state.users[index];

    // Mencegah penghapusan administrator aktif terakhir.
    const activeAdmins = state.users.filter(item =>
      item.role === "Administrator" &&
      item.status === "Aktif"
    );

    if (
      user.role === "Administrator" &&
      user.status === "Aktif" &&
      activeAdmins.length <= 1
    ) {
      alert(
        "Administrator aktif terakhir tidak boleh dihapus."
      );

      $("#delete-user-modal").checked = false;
      state.selectedId = null;
      return;
    }

    const previous = [...state.users];

    state.users.splice(index, 1);

    if (!saveStorage()) {
      state.users = previous;
      return;
    }

    state.selectedId = null;
    $("#delete-user-modal").checked = false;

    applyFilter();

    alert("Pengguna berhasil dihapus.");
  }

  // =====================================================
  // 15. LOGOUT
  // =====================================================

  function handleLogout() {
    const logoutLink = $$(".sidebar-bottom .nav-link")
      .find(link =>
        link.textContent.trim().toLowerCase().includes("keluar")
      );

    if (!logoutLink) {
      console.warn("Tombol Keluar tidak ditemukan.");
      return;
    }

    logoutLink.addEventListener("click", function(event) {
      event.preventDefault();

      const confirmation = confirm(
        "Apakah kamu yakin ingin keluar dari SIPFAS?"
      );

      if (!confirmation) return;

      // Hapus sesi login, bukan data aplikasi.
      sessionStorage.clear();

      // Kembali ke halaman Login.
      window.location.replace(LOGIN_URL);
    });
  }

  // =====================================================
  // 16. EVENT LISTENER
  // =====================================================

  function bindEvents() {

    // SEARCH
    const searchInput = $(".search-box input");

    searchInput?.addEventListener("input", function() {
      state.search = normalize(this.value);
      applyFilter();
    });

    // FILTER PERAN
    const filters = $$(".filter-actions select");

    const roleFilter = filters[0];
    const statusFilter = filters[1];

    roleFilter?.addEventListener("change", function() {
      const value = this.value;

      state.role = value.toLowerCase().includes("semua")
        ? "semua"
        : value;

      applyFilter();
    });

    // FILTER STATUS
    statusFilter?.addEventListener("change", function() {
      const value = this.value;

      state.status = value.toLowerCase().includes("semua")
        ? "semua"
        : value;

      applyFilter();
    });

    // TOMBOL TAMBAH
    $(".save-btn")?.addEventListener("click", function(event) {
      event.preventDefault();
      addUser();
    });

    // TOMBOL EDIT DAN HAPUS
    const tbody = $(".user-table tbody");

    tbody?.addEventListener("click", function(event) {
      const editButton = event.target.closest(".edit-user-btn");
      const deleteButton = event.target.closest(".delete-user-btn");

      if (editButton) {
        event.preventDefault();
        event.stopPropagation();
        openEdit(editButton.dataset.id);
        return;
      }

      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        openDelete(deleteButton.dataset.id);
        return;
      }
    });

    // SIMPAN EDIT
    $(".action-save-btn")?.addEventListener("click", function(event) {
      event.preventDefault();
      saveEdit();
    });

    // KONFIRMASI HAPUS
    $(".action-delete-confirm")?.addEventListener("click", function(event) {
      event.preventDefault();
      deleteUser();
    });

    // PAGINATION
    $(".pagination")?.addEventListener("click", function(event) {
      const button = event.target.closest("button[data-page]");

      if (!button || button.disabled) return;

      changePage(button.dataset.page);
    });

    // ESCAPE MENUTUP MODAL
    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape") {
        $("#add-user-modal").checked = false;
        $("#edit-user-modal").checked = false;
        $("#delete-user-modal").checked = false;

        state.selectedId = null;
      }
    });

    // SINKRONISASI LOCAL STORAGE ANTAR TAB
    window.addEventListener("storage", function(event) {
      if (
        event.key === STORAGE_KEY ||
        event.key === null
      ) {
        loadUsers();
      }
    });

    // LOGOUT
    handleLogout();
  }

  // =====================================================
  // 17. INISIALISASI
  // =====================================================

  function init() {
    if (!$(".user-table")) return;

    loadUsers();
    bindEvents();

    console.log(
      "SIPFAS Manajemen Pengguna berhasil dijalankan."
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
