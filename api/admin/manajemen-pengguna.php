<?php
require_once __DIR__ . '/_admin-common.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(__DIR__, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

try{
    $method=admin_method('GET','POST','PUT','DELETE');
    if($method==='GET'){
        [$page,$limit,$offset]=admin_page();$where=[];$params=[];
        if(!empty($_GET['search'])){$where[]='(u.nama_lengkap LIKE :q OR u.nama_pengguna LIKE :q OR u.email LIKE :q OR u.nomor_identitas LIKE :q)';$params[':q']='%'.trim($_GET['search']).'%';}
        if(!empty($_GET['peran'])){$where[]='u.id_peran=:role';$params[':role']=(int)$_GET['peran'];}
        if(!empty($_GET['status'])){$where[]='u.status_akun=:status';$params[':status']=$_GET['status'];}
        $clause=$where?'WHERE '.implode(' AND ',$where):'';
        $c=$pdo->prepare("SELECT COUNT(*) FROM pengguna u $clause");$c->execute($params);$total=(int)$c->fetchColumn();
        $s=$pdo->prepare("SELECT u.id_pengguna,u.id_peran,p.nama_peran,u.nama_lengkap,u.nomor_identitas,u.nama_pengguna,u.email,u.unit_kerja,u.foto_profil,u.status_akun,u.email_terverifikasi_pada,u.tanggal_dibuat,u.tanggal_diperbarui FROM pengguna u JOIN peran p ON p.id_peran=u.id_peran $clause ORDER BY u.id_pengguna DESC LIMIT :lim OFFSET :off");
        foreach($params as $k=>$v)$s->bindValue($k,$v);$s->bindValue(':lim',$limit,PDO::PARAM_INT);$s->bindValue(':off',$offset,PDO::PARAM_INT);$s->execute();
        admin_ok('Data pengguna berhasil dimuat.',['items'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total],'roles'=>$pdo->query("SELECT id_peran,nama_peran FROM peran ORDER BY id_peran")->fetchAll()]);
    }
    $in=admin_input();
    if($method==='POST'){
        $password=(string)($in['kata_sandi']??'');if(strlen($password)<8)admin_fail('Kata sandi minimal 8 karakter.',422);
        $s=$pdo->prepare("INSERT INTO pengguna (id_peran,nama_lengkap,nomor_identitas,nama_pengguna,email,kata_sandi,unit_kerja,status_akun,email_terverifikasi_pada,dibuat_oleh) VALUES (:role,:nama,:nomor,:username,:email,:password,:unit,:status,NOW(),:creator)");
        $s->execute([':role'=>(int)($in['id_peran']??0),':nama'=>admin_text($in,'nama_lengkap',150),':nomor'=>admin_text($in,'nomor_identitas',50),':username'=>admin_text($in,'nama_pengguna',50),':email'=>admin_text($in,'email',150),':password'=>password_hash($password,PASSWORD_DEFAULT),':unit'=>admin_text($in,'unit_kerja',150,false),':status'=>$in['status_akun']??'Aktif',':creator'=>admin_user_id()]);
        admin_ok('Pengguna berhasil ditambahkan.',['id_pengguna'=>(int)$pdo->lastInsertId()],201);
    }
    $id=admin_id($in,'id_pengguna');
    if($id===admin_user_id())admin_fail('Akun Administrator yang sedang digunakan tidak dapat diubah atau dihapus melalui menu ini.',409);
    if($method==='PUT'){
        $sql="UPDATE pengguna SET id_peran=:role,nama_lengkap=:nama,nomor_identitas=:nomor,nama_pengguna=:username,email=:email,unit_kerja=:unit,status_akun=:status";
        $params=[':role'=>(int)($in['id_peran']??0),':nama'=>admin_text($in,'nama_lengkap',150),':nomor'=>admin_text($in,'nomor_identitas',50),':username'=>admin_text($in,'nama_pengguna',50),':email'=>admin_text($in,'email',150),':unit'=>admin_text($in,'unit_kerja',150,false),':status'=>$in['status_akun']??'Aktif',':id'=>$id];
        if(!empty($in['kata_sandi'])){if(strlen((string)$in['kata_sandi'])<8)admin_fail('Kata sandi minimal 8 karakter.',422);$sql.=",kata_sandi=:password";$params[':password']=password_hash((string)$in['kata_sandi'],PASSWORD_DEFAULT);}
        $sql.=" WHERE id_pengguna=:id";$s=$pdo->prepare($sql);$s->execute($params);admin_ok('Data pengguna berhasil diperbarui.');
    }
    $s=$pdo->prepare("DELETE FROM pengguna WHERE id_pengguna=:id");$s->execute([':id'=>$id]);
    if(!$s->rowCount())admin_fail('Pengguna tidak ditemukan.',404);
    admin_ok('Pengguna berhasil dihapus.');
}catch(PDOException $e){if((string)$e->getCode()==='23000')admin_fail('Nomor identitas, nama pengguna, atau email sudah digunakan.',409);admin_exception($e);}
catch(Throwable $e){admin_exception($e);}
