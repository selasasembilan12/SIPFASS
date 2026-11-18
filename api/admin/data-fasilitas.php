<?php
require_once __DIR__ . '/_admin-common.php';
try {
    $method=admin_method('GET','POST','PUT','DELETE');
    if ($method==='GET') {
        [$page,$limit,$offset]=admin_page(); $where=[]; $params=[];
        if (!empty($_GET['search'])) { $where[]='(f.kode_fasilitas LIKE :q OR f.nama_fasilitas LIKE :q OR f.lokasi_ruangan LIKE :q)'; $params[':q']='%'.trim($_GET['search']).'%'; }
        if (!empty($_GET['status']) && $_GET['status']!=='semua') { $where[]='f.status_fasilitas=:status'; $params[':status']=$_GET['status']; }
        if (!empty($_GET['kategori'])) { $where[]='f.id_kategori=:kategori'; $params[':kategori']=(int)$_GET['kategori']; }
        $clause=$where?'WHERE '.implode(' AND ',$where):'';
        $c=$pdo->prepare("SELECT COUNT(*) FROM fasilitas f $clause"); $c->execute($params); $total=(int)$c->fetchColumn();
        $s=$pdo->prepare("SELECT f.*, k.nama_kategori, u.nama_lengkap AS nama_penginput
            FROM fasilitas f LEFT JOIN kategori_fasilitas k ON k.id_kategori=f.id_kategori
            LEFT JOIN pengguna u ON u.id_pengguna=f.id_penginput $clause
            ORDER BY f.id_fasilitas DESC LIMIT :lim OFFSET :off");
        foreach($params as $k=>$v)$s->bindValue($k,$v); $s->bindValue(':lim',$limit,PDO::PARAM_INT);$s->bindValue(':off',$offset,PDO::PARAM_INT);$s->execute();
        admin_ok('Data fasilitas berhasil dimuat.',['items'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total]]);
    }
    $in=admin_input();
    if($method==='POST'){
        $s=$pdo->prepare("INSERT INTO fasilitas (kode_fasilitas,nama_fasilitas,id_kategori,lokasi_ruangan,jumlah_unit,frekuensi_penggunaan,status_fasilitas,id_penginput)
            VALUES (:kode,:nama,:kategori,:lokasi,:jumlah,:frekuensi,:status,:penginput)");
        $s->execute([
            ':kode'=>admin_text($in,'kode_fasilitas',30), ':nama'=>admin_text($in,'nama_fasilitas',150),
            ':kategori'=>(int)($in['id_kategori']??0), ':lokasi'=>admin_text($in,'lokasi_ruangan',150),
            ':jumlah'=>max(0,(int)($in['jumlah_unit']??0)), ':frekuensi'=>admin_text($in,'frekuensi_penggunaan',50),
            ':status'=>$in['status_fasilitas']??'Aktif', ':penginput'=>admin_user_id()
        ]);
        admin_ok('Fasilitas berhasil ditambahkan.',['id_fasilitas'=>(int)$pdo->lastInsertId()],201);
    }
    $id=admin_id($in,'id_fasilitas');
    if($method==='PUT'){
        $s=$pdo->prepare("UPDATE fasilitas SET kode_fasilitas=:kode,nama_fasilitas=:nama,id_kategori=:kategori,lokasi_ruangan=:lokasi,jumlah_unit=:jumlah,frekuensi_penggunaan=:frekuensi,status_fasilitas=:status WHERE id_fasilitas=:id");
        $s->execute([':kode'=>admin_text($in,'kode_fasilitas',30),':nama'=>admin_text($in,'nama_fasilitas',150),':kategori'=>(int)($in['id_kategori']??0),':lokasi'=>admin_text($in,'lokasi_ruangan',150),':jumlah'=>max(0,(int)($in['jumlah_unit']??0)),':frekuensi'=>admin_text($in,'frekuensi_penggunaan',50),':status'=>$in['status_fasilitas']??'Aktif',':id'=>$id]);
        if(!$s->rowCount()) { $c=$pdo->prepare("SELECT 1 FROM fasilitas WHERE id_fasilitas=?");$c->execute([$id]);if(!$c->fetchColumn())admin_fail('Fasilitas tidak ditemukan.',404); }
        admin_ok('Fasilitas berhasil diperbarui.');
    }
    $s=$pdo->prepare("DELETE FROM fasilitas WHERE id_fasilitas=:id");$s->execute([':id'=>$id]);
    if(!$s->rowCount())admin_fail('Fasilitas tidak ditemukan.',404);
    admin_ok('Fasilitas berhasil dihapus.');
} catch(PDOException $e){if((string)$e->getCode()==='23000')admin_fail('Kode fasilitas sudah digunakan atau fasilitas masih terkait laporan.',409);admin_exception($e);}
catch(Throwable $e){admin_exception($e);}
