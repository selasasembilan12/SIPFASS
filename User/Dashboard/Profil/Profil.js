/* ============================================================
   SIPFAS - PROFIL.JS
   Menghubungkan halaman profil dengan akun registrasi,
   login, foto profil, dan seluruh halaman pengguna.
============================================================ */

// 01. Menjalankan program setelah halaman selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  mulaiProfil();
});

// 02. Konfigurasi penyimpanan akun SIPFAS.
const KUNCI_PROFIL = "sipfasProfile";
const KUNCI_USERS = "sipfasUsers";
const KUNCI_ACTIVE = "sipfasActiveUser";
const KUNCI_FOTO = "sipfasProfilePhoto";

// 03. Variabel foto profil dan notifikasi.
let fotoProfilSementara = null;
let fotoProfilAwal = null;
let snapshotProfilForm = [];
let notifikasiTimer = null;

// ============================================================
// 04. MENGAMBIL AKUN YANG SEDANG LOGIN
// ============================================================

function ambilAkunAktif() {
  try {
    const data = sessionStorage.getItem(KUNCI_ACTIVE);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Gagal membaca sesi:", error);
    return null;
  }
}

// ============================================================
// 05. MENGAMBIL SELURUH AKUN TERDAFTAR
// ============================================================

function ambilSemuaAkun() {
  try {
    const data = localStorage.getItem(KUNCI_USERS);

    if (!data) return [];

    const users = JSON.parse(data);

    if (!Array.isArray(users)) {
      throw new Error("Format akun tidak valid.");
    }

    return users;
  } catch (error) {
    console.error("Gagal membaca akun:", error);
    return [];
  }
}

// ============================================================
// 06. MEMBUAT KUNCI FOTO KHUSUS SETIAP PENGGUNA
// ============================================================

function buatKunciFoto() {
  const aktif = ambilAkunAktif();

  if (!aktif) return KUNCI_FOTO;

  const identitas =
    aktif.id || aktif.username || aktif.email || aktif.nim || "pengguna";

  return KUNCI_FOTO + "_" + String(identitas).toLowerCase();
}

// ============================================================
// 07. MENCARI AKUN BERDASARKAN IDENTITAS LOGIN
// ============================================================

function cariAkunAktif() {
  const aktif = ambilAkunAktif();
  const users = ambilSemuaAkun();

  if (!aktif) {
    return {
      aktif: null,
      users: users,
      index: -1,
      akun: null,
    };
  }

  let index = -1;

  // Mencari berdasarkan ID akun.
  if (aktif.id) {
    index = users.findIndex(function (user) {
      return String(user.id) === String(aktif.id);
    });
  }

  // Alternatif berdasarkan username.
  if (index === -1 && aktif.username) {
    index = users.findIndex(function (user) {
      return (
        String(user.username || "").toLowerCase() ===
        String(aktif.username).toLowerCase()
      );
    });
  }

  // Alternatif berdasarkan email.
  if (index === -1 && aktif.email) {
    index = users.findIndex(function (user) {
      return (
        String(user.email || "").toLowerCase() ===
        String(aktif.email).toLowerCase()
      );
    });
  }

  return {
    aktif: aktif,
    users: users,
    index: index,
    akun: index >= 0 ? users[index] : null,
  };
}

// ============================================================
// 08. MENGAMBIL IDENTITAS AKUN YANG SEDANG AKTIF
// ============================================================

function ambilProfil() {
  const konteks = cariAkunAktif();

  if (konteks.akun) {
    const akun = konteks.akun;

    return {
      id: akun.id || "",
      name: akun.name || akun.fullName || akun.nama || "",
      nim: akun.nim || "",
      username: akun.username || "",
      email: akun.email || "",
      role: akun.role || "pelapor",
    };
  }

  if (konteks.aktif) {
    return {
      id: konteks.aktif.id || "",
      name: konteks.aktif.name || "",
      nim: konteks.aktif.nim || "",
      username: konteks.aktif.username || "",
      email: konteks.aktif.email || "",
      role: konteks.aktif.role || "pelapor",
    };
  }

  return {
    id: "",
    name: "",
    nim: "",
    username: "",
    email: "",
    role: "",
  };
}

