
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    // Mengatur endpoint API.
    const API = {
      detail: "../../api/petugas/detail-penanganan.php",
      save: "../../api/petugas/simpan-penanganan.php",
      profile: "../../api/shared/profil-login.php",
      logout: "../../api/auth/logout.php"
    };

    const LOGIN_URL = "../../auth/Login.html";

    // Mengambil elemen HTML.
    const $ = (id) => document.getElementById(id);

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

    let currentReportCode = "";
    let currentReport = null;
    let currentOfficer = null;
    let originalFormData = null;
    let saving = false;
    let alreadyCompleted = false;

    // Menormalkan teks.
    function normalizeText(value) {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    // Mengambil nilai pertama yang tersedia.
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

    // Menormalkan kode laporan.
    function normalizeCode(value) {
      return String(value ?? "")
        .replace(/\s+/g, "")
        .trim()
        .toUpperCase();
    }

    // Menormalkan status penanganan.
    function normalizeStatus(value) {
      const status = normalizeText(value);

      if (
        [
          "selesai",
          "completed",
          "selesai ditangani",
          "selesai diperbaiki"
        ].includes(status)
      ) {
        return "Selesai";
      }

      if (
        [
          "diproses",
          "processing",
          "sedang diproses",
          "dalam proses"
        ].includes(status)
      ) {
        return "Diproses";
      }

      if (
        [
          "menunggu",
          "waiting",
          "menunggu perbaikan",
          "terverifikasi"
        ].includes(status)
      ) {
        return "Menunggu";
      }

      return "";
    }

    // Memastikan laporan telah dinyatakan valid.
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
        "sudah diverifikasi"
      ].includes(verification);
    }

    // Membaca kode laporan dari alamat halaman.
    function getTargetCode() {
      const params = new URLSearchParams(
        window.location.search
      );

      return normalizeCode(
        params.get("kode") ||
        reportCodeElement.textContent
      );
    }

    // Mengambil data JSON dari API.
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
      } catch {
        throw new Error(
          "Respons server bukan JSON. Periksa endpoint API."
        );
      }

      if (response.status === 401) {
        window.location.replace(LOGIN_URL);

        throw new Error(
          "Sesi login telah berakhir."
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

    // Memformat waktu database tanpa menambahkan offset dua kali.
    function formatWIT(value) {
      if (!value) return "Belum tersedia";

      const raw = String(value).trim();

      const match = raw.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
      );

      if (match) {
        const [, year, month, day, hour, minute, second] = match;

        const date = new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second || 0)
        );

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

    // Menampilkan tanggal pada elemen HTML.
    function setTimestampElement(id, timestamp) {
      const element = $(id);

      if (element) {
        element.textContent = timestamp
          ? formatWIT(timestamp)
          : "Belum tersedia";
      }
    }

    // Menampilkan notifikasi.
    let toastTimer;

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
      text.textContent = message;

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

    // Mengubah status pada bagian judul halaman.
    function setHeaderStatus(status) {
      if (!headerStatusElement) return;

      const normalized = normalizeStatus(status);

      if (!normalized) return;

      headerStatusElement.textContent = normalized;
      headerStatusElement.dataset.status = normalized;
    }

    // Menampilkan informasi identitas pelapor.
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
          "nama_lokasi",
          "lokasi_ruangan"
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

      if (createdAt && $("reportTime")) {
        $("reportTime").textContent = formatWIT(createdAt);
      }

      const initials = $("reportInitials");

      if (initials && infoMap.reportName) {
        initials.textContent = String(infoMap.reportName)
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((word) => word.charAt(0).toUpperCase())
          .join("");
      }

      const damageDescription = $("damageDescription");

      if (damageDescription) {
        damageDescription.textContent =
          infoMap.reportDescription;
      }
    }

    // Mengambil identitas petugas dari session database.
    async function loadOfficerProfile() {
      const payload = await fetchJson(API.profile);

      const user = payload.user || payload.data;

      if (!user || !user.id_pengguna) {
        throw new Error(
          "Identitas petugas tidak ditemukan."
        );
      }

      currentOfficer = {
        id: Number(user.id_pengguna),
        name: user.nama_lengkap || user.nama_pengguna,
        email: user.email || "",
        photo: user.foto_profil || "",
        role: user.nama_peran || ""
      };

      return currentOfficer;
    }

    // Memuat detail laporan dan riwayat penanganan.
    async function loadHandlingFromDB() {
      const code = getTargetCode();

      if (!code) {
        showToast(
          "Kode laporan tidak ditemukan. Kembali ke daftar penanganan.",
          "error"
        );
        return;
      }

      currentReportCode = code;

      reportCodeElement.textContent = code;

      if (pageCodeElement) {
        pageCodeElement.textContent = code;
      }

      try {
        const url = new URL(
          API.detail,
          window.location.href
        );

        url.searchParams.set("kode", code);

        const payload = await fetchJson(url.href);

        const data = payload.data || payload.laporan;

        if (!data || typeof data !== "object") {
          throw new Error(
            "Data laporan tidak tersedia."
          );
        }

        // Menolak laporan yang belum diverifikasi valid.
        if (!isValidReport(data)) {
          throw new Error(
            "Laporan belum berstatus valid dan tidak dapat ditangani."
          );
        }

        currentReport = data;

        const handling = payload.penanganan ||
          data.penanganan ||
          data;

        renderReportInformation(data);

        // Mengambil data tindak lanjut terakhir.
        followUpInput.value = firstValue(handling, [
          "tindak_lanjut_perbaikan",
          "tindak_lanjut"
        ]);

        // Catatan petugas bersifat opsional.
        notesInput.value = firstValue(handling, [
          "catatan_petugas"
        ]);

        // Mengambil status penanganan dari laporan utama.
        const status = normalizeStatus(
          firstValue(data, [
            "status_penanganan"
          ], "Menunggu")
        );

        if (!status) {
          throw new Error(
            "Status penanganan pada database tidak dikenali."
          );
        }

        const option = Array.from(
          statusInput.options
        ).find((item) => {
          return normalizeStatus(item.value) === status;
        });

        if (option) {
          statusInput.value = option.value;
        }

        setHeaderStatus(status);

        const updatedAt = firstValue(handling, [
          "waktu_pembaruan"
        ]);

        const startedAt = firstValue(handling, [
          "waktu_mulai_penanganan"
        ]);

        const completedAt = firstValue(handling, [
          "waktu_selesai_penanganan"
        ]);

        if (updatedAtElement) {
          updatedAtElement.textContent = updatedAt
            ? formatWIT(updatedAt)
            : "Belum ada pembaruan";
        }

        setTimestampElement("startedAt", startedAt);
        setTimestampElement("completedAt", completedAt);

        alreadyCompleted = status === "Selesai";

        // Menyimpan nilai awal agar perubahan dapat dideteksi.
        originalFormData = {
          followUp: followUpInput.value.trim(),
          status,
          notes: notesInput.value.trim()
        };

        // Mengambil identitas petugas yang sedang login.
        await loadOfficerProfile();

        if (alreadyCompleted) {
          showToast(
            "Laporan ini sudah selesai ditangani.",
            "info"
          );
        } else {
          showToast(
            "Detail penanganan berhasil dimuat.",
            "success"
          );
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

    // Memvalidasi data sebelum disimpan.
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

    // Menyimpan perubahan penanganan ke database.
    async function saveHandlingToDB(event) {
      event?.preventDefault();

      if (saving) return;

      const validationError = validateHandling();

      if (validationError) {
        showToast(validationError, "error");
        return;
      }

      const followUp = followUpInput.value.trim();
      const status = normalizeStatus(statusInput.value);
      const officerNotes = notesInput.value.trim();

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
        // Mengirim perubahan ke API PHP.
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

        const updatedAt = firstValue(saved, [
          "waktu_pembaruan"
        ]);

        const startedAt = firstValue(saved, [
          "waktu_mulai_penanganan"
        ]);

        const completedAt = firstValue(saved, [
          "waktu_selesai_penanganan"
        ]);

        // Memperbarui tampilan setelah server mengonfirmasi.
        if (updatedAtElement) {
          updatedAtElement.textContent = updatedAt
            ? formatWIT(updatedAt)
            : "Baru saja diperbarui";
        }

        setTimestampElement("startedAt", startedAt);
        setTimestampElement("completedAt", completedAt);
        setHeaderStatus(status);

        originalFormData = {
          followUp,
          status,
          notes: officerNotes
        };

        alreadyCompleted = status === "Selesai";

        // Mengunci formulir setelah status selesai.
        if (alreadyCompleted) {
          followUpInput.disabled = true;
          statusInput.disabled = true;
          notesInput.disabled = true;
        }

        // Mengirim pemberitahuan pembaruan kepada halaman lain.
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

        // Memperbarui daftar riwayat.
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

        if (!alreadyCompleted) {
          saveButton.disabled = false;
        }
      }
    }

    // Menangani pengiriman formulir.
    form.addEventListener(
      "submit",
      saveHandlingToDB
    );

    // Memperbarui badge status saat pilihan berubah.
    statusInput.addEventListener("change", () => {
      const status = normalizeStatus(statusInput.value);

      if (status) {
        setHeaderStatus(status);
      }
    });

    // Mengembalikan pengguna ke daftar penanganan.
    cancelButton?.addEventListener("click", (event) => {
      event.preventDefault();

      window.location.href = new URL(
        "../Penanganan/Penanganan.html",
        window.location.href
      ).href;
    });

    // Menyalin kode laporan.
    copyButton?.addEventListener("click", async (event) => {
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

      } catch {
        showToast(
          "Gagal menyalin kode laporan.",
          "error"
        );
      }
    });

    // Mengatur sidebar.
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

    document.querySelectorAll(".nav-link").forEach(
      (link) => {
        link.addEventListener(
          "click",
          () => setSidebar(false)
        );
      }
    );

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setSidebar(false);
      }
    });

    // Menangani logout.
    logoutLink?.addEventListener("click", async (event) => {
      event.preventDefault();

      if (!window.confirm(
        "Apakah Anda yakin ingin keluar dari SIPFAS?"
      )) {
        return;
      }

      try {
        await fetch(API.logout, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json"
          }
        });

      } catch (error) {
        console.error(
          "[SIPFAS] Logout error:",
          error
        );

      } finally {
        window.location.replace(LOGIN_URL);
      }
    });

    // Memuat detail ketika halaman pertama kali dibuka.
    loadHandlingFromDB();
  }
})();
