<?php
declare(strict_types=1);

/**
 * SIPFAS - ADMIN DATASET C4.5 API
 *
 * Fitur:
 * - GET    : Membaca dataset, pencarian, filter, pagination.
 * - POST   : Menambahkan dataset manual.
 * - PUT    : Memperbarui dataset.
 * - DELETE : Menghapus dataset.
 * - IMPORT : Menggabungkan beberapa CSV ke dataset utama.
 *
 * Database:
 * - dataset_c45
 * - pengguna
 *
 * Label Y wajib berasal dari data aktual/verifikasi.
 * Tidak dibuat otomatis dari skor pembobotan.
 */

require_once __DIR__ . '/_admin-common.php';

/* =========================================================
   01. KONFIGURASI
========================================================= */

const C45_CLASSES = ['Rendah', 'Sedang', 'Tinggi'];
const C45_MAX_IMPORT_ROWS = 5000;

/* =========================================================
   02. VALIDASI DATASET
========================================================= */

function c45_dataset_payload(array $input): array
{
    $kode = admin_text($input, 'kode_data', 30);
    $nama = admin_text($input, 'nama_fasilitas', 150);

    $sumber = admin_text(
        $input,
        'sumber_data',
        50,
        false
    ) ?? 'Input Manual';

    $label = admin_text(
        $input,
        'label_prioritas',
        20
    );

    $attributes = [
        'tingkat_kerusakan_x1',
        'dampak_akademik_x2',
        'frekuensi_penggunaan_x3'
    ];

    $values = [];

    foreach ($attributes as $field) {
        $value = filter_var(
            $input[$field] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!in_array($value, [1, 2, 3], true)) {
            admin_fail(
                "Nilai {$field} harus 1, 2, atau 3.",
                422
            );
        }

        $values[$field] = $value;
    }

    if (!in_array($label, C45_CLASSES, true)) {
        admin_fail(
            'Label prioritas harus Rendah, Sedang, atau Tinggi.',
            422
        );
    }

    return [
        'kode' => $kode,
        'nama' => $nama,
        'x1' => $values['tingkat_kerusakan_x1'],
        'x2' => $values['dampak_akademik_x2'],
        'x3' => $values['frekuensi_penggunaan_x3'],
        'label' => $label,
        'sumber' => $sumber
    ];
}

/* =========================================================
   03. NORMALISASI HEADER CSV
========================================================= */

function c45_normalize_header(string $value): string
{
    $value = preg_replace('/^\xEF\xBB\xBF/', '', $value);
    $value = strtolower(trim($value));

    $value = preg_replace('/[^a-z0-9]+/', '_', $value);

    return trim($value, '_');
}

/* =========================================================
   04. MEMBACA NILAI CSV
========================================================= */

function c45_csv_value(array $row, array $headers, array $aliases): string
{
    foreach ($aliases as $alias) {
        $alias = c45_normalize_header($alias);

        $index = array_search($alias, $headers, true);

        if ($index !== false) {
            return trim((string)($row[$index] ?? ''));
        }
    }

    return '';
}

/* =========================================================
   05. KONVERSI NILAI ATRIBUT
========================================================= */

function c45_csv_level(string $value, string $attribute): int
{
    $value = strtolower(trim($value));

    $mapping = [
        'x1' => [
            '1' => 1,
            'ringan' => 1,
            '2' => 2,
            'sedang' => 2,
            '3' => 3,
            'berat' => 3
        ],

        'x2' => [
            '1' => 1,
            'rendah' => 1,
            '2' => 2,
            'sedang' => 2,
            '3' => 3,
            'tinggi' => 3
        ],

        'x3' => [
            '1' => 1,
            'jarang' => 1,
            '2' => 2,
            'sedang' => 2,
            '3' => 3,
            'sering' => 3
        ]
    ];

    if (!isset($mapping[$attribute][$value])) {
        throw new RuntimeException(
            "Nilai {$attribute} tidak valid: {$value}"
        );
    }

    return $mapping[$attribute][$value];
}

/* =========================================================
   06. IMPORT DAN PENGGABUNGAN CSV
========================================================= */

