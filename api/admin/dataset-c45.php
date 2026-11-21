<?php
declare(strict_types=1);



require_once __DIR__ . '/_admin-common.php';
require_once dirname(__DIR__, 2) . '/services/C45/C45Service.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(__DIR__, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

use SIPFAS\Services\C45\C45Service;

try {
    global $pdo;

    // ========================================================
    // 01. VALIDASI METODE DAN ADMIN
    // ========================================================

    $method = admin_method('GET', 'POST', 'PUT', 'DELETE');
    $adminId = admin_user_id();

    if ($adminId < 1) {
        admin_fail('Sesi Administrator tidak valid.', 401);
    }

    if (!$pdo instanceof PDO) {
        throw new RuntimeException('Koneksi database tidak tersedia.');
    }

    // ========================================================
    // 02. KONVERSI X3
    // ========================================================

    $konversiX3 = static function (int $frekuensi): int {
        return C45Service::mapFrekuensiPenggunaan($frekuensi);
    };

    // ========================================================
    // 03. PERHITUNGAN SKOR DAN LABEL Y
    // ========================================================

    $hitungSkor = static function (
        int $x1,
        int $x2,
        int $x3
    ): float {
        return (0.4 * $x1) +
               (0.4 * $x2) +
               (0.2 * $x3);
    };

    $hitungLabel = static function (float $skor): string {

        if ($skor < 1.7) {
            return 'Rendah';
        }

        if ($skor < 2.4) {
            return 'Sedang';
        }

        return 'Tinggi';
    };

    // ========================================================
    // 04. VALIDASI ATRIBUT X1 DAN X2
    // ========================================================

    $validasiAtribut = static function (array $input): array {

        $x1 = filter_var(
            $input['tingkat_kerusakan_x1'] ?? null,
            FILTER_VALIDATE_INT
        );

        $x2 = filter_var(
            $input['dampak_akademik_x2'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (
            $x1 === false ||
            $x1 === null ||
            $x1 < 1 ||
            $x1 > 3
        ) {
            admin_fail(
                'X1 harus bernilai 1 (Ringan), 2 (Sedang), atau 3 (Berat).',
                422
            );
        }

        if (
            $x2 === false ||
            $x2 === null ||
            $x2 < 1 ||
            $x2 > 3
        ) {
            admin_fail(
                'X2 harus bernilai 1 (Rendah), 2 (Sedang), atau 3 (Tinggi).',
                422
            );
        }

        return [
            'x1' => (int)$x1,
            'x2' => (int)$x2
        ];
    };

    // ========================================================
    // 05. MENGAMBIL FASILITAS DARI DATABASE
    // ========================================================

    $ambilFasilitas = static function (
        int $idFasilitas
    ) use ($pdo): array {

        $stmt = $pdo->prepare("
            SELECT
                f.id_fasilitas,
                f.kode_fasilitas,
                f.nama_fasilitas,
                f.frekuensi_penggunaan,
                f.status_fasilitas,
                k.nama_kategori

            FROM fasilitas f

            INNER JOIN kategori_fasilitas k
                ON k.id_kategori = f.id_kategori

            WHERE f.id_fasilitas = :id

            LIMIT 1
        ");

        $stmt->execute([
            ':id' => $idFasilitas
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            admin_fail('Fasilitas tidak ditemukan.', 404);
        }

        if ($row['status_fasilitas'] !== 'Aktif') {
            admin_fail('Fasilitas tidak aktif.', 422);
        }

        return $row;
    };

    // ========================================================
    // 06. MEMBUAT KODE DATASET OTOMATIS
    // ========================================================

    $buatKode = static function () use ($pdo): string {

        do {

            $kode = 'DS-' .
                date('ymd') . '-' .
                strtoupper(bin2hex(random_bytes(4)));

            $stmt = $pdo->prepare("
                SELECT 1
                FROM dataset_c45
                WHERE kode_data = :kode
                LIMIT 1
            ");

            $stmt->execute([
                ':kode' => $kode
            ]);

            $exists = $stmt->fetchColumn();

        } while ($exists);

        return $kode;
    };

    // ========================================================
    // 07. GET - MENGAMBIL DATASET
    // ========================================================

    if ($method === 'GET') {

        [$page, $limit, $offset] = admin_page();

        $search = trim(
            (string)($_GET['search'] ?? '')
        );

        $where = [];
        $params = [];

        // -------------------------------
        // PENCARIAN DATASET
        // -------------------------------

        if ($search !== '') {

            $where[] = "(
                d.kode_data LIKE :s1
                OR f.nama_fasilitas LIKE :s2
                OR d.nama_fasilitas LIKE :s3
                OR k.nama_kategori LIKE :s4
            )";

            $keyword = '%' . $search . '%';

            $params[':s1'] = $keyword;
            $params[':s2'] = $keyword;
            $params[':s3'] = $keyword;
            $params[':s4'] = $keyword;
        }

        // -------------------------------
        // FILTER X1, X2, DAN X3
        // -------------------------------

        $filterColumns = [
            'x1' => 'd.tingkat_kerusakan_x1',
            'x2' => 'd.dampak_akademik_x2',
            'x3' => 'd.frekuensi_penggunaan_x3'
        ];

        foreach ($filterColumns as $key => $column) {

            $value = $_GET[$key] ?? '';

            if ($value === '') {
                continue;
            }

            $number = filter_var(
                $value,
                FILTER_VALIDATE_INT
            );

            if (
                $number === false ||
                $number < 1 ||
                $number > 3
            ) {
                admin_fail(
                    "Filter {$key} tidak valid.",
                    422
                );
            }

            $where[] = "{$column} = :{$key}";

            $params[":{$key}"] = (int)$number;
        }

        // -------------------------------
        // FILTER LABEL Y
        // -------------------------------

        $label = trim(
            (string)($_GET['label'] ?? '')
        );

        if ($label !== '') {

            if (!in_array(
                $label,
                ['Rendah', 'Sedang', 'Tinggi'],
                true
            )) {
                admin_fail('Label tidak valid.', 422);
            }

            $where[] = 'd.label_prioritas = :label';

            $params[':label'] = $label;
        }

        // -------------------------------
        // KONSTRUKSI WHERE
        // -------------------------------

        $whereSQL = $where
            ? 'WHERE ' . implode(' AND ', $where)
            : '';

        $joinSQL = "
            FROM dataset_c45 d

            LEFT JOIN fasilitas f
                ON f.id_fasilitas = d.id_fasilitas

            LEFT JOIN kategori_fasilitas k
                ON k.id_kategori = f.id_kategori
        ";

        // -------------------------------
        // TOTAL DATA SESUAI FILTER
        // -------------------------------

        $count = $pdo->prepare("
            SELECT COUNT(*)
            {$joinSQL}
            {$whereSQL}
        ");

        $count->execute($params);

        $totalFiltered = (int)$count->fetchColumn();

        // -------------------------------
        // MENGAMBIL DATASET
        // -------------------------------

        $sql = "
            SELECT
                d.id_data,
                d.id_fasilitas,
                d.kode_data,

                COALESCE(
                    NULLIF(d.nama_fasilitas, ''),
                    f.nama_fasilitas,
                    '-'
                ) AS nama_fasilitas,

                COALESCE(
                    f.kode_fasilitas,
                    '-'
                ) AS kode_fasilitas,

                COALESCE(
                    k.nama_kategori,
                    '-'
                ) AS nama_kategori,

                f.frekuensi_penggunaan AS frekuensi_hari,

                d.tingkat_kerusakan_x1,
                d.dampak_akademik_x2,
                d.frekuensi_penggunaan_x3,

                d.label_prioritas,
                d.sumber_data,
                d.id_penginput,
                d.tanggal_dibuat

            {$joinSQL}

            {$whereSQL}

            ORDER BY d.id_data DESC

            LIMIT :limit OFFSET :offset
        ";

        $stmt = $pdo->prepare($sql);

        foreach ($params as $key => $value) {

            $stmt->bindValue(
                $key,
                $value
            );
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

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // -------------------------------
        // NORMALISASI DATA DAN SKOR
        // -------------------------------

        foreach ($rows as &$row) {

            $x1 = (int)$row['tingkat_kerusakan_x1'];
            $x2 = (int)$row['dampak_akademik_x2'];
            $x3 = (int)$row['frekuensi_penggunaan_x3'];

            $skor = $hitungSkor(
                $x1,
                $x2,
                $x3
            );

            $row['id_data'] = (int)$row['id_data'];

            $row['id_fasilitas'] = $row['id_fasilitas'] !== null
                ? (int)$row['id_fasilitas']
                : null;

            $row['tingkat_kerusakan_x1'] = $x1;

            $row['dampak_akademik_x2'] = $x2;

            $row['frekuensi_penggunaan_x3'] = $x3;

            $row['skor'] = round($skor, 2);

            $row['label_hasil'] = $hitungLabel($skor);
        }

        unset($row);

        // -------------------------------
        // STATISTIK DATASET
        // -------------------------------

        $stats = $pdo->query("
            SELECT
                COUNT(*) AS total,

                COALESCE(
                    SUM(label_prioritas = 'Tinggi'),
                    0
                ) AS tinggi,

                COALESCE(
                    SUM(label_prioritas = 'Sedang'),
                    0
                ) AS sedang,

                COALESCE(
                    SUM(label_prioritas = 'Rendah'),
                    0
                ) AS rendah

            FROM dataset_c45
        ")->fetch(PDO::FETCH_ASSOC);

        // -------------------------------
        // DAFTAR FASILITAS AKTIF
        // -------------------------------

        $stmtFasilitas = $pdo->query("
            SELECT
                f.id_fasilitas,
                f.kode_fasilitas,
                f.nama_fasilitas,
                f.frekuensi_penggunaan,
                k.nama_kategori

            FROM fasilitas f

            INNER JOIN kategori_fasilitas k
                ON k.id_kategori = f.id_kategori

            WHERE f.status_fasilitas = 'Aktif'

            ORDER BY f.nama_fasilitas ASC
        ");

        $daftarFasilitas = $stmtFasilitas->fetchAll(
            PDO::FETCH_ASSOC
        );

        foreach ($daftarFasilitas as &$facility) {

            $facility['id_fasilitas'] =
                (int)$facility['id_fasilitas'];

            $facility['frekuensi_penggunaan'] =
                (int)$facility['frekuensi_penggunaan'];
        }

        unset($facility);

        $total = (int)$stats['total'];

        // -------------------------------
        // RESPONSE
        // -------------------------------

        admin_ok(
            'Dataset berhasil dimuat.',
            [
                'items' => $rows,

                'statistics' => [
                    'total' => $total,
                    'tinggi' => (int)$stats['tinggi'],
                    'sedang' => (int)$stats['sedang'],
                    'rendah' => (int)$stats['rendah']
                ],

                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $totalFiltered,

                    'total_pages' => max(
                        1,
                        (int)ceil($totalFiltered / $limit)
                    )
                ],

                'facilities' => $daftarFasilitas,

                'csrf_token' => sipfas_csrf_token()
            ]
        );
    }

    // ========================================================
    // 08. POST - MENAMBAH DATASET
    // ========================================================

    if ($method === 'POST') {

        $input = admin_input();

        $idFasilitas = filter_var(
            $input['id_fasilitas'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (
            $idFasilitas === false ||
            $idFasilitas === null ||
            $idFasilitas < 1
        ) {
            admin_fail('Silakan pilih fasilitas.', 422);
        }

        // Ambil fasilitas asli dari database.
        $fasilitas = $ambilFasilitas(
            (int)$idFasilitas
        );

        // Validasi atribut.
        $atribut = $validasiAtribut($input);

        // X3 tidak diambil dari browser.
        $frekuensi = (int)$fasilitas['frekuensi_penggunaan'];

        $x3 = $konversiX3($frekuensi);

        // Hitung skor dan label.
        $skor = $hitungSkor(
            $atribut['x1'],
            $atribut['x2'],
            $x3
        );

        $label = $hitungLabel($skor);

        $kode = $buatKode();

        // Simpan dataset.
        $stmt = $pdo->prepare("
            INSERT INTO dataset_c45 (
                id_fasilitas,
                kode_data,
                nama_fasilitas,
                tingkat_kerusakan_x1,
                dampak_akademik_x2,
                frekuensi_penggunaan_x3,
                label_prioritas,
                sumber_data,
                id_penginput
            ) VALUES (
                :id_fasilitas,
                :kode,
                :nama,
                :x1,
                :x2,
                :x3,
                :label,
                'Input Admin',
                :admin
            )
        ");

        $stmt->execute([
            ':id_fasilitas' => (int)$idFasilitas,
            ':kode' => $kode,
            ':nama' => $fasilitas['nama_fasilitas'],
            ':x1' => $atribut['x1'],
            ':x2' => $atribut['x2'],
            ':x3' => $x3,
            ':label' => $label,
            ':admin' => $adminId
        ]);

        admin_ok(
            'Dataset berhasil ditambahkan.',
            [
                'id_data' => (int)$pdo->lastInsertId(),

                'id_fasilitas' => (int)$idFasilitas,

                'kode_data' => $kode,

                'nama_fasilitas' =>
                    $fasilitas['nama_fasilitas'],

                'nama_kategori' =>
                    $fasilitas['nama_kategori'],

                'frekuensi_hari' => $frekuensi,

                'x1' => $atribut['x1'],

                'x2' => $atribut['x2'],

                'x3' => $x3,

                'skor' => round($skor, 2),

                'label_prioritas' => $label
            ],
            201
        );
    }

    // ========================================================
    // 09. PUT - MEMPERBARUI DATASET
    // ========================================================

    if ($method === 'PUT') {

        $input = admin_input();

        $id = admin_id($input, 'id_data');

        // Pastikan dataset benar-benar tersedia.
        $check = $pdo->prepare("
            SELECT id_data
            FROM dataset_c45
            WHERE id_data = :id
            LIMIT 1
        ");

        $check->execute([
            ':id' => $id
        ]);

        if (!$check->fetchColumn()) {
            admin_fail('Dataset tidak ditemukan.', 404);
        }

        $idFasilitas = filter_var(
            $input['id_fasilitas'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (
            $idFasilitas === false ||
            $idFasilitas === null ||
            $idFasilitas < 1
        ) {
            admin_fail('Silakan pilih fasilitas.', 422);
        }

        $fasilitas = $ambilFasilitas(
            (int)$idFasilitas
        );

        $atribut = $validasiAtribut($input);

        // Hitung ulang X3 berdasarkan fasilitas terbaru.
        $frekuensi = (int)$fasilitas['frekuensi_penggunaan'];

        $x3 = $konversiX3($frekuensi);

        // Hitung ulang skor dan label Y.
        $skor = $hitungSkor(
            $atribut['x1'],
            $atribut['x2'],
            $x3
        );

        $label = $hitungLabel($skor);

        $stmt = $pdo->prepare("
            UPDATE dataset_c45

            SET
                id_fasilitas = :id_fasilitas,

                nama_fasilitas = :nama,

                tingkat_kerusakan_x1 = :x1,

                dampak_akademik_x2 = :x2,

                frekuensi_penggunaan_x3 = :x3,

                label_prioritas = :label

            WHERE id_data = :id
        ");

        $stmt->execute([
            ':id_fasilitas' => (int)$idFasilitas,
            ':nama' => $fasilitas['nama_fasilitas'],
            ':x1' => $atribut['x1'],
            ':x2' => $atribut['x2'],
            ':x3' => $x3,
            ':label' => $label,
            ':id' => $id
        ]);

        admin_ok(
            'Dataset berhasil diperbarui.',
            [
                'id_data' => $id,

                'id_fasilitas' => (int)$idFasilitas,

                'nama_fasilitas' =>
                    $fasilitas['nama_fasilitas'],

                'frekuensi_hari' => $frekuensi,

                'x1' => $atribut['x1'],

                'x2' => $atribut['x2'],

                'x3' => $x3,

                'skor' => round($skor, 2),

                'label_prioritas' => $label
            ]
        );
    }

    // ========================================================
    // 10. DELETE - MENGHAPUS DATASET
    // ========================================================

    if ($method === 'DELETE') {

        $input = admin_input();

        $id = admin_id($input, 'id_data');

        $stmt = $pdo->prepare("
            DELETE FROM dataset_c45
            WHERE id_data = :id
        ");

        $stmt->execute([
            ':id' => $id
        ]);

        if ($stmt->rowCount() < 1) {
            admin_fail('Dataset tidak ditemukan.', 404);
        }

        admin_ok(
            'Dataset berhasil dihapus.'
        );
    }

} catch (PDOException $e) {

    error_log(
        '[SIPFAS DATASET C45] ' . $e->getMessage()
    );

    admin_exception($e);

} catch (Throwable $e) {

    error_log(
        '[SIPFAS DATASET C45] ' . $e->getMessage()
    );

    admin_exception($e);
}
