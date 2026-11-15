/* ============================================================
   SIPFAS - RIWAYAT LAPORAN
   File: Riwayat-Laporan.js
   VERSI REVISI + SINKRONISASI PROFIL & FOTO PETUGAS

   PERBAIKAN:
   1. Memperbaiki pembacaan nama lengkap pelapor.
   2. Memperbaiki pembacaan NIM.
   3. Memulihkan nama dari data Local Storage lama.
   4. Menggabungkan data berdasarkan kode laporan.
   5. Membaca data hasil verifikasi.
   6. Membaca data hasil penanganan.
   7. Menampilkan prioritas C4.5 terbaru.
   8. Menampilkan keputusan validasi.
   9. Menampilkan tindak lanjut teknisi.
   10. Menampilkan catatan akhir petugas.
   11. Mempertahankan seluruh arsip HTML.
   12. Mengaktifkan pencarian dan filter.
   13. Memperbaiki tombol Detail Riwayat.
   14. Sinkronisasi perubahan Local Storage.
   15. Sinkronisasi profil & foto petugas yang masuk secara realtime.
   16. Mempertahankan navigasi sidebar.

   STORAGE:
   sipfas_verifikasi_laporan
   sipfas_penanganan_laporan
   sipfas_selected_report
   sipfasActiveUser
   sipfasUsers
   sipfas_profile_photo_<username>
============================================================ */