function c45_import_csv(PDO $pdo): never
{
    if (!isset($_FILES['file_dataset'])) {
        admin_fail(
            'File CSV belum dipilih.',
            422
        );
    }

    $file = $_FILES['file_dataset'];

    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        admin_fail(
            'File gagal diunggah. Periksa ukuran dan file yang dipilih.',
            400
        );
    }

    if (($file['size'] ?? 0) > 5 * 1024 * 1024) {
        admin_fail(
            'Ukuran file maksimal 5 MB.',
            422
        );
    }

    $extension = strtolower(
        pathinfo($file['name'], PATHINFO_EXTENSION)
    );

    if ($extension !== 'csv') {
        admin_fail(
            'Format yang diterima adalah CSV. Simpan Excel sebagai CSV UTF-8 terlebih dahulu.',
            422
        );
    }

    $handle = fopen($file['tmp_name'], 'rb');

    if (!$handle) {
        admin_fail(
            'File CSV tidak dapat dibaca.',
            400
        );
    }

    try {
        $firstLine = fgets($handle);

        if ($firstLine === false) {
            admin_fail('File CSV kosong.', 422);
        }

        $delimiters = [
            ',' => substr_count($firstLine, ','),
            ';' => substr_count($firstLine, ';'),
            "\t" => substr_count($firstLine, "\t")
        ];

        arsort($delimiters);

        $delimiter = (string)array_key_first($delimiters);

        rewind($handle);

        $rawHeaders = fgetcsv(
            $handle,
            0,
            $delimiter,
            '"',
            '\\'
        );

        if (!$rawHeaders) {
            admin_fail(
                'Header CSV tidak ditemukan.',
                422
            );
        }

        $headers = array_map(
            'c45_normalize_header',
            $rawHeaders
        );

        $required = [
            'kode_data',
            'nama_fasilitas',
            'label_prioritas'
        ];

        foreach ($required as $column) {
            if (!in_array($column, $headers, true)) {
                admin_fail(
                    "Kolom wajib {$column} tidak ditemukan dalam CSV.",
                    422
                );
            }
        }

        $pdo->beginTransaction();

        $insert = $pdo->prepare(
            "INSERT INTO dataset_c45
            (
                kode_data,
                nama_fasilitas,
                tingkat_kerusakan_x1,
                dampak_akademik_x2,
                frekuensi_penggunaan_x3,
                label_prioritas,
                sumber_data,
                id_penginput
            )
            VALUES
            (
                :kode,
                :nama,
                :x1,
                :x2,
                :x3,
                :label,
                :sumber,
                :user
            )"
        );

        $check = $pdo->prepare(
            "SELECT id_data
             FROM dataset_c45
             WHERE kode_data = :kode
             LIMIT 1"
        );

        $seen = [];

        $inserted = 0;
        $duplicates = 0;
        $rowNumber = 1;

        $errors = [];

        while (($row = fgetcsv(
            $handle,
            0,
            $delimiter,
            '"',
            '\\'
        )) !== false) {

            $rowNumber++;

            if (
                count($row) === 1 &&
                trim((string)$row[0]) === ''
            ) {
                continue;
            }

            if ($rowNumber > C45_MAX_IMPORT_ROWS + 1) {
                throw new RuntimeException(
                    'Jumlah data melebihi batas 5.000 baris.'
                );
            }

            try {
                $kode = c45_csv_value(
                    $row,
                    $headers,
                    ['kode_data', 'kode', 'id_dataset']
                );

                $nama = c45_csv_value(
                    $row,
                    $headers,
                    ['nama_fasilitas', 'fasilitas', 'nama']
                );

                $x1raw = c45_csv_value(
                    $row,
                    $headers,
                    [
                        'tingkat_kerusakan_x1',
                        'x1',
                        'tingkat_kerusakan'
                    ]
                );

                $x2raw = c45_csv_value(
                    $row,
                    $headers,
                    [
                        'dampak_akademik_x2',
                        'x2',
                        'dampak_akademik'
                    ]
                );

                $x3raw = c45_csv_value(
                    $row,
                    $headers,
                    [
                        'frekuensi_penggunaan_x3',
                        'x3',
                        'frekuensi_penggunaan'
                    ]
                );

                $label = c45_csv_value(
                    $row,
                    $headers,
                    [
                        'label_prioritas',
                        'label',
                        'y',
                        'kelas'
                    ]
                );

                if (
                    $kode === '' ||
                    $nama === '' ||
                    $label === ''
                ) {
                    throw new RuntimeException(
                        'Kode, nama fasilitas, dan label Y wajib diisi.'
                    );
                }

                if (!in_array($label, C45_CLASSES, true)) {
                    throw new RuntimeException(
                        'Label Y harus Rendah, Sedang, atau Tinggi.'
                    );
                }

                $x1 = c45_csv_level($x1raw, 'x1');
                $x2 = c45_csv_level($x2raw, 'x2');
                $x3 = c45_csv_level($x3raw, 'x3');

                if (isset($seen[$kode])) {
                    $duplicates++;
                    continue;
                }

                $check->execute([':kode' => $kode]);

                if ($check->fetchColumn()) {
                    $duplicates++;
                    $seen[$kode] = true;
                    continue;
                }

                $insert->execute([
                    ':kode' => $kode,
                    ':nama' => $nama,
                    ':x1' => $x1,
                    ':x2' => $x2,
                    ':x3' => $x3,
                    ':label' => $label,
                    ':sumber' => 'Import CSV',
                    ':user' => admin_user_id()
                ]);

                $seen[$kode] = true;
                $inserted++;

            } catch (Throwable $e) {
                $errors[] = [
                    'baris' => $rowNumber,
                    'pesan' => $e->getMessage()
                ];

                if (count($errors) >= 20) {
                    break;
                }
            }
        }

        if ($errors) {
            $pdo->rollBack();

            admin_json([
                'success' => false,
                'message' => 'Import dibatalkan karena terdapat data tidak valid. Perbaiki baris yang ditampilkan lalu unggah kembali.',
                'data' => [
                    'baris_bermasalah' => $errors
                ],
                'errors' => $errors
            ], 422);
        }

        if ($inserted === 0) {
            $pdo->rollBack();

            admin_fail(
                'Tidak ada data baru untuk dimasukkan. Seluruh kode dataset mungkin sudah tersedia.',
                409
            );
        }

        $pdo->commit();

        admin_ok(
            'Import berhasil. Dataset baru telah digabungkan ke dataset utama.',
            [
                'jumlah_ditambahkan' => $inserted,
                'jumlah_duplikat_dilewati' => $duplicates,
                'nama_file' => $file['name']
            ],
            201
        );

    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $e;

    } finally {
        fclose($handle);
    }
}

