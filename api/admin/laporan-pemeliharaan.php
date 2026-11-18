<?php
require_once __DIR__ . '/_admin-common.php';
try{
    admin_method('GET');
    [$page,$limit,$offset]=admin_page();$where=[];$params=[];
    if(!empty($_GET['search'])){$where[]='(lk.kode_laporan LIKE :q OR f.nama_fasilitas LIKE :q OR u.nama_lengkap LIKE :q)';$params[':q']='%'.trim($_GET['search']).'%';}
    if(!empty($_GET['status'])){$where[]='lk.status_laporan=:status';$params[':status']=$_GET['status'];}
    $clause=$where?'WHERE '.implode(' AND ',$where):'';
    $c=$pdo->prepare("SELECT COUNT(*) FROM laporan_kerusakan lk LEFT JOIN fasilitas f ON f.id_fasilitas=lk.id_fasilitas LEFT JOIN pengguna u ON u.id_pengguna=lk.id_pelapor $clause");
    $c->execute($params);$total=(int)$c->fetchColumn();
    $sql="SELECT lk.*,f.kode_fasilitas,f.nama_fasilitas,f.lokasi_ruangan,u.nama_lengkap AS nama_pelapor,u.nomor_identitas,
        rv.hasil_verifikasi,rv.prioritas_sebelum,rv.prioritas_sesudah,rv.catatan_verifikasi,rv.waktu_verifikasi,
        rp.tindak_lanjut_perbaikan,rp.catatan_petugas,rp.waktu_mulai_penanganan,rp.waktu_selesai_penanganan,rp.waktu_pembaruan
        FROM laporan_kerusakan lk
        LEFT JOIN fasilitas f ON f.id_fasilitas=lk.id_fasilitas
        LEFT JOIN pengguna u ON u.id_pengguna=lk.id_pelapor
        LEFT JOIN riwayat_verifikasi_laporan rv ON rv.id_riwayat_verifikasi=(SELECT MAX(r2.id_riwayat_verifikasi) FROM riwayat_verifikasi_laporan r2 WHERE r2.id_laporan=lk.id_laporan)
        LEFT JOIN riwayat_penanganan rp ON rp.id_riwayat_penanganan=(SELECT MAX(p2.id_riwayat_penanganan) FROM riwayat_penanganan p2 WHERE p2.id_laporan=lk.id_laporan)
        $clause ORDER BY lk.id_laporan DESC LIMIT :lim OFFSET :off";
    $s=$pdo->prepare($sql);foreach($params as $k=>$v)$s->bindValue($k,$v);$s->bindValue(':lim',$limit,PDO::PARAM_INT);$s->bindValue(':off',$offset,PDO::PARAM_INT);$s->execute();
    admin_ok('Laporan pemeliharaan berhasil dimuat.',['items'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total]]);
}catch(Throwable $e){admin_exception($e);}
