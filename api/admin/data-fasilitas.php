<?php
declare(strict_types=1);


require_once __DIR__ . '/_admin-common.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(_DIR_, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

/* ==================================================
   01. VALIDASI FREKUENSI
================================================== */

function admin_fasilitas_frequency(array $input): int
{
    $value = trim(
        (string)($input['frekuensi_penggunaan'] ?? '')
    );

    if (!preg_match('/^([0-7])(?:\s*Hari)?$/i', $value, $match)) {
        admin_fail(
            'Frekuensi penggunaan harus antara 0 sampai 7 hari.',
            422
        );
    }

    return (int)$match[1];
}

/* ==================================================
   02. VALIDASI STATUS
================================================== */

function admin_fasilitas_status(array $input): string
{
    $status = trim(
        (string)($input['status_fasilitas'] ?? 'Aktif')
    );

    if (!in_array($status, ['Aktif', 'Nonaktif'], true)) {
        admin_fail(
            'Status fasilitas tidak valid.',
            422
        );
    }

    return $status;
}

/* ==================================================
   03. VALIDASI ID POSITIF
================================================== */

function admin_fasilitas_positive_id(
    array $input,
    string $key,
    string $label
): int {

    $value = filter_var(
        $input[$key] ?? null,
        FILTER_VALIDATE_INT
    );

    if (
        $value === false ||
        $value === null ||
        $value <= 0
    ) {
        admin_fail(
            $label . ' wajib dipilih.',
            422
        );
    }

    return (int)$value;
}

/* ==================================================
   04. VALIDASI JUMLAH UNIT

   NULL = Belum diketahui.
   0    = Sudah diperiksa, tidak ada unit.
   > 0  = Jumlah unit sebenarnya.

   Jika field tidak dikirim saat PUT,
   nilai lama dipertahankan.
================================================== */

function admin_fasilitas_quantity(
    array $input,
    ?int $currentValue = null
): ?int {

    if (!array_key_exists('jumlah_unit', $input)) {
        return $currentValue;
    }

    if (
        $input['jumlah_unit'] === null ||
        $input['jumlah_unit'] === ''
    ) {
        return null;
    }

    $value = filter_var(
        $input['jumlah_unit'],
        FILTER_VALIDATE_INT
    );

    if ($value === false || $value < 0) {
        admin_fail(
            'Jumlah unit harus berupa bilangan bulat nol atau lebih.',
            422
        );
    }

    return (int)$value;
}

/* ==================================================
   05. MEMERIKSA KATEGORI
================================================== */

function admin_fasilitas_check_category(
    PDO $pdo,
    int $idKategori
): void {

    $stmt = $pdo->prepare("
        SELECT id_kategori
        FROM kategori_fasilitas
        WHERE id_kategori = :id
          AND status_kategori = 'Aktif'
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $idKategori
    ]);

    if (!$stmt->fetchColumn()) {
        admin_fail(
            'Kategori tidak ditemukan atau tidak aktif.',
            422
        );
    }
}

/* ==================================================
   06. MEMERIKSA LOKASI
================================================== */

function admin_fasilitas_check_location(
    PDO $pdo,
    int $idLokasi
): void {

    $stmt = $pdo->prepare("
        SELECT id_lokasi
        FROM lokasi_ruangan
        WHERE id_lokasi = :id
          AND status_lokasi = 'Aktif'
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $idLokasi
    ]);

    if (!$stmt->fetchColumn()) {
        admin_fail(
            'Lokasi tidak ditemukan atau tidak aktif.',
            422
        );
    }
}

/* ==================================================
   07. MENCARI ID LOKASI

   Mendukung:
   - id_lokasi
   - nama_lokasi
   - lokasi_ruangan (format frontend lama)
================================================== */

