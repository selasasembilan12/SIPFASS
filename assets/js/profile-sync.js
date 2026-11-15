/* ============================================================
   SIPFAS - SINKRONISASI IDENTITAS DAN FOTO PROFIL USER

   Fungsi:
   1. Menampilkan nama pengguna pada seluruh halaman User.
   2. Menampilkan foto profil pada seluruh halaman User.
   3. Mengambil data dari akun yang sedang login.
   4. Membaca perubahan profil terbaru dari LocalStorage.
   5. Memperbarui identitas setelah profil berhasil diubah.
============================================================ */

(function () {
  "use strict";

  // 01. KONFIGURASI PENYIMPANAN SIPFAS.
  const KUNCI_ACTIVE = "sipfasActiveUser";
  const KUNCI_USERS = "sipfasUsers";
  const KUNCI_PROFIL = "sipfasProfile";
  const KUNCI_FOTO = "sipfasProfilePhoto";

  // 02. MENGAMBIL AKUN YANG SEDANG LOGIN.
  function ambilAkunAktif() {
    try {
      const data = sessionStorage.getItem(KUNCI_ACTIVE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Gagal membaca akun aktif:", error);
      return null;
    }
  }

  // 03. MENGAMBIL PROFIL TERBARU DARI LOCALSTORAGE.
  function ambilDataProfil() {
    try {
      const data = localStorage.getItem(KUNCI_PROFIL);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Gagal membaca profil:", error);
      return null;
    }
  }

  // 04. MENGAMBIL SELURUH AKUN TERDAFTAR.
  function ambilSemuaAkun() {
    try {
      const data = localStorage.getItem(KUNCI_USERS);
      const users = data ? JSON.parse(data) : [];

      return Array.isArray(users) ? users : [];
    } catch (error) {
      console.error("Gagal membaca daftar akun:", error);
      return [];
    }
  }

  // 05. MEMERIKSA KESESUAIAN IDENTITAS AKUN.
  function identitasSama(data1, data2) {
    if (!data1 || !data2) return false;

    if (data1.id && data2.id) {
      return String(data1.id) === String(data2.id);
    }

    const pasangan = ["username", "nim", "email"];

    for (const kunci of pasangan) {
      if (data1[kunci] && data2[kunci]) {
        return (
          String(data1[kunci]).toLowerCase() ===
          String(data2[kunci]).toLowerCase()
        );
      }
    }

    return false;
  }

  // 06. MENCARI AKUN YANG SEDANG LOGIN.
  function cariDataAkun() {
    const aktif = ambilAkunAktif();
    const users = ambilSemuaAkun();

    if (!aktif) return null;

    return (
      users.find(function (user) {
        return identitasSama(user, aktif);
      }) || null
    );
  }

  // 07. MENGGABUNGKAN IDENTITAS TERBARU.
  function ambilIdentitasPengguna() {
    const aktif = ambilAkunAktif();
    const profil = ambilDataProfil();
    const akun = cariDataAkun();

    if (!aktif && !profil) {
      return {
        name: "Pengguna",
        username: "",
        nim: "",
        email: "",
      };
    }

    // Memastikan profil tersimpan milik akun yang login.
    const profilSesuai = profil && (!aktif || identitasSama(profil, aktif));

    const dataProfil = profilSesuai ? profil : {};

    // Mengutamakan data profil yang paling baru.
    const nama =
      dataProfil.name ||
      dataProfil.fullName ||
      dataProfil.nama ||
      akun?.name ||
      akun?.fullName ||
      akun?.nama ||
      aktif?.name ||
      aktif?.fullName ||
      aktif?.nama ||
      "Pengguna";

    return {
      id: dataProfil.id || akun?.id || aktif?.id || "",
      name: nama,
      nim: dataProfil.nim || akun?.nim || aktif?.nim || "",
      username: dataProfil.username || akun?.username || aktif?.username || "",
      email: dataProfil.email || akun?.email || aktif?.email || "",
      role: dataProfil.role || akun?.role || aktif?.role || "pelapor",
    };
  }

  // 08. MEMPERBARUI NAMA PENGGUNA PADA HEADER.
  function perbaruiNamaHeader(profil) {
    const nama = profil?.name || "Pengguna";

    // Mendukung struktur header pada seluruh halaman User.
    const daftarNama = document.querySelectorAll(
      ".header-name, " +
        ".header-profile-name, " +
        '.header-profile > span[aria-live="polite"]',
    );

    daftarNama.forEach(function (elemen) {
      elemen.textContent = nama;
    });

    console.log("Nama profil berhasil disinkronkan:", nama);
  }

  // 09. MEMBUAT KUNCI FOTO KHUSUS SETIAP AKUN.
  function buatKunciFoto() {
    const akun = ambilAkunAktif();

    if (!akun) return KUNCI_FOTO;

    const identitas =
      akun.id || akun.username || akun.email || akun.nim || "pengguna";

    return KUNCI_FOTO + "_" + String(identitas).toLowerCase();
  }

  // 10. MENGAMBIL FOTO PROFIL.
  function ambilFotoProfil() {
    try {
      return localStorage.getItem(buatKunciFoto());
    } catch (error) {
      console.error("Gagal mengambil foto:", error);
      return null;
    }
  }

  // 11. MEMPERBARUI FOTO PROFIL PADA HEADER.
  function perbaruiAvatarHeader() {
    const foto = ambilFotoProfil();

    const daftarAvatar = document.querySelectorAll(
      ".header-avatar, .profile-avatar",
    );

    daftarAvatar.forEach(function (avatar) {
      let gambar = avatar.querySelector(".sipfas-header-photo");

      if (foto) {
        // Membuat elemen foto jika belum tersedia.
        if (!gambar) {
          gambar = document.createElement("img");
          gambar.className = "sipfas-header-photo";
          gambar.alt = "Foto Profil";
          avatar.appendChild(gambar);
        }

        gambar.src = foto;

        Object.assign(gambar.style, {
          display: "block",
          width: "100%",
          height: "100%",
          position: "absolute",
          inset: "0",
          objectFit: "cover",
          borderRadius: "50%",
          zIndex: "2",
        });

        // Menyembunyikan ikon avatar bawaan.
        const ikon = avatar.querySelector("svg");

        if (ikon) {
          ikon.style.display = "none";
        }

        avatar.style.position = "relative";
        avatar.style.overflow = "hidden";
      } else {
        // Mengembalikan ikon bawaan jika belum ada foto.
        if (gambar) {
          gambar.remove();
        }

        const ikon = avatar.querySelector("svg");

        if (ikon) {
          ikon.style.display = "";
        }
      }
    });
  }

  // 12. MEMPERBARUI SELURUH IDENTITAS PENGGUNA.
  function sinkronisasiProfil() {
    const profil = ambilIdentitasPengguna();

    perbaruiNamaHeader(profil);
    perbaruiAvatarHeader();
  }

  // 13. MENANGANI PERUBAHAN PROFIL DARI TAB LAIN.
  window.addEventListener("storage", function (event) {
    if (
      event.key === KUNCI_PROFIL ||
      event.key === KUNCI_USERS ||
      event.key === KUNCI_ACTIVE ||
      event.key === buatKunciFoto()
    ) {
      sinkronisasiProfil();
    }
  });

  // 14. MENANGANI PERUBAHAN PROFIL DARI HALAMAN YANG SAMA.
  window.addEventListener("sipfas:profile-updated", function (event) {
    if (event.detail?.profile) {
      perbaruiNamaHeader(event.detail.profile);
    } else {
      perbaruiNamaHeader(ambilIdentitasPengguna());
    }

    perbaruiAvatarHeader();
  });

  // 15. MENJALANKAN SINKRONISASI SAAT HALAMAN DIBUKA.
  function mulaiSinkronisasi() {
    sinkronisasiProfil();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mulaiSinkronisasi);
  } else {
    mulaiSinkronisasi();
  }
})();
