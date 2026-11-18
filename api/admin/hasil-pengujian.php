<?php
require_once __DIR__ . '/_admin-common.php';
try{
    admin_method('GET');
    $id=isset($_GET['id_pelatihan'])?(int)$_GET['id_pelatihan']:0;
    if($id>0){
        $s=$pdo->prepare("SELECT * FROM riwayat_pelatihan_c45 WHERE id_pelatihan=:id LIMIT 1");$s->execute([':id'=>$id]);$history=$s->fetch();
        if(!$history)admin_fail('Riwayat pengujian tidak ditemukan.',404);
        $d=$pdo->prepare("SELECT * FROM detail_pelatihan_c45 WHERE id_pelatihan=:id ORDER BY id_detail ASC");$d->execute([':id'=>$id]);
        $a=$pdo->prepare("SELECT * FROM perhitungan_atribut_c45 WHERE id_pelatihan=:id ORDER BY id_perhitungan ASC");$a->execute([':id'=>$id]);
        admin_ok('Detail hasil pengujian berhasil dimuat.',['history'=>$history,'details'=>$d->fetchAll(),'attribute_calculations'=>$a->fetchAll()]);
    }
    [$page,$limit,$offset]=admin_page();
    $total=(int)$pdo->query("SELECT COUNT(*) FROM riwayat_pelatihan_c45")->fetchColumn();
    $s=$pdo->prepare("SELECT * FROM riwayat_pelatihan_c45 ORDER BY id_pelatihan DESC LIMIT :lim OFFSET :off");
    $s->bindValue(':lim',$limit,PDO::PARAM_INT);$s->bindValue(':off',$offset,PDO::PARAM_INT);$s->execute();
    admin_ok('Hasil pengujian berhasil dimuat.',['items'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total]]);
}catch(Throwable $e){admin_exception($e);}
