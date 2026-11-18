
<?php
// Memanggil file pendukung Administrator yang berisi konfigurasi,
// koneksi database, session, autentikasi, dan fungsi API.
require_once __DIR__ . '/_admin-common.php';

try{
    // Menentukan metode HTTP yang diperbolehkan pada API,
    // yaitu GET untuk mengambil data profil,
    // POST dan PUT untuk memperbarui data profil Administrator.
    $method=admin_method('GET','POST','PUT');

    // Mengambil ID Administrator yang sedang login.
    // Jika ID kurang dari 1, proses dihentikan karena sesi tidak valid.
    $id=admin_user_id();if($id<1)admin_fail('Sesi Administrator tidak valid.',401);

    // Memeriksa apakah permintaan menggunakan metode GET
    // untuk mengambil data profil Administrator dari database.
    if($method==='GET'){

        // Menyiapkan query untuk mengambil informasi profil Administrator
        // dari tabel pengguna dan nama peran dari tabel peran.
        // Pengambilan data dilakukan berdasarkan ID Administrator
        // yang sedang login dengan batas satu data.
        $s=$pdo->prepare("SELECT u.id_pengguna,u.id_peran,u.nama_lengkap,u.nomor_identitas,u.nama_pengguna,u.email,u.unit_kerja,u.foto_profil,u.status_akun,u.email_terverifikasi_pada,p.nama_peran FROM pengguna u JOIN peran p ON p.id_peran=u.id_peran WHERE u.id_pengguna=:id LIMIT 1");

        // Menjalankan query berdasarkan ID Administrator
        // dan mengambil hasilnya sebagai data profil pengguna.
        $s->execute([':id'=>$id]);$user=$s->fetch();

        // Memeriksa apakah data profil Administrator ditemukan.
        // Jika tidak ditemukan, sistem mengirimkan respons HTTP 404.
        if(!$user)admin_fail('Profil Administrator tidak ditemukan.',404);

        // Mengirimkan respons berhasil beserta seluruh data profil Administrator.
        admin_ok('Profil Administrator berhasil dimuat.',$user);
    }

    // Mengambil data input yang dikirimkan dari halaman profil Administrator.
    $in=admin_input();

    // Menyiapkan query UPDATE untuk memperbarui informasi profil Administrator
    // berupa nama lengkap, nama pengguna, email, dan unit kerja.
    // Pembaruan dilakukan berdasarkan ID Administrator yang sedang login.
    $s=$pdo->prepare("UPDATE pengguna SET nama_lengkap=:nama,nama_pengguna=:username,email=:email,unit_kerja=:unit WHERE id_pengguna=:id");

    // Menjalankan query UPDATE dengan mengisi parameter
    // berdasarkan data profil terbaru yang diterima dari halaman.
    // Fungsi admin_text digunakan untuk mengambil dan memvalidasi input.
    $s->execute([':nama'=>admin_text($in,'nama_lengkap',150),':username'=>admin_text($in,'nama_pengguna',50),':email'=>admin_text($in,'email',150),':unit'=>admin_text($in,'unit_kerja',150,false),':id'=>$id]);

    // Sinkronkan nama yang disimpan pada session agar header aplikasi konsisten.
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
    // Kode error 23000 menunjukkan pelanggaran constraint database,
    // misalnya nama pengguna atau email sudah digunakan oleh akun lain.
    if((string)$e->getCode()==='23000')admin_fail('Nama pengguna atau email sudah digunakan.',409);

    // Meneruskan kesalahan database ke fungsi penanganan exception.
    admin_exception($e);

}catch(Throwable $e){

    // Menangani kesalahan umum yang terjadi selama proses API berlangsung.
    admin_exception($e);
}
