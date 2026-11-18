
<?php
// Memanggil file pendukung Administrator yang berisi konfigurasi,
// koneksi database, session, autentikasi, dan fungsi API.
require_once __DIR__ . '/_admin-common.php';

try{
    // Menentukan metode HTTP yang diperbolehkan pada API,
    // yaitu GET untuk mengambil riwayat dan POST untuk menyimpan hasil pelatihan.
    $method=admin_method('GET','POST');

    // Memeriksa apakah permintaan menggunakan metode GET
    // untuk mengambil dan menampilkan daftar riwayat pelatihan C4.5.
    if($method==='GET'){

        // Mengambil informasi halaman, batas jumlah data,
        // dan posisi awal data untuk kebutuhan pagination.
        [$page,$limit,$offset]=admin_page();

        // Menghitung jumlah seluruh riwayat pelatihan C4.5
        // yang tersimpan di dalam tabel riwayat_pelatihan_c45.
        $total=(int)$pdo->query("SELECT COUNT(*) FROM riwayat_pelatihan_c45")->fetchColumn();

        // Menyiapkan query untuk mengambil data riwayat pelatihan.
        // Data diurutkan berdasarkan ID pelatihan terbaru
        // dan dibatasi sesuai jumlah data pada halaman pagination.
        $s=$pdo->prepare("SELECT * FROM riwayat_pelatihan_c45 ORDER BY id_pelatihan DESC LIMIT :lim OFFSET :off");

        // Mengikat parameter limit dan offset menggunakan tipe integer.
        // Limit menentukan jumlah data yang ditampilkan,
        // sedangkan offset menentukan posisi awal pengambilan data.
        $s->bindValue(':lim',$limit,PDO::PARAM_INT);$s->bindValue(':off',$offset,PDO::PARAM_INT);

        // Menjalankan query untuk mengambil data riwayat pelatihan.
        $s->execute();

        // Mengirimkan respons berhasil yang berisi daftar riwayat pelatihan
        // beserta informasi pagination berupa halaman, batas data,
        // dan jumlah keseluruhan riwayat pelatihan.
        admin_ok('Riwayat pelatihan C4.5 berhasil dimuat.',['items'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total]]);
    }

    // Mengambil data input yang dikirimkan oleh modul atau service C4.5.
    $in=admin_input();

    // Endpoint ini menyimpan ringkasan hasil yang dikirim modul/service C4.5.
    // Perhitungan algoritma tidak dibuat ulang di endpoint CRUD ini.
    
    // Menentukan daftar data wajib yang harus dikirimkan
    // oleh proses pelatihan sebelum hasil dapat disimpan ke database.
    $required=['persentase_latih','persentase_uji','jumlah_dataset','jumlah_data_latih','jumlah_data_uji'];

    // Memeriksa kelengkapan setiap data wajib.
    // Jika terdapat data yang belum dikirimkan, proses penyimpanan dihentikan
    // dan sistem memberikan respons kesalahan HTTP 422.
    foreach($required as $key)if(!isset($in[$key]))admin_fail("Data {$key} wajib dikirim oleh proses pelatihan.",422);

    // Menyiapkan query INSERT untuk menyimpan ringkasan hasil pelatihan C4.5.
    // Data yang disimpan mencakup waktu pelatihan, persentase pembagian data,
    // jumlah dataset, atribut akar, struktur pohon keputusan,
    // nilai evaluasi model, status model, dan ID pengguna pengolah.
    $s=$pdo->prepare("INSERT INTO riwayat_pelatihan_c45
        (waktu_dijalankan,persentase_latih,persentase_uji,jumlah_dataset,jumlah_data_latih,jumlah_data_uji,atribut_akar,struktur_pohon,akurasi,presisi,recall,skor_f1,tingkat_kesalahan,status_model,id_pengolah)
        VALUES (NOW(),:pl,:pu,:jd,:jdl,:jdu,:akar,:pohon,:akurasi,:presisi,:recall,:f1,:error,:status,:user)");

    // Menjalankan query INSERT dengan mengisi seluruh parameter
    // berdasarkan hasil yang dikirimkan oleh proses pelatihan C4.5.
    $s->execute([

        // Mengambil persentase data latih dan data uji
        // kemudian mengubah nilainya menjadi tipe data float.
        ':pl'=>(float)$in['persentase_latih'],':pu'=>(float)$in['persentase_uji'],

        // Mengambil jumlah seluruh dataset, jumlah data latih,
        // dan jumlah data uji kemudian mengubahnya menjadi integer.
        ':jd'=>(int)$in['jumlah_dataset'],':jdl'=>(int)$in['jumlah_data_latih'],':jdu'=>(int)$in['jumlah_data_uji'],

        // Mengambil nama atribut akar dari pohon keputusan.
        // Jika atribut akar tidak tersedia, nilainya disimpan sebagai NULL.
        ':akar'=>isset($in['atribut_akar'])?(string)$in['atribut_akar']:null,

        // Mengambil struktur pohon keputusan dan mengubahnya menjadi format JSON
        // agar struktur tersebut dapat disimpan dalam database.
        // Jika struktur pohon tidak tersedia, nilainya disimpan sebagai NULL.
        ':pohon'=>isset($in['struktur_pohon'])?json_encode($in['struktur_pohon'],JSON_UNESCAPED_UNICODE):null,

        // Mengambil nilai akurasi model dalam tipe data float.
        // Jika tidak tersedia, nilainya disimpan sebagai NULL.
        ':akurasi'=>isset($in['akurasi'])?(float)$in['akurasi']:null,

        // Mengambil nilai presisi model dalam tipe data float.
        // Jika tidak tersedia, nilainya disimpan sebagai NULL.
        ':presisi'=>isset($in['presisi'])?(float)$in['presisi']:null,

        // Mengambil nilai recall model dalam tipe data float.
        // Jika tidak tersedia, nilainya disimpan sebagai NULL.
        ':recall'=>isset($in['recall'])?(float)$in['recall']:null,

        // Mengambil nilai skor F1 dalam tipe data float.
        // Jika tidak tersedia, nilainya disimpan sebagai NULL.
        ':f1'=>isset($in['skor_f1'])?(float)$in['skor_f1']:null,

        // Mengambil nilai tingkat kesalahan model dalam tipe data float.
        // Jika tidak tersedia, nilainya disimpan sebagai NULL.
        ':error'=>isset($in['tingkat_kesalahan'])?(float)$in['tingkat_kesalahan']:null,

        // Mengambil status model dari data input.
        // Jika tidak tersedia, status secara default diatur menjadi Aktif.
        // ID Administrator yang sedang login dicatat sebagai pengguna pengolah.
        ':status'=>$in['status_model']??'Aktif',':user'=>admin_user_id()
    ]);

    // Mengirimkan respons berhasil setelah hasil pelatihan disimpan.
    // ID pelatihan yang baru dibuat turut dikirimkan dalam respons.
    // Status HTTP 201 menunjukkan bahwa data berhasil dibuat.
    admin_ok('Hasil pelatihan berhasil disimpan.',['id_pelatihan'=>(int)$pdo->lastInsertId()],201);

}catch(PDOException $e){

    // Menangani kesalahan yang berasal dari proses database.
    admin_exception($e);

}catch(Throwable $e){

    // Menangani kesalahan umum yang terjadi selama proses API berlangsung.
    admin_exception($e);
}