function admin_fasilitas_resolve_location(
    PDO $pdo,
    array $input
): int {

    $rawId = $input['id_lokasi'] ?? null;

    /* FORMAT ID LOKASI */

    if ($rawId !== null && $rawId !== '') {

        $idLokasi = filter_var(
            $rawId,
            FILTER_VALIDATE_INT
        );

        if (
            $idLokasi === false ||
            $idLokasi <= 0
        ) {
            admin_fail(
                'Pilihan lokasi tidak valid.',
                422
            );
        }

        admin_fasilitas_check_location(
            $pdo,
            (int)$idLokasi
        );

        return (int)$idLokasi;
    }

    /* FORMAT NAMA LOKASI */

    $namaLokasi = trim(
        (string)(
            $input['nama_lokasi'] ??
            $input['lokasi_ruangan'] ??
            ''
        )
    );

    if ($namaLokasi === '') {
        admin_fail(
            'Lokasi/ruangan wajib dipilih.',
            422
        );
    }

    $stmt = $pdo->prepare("
        SELECT id_lokasi
        FROM lokasi_ruangan
        WHERE nama_lokasi = :nama
          AND status_lokasi = 'Aktif'
        LIMIT 1
    ");

    $stmt->execute([
        ':nama' => $namaLokasi
    ]);

    $idLokasi = $stmt->fetchColumn();

    if (!$idLokasi) {
        admin_fail(
            'Nama lokasi tidak ditemukan atau tidak aktif. Pilih lokasi yang tersedia.',
            422
        );
    }

    return (int)$idLokasi;
}

/* ==================================================
   08. MEMERIKSA KEBERADAAN FASILITAS
================================================== */

function admin_fasilitas_exists(
    PDO $pdo,
    int $id
): bool {

    $stmt = $pdo->prepare("
        SELECT id_fasilitas
        FROM fasilitas
        WHERE id_fasilitas = :id
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $id
    ]);

    return $stmt->fetchColumn() !== false;
}

/* ==================================================
   09. PROSES API
================================================== */

