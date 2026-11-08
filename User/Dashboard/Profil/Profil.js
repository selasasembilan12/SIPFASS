// 01. Menjalankan program setelah halaman Profil selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  mulaiProfil();
});

// 02. Menentukan nama tempat penyimpanan data profil.
const KUNCI_PROFIL = "sipfasProfile";

// 03. Menyiapkan data profil awal sebagai simulasi.
const profilAwal = {
  name: "Ahmad Fauzi",
  nim: "07352011045",
  username: "07352011045",
  email: "ahmad.fauzi@unkhair.ac.id",
};

// 04. Mengambil data profil dari LocalStorage.
function ambilProfil() {
  try {
    const dataTersimpan = localStorage.getItem(KUNCI_PROFIL);

    // Menggunakan data awal jika belum ada data tersimpan.
    if (!dataTersimpan) {
      localStorage.setItem(KUNCI_PROFIL, JSON.stringify(profilAwal));

      return { ...profilAwal };
    }

    // Mengubah data JSON menjadi objek JavaScript.
    const dataProfil = JSON.parse(dataTersimpan);

    // Memastikan data profil berbentuk objek.
    if (
      !dataProfil ||
      typeof dataProfil !== "object" ||
      Array.isArray(dataProfil)
    ) {
      throw new Error("Format data profil tidak valid.");
    }

    // Menggabungkan data awal dengan data yang tersimpan.
    return {
      ...profilAwal,
      ...dataProfil,
    };
  } catch (error) {
    console.error("Gagal mengambil profil:", error);

    return { ...profilAwal };
  }
}

// 05. Menyiapkan halaman Profil ketika pertama kali dibuka.
function mulaiProfil() {
  const formulir = document.querySelector(".profile-form");

  // Memeriksa keberadaan formulir.
  if (!formulir) {
    console.error("Formulir profil tidak ditemukan.");
    return;
  }

  // Mengambil dan menampilkan data profil.
  const profil = ambilProfil();

  tampilkanProfil(profil);

  // Mengaktifkan tombol tampil dan sembunyikan password.
  aturTombolPassword();

  // Menjalankan proses penyimpanan ketika formulir dikirim.
  formulir.addEventListener("submit", function (event) {
    event.preventDefault();

    simpanPerubahanProfil();
  });
}

// 06. Menampilkan data profil ke dalam halaman HTML.
function tampilkanProfil(profil) {
  const nama = document.getElementById("nama");
  const nim = document.getElementById("nim");
  const username = document.getElementById("username");
  const email = document.getElementById("email");

  const namaIdentitas = document.querySelector(".identity-information h2");

  const namaHeader = document.querySelector(".header-name");

  // Mengisi nama pengguna.
  nama.value = profil.name;
  namaIdentitas.textContent = profil.name;
  namaHeader.textContent = profil.name;

  // Mengisi NIM dan username.
  nim.value = profil.nim;
  username.value = profil.username;

  // Mengisi alamat email.
  email.value = profil.email;

  console.log("Profil berhasil ditampilkan:", profil);
}

// 07. Mengatur tombol untuk melihat dan menyembunyikan password.
function aturTombolPassword() {
  const tombolPassword = document.querySelectorAll(".password-toggle");

  tombolPassword.forEach(function (tombol) {
    // Mengambil kolom password yang berhubungan dengan tombol.
    const inputPassword = tombol
      .closest(".input-wrapper")
      .querySelector("input");

    // Menjalankan fungsi ketika tombol mata diklik.
    tombol.addEventListener("click", function () {
      // Memeriksa apakah password sedang disembunyikan.
      const passwordTersembunyi = inputPassword.type === "password";

      // Mengubah tampilan password.
      inputPassword.type = passwordTersembunyi ? "text" : "password";

      // Memperbarui keterangan tombol.
      tombol.setAttribute(
        "aria-label",
        passwordTersembunyi ? "Sembunyikan kata sandi" : "Tampilkan kata sandi",
      );

      tombol.setAttribute("aria-pressed", String(passwordTersembunyi));
    });
  });
}

// 08. Menyimpan perubahan nama dan email pengguna.
function simpanPerubahanProfil() {
  const nama = document.getElementById("nama");
  const email = document.getElementById("email");

  const passwordLama = document.getElementById("password-current");

  const passwordBaru = document.getElementById("password-new");

  const konfirmasiPassword = document.getElementById("password-confirm");

  // Mengambil nilai yang dimasukkan pengguna.
  const namaBaru = nama.value.trim();
  const emailBaru = email.value.trim();

  // 09. Memeriksa kelengkapan nama.
  if (!namaBaru) {
    alert("Nama lengkap tidak boleh kosong.");
    nama.focus();
    return;
  }

  // 10. Memeriksa kelengkapan dan format email.
  if (!emailBaru || !email.checkValidity()) {
    alert("Masukkan alamat email dengan format yang benar.");
    email.focus();
    return;
  }

  // 11. Memeriksa apakah pengguna mengisi kolom password.
  const inginGantiPassword =
    passwordLama.value !== "" ||
    passwordBaru.value !== "" ||
    konfirmasiPassword.value !== "";

  // 12. Menyiapkan data profil terbaru.
  const profilLama = ambilProfil();

  const profilBaru = {
    ...profilLama,
    name: namaBaru,
    email: emailBaru,
  };

  // 13. Menyimpan perubahan profil ke LocalStorage.
  try {
    localStorage.setItem(KUNCI_PROFIL, JSON.stringify(profilBaru));
  } catch (error) {
    console.error("Gagal menyimpan profil:", error);

    alert("Perubahan profil gagal disimpan.");
    return;
  }

  // 14. Memperbarui tampilan setelah data berhasil disimpan.
  tampilkanProfil(profilBaru);

  // Mengosongkan kolom password.
  passwordLama.value = "";
  passwordBaru.value = "";
  konfirmasiPassword.value = "";

  // 15. Memberikan pemberitahuan kepada pengguna.
  if (inginGantiPassword) {
    alert(
      "Nama dan email berhasil diperbarui.\n\n" +
        "Namun, kata sandi belum berubah karena fitur " +
        "penggantian kata sandi memerlukan backend.",
    );
  } else {
    alert("Profil berhasil diperbarui!");
  }

  console.log("Perubahan profil berhasil disimpan.");
}
