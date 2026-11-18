<?php
require_once __DIR__ . '/_admin-common.php';
try{
    $method=admin_method('GET','POST');
    if($method==='GET'){
        [$page,$limit,$offset]=admin_page();
        $total=(int)$pdo->query("SELECT COUNT(*) FROM riwayat_pelatihan_c45")->fetchColumn();
        $s=$pdo->prepare("SELECT * FROM riwayat_pelatihan_c45 ORDER BY id_pelatihan DESC LIMIT :lim OFFSET :off");
        $s->bindValue(':lim',$limit,PDO::PARAM_INT);$s->bindValue(':off',$offset,PDO::PARAM_INT);$s->execute();
        admin_ok('Riwayat pelatihan C4.5 berhasil dimuat.',['items'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total]]);
    }
    $in=admin_input();
    // Endpoint ini menyimpan ringkasan hasil yang dikirim modul/service C4.5.
    // Perhitungan algoritma tidak dibuat ulang di endpoint CRUD ini.
    $required=['persentase_latih','persentase_uji','jumlah_dataset','jumlah_data_latih','jumlah_data_uji'];
    foreach($required as $key)if(!isset($in[$key]))admin_fail("Data {$key} wajib dikirim oleh proses pelatihan.",422);
    $s=$pdo->prepare("INSERT INTO riwayat_pelatihan_c45
        (waktu_dijalankan,persentase_latih,persentase_uji,jumlah_dataset,jumlah_data_latih,jumlah_data_uji,atribut_akar,struktur_pohon,akurasi,presisi,recall,skor_f1,tingkat_kesalahan,status_model,id_pengolah)
        VALUES (NOW(),:pl,:pu,:jd,:jdl,:jdu,:akar,:pohon,:akurasi,:presisi,:recall,:f1,:error,:status,:user)");
    $s->execute([
        ':pl'=>(float)$in['persentase_latih'],':pu'=>(float)$in['persentase_uji'],
        ':jd'=>(int)$in['jumlah_dataset'],':jdl'=>(int)$in['jumlah_data_latih'],':jdu'=>(int)$in['jumlah_data_uji'],
        ':akar'=>isset($in['atribut_akar'])?(string)$in['atribut_akar']:null,
        ':pohon'=>isset($in['struktur_pohon'])?json_encode($in['struktur_pohon'],JSON_UNESCAPED_UNICODE):null,
        ':akurasi'=>isset($in['akurasi'])?(float)$in['akurasi']:null,
        ':presisi'=>isset($in['presisi'])?(float)$in['presisi']:null,
        ':recall'=>isset($in['recall'])?(float)$in['recall']:null,
        ':f1'=>isset($in['skor_f1'])?(float)$in['skor_f1']:null,
        ':error'=>isset($in['tingkat_kesalahan'])?(float)$in['tingkat_kesalahan']:null,
        ':status'=>$in['status_model']??'Aktif',':user'=>admin_user_id()
    ]);
    admin_ok('Hasil pelatihan berhasil disimpan.',['id_pelatihan'=>(int)$pdo->lastInsertId()],201);
}catch(PDOException $e){admin_exception($e);}catch(Throwable $e){admin_exception($e);}