// ============================================================
// 09. MEMVALIDASI FORMAT EMAIL
// Email wajib menggunakan domain Gmail.
// ============================================================

function validasiFormatEmail(email) {
  const polaEmail = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

  if (!polaEmail.test(email)) {
    return false;
  }

  const namaPengguna = email.split("@")[0];

  if (!namaPengguna) {
    return false;
  }

  if (namaPengguna.startsWith(".") || namaPengguna.endsWith(".")) {
    return false;
  }

  if (namaPengguna.includes("..")) {
    return false;
  }

  return true;
}

// ============================================================
// 10. MEMVALIDASI KETENTUAN KATA SANDI
// ============================================================

function validasiPassword(password) {
  const polaPassword = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{8,}$/;

  return polaPassword.test(password);
}

// ============================================================
// 11. MENGINISIALISASI HALAMAN PROFIL
// ============================================================

function mulaiProfil() {
  const formulir = document.querySelector(".profile-form");

  if (!formulir) {
    console.error("Formulir profil tidak ditemukan.");
    return;
  }

  const aktif = ambilAkunAktif();

  // Memastikan pengguna sudah login.
  if (!aktif) {
    alert("Sesi pengguna tidak ditemukan. Silakan login kembali.");
    window.location.href = "../../../auth/Login.html";
    return;
  }

  // Menampilkan identitas akun.
  const profilPengguna = ambilProfil();

  tampilkanProfil(profilPengguna);

  // Memuat foto terbaru.
  muatFotoProfil();

  // Mengaktifkan fitur upload foto.
  aturUploadFoto();

  // Menyimpan identitas awal agar dapat dibaca halaman lain.
  if (profilPengguna.name) {
    localStorage.setItem(KUNCI_PROFIL, JSON.stringify(profilPengguna));
  }

  // Mengaktifkan tombol password.
  aturTombolPassword();

  // Menyimpan kondisi awal seluruh komponen profil.
  simpanSnapshotProfil();

  // Mengaktifkan tombol Batal.
  aturTombolBatal();

  // Menyimpan perubahan profil setelah konfirmasi.
  formulir.addEventListener("submit", function (event) {
    event.preventDefault();

    const yakin = window.confirm(
      "Apakah Anda yakin ingin menyimpan perubahan profil?\n\n" +
        "Klik OK untuk melanjutkan atau Batal untuk kembali.",
    );

    if (!yakin) {
      return;
    }

    simpanPerubahanProfil();
  });

  // Memperbarui tampilan jika data berubah dari tab lain.
  window.addEventListener("storage", function (event) {
    let perluPerbaruiSnapshot = false;

    if (event.key === KUNCI_USERS || event.key === KUNCI_ACTIVE) {
      tampilkanProfil(ambilProfil());
      muatFotoProfil();

      perluPerbaruiSnapshot = true;
    }

    if (event.key === KUNCI_PROFIL) {
      tampilkanProfil(ambilProfil());

      perluPerbaruiSnapshot = true;
    }

    if (event.key === buatKunciFoto()) {
      muatFotoProfil();

      perluPerbaruiSnapshot = true;
    }

    // Kondisi terbaru dari tab lain menjadi kondisi awal baru.
    if (perluPerbaruiSnapshot) {
      simpanSnapshotProfil();
    }
  });
}

// ============================================================
// 12. MENAMPILKAN IDENTITAS PENGGUNA
// ============================================================

