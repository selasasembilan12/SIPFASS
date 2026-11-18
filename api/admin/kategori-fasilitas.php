<?php
require_once __DIR__ . '/_admin-common.php';
try {
    $method = admin_method('GET','POST','PUT','DELETE');
    if ($method === 'GET') {
        [$page,$limit,$offset] = admin_page();
        $where = []; $params = [];
        if (!empty($_GET['search'])) {
            $where[] = '(kode_kategori LIKE :q OR nama_kategori LIKE :q)';
            $params[':q'] = '%' . trim($_GET['search']) . '%';
        }
        if (!empty($_GET['status']) && $_GET['status'] !== 'semua') {
            $where[] = 'status_kategori = :status'; $params[':status'] = $_GET['status'];
        }
        $clause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $count = $pdo->prepare("SELECT COUNT(*) FROM kategori_fasilitas $clause");
        $count->execute($params); $total = (int)$count->fetchColumn();
        $stmt = $pdo->prepare("SELECT k.*,
            (SELECT COUNT(*) FROM fasilitas f WHERE f.id_kategori=k.id_kategori) AS jumlah_fasilitas
            FROM kategori_fasilitas k $clause ORDER BY k.id_kategori DESC LIMIT :lim OFFSET :off");
        foreach ($params as $k=>$v) $stmt->bindValue($k,$v);
        $stmt->bindValue(':lim',$limit,PDO::PARAM_INT); $stmt->bindValue(':off',$offset,PDO::PARAM_INT);
        $stmt->execute();
        admin_ok('Data kategori berhasil dimuat.', ['items'=>$stmt->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total]]);
    }
    $in = admin_input();
    if ($method === 'POST') {
        $kode=admin_text($in,'kode_kategori',20); $nama=admin_text($in,'nama_kategori',100);
        $desc=admin_text($in,'deskripsi',10000,false);
        $status=$in['status_kategori'] ?? 'Aktif';
        if (!in_array($status,['Aktif','Nonaktif'],true)) admin_fail('Status kategori tidak valid.',422);
        $st=$pdo->prepare("INSERT INTO kategori_fasilitas (kode_kategori,nama_kategori,deskripsi,status_kategori) VALUES (:kode,:nama,:deskripsi,:status)");
        $st->execute([':kode'=>$kode,':nama'=>$nama,':deskripsi'=>$desc,':status'=>$status]);
        admin_ok('Kategori berhasil ditambahkan.',['id_kategori'=>(int)$pdo->lastInsertId()],201);
    }
    $id=admin_id($in,'id_kategori');
    if ($method === 'PUT') {
        $st=$pdo->prepare("UPDATE kategori_fasilitas SET kode_kategori=:kode,nama_kategori=:nama,deskripsi=:deskripsi,status_kategori=:status WHERE id_kategori=:id");
        $st->execute([':kode'=>admin_text($in,'kode_kategori',20),':nama'=>admin_text($in,'nama_kategori',100),':deskripsi'=>admin_text($in,'deskripsi',10000,false),':status'=>$in['status_kategori'] ?? 'Aktif',':id'=>$id]);
        admin_ok('Kategori berhasil diperbarui.');
    }
    $check=$pdo->prepare("SELECT COUNT(*) FROM fasilitas WHERE id_kategori=:id"); $check->execute([':id'=>$id]);
    if ((int)$check->fetchColumn()>0) admin_fail('Kategori tidak dapat dihapus karena masih digunakan fasilitas.',409);
    $st=$pdo->prepare("DELETE FROM kategori_fasilitas WHERE id_kategori=:id"); $st->execute([':id'=>$id]);
    if (!$st->rowCount()) admin_fail('Kategori tidak ditemukan.',404);
    admin_ok('Kategori berhasil dihapus.');
} catch (PDOException $e) {
    if ((string)$e->getCode()==='23000') admin_fail('Kode atau nama kategori sudah digunakan.',409);
    admin_exception($e);
} catch (Throwable $e) { admin_exception($e); }
