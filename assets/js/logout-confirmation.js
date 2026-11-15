/* ============================================================
   SIPFAS - LOGOUT CONFIRMATION
   Validasi tombol keluar untuk seluruh halaman User.
   
   Fitur:
   1. Konfirmasi sebelum keluar.
   2. Klik OK untuk mengakhiri sesi.
   3. Klik Batal untuk tetap di halaman.
   4. Data laporan LocalStorage tetap aman.
   5. Berlaku untuk seluruh halaman yang menggunakan file ini.
============================================================ */

// Menjalankan validasi setelah HTML selesai dimuat.
document.addEventListener("DOMContentLoaded", function () {
  // Mengambil seluruh tombol keluar pada halaman.
  const logoutButtons = document.querySelectorAll("#logoutLink, .logout-link");

  // Memasang validasi pada setiap tombol keluar.
  logoutButtons.forEach(function (button) {
    // Mencegah pemasangan event berulang.
    if (button.dataset.logoutReady === "true") return;

    button.dataset.logoutReady = "true";

    button.addEventListener("click", function (event) {
      // Mencegah perpindahan halaman secara langsung.
      event.preventDefault();

      // Meminta konfirmasi pengguna.
      const yakinKeluar = window.confirm(
        "Apakah Anda yakin ingin keluar dari SIPFAS?\n\n" +
          "Klik OK untuk keluar dari akun atau Batal untuk tetap berada di halaman.",
      );

      // Jika pengguna memilih Batal.
      if (!yakinKeluar) {
        return;
      }

      // Menghapus sesi login pengguna.
      sessionStorage.removeItem("sipfasActiveUser");
      sessionStorage.removeItem("sipfasLoginVerified");
      sessionStorage.removeItem("sipfasLoginEmail");

      // Mengarahkan pengguna ke halaman tujuan tombol Keluar.
      window.location.href = button.href;
    });
  });

  console.log("Validasi tombol keluar SIPFAS berhasil diaktifkan.");
});