function tampilkanProfil(profil) {
  const nama = document.getElementById("nama");
  const nim = document.getElementById("nim");
  const username = document.getElementById("username");
  const email = document.getElementById("email");

  const namaIdentitas = document.querySelector(".identity-information h2");

  // Mengambil elemen NIM pada bagian identitas atas.
  const nimIdentitas = document.getElementById("identityNim");

  const namaHeader = document.querySelectorAll(".header-name");

  if (nama) nama.value = profil.name || "";
  if (nim) nim.value = profil.nim || "";
  if (username) username.value = profil.username || "";
  if (email) email.value = profil.email || "";

  if (namaIdentitas) {
    namaIdentitas.textContent = profil.name || "Pengguna";
  }

  // Menyamakan NIM atas dengan NIM pada input bawah.
  if (nimIdentitas) {
    nimIdentitas.textContent = "NIM: " + (profil.nim || "-");
  }

  namaHeader.forEach(function (elemen) {
    elemen.textContent = profil.name || "Pengguna";
  });
}

// ============================================================
// 12A. MENYIMPAN KONDISI AWAL SELURUH KOMPONEN PROFIL
// ============================================================

function simpanSnapshotProfil() {
  const formulir = document.querySelector(".profile-form");

  if (!formulir) return;

  const seluruhInput = formulir.querySelectorAll("input, select, textarea");

  snapshotProfilForm = Array.from(seluruhInput).map(function (elemen) {
    return {
      type: elemen.type || "",
      value:
        elemen.type === "password" || elemen.type === "file"
          ? ""
          : elemen.value,

      checked: elemen.checked || false,
    };
  });

  // Menyimpan foto profil terakhir yang sudah tersimpan.
  try {
    fotoProfilAwal = localStorage.getItem(buatKunciFoto()) || null;
  } catch (error) {
    console.error("Gagal mengambil snapshot foto:", error);
    fotoProfilAwal = null;
  }
}

// ============================================================
// 12B. MENGAKTIFKAN TOMBOL BATAL
// ============================================================

function aturTombolBatal() {
  // Mengambil tombol Batal yang sudah tersedia pada HTML.
  const tombolBatal = document.querySelector(".profile-form .cancel-button");

  if (!tombolBatal) {
    console.error("Tombol Batal tidak ditemukan.");
    return;
  }

  tombolBatal.addEventListener("click", function (event) {
    // Mencegah browser berpindah ke Dashboard.
    event.preventDefault();

    // Mengembalikan seluruh perubahan.
    batalkanPerubahanProfil();
  });
}

// ============================================================
// 12C. MEMBATALKAN SELURUH PERUBAHAN PROFIL
// ============================================================

function batalkanPerubahanProfil() {
  const formulir = document.querySelector(".profile-form");

  if (!formulir) return;

  const seluruhInput = formulir.querySelectorAll("input, select, textarea");

  // 1. Mengembalikan seluruh komponen ke kondisi awal.
  seluruhInput.forEach(function (elemen, index) {
    // Mengosongkan semua kolom password.
    if (elemen.type === "password") {
      elemen.value = "";
      return;
    }

    // Mengosongkan input upload foto.
    if (elemen.type === "file") {
      elemen.value = "";
      return;
    }

    const dataAwal = snapshotProfilForm[index];

    if (!dataAwal) return;

    // Mengembalikan checkbox dan radio.
    if (elemen.type === "checkbox" || elemen.type === "radio") {
      elemen.checked = dataAwal.checked;
    } else {
      // Mengembalikan nilai input lainnya.
      elemen.value = dataAwal.value;
    }
  });

  // 2. Mengembalikan nama dan identitas dari data tersimpan.
  tampilkanProfil(ambilProfil());

  // 3. Mengembalikan seluruh tombol password ke kondisi tersembunyi.
  document.querySelectorAll(".password-toggle").forEach(function (tombol) {
    const input = tombol.closest(".input-wrapper")?.querySelector("input");

    if (input) {
      input.type = "password";
    }

    tombol.setAttribute("aria-label", "Tampilkan kata sandi");

    tombol.setAttribute("aria-pressed", "false");
  });

  // 4. Membatalkan foto baru yang belum disimpan.
  fotoProfilSementara = null;

  // 5. Membersihkan input upload foto.
  const inputFoto = document.getElementById("photoUpload");

  if (inputFoto) {
    inputFoto.value = "";
  }

  // 6. Mengembalikan foto profil sebelumnya.
  if (fotoProfilAwal) {
    tampilkanFoto(fotoProfilAwal);
  } else {
    tampilkanFotoDefault();
  }

  // 7. Menampilkan notifikasi pembatalan.
  tampilkanNotifikasi(
    "Seluruh perubahan dibatalkan. Data profil telah dikembalikan seperti sebelumnya.",
    "info",
    "Perubahan Dibatalkan",
  );

  console.log("===== PEMBATALAN PERUBAHAN PROFIL =====");
  console.log("Seluruh input dikembalikan.");
  console.log("Foto profil dikembalikan.");
  console.log("Data akun tidak mengalami perubahan.");
  console.log("=======================================");
}