/* =========================================================
   07. ROUTER API
========================================================= */

try {

    $method = admin_method(
        'GET',
        'POST',
        'PUT',
        'DELETE'
    );

    /* -----------------------------------------------------
       IMPORT CSV
    ----------------------------------------------------- */

    if (
        $method === 'POST' &&
        ($_GET['action'] ?? '') === 'import'
    ) {
        c45_import_csv($pdo);
    }

    /* -----------------------------------------------------
       GET DATASET
    ----------------------------------------------------- */

    if ($method === 'GET') {

        [$page, $limit, $offset] = admin_page();

        $where = [];
        $params = [];

        if (!empty($_GET['search'])) {

            $where[] = '
                (
                    d.kode_data LIKE :q1
                    OR d.nama_fasilitas LIKE :q2
                )
            ';

            $keyword = '%' . trim((string)$_GET['search']) . '%';

            $params[':q1'] = $keyword;
            $params[':q2'] = $keyword;
        }

        $filters = [
            'x1' => 'tingkat_kerusakan_x1',
            'x2' => 'dampak_akademik_x2',
            'x3' => 'frekuensi_penggunaan_x3',
            'label' => 'label_prioritas'
        ];

        foreach ($filters as $key => $column) {

            if (
                isset($_GET[$key]) &&
                $_GET[$key] !== '' &&
                $_GET[$key] !== 'semua'
            ) {

                $where[] = "d.{$column} = :f_{$key}";

                $params[":f_{$key}"] = $_GET[$key];
            }
        }

        $clause = $where
            ? 'WHERE ' . implode(' AND ', $where)
            : '';

        $count = $pdo->prepare(
            "SELECT COUNT(*)
             FROM dataset_c45 d
             {$clause}"
        );

        $count->execute($params);

        $total = (int)$count->fetchColumn();

        $stmt = $pdo->prepare(
            "SELECT
                d.*,
                u.nama_lengkap AS nama_penginput
             FROM dataset_c45 d
             LEFT JOIN pengguna u
                ON u.id_pengguna = d.id_penginput
             {$clause}
             ORDER BY d.id_data DESC
             LIMIT :lim OFFSET :off"
        );

        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }

        $stmt->bindValue(
            ':lim',
            $limit,
            PDO::PARAM_INT
        );

        $stmt->bindValue(
            ':off',
            $offset,
            PDO::PARAM_INT
        );

        $stmt->execute();

        $statistics = $pdo->query(
            "SELECT
                COUNT(*) AS total,
                COALESCE(SUM(label_prioritas='Rendah'),0) AS rendah,
                COALESCE(SUM(label_prioritas='Sedang'),0) AS sedang,
                COALESCE(SUM(label_prioritas='Tinggi'),0) AS tinggi
             FROM dataset_c45"
        )->fetch(PDO::FETCH_ASSOC);

        admin_ok(
            'Dataset C4.5 berhasil dimuat.',
            [
                'items' => $stmt->fetchAll(PDO::FETCH_ASSOC),
                'statistics' => $statistics,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'total_pages' => (int)ceil($total / $limit)
                ]
            ]
        );
    }

    /* -----------------------------------------------------
       POST / PUT
    ----------------------------------------------------- */

    if ($method === 'POST' || $method === 'PUT') {

        $input = admin_input();

        $data = c45_dataset_payload($input);

        if ($method === 'POST') {

            $stmt = $pdo->prepare(
                "INSERT INTO dataset_c45
                (
                    kode_data,
                    nama_fasilitas,
                    tingkat_kerusakan_x1,
                    dampak_akademik_x2,
                    frekuensi_penggunaan_x3,
                    label_prioritas,
                    sumber_data,
                    id_penginput
                )
                VALUES
                (
                    :kode,
                    :nama,
                    :x1,
                    :x2,
                    :x3,
                    :label,
                    :sumber,
                    :user
                )"
            );

            $stmt->execute([
                ':kode' => $data['kode'],
                ':nama' => $data['nama'],
                ':x1' => $data['x1'],
                ':x2' => $data['x2'],
                ':x3' => $data['x3'],
                ':label' => $data['label'],
                ':sumber' => $data['sumber'],
                ':user' => admin_user_id()
            ]);

            admin_ok(
                'Dataset berhasil ditambahkan.',
                [
                    'id_data' => (int)$pdo->lastInsertId()
                ],
                201
            );
        }

        $id = admin_id($input, 'id_data');

        $stmt = $pdo->prepare(
            "UPDATE dataset_c45 SET
                kode_data = :kode,
                nama_fasilitas = :nama,
                tingkat_kerusakan_x1 = :x1,
                dampak_akademik_x2 = :x2,
                frekuensi_penggunaan_x3 = :x3,
                label_prioritas = :label,
                sumber_data = :sumber
             WHERE id_data = :id"
        );

        $stmt->execute([
            ':kode' => $data['kode'],
            ':nama' => $data['nama'],
            ':x1' => $data['x1'],
            ':x2' => $data['x2'],
            ':x3' => $data['x3'],
            ':label' => $data['label'],
            ':sumber' => $data['sumber'],
            ':id' => $id
        ]);

        $check = $pdo->prepare(
            "SELECT id_data
             FROM dataset_c45
             WHERE id_data = :id"
        );

        $check->execute([':id' => $id]);

        if (!$check->fetchColumn()) {
            admin_fail(
                'Dataset tidak ditemukan.',
                404
            );
        }

        admin_ok(
            'Dataset berhasil diperbarui.'
        );
    }

    /* -----------------------------------------------------
       DELETE
    ----------------------------------------------------- */

    if ($method === 'DELETE') {

        $input = admin_input();

        $id = admin_id($input, 'id_data');

        $stmt = $pdo->prepare(
            "DELETE FROM dataset_c45
             WHERE id_data = :id"
        );

        $stmt->execute([':id' => $id]);

        if ($stmt->rowCount() < 1) {
            admin_fail(
                'Dataset tidak ditemukan.',
                404
            );
        }

        admin_ok(
            'Dataset berhasil dihapus.'
        );
    }

} catch (PDOException $e) {

    if ((string)$e->getCode() === '23000') {

        admin_fail(
            'Kode dataset sudah digunakan atau data sudah terhubung dengan riwayat pelatihan. Periksa kembali data tersebut.',
            409
        );
    }

    admin_exception($e);

} catch (Throwable $e) {

    admin_exception($e);
}
