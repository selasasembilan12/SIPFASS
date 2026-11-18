
<?php
// Memanggil file pendukung Administrator yang berisi konfigurasi,
// koneksi database, session, autentikasi, dan fungsi API.
require_once __DIR__ . '/_admin-common.php';

try{
    // Membatasi metode HTTP yang diperbolehkan hanya GET,
    // karena API ini digunakan untuk mengambil data riwayat pengujian.
    admin_method('GET');

    // Mengambil ID pelatihan dari parameter URL.
    // Jika parameter tidak tersedia, nilai ID diatur menjadi 0.
    $id=isset($_GET['id_pelatihan'])?(int)$_GET['id_pelatihan']:0;

    // Memeriksa apakah ID pelatihan lebih dari 0.
    // Jika iya, sistem akan mengambil detail riwayat pengujian tertentu.
    if($id>0){

        // Menyiapkan query untuk mengambil satu data riwayat pelatihan
        // berdasarkan ID pelatihan yang diterima dari parameter URL.
        $s=$pdo->prepare("SELECT * FROM riwayat_pelatihan_c45 WHERE id_pelatihan=:id LIMIT 1");

        // Menjalankan query dengan parameter ID pelatihan
        // kemudian mengambil data riwayat yang ditemukan.
        $s->execute([':id'=>$id]);$history=$s->fetch();

        // Memeriksa apakah data riwayat pelatihan ditemukan.
        // Jika tidak ditemukan, sistem mengirimkan pesan kesalahan HTTP 404.
        if(!$history)admin_fail('Riwayat pengujian tidak ditemukan.',404);

        // Menyiapkan query untuk mengambil seluruh detail hasil pelatihan
        // berdasarkan ID pelatihan dan mengurutkannya berdasarkan ID detail.
        $d=$pdo->prepare("SELECT * FROM detail_pelatihan_c45 WHERE id_pelatihan=:id ORDER BY id_detail ASC");

        // Menjalankan query detail pelatihan berdasarkan ID yang dipilih.
        $d->execute([':id'=>$id]);

        // Menyiapkan query untuk mengambil data perhitungan atribut C4.5
        // berdasarkan ID pelatihan dan mengurutkannya berdasarkan ID perhitungan.
        $a=$pdo->prepare("SELECT * FROM perhitungan_atribut_c45 WHERE id_pelatihan=:id ORDER BY id_perhitungan ASC");

        // Menjalankan query untuk memperoleh seluruh hasil perhitungan atribut.
        $a->execute([':id'=>$id]);

        // Mengirimkan respons berhasil yang berisi tiga bagian data,
        // yaitu informasi riwayat pelatihan, detail pelatihan,
        // dan hasil perhitungan atribut C4.5.
        admin_ok('Detail hasil pengujian berhasil dimuat.',['history'=>$history,'details'=>$d->fetchAll(),'attribute_calculations'=>$a->fetchAll()]);
    }

    // Jika tidak ada ID pelatihan tertentu,
    // sistem mengambil daftar seluruh riwayat pengujian.
    // Mengambil informasi halaman, batas jumlah data,
    // dan posisi awal data untuk kebutuhan pagination.
    [$page,$limit,$offset]=admin_page();

    // Menghitung jumlah seluruh data riwayat pelatihan
    // yang tersimpan di dalam tabel riwayat_pelatihan_c45.
    $total=(int)$pdo->query("SELECT COUNT(*) FROM riwayat_pelatihan_c45")->fetchColumn();

    // Menyiapkan query untuk mengambil daftar riwayat pelatihan.
    // Data diurutkan berdasarkan ID pelatihan terbaru
    // dan dibatasi sesuai jumlah data pada halaman pagination.
    $s=$pdo->prepare("SELECT * FROM riwayat_pelatihan_c45 ORDER BY id_pelatihan DESC LIMIT :lim OFFSET :off");

    // Mengikat parameter limit dan offset menggunakan tipe integer.
    // Limit menentukan jumlah data yang ditampilkan,
    // sedangkan offset menentukan posisi awal pengambilan data.
    $s->bindValue(':lim',$limit,PDO::PARAM_INT);$s->bindValue(':off',$offset,PDO::PARAM_INT);

    // Menjalankan query untuk mengambil data riwayat pelatihan.
    $s->execute();

    // Mengirimkan respons berhasil yang berisi daftar riwayat pengujian
    // dan informasi pagination berupa halaman, batas data,
    // serta jumlah keseluruhan riwayat pelatihan.
    admin_ok('Hasil pengujian berhasil dimuat.',['items'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total]]);

}catch(Throwable $e){

    // Menangani kesalahan umum yang terjadi selama proses pengambilan data.
    // Kesalahan diteruskan ke fungsi admin_exception untuk diproses
    // dan menghasilkan respons kesalahan API.
    admin_exception($e);
}
