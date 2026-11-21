
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {

    // ============================================================
    // 01. KONFIGURASI API
    // ============================================================

    const API = {
      detail: "../../api/petugas/detail-penanganan.php",
      save: "../../api/petugas/simpan-penanganan.php",
      profile: "../../api/shared/profil-login.php",
      logout: "../../api/auth/logout.php"
    };

    const LOGIN_URL = "../../auth/Login.html";

    const $ = (id) => document.getElementById(id);

    // ============================================================
    // 02. ELEMEN HTML
    // ============================================================

    const form = $("handlingForm");
    const followUpInput = $("followUp");
    const statusInput = $("handlingStatus");
    const notesInput = $("officerNotes");

    const updatedAtElement = $("updatedAt");
    const reportCodeElement = $("reportCode");
    const pageCodeElement = $("pageCode");
    const headerStatusElement = $("headerStatus");

    const saveButton = $("saveHandling");
    const cancelButton = $("cancelButton");
    const copyButton = $("copyCode");

    const menuToggle = $("menuToggle");
    const sidebar = $("sidebar");
    const pageOverlay = $("pageOverlay");
    const logoutLink = $("logoutLink");

    if (
      !form ||
      !followUpInput ||
      !statusInput ||
      !notesInput ||
      !reportCodeElement ||
      !saveButton
    ) {
      console.error(
        "[SIPFAS] Elemen form penanganan tidak lengkap."
      );
      return;
    }

    // ============================================================
    // 03. STATE APLIKASI
    // ============================================================

    let currentReportCode = "";
    let currentReport = null;
    let currentOfficer = null;

    let originalFormData = null;

    let saving = false;
    let alreadyCompleted = false;
    let toastTimer = null;

    // ============================================================
    // 04. FUNGSI NORMALISASI
    // ============================================================

    function normalizeText(value) {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    function firstValue(object, keys, fallback = "") {
      for (const key of keys) {
        const value = object?.[key];

        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        ) {
          return value;
        }
      }

      return fallback;
    }

    function normalizeCode(value) {
      return String(value ?? "")
        .replace(/\s+/g, "")
        .trim()
        .toUpperCase();
    }

    // Menyamakan status database, HTML, dan PHP.
    function normalizeStatus(value) {
      const status = normalizeText(value);

      if ([
        "selesai",
        "completed",
        "selesai ditangani",
        "selesai diperbaiki",
        "ditutup"
      ].includes(status)) {
        return "Selesai";
      }

      if ([
        "diproses",
        "processing",
        "sedang diproses",
        "dalam proses",
        "sedang dikerjakan"
      ].includes(status)) {
        return "Diproses";
      }

      if ([
        "menunggu",
        "waiting",
        "menunggu perbaikan",
        "menunggu penanganan",
        "belum ditangani",
        "terverifikasi"
      ].includes(status)) {
        return "Menunggu";
      }

      return "";
    }

    // ============================================================
    // 05. VALIDASI STATUS VERIFIKASI
    // ============================================================

    function isValidReport(data) {
      const verification = normalizeText(
        firstValue(data, [
          "status_verifikasi",
          "hasil_verifikasi"
        ])
      );

      return [
        "valid",
        "terverifikasi",
        "diterima",
        "sudah diverifikasi"
      ].includes(verification);
    }

    // ============================================================
    // 06. MENGAMBIL KODE LAPORAN
    // ============================================================

    function getTargetCode() {
      const params = new URLSearchParams(
        window.location.search
      );

      return normalizeCode(
        params.get("kode") ||
        params.get("kode_laporan") ||
        reportCodeElement.textContent
      );
    }

    // ============================================================
    // 07. REQUEST API
    // ============================================================

    async function fetchJson(url, options = {}) {

      const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.headers || {})
        }
      });

      const raw = await response.text();

      let payload;

      try {
        payload = JSON.parse(raw);
      } catch (error) {
        console.error(
          "[SIPFAS] Respons API bukan JSON:",
          raw
        );

        throw new Error(
          "Respons server bukan JSON. Periksa endpoint API."
        );
      }

      if (response.status === 401) {
        window.location.replace(LOGIN_URL);

        throw new Error(
          "Sesi login telah berakhir. Silakan login kembali."
        );
      }

      if (!response.ok || payload.success !== true) {
        throw new Error(
          payload.message ||
          `Permintaan gagal. HTTP ${response.status}`
        );
      }

      return payload;
    }

    // ============================================================
    // 08. FORMAT WAKTU WIT
    // ============================================================

    function formatWIT(value) {
      if (!value) return "Belum tersedia";

      const raw = String(value).trim();

      // DATETIME database dianggap sudah menggunakan waktu WIT.
      // Jangan menambahkan offset UTC+9 kembali.
      const match = raw.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
      );

      if (match) {
        const [
          ,
          year,
          month,
          day,
          hour,
          minute,
          second
        ] = match;

        const date = new Date(
          Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second || 0)
          )
        );

        return new Intl.DateTimeFormat("id-ID", {
          timeZone: "UTC",
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23"
        }).format(date) + " WIT";
      }

      // Untuk tanggal ISO yang sudah memiliki informasi zona waktu.
      const date = new Date(raw);

      if (Number.isNaN(date.getTime())) {
        return raw;
      }

      return new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jayapura",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      }).format(date) + " WIT";
    }

    function setTimestampElement(id, timestamp) {
      const element = $(id);

      if (element) {
        element.textContent = timestamp
          ? formatWIT(timestamp)
          : "Belum tersedia";
      }
    }

    // ============================================================
    // 09. NOTIFIKASI
    // ============================================================

    function showToast(message, type = "info") {
      let toast = $("sipfasToastNotification");

      if (!toast) {
        toast = document.createElement("div");
        toast.id = "sipfasToastNotification";
        document.body.appendChild(toast);
      }

      clearTimeout(toastTimer);

      const styles = {
        success: {
          icon: "✓",
          background: "#e8f8ef",
          color: "#087443",
          border: "#a7e5c2"
        },

        error: {
          icon: "✕",
          background: "#fff0f0",
          color: "#c62828",
          border: "#ffcaca"
        },

        info: {
          icon: "ℹ",
          background: "#edf3ff",
          color: "#2458b8",
          border: "#c7d8ff"
        }
      };

      const style = styles[type] || styles.info;

      toast.replaceChildren();

      const icon = document.createElement("span");
      icon.textContent = style.icon;

      const text = document.createElement("span");
      text.textContent = String(message);

      toast.append(icon, text);

      Object.assign(toast.style, {
        position: "fixed",
        top: "24px",
        right: "24px",
        zIndex: "99999",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        maxWidth: "calc(100vw - 48px)",
        padding: "16px 22px",
        borderRadius: "12px",
        background: style.background,
        color: style.color,
        border: `1px solid ${style.border}`,
        boxShadow: "0 6px 24px rgba(0,0,0,.12)",
        fontSize: "14px",
        fontWeight: "600",
        fontFamily: "inherit"
      });

      toast.hidden = false;
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");

      toastTimer = setTimeout(() => {
        toast.hidden = true;
      }, 4000);
    }

    // ============================================================
    // 10. STATUS HEADER
    // ============================================================

    function setHeaderStatus(status) {
      if (!headerStatusElement) return;

      const normalized = normalizeStatus(status);

      if (!normalized) return;

      headerStatusElement.textContent = normalized;
      headerStatusElement.dataset.status = normalized;
    }

    // ============================================================
    // 11. INFORMASI LAPORAN
    // ============================================================

    function renderReportInformation(data) {

      const infoMap = {
        reportName: firstValue(data, [
          "nama_pelapor",
          "nama_lengkap"
        ], "Tidak diketahui"),

        reportNim: firstValue(data, [
          "nomor_identitas",
          "nim"
        ], "—"),

        reportFacility: firstValue(data, [
          "nama_fasilitas"
        ], "—"),

        reportLocation: firstValue(data, [
          "lokasi_ruangan",
          "nama_lokasi"
        ], "—"),

        reportDescription: firstValue(data, [
          "deskripsi_kerusakan",
          "deskripsi"
        ], "—")
      };

      Object.entries(infoMap).forEach(([id, value]) => {
        const element = $(id);

        if (element) {
          element.textContent = String(value);
        }
      });

      const createdAt = firstValue(data, [
        "tanggal_dibuat",
        "tanggal_laporan",
        "waktu_lapor"
      ]);

      if ($("reportTime")) {
        $("reportTime").textContent = createdAt
          ? formatWIT(createdAt)
          : "Belum tersedia";
      }

      const initials = $("reportInitials");

      if (initials) {
        initials.textContent = String(infoMap.reportName)
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map(word => word.charAt(0).toUpperCase())
          .join("");
      }

      const damageDescription = $("damageDescription");

      if (damageDescription) {
        damageDescription.textContent =
          infoMap.reportDescription;
      }
    }

    // ============================================================
    // 12. IDENTITAS PETUGAS
    // ============================================================

    function setOfficerProfile(user) {

      if (!user || !user.id_pengguna) {
        throw new Error(
          "Identitas petugas tidak ditemukan."
        );
      }

      currentOfficer = {
        id: Number(user.id_pengguna),
        name: user.nama_lengkap || user.nama_pengguna || "",
        email: user.email || "",
        photo: user.foto_profil || "",
        role: user.nama_peran || ""
      };

      if (!Number.isInteger(currentOfficer.id) ||
          currentOfficer.id <= 0) {
        throw new Error(
          "ID petugas tidak valid."
        );
      }

      return currentOfficer;
    }

    async function loadOfficerProfile(detailOfficer = null) {

      if (
        detailOfficer &&
        detailOfficer.id_pengguna
      ) {
        return setOfficerProfile(detailOfficer);
      }

      const payload = await fetchJson(API.profile);

      const user = payload.user || payload.data;

      return setOfficerProfile(user);
    }

    // ============================================================
    // 13. RENDER RIWAYAT PENANGANAN
    // ============================================================

    function renderHandlingHistory(history) {

      const container =
        $("handlingHistory") ||
        $("historyHandling") ||
        $("riwayatPenanganan");

      if (!container) return;

      container.replaceChildren();

      if (!Array.isArray(history) || history.length === 0) {
        const empty = document.createElement("p");

        empty.textContent =
          "Belum ada riwayat penanganan.";

        container.appendChild(empty);
        return;
      }

      history.forEach(item => {

        const card = document.createElement("div");
        card.className = "history-item";

        const officer = document.createElement("strong");
        officer.textContent =
          item.nama_petugas || "Petugas";

        const action = document.createElement("p");
        action.textContent =
          item.tindak_lanjut_perbaikan ||
          "Tidak ada keterangan.";

        const notes = document.createElement("p");
        notes.textContent =
          item.catatan_petugas ||
          "Tidak ada catatan.";

        const started = document.createElement("small");

        started.textContent =
          "Mulai: " +
          (item.waktu_mulai_penanganan
            ? formatWIT(item.waktu_mulai_penanganan)
            : "Belum tersedia");

        const completed = document.createElement("small");

        completed.textContent =
          " | Selesai: " +
          (item.waktu_selesai_penanganan
            ? formatWIT(item.waktu_selesai_penanganan)
            : "Belum selesai");

        card.append(
          officer,
          action,
          notes,
          started,
          completed
        );

        container.appendChild(card);
      });
    }

    // ============================================================
    // 14. RENDER RIWAYAT PERUBAHAN STATUS
    // ============================================================

    function renderStatusHistory(history) {

      const container =
        $("statusHistory") ||
        $("historyStatus") ||
        $("riwayatStatus");

      if (!container) return;

      container.replaceChildren();

      if (!Array.isArray(history) || history.length === 0) {
        const empty = document.createElement("p");

        empty.textContent =
          "Belum ada riwayat perubahan status.";

        container.appendChild(empty);
        return;
      }

      history.forEach(item => {

        const card = document.createElement("div");
        card.className = "history-status-item";

        const user = document.createElement("strong");

        user.textContent =
          item.nama_pengguna || "Pengguna";

        const change = document.createElement("p");

        change.textContent =
          `${item.status_sebelumnya || "Belum tersedia"} → ` +
          `${item.status_baru || "Belum tersedia"}`;

        const note = document.createElement("p");

        note.textContent =
          item.catatan || "Tidak ada catatan.";

        const date = document.createElement("small");

        date.textContent = item.tanggal_perubahan
          ? formatWIT(item.tanggal_perubahan)
          : "Belum tersedia";

        card.append(
          user,
          change,
          note,
          date
        );

        container.appendChild(card);
      });
    }

    // ============================================================
    // 15. MENGUNCI FORMULIR
    // ============================================================

    function setFormLocked(locked) {

      followUpInput.disabled = locked;
      statusInput.disabled = locked;
      notesInput.disabled = locked;
      saveButton.disabled = locked;
    }

    // ============================================================
    // 16. MEMUAT DETAIL PENANGANAN DARI DATABASE
    // ============================================================

    async function loadHandlingFromDB(options = {}) {

      const showMessage = options.showMessage !== false;

      const code = getTargetCode();

      if (!code) {

        showToast(
          "Kode laporan tidak ditemukan.",
          "error"
        );

        saveButton.disabled = true;
        return;
      }

      currentReportCode = code;

      reportCodeElement.textContent = code;

      if (pageCodeElement) {
        pageCodeElement.textContent = code;
      }

      saveButton.disabled = true;

      try {

        const url = new URL(
          API.detail,
          window.location.href
        );

        url.searchParams.set("kode", code);

        const payload = await fetchJson(url.href);

        /*
         * STRUKTUR RESPONS PHP:
         *
         * payload.data.laporan
         * payload.data.penanganan
         * payload.data.petugas
         * payload.data.riwayat_penanganan
         * payload.data.riwayat_status
         */

        const result = payload.data || {};

        const data = result.laporan;

        if (!data || typeof data !== "object") {
          throw new Error(
            "Data laporan tidak tersedia."
          );
        }

        // Memastikan kode laporan sesuai.
        if (
          normalizeCode(data.kode_laporan) !== code
        ) {
          throw new Error(
            "Kode laporan tidak sesuai dengan data database."
          );
        }

        // Memeriksa status verifikasi.
        if (!isValidReport(data)) {
          throw new Error(
            "Laporan belum berstatus valid dan tidak dapat ditangani."
          );
        }

        currentReport = data;

        const handling = result.penanganan || {};

        const handlingHistory =
          Array.isArray(result.riwayat_penanganan)
            ? result.riwayat_penanganan
            : [];

        const statusHistory =
          Array.isArray(result.riwayat_status)
            ? result.riwayat_status
            : [];

        // Menampilkan informasi laporan.
        renderReportInformation(data);

        // Mengisi tindak lanjut terakhir.
        followUpInput.value = firstValue(
          handling,
          [
            "tindak_lanjut_perbaikan",
            "tindak_lanjut"
          ]
        );

        // Mengisi catatan petugas.
        notesInput.value = firstValue(
          handling,
          ["catatan_petugas"]
        );

        // Mengambil status dari laporan utama.
        const status = normalizeStatus(
          firstValue(
            data,
            ["status_penanganan"],
            "Menunggu"
          )
        );

        if (!status) {
          throw new Error(
            "Status penanganan pada database tidak dikenali."
          );
        }

        // Menyesuaikan pilihan status HTML.
        const option = Array.from(
          statusInput.options
        ).find(item =>
          normalizeStatus(item.value) === status
        );

        if (option) {
          statusInput.value = option.value;
        } else {
          throw new Error(
            "Pilihan status tidak sesuai dengan data database."
          );
        }

        setHeaderStatus(status);

        // Menampilkan waktu penanganan.
        const updatedAt = firstValue(
          handling,
          ["waktu_pembaruan"]
        );

        const startedAt = firstValue(
          handling,
          ["waktu_mulai_penanganan"]
        );

        const completedAt = firstValue(
          handling,
          ["waktu_selesai_penanganan"]
        );

        if (updatedAtElement) {
          updatedAtElement.textContent = updatedAt
            ? formatWIT(updatedAt)
            : "Belum ada pembaruan";
        }

        setTimestampElement("startedAt", startedAt);
        setTimestampElement("completedAt", completedAt);

        // Menampilkan seluruh riwayat.
        renderHandlingHistory(handlingHistory);
        renderStatusHistory(statusHistory);

        // Mengambil identitas petugas.
        await loadOfficerProfile(result.petugas);

        // Memastikan status penyelesaian.
        alreadyCompleted = status === "Selesai";

        // Menyimpan nilai awal formulir.
        originalFormData = {
          followUp: followUpInput.value.trim(),
          status,
          notes: notesInput.value.trim()
        };

        // Mengunci formulir jika sudah selesai.
        setFormLocked(alreadyCompleted);

        if (alreadyCompleted) {

          if (showMessage) {
            showToast(
              "Laporan ini sudah selesai ditangani.",
              "info"
            );
          }

        } else {

          saveButton.disabled = false;

          if (showMessage) {
            showToast(
              "Detail penanganan berhasil dimuat.",
              "success"
            );
          }
        }

      } catch (error) {

        console.error(
          "[SIPFAS] Gagal memuat detail penanganan:",
          error
        );

        showToast(error.message, "error");

        saveButton.disabled = true;
      }
    }

    // ============================================================
    // 17. VALIDASI DATA PENANGANAN
    // ============================================================

    function validateHandling() {

      if (!currentReportCode) {
        return "Kode laporan tidak ditemukan.";
      }

      if (!currentReport) {
        return "Data laporan belum dimuat.";
      }

      if (!currentOfficer || !currentOfficer.id) {
        return "Identitas petugas belum tersedia.";
      }

      if (!isValidReport(currentReport)) {
        return "Laporan belum diverifikasi valid.";
      }

      if (alreadyCompleted) {
        return "Laporan sudah selesai ditangani.";
      }

      if (!followUpInput.value.trim()) {
        followUpInput.focus();

        return "Tindak lanjut perbaikan wajib diisi.";
      }

      const status = normalizeStatus(statusInput.value);

      if (!status) {
        statusInput.focus();

        return "Pilih status penanganan yang valid.";
      }

      if (followUpInput.value.trim().length > 10000) {
        return "Tindak lanjut perbaikan terlalu panjang.";
      }

      if (notesInput.value.trim().length > 5000) {
        return "Catatan petugas terlalu panjang.";
      }

      return "";
    }

    // ============================================================
    // 18. MENYIMPAN PENANGANAN KE DATABASE
    // ============================================================

    async function saveHandlingToDB(event) {

      event?.preventDefault();

      if (saving) return;

      const validationError = validateHandling();

      if (validationError) {
        showToast(validationError, "error");
        return;
      }

      const followUp = followUpInput.value.trim();

      const officerNotes = notesInput.value.trim();

      let status = normalizeStatus(statusInput.value);

      // Status Menunggu otomatis berubah menjadi Diproses.
      if (status === "Menunggu") {

        status = "Diproses";

        const processingOption = Array.from(
          statusInput.options
        ).find(item =>
          normalizeStatus(item.value) === "Diproses"
        );

        if (!processingOption) {

          showToast(
            "Pilihan status Diproses tidak tersedia.",
            "error"
          );

          return;
        }

        statusInput.value = processingOption.value;
      }

      // Memeriksa perubahan data.
      if (
        originalFormData &&
        originalFormData.followUp === followUp &&
        originalFormData.status === status &&
        originalFormData.notes === officerNotes
      ) {

        showToast(
          "Tidak ada perubahan data yang perlu disimpan.",
          "info"
        );

        return;
      }

      saving = true;
      saveButton.disabled = true;

      try {

        /*
         * Request POST otomatis memperoleh header
         * X-CSRF-Token dari csrf.js.
         *
         * Pastikan csrf.js dimuat sebelum file JavaScript ini.
         */

        const payload = await fetchJson(
          API.save,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json"
            },

            body: JSON.stringify({
              kode_laporan: currentReportCode,
              tindak_lanjut_perbaikan: followUp,
              status_penanganan: status,
              catatan_petugas: officerNotes
            })
          }
        );

        const saved = payload.data || {};

        // Memastikan server mengembalikan status valid.
        const savedStatus = normalizeStatus(
          firstValue(
            saved,
            ["status_penanganan"],
            status
          )
        );

        if (!savedStatus) {
          throw new Error(
            "Server mengembalikan status penanganan yang tidak valid."
          );
        }

        status = savedStatus;

        // Memperbarui pilihan status.
        const savedOption = Array.from(
          statusInput.options
        ).find(item =>
          normalizeStatus(item.value) === savedStatus
        );

        if (savedOption) {
          statusInput.value = savedOption.value;
        }

        // Memperbarui waktu berdasarkan respons server.
        const updatedAt = firstValue(
          saved,
          ["waktu_pembaruan"]
        );

        const startedAt = firstValue(
          saved,
          ["waktu_mulai_penanganan"]
        );

        const completedAt = firstValue(
          saved,
          ["waktu_selesai_penanganan"]
        );

        if (updatedAtElement) {
          updatedAtElement.textContent = updatedAt
            ? formatWIT(updatedAt)
            : "Baru saja diperbarui";
        }

        setTimestampElement("startedAt", startedAt);
        setTimestampElement("completedAt", completedAt);

        setHeaderStatus(status);

        // Memperbarui nilai awal formulir.
        originalFormData = {
          followUp,
          status,
          notes: officerNotes
        };

        alreadyCompleted = status === "Selesai";

        // Memperbarui identitas petugas.
        if (saved.nama_petugas && currentOfficer) {
          currentOfficer.name = saved.nama_petugas;
        }

        // Memperbarui data laporan lokal.
        if (currentReport) {
          currentReport.status_penanganan =
            saved.status_penanganan;
        }

        // Mengunci formulir jika sudah selesai.
        setFormLocked(alreadyCompleted);

        // Memberitahukan perubahan kepada halaman lain.
        window.dispatchEvent(
          new CustomEvent("sipfas:handling-saved", {
            detail: {
              reportCode: currentReportCode,
              status,
              officerId: currentOfficer.id,
              officerName: currentOfficer.name,
              record: saved
            }
          })
        );

        window.dispatchEvent(
          new CustomEvent("sipfas:history-updated", {
            detail: {
              reportCode: currentReportCode,
              status
            }
          })
        );

        showToast(
          status === "Selesai"
            ? "Penanganan berhasil disimpan. Laporan telah selesai."
            : "Perubahan penanganan berhasil disimpan.",
          "success"
        );

        // Memuat ulang data dari database.
        // Riwayat dan status mengikuti hasil server.
        await loadHandlingFromDB({
          showMessage: false
        });

      } catch (error) {

        console.error(
          "[SIPFAS] Gagal menyimpan penanganan:",
          error
        );

        showToast(
          error.message ||
          "Gagal menyimpan perubahan penanganan.",
          "error"
        );

      } finally {

        saving = false;

        if (!alreadyCompleted && currentReport) {
          saveButton.disabled = false;
        }
      }
    }

    // ============================================================
    // 19. EVENT FORMULIR
    // ============================================================

    form.addEventListener(
      "submit",
      saveHandlingToDB
    );

    statusInput.addEventListener("change", () => {

      const status = normalizeStatus(statusInput.value);

      if (status) {
        setHeaderStatus(status);
      }
    });

    // ============================================================
    // 20. TOMBOL BATAL
    // ============================================================

    cancelButton?.addEventListener("click", event => {

      event.preventDefault();

      window.location.href = new URL(
        "../Penanganan/Penanganan.html",
        window.location.href
      ).href;
    });

    // ============================================================
    // 21. SALIN KODE LAPORAN
    // ============================================================

    copyButton?.addEventListener("click", async event => {

      event.preventDefault();

      if (!currentReportCode) return;

      try {

        await navigator.clipboard.writeText(
          currentReportCode
        );

        showToast(
          "Kode laporan berhasil disalin!",
          "success"
        );

      } catch (error) {

        console.error(
          "[SIPFAS] Gagal menyalin kode:",
          error
        );

        showToast(
          "Gagal menyalin kode laporan.",
          "error"
        );
      }
    });

    // ============================================================
    // 22. SIDEBAR
    // ============================================================

    function setSidebar(open) {

      sidebar?.classList.toggle("open", open);

      pageOverlay?.classList.toggle("show", open);
      pageOverlay?.classList.toggle("active", open);

      menuToggle?.setAttribute(
        "aria-expanded",
        String(open)
      );
    }

    menuToggle?.addEventListener("click", () => {

      setSidebar(
        !sidebar?.classList.contains("open")
      );
    });

    pageOverlay?.addEventListener(
      "click",
      () => setSidebar(false)
    );

    document.querySelectorAll(".nav-link").forEach(link => {

      link.addEventListener(
        "click",
        () => setSidebar(false)
      );
    });

    document.addEventListener("keydown", event => {

      if (event.key === "Escape") {
        setSidebar(false);
      }
    });

    // ============================================================
    // 23. LOGOUT
    // ============================================================

    logoutLink?.addEventListener("click", async event => {

      event.preventDefault();

      if (
        !window.confirm(
          "Apakah Anda yakin ingin keluar dari SIPFAS?"
        )
      ) {
        return;
      }

      try {

        await fetchJson(
          API.logout,
          {
            method: "POST"
          }
        );

      } catch (error) {

        console.error(
          "[SIPFAS] Logout error:",
          error
        );

      } finally {

        window.location.replace(LOGIN_URL);
      }
    });

    // ============================================================
    // 24. INISIALISASI HALAMAN
    // ============================================================

    // Mengambil detail laporan ketika halaman dibuka.
    loadHandlingFromDB({
      showMessage: true
    });

  }

})();