try {

    $method = admin_method(
        'GET',
        'POST',
        'PUT',
        'DELETE'
    );

    /* ==============================================
       GET - MENGAMBIL DATA FASILITAS
    ============================================== */

    if ($method === 'GET') {

        [$page, $limit, $offset] = admin_page();

        $where = [];

        $params = [];

        /* PENCARIAN */

        if (
            isset($_GET['search']) &&
            trim((string)$_GET['search']) !== ''
        ) {

            $search =
                '%' . trim((string)$_GET['search']) . '%';

            $where[] = "(
                f.kode_fasilitas LIKE :search1
                OR f.nama_fasilitas LIKE :search2
                OR k.nama_kategori LIKE :search3
                OR l.nama_lokasi LIKE :search4
            )";

            $params[':search1'] = $search;
            $params[':search2'] = $search;
            $params[':search3'] = $search;
            $params[':search4'] = $search;
        }

        /* FILTER STATUS */

        if (
            isset($_GET['status']) &&
            $_GET['status'] !== '' &&
            $_GET['status'] !== 'semua'
        ) {

            $status = trim(
                (string)$_GET['status']
            );

            if (
                !in_array(
                    $status,
                    ['Aktif', 'Nonaktif'],
                    true
                )
            ) {
                admin_fail(
                    'Filter status tidak valid.',
                    422
                );
            }

            $where[] =
                'f.status_fasilitas = :status';

            $params[':status'] = $status;
        }

        /* FILTER KATEGORI */

        if (
            isset($_GET['kategori']) &&
            $_GET['kategori'] !== '' &&
            $_GET['kategori'] !== 'semua'
        ) {

            $kategori = filter_var(
                $_GET['kategori'],
                FILTER_VALIDATE_INT
            );

            if (
                $kategori === false ||
                $kategori <= 0
            ) {
                admin_fail(
                    'Filter kategori tidak valid.',
                    422
                );
            }

            $where[] = 'f.id_kategori = :kategori';

            $params[':kategori'] = (int)$kategori;
        }

        /* FILTER LOKASI */

        if (
            isset($_GET['lokasi']) &&
            $_GET['lokasi'] !== '' &&
            $_GET['lokasi'] !== 'semua'
        ) {

            $lokasi = filter_var(
                $_GET['lokasi'],
                FILTER_VALIDATE_INT
            );

            if (
                $lokasi === false ||
                $lokasi <= 0
            ) {
                admin_fail(
                    'Filter lokasi tidak valid.',
                    422
                );
            }

            $where[] = 'f.id_lokasi = :lokasi';

            $params[':lokasi'] = (int)$lokasi;
        }

        $clause = $where
            ? 'WHERE ' . implode(' AND ', $where)
            : '';

        /* MENGHITUNG DATA */

        $count = $pdo->prepare("
            SELECT COUNT(*)

            FROM fasilitas f

            INNER JOIN kategori_fasilitas k
                ON k.id_kategori = f.id_kategori

            LEFT JOIN lokasi_ruangan l
                ON l.id_lokasi = f.id_lokasi

            $clause
        ");

        $count->execute($params);

        $total = (int)$count->fetchColumn();

        /* MENGAMBIL DATA */

        $stmt = $pdo->prepare("
            SELECT
                f.id_fasilitas,
                f.kode_fasilitas,
                f.nama_fasilitas,
                f.jumlah_unit,
                f.id_kategori,
                f.id_lokasi,
                f.frekuensi_penggunaan,
                f.status_fasilitas,
                f.id_pencatat,
                f.tanggal_dibuat,
                f.tanggal_diperbarui,

                k.kode_kategori,
                k.nama_kategori,

                l.kode_lokasi,
                l.nama_lokasi,
                l.nama_lokasi AS lokasi_ruangan,

                u.nama_lengkap AS nama_pencatat

            FROM fasilitas f

            INNER JOIN kategori_fasilitas k
                ON k.id_kategori = f.id_kategori

            LEFT JOIN lokasi_ruangan l
                ON l.id_lokasi = f.id_lokasi

            LEFT JOIN pengguna u
                ON u.id_pengguna = f.id_pencatat

            $clause

            ORDER BY f.id_fasilitas DESC

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

        $items = $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );

        admin_ok(
            'Data fasilitas berhasil dimuat.',
            [
                'items' => $items,

                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'total_pages' => (int)ceil(
                        $total / $limit
                    )
                ]
            ]
        );
    }

    /* ==============================================
       MEMBACA INPUT POST, PUT, DELETE
    ============================================== */

    $input = admin_input();

    /* ==============================================
       POST - MENAMBAHKAN FASILITAS
    ============================================== */

    if ($method === 'POST') {

        $kode = admin_text(
            $input,
            'kode_fasilitas',
            30
        );

        $nama = admin_text(
            $input,
            'nama_fasilitas',
            150
        );

        $idKategori = admin_fasilitas_positive_id(
            $input,
            'id_kategori',
            'Kategori fasilitas'
        );

        $idLokasi = admin_fasilitas_resolve_location(
            $pdo,
            $input
        );

        $frekuensi =
            admin_fasilitas_frequency($input);

        $status =
            admin_fasilitas_status($input);

        $jumlahUnit =
            admin_fasilitas_quantity($input);

        admin_fasilitas_check_category(
            $pdo,
            $idKategori
        );

        $idPencatat = (int)admin_user_id();

        if ($idPencatat <= 0) {
            admin_fail(
                'Sesi Admin tidak valid. Silakan login kembali.',
                401
            );
        }

        $stmt = $pdo->prepare("
            INSERT INTO fasilitas (
                kode_fasilitas,
                nama_fasilitas,
                jumlah_unit,
                id_kategori,
                id_lokasi,
                frekuensi_penggunaan,
                status_fasilitas,
                id_pencatat
            ) VALUES (
                :kode,
                :nama,
                :jumlah_unit,
                :kategori,
                :lokasi,
                :frekuensi,
                :status,
                :pencatat
            )
        ");

        $stmt->execute([
            ':kode' => $kode,
            ':nama' => $nama,
            ':jumlah_unit' => $jumlahUnit,
            ':kategori' => $idKategori,
            ':lokasi' => $idLokasi,
            ':frekuensi' => $frekuensi,
            ':status' => $status,
            ':pencatat' => $idPencatat
        ]);

        admin_ok(
            'Fasilitas berhasil ditambahkan.',
            [
                'id_fasilitas' =>
                    (int)$pdo->lastInsertId()
            ],
            201
        );
    }

    /* ==============================================
       VALIDASI ID
    ============================================== */

    $id = admin_id(
        $input,
        'id_fasilitas'
    );

    /* ==============================================
       PUT - MEMPERBARUI FASILITAS
    ============================================== */

    if ($method === 'PUT') {

        if (!admin_fasilitas_exists($pdo, $id)) {
            admin_fail(
                'Fasilitas tidak ditemukan.',
                404
            );
        }

        $kode = admin_text(
            $input,
            'kode_fasilitas',
            30
        );

        $nama = admin_text(
            $input,
            'nama_fasilitas',
            150
        );

        $idKategori = admin_fasilitas_positive_id(
            $input,
            'id_kategori',
            'Kategori fasilitas'
        );

        $idLokasi = admin_fasilitas_resolve_location(
            $pdo,
            $input
        );

        $frekuensi =
            admin_fasilitas_frequency($input);

        $status =
            admin_fasilitas_status($input);

        admin_fasilitas_check_category(
            $pdo,
            $idKategori
        );

        /* AMBIL JUMLAH UNIT LAMA */

        $stmtCurrent = $pdo->prepare("
            SELECT jumlah_unit
            FROM fasilitas
            WHERE id_fasilitas = :id
            LIMIT 1
        ");

        $stmtCurrent->execute([
            ':id' => $id
        ]);

        $currentUnit = $stmtCurrent->fetchColumn();

        if ($currentUnit !== false && $currentUnit !== null) {
            $currentUnit = (int)$currentUnit;
        } else {
            $currentUnit = null;
        }

        /* VALIDASI JUMLAH UNIT */

        $jumlahUnit = admin_fasilitas_quantity(
            $input,
            $currentUnit
        );

        /* UPDATE DATA */

        $stmt = $pdo->prepare("
            UPDATE fasilitas
            SET
                kode_fasilitas = :kode,
                nama_fasilitas = :nama,
                jumlah_unit = :jumlah_unit,
                id_kategori = :kategori,
                id_lokasi = :lokasi,
                frekuensi_penggunaan = :frekuensi,
                status_fasilitas = :status

            WHERE id_fasilitas = :id
        ");

        $stmt->execute([
            ':kode' => $kode,
            ':nama' => $nama,
            ':jumlah_unit' => $jumlahUnit,
            ':kategori' => $idKategori,
            ':lokasi' => $idLokasi,
            ':frekuensi' => $frekuensi,
            ':status' => $status,
            ':id' => $id
        ]);

        admin_ok(
            'Data fasilitas berhasil diperbarui.'
        );
    }

    /* ==============================================
       DELETE - MENGHAPUS FASILITAS
    ============================================== */

    if ($method === 'DELETE') {

        if (!admin_fasilitas_exists($pdo, $id)) {
            admin_fail(
                'Fasilitas tidak ditemukan.',
                404
            );
        }

        /* CEK RELASI LAPORAN */

        $checkReport = $pdo->prepare("
            SELECT COUNT(*)
            FROM laporan_kerusakan
            WHERE id_fasilitas = :id
        ");

        $checkReport->execute([
            ':id' => $id
        ]);

        $totalLaporan = (int)$checkReport->fetchColumn();

        if ($totalLaporan > 0) {
            admin_fail(
                'Fasilitas tidak dapat dihapus karena sudah digunakan dalam laporan. Ubah status menjadi Nonaktif.',
                409
            );
        }

        /* HAPUS DATA */

        $stmt = $pdo->prepare("
            DELETE FROM fasilitas
            WHERE id_fasilitas = :id
        ");

        $stmt->execute([
            ':id' => $id
        ]);

        admin_ok(
            'Data fasilitas berhasil dihapus.'
        );
    }

} catch (PDOException $e) {

    if ((string)$e->getCode() === '23000') {

        admin_fail(
            'Data tidak dapat diproses karena kode fasilitas duplikat atau masih memiliki relasi dengan tabel lain.',
            409
        );
    }

    admin_exception($e);

} catch (Throwable $e) {

    admin_exception($e);
}
