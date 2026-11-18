
<?php
// Memanggil file pendukung Administrator yang berisi konfigurasi,
// koneksi database, session, autentikasi, dan fungsi API.
require_once __DIR__ . '/_admin-common.php';

try {
    // Menentukan metode HTTP yang diperbolehkan untuk API,
    // yaitu GET untuk mengambil data, POST untuk menambah data,
    // PUT untuk memperbarui data, dan DELETE untuk menghapus data.
    $method=admin_method('GET','POST','PUT','DELETE');

    // Memeriksa apakah permintaan menggunakan metode GET
    // untuk mengambil dan menampilkan data fasilitas.
    if ($method==='GET') {

        // Mengambil informasi halaman, batas jumlah data,
        // dan posisi awal data untuk kebutuhan pagination.
        [$page,$limit,$offset]=admin_page(); $where=[]; $params=[];

        // Memeriksa apakah pengguna memasukkan kata kunci pencarian.
        // Pencarian dilakukan berdasarkan kode fasilitas, nama fasilitas,
        // atau lokasi ruangan menggunakan LIKE.
        if (!empty($_GET['search'])) { $where[]='(f.kode_fasilitas LIKE :q OR f.nama_fasilitas LIKE :q OR f.lokasi_ruangan LIKE :q)'; $params[':q']='%'.trim($_GET['search']).'%'; }

        // Memeriksa apakah pengguna memilih filter status fasilitas.
        // Jika status bukan 'semua', data akan difilter sesuai status yang dipilih.
        if (!empty($_GET['status']) && $_GET['status']!=='semua') { $where[]='f.status_fasilitas=:status'; $params[':status']=$_GET['status']; }

        // Memeriksa apakah pengguna memilih kategori fasilitas.
        // Jika kategori tersedia, data akan difilter berdasarkan ID kategori.
        if (!empty($_GET['kategori'])) { $where[]='f.id_kategori=:kategori'; $params[':kategori']=(int)$_GET['kategori']; }

        // Menggabungkan seluruh kondisi pencarian dan filter menjadi klausa WHERE.
        // Jika tidak ada filter, klausa WHERE dikosongkan.
        $clause=$where?'WHERE '.implode(' AND ',$where):'';

        // Menyiapkan query untuk menghitung jumlah seluruh data fasilitas
        // berdasarkan kondisi pencarian dan filter yang telah ditentukan.
        $c=$pdo->prepare("SELECT COUNT(*) FROM fasilitas f $clause"); $c->execute($params); $total=(int)$c->fetchColumn();

        // Menyiapkan query untuk mengambil data fasilitas beserta nama kategori
        // dan nama pengguna yang melakukan input data.
        // LEFT JOIN digunakan agar data fasilitas tetap dapat ditampilkan
        // meskipun data kategori atau pengguna tidak ditemukan.
        // Data diurutkan berdasarkan ID fasilitas terbaru dan dibatasi
        // sesuai jumlah data pada halaman pagination.
        $s=$pdo->prepare("SELECT f.*, k.nama_kategori, u.nama_lengkap AS nama_penginput
            FROM fasilitas f LEFT JOIN kategori_fasilitas k ON k.id_kategori=f.id_kategori
            LEFT JOIN pengguna u ON u.id_pengguna=f.id_penginput $clause
            ORDER BY f.id_fasilitas DESC LIMIT :lim OFFSET :off");

        // Mengikat seluruh parameter pencarian dan filter ke dalam query.
        // Parameter limit dan offset menggunakan tipe data integer
        // untuk menentukan jumlah data dan posisi awal pengambilan data.
        foreach($params as $k=>$v)$s->bindValue($k,$v); $s->bindValue(':lim',$limit,PDO::PARAM_INT);$s->bindValue(':off',$offset,PDO::PARAM_INT);$s->execute();

        // Mengirimkan respons berhasil yang berisi daftar fasilitas
        // dan informasi pagination seperti halaman, batas data,
        // serta jumlah keseluruhan data fasilitas.
        admin_ok('Data fasilitas berhasil dimuat.',['items'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total]]);
    }

    // Mengambil data input yang dikirimkan dari halaman pengelolaan fasilitas.
    $in=admin_input();

    // Memeriksa apakah metode yang digunakan adalah POST
    // untuk menambahkan data fasilitas baru ke database.
    if($method==='POST'){

        // Menyiapkan query INSERT untuk menyimpan data fasilitas baru
        // ke dalam tabel fasilitas beserta informasi penginput.
        $s=$pdo->prepare("INSERT INTO fasilitas (kode_fasilitas,nama_fasilitas,id_kategori,lokasi_ruangan,jumlah_unit,frekuensi_penggunaan,status_fasilitas,id_penginput)
            VALUES (:kode,:nama,:kategori,:lokasi,:jumlah,:frekuensi,:status,:penginput)");

        // Menjalankan query INSERT dengan mengisi setiap parameter
        // berdasarkan data yang diterima dari halaman pengelolaan fasilitas.
        $s->execute([
            // Mengambil kode fasilitas dengan batas maksimal 30 karakter.
            ':kode'=>admin_text($in,'kode_fasilitas',30),

            // Mengambil nama fasilitas dengan batas maksimal 150 karakter.
            ':nama'=>admin_text($in,'nama_fasilitas',150),

            // Mengambil ID kategori fasilitas dan mengubahnya menjadi integer.
            ':kategori'=>(int)($in['id_kategori']??0),

            // Mengambil lokasi ruangan dengan batas maksimal 150 karakter.
            ':lokasi'=>admin_text($in,'lokasi_ruangan',150),

            // Mengambil jumlah unit fasilitas dan memastikan nilainya minimal 0.
            ':jumlah'=>max(0,(int)($in['jumlah_unit']??0)),

            // Mengambil informasi frekuensi penggunaan fasilitas.
            ':frekuensi'=>admin_text($in,'frekuensi_penggunaan',50),

            // Mengambil status fasilitas.
            // Jika tidak tersedia, status secara default diatur menjadi Aktif.
            ':status'=>$in['status_fasilitas']??'Aktif',

            // Mengambil ID Administrator yang sedang login
            // sebagai pengguna yang melakukan input data fasilitas.
            ':penginput'=>admin_user_id()
        ]);

        // Mengirimkan respons berhasil setelah data fasilitas ditambahkan.
        // ID fasilitas yang baru dibuat turut dikirimkan dalam respons.
        // Status HTTP 201 menunjukkan bahwa data berhasil dibuat.
        admin_ok('Fasilitas berhasil ditambahkan.',['id_fasilitas'=>(int)$pdo->lastInsertId()],201);
    }

    // Mengambil ID fasilitas dari data input
    // sebagai identitas data yang akan diperbarui atau dihapus.
    $id=admin_id($in,'id_fasilitas');

    // Memeriksa apakah metode yang digunakan adalah PUT
    // untuk memperbarui data fasilitas yang sudah tersimpan.
    if($method==='PUT'){

        // Menyiapkan query UPDATE untuk memperbarui informasi fasilitas
        // berdasarkan ID fasilitas yang diterima dari input.
        $s=$pdo->prepare("UPDATE fasilitas SET kode_fasilitas=:kode,nama_fasilitas=:nama,id_kategori=:kategori,lokasi_ruangan=:lokasi,jumlah_unit=:jumlah,frekuensi_penggunaan=:frekuensi,status_fasilitas=:status WHERE id_fasilitas=:id");

        // Menjalankan query UPDATE dengan mengisi parameter
        // berdasarkan data fasilitas terbaru yang dikirimkan.
        $s->execute([':kode'=>admin_text($in,'kode_fasilitas',30),':nama'=>admin_text($in,'nama_fasilitas',150),':kategori'=>(int)($in['id_kategori']??0),':lokasi'=>admin_text($in,'lokasi_ruangan',150),':jumlah'=>max(0,(int)($in['jumlah_unit']??0)),':frekuensi'=>admin_text($in,'frekuensi_penggunaan',50),':status'=>$in['status_fasilitas']??'Aktif',':id'=>$id]);

        // Memeriksa apakah terdapat baris data yang berubah setelah UPDATE.
        // Jika tidak ada perubahan, sistem memeriksa apakah ID fasilitas
        // benar-benar tersedia di dalam database.
        if(!$s->rowCount()) { $c=$pdo->prepare("SELECT 1 FROM fasilitas WHERE id_fasilitas=?");$c->execute([$id]);if(!$c->fetchColumn())admin_fail('Fasilitas tidak ditemukan.',404); }

        // Mengirimkan respons bahwa data fasilitas berhasil diperbarui.
        admin_ok('Fasilitas berhasil diperbarui.');
    }

    // Menyiapkan query DELETE untuk menghapus data fasilitas
    // berdasarkan ID fasilitas yang telah diterima.
    $s=$pdo->prepare("DELETE FROM fasilitas WHERE id_fasilitas=:id");

    // Menjalankan query DELETE dengan parameter ID fasilitas.
    $s->execute([':id'=>$id]);

    // Memeriksa apakah terdapat data fasilitas yang berhasil dihapus.
    // Jika tidak ada baris yang terhapus, sistem mengirimkan respons 404.
    if(!$s->rowCount())admin_fail('Fasilitas tidak ditemukan.',404);

    // Mengirimkan respons bahwa data fasilitas berhasil dihapus.
    admin_ok('Fasilitas berhasil dihapus.');

} catch(PDOException $e){

    // Menangani kesalahan yang berasal dari database.
    // Kode error 23000 menunjukkan pelanggaran constraint database,
    // misalnya kode fasilitas sudah digunakan atau fasilitas
    // masih memiliki keterkaitan dengan data laporan.
    if((string)$e->getCode()==='23000')admin_fail('Kode fasilitas sudah digunakan atau fasilitas masih terkait laporan.',409);

    // Meneruskan kesalahan database ke fungsi penanganan exception.
    admin_exception($e);

}catch(Throwable $e){

    // Menangani kesalahan umum yang terjadi selama proses API berlangsung.
    admin_exception($e);
}
