<?php
declare(strict_types=1);


require_once __DIR__ . '/_admin-common.php';


/* ============================================================
   01. VALIDASI STATUS KATEGORI
============================================================ */

function admin_kategori_status(array $input): string
{
    $status = trim(
        (string)($input['status_kategori'] ?? 'Aktif')
    );

    if (!in_array($status, ['Aktif', 'Nonaktif'], true)) {
        admin_fail(
            'Status kategori harus Aktif atau Nonaktif.',
            422
        );
    }

    return $status;
}


/* ============================================================
   02. VALIDASI JUMLAH UNIT

   Minimal : 0
   Maksimal: Mengikuti kapasitas tipe data database.
============================================================ */

function admin_kategori_jumlah_unit(array $input): int
{
    $value = filter_var(
        $input['jumlah_unit'] ?? 0,
        FILTER_VALIDATE_INT
    );

    if ($value === false || $value < 0) {
        admin_fail(
            'Jumlah unit harus berupa bilangan bulat minimal 0.',
            422
        );
    }

    return (int)$value;
}


/* ============================================================
   03. MEMERIKSA KEBERADAAN KATEGORI
============================================================ */

function admin_kategori_exists(
    PDO $pdo,
    int $id
): bool {

    $stmt = $pdo->prepare("
        SELECT id_kategori
        FROM kategori_fasilitas
        WHERE id_kategori = :id
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $id
    ]);

    return (bool)$stmt->fetchColumn();
}


/* ============================================================
   04. PROSES API
============================================================ */

