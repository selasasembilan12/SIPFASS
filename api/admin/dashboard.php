<?php
// Memanggil file pendukung Administrator yang berisi konfigurasi,
// koneksi database, session, dan fungsi autentikasi.
require_once __DIR__ . '/_admin-common.php';

try{
    // Menentukan metode HTTP yang diperbolehkan untuk API ini,
    // yaitu GET, POST, dan PUT.
    $method=admin_method('GET','POST','PUT');

    // Mengambil ID pengguna yang sedang login sebagai Administrator.
    // Jika ID tidak valid, proses dihentikan dengan status HTTP 401.
    $id=admin_user_id();if($id<1)admin_fail('Sesi Administrator tidak valid.',401);

    // Blok GET digunakan untuk mengambil dan menampilkan data profil Administrator.
    if($method==='GET'){

        // Menyiapkan query untuk mengambil data profil dari tabel pengguna
        // serta nama peran dari tabel peran berdasarkan ID Administrator.
        $s=$pdo->prepare("SELECT u.id_pengguna,u.id_peran,u.nama_lengkap,u.nomor_identitas,u.nama_pengguna,u.email,u.unit_kerja,u.foto_profil,u.status_akun,u.email_terverifikasi_pada,p.nama_peran FROM pengguna u JOIN peran p ON p.id_peran=u.id_peran WHERE u.id_pengguna=:id LIMIT 1");

        // Menjalankan query dengan parameter ID Administrator.
        $s->execute([':id'=>$id]);

        // Mengambil satu baris hasil query profil Administrator.
        $user=$s->fetch();if(!$user)admin_fail('Profil Administrator tidak ditemukan.',404);

        // Mengirimkan respons berhasil beserta data profil Administrator.
        admin_ok('Profil Administrator berhasil dimuat.',$user);
    }

    // Mengambil seluruh data input yang dikirimkan dari halaman profil Administrator.
    $in=admin_input();

    // Menyiapkan query untuk memperbarui nama lengkap, nama pengguna,
    // email, dan unit kerja pada tabel pengguna berdasarkan ID Administrator.
    $s=$pdo->prepare("UPDATE pengguna SET nama_lengkap=:nama,nama_pengguna=:username,email=:email,unit_kerja=:unit WHERE id_pengguna=:id");

    // Menjalankan query UPDATE dengan mengisi parameter berdasarkan data input.
    // Fungsi admin_text digunakan untuk mengambil dan memvalidasi nilai input.
    $s->execute([':nama'=>admin_text($in,'nama_lengkap',150),':username'=>admin_text($in,'nama_pengguna',50),':email'=>admin_text($in,'email',150),':unit'=>admin_text($in,'unit_kerja',150,false),':id'=>$id]);

    // Memeriksa apakah data session pengguna tersedia dan berbentuk array.
    // Pemeriksaan ini dilakukan agar informasi nama pada session dapat diperbarui.
    if(isset($_SESSION['user']) && is_array($_SESSION['user'])){

        // Memperbarui nama lengkap pada session berdasarkan data terbaru.
        $_SESSION['user']['nama_lengkap']=trim((string)$in['nama_lengkap']);

        // Memperbarui nama pengguna pada session berdasarkan data terbaru.
        $_SESSION['user']['nama_pengguna']=trim((string)$in['nama_pengguna']);
    }

    // Mengirimkan respons bahwa data profil Administrator berhasil diperbarui.
    admin_ok('Profil Administrator berhasil diperbarui.');

}catch(PDOException $e){

    // Menangani kesalahan yang berasal dari proses database.
    // Kode 23000 digunakan untuk mendeteksi pelanggaran constraint database,
    // seperti nama pengguna atau email yang sudah digunakan.
    if((string)$e->getCode()==='23000')admin_fail('Nama pengguna atau email sudah digunakan.',409);

    // Meneruskan kesalahan database ke fungsi penanganan exception.
    admin_exception($e);

}catch(Throwable $e){

    // Menangani kesalahan umum yang terjadi selama proses API berlangsung.
    admin_exception($e);
}