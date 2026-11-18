
<?php
// Memanggil file pendukung Administrator yang berisi konfigurasi,
// koneksi database, session, autentikasi, dan fungsi API.
require_once __DIR__ . '/_admin-common.php';

try {
    // Menentukan metode HTTP yang diperbolehkan pada API,
    // yaitu GET untuk mengambil data, POST untuk menambahkan data,
    // PUT untuk memperbarui data, dan DELETE untuk menghapus data.
    $method=admin_method('GET','POST','PUT','DELETE');

    // Memeriksa apakah permintaan menggunakan metode GET
    // untuk mengambil dan menampilkan data Dataset C4.5.
    if($method==='GET'){

        // Mengambil informasi halaman, batas jumlah data,
        // dan posisi awal data untuk kebutuhan pagination.
        // Menyiapkan array untuk menampung kondisi filter dan parameternya.
        [$page,$limit,$offset]=admin_page();$where=[];$params=[];

        // Memeriksa apakah terdapat kata kunci pencarian dari pengguna.
        // Pencarian dilakukan berdasarkan kode data atau nama fasilitas
        // menggunakan kondisi LIKE.
        if(!empty($_GET['search'])){$where[]='(kode_data LIKE :q OR nama_fasilitas LIKE :q)';$params[':q']='%'.trim($_GET['search']).'%';}

        // Melakukan perulangan untuk memeriksa filter Dataset C4.5.
        // Filter meliputi tingkat kerusakan (X1), dampak akademik (X2),
        // frekuensi penggunaan (X3), dan label prioritas.
        foreach(['x1'=>'tingkat_kerusakan_x1','x2'=>'dampak_akademik_x2','x3'=>'frekuensi_penggunaan_x3','label'=>'label_prioritas'] as $key=>$col){

            // Memeriksa apakah parameter filter tersedia dan bukan pilihan 'semua'.
            // Jika tersedia, kondisi filter ditambahkan ke query
            // sesuai kolom yang telah ditentukan.
            if(isset($_GET[$key]) && $_GET[$key]!=='' && $_GET[$key]!=='semua'){$where[]="$col=:f_$key";$params[":f_$key"]=$_GET[$key];}
        }

        // Menggabungkan seluruh kondisi pencarian dan filter
        // menjadi klausa WHERE untuk query database.
        // Jika tidak ada filter, klausa WHERE dikosongkan.
        $clause=$where?'WHERE '.implode(' AND ',$where):'';

        // Menyiapkan query untuk menghitung jumlah seluruh data Dataset C4.5
        // berdasarkan kondisi pencarian dan filter yang telah ditentukan.
        $c=$pdo->prepare("SELECT COUNT(*) FROM dataset_c45 $clause");$c->execute($params);$total=(int)$c->fetchColumn();

        // Menyiapkan query untuk mengambil data Dataset C4.5
        // beserta nama pengguna yang melakukan input data.
        // LEFT JOIN digunakan untuk menghubungkan dataset_c45 dengan pengguna.
        // Data diurutkan berdasarkan ID data terbaru dan dibatasi
        // sesuai jumlah data pada halaman pagination.
        $s=$pdo->prepare("SELECT d.*,u.nama_lengkap AS nama_penginput FROM dataset_c45 d LEFT JOIN pengguna u ON u.id_pengguna=d.id_penginput $clause ORDER BY d.id_data DESC LIMIT :lim OFFSET :off");

        // Mengikat seluruh parameter pencarian dan filter ke dalam query.
        // Parameter limit dan offset menggunakan tipe integer
        // untuk menentukan jumlah data dan posisi awal pengambilan data.
        foreach($params as $k=>$v)$s->bindValue($k,$v);$s->bindValue(':lim',$limit,PDO::PARAM_INT);$s->bindValue(':off',$offset,PDO::PARAM_INT);$s->execute();

        // Mengirimkan respons berhasil yang berisi daftar Dataset C4.5
        // dan informasi pagination berupa halaman, batas data,
        // serta jumlah keseluruhan data.
        admin_ok('Dataset C4.5 berhasil dimuat.',['items'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total]]);
    }

    // Mengambil data input yang dikirimkan dari halaman pengelolaan Dataset C4.5.
    $in=admin_input();

    // Memeriksa apakah metode yang digunakan adalah POST
    // untuk menambahkan data baru ke dalam tabel dataset_c45.
    if($method==='POST'){

        // Menyiapkan query INSERT untuk menyimpan data fasilitas,
        // nilai atribut X1, X2, X3, label prioritas, sumber data,
        // serta ID pengguna yang melakukan input.
        $s=$pdo->prepare("INSERT INTO dataset_c45 (kode_data,nama_fasilitas,tingkat_kerusakan_x1,dampak_akademik_x2,frekuensi_penggunaan_x3,label_prioritas,sumber_data,id_penginput)
            VALUES (:kode,:nama,:x1,:x2,:x3,:label,:sumber,:user)");

        // Menjalankan query INSERT dengan mengisi setiap parameter
        // berdasarkan data yang diterima dari halaman pengelolaan dataset.
        $s->execute([

            // Mengambil kode dataset dengan batas maksimal 30 karakter.
            ':kode'=>admin_text($in,'kode_data',30),

            // Mengambil nama fasilitas dengan batas maksimal 150 karakter.
            ':nama'=>admin_text($in,'nama_fasilitas',150),

            // Mengambil nilai atribut tingkat kerusakan (X1)
            // dan mengubahnya menjadi tipe data integer.
            ':x1'=>(int)($in['tingkat_kerusakan_x1']??0),

            // Mengambil nilai atribut dampak akademik (X2)
            // dan mengubahnya menjadi tipe data integer.
            ':x2'=>(int)($in['dampak_akademik_x2']??0),

            // Mengambil nilai atribut frekuensi penggunaan (X3)
            // dan mengubahnya menjadi tipe data integer.
            ':x3'=>(int)($in['frekuensi_penggunaan_x3']??0),

            // Mengambil label prioritas dengan batas maksimal 20 karakter.
            ':label'=>admin_text($in,'label_prioritas',20),

            // Mengambil informasi sumber data dengan batas maksimal 50 karakter.
            ':sumber'=>admin_text($in,'sumber_data',50),

            // Mengambil ID Administrator yang sedang login
            // sebagai pengguna yang melakukan input data.
            ':user'=>admin_user_id()
        ]);

        // Mengirimkan respons berhasil setelah data dataset ditambahkan.
        // ID data yang baru dibuat turut dikirimkan dalam respons.
        // Status HTTP 201 menunjukkan bahwa data berhasil dibuat.
        admin_ok('Data dataset berhasil ditambahkan.',['id_data'=>(int)$pdo->lastInsertId()],201);
    }

    // Mengambil ID data dataset dari input
    // sebagai identitas data yang akan diperbarui atau dihapus.
    $id=admin_id($in,'id_data');

    // Memeriksa apakah metode yang digunakan adalah PUT
    // untuk memperbarui data Dataset C4.5 yang sudah tersimpan.
    if($method==='PUT'){

        // Menyiapkan query UPDATE untuk memperbarui kode data,
        // nama fasilitas, nilai atribut X1, X2, X3,
        // label prioritas, dan sumber data berdasarkan ID data.
        $s=$pdo->prepare("UPDATE dataset_c45 SET kode_data=:kode,nama_fasilitas=:nama,tingkat_kerusakan_x1=:x1,dampak_akademik_x2=:x2,frekuensi_penggunaan_x3=:x3,label_prioritas=:label,sumber_data=:sumber WHERE id_data=:id");

        // Menjalankan query UPDATE dengan mengisi parameter
        // berdasarkan data terbaru yang dikirimkan dari halaman dataset.
        $s->execute([':kode'=>admin_text($in,'kode_data',30),':nama'=>admin_text($in,'nama_fasilitas',150),':x1'=>(int)($in['tingkat_kerusakan_x1']??0),':x2'=>(int)($in['dampak_akademik_x2']??0),':x3'=>(int)($in['frekuensi_penggunaan_x3']??0),':label'=>admin_text($in,'label_prioritas',20),':sumber'=>admin_text($in,'sumber_data',50),':id'=>$id]);

        // Mengirimkan respons bahwa data Dataset C4.5 berhasil diperbarui.
        admin_ok('Data dataset berhasil diperbarui.');
    }

    // Menyiapkan query DELETE untuk menghapus data Dataset C4.5
    // berdasarkan ID data yang telah diterima.
    $s=$pdo->prepare("DELETE FROM dataset_c45 WHERE id_data=:id");

    // Menjalankan query DELETE dengan parameter ID data.
    $s->execute([':id'=>$id]);

    // Memeriksa apakah terdapat data yang berhasil dihapus.
    // Jika tidak ada baris yang terhapus, sistem mengirimkan respons 404.
    if(!$s->rowCount())admin_fail('Data dataset tidak ditemukan.',404);

    // Mengirimkan respons bahwa data Dataset C4.5 berhasil dihapus.
    admin_ok('Data dataset berhasil dihapus.');

}catch(PDOException $e){

    // Menangani kesalahan yang berasal dari database.
    // Kode error 23000 menunjukkan pelanggaran constraint database,
    // misalnya kode dataset sudah digunakan atau data masih digunakan
    // dalam riwayat pelatihan.
    if((string)$e->getCode()==='23000')admin_fail('Kode dataset sudah digunakan atau data sedang dipakai riwayat pelatihan.',409);

    // Meneruskan kesalahan database ke fungsi penanganan exception.
    admin_exception($e);

}catch(Throwable $e){

    // Menangani kesalahan umum yang terjadi selama proses API berlangsung.
    admin_exception($e);
}