// ============================================================
// 13. FITUR UPLOAD FOTO PROFIL
// ============================================================

// Mengaktifkan tombol upload foto.
function aturUploadFoto() {
  const tombolEdit = document.getElementById("editPhotoButton");
  const inputFoto = document.getElementById("photoUpload");

  if (!tombolEdit || !inputFoto) return;

  // Membuka File Explorer melalui pemilih file bawaan browser.
  tombolEdit.addEventListener("click", function () {
    inputFoto.click();
  });

  inputFoto.addEventListener("change", function (event) {
    prosesUploadFoto(event);
  });
}

// Memproses gambar yang diunggah.
function prosesUploadFoto(event) {
  const file = event.target.files[0];

  if (!file) return;

  const formatDiizinkan = ["image/jpeg", "image/png", "image/webp"];

  if (!formatDiizinkan.includes(file.type)) {
    alert("Format foto harus JPG, PNG, atau WEBP.");
    event.target.value = "";
    return;
  }

  // Maksimal ukuran gambar 5 MB.
  if (file.size > 5 * 1024 * 1024) {
    alert("Ukuran foto maksimal 5 MB.");
    event.target.value = "";
    return;
  }

  const pembaca = new FileReader();

  pembaca.onload = function (hasil) {
    const gambar = new Image();

    gambar.onload = function () {
      fotoProfilSementara = hasil.target.result;

      tampilkanFoto(fotoProfilSementara);

      tampilkanNotifikasi(
        "Foto berhasil dipilih. Klik Simpan Perubahan untuk menyimpan.",
        "info",
      );
    };

    gambar.onerror = function () {
      alert("Gambar tidak dapat dibaca. Silakan pilih gambar lain.");
    };

    gambar.src = hasil.target.result;
  };

  pembaca.onerror = function () {
    alert("Gagal membaca file gambar.");
  };

  pembaca.readAsDataURL(file);

  event.target.value = "";
}

// Menampilkan foto pada halaman profil dan header.
function tampilkanFoto(sumberFoto) {
  const fotoProfil = document.getElementById("profilePhotoImage");
  const placeholder = document.getElementById("photoPlaceholder");

  const fotoHeader = document.getElementById("headerProfileImage");
  const avatarDefault = document.getElementById("headerDefaultAvatar");

  if (fotoProfil) {
    fotoProfil.src = sumberFoto;
    fotoProfil.hidden = false;
  }

  if (placeholder) {
    placeholder.hidden = true;
  }

  if (fotoHeader) {
    fotoHeader.src = sumberFoto;
    fotoHeader.hidden = false;
  }

  if (avatarDefault) {
    avatarDefault.hidden = true;
  }
}

