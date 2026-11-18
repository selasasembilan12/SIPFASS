
<?php
// Memanggil file pendukung Administrator yang berisi konfigurasi,
// koneksi database, session, autentikasi, dan fungsi API.
require_once __DIR__ . '/_admin-common.php';

try{
    // Menentukan metode HTTP yang diperbolehkan pada API,
    // yaitu GET untuk mengambil data, POST untuk menambahkan data,
    // PUT untuk memperbarui data, dan DELETE untuk menghapus data.
    $method=admin_method('GET','POST','PUT','DELETE');

    // Memeriksa apakah permintaan menggunakan metode GET
    // untuk mengambil dan menampilkan data pengguna.
    if($method==='GET'){

        // Mengambil informasi halaman, batas jumlah data,
        // dan posisi awal data untuk kebutuhan pagination.
        // Menyiapkan array untuk menampung kondisi filter dan parameternya.
        [$page,$limit,$offset]=admin_page();$where=[];$params=[];

        // Memeriksa apakah terdapat kata kunci pencarian dari pengguna.
        // Pencarian dilakukan berdasarkan nama lengkap, nama pengguna,
        // email, atau nomor identitas.
        if(!empty($_GET['search'])){$where[]='(u.nama_lengkap LIKE :q OR u.nama_pengguna LIKE :q OR u.email LIKE :q OR u.nomor_identitas LIKE :q)';$params[':q']='%'.trim($_GET['search']).'%';}

        // Memeriksa apakah pengguna memilih filter berdasarkan peran.
        // Jika tersedia, data akan difilter berdasarkan ID peran pengguna.
        if(!empty($_GET['peran'])){$where[]='u.id_peran=:role';$params[':role']=(int)$_GET['peran'];}

        // Memeriksa apakah pengguna memilih filter berdasarkan status akun.
        // Jika tersedia, data akan ditampilkan sesuai status akun yang dipilih.
        if(!empty($_GET['status'])){$where[]='u.status_akun=:status';$params[':status']=$_GET['status'];}

        // Menggabungkan seluruh kondisi pencarian dan filter
        // menjadi klausa WHERE untuk digunakan dalam query SQL.
        // Jika tidak ada kondisi filter, klausa WHERE dikosongkan.
        $clause=$where?'WHERE '.implode(' AND ',$where):'';

        // Menyiapkan query untuk menghitung jumlah seluruh pengguna
        // berdasarkan kondisi pencarian dan filter yang telah ditentukan.
        $c=$pdo->prepare("SELECT COUNT(*) FROM pengguna u $clause");

        // Menjalankan query penghitungan jumlah pengguna
        // dan menyimpan hasilnya ke dalam variabel total.
        $c->execute($params);$total=(int)$c->fetchColumn();

        // Menyiapkan query untuk mengambil data pengguna
        // sekaligus nama peran dari tabel peran.
        // Data yang diambil mencakup identitas pengguna,
        // informasi akun, foto profil, status, dan tanggal pencatatan.
        // Data diurutkan berdasarkan ID pengguna terbaru
        // dan dibatasi sesuai halaman pagination.
        $s=$pdo->prepare("SELECT u.id_pengguna,u.id_peran,p.nama_peran,u.nama_lengkap,u.nomor_identitas,u.nama_pengguna,u.email,u.unit_kerja,u.foto_profil,u.status_akun,u.email_terverifikasi_pada,u.tanggal_dibuat,u.tanggal_diperbarui FROM pengguna u JOIN peran p ON p.id_peran=u.id_peran $clause ORDER BY u.id_pengguna DESC LIMIT :lim OFFSET :off");

        // Mengikat seluruh parameter pencarian dan filter ke dalam query.
        // Parameter limit dan offset menggunakan tipe integer
        // untuk menentukan jumlah data dan posisi awal pengambilan data.
        foreach($params as $k=>$v)$s->bindValue($k,$v);$s->bindValue(':lim',$limit,PDO::PARAM_INT);$s->bindValue(':off',$offset,PDO::PARAM_INT);$s->execute();

        // Mengirimkan respons berhasil yang berisi daftar pengguna,
        // informasi pagination, serta daftar seluruh peran yang tersedia.
        // Data peran digunakan untuk mendukung pilihan filter atau pengelolaan pengguna.
        admin_ok('Data pengguna berhasil dimuat.',['items'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total],'roles'=>$pdo->query("SELECT id_peran,nama_peran FROM peran ORDER BY id_peran")->fetchAll()]);
    }

    // Mengambil data input yang dikirimkan dari halaman manajemen pengguna.
    $in=admin_input();

    // Memeriksa apakah metode yang digunakan adalah POST
    // untuk menambahkan akun pengguna baru ke database.
    if($method==='POST'){

        // Mengambil kata sandi dari data input.
        // Jika panjang kata sandi kurang dari 8 karakter,
        // proses penambahan pengguna ditolak dengan status HTTP 422.
        $password=(string)($in['kata_sandi']??'');if(strlen($password)<8)admin_fail('Kata sandi minimal 8 karakter.',422);

        // Menyiapkan query INSERT untuk menyimpan akun pengguna baru.
        // Data yang disimpan meliputi peran, identitas, nama pengguna,
        // email, kata sandi, unit kerja, status akun, waktu verifikasi email,
        // serta ID Administrator yang membuat akun tersebut.
        $s=$pdo->prepare("INSERT INTO pengguna (id_peran,nama_lengkap,nomor_identitas,nama_pengguna,email,kata_sandi,unit_kerja,status_akun,email_terverifikasi_pada,dibuat_oleh) VALUES (:role,:nama,:nomor,:username,:email,:password,:unit,:status,NOW(),:creator)");

        // Menjalankan query INSERT dengan mengisi seluruh parameter.
        // Kata sandi diubah menjadi hash menggunakan password_hash()
        // sebelum disimpan ke dalam database agar tidak tersimpan sebagai teks biasa.
        // ID Administrator yang sedang login dicatat sebagai pembuat akun.
        $s->execute([':role'=>(int)($in['id_peran']??0),':nama'=>admin_text($in,'nama_lengkap',150),':nomor'=>admin_text($in,'nomor_identitas',50),':username'=>admin_text($in,'nama_pengguna',50),':email'=>admin_text($in,'email',150),':password'=>password_hash($password,PASSWORD_DEFAULT),':unit'=>admin_text($in,'unit_kerja',150,false),':status'=>$in['status_akun']??'Aktif',':creator'=>admin_user_id()]);

        // Mengirimkan respons berhasil setelah akun pengguna ditambahkan.
        // ID pengguna yang baru dibuat turut dikirimkan dalam respons.
        // Status HTTP 201 menunjukkan bahwa data berhasil dibuat.
        admin_ok('Pengguna berhasil ditambahkan.',['id_pengguna'=>(int)$pdo->lastInsertId()],201);
    }

    // Mengambil ID pengguna dari data input
    // sebagai identitas akun yang akan diperbarui atau dihapus.
    $id=admin_id($in,'id_pengguna');

    // Memeriksa apakah ID pengguna yang dipilih sama dengan
    // ID Administrator yang sedang login.
    // Akun Administrator yang sedang digunakan tidak boleh diubah atau dihapus
    // melalui menu manajemen pengguna.
    if($id===admin_user_id())admin_fail('Akun Administrator yang sedang digunakan tidak dapat diubah atau dihapus melalui menu ini.',409);

    // Memeriksa apakah metode yang digunakan adalah PUT
    // untuk memperbarui informasi akun pengguna yang sudah tersimpan.
    if($method==='PUT'){

        // Menyiapkan query UPDATE untuk memperbarui data pengguna
        // meliputi peran, nama lengkap, nomor identitas, nama pengguna,
        // email, unit kerja, dan status akun.
        $sql="UPDATE pengguna SET id_peran=:role,nama_lengkap=:nama,nomor_identitas=:nomor,nama_pengguna=:username,email=:email,unit_kerja=:unit,status_akun=:status";

        // Menyiapkan parameter untuk mengisi nilai data pengguna
        // yang akan diperbarui berdasarkan input dari halaman.
        $params=[':role'=>(int)($in['id_peran']??0),':nama'=>admin_text($in,'nama_lengkap',150),':nomor'=>admin_text($in,'nomor_identitas',50),':username'=>admin_text($in,'nama_pengguna',50),':email'=>admin_text($in,'email',150),':unit'=>admin_text($in,'unit_kerja',150,false),':status'=>$in['status_akun']??'Aktif',':id'=>$id];

        // Memeriksa apakah Administrator memasukkan kata sandi baru.
        // Jika diisi, sistem memeriksa panjang minimal 8 karakter,
        // kemudian menambahkan kolom kata_sandi ke query UPDATE.
        // Kata sandi baru diubah menjadi hash sebelum disimpan ke database.
        if(!empty($in['kata_sandi'])){if(strlen((string)$in['kata_sandi'])<8)admin_fail('Kata sandi minimal 8 karakter.',422);$sql.=",kata_sandi=:password";$params[':password']=password_hash((string)$in['kata_sandi'],PASSWORD_DEFAULT);}

        // Menambahkan kondisi WHERE berdasarkan ID pengguna,
        // menyiapkan query UPDATE, menjalankannya,
        // dan mengirimkan respons bahwa data pengguna berhasil diperbarui.
        $sql.=" WHERE id_pengguna=:id";$s=$pdo->prepare($sql);$s->execute($params);admin_ok('Data pengguna berhasil diperbarui.');
    }

    // Menyiapkan query DELETE untuk menghapus akun pengguna
    // berdasarkan ID pengguna yang telah diterima.
    $s=$pdo->prepare("DELETE FROM pengguna WHERE id_pengguna=:id");

    // Menjalankan query DELETE dengan parameter ID pengguna.
    $s->execute([':id'=>$id]);

    // Memeriksa apakah terdapat akun pengguna yang berhasil dihapus.
    // Jika tidak ada baris yang terhapus, sistem mengirimkan respons HTTP 404.
    if(!$s->rowCount())admin_fail('Pengguna tidak ditemukan.',404);

    // Mengirimkan respons bahwa akun pengguna berhasil dihapus.
    admin_ok('Pengguna berhasil dihapus.');

}catch(PDOException $e){

    // Menangani kesalahan yang berasal dari database.
    // Kode error 23000 menunjukkan pelanggaran constraint database,
    // misalnya nomor identitas, nama pengguna, atau email sudah digunakan.
    if((string)$e->getCode()==='23000')admin_fail('Nomor identitas, nama pengguna, atau email sudah digunakan.',409);

    // Meneruskan kesalahan database ke fungsi penanganan exception.
    admin_exception($e);

}catch(Throwable $e){

    // Menangani kesalahan umum yang terjadi selama proses API berlangsung.
    admin_exception($e);
}