(() => {
  "use strict";

  /* ========================================================
       1. KONFIGURASI PENYIMPANAN
    ======================================================== */

  const VERIFICATION_KEY = "sipfas_verifikasi_laporan";
  const HANDLING_KEY = "sipfas_penanganan_laporan";
  const SELECTED_KEY = "sipfas_selected_report";
  const ACTIVE_USER_KEY = "sipfasActiveUser";
  const PENDING_USER_KEY = "sipfasPendingLogin";
  const USERS_KEY = "sipfasUsers";
  const PHOTO_PREFIX = "sipfas_profile_photo_";

  /* ========================================================
       2. INISIALISASI HALAMAN
    ======================================================== */

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    /* Mengambil elemen HTML berdasarkan ID. */
    const $ = (id) => document.getElementById(id);

    /* Mengambil elemen pencarian dan filter. */
    const searchInput = $("searchHistory");
    const statusFilter = $("statusHistory");

    /* Mengambil elemen tabel arsip. */
    const historyRows = $("historyRows");
    const recordCount = $("recordCount");
    const historyEmpty = $("historyEmpty");

    /* Mengambil elemen panel detail. */
    const historyDetail = $("historyDetail");
    const detailTitle = $("detailTitle");
    const detailReporter = $("detailReporter");
    const detailDate = $("detailDate");
    const detailValidation = $("detailValidation");
    const detailPriority = $("detailPriority");
    const detailAction = $("detailAction");
    const detailNote = $("detailNote");

    /* Mengambil elemen navigasi. */
    const sidebar = $("sidebar");
    const menuToggle = $("menuToggle");
    const pageOverlay = $("pageOverlay");
    const logoutLink = $("logoutLink");

    /* Memastikan elemen utama tersedia. */
    if (
      !searchInput ||
      !statusFilter ||
      !historyRows ||
      !recordCount ||
      !historyEmpty
    ) {
      console.error("[SIPFAS] Elemen utama Riwayat Laporan tidak ditemukan.");
      return;
    }

    /* ====================================================
           3. STATE PROGRAM
        ==================================================== */

    let selectedRecordCode = null;
    let allHistoryRecords = [];
    const initialRecords = getInitialRecords();

    /* ====================================================
           4. NORMALISASI TEKS
        ==================================================== */

    function normalizeText(value) {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    function normalizeCode(value) {
      return String(value ?? "")
        .replace(/\s+/g, "")
        .trim()
        .toUpperCase();
    }

    /* ====================================================
           4B. SINKRONISASI PROFIL & FOTO PETUGAS LOGIN
        ==================================================== */

    function parseStoredJson(storage, key) {
      try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (error) {
        console.warn(`[SIPFAS] Gagal membaca data ${key}:`, error);
        return null;
      }
    }

    function formatRoleLabel(role) {
      const value = normalizeText(role);

      if (value === "administrator" || value === "admin") {
        return "Administrator";
      }

      if (value === "petugas") {
        return "Petugas";
      }

      if (value === "pelapor" || value === "user") {
        return "Pelapor";
      }

      return "Petugas";
    }

    function getInitials(name) {
      const parts = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      if (parts.length === 0) return "PT";

      if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
      }

      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function getActiveOfficerProfile() {
      const activeUser =
        parseStoredJson(localStorage, ACTIVE_USER_KEY) ||
        parseStoredJson(sessionStorage, ACTIVE_USER_KEY) ||
        parseStoredJson(sessionStorage, PENDING_USER_KEY) ||
        parseStoredJson(localStorage, PENDING_USER_KEY);

      if (!activeUser || typeof activeUser !== "object") {
        return null;
      }

      const users = parseStoredJson(localStorage, USERS_KEY);
      let matchedAccount = null;

      if (Array.isArray(users)) {
        const activeId = String(activeUser.id || "").trim();
        const activeUsername = normalizeText(activeUser.username);
        const activeEmail = normalizeText(activeUser.email);

        matchedAccount =
          users.find((account) => {
            if (!account) return false;

            const accId = String(account.id || "").trim();
            const accUsername = normalizeText(account.username);
            const accEmail = normalizeText(account.email);

            return (
              (activeId && accId === activeId) ||
              (activeUsername && accUsername === activeUsername) ||
              (activeEmail && accEmail === activeEmail)
            );
          }) || null;
      }

      const merged = {
        ...(matchedAccount || {}),
        ...activeUser,
      };

      const displayName = String(
        merged.name ||
          merged.fullName ||
          merged.nama ||
          merged.username ||
          "Petugas SIPFAS",
      ).trim();

      const photoKey = merged.username
        ? PHOTO_PREFIX + encodeURIComponent(normalizeText(merged.username))
        : "";

      const storedPhoto =
        (photoKey ? localStorage.getItem(photoKey) : null) ||
        merged.avatar ||
        merged.photo ||
        merged.foto ||
        "";

      return {
        id: merged.id || "",
        name: displayName,
        username: merged.username || "",
        email: merged.email || "",
        role: formatRoleLabel(merged.role),
        avatar: storedPhoto,
        initials: getInitials(displayName),
      };
    }

    function renderAvatarElement(el, profile) {
      if (!el) return;

      if (el.tagName === "IMG") {
        if (profile.avatar) {
          el.src = profile.avatar;
        }
        el.alt = `Foto ${profile.name}`;
        return;
      }

      const svgIcon = el.querySelector("svg");
      let imgInside = el.querySelector(".profile-header-photo, img");
      let initialsEl = el.querySelector(".profile-header-initials");

      if (profile.avatar) {
        if (svgIcon) {
          svgIcon.style.display = "none";
        }

        if (initialsEl) {
          initialsEl.remove();
        }

        if (!imgInside) {
          imgInside = document.createElement("img");
          imgInside.className = "profile-header-photo";
          el.appendChild(imgInside);
        }

        imgInside.src = profile.avatar;
        imgInside.alt = `Foto ${profile.name}`;

        Object.assign(imgInside.style, {
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "cover",
          borderRadius: "50%",
        });

        el.style.overflow = "hidden";
      } else {
        if (imgInside) {
          imgInside.remove();
        }

        if (svgIcon) {
          svgIcon.style.display = "none";
        }

        if (!initialsEl) {
          initialsEl = document.createElement("span");
          initialsEl.className = "profile-header-initials";
          el.appendChild(initialsEl);
        }

        initialsEl.textContent = profile.initials;

        Object.assign(initialsEl.style, {
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontWeight: "700",
          fontSize: "14px",
        });
      }

      el.setAttribute(
        "aria-label",
        profile.avatar
          ? `Foto profil ${profile.name}`
          : `Profil ${profile.name}`,
      );
    }

    function synchronizeOfficerProfile() {
      const profile = getActiveOfficerProfile();

      if (!profile) {
        console.warn("[SIPFAS] Sesi akun petugas aktif tidak ditemukan.");
        return;
      }

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
        "[data-user-name]",
      ];

      document.querySelectorAll(nameSelectors.join(", ")).forEach((el) => {
        el.textContent = profile.name;
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
        "[data-user-role]",
      ];

      document.querySelectorAll(roleSelectors.join(", ")).forEach((el) => {
        el.textContent = profile.role;
      });

      const emailSelectors = [
        "#officerEmail",
        "#profileEmail",
        "#userEmail",
        ".profile-email",
        ".user-email",
        "[data-profile-email]",
      ];

      if (profile.email) {
        document.querySelectorAll(emailSelectors.join(", ")).forEach((el) => {
          el.textContent = profile.email;
        });
      }

      const avatarSelectors = [
        ".profile-area .profile-avatar",
        "#profileAvatar",
        "#userAvatar",
        "#officerAvatar",
        ".profile-avatar",
        ".user-avatar",
        ".avatar",
        "[data-profile-avatar]",
      ];

      document.querySelectorAll(avatarSelectors.join(", ")).forEach((el) => {
        renderAvatarElement(el, profile);
      });

      const profileContainers = document.querySelectorAll(
        ".user-profile, .profile-box, .header-profile, .sidebar-profile",
      );

      profileContainers.forEach((container) => {
        const hasExplicit = container.querySelector(nameSelectors.join(", "));

        if (hasExplicit) return;

        const strongEl = container.querySelector("strong, h4, h5, .name");
        const subEl = container.querySelector("small, span:not(.avatar), p");

        if (strongEl) {
          strongEl.textContent = profile.name;
        }

        if (subEl && subEl !== strongEl && !subEl.querySelector("img")) {
          subEl.textContent = profile.role;
        }
      });

      console.log(
        `[SIPFAS] Profil & foto petugas tersinkronisasi: ${profile.name} (${profile.role})`,
      );
    }

    /* ====================================================
           5. MENGAMBIL FIELD PERTAMA YANG TERSEDIA
        ==================================================== */

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

    /* ====================================================
           6. MEMERIKSA NILAI KOSONG
        ==================================================== */

    function isEmpty(value) {
      return (
        value === undefined ||
        value === null ||
        String(value).trim() === "" ||
        String(value).trim() === "-"
      );
    }

    /* ====================================================
           7. MEMBACA LOCAL STORAGE
        ==================================================== */

    function readStorage(key) {
      try {
        const raw = localStorage.getItem(key);

        if (!raw) {
          return {};
        }

        const data = JSON.parse(raw);

        if (!data || typeof data !== "object") {
          return {};
        }

        return data;
      } catch (error) {
        console.error("[SIPFAS] Gagal membaca Local Storage:", key, error);

        return {};
      }
    }

    /* ====================================================
           8. MEMBACA DATA LAPORAN TERPILIH
        ==================================================== */

    function getSelectedReport() {
      return readStorage(SELECTED_KEY);
    }

    /* ====================================================
           9. MENGUBAH DATA MENJADI FORMAT SERAGAM
        ==================================================== */

    function convertToRecords(data) {
      const records = [];

      if (Array.isArray(data)) {
        data.forEach((item) => {
          if (!item || typeof item !== "object") {
            return;
          }

          const code = normalizeCode(
            firstValue(
              item,
              ["reportCode", "kodeLaporan", "kode_laporan", "code", "id"],
              "",
            ),
          );

          if (code) {
            records.push({
              code,
              data: item,
            });
          }
        });

        return records;
      }

      if (!data || typeof data !== "object") {
        return records;
      }

      Object.entries(data).forEach(([key, value]) => {
        if (!value || typeof value !== "object") {
          return;
        }

        const code = normalizeCode(
          firstValue(
            value,
            ["reportCode", "kodeLaporan", "kode_laporan", "code", "id"],
            key,
          ),
        );

        if (code) {
          records.push({
            code,
            data: value,
          });
        }
      });

      return records;
    }

    /* ====================================================
           10. MEMBACA DATA AWAL HTML
        ==================================================== */

    function getInitialRecords() {
      const records = [];

      historyRows.querySelectorAll("tr").forEach((row) => {
        const cells = Array.from(row.querySelectorAll("td"));

        if (cells.length < 6) {
          return;
        }

        const code = normalizeCode(
          row.dataset.code ||
            cells[0].textContent.match(/LPR[-\s]?\d{4}[-\s]?\d+/i)?.[0],
        );

        if (!code) {
          return;
        }

        const priority =
          cells[3].querySelector(".priority-pill")?.textContent.trim() || "-";

        const statusText = normalizeText(cells[4].textContent);

        const finalStatus = statusText.includes("tidak valid")
          ? "tidak-valid"
          : "selesai";

        records.push({
          code,

          facility: cells[1].innerText.trim(),

          location: cells[2].innerText.trim(),

          priority,

          finalStatus,

          completionDate: cells[5].innerText.trim(),

          reporter: "-",

          reporterNim: "",

          reportDate: "-",

          validation: "-",

          action: "-",

          note: "",
        });
      });

      return records;
    }

    /* ====================================================
           11. MEMISAHKAN NAMA PELAPOR DAN NIM
        ==================================================== */

    function parseReporter(rawValue) {
      const raw = String(rawValue ?? "")
        .replace(/\r/g, "")
        .trim();

      if (!raw) {
        return {
          name: "",
          nim: "",
        };
      }

      const lines = raw
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      let nameParts = [];
      let nim = "";

      lines.forEach((line) => {
        if (/program\s+studi/i.test(line)) {
          return;
        }

        const nimMatch = line.match(/(?:NIM\s*[:.-]?\s*)?(\d{6,20})/i);

        if (nimMatch) {
          nim = nimMatch[1];

          const remaining = line
            .replace(nimMatch[0], "")
            .replace(/NIM\s*[:.-]?/i, "")
            .trim();

          if (remaining) {
            nameParts.push(remaining);
          }

          return;
        }

        const cleanLine = line
          .replace(/^(nama\s*[:.-]?\s*)/i, "")
          .replace(/^(pelapor\s*[:.-]?\s*)/i, "")
          .trim();

        if (cleanLine) {
          nameParts.push(cleanLine);
        }
      });

      const name = nameParts.join(" ").replace(/\s+/g, " ").trim();

      return {
        name,
        nim,
      };
    }

    /* ====================================================
           12. MENGAMBIL IDENTITAS PELAPOR SECARA LENGKAP
        ==================================================== */

    function getReporterInformation(verification, handling, selected, initial) {
      const rawReporter = firstValue(
        verification,
        ["reporter", "pelapor", "namaPelapor"],
        firstValue(
          handling,
          ["reporter", "pelapor", "namaPelapor"],
          selected.reporter || "",
        ),
      );

      const parsed = parseReporter(rawReporter);

      const explicitName = firstValue(
        verification,
        ["reporterName", "namaPelapor", "nama", "reporter_name"],
        firstValue(
          handling,
          ["reporterName", "namaPelapor"],
          selected.reporterName || initial.reporter || "",
        ),
      );

      const explicitNim = firstValue(
        verification,
        ["reporterNim", "nim", "nomorInduk"],
        firstValue(
          handling,
          ["reporterNim", "nim"],
          selected.reporterNim || initial.reporterNim || "",
        ),
      );

      const nimContainsName =
        !isEmpty(explicitNim) &&
        !/^\d{6,20}$/.test(String(explicitNim).replace(/\D/g, ""));

      let name = String(explicitName || "").trim();

      if (nimContainsName) {
        name = [name, String(explicitNim).trim()].filter(Boolean).join(" ");
      }

      if (
        parsed.name &&
        parsed.name.split(/\s+/).length > name.split(/\s+/).length
      ) {
        name = parsed.name;
      }

      let nim =
        parsed.nim ||
        (/^\d{6,20}$/.test(String(explicitNim).replace(/\D/g, ""))
          ? String(explicitNim).replace(/\D/g, "")
          : "");

      name = name.replace(/\s+/g, " ").trim();

      return {
        name: name || "-",
        nim,
      };
    }

    /* ====================================================
           13. MEMBACA KEPUTUSAN VERIFIKASI
        ==================================================== */

    function getDecision(data) {
      const decision = normalizeText(
        firstValue(
          data,
          [
            "decision",
            "keputusan",
            "decisionLabel",
            "hasilVerifikasi",
            "statusVerifikasi",
            "verificationStatus",
            "validationStatus",
          ],
          "",
        ),
      );

      if (
        decision.includes("invalid") ||
        decision.includes("tidak valid") ||
        decision.includes("ditolak")
      ) {
        return "Tidak Valid";
      }

      if (
        decision === "valid" ||
        decision === "laporan valid" ||
        decision === "diterima"
      ) {
        return "Valid";
      }

      return "-";
    }

    /* ====================================================
           14. MEMBACA PRIORITAS C4.5
        ==================================================== */

    function getPriority(verification, handling, initial) {
      const verificationPriority = firstValue(
        verification,
        [
          "priorityLabel",
          "priority",
          "prioritas",
          "hasilKlasifikasi",
          "hasilC45",
          "klasifikasi",
          "rekomendasi",
        ],
        "",
      );

      const handlingPriority = firstValue(
        handling,
        ["priorityLabel", "priority", "prioritas"],
        "",
      );

      if (!isEmpty(verificationPriority)) {
        return verificationPriority;
      }

      if (!isEmpty(handlingPriority)) {
        return handlingPriority;
      }

      return initial.priority || "-";
    }

    /* ====================================================
           15. MEMBACA STATUS PENANGANAN
        ==================================================== */

    function getHandlingStatus(data) {
      return normalizeText(
        firstValue(
          data,
          ["status", "handlingStatus", "statusPenanganan", "statusLabel"],
          "",
        ),
      );
    }

    /* ====================================================
           16. MENENTUKAN STATUS AKHIR
        ==================================================== */

    function getFinalStatus(verification, handling, initial) {
      const decision = getDecision(verification);
      const handlingStatus = getHandlingStatus(handling);

      if (decision === "Tidak Valid") {
        return "tidak-valid";
      }

      if (
        handlingStatus === "selesai" ||
        handlingStatus === "ditutup" ||
        handlingStatus === "completed" ||
        handlingStatus === "closed"
      ) {
        return "selesai";
      }

      if (initial.code) {
        return initial.finalStatus;
      }

      return null;
    }

    /* ====================================================
           17. FORMAT TANGGAL
        ==================================================== */

    function formatDate(value) {
      if (isEmpty(value)) {
        return "-";
      }

      const text = String(value).trim();
      const date = new Date(text);

      if (Number.isNaN(date.getTime())) {
        return text;
      }

      return (
        new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jayapura",
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(date) + " WIT"
      );
    }

    /* ====================================================
           18. MEMBANGUN SELURUH DATA RIWAYAT
        ==================================================== */

    function buildHistoryRecords() {
      const verificationData = convertToRecords(readStorage(VERIFICATION_KEY));

      const handlingData = convertToRecords(readStorage(HANDLING_KEY));

      const selected = getSelectedReport();

      const verificationMap = new Map(
        verificationData.map((item) => [item.code, item.data]),
      );

      const handlingMap = new Map(
        handlingData.map((item) => [item.code, item.data]),
      );

      const allCodes = new Set([
        ...initialRecords.map((item) => item.code),
        ...verificationMap.keys(),
        ...handlingMap.keys(),
      ]);

      const records = [];

      allCodes.forEach((code) => {
        const initial = initialRecords.find((item) => item.code === code) || {};

        const verification = verificationMap.get(code) || {};

        const handling = handlingMap.get(code) || {};

        const selectedForThisReport =
          normalizeCode(selected.id || selected.reportCode) === code
            ? selected
            : {};

        const finalStatus = getFinalStatus(verification, handling, initial);

        if (!finalStatus) {
          return;
        }

        const reporter = getReporterInformation(
          verification,
          handling,
          selectedForThisReport,
          initial,
        );

        const facility = firstValue(
          verification,
          ["facilityName", "facility", "fasilitas", "namaFasilitas"],
          firstValue(
            handling,
            ["facilityName", "facility", "fasilitas"],
            selectedForThisReport.facility || initial.facility || "-",
          ),
        );

        const location = firstValue(
          verification,
          ["facilityLocation", "location", "lokasi", "lokasiFasilitas"],
          firstValue(
            handling,
            ["facilityLocation", "location", "lokasi"],
            selectedForThisReport.location || initial.location || "-",
          ),
        );

        const reportDate = firstValue(
          verification,
          [
            "reportTime",
            "reportDate",
            "tanggalLaporan",
            "tanggalMasuk",
            "createdAt",
            "date",
          ],
          firstValue(
            handling,
            ["reportTime", "reportDate", "tanggalLaporan"],
            selectedForThisReport.date || initial.reportDate || "-",
          ),
        );

        const validation = getDecision(verification);

        const priority = getPriority(verification, handling, initial);

        const action = firstValue(
          handling,
          [
            "followUp",
            "followUpAction",
            "tindakLanjut",
            "tindakLanjutPerbaikan",
            "action",
          ],
          "-",
        );

        const note = firstValue(
          handling,
          [
            "officerNotes",
            "catatanPetugas",
            "finalNote",
            "completionNotes",
            "notes",
          ],
          "-",
        );

        const completionDate = firstValue(
          handling,
          [
            "updatedAtLabel",
            "updatedAt",
            "completionDate",
            "tanggalPenyelesaian",
            "tanggalSelesai",
          ],
          initial.completionDate || "-",
        );

        records.push({
          code,

          reporter: reporter.name,

          reporterNim: reporter.nim,

          facility,

          location,

          reportDate: formatDate(reportDate),

          validation,

          priority,

          action,

          note,

          finalStatus,

          completionDate: formatDate(completionDate),
        });
      });

      return records;
    }

    /* ====================================================
           19. MEMBUAT BADGE PRIORITAS
        ==================================================== */

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

      badge.textContent = isEmpty(priority) ? "-" : priority;

      return badge;
    }

    /* ====================================================
           20. MEMBUAT BADGE STATUS
        ==================================================== */

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

    /* ====================================================
           21. MERENDER TABEL ARSIP
        ==================================================== */

    function renderHistory(records) {
      historyRows.replaceChildren();

      records.forEach((record) => {
        const row = document.createElement("tr");

        row.dataset.code = record.code;

        row.dataset.status = record.finalStatus;

        const codeCell = document.createElement("td");

        const codeLabel = document.createElement("span");

        codeLabel.className = "history-code";

        codeLabel.textContent = record.code;

        codeCell.appendChild(codeLabel);

        row.appendChild(codeCell);

        const facilityCell = document.createElement("td");

        facilityCell.className = "history-facility";

        facilityCell.textContent = record.facility;

        row.appendChild(facilityCell);

        const locationCell = document.createElement("td");

        locationCell.textContent = record.location;

        row.appendChild(locationCell);

        const priorityCell = document.createElement("td");

        priorityCell.appendChild(createPriorityBadge(record.priority));

        row.appendChild(priorityCell);

        const statusCell = document.createElement("td");

        statusCell.appendChild(createStatusBadge(record.finalStatus));

        row.appendChild(statusCell);

        const dateCell = document.createElement("td");

        dateCell.textContent = record.completionDate;

        row.appendChild(dateCell);

        const actionCell = document.createElement("td");

        const button = document.createElement("button");

        button.type = "button";

        button.className = "detail-history";

        button.dataset.code = record.code;

        button.textContent = "Detail Riwayat";

        actionCell.appendChild(button);

        row.appendChild(actionCell);

        historyRows.appendChild(row);
      });

      recordCount.textContent = `Menampilkan ${records.length} dari ${allHistoryRecords.length} Data Terekam`;

      historyEmpty.hidden = records.length > 0;
    }

    /* ====================================================
           22. MENAMPILKAN DETAIL RIWAYAT
        ==================================================== */

    function showHistoryDetail(code) {
      const normalizedCode = normalizeCode(code);

      const record = allHistoryRecords.find(
        (item) => item.code === normalizedCode,
      );

      if (!record) {
        console.warn(
          "[SIPFAS] Detail laporan tidak ditemukan:",
          normalizedCode,
        );

        return;
      }

      selectedRecordCode = normalizedCode;

      const statusText =
        record.finalStatus === "selesai" ? "Selesai Diperbaiki" : "Tidak Valid";

      if (detailTitle) {
        detailTitle.textContent = `Detail Riwayat Terpilih: ${record.code} — ${statusText}`;
      }

      if (detailReporter) {
        detailReporter.textContent = record.reporter;
      }

      if (detailDate) {
        detailDate.textContent = record.reportDate;
      }

      if (detailValidation) {
        detailValidation.textContent = record.validation;

        detailValidation.classList.remove("valid-label", "invalid-label");

        if (record.validation === "Tidak Valid") {
          detailValidation.classList.add("invalid-label");
        } else {
          detailValidation.classList.add("valid-label");
        }
      }

      if (detailPriority) {
        detailPriority.textContent = record.priority;

        detailPriority.classList.remove("high", "medium", "low");

        const priority = normalizeText(record.priority);

        if (priority.includes("tinggi")) {
          detailPriority.classList.add("high");
        } else if (priority.includes("rendah")) {
          detailPriority.classList.add("low");
        } else {
          detailPriority.classList.add("medium");
        }
      }

      if (detailAction) {
        detailAction.textContent = record.action;
      }

      if (detailNote) {
        detailNote.textContent = record.note;
      }

      const detailState = historyDetail?.querySelector(".detail-state");

      if (detailState) {
        detailState.textContent = statusText;
      }

      const detailCheck = historyDetail?.querySelector(".detail-check");

      if (detailCheck) {
        detailCheck.textContent = record.finalStatus === "selesai" ? "✓" : "⊗";
      }

      if (historyDetail) {
        historyDetail.hidden = false;
      }

      historyRows.querySelectorAll(".detail-history").forEach((button) => {
        button.classList.toggle(
          "active",
          normalizeCode(button.dataset.code) === normalizedCode,
        );
      });

      console.log("[SIPFAS] Detail laporan aktif:", record);
    }

    /* ====================================================
           23. PENCARIAN DAN FILTER
        ==================================================== */

    function searchHistory() {
      const keyword = normalizeText(searchInput.value);

      const selectedStatus = normalizeText(statusFilter.value);

      const filteredRecords = allHistoryRecords.filter((record) => {
        const searchable = normalizeText(
          [
            record.code,
            record.reporter,
            record.reporterNim,
            record.facility,
            record.location,
            record.priority,
            record.validation,
            record.action,
            record.note,
          ].join(" "),
        );

        const matchesSearch = !keyword || searchable.includes(keyword);

        const matchesStatus =
          selectedStatus === "semua" ||
          selectedStatus === "" ||
          record.finalStatus === selectedStatus;

        return matchesSearch && matchesStatus;
      });

      renderHistory(filteredRecords);
    }

    /* ====================================================
           24. MEMPERBARUI SELURUH DATA
        ==================================================== */

    function refreshHistory() {
      allHistoryRecords = buildHistoryRecords();

      searchHistory();

      const selectedExists = allHistoryRecords.some(
        (record) => record.code === selectedRecordCode,
      );

      if (selectedExists) {
        showHistoryDetail(selectedRecordCode);
      } else if (allHistoryRecords.length > 0) {
        showHistoryDetail(allHistoryRecords[0].code);
      } else {
        selectedRecordCode = null;

        if (historyDetail) {
          historyDetail.hidden = true;
        }
      }

      console.log("[SIPFAS] Data arsip diperbarui:", allHistoryRecords);
    }

    /* ====================================================
           25. EVENT TOMBOL DETAIL RIWAYAT
        ==================================================== */

    historyRows.addEventListener("click", (event) => {
      const button = event.target.closest(".detail-history");

      if (!button || !historyRows.contains(button)) {
        return;
      }

      event.preventDefault();

      showHistoryDetail(button.dataset.code);
    });

    /* ====================================================
           26. EVENT PENCARIAN
        ==================================================== */

    searchInput.addEventListener("input", searchHistory);

    /* ====================================================
           27. EVENT FILTER STATUS
        ==================================================== */

    statusFilter.addEventListener("change", searchHistory);

    /* ====================================================
           28. SINKRONISASI LOCAL STORAGE & PROFIL REALTIME
        ==================================================== */

    window.addEventListener("storage", (event) => {
      if (
        event.key === VERIFICATION_KEY ||
        event.key === HANDLING_KEY ||
        event.key === SELECTED_KEY ||
        event.key === null
      ) {
        refreshHistory();
      }

      if (
        event.key === ACTIVE_USER_KEY ||
        event.key === USERS_KEY ||
        (event.key && event.key.startsWith(PHOTO_PREFIX)) ||
        event.key === null
      ) {
        synchronizeOfficerProfile();
      }
    });

    window.addEventListener(
      "sipfas:profile-updated",
      synchronizeOfficerProfile,
    );

    /* ====================================================
           29. SINKRONISASI HASIL VERIFIKASI
        ==================================================== */

    window.addEventListener("sipfas:verification-saved", refreshHistory);

    /* ====================================================
           30. SINKRONISASI HASIL PENANGANAN
        ==================================================== */

    window.addEventListener("sipfas:handling-saved", refreshHistory);

    /* ====================================================
           31. SINKRONISASI SAAT HALAMAN AKTIF
        ==================================================== */

    window.addEventListener("pageshow", () => {
      synchronizeOfficerProfile();
      refreshHistory();
    });

    window.addEventListener("focus", synchronizeOfficerProfile);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        synchronizeOfficerProfile();
        refreshHistory();
      }
    });

    /* ====================================================
           32. SIDEBAR RESPONSIF
        ==================================================== */

    function setSidebar(open) {
      sidebar?.classList.toggle("open", open);
      sidebar?.classList.toggle("active", open);

      pageOverlay?.classList.toggle("show", open);
      pageOverlay?.classList.toggle("active", open);

      menuToggle?.setAttribute("aria-expanded", String(open));
    }

    menuToggle?.addEventListener("click", () => {
      const isOpen =
        sidebar?.classList.contains("open") ||
        sidebar?.classList.contains("active");

      setSidebar(!isOpen);
    });

    pageOverlay?.addEventListener("click", () => {
      setSidebar(false);
    });

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        setSidebar(false);
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setSidebar(false);
      }
    });

    /* ====================================================
           33. TOMBOL KELUAR
        ==================================================== */

    logoutLink?.addEventListener("click", (event) => {
      event.preventDefault();

      const confirmation = window.confirm(
        "Apakah Anda yakin ingin keluar dari sistem SIPFAS?",
      );

      if (!confirmation) {
        return;
      }

      // Menghapus sesi autentikasi saja.
      // Data laporan di Local Storage tetap dipertahankan.
      [
        "sipfasPendingLogin",
        "sipfasLoginEmail",
        "sipfasLoginOtp",
        "sipfasLoginOtpExpiresAt",
        "sipfasLoginAttempts",
        "sipfasLoginVerified",
        "sipfasActiveUser",
      ].forEach((key) => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      });

      window.location.href = logoutLink.href;
    });

    /* ====================================================
           34. MENJALANKAN HALAMAN
        ==================================================== */

    synchronizeOfficerProfile();
    refreshHistory();

    console.log(
      "[SIPFAS] Riwayat Laporan & foto profil petugas berhasil diinisialisasi.",
    );
  }
})();