// Mengembalikan foto ke avatar default.
function tampilkanFotoDefault() {
  const fotoProfil = document.getElementById("profilePhotoImage");
  const placeholder = document.getElementById("photoPlaceholder");

  const fotoHeader = document.getElementById("headerProfileImage");
  const avatarDefault = document.getElementById("headerDefaultAvatar");

  if (fotoProfil) {
    fotoProfil.removeAttribute("src");
    fotoProfil.hidden = true;
  }

  if (placeholder) {
    placeholder.hidden = false;
  }

  if (fotoHeader) {
    fotoHeader.removeAttribute("src");
    fotoHeader.hidden = true;
  }

  if (avatarDefault) {
    avatarDefault.hidden = false;
  }
}

// Memuat foto yang sudah disimpan sebelumnya.
function muatFotoProfil() {
  try {
    const foto = localStorage.getItem(buatKunciFoto());

    if (foto) {
      fotoProfilSementara = null;
      tampilkanFoto(foto);
    } else {
      fotoProfilSementara = null;
      tampilkanFotoDefault();
    }
  } catch (error) {
    console.error("Gagal memuat foto profil:", error);
  }
}

// Menyimpan foto profil ke LocalStorage.
function simpanFotoProfil() {
  if (!fotoProfilSementara) {
    return true;
  }

  try {
    localStorage.setItem(buatKunciFoto(), fotoProfilSementara);

    fotoProfilSementara = null;

    return true;
  } catch (error) {
    console.error("Gagal menyimpan foto:", error);

    return false;
  }
}

// ============================================================
// 14. TOMBOL TAMPIL / SEMBUNYIKAN PASSWORD
// ============================================================

function aturTombolPassword() {
  document.querySelectorAll(".password-toggle").forEach(function (tombol) {
    const input = tombol.closest(".input-wrapper")?.querySelector("input");

    if (!input) return;

    tombol.addEventListener("click", function () {
      const tersembunyi = input.type === "password";

      input.type = tersembunyi ? "text" : "password";

      tombol.setAttribute(
        "aria-label",
        tersembunyi ? "Sembunyikan kata sandi" : "Tampilkan kata sandi",
      );

      tombol.setAttribute("aria-pressed", String(tersembunyi));
    });
  });
}

// ============================================================
// 15. MENYIMPAN AKUN TERBARU
// ============================================================

function simpanAkunTerbaru(akunTerbaru, users, index) {
  try {
    users[index] = {
      ...users[index],
      ...akunTerbaru,
    };

    // Membuat identitas terbaru tanpa password.
    const identitas = {
      id: akunTerbaru.id || "",
      name: akunTerbaru.name || "",
      nim: akunTerbaru.nim || "",
      username: akunTerbaru.username || "",
      email: akunTerbaru.email || "",
      role: akunTerbaru.role || "pelapor",
    };

    localStorage.setItem(KUNCI_USERS, JSON.stringify(users));

    localStorage.setItem(KUNCI_PROFIL, JSON.stringify(identitas));

    sessionStorage.setItem(KUNCI_ACTIVE, JSON.stringify(identitas));

    return true;
  } catch (error) {
    console.error("Gagal menyimpan akun:", error);

    return false;
  }
}

// ============================================================
// 16. MEMPROSES PERUBAHAN PROFIL
// ============================================================