try {

    $method = admin_method(
        'GET',
        'POST',
        'PUT',
        'DELETE'
    );


    /* ========================================================
       05. GET - MENGAMBIL DATA KATEGORI
    ======================================================== */

    if ($method === 'GET') {

        /* PAGINATION */

        [$page, $limit, $offset] = admin_page();

        $where = [];
        $params = [];


        /* ----------------------------------------------------
           A. PENCARIAN KATEGORI
        ---------------------------------------------------- */

        if (
            isset($_GET['search']) &&
            trim((string)$_GET['search']) !== ''
        ) {

            $search = '%' . trim((string)$_GET['search']) . '%';

            $where[] = "(
                k.kode_kategori LIKE :search1
                OR k.nama_kategori LIKE :search2
                OR k.deskripsi LIKE :search3
            )";

            $params[':search1'] = $search;
            $params[':search2'] = $search;
            $params[':search3'] = $search;
        }


        /* ----------------------------------------------------
           B. FILTER STATUS
        ---------------------------------------------------- */

        if (
            isset($_GET['status']) &&
            $_GET['status'] !== '' &&
            $_GET['status'] !== 'semua'
        ) {

            $status = trim((string)$_GET['status']);

            if (!in_array($status, ['Aktif', 'Nonaktif'], true)) {
                admin_fail(
                    'Filter status kategori tidak valid.',
                    422
                );
            }

            $where[] = 'k.status_kategori = :status';

            $params[':status'] = $status;
        }


        /* ----------------------------------------------------
           C. MENYUSUN WHERE CLAUSE
        ---------------------------------------------------- */

        $clause = $where
            ? 'WHERE ' . implode(' AND ', $where)
            : '';


        /* ----------------------------------------------------
           D. MENGHITUNG TOTAL KATEGORI
        ---------------------------------------------------- */

        $count = $pdo->prepare("
            SELECT COUNT(*)
            FROM kategori_fasilitas k
            $clause
        ");

        $count->execute($params);

        $total = (int)$count->fetchColumn();


        /* ----------------------------------------------------
           E. MENGAMBIL DATA KATEGORI
        ---------------------------------------------------- */

        $stmt = $pdo->prepare("
            SELECT
                k.id_kategori,
                k.kode_kategori,
                k.nama_kategori,
                k.deskripsi,
                k.jumlah_unit,
                k.status_kategori,
                k.tanggal_dibuat,
                k.tanggal_diperbarui,

                (
                    SELECT COUNT(*)
                    FROM fasilitas f
                    WHERE f.id_kategori = k.id_kategori
                ) AS jumlah_fasilitas

            FROM kategori_fasilitas k

            $clause

            ORDER BY k.id_kategori DESC

            LIMIT :limit OFFSET :offset
        ");

        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }

        $stmt->bindValue(
            ':limit',
            $limit,
            PDO::PARAM_INT
        );

        $stmt->bindValue(
            ':offset',
            $offset,
            PDO::PARAM_INT
        );

        $stmt->execute();

        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);


        /* ----------------------------------------------------
           F. RESPONSE DATA
        ---------------------------------------------------- */

        admin_ok(
            'Data kategori berhasil dimuat.',
            [
                'items' => $items,

                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'total_pages' => (int)ceil($total / $limit)
                ]
            ]
        );
    }


    /* ========================================================
       06. MEMBACA INPUT POST, PUT, DAN DELETE
    ======================================================== */

    $input = admin_input();


    /* ========================================================
       07. POST - MENAMBAHKAN KATEGORI
    ======================================================== */

    if ($method === 'POST') {

        /* VALIDASI KODE */

        $kode = admin_text(
            $input,
            'kode_kategori',
            20
        );


        /* VALIDASI NAMA */

        $nama = admin_text(
            $input,
            'nama_kategori',
            100
        );


        /* VALIDASI DESKRIPSI */

        $deskripsi = admin_text(
            $input,
            'deskripsi',
            10000,
            false
        );


        /* VALIDASI JUMLAH UNIT */

        $jumlahUnit = admin_kategori_jumlah_unit(
            $input
        );


        /* VALIDASI STATUS */

        $status = admin_kategori_status(
            $input
        );


        /* MENYIMPAN KATEGORI */

        $stmt = $pdo->prepare("
            INSERT INTO kategori_fasilitas (
                kode_kategori,
                nama_kategori,
                deskripsi,
                jumlah_unit,
                status_kategori
            ) VALUES (
                :kode,
                :nama,
                :deskripsi,
                :jumlah_unit,
                :status
            )
        ");

        $stmt->execute([
            ':kode' => $kode,
            ':nama' => $nama,
            ':deskripsi' => $deskripsi,
            ':jumlah_unit' => $jumlahUnit,
            ':status' => $status
        ]);


        /* RESPONSE */

        admin_ok(
            'Kategori fasilitas berhasil ditambahkan.',
            [
                'id_kategori' => (int)$pdo->lastInsertId(),
                'kode_kategori' => $kode,
                'nama_kategori' => $nama,
                'jumlah_unit' => $jumlahUnit,
                'status_kategori' => $status
            ],
            201
        );
    }


    /* ========================================================
       08. VALIDASI ID KATEGORI
    ======================================================== */

    $id = admin_id(
        $input,
        'id_kategori'
    );


    /* ========================================================
       09. PUT - MEMPERBARUI KATEGORI
    ======================================================== */

    if ($method === 'PUT') {

        /* MEMERIKSA KATEGORI */

        if (!admin_kategori_exists($pdo, $id)) {
            admin_fail(
                'Kategori tidak ditemukan.',
                404
            );
        }


        /* VALIDASI KODE */

        $kode = admin_text(
            $input,
            'kode_kategori',
            20
        );


        /* VALIDASI NAMA */

        $nama = admin_text(
            $input,
            'nama_kategori',
            100
        );


        /* VALIDASI DESKRIPSI */

        $deskripsi = admin_text(
            $input,
            'deskripsi',
            10000,
            false
        );


        /* VALIDASI JUMLAH UNIT */

        $jumlahUnit = admin_kategori_jumlah_unit(
            $input
        );


        /* VALIDASI STATUS */

        $status = admin_kategori_status(
            $input
        );


        /* UPDATE DATABASE */

        $stmt = $pdo->prepare("
            UPDATE kategori_fasilitas
            SET
                kode_kategori = :kode,
                nama_kategori = :nama,
                deskripsi = :deskripsi,
                jumlah_unit = :jumlah_unit,
                status_kategori = :status

            WHERE id_kategori = :id
        ");

        $stmt->execute([
            ':kode' => $kode,
            ':nama' => $nama,
            ':deskripsi' => $deskripsi,
            ':jumlah_unit' => $jumlahUnit,
            ':status' => $status,
            ':id' => $id
        ]);


        /* RESPONSE */

        admin_ok(
            'Kategori fasilitas berhasil diperbarui.',
            [
                'id_kategori' => $id,
                'kode_kategori' => $kode,
                'nama_kategori' => $nama,
                'jumlah_unit' => $jumlahUnit,
                'status_kategori' => $status
            ]
        );
    }


    /* ========================================================
       10. DELETE - MENGHAPUS KATEGORI
    ======================================================== */

    if ($method === 'DELETE') {

        /* MEMERIKSA KEBERADAAN KATEGORI */

        if (!admin_kategori_exists($pdo, $id)) {
            admin_fail(
                'Kategori tidak ditemukan.',
                404
            );
        }


        /* ----------------------------------------------------
           A. MEMERIKSA RELASI FASILITAS
        ---------------------------------------------------- */

        $check = $pdo->prepare("
            SELECT COUNT(*)
            FROM fasilitas
            WHERE id_kategori = :id
        ");

        $check->execute([
            ':id' => $id
        ]);

        $jumlahFasilitas = (int)$check->fetchColumn();


        /* ----------------------------------------------------
           B. MENCEGAH PENGHAPUSAN KATEGORI TERPAKAI
        ---------------------------------------------------- */

        if ($jumlahFasilitas > 0) {

            admin_fail(
                'Kategori tidak dapat dihapus karena masih digunakan oleh ' .
                $jumlahFasilitas .
                ' fasilitas. Ubah status kategori menjadi Nonaktif jika sudah tidak digunakan.',
                409
            );
        }


        /* ----------------------------------------------------
           C. MENGHAPUS KATEGORI
        ---------------------------------------------------- */

        $stmt = $pdo->prepare("
            DELETE FROM kategori_fasilitas
            WHERE id_kategori = :id
        ");

        $stmt->execute([
            ':id' => $id
        ]);


        /* RESPONSE */

        admin_ok(
            'Kategori fasilitas berhasil dihapus.'
        );
    }


/* ============================================================
   11. PENANGANAN ERROR DATABASE
============================================================ */

} catch (PDOException $e) {

    if ((string)$e->getCode() === '23000') {

        admin_fail(
            'Kode kategori sudah digunakan atau kategori masih memiliki relasi dengan tabel lain.',
            409
        );
    }

    admin_exception($e);


/* ============================================================
   12. PENANGANAN ERROR APLIKASI
============================================================ */

} catch (Throwable $e) {

    admin_exception($e);
}
