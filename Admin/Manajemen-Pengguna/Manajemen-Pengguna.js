(() => {
  "use strict";
  const API = "../../api/admin/manajemen-pengguna.php";
  const LOGIN_URL = "../../auth/login.html";
  const state = {
    users: [],
    roles: [],
    filteredUsers: [],
    selectedId: null,
    search: "",
    role: "semua",
    status: "semua",
    currentPage: 1,
    pageSize: 5,
  };
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const norm = (v) =>
    String(v ?? "")
      .trim()
      .toLowerCase();
  const esc = (v) =>
    String(v ?? "").replace(
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

  async function api(method = "GET", payload = null, query = "") {
    const options = {
      method,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    };
    if (payload && method !== "GET") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload);
    }
    const response = await fetch(API + query, options);
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("Respons server bukan JSON yang valid.");
    }
    if (!response.ok || result.success === false)
      throw new Error(
        result.message || `Permintaan gagal (${response.status}).`,
      );
    return result.data ?? {};
  }

  function normalizeUser(row) {
    const roleName = row.nama_peran || row.role || "Pelapor";
    return {
      id: Number(row.id_pengguna ?? row.id),
      nama: row.nama_lengkap ?? row.nama ?? "-",
      identity: row.nomor_identitas ?? row.identity ?? "",
      username: row.nama_pengguna ?? row.username ?? "",
      email: row.email ?? "",
      role: roleName,
      roleId: Number(row.id_peran ?? 0),
      status:
        norm(row.status_akun ?? row.status) === "nonaktif"
          ? "Nonaktif"
          : "Aktif",
    };
  }

  function roleIdFor(name) {
    const found = state.roles.find((r) => norm(r.nama_peran) === norm(name));
    return found ? Number(found.id_peran) : 0;
  }
  function roleNameForFilter(value) {
    if (!value || norm(value).includes("semua")) return "semua";
    const found = state.roles.find((r) => norm(r.nama_peran) === norm(value));
    return found ? Number(found.id_peran) : value;
  }

  async function loadUsers() {
    const data = await api("GET", null, "?page=1&limit=100");
    state.roles = Array.isArray(data.roles) ? data.roles : [];
    state.users = (data.items || []).map(normalizeUser);
    applyFilter();
  }

  function applyFilter() {
    state.filteredUsers = state.users.filter((u) => {
      const haystack = [u.nama, u.identity, u.username, u.email]
        .join(" ")
        .toLowerCase();
      const roleOk =
        state.role === "semua" ||
        (typeof state.role === "number"
          ? u.roleId === state.role
          : norm(u.role) === norm(state.role));
      const statusOk =
        state.status === "semua" || norm(u.status) === norm(state.status);
      return haystack.includes(state.search) && roleOk && statusOk;
    });
    const pages = Math.max(
      1,
      Math.ceil(state.filteredUsers.length / state.pageSize),
    );
    state.currentPage = Math.min(Math.max(1, state.currentPage), pages);
    renderTable();
    updateStatistics();
    renderPagination();
  }

  function renderTable() {
    const tbody = $(".user-table tbody");
    if (!tbody) return;
    const start = (state.currentPage - 1) * state.pageSize;
    const rows = state.filteredUsers.slice(start, start + state.pageSize);
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="user-empty">Data pengguna tidak ditemukan.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map((u, i) => {
        const roleClass = norm(u.role).includes("administrator")
          ? "role-admin"
          : norm(u.role).includes("petugas")
            ? "role-petugas"
            : "role-pelapor";
        const active = u.status === "Aktif";
        return `<tr data-id="${esc(u.id)}"><td>${start + i + 1}</td><td><strong>${esc(u.nama)}</strong></td><td class="identity">${esc(u.identity)}</td><td>${esc(u.email)}</td><td><span class="role-badge ${roleClass}">${esc(u.role)}</span></td><td><span class="status-badge ${active ? "status-active" : "status-inactive"}">${u.status}</span></td><td><div class="action-buttons"><label for="edit-user-modal" class="action-btn edit-user-btn" data-id="${esc(u.id)}" title="Edit pengguna" role="button" tabindex="0">✎</label><label for="delete-user-modal" class="action-btn delete-btn delete-user-btn" data-id="${esc(u.id)}" title="Hapus pengguna" role="button" tabindex="0">×</label></div></td></tr>`;
      })
      .join("");
  }

  function updateStatistics() {
    const cards = $$(".summary-card");
    const total = state.users.length;
    const petugas = state.users.filter((u) =>
      norm(u.role).includes("petugas"),
    ).length;
    const pelapor = state.users.filter(
      (u) => norm(u.role) === "pelapor",
    ).length;
    [total, petugas, pelapor].forEach((n, i) => {
      const el = $(".summary-number", cards[i]);
      if (el)
        el.innerHTML = `${n} <small>${["Akun Terdaftar", "Teknisi / Staf", "Orang"][i]}</small>`;
    });
    const first = $(".filter-actions select");
    if (first?.options[0])
      first.options[0].textContent = `Semua Peran (${total})`;
  }

  function renderPagination() {
    const el = $(".pagination");
    if (!el) return;
    const pages = Math.max(
      1,
      Math.ceil(state.filteredUsers.length / state.pageSize),
    );
    el.innerHTML =
      `<button type="button" data-page="${Math.max(1, state.currentPage - 1)}" ${state.currentPage === 1 ? "disabled" : ""} aria-label="Sebelumnya">‹</button>` +
      Array.from(
        { length: pages },
        (_, i) =>
          `<button type="button" data-page="${i + 1}" class="${state.currentPage === i + 1 ? "active" : ""}">${i + 1}</button>`,
      ).join("") +
      `<button type="button" data-page="${Math.min(pages, state.currentPage + 1)}" ${state.currentPage === pages ? "disabled" : ""} aria-label="Berikutnya">›</button>`;
  }

  function readForm(edit = false) {
    const prefix = edit ? "edit-" : "";
    const data = {
      nama_lengkap: $(`#${prefix}nama`).value.trim(),
      nomor_identitas: $(`#${prefix}identity`).value.trim(),
      nama_pengguna: $(`#${prefix}username`).value.trim(),
      email: $(`#${prefix}email`).value.trim(),
      id_peran: roleIdFor($(`#${prefix}role`).value),
      status_akun: $(`#${prefix}status`).value,
    };
    if (!edit) data.kata_sandi = $("#password").value;
    return data;
  }

  function validate(data, isEdit = false) {
    if (
      !data.nama_lengkap ||
      !data.nomor_identitas ||
      !data.nama_pengguna ||
      !data.email ||
      !data.id_peran
    ) {
      alert("Semua kolom wajib diisi.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      alert("Format email tidak valid.");
      return false;
    }
    if (!isEdit && (!data.kata_sandi || data.kata_sandi.length < 8)) {
      alert("Kata sandi minimal 8 karakter.");
      $("#password").focus();
      return false;
    }
    return true;
  }

  async function addUser() {
    const form = $(".user-form");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = readForm(false);
    if (!validate(data)) return;
    const button = $(".save-btn");
    button.disabled = true;
    try {
      await api("POST", data);
      form.reset();
      $("#add-user-modal").checked = false;
      await loadUsers();
      alert("Pengguna berhasil ditambahkan.");
    } catch (e) {
      alert(e.message);
    } finally {
      button.disabled = false;
    }
  }

  function openEdit(id) {
    const u = state.users.find((x) => String(x.id) === String(id));
    if (!u) return alert("Data pengguna tidak ditemukan.");
    state.selectedId = u.id;
    $("#edit-nama").value = u.nama;
    $("#edit-identity").value = u.identity;
    $("#edit-username").value = u.username;
    $("#edit-email").value = u.email;
    $("#edit-role").value = u.role;
    $("#edit-status").value = u.status;
    $("#edit-user-modal").checked = true;
  }

  async function saveEdit() {
    if (state.selectedId === null) return;
    const form = $(".edit-user-form");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = readForm(true);
    data.id_pengguna = state.selectedId;
    const passwordInput = $("#edit-password");
    if (passwordInput?.value) data.kata_sandi = passwordInput.value;
    if (!validate(data, true)) return;
    const button = $(".action-save-btn");
    button.disabled = true;
    try {
      await api("PUT", data);
      state.selectedId = null;
      $("#edit-user-modal").checked = false;
      await loadUsers();
      alert("Data pengguna berhasil diperbarui.");
    } catch (e) {
      alert(e.message);
    } finally {
      button.disabled = false;
    }
  }

  function openDelete(id) {
    const u = state.users.find((x) => String(x.id) === String(id));
    if (!u) return alert("Data pengguna tidak ditemukan.");
    state.selectedId = u.id;
    const p = $(".delete-modal-card p");
    if (p)
      p.innerHTML = `Apakah Anda yakin ingin menghapus pengguna <strong>${esc(u.nama)}</strong> (${esc(u.identity)})? Data pengguna yang dihapus tidak dapat dikembalikan.`;
    $("#delete-user-modal").checked = true;
  }

  async function deleteUser() {
    if (state.selectedId === null) return;
    const button = $(".action-delete-confirm");
    button.disabled = true;
    try {
      await api("DELETE", { id_pengguna: state.selectedId });
      state.selectedId = null;
      $("#delete-user-modal").checked = false;
      await loadUsers();
      alert("Pengguna berhasil dihapus.");
    } catch (e) {
      alert(e.message);
    } finally {
      button.disabled = false;
    }
  }

  function bindEvents() {
    $(".search-box input")?.addEventListener("input", (e) => {
      state.search = norm(e.target.value);
      state.currentPage = 1;
      applyFilter();
    });
    const filters = $$(".filter-actions select");
    filters[0]?.addEventListener("change", (e) => {
      state.role = roleNameForFilter(e.target.value);
      state.currentPage = 1;
      applyFilter();
    });
    filters[1]?.addEventListener("change", (e) => {
      const v = e.target.value;
      state.status = norm(v).includes("semua") ? "semua" : v;
      state.currentPage = 1;
      applyFilter();
    });
    $(".save-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      addUser();
    });
    $(".user-table tbody")?.addEventListener("click", (e) => {
      const edit = e.target.closest(".edit-user-btn");
      const del = e.target.closest(".delete-user-btn");
      if (edit) {
        e.preventDefault();
        openEdit(edit.dataset.id);
      }
      if (del) {
        e.preventDefault();
        openDelete(del.dataset.id);
      }
    });
    $(".action-save-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      saveEdit();
    });
    $(".action-delete-confirm")?.addEventListener("click", (e) => {
      e.preventDefault();
      deleteUser();
    });
    $(".pagination")?.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-page]");
      if (!b || b.disabled) return;
      state.currentPage = Number(b.dataset.page);
      applyFilter();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        $("#add-user-modal").checked = false;
        $("#edit-user-modal").checked = false;
        $("#delete-user-modal").checked = false;
        state.selectedId = null;
      }
    });
    const logout = $$(".sidebar-bottom .nav-link").find((a) =>
      norm(a.textContent).includes("keluar"),
    );
    logout?.addEventListener("click", (e) => {
      if (!confirm("Apakah Anda yakin ingin keluar dari SIPFAS?")) {
        e.preventDefault();
        return;
      }
    });
  }

  async function init() {
    if (!$(".user-table")) return;
    bindEvents();
    try {
      await loadUsers();
    } catch (e) {
      console.error("Gagal memuat pengguna:", e);
      const tbody = $(".user-table tbody");
      if (tbody)
        tbody.innerHTML = `<tr><td colspan="7" class="user-empty">${esc(e.message)} <button type="button" id="retry-users">Coba lagi</button></td></tr>`;
    }
    $(".user-table tbody")?.addEventListener("click", (e) => {
      if (e.target.id === "retry-users")
        loadUsers().catch((err) => alert(err.message));
    });
    console.log("SIPFAS Manajemen Pengguna terhubung ke API.");
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