function simpanPerubahanProfil() {
  const nama = document.getElementById("nama");
  const email = document.getElementById("email");

  const passwordLama = document.getElementById("password-current");
  const passwordBaru = document.getElementById("password-new");
  const konfirmasiPassword = document.getElementById("password-confirm");

  if (!nama || !email) return;

  const namaBaru = nama.value.trim();
  const emailBaru = email.value.trim().toLowerCase();

  // Validasi nama.
  if (!namaBaru || namaBaru.length < 3) {
    alert("Nama lengkap minimal 3 karakter.");

    nama.focus();

    return;
  }

  // Validasi email wajib Gmail.
  if (!emailBaru) {
    alert("Email wajib diisi.");

    email.focus();

    return;
  }

  if (!validasiFormatEmail(emailBaru)) {
    alert(
      "Format email tidak valid!\n\n" +
        "Email wajib menggunakan format @gmail.com.\n" +
        "Contoh: nama@gmail.com",
    );

    email.focus();

    return;
  }

  // Mengambil akun aktif.
  const konteks = cariAkunAktif();

  if (!konteks.aktif || !konteks.akun || konteks.index === -1) {
    alert("Akun aktif tidak ditemukan. Silakan login kembali.");

    return;
  }

  // Memeriksa duplikasi email.
  const emailDipakai = konteks.users.some(function (user, index) {
    return (
      index !== konteks.index &&
      String(user.email || "").toLowerCase() === emailBaru
    );
  });

  if (emailDipakai) {
    alert("Email tersebut sudah digunakan akun lain.");

    email.focus();

    return;
  }

  // Memeriksa permintaan penggantian password.
  const inginGantiPassword =
    (passwordLama?.value || "") !== "" ||
    (passwordBaru?.value || "") !== "" ||
    (konfirmasiPassword?.value || "") !== "";

  let passwordTerbaru = konteks.akun.password;

  if (inginGantiPassword) {
    if (!passwordLama || !passwordBaru || !konfirmasiPassword) {
      alert("Kolom penggantian kata sandi tidak lengkap.");

      return;
    }

    // Memastikan password lama diisi.
    if (!passwordLama.value) {
      alert("Kata sandi saat ini wajib diisi.");

      passwordLama.focus();

      return;
    }

    // Memastikan password lama sesuai.
    if (passwordLama.value !== String(konteks.akun.password || "")) {
      alert("Kata sandi saat ini tidak sesuai.");

      passwordLama.focus();

      return;
    }

    // Memastikan password baru tidak kosong.
    if (!passwordBaru.value) {
      alert("Kata sandi baru wajib diisi.");

      passwordBaru.focus();

      return;
    }

    // Validasi password baru.
    if (!validasiPassword(passwordBaru.value)) {
      alert(
        "Kata sandi minimal 8 karakter dan wajib mengandung:\n\n" +
          "- Huruf besar (A-Z)\n" +
          "- Huruf kecil (a-z)\n" +
          "- Angka (0-9)",
      );

      passwordBaru.focus();

      return;
    }

    // Memeriksa konfirmasi password.
    if (!konfirmasiPassword.value) {
      alert("Konfirmasi kata sandi wajib diisi.");

      konfirmasiPassword.focus();

      return;
    }

    if (passwordBaru.value !== konfirmasiPassword.value) {
      alert("Konfirmasi kata sandi tidak sesuai.");

      konfirmasiPassword.focus();

      return;
    }

    // Tidak mengizinkan penggunaan password lama kembali.
    if (passwordBaru.value === passwordLama.value) {
      alert("Kata sandi baru harus berbeda dari kata sandi saat ini.");

      passwordBaru.focus();

      return;
    }

    passwordTerbaru = passwordBaru.value;
  }

  // Menyiapkan data akun terbaru.
  const akunTerbaru = {
    ...konteks.akun,

    name: namaBaru,
    email: emailBaru,
    password: passwordTerbaru,
  };

  // Menjaga konsistensi apabila akun menggunakan fullName.
  if ("fullName" in konteks.akun) {
    akunTerbaru.fullName = namaBaru;
  }

  if ("nama" in konteks.akun) {
    akunTerbaru.nama = namaBaru;
  }

  // Menyimpan perubahan akun.
  const berhasil = simpanAkunTerbaru(akunTerbaru, konteks.users, konteks.index);

  if (!berhasil) {
    tampilkanNotifikasi(
      "Perubahan profil gagal disimpan.",
      "error",
      "Gagal Menyimpan",
    );

    return;
  }

  // Menyimpan foto apabila ada foto baru.
  const berhasilSimpanFoto = simpanFotoProfil();

  if (!berhasilSimpanFoto) {
    // Profil sudah tersimpan, tetapi foto gagal.
    tampilkanProfil(ambilProfil());

    muatFotoProfil();

    simpanSnapshotProfil();

    tampilkanNotifikasi(
      "Data profil tersimpan, tetapi foto gagal disimpan. Coba unggah foto yang lebih kecil.",
      "error",
      "Sebagian Perubahan Gagal",
    );

    return;
  }

  // Memperbarui tampilan profil.
  tampilkanProfil(ambilProfil());

  // Memuat foto terbaru.
  muatFotoProfil();

  // Sinkronisasi foto dan identitas secara langsung.
  window.dispatchEvent(
    new CustomEvent("sipfas:profile-updated", {
      detail: {
        profile: ambilProfil(),

        photo: localStorage.getItem(buatKunciFoto()),
      },
    }),
  );

  // Mengosongkan kolom password.
  if (passwordLama) passwordLama.value = "";

  if (passwordBaru) passwordBaru.value = "";

  if (konfirmasiPassword) konfirmasiPassword.value = "";

  // Memperbarui kondisi awal setelah berhasil menyimpan.
  // Pembatalan berikutnya akan kembali ke data terbaru ini.
  simpanSnapshotProfil();

  // Notifikasi keberhasilan.
  if (inginGantiPassword) {
    tampilkanNotifikasi(
      "Profil dan kata sandi berhasil diperbarui!",
      "success",
      "Kata Sandi Berhasil Diperbarui",
    );
  } else {
    tampilkanNotifikasi(
      "Nama dan informasi akun berhasil diperbarui!",
      "success",
      "Profil Berhasil Diubah",
    );
  }

  console.log("===== PROFIL SIPFAS DIPERBARUI =====");

  console.log("Nama:", namaBaru);

  console.log("Email:", emailBaru);

  console.log("Sinkronisasi akun berhasil.");

  console.log("====================================");
}

