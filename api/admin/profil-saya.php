<?php
require_once __DIR__ . '/_admin-common.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(_DIR_, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

try{
    $method=admin_method('GET','POST','PUT');
    $id=admin_user_id();if($id<1)admin_fail('Sesi Administrator tidak valid.',401);
    if($method==='GET'){
        $s=$pdo->prepare("SELECT u.id_pengguna,u.id_peran,u.nama_lengkap,u.nomor_identitas,u.nama_pengguna,u.email,u.unit_kerja,u.foto_profil,u.status_akun,u.email_terverifikasi_pada,p.nama_peran FROM pengguna u JOIN peran p ON p.id_peran=u.id_peran WHERE u.id_pengguna=:id LIMIT 1");
        $s->execute([':id'=>$id]);$user=$s->fetch();if(!$user)admin_fail('Profil Administrator tidak ditemukan.',404);
        admin_ok('Profil Administrator berhasil dimuat.',$user);
    }
    $in=admin_input();
    $s=$pdo->prepare("UPDATE pengguna SET nama_lengkap=:nama,nama_pengguna=:username,email=:email,unit_kerja=:unit WHERE id_pengguna=:id");
    $s->execute([':nama'=>admin_text($in,'nama_lengkap',150),':username'=>admin_text($in,'nama_pengguna',50),':email'=>admin_text($in,'email',150),':unit'=>admin_text($in,'unit_kerja',150,false),':id'=>$id]);
    // Sinkronkan nama yang disimpan pada session agar header aplikasi konsisten.
    if(isset($_SESSION['user']) && is_array($_SESSION['user'])){
        $_SESSION['user']['nama_lengkap']=trim((string)$in['nama_lengkap']);
        $_SESSION['user']['nama_pengguna']=trim((string)$in['nama_pengguna']);
    }
    admin_ok('Profil Administrator berhasil diperbarui.');
}catch(PDOException $e){if((string)$e->getCode()==='23000')admin_fail('Nama pengguna atau email sudah digunakan.',409);admin_exception($e);}
catch(Throwable $e){admin_exception($e);}
