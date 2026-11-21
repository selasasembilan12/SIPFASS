
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    // Mengatur endpoint API yang digunakan halaman riwayat.
    const API = {
      history: "../../api/petugas/riwayat-laporan.php",
      profile: "../../api/shared/profil-login.php",
      logout: "../../api/auth/logout.php"
    };

    const LOGIN_PAGE = "../../auth/Login.html";
    const REFRESH_INTERVAL = 15000;

    // Mengambil elemen HTML.
    const $ = (id) => document.getElementById(id);

    const searchInput = $("searchHistory");
    const statusFilter = $("statusHistory");
    const historyRows = $("historyRows");
    const recordCount = $("recordCount");
    const historyEmpty = $("historyEmpty");
    const historyDetail = $("historyDetail");

    const detailTitle = $("detailTitle");
    const detailReporter = $("detailReporter");
    const detailDate = $("detailDate");
    const detailValidation = $("detailValidation");
    const detailPriority = $("detailPriority");
    const detailAction = $("detailAction");
    const detailNote = $("detailNote");
    const detailOfficer = $("detailOfficer");
    const detailOfficerLabel = $("detailOfficerLabel");
    const detailHandlingTime = $("detailHandlingTime");

    const sidebar = $("sidebar");
    const menuToggle = $("menuToggle");
    const pageOverlay = $("pageOverlay");
    const logoutLink = $("logoutLink");

    if (
      !searchInput ||
      !statusFilter ||
      !historyRows ||
      !recordCount ||
      !historyEmpty
    ) {
      console.error(
        "[SIPFAS] Elemen utama Riwayat Laporan tidak ditemukan."
      );
      return;
    }

    // Menyimpan data laporan yang diterima dari database.
    let allHistoryRecords = [];
    let selectedRecordCode = null;
    let currentOfficerProfile = null;

    let refreshInProgress = false;
    let profileRequest = null;
    let refreshTimer = null;
    let lastRefreshTime = null;

    // Menormalkan teks.
    function normalizeText(value) {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    // Menormalkan kode laporan.
    function normalizeCode(value) {
      return String(value ?? "")
        .replace(/\s+/g, "")
        .trim()
        .toUpperCase();
    }

    // Mengambil nilai pertama yang tersedia.
    function firstValue(object, keys, fallback = "") {
      if (!object || typeof object !== "object") {
        return fallback;
      }

      for (const key of keys) {
        const value = object[key];

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

    // Memastikan nilai bukan data kosong.
    function isEmpty(value) {
      return (
        value === undefined ||
        value === null ||
        String(value).trim() === "" ||
        String(value).trim() === "-"
      );
    }

    // Mengubah nilai numerik kerusakan menjadi kategori.
    function normalizeDamage(value) {
      const number = Number(value);

      if (number === 3) return "Berat";
      if (number === 2) return "Sedang";
      if (number === 1) return "Ringan";

      const text = normalizeText(value);

      if (text.includes("berat")) return "Berat";
      if (text.includes("sedang")) return "Sedang";
      if (text.includes("ringan")) return "Ringan";

      return "Tidak tersedia";
    }

    // Mengubah nilai numerik dampak akademik menjadi kategori.
    function normalizeImpact(value) {
      const number = Number(value);

      if (number === 3) return "Tinggi";
      if (number === 2) return "Sedang";
      if (number === 1) return "Rendah";

      const text = normalizeText(value);

      if (text.includes("tinggi")) return "Tinggi";
      if (text.includes("sedang")) return "Sedang";
      if (text.includes("rendah")) return "Rendah";

      return "Tidak tersedia";
    }

    // Mengubah nilai numerik frekuensi penggunaan menjadi kategori.
    function normalizeFrequency(value) {
      const number = Number(value);

      if (number >= 5) return "Sering";
      if (number >= 3) return "Kadang";
      if (number > 0) return "Jarang";

      const text = normalizeText(value);

      if (text.includes("sering")) return "Sering";
      if (text.includes("kadang")) return "Kadang";
      if (text.includes("jarang")) return "Jarang";

      return "Tidak tersedia";
    }

    // Menormalkan hasil verifikasi.
    function normalizeDecision(value) {
      const text = normalizeText(value);

      if (
        text === "valid" ||
        text === "laporan valid" ||
        text === "terverifikasi" ||
        text === "diterima"
      ) {
        return "valid";
      }

      if (
        text === "invalid" ||
        text === "tidak valid" ||
        text === "laporan tidak valid" ||
        text === "ditolak"
      ) {
        return "tidak-valid";
      }

      return "";
    }

    // Menormalkan status penanganan.
    function normalizeHandlingStatus(value) {
      const text = normalizeText(value);

      if (
        [
          "selesai",
          "completed",
          "closed",
          "ditutup",
          "selesai diperbaiki",
          "selesai ditangani"
        ].includes(text)
      ) {
        return "selesai";
      }

      if (
        [
          "diproses",
          "processing",
          "sedang diproses",
          "dalam proses"
        ].includes(text)
      ) {
        return "diproses";
      }

      if (
        [
          "menunggu",
          "menunggu penanganan",
          "waiting",
          "menunggu perbaikan"
        ].includes(text)
      ) {
        return "menunggu";
      }

      return "";
    }

    // Menormalkan prioritas.
    function normalizePriority(value) {
      const text = normalizeText(value);

      if (text.includes("tinggi") || text === "high") {
        return "Tinggi";
      }

      if (text.includes("sedang") || text === "medium") {
        return "Sedang";
      }

      if (text.includes("rendah") || text === "low") {
        return "Rendah";
      }

      return "Tidak tersedia";
    }

    // Memformat tanggal database sebagai waktu WIT.
    function formatDate(value) {
      if (isEmpty(value)) return "-";

      const raw = String(value).trim();

      // MySQL DATETIME tidak menyimpan informasi zona waktu.
      // Nilainya ditampilkan sebagai waktu lokal WIT.
      const match = raw.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
      );

      if (match) {
        const [
          ,
          year,
          month,
          day,
          hour = "00",
          minute = "00",
          second = "00"
        ] = match;

        const date = new Date(
          Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second)
          )
        );

        const formatted = new Intl.DateTimeFormat("id-ID", {
          timeZone: "UTC",
          day: "2-digit",
          month: "short",
          year: "numeric"
        }).format(date);

        if (!match[4]) return `${formatted}, WIT`;

        return (
          formatted +
          ", " +
          hour +
          ":" +
          minute +
          " WIT"
        );
      }

      const date = new Date(raw);

      if (Number.isNaN(date.getTime())) {
        return raw;
      }

      return (
        new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jayapura",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23"
        }).format(date) + " WIT"
      );
    }

    // Mengambil tanggal laporan.
    function getReportDate(data) {
      return firstValue(data, [
        "tanggal_dibuat",
        "tanggal_laporan",
        "waktu_lapor"
      ]);
    }

    // Mengambil tanggal penyelesaian atau waktu keputusan akhir.
    function getFinalDate(data, decision, handlingStatus) {
      if (decision === "tidak-valid") {
        return firstValue(data, [
          "waktu_verifikasi",
          "tanggal_diperbarui",
          "tanggal_dibuat"
        ]);
      }

      if (handlingStatus === "selesai") {
        return firstValue(data, [
          "waktu_selesai_penanganan",
          "waktu_pembaruan",
          "tanggal_diperbarui"
        ]);
      }

      return "";
    }

    // Menentukan apakah laporan sudah masuk kategori riwayat akhir.
    function isFinalHistoryRecord(data) {
      const decision = normalizeDecision(
        firstValue(data, [
          "status_verifikasi",
          "hasil_verifikasi"
        ])
      );

      const handlingStatus = normalizeHandlingStatus(
        data.status_penanganan
      );

      // Laporan tidak valid menjadi bagian dari riwayat verifikasi.
      if (decision === "tidak-valid") {
        return true;
      }

      // Laporan valid masuk riwayat setelah penanganan selesai.
      if (
        decision === "valid" &&
        handlingStatus === "selesai"
      ) {
        return true;
      }

      return false;
    }

    // Mengubah satu baris database menjadi objek riwayat.
    function normalizeHistoryRecord(data) {
      const code = normalizeCode(
        firstValue(data, [
          "kode_laporan",
          "reportCode",
          "kodeLaporan"
        ])
      );

      if (!code) return null;

      // Catatan penanganan terakhir yang disimpan dari halaman Detail Penanganan.
      const handlingHistory = Array.isArray(data.riwayat_penanganan)
        ? data.riwayat_penanganan
        : [];

      const latestHandling = handlingHistory[0] || {};

      const handlingValue = (keys, fallback = "") =>
        firstValue(data, keys, firstValue(latestHandling, keys, fallback));

      const decision = normalizeDecision(
        firstValue(data, [
          "status_verifikasi",
          "hasil_verifikasi"
        ])
      );

      const handlingStatus = normalizeHandlingStatus(
        data.status_penanganan
      );

      const x1 = firstValue(data, [
        "x1_sesudah",
        "tingkat_kerusakan_x1_terverifikasi",
        "x1_sebelum",
        "tingkat_kerusakan_x1"
      ]);

      const x2 = firstValue(data, [
        "x2_sesudah",
        "dampak_akademik_x2_terverifikasi",
        "x2_sebelum",
        "dampak_akademik_x2"
      ]);

      const x3 = firstValue(data, [
        "x3_digunakan",
        "frekuensi_penggunaan_x3"
      ]);

      const priority = normalizePriority(
        firstValue(data, [
          "prioritas_sesudah",
          "prioritas_prediksi",
          "prioritas_awal"
        ])
      );

      const finalStatus =
        decision === "tidak-valid"
          ? "tidak-valid"
          : "selesai";

      const isInvalid = decision === "tidak-valid";

      // Laporan tidak valid tidak pernah ditangani; tampilkan hasil verifikasinya.
      const actionText = isInvalid
        ? "Laporan dinyatakan tidak valid saat verifikasi, sehingga tidak ada tindakan perbaikan."
        : handlingValue(
            ["tindak_lanjut_perbaikan"],
            "Belum ada tindak lanjut"
          );

      const noteText = isInvalid
        ? firstValue(
            data,
            [
              "alasan_koreksi",
              "catatan_verifikasi_terakhir",
              "catatan_verifikasi"
            ],
            "Tidak ada catatan verifikasi"
          )
        : handlingValue(
            ["catatan_petugas"],
            "Tidak ada catatan akhir"
          );

      const officerName = isInvalid
        ? firstValue(
            data,
            ["nama_verifikator"],
            "Tidak tersedia"
          )
        : firstValue(
            data,
            ["nama_petugas"],
            firstValue(latestHandling, ["nama_petugas"], "Tidak tersedia")
          );

      const startValue = handlingValue(["waktu_mulai_penanganan"]);
      const endValue = handlingValue(["waktu_selesai_penanganan"]);

      return {
        code,

        reporter: firstValue(data, [
          "nama_pelapor",
          "nama_lengkap"
        ], "Tidak diketahui"),

        reporterNim: firstValue(data, [
          "nomor_identitas",
          "nim"
        ]),

        facility: firstValue(data, [
          "nama_fasilitas"
        ], "Tidak tersedia"),

        location: firstValue(data, [
          "nama_lokasi",
          "lokasi_ruangan"
        ], "Tidak tersedia"),

        description: firstValue(data, [
          "deskripsi_kerusakan"
        ], "-"),

        reportDate: getReportDate(data),

        verificationDate: firstValue(data, [
          "waktu_verifikasi"
        ]),

        completionDate: getFinalDate(
          { ...latestHandling, ...data,
            waktu_selesai_penanganan: handlingValue(["waktu_selesai_penanganan"]),
            waktu_pembaruan: handlingValue(["waktu_pembaruan"]) },
          decision,
          handlingStatus
        ),

        validation: decision,

        validationLabel:
          decision === "valid"
            ? "Valid"
            : decision === "tidak-valid"
              ? "Tidak Valid"
              : "Belum tersedia",

        finalStatus,

        handlingStatus,

        priority,

        x1: normalizeDamage(x1),
        x2: normalizeImpact(x2),
        x3: normalizeFrequency(x3),

        action: actionText,

        note: noteText,

        officer: officerName,

        officerLabel: isInvalid
          ? "Diverifikasi oleh"
          : "Petugas Penanggung Jawab",

        startDate: startValue,

        endDate: endValue,

        updateDate: handlingValue(
          ["waktu_pembaruan"],
          firstValue(data, ["tanggal_diperbarui"])
        )
      };
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
          "Respons API bukan JSON. Periksa endpoint PHP."
        );
      }

      if (response.status === 401) {
        window.location.replace(LOGIN_PAGE);

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

    // Memuat riwayat laporan langsung dari database.
    async function loadHistoryFromDatabase() {
      const payload = await fetchJson(API.history);

      if (!Array.isArray(payload.data)) {
        throw new Error(
          "Format data riwayat tidak sesuai."
        );
      }

      return payload.data
        .filter(isFinalHistoryRecord)
        .map(normalizeHistoryRecord)
        .filter(Boolean);
    }

    // Memuat profil petugas dari session PHP.
    async function synchronizeOfficerProfile() {
      if (profileRequest) {
        return profileRequest;
      }

      profileRequest = (async () => {
        const payload = await fetchJson(API.profile);

        const user = payload.user || payload.data;

        if (!user || !user.id_pengguna) {
          throw new Error(
            "Identitas petugas tidak ditemukan."
          );
        }

        const name = String(
          user.nama_lengkap ||
          user.nama_pengguna ||
          "Petugas SIPFAS"
        ).trim();

        const roleText = normalizeText(user.nama_peran);

        const role = roleText.includes("admin")
          ? "Administrator"
          : roleText.includes("petugas")
            ? "Petugas Sarana Prasarana"
            : String(user.nama_peran || "Pengguna");

        currentOfficerProfile = {
          id: String(user.id_pengguna),
          name,
          username: String(user.nama_pengguna || ""),
          email: String(user.email || ""),
          role,
          avatar: String(user.foto_profil || "")
        };

        renderOfficerProfile(currentOfficerProfile);

        return currentOfficerProfile;
      })();

      try {
        return await profileRequest;
      } catch (error) {
        console.error(
          "[SIPFAS] Gagal memuat profil petugas:",
          error
        );

        return null;
      } finally {
        profileRequest = null;
      }
    }

    // Membuat inisial nama petugas.
    function getInitials(name) {
      const parts = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      if (!parts.length) return "PT";

      if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
      }

      return (
        parts[0][0] +
        parts[parts.length - 1][0]
      ).toUpperCase();
    }

    // Mengubah alamat foto menjadi URL yang benar.
    function resolveOfficerPhoto(path) {
      if (!path) return "";

      const value = String(path).trim();

      if (/^(data:|https?:\/\/|blob:)/i.test(value)) {
        return value;
      }

      return new URL(
        "../../" + value.replace(/^\/+/, ""),
        window.location.href
      ).href;
    }

    // Memasang foto profil atau inisial petugas.
    function renderAvatarElement(element, profile) {
      if (!element) return;

      const photo = resolveOfficerPhoto(profile.avatar);

      if (element.tagName === "IMG") {
        if (photo) {
          element.src = photo;
        } else {
          element.removeAttribute("src");
        }

        element.alt = "Foto " + profile.name;
        return;
      }

      let image = element.querySelector(
        ".profile-header-photo, img"
      );

      let initials = element.querySelector(
        ".profile-header-initials"
      );

      const svg = element.querySelector("svg");

      if (photo) {
        if (svg) svg.style.display = "none";

        initials?.remove();

        if (!image) {
          image = document.createElement("img");
          image.className = "profile-header-photo";
          element.appendChild(image);
        }

        image.src = photo;
        image.alt = "Foto " + profile.name;

        Object.assign(image.style, {
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "cover",
          borderRadius: "50%"
        });

        image.onerror = () => {
          image.remove();

          const fallback = document.createElement("span");

          fallback.className = "profile-header-initials";
          fallback.textContent = getInitials(profile.name);

          element.appendChild(fallback);
        };

      } else {
        image?.remove();

        if (svg) svg.style.display = "none";

        if (!initials) {
          initials = document.createElement("span");
          initials.className = "profile-header-initials";
          element.appendChild(initials);
        }

        initials.textContent = getInitials(profile.name);

        Object.assign(initials.style, {
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontWeight: "700",
          fontSize: "14px"
        });
      }

      element.style.overflow = "hidden";
      element.setAttribute(
        "aria-label",
        photo
          ? "Foto profil " + profile.name
          : "Profil " + profile.name
      );
    }

    // Menyinkronkan nama, peran, email, dan foto petugas.
    function renderOfficerProfile(profile) {
      const nameSelectors = [
        "#officerName",
        "#petugasName",
        "#profileName",
        "#userName",
        ".officer-name",
        ".petugas-name",
        ".profile-name",
        ".user-name",
        ".account-name",
        "[data-profile-name]",
        "[data-user-name]"
      ];

      document.querySelectorAll(
        nameSelectors.join(", ")
      ).forEach((element) => {
        element.textContent = profile.name;
      });

      const roleSelectors = [
        "#officerRole",
        "#petugasRole",
        "#profileRole",
        "#userRole",
        ".officer-role",
        ".petugas-role",
        ".profile-role",
        ".user-role",
        ".account-role",
        "[data-profile-role]",
        "[data-user-role]"
      ];

      document.querySelectorAll(
        roleSelectors.join(", ")
      ).forEach((element) => {
        element.textContent = profile.role;
      });

      const emailSelectors = [
        "#officerEmail",
        "#profileEmail",
        "#userEmail",
        ".profile-email",
        ".user-email",
        "[data-profile-email]"
      ];

      document.querySelectorAll(
        emailSelectors.join(", ")
      ).forEach((element) => {
        element.textContent = profile.email;
      });

      const avatarSelectors = [
        ".profile-area .profile-avatar",
        "#profileAvatar",
        "#userAvatar",
        "#officerAvatar",
        ".profile-avatar",
        ".user-avatar",
        ".avatar",
        "[data-profile-avatar]"
      ];

      document.querySelectorAll(
        avatarSelectors.join(", ")
      ).forEach((element) => {
        renderAvatarElement(element, profile);
      });
    }

    // Membuat badge prioritas.
    function createPriorityBadge(priority) {
      const badge = document.createElement("span");

      badge.className = "priority-pill";

      const value = normalizeText(priority);

      if (value.includes("tinggi")) {
        badge.classList.add("high");
      } else if (value.includes("rendah")) {
        badge.classList.add("low");
      } else {
        badge.classList.add("medium");
      }

      badge.textContent = priority;

      return badge;
    }

    // Membuat badge status akhir.
    function createStatusBadge(status) {
      const badge = document.createElement("span");

      badge.className = "final-status";

      if (status === "selesai") {
        badge.classList.add("done");
        badge.textContent = "✓ Selesai";
      } else {
        badge.classList.add("invalid");
        badge.textContent = "⊗ Tidak Valid";
      }

      return badge;
    }

    // Membuat satu baris riwayat.
    function createHistoryRow(record) {
      const row = document.createElement("tr");

      row.dataset.code = record.code;
      row.dataset.status = record.finalStatus;

      row.dataset.search = normalizeText([
        record.code,
        record.reporter,
        record.reporterNim,
        record.facility,
        record.location,
        record.priority,
        record.validationLabel,
        record.action,
        record.note,
        record.officer
      ].join(" "));

      // Kolom kode laporan.
      const codeCell = document.createElement("td");

      const codeLabel = document.createElement("span");

      codeLabel.className = "history-code";
      codeLabel.textContent = record.code;

      codeCell.appendChild(codeLabel);

      // Kolom nama fasilitas.
      const facilityCell = document.createElement("td");

      facilityCell.className = "history-facility";
      facilityCell.textContent = record.facility;

      // Kolom lokasi.
      const locationCell = document.createElement("td");

      locationCell.textContent = record.location;

      // Kolom prioritas.
      const priorityCell = document.createElement("td");

      priorityCell.appendChild(
        createPriorityBadge(record.priority)
      );

      // Kolom status akhir.
      const statusCell = document.createElement("td");

      statusCell.appendChild(
        createStatusBadge(record.finalStatus)
      );

      // Kolom waktu penyelesaian atau waktu verifikasi.
      const dateCell = document.createElement("td");

      dateCell.textContent = formatDate(record.completionDate);

      // Kolom tombol detail.
      const actionCell = document.createElement("td");

      const button = document.createElement("button");

      button.type = "button";
      button.className = "detail-history";
      button.dataset.code = record.code;
      button.textContent = "Detail Riwayat";

      actionCell.appendChild(button);

      row.append(
        codeCell,
        facilityCell,
        locationCell,
        priorityCell,
        statusCell,
        dateCell,
        actionCell
      );

      return row;
    }

    // Menampilkan pesan ketika data kosong.
    function showEmptyState(message) {
      historyEmpty.textContent = message;
      historyEmpty.hidden = false;
    }

    // Menampilkan jumlah data.
    function updateRecordCount(visible, total) {
      recordCount.textContent =
        `Menampilkan ${visible} dari ${total} Data Terekam`;
    }

    // Menampilkan seluruh data riwayat.
    function renderHistory(records) {
      const fragment = document.createDocumentFragment();

      records.forEach((record) => {
        fragment.appendChild(
          createHistoryRow(record)
        );
      });

      historyRows.replaceChildren(fragment);

      updateRecordCount(
        records.length,
        allHistoryRecords.length
      );

      if (records.length === 0) {
        showEmptyState(
          allHistoryRecords.length === 0
            ? "Belum ada laporan yang masuk ke riwayat akhir."
            : "Tidak ada riwayat laporan yang sesuai dengan pencarian atau filter."
        );
      } else {
        historyEmpty.hidden = true;
      }
    }

    // Menampilkan detail riwayat laporan yang dipilih.
    function showHistoryDetail(code) {
      const normalizedCode = normalizeCode(code);

      const record = allHistoryRecords.find(
        (item) => item.code === normalizedCode
      );

      if (!record) {
        console.warn(
          "[SIPFAS] Detail laporan tidak ditemukan:",
          normalizedCode
        );
        return;
      }

      selectedRecordCode = normalizedCode;

      const statusText =
        record.finalStatus === "selesai"
          ? "Selesai Diperbaiki"
          : "Tidak Valid";

      // Menampilkan judul detail.
      if (detailTitle) {
        detailTitle.textContent =
          `Detail Riwayat Terpilih: ${record.code} — ${statusText}`;
      }

      // Menampilkan nama pelapor dan tanggal laporan.
      if (detailReporter) {
        detailReporter.textContent = record.reporter;
      }

      if (detailDate) {
        detailDate.textContent = formatDate(record.reportDate);
      }

      // Menampilkan hasil verifikasi dan parameter X1, X2, X3.
      if (detailValidation) {
        const parameterText =
          `X1: ${record.x1}, X2: ${record.x2}, X3: ${record.x3}`;

        detailValidation.textContent =
          `${record.validationLabel} (${parameterText})`;

        detailValidation.classList.remove(
          "valid-label",
          "invalid-label"
        );

        detailValidation.classList.add(
          record.finalStatus === "tidak-valid"
            ? "invalid-label"
            : "valid-label"
        );
      }

      // Menampilkan rekomendasi prioritas.
      if (detailPriority) {
        detailPriority.textContent = record.priority;

        detailPriority.classList.remove(
          "high",
          "medium",
          "low"
        );

        const priority = normalizeText(record.priority);

        if (priority.includes("tinggi")) {
          detailPriority.classList.add("high");
        } else if (priority.includes("rendah")) {
          detailPriority.classList.add("low");
        } else {
          detailPriority.classList.add("medium");
        }
      }

      // Menampilkan tindak lanjut teknisi.
      if (detailAction) {
        detailAction.textContent = record.action;
      }

      // Menampilkan catatan akhir petugas.
      if (detailNote) {
        detailNote.textContent = record.note;
      }

      // Menampilkan petugas dan rentang waktu penanganan dari database.
      if (detailOfficerLabel) {
        detailOfficerLabel.textContent = record.officerLabel;
      }

      if (detailOfficer) {
        detailOfficer.textContent = record.officer;
      }

      if (detailHandlingTime) {
        detailHandlingTime.textContent =
          record.finalStatus === "tidak-valid"
            ? "Tidak ada penanganan"
            : `${formatDate(record.startDate)} s.d. ${formatDate(record.endDate)}`;
      }

      // Memperbarui label status detail.
      const detailState = historyDetail?.querySelector(
        ".detail-state"
      );

      if (detailState) {
        detailState.textContent = statusText;
      }

      const detailCheck = historyDetail?.querySelector(
        ".detail-check"
      );

      if (detailCheck) {
        detailCheck.textContent =
          record.finalStatus === "selesai"
            ? "✓"
            : "⊗";
      }

      // Menampilkan panel detail.
      if (historyDetail) {
        historyDetail.hidden = false;
      }

      // Menandai tombol detail yang sedang dipilih.
      historyRows.querySelectorAll(
        ".detail-history"
      ).forEach((button) => {
        button.classList.toggle(
          "active",
          normalizeCode(button.dataset.code) === normalizedCode
        );
      });
    }

    // Melakukan pencarian dan filter status.
    function searchHistory() {
      const keyword = normalizeText(searchInput.value);

      const selectedStatus = normalizeText(
        statusFilter.value
      );

      const filteredRecords = allHistoryRecords.filter(
        (record) => {
          const searchable = normalizeText([
            record.code,
            record.reporter,
            record.reporterNim,
            record.facility,
            record.location,
            record.priority,
            record.validationLabel,
            record.action,
            record.note,
            record.officer
          ].join(" "));

          const matchesSearch =
            !keyword ||
            keyword.split(/\s+/).every((word) =>
              searchable.includes(word)
            );

          const matchesStatus =
            selectedStatus === "semua" ||
            selectedStatus === "" ||
            record.finalStatus === selectedStatus;

          return matchesSearch && matchesStatus;
        }
      );

      renderHistory(filteredRecords);

      // Memperbarui detail apabila laporan yang dipilih masih tersedia.
      const selectedExists = filteredRecords.some(
        (record) => record.code === selectedRecordCode
      );

      if (selectedExists) {
        showHistoryDetail(selectedRecordCode);
      } else if (filteredRecords.length > 0) {
        showHistoryDetail(filteredRecords[0].code);
      } else {
        selectedRecordCode = null;

        if (historyDetail) {
          historyDetail.hidden = true;
        }
      }
    }

    // Mengambil ulang data riwayat dari database.
    async function refreshHistory() {
      if (refreshInProgress) return;

      refreshInProgress = true;

      try {
        const latestRecords =
          await loadHistoryFromDatabase();

        // Mengurutkan laporan dari tanggal terbaru.
        latestRecords.sort((a, b) => {
          const dateA = String(
            a.completionDate || a.reportDate || ""
          );

          const dateB = String(
            b.completionDate || b.reportDate || ""
          );

          return dateB.localeCompare(dateA);
        });

        allHistoryRecords = latestRecords;

        lastRefreshTime = new Date();

        searchHistory();

        console.log(
          "[SIPFAS] Riwayat berhasil diperbarui:",
          allHistoryRecords.length,
          "laporan."
        );

      } catch (error) {
        console.error(
          "[SIPFAS] Gagal memperbarui riwayat:",
          error
        );

        // Menghapus data contoh agar tidak dianggap data database.
        historyRows.replaceChildren();

        updateRecordCount(0, 0);

        showEmptyState(
          "Gagal mengambil riwayat dari database. " +
          error.message
        );

        if (historyDetail) {
          historyDetail.hidden = true;
        }

      } finally {
        refreshInProgress = false;
      }
    }

    // Membuka detail berdasarkan tombol yang dipilih.
    historyRows.addEventListener("click", (event) => {
      const button = event.target.closest(
        ".detail-history"
      );

      if (!button || !historyRows.contains(button)) {
        return;
      }

      event.preventDefault();

      showHistoryDetail(button.dataset.code);
    });

    // Menangani pencarian.
    searchInput.addEventListener(
      "input",
      searchHistory
    );

    searchInput.addEventListener(
      "search",
      searchHistory
    );

    // Menangani filter status.
    statusFilter.addEventListener(
      "change",
      searchHistory
    );

    // Memperbarui riwayat setelah verifikasi berhasil.
    window.addEventListener(
      "sipfas:verification-saved",
      refreshHistory
    );

    // Memperbarui riwayat setelah penanganan berhasil.
    window.addEventListener(
      "sipfas:handling-saved",
      refreshHistory
    );

    window.addEventListener(
      "sipfas:history-updated",
      refreshHistory
    );

    // Memperbarui profil setelah pengguna menyimpan perubahan.
    window.addEventListener(
      "sipfas:profile-updated",
      synchronizeOfficerProfile
    );

    // Memuat ulang data ketika halaman kembali ditampilkan.
    window.addEventListener("pageshow", () => {
      synchronizeOfficerProfile();
      refreshHistory();
    });

    // Memperbarui data ketika tab kembali aktif.
    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) {
          synchronizeOfficerProfile();
          refreshHistory();
        }
      }
    );

    // Memperbarui data secara berkala.
    refreshTimer = window.setInterval(() => {
      if (!document.hidden) {
        refreshHistory();
      }
    }, REFRESH_INTERVAL);

    // Membersihkan timer saat halaman ditinggalkan.
    window.addEventListener("pagehide", () => {
      if (refreshTimer !== null) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
    });

    // Mengatur sidebar.
    function setSidebar(open) {
      sidebar?.classList.toggle("open", open);
      sidebar?.classList.toggle("active", open);

      pageOverlay?.classList.toggle("show", open);
      pageOverlay?.classList.toggle("active", open);

      menuToggle?.setAttribute(
        "aria-expanded",
        String(open)
      );
    }

    menuToggle?.addEventListener("click", () => {
      const isOpen =
        sidebar?.classList.contains("open") ||
        sidebar?.classList.contains("active");

      setSidebar(!isOpen);
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

    // Menangani logout melalui session PHP.
    async function performLogout(event) {
      event.preventDefault();

      if (!window.confirm(
        "Apakah Anda yakin ingin keluar dari sistem SIPFAS?"
      )) {
        return;
      }

      try {
        const response = await fetch(API.logout, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json"
          }
        });

        const payload = await response.json();

        if (!response.ok || payload.success !== true) {
          throw new Error(
            payload.message || "Logout gagal."
          );
        }

        window.location.replace(LOGIN_PAGE);

      } catch (error) {
        console.error(
          "[SIPFAS] Logout gagal:",
          error
        );

        window.alert(
          error.message ||
          "Tidak dapat mengakhiri sesi."
        );
      }
    }

    logoutLink?.addEventListener(
      "click",
      performLogout
    );

    // Memuat data awal halaman.
    synchronizeOfficerProfile();
    refreshHistory();

    console.log(
      "[SIPFAS] Riwayat Laporan berhasil diinisialisasi."
    );
  }
})();
