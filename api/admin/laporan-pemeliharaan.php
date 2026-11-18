
<?php
// Memanggil file pendukung Administrator yang berisi konfigurasi,
// koneksi database, session, autentikasi, dan fungsi API.
require_once __DIR__ . '/_admin-common.php';

try{
    // Membatasi metode HTTP yang diperbolehkan hanya GET,
    // karena API ini digunakan untuk mengambil data laporan pemeliharaan.
    admin_method('GET');

    // Mengambil informasi halaman, batas jumlah data,
    // dan posisi awal data untuk kebutuhan pagination.
    // Menyiapkan array untuk menampung kondisi filter dan parameternya.
    [$page,$limit,$offset]=admin_page();$where=[];$params=[];

    // Memeriksa apakah pengguna memasukkan kata kunci pencarian.
    // Pencarian dilakukan berdasarkan kode laporan, nama fasilitas,
    // atau nama lengkap pelapor.
    if(!empty($_GET['search'])){$where[]='(lk.kode_laporan LIKE :q OR f.nama_fasilitas LIKE :q OR u.nama_lengkap LIKE :q)';$params[':q']='%'.trim($_GET['search']).'%';}

    // Memeriksa apakah pengguna memilih filter status laporan.
    // Jika tersedia, data laporan akan ditampilkan sesuai status yang dipilih.
    if(!empty($_GET['status'])){$where[]='lk.status_laporan=:status';$params[':status']=$_GET['status'];}

    // Menggabungkan seluruh kondisi pencarian dan filter
    // menjadi klausa WHERE untuk digunakan dalam query SQL.
    // Jika tidak ada kondisi filter, klausa WHERE dikosongkan.
    $clause=$where?'WHERE '.implode(' AND ',$where):'';

    // Menyiapkan query untuk menghitung jumlah seluruh laporan kerusakan
    // berdasarkan kondisi pencarian dan filter yang telah ditentukan.
    // LEFT JOIN menghubungkan laporan dengan data fasilitas dan pelapor.
    $c=$pdo->prepare("SELECT COUNT(*) FROM laporan_kerusakan lk LEFT JOIN fasilitas f ON f.id_fasilitas=lk.id_fasilitas LEFT JOIN pengguna u ON u.id_pengguna=lk.id_pelapor $clause");

    // Menjalankan query penghitungan jumlah laporan
    // menggunakan parameter pencarian dan filter.
    // Hasil penghitungan disimpan dalam variabel total.
    $c->execute($params);$total=(int)$c->fetchColumn();

    // Menyiapkan query utama untuk mengambil data laporan pemeliharaan.
    // Data yang diambil meliputi informasi laporan, fasilitas, pelapor,
    // riwayat verifikasi terakhir, dan riwayat penanganan terakhir.
    $sql="SELECT lk.*,f.kode_fasilitas,f.nama_fasilitas,f.lokasi_ruangan,u.nama_lengkap AS nama_pelapor,u.nomor_identitas,

        // Mengambil informasi hasil verifikasi laporan,
        // prioritas sebelum dan sesudah verifikasi,
        // catatan verifikasi, serta waktu verifikasi.
        rv.hasil_verifikasi,rv.prioritas_sebelum,rv.prioritas_sesudah,rv.catatan_verifikasi,rv.waktu_verifikasi,

        // Mengambil informasi tindak lanjut perbaikan,
        // catatan petugas, waktu mulai dan selesai penanganan,
        // serta waktu pembaruan terakhir.
        rp.tindak_lanjut_perbaikan,rp.catatan_petugas,rp.waktu_mulai_penanganan,rp.waktu_selesai_penanganan,rp.waktu_pembaruan

        // Mengambil data utama dari tabel laporan_kerusakan.
        FROM laporan_kerusakan lk

        // Menghubungkan laporan dengan tabel fasilitas
        // berdasarkan ID fasilitas untuk mendapatkan informasi fasilitas.
        LEFT JOIN fasilitas f ON f.id_fasilitas=lk.id_fasilitas

        // Menghubungkan laporan dengan tabel pengguna
        // berdasarkan ID pelapor untuk mendapatkan identitas pelapor.
        LEFT JOIN pengguna u ON u.id_pengguna=lk.id_pelapor

        // Mengambil riwayat verifikasi terbaru untuk setiap laporan.
        // Subquery MAX digunakan untuk mencari ID riwayat verifikasi terbesar
        // berdasarkan ID laporan yang sedang diproses.
        LEFT JOIN riwayat_verifikasi_laporan rv ON rv.id_riwayat_verifikasi=(SELECT MAX(r2.id_riwayat_verifikasi) FROM riwayat_verifikasi_laporan r2 WHERE r2.id_laporan=lk.id_laporan)

        // Mengambil riwayat penanganan terbaru untuk setiap laporan.
        // Subquery MAX digunakan untuk mencari ID riwayat penanganan terbesar
        // berdasarkan ID laporan yang sedang diproses.
        LEFT JOIN riwayat_penanganan rp ON rp.id_riwayat_penanganan=(SELECT MAX(p2.id_riwayat_penanganan) FROM riwayat_penanganan p2 WHERE p2.id_laporan=lk.id_laporan)

        // Menerapkan kondisi pencarian dan filter yang telah dibuat.
        // Data diurutkan berdasarkan ID laporan terbaru,
        // kemudian dibatasi sesuai halaman pagination.
        $clause ORDER BY lk.id_laporan DESC LIMIT :lim OFFSET :off";

    // Menyiapkan query utama yang telah disusun sebelumnya.
    $s=$pdo->prepare($sql);

    // Mengikat seluruh parameter pencarian dan filter ke dalam query.
    // Parameter limit dan offset menggunakan tipe integer
    // untuk menentukan jumlah data dan posisi awal pengambilan data.
    foreach($params as $k=>$v)$s->bindValue($k,$v);$s->bindValue(':lim',$limit,PDO::PARAM_INT);$s->bindValue(':off',$offset,PDO::PARAM_INT);

    // Menjalankan query untuk mengambil seluruh data laporan
    // beserta informasi fasilitas, pelapor, verifikasi, dan penanganan.
    $s->execute();

    // Mengirimkan respons berhasil yang berisi daftar laporan pemeliharaan
    // dan informasi pagination berupa halaman, batas data,
    // serta jumlah keseluruhan laporan.
    admin_ok('Laporan pemeliharaan berhasil dimuat.',['items'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total]]);

}catch(Throwable $e){

    // Menangani kesalahan umum yang terjadi selama proses pengambilan data.
    // Kesalahan diteruskan ke fungsi admin_exception untuk diproses
    // dan menghasilkan respons kesalahan API.
    admin_exception($e);
}