// ============================================================
// 17. NOTIFIKASI PROFIL
// ============================================================

function tampilkanNotifikasi(pesan, jenis, judulKustom) {
  const notifikasi = document.getElementById("profileToast");

  if (!notifikasi) {
    alert(pesan);

    return;
  }

  const judul = notifikasi.querySelector(".toast-content strong");

  const keterangan = notifikasi.querySelector(".toast-content p");

  const ikon = notifikasi.querySelector(".toast-icon");

  if (!judul || !keterangan || !ikon) {
    alert(pesan);

    return;
  }

  clearTimeout(notifikasiTimer);

  if (jenis === "error") {
    judul.textContent = judulKustom || "Terjadi Kesalahan";

    ikon.style.background = "#fff0f0";

    ikon.style.color = "#dc3545";

    ikon.innerHTML = "!";

    notifikasi.style.borderLeftColor = "#dc3545";
  } else if (jenis === "info") {
    judul.textContent = judulKustom || "Foto Berhasil Dipilih";

    ikon.style.background = "#edf2ff";

    ikon.style.color = "#2864f0";

    ikon.innerHTML = "i";

    notifikasi.style.borderLeftColor = "#2864f0";
  } else {
    judul.textContent = judulKustom || "Profil Berhasil Diubah";

    ikon.style.background = "#e5f7ef";

    ikon.style.color = "#08a66a";

    ikon.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="m5 12 5 5L20 7"></path>
      </svg>
    `;

    notifikasi.style.borderLeftColor = "#08a66a";
  }

  keterangan.textContent = pesan;

  // Memulai animasi notifikasi.
  notifikasi.classList.remove("show");

  requestAnimationFrame(function () {
    notifikasi.classList.add("show");
  });

  // Menghilangkan notifikasi setelah 3,5 detik.
  notifikasiTimer = setTimeout(function () {
    notifikasi.classList.remove("show");
  }, 3500);
}
