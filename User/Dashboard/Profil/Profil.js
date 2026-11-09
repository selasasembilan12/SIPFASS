/* ============================================================
   SIPFAS - PROFIL.JS
   Menghubungkan halaman profil dengan akun registrasi,
   login, dan seluruh halaman pengguna.
============================================================ */

// 01. Menjalankan program setelah halaman selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  mulaiProfil();
});

// 02. Konfigurasi penyimpanan akun SIPFAS.
const KUNCI_PROFIL = "sipfasProfile";
const KUNCI_USERS = "sipfasUsers";
const KUNCI_ACTIVE = "sipfasActiveUser";

// 03. Mengambil akun yang sedang login.
function ambilAkunAktif() {
  try {
    const data = sessionStorage.getItem(KUNCI_ACTIVE);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Gagal membaca sesi:", error);
    return null;
  }
}

// 04. Mengambil seluruh akun terdaftar.
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

// 05. Mencari akun berdasarkan identitas login.
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

// 06. Mengambil identitas akun yang sedang aktif.
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

  // Menggunakan sesi aktif apabila data akun lama
  // belum ditemukan dalam daftar registrasi.
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

  // Tidak menggunakan identitas bawaan palsu.
  return {
    id: "",
    name: "",
    nim: "",
    username: "",
    email: "",
    role: "",
  };
}

// 07. Menginisialisasi halaman profil.
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
  tampilkanProfil(ambilProfil());

  // Mengaktifkan tombol password.
  aturTombolPassword();

  // Menyimpan perubahan profil.
  formulir.addEventListener("submit", function (event) {
    event.preventDefault();
    simpanPerubahanProfil();
  });

  // Memperbarui tampilan jika identitas berubah dari tab lain.
  window.addEventListener("storage", function (event) {
    if (event.key === KUNCI_PROFIL) {
      tampilkanProfil(ambilProfil());
    }
  });
}

// 08. Menampilkan identitas pengguna.
function tampilkanProfil(profil) {
  const nama = document.getElementById("nama");
  const nim = document.getElementById("nim");
  const username = document.getElementById("username");
  const email = document.getElementById("email");

  const namaIdentitas = document.querySelector(".identity-information h2");

  const namaHeader = document.querySelectorAll(".header-name");

  if (nama) nama.value = profil.name || "";
  if (nim) nim.value = profil.nim || "";
  if (username) username.value = profil.username || "";
  if (email) email.value = profil.email || "";

  if (namaIdentitas) {
    namaIdentitas.textContent = profil.name || "Pengguna";
  }

  namaHeader.forEach(function (elemen) {
    elemen.textContent = profil.name || "Pengguna";
  });
}

// 09. Mengaktifkan tombol tampil/sembunyikan password.
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

// 10. Menyimpan perubahan akun ke seluruh penyimpanan.
function simpanAkunTerbaru(akunTerbaru, users, index) {
  try {
    // Memperbarui akun yang sesuai.
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

    // Menyimpan daftar akun.
    localStorage.setItem(KUNCI_USERS, JSON.stringify(users));

    // Menyimpan profil terbaru.
    localStorage.setItem(KUNCI_PROFIL, JSON.stringify(identitas));

    // Memperbarui sesi akun aktif.
    sessionStorage.setItem(KUNCI_ACTIVE, JSON.stringify(identitas));

    return true;
  } catch (error) {
    console.error("Gagal menyimpan akun:", error);
    return false;
  }
}

// 11. Memproses perubahan profil.
function simpanPerubahanProfil() {
  const nama = document.getElementById("nama");
  const email = document.getElementById("email");

  const passwordLama = document.getElementById("password-current");
  const passwordBaru = document.getElementById("password-new");
  const konfirmasiPassword = document.getElementById("password-confirm");

  if (!nama || !email) return;

  const namaBaru = nama.value.trim();
  const emailBaru = email.value.trim().toLowerCase();

  // Memvalidasi nama.
  if (!namaBaru || namaBaru.length < 3) {
    alert("Nama lengkap minimal 3 karakter.");
    nama.focus();
    return;
  }

  // Memvalidasi email.
  if (!emailBaru || !email.checkValidity()) {
    alert("Masukkan alamat email yang benar.");
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
    passwordLama.value !== "" ||
    passwordBaru.value !== "" ||
    konfirmasiPassword.value !== "";

  let passwordTerbaru = konteks.akun.password;

  if (inginGantiPassword) {
    // Memastikan password lama sesuai.
    if (passwordLama.value !== String(konteks.akun.password || "")) {
      alert("Kata sandi saat ini tidak sesuai.");
      passwordLama.focus();
      return;
    }

    // Memvalidasi password baru.
    const polaPassword = /^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$/;

    if (!polaPassword.test(passwordBaru.value)) {
      alert(
        "Kata sandi minimal 8 karakter dan harus mengandung huruf serta angka.",
      );
      passwordBaru.focus();
      return;
    }

    // Memeriksa konfirmasi password.
    if (passwordBaru.value !== konfirmasiPassword.value) {
      alert("Konfirmasi kata sandi tidak sesuai.");
      konfirmasiPassword.focus();
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

  // Menyimpan seluruh perubahan.
  const berhasil = simpanAkunTerbaru(akunTerbaru, konteks.users, konteks.index);

  if (!berhasil) {
    alert("Perubahan profil gagal disimpan.");
    return;
  }

  // Memperbarui tampilan.
  tampilkanProfil(ambilProfil());

  // Mengosongkan kolom password.
  if (passwordLama) passwordLama.value = "";
  if (passwordBaru) passwordBaru.value = "";
  if (konfirmasiPassword) konfirmasiPassword.value = "";

  // Memberikan informasi keberhasilan.
  alert(
    inginGantiPassword
      ? "Profil dan kata sandi berhasil diperbarui!"
      : "Profil berhasil diperbarui!",
  );

  console.log("===== PROFIL SIPFAS DIPERBARUI =====");
  console.log("Nama:", namaBaru);
  console.log("Email:", emailBaru);
  console.log("Sinkronisasi akun berhasil.");
  console.log("====================================");
}
