/**
 * ============================================================
 * SIPFAS - PROFIL PELAPOR
 * ============================================================
 *
 * Sumber data:
 * DATABASE -> PHP SESSION -> API PROFIL
 *
 * Fitur:
 * 1. Mengambil identitas pengguna.
 * 2. Mengubah nama dan email.
 * 3. Mengubah password.
 * 4. Mengunggah foto profil.
 * 5. Menampilkan foto profil.
 * 6. Membatalkan perubahan.
 * 7. Sinkronisasi ke Dashboard.
 *
 * ============================================================
 */

(function () {
  "use strict";

  // API dihitung dari halaman Profil: naik tiga tingkat ke folder SIPFASS.
  const API_URL = new URL("../../../api/user/profil.php", window.location.href)
    .href;

  let profilAwal = null;
  let fotoSementara = null;
  let objectUrlSementara = null;
  let sedangMenyimpan = false;

  const $ = (id) => document.getElementById(id);

  // =========================================================
  // 1. MEMULAI HALAMAN PROFIL
  // =========================================================

  document.addEventListener("DOMContentLoaded", initializeProfile);

  async function initializeProfile() {
    const form = $("profileForm");

    if (!form) {
      console.error("Form profil tidak ditemukan.");
      return;
    }

    aturPasswordToggle();
    aturUploadFoto();
    aturTombolBatal();

    form.addEventListener("submit", handleSubmit);

    window.addEventListener("sipfas:profile-loaded", function (event) {
      if (!sedangMenyimpan) {
        tampilkanProfil(event.detail.profile);
      }
    });

    document.addEventListener("sipfas:profile-error", function (event) {
      console.error("Gagal memuat profil:", event.detail.message);
    });

    await loadProfile();
  }

  // =========================================================
  // 2. MENGAMBIL DATA PROFIL DARI DATABASE
  // =========================================================

  async function loadProfile() {
    try {
      const response = await fetch(API_URL, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const result = await response.json();

      if (response.status === 401) {
        window.location.replace(
          new URL("../../../auth/Login.html", location.href).href,
        );
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil profil.");
      }

      tampilkanProfil(result.data);
      simpanSnapshot();

      window.dispatchEvent(
        new CustomEvent("sipfas:profile-loaded", {
          detail: { profile: result.data },
        }),
      );
    } catch (error) {
      console.error("SIPFAS PROFILE:", error);

      tampilkanNotifikasi(error.message, "error", "Gagal Memuat Profil");
    }
  }

  // =========================================================
  // 3. MENAMPILKAN DATA PROFIL
  // =========================================================

  function tampilkanProfil(profile) {
    if (!profile) return;

    $("nama").value = profile.nama_lengkap || "";
    $("nim").value = profile.nomor_identitas || "";
    $("username").value = profile.username || "";
    $("email").value = profile.email || "";

    const identityName = document.querySelector(".identity-information h2");

    if (identityName) {
      identityName.textContent = profile.nama_lengkap || "Pengguna";
    }

    const identityNim = $("identityNim");

    if (identityNim) {
      identityNim.textContent = "NIM: " + (profile.nomor_identitas || "-");
    }

    document.querySelectorAll(".header-name").forEach((element) => {
      element.textContent = profile.nama_lengkap || "Pengguna";
    });

    document.querySelectorAll(".role-badge").forEach((element) => {
      element.textContent = profile.role || "Pelapor";
    });

    tampilkanFotoDatabase(profile.foto_profil);
  }

  // =========================================================
  // 4. MENAMPILKAN FOTO DARI DATABASE
  // =========================================================

  function tampilkanFotoDatabase(path) {
    const image = $("profilePhotoImage");
    const headerImage = $("headerProfileImage");

    const placeholder = $("photoPlaceholder");
    const headerDefault = $("headerDefaultAvatar");

    if (!path) {
      tampilkanFotoDefault();
      return;
    }

    const url = window.SIPFASProfile?.resolvePhoto
      ? window.SIPFASProfile.resolvePhoto(path)
      : new URL(
          "../../../" + String(path).replace(/^\/+/, ""),
          window.location.href,
        ).href;

    if (image) {
      image.onload = function () {
        image.hidden = false;
        if (placeholder) placeholder.hidden = true;
      };

      image.onerror = function () {
        image.hidden = true;
        if (placeholder) placeholder.hidden = false;
      };

      image.src = url;
    }

    if (headerImage) {
      headerImage.onload = function () {
        headerImage.hidden = false;
        if (headerDefault) headerDefault.hidden = true;
      };

      headerImage.onerror = function () {
        headerImage.hidden = true;
        if (headerDefault) headerDefault.hidden = false;
      };

      headerImage.src = url;
    }

    document.querySelectorAll(".sipfas-header-photo").forEach((img) => {
      img.src = url;
    });
  }

  function tampilkanFotoPreview(url) {
    const image = $("profilePhotoImage");
    const headerImage = $("headerProfileImage");

    if (image) {
      image.src = url;
      image.hidden = false;
    }

    if (headerImage) {
      headerImage.src = url;
      headerImage.hidden = false;
    }

    const placeholder = $("photoPlaceholder");
    const headerDefault = $("headerDefaultAvatar");

    if (placeholder) placeholder.hidden = true;
    if (headerDefault) headerDefault.hidden = true;

    document.querySelectorAll(".sipfas-header-photo").forEach((img) => {
      img.src = url;
    });
  }

  function tampilkanFotoDefault() {
    const image = $("profilePhotoImage");
    const headerImage = $("headerProfileImage");

    if (image) {
      image.removeAttribute("src");
      image.hidden = true;
    }

    if (headerImage) {
      headerImage.removeAttribute("src");
      headerImage.hidden = true;
    }

    if ($("photoPlaceholder")) {
      $("photoPlaceholder").hidden = false;
    }

    if ($("headerDefaultAvatar")) {
      $("headerDefaultAvatar").hidden = false;
    }

    document.querySelectorAll(".sipfas-header-photo").forEach((img) => {
      img.removeAttribute("src");
      img.style.display = "none";
    });
  }

  // =========================================================
  // 5. UPLOAD FOTO PROFIL
  // =========================================================

  function aturUploadFoto() {
    const button = $("editPhotoButton");
    const input = $("photoUpload");

    if (!button || !input) return;

    button.addEventListener("click", function () {
      input.click();
    });

    input.addEventListener("change", function () {
      prosesFoto(input.files[0]);
    });
  }

  function prosesFoto(file) {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      tampilkanNotifikasi(
        "Gunakan foto JPG, PNG, atau WEBP.",
        "error",
        "Format Foto Tidak Valid",
      );

      $("photoUpload").value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      tampilkanNotifikasi(
        "Ukuran foto maksimal 5 MB.",
        "error",
        "Ukuran Foto Terlalu Besar",
      );

      $("photoUpload").value = "";
      return;
    }

    if (objectUrlSementara) {
      URL.revokeObjectURL(objectUrlSementara);
    }

    fotoSementara = file;
    objectUrlSementara = URL.createObjectURL(file);

    tampilkanFotoPreview(objectUrlSementara);

    tampilkanNotifikasi(
      "Foto berhasil dipilih. Klik Simpan Perubahan untuk menyimpan.",
      "info",
      "Foto Siap Disimpan",
    );
  }

  // =========================================================
  // 6. PASSWORD TOGGLE
  // =========================================================

  function aturPasswordToggle() {
    document.querySelectorAll(".password-toggle").forEach((button) => {
      button.addEventListener("click", function () {
        const input = button.closest(".input-wrapper")?.querySelector("input");

        if (!input) return;

        const show = input.type === "password";

        input.type = show ? "text" : "password";

        button.setAttribute(
          "aria-label",
          show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi",
        );

        button.setAttribute("aria-pressed", String(show));
      });
    });
  }

  // =========================================================
  // 7. MENYIMPAN SNAPSHOT DATA AWAL
  // =========================================================

  function simpanSnapshot() {
    profilAwal = {
      nama: $("nama").value,
      nim: $("nim").value,
      username: $("username").value,
      email: $("email").value,
    };
  }

  // =========================================================
  // 8. VALIDASI FORM
  // =========================================================

  function validasiForm() {
    const nama = $("nama").value.trim();
    const email = $("email").value.trim();

    if (nama.length < 3 || nama.length > 150) {
      throw new Error("Nama lengkap harus terdiri dari 3-150 karakter.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Format email tidak valid.");
    }

    const passwordLama = $("password-current").value;
    const passwordBaru = $("password-new").value;
    const passwordConfirm = $("password-confirm").value;

    const inginGantiPassword = passwordLama || passwordBaru || passwordConfirm;

    if (inginGantiPassword) {
      if (!passwordLama || !passwordBaru || !passwordConfirm) {
        throw new Error("Lengkapi seluruh kolom penggantian kata sandi.");
      }

      if (
        passwordBaru.length < 8 ||
        !/[A-Z]/.test(passwordBaru) ||
        !/[a-z]/.test(passwordBaru) ||
        !/[0-9]/.test(passwordBaru)
      ) {
        throw new Error(
          "Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.",
        );
      }

      if (passwordBaru !== passwordConfirm) {
        throw new Error("Konfirmasi kata sandi baru tidak sesuai.");
      }
    }

    return true;
  }

  // =========================================================
  // 9. MENYIMPAN PERUBAHAN KE DATABASE
  // =========================================================

  async function handleSubmit(event) {
    event.preventDefault();

    if (sedangMenyimpan) return;

    try {
      validasiForm();
    } catch (error) {
      tampilkanNotifikasi(error.message, "error", "Periksa Kembali Data");
      return;
    }

    const yakin = window.confirm(
      "Apakah Anda yakin ingin menyimpan perubahan profil?",
    );

    if (!yakin) return;

    const formData = new FormData();

    formData.append("nama", $("nama").value.trim());
    formData.append("email", $("email").value.trim().toLowerCase());

    formData.append("password-current", $("password-current").value);

    formData.append("password-new", $("password-new").value);

    formData.append("password-confirm", $("password-confirm").value);

    if (fotoSementara) {
      formData.append("foto_profil", fotoSementara, fotoSementara.name);
    }

    const submitButton = document.querySelector(
      '.profile-form button[type="submit"]',
    );

    const originalButtonText = submitButton?.textContent;

    sedangMenyimpan = true;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Menyimpan...";
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        body: formData,
      });

      const result = await response.json();

      if (response.status === 401) {
        window.location.replace(
          new URL("../../../auth/Login.html", location.href).href,
        );
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal menyimpan perubahan profil.");
      }

      const profile = result.data;

      // Memperbarui data halaman profil.
      tampilkanProfil(profile);

      // Memperbarui profil di seluruh halaman.
      window.dispatchEvent(
        new CustomEvent("sipfas:profile-updated", {
          detail: { profile },
        }),
      );

      // Mengosongkan seluruh kolom password.
      $("password-current").value = "";
      $("password-new").value = "";
      $("password-confirm").value = "";

      // Menghapus foto sementara.
      fotoSementara = null;

      if (objectUrlSementara) {
        URL.revokeObjectURL(objectUrlSementara);
        objectUrlSementara = null;
      }

      $("photoUpload").value = "";

      simpanSnapshot();

      aturPasswordDefault();

      tampilkanNotifikasi(
        result.message || "Perubahan profil berhasil disimpan.",
        "success",
        "Profil Berhasil Diperbarui",
      );
    } catch (error) {
      console.error("SIPFAS SAVE PROFILE:", error);

      tampilkanNotifikasi(error.message, "error", "Gagal Menyimpan Profil");
    } finally {
      sedangMenyimpan = false;

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText || "Simpan Perubahan";
      }
    }
  }

  // =========================================================
  // 10. TOMBOL BATAL
  // =========================================================

  function aturTombolBatal() {
    const button = $("cancelProfileButton");

    if (!button) return;

    button.addEventListener("click", function (event) {
      event.preventDefault();

      if (!profilAwal) return;

      const yakin = window.confirm(
        "Batalkan seluruh perubahan profil yang belum disimpan?",
      );

      if (!yakin) return;

      batalkanPerubahan();
    });
  }

  function batalkanPerubahan() {
    $("nama").value = profilAwal.nama;
    $("nim").value = profilAwal.nim;
    $("username").value = profilAwal.username;
    $("email").value = profilAwal.email;

    $("password-current").value = "";
    $("password-new").value = "";
    $("password-confirm").value = "";

    $("photoUpload").value = "";

    fotoSementara = null;

    if (objectUrlSementara) {
      URL.revokeObjectURL(objectUrlSementara);
      objectUrlSementara = null;
    }

    // Mengambil foto terakhir dari database.
    loadProfile();

    aturPasswordDefault();

    tampilkanNotifikasi(
      "Perubahan yang belum disimpan berhasil dibatalkan.",
      "info",
      "Perubahan Dibatalkan",
    );
  }

  function aturPasswordDefault() {
    document.querySelectorAll(".password-toggle").forEach((button) => {
      const input = button.closest(".input-wrapper")?.querySelector("input");

      if (input) {
        input.type = "password";
      }

      button.setAttribute("aria-label", "Tampilkan kata sandi");
      button.setAttribute("aria-pressed", "false");
    });
  }

  // =========================================================
  // 11. NOTIFIKASI PROFIL
  // =========================================================

  function tampilkanNotifikasi(pesan, jenis, judul) {
    const toast = $("profileToast");

    if (!toast) {
      alert(pesan);
      return;
    }

    const title = toast.querySelector(".toast-content strong");
    const message = toast.querySelector(".toast-content p");
    const icon = toast.querySelector(".toast-icon");

    if (!title || !message || !icon) {
      alert(pesan);
      return;
    }

    clearTimeout(window.sipfasProfileToastTimer);

    title.textContent = judul || "Informasi Profil";
    message.textContent = pesan;

    if (jenis === "error") {
      icon.textContent = "!";
      icon.style.background = "#fff0f0";
      icon.style.color = "#dc3545";
      toast.style.borderLeftColor = "#dc3545";
    } else if (jenis === "info") {
      icon.textContent = "i";
      icon.style.background = "#edf2ff";
      icon.style.color = "#2864f0";
      toast.style.borderLeftColor = "#2864f0";
    } else {
      icon.textContent = "✓";
      icon.style.background = "#e5f7ef";
      icon.style.color = "#08a66a";
      toast.style.borderLeftColor = "#08a66a";
    }

    toast.classList.remove("show");

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    window.sipfasProfileToastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3500);
  }
})();
