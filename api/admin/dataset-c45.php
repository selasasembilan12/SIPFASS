<?php
require_once __DIR__ . '/_admin-common.php';
try {
    $method=admin_method('GET','POST','PUT','DELETE');
    if($method==='GET'){
        [$page,$limit,$offset]=admin_page();$where=[];$params=[];
        if(!empty($_GET['search'])){$where[]='(kode_data LIKE :q OR nama_fasilitas LIKE :q)';$params[':q']='%'.trim($_GET['search']).'%';}
        foreach(['x1'=>'tingkat_kerusakan_x1','x2'=>'dampak_akademik_x2','x3'=>'frekuensi_penggunaan_x3','label'=>'label_prioritas'] as $key=>$col){
            if(isset($_GET[$key]) && $_GET[$key]!=='' && $_GET[$key]!=='semua'){$where[]="$col=:f_$key";$params[":f_$key"]=$_GET[$key];}
        }
        $clause=$where?'WHERE '.implode(' AND ',$where):'';
        $c=$pdo->prepare("SELECT COUNT(*) FROM dataset_c45 $clause");$c->execute($params);$total=(int)$c->fetchColumn();
        $s=$pdo->prepare("SELECT d.*,u.nama_lengkap AS nama_penginput FROM dataset_c45 d LEFT JOIN pengguna u ON u.id_pengguna=d.id_penginput $clause ORDER BY d.id_data DESC LIMIT :lim OFFSET :off");
        foreach($params as $k=>$v)$s->bindValue($k,$v);$s->bindValue(':lim',$limit,PDO::PARAM_INT);$s->bindValue(':off',$offset,PDO::PARAM_INT);$s->execute();
        admin_ok('Dataset C4.5 berhasil dimuat.',['items'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total]]);
    }
    $in=admin_input();
    if($method==='POST'){
        $s=$pdo->prepare("INSERT INTO dataset_c45 (kode_data,nama_fasilitas,tingkat_kerusakan_x1,dampak_akademik_x2,frekuensi_penggunaan_x3,label_prioritas,sumber_data,id_penginput)
            VALUES (:kode,:nama,:x1,:x2,:x3,:label,:sumber,:user)");
        $s->execute([
            ':kode'=>admin_text($in,'kode_data',30),':nama'=>admin_text($in,'nama_fasilitas',150),
            ':x1'=>(int)($in['tingkat_kerusakan_x1']??0),':x2'=>(int)($in['dampak_akademik_x2']??0),
            ':x3'=>(int)($in['frekuensi_penggunaan_x3']??0),':label'=>admin_text($in,'label_prioritas',20),
            ':sumber'=>admin_text($in,'sumber_data',50),':user'=>admin_user_id()
        ]);
        admin_ok('Data dataset berhasil ditambahkan.',['id_data'=>(int)$pdo->lastInsertId()],201);
    }
    $id=admin_id($in,'id_data');
    if($method==='PUT'){
        $s=$pdo->prepare("UPDATE dataset_c45 SET kode_data=:kode,nama_fasilitas=:nama,tingkat_kerusakan_x1=:x1,dampak_akademik_x2=:x2,frekuensi_penggunaan_x3=:x3,label_prioritas=:label,sumber_data=:sumber WHERE id_data=:id");
        $s->execute([':kode'=>admin_text($in,'kode_data',30),':nama'=>admin_text($in,'nama_fasilitas',150),':x1'=>(int)($in['tingkat_kerusakan_x1']??0),':x2'=>(int)($in['dampak_akademik_x2']??0),':x3'=>(int)($in['frekuensi_penggunaan_x3']??0),':label'=>admin_text($in,'label_prioritas',20),':sumber'=>admin_text($in,'sumber_data',50),':id'=>$id]);
        admin_ok('Data dataset berhasil diperbarui.');
    }
    $s=$pdo->prepare("DELETE FROM dataset_c45 WHERE id_data=:id");$s->execute([':id'=>$id]);
    if(!$s->rowCount())admin_fail('Data dataset tidak ditemukan.',404);
    admin_ok('Data dataset berhasil dihapus.');
}catch(PDOException $e){if((string)$e->getCode()==='23000')admin_fail('Kode dataset sudah digunakan atau data sedang dipakai riwayat pelatihan.',409);admin_exception($e);}
catch(Throwable $e){admin_exception($e);}
