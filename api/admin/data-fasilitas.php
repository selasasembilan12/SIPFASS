<?php
declare(strict_types=1);



// ============================================================
// 01. MEMUAT AUTENTIKASI ADMIN DAN KONEKSI DATABASE
// ============================================================

require_once __DIR__ . '/_admin-common.php';

// ============================================================
// 02. FUNGSI VALIDASI FREKUENSI PENGGUNAAN (X3)
// ============================================================

/**
 * Frekuensi penggunaan menggunakan rentang 0 sampai 7 hari.
 *
 * 0–2 hari = Jarang
 * 3–4 hari = Sedang
 * 5–7 hari = Sering
 */
function admin_fasilitas_frequency(array $input): string
{
    $value = trim(
        (string) ($input['frekuensi_penggunaan'] ?? '')
    );

    if (!preg_match('/^([0-7])(?:\s*Hari)?$/i', $value, $match)) {
        admin_fail(
            'Frekuensi penggunaan harus antara 0 sampai 7 hari.',
            422
        );
    }

    return (int) $match[1] . ' Hari';
}

// ============================================================
// 03. FUNGSI VALIDASI STATUS FASILITAS
// ============================================================

function admin_fasilitas_status(array $input): string
{
    $status = trim(
        (string) ($input['status_fasilitas'] ?? 'Aktif')
    );

    if (!in_array($status, ['Aktif', 'Nonaktif'], true)) {
        admin_fail('Status fasilitas tidak valid.', 422);
    }

    return $status;
}

// ============================================================
// 04. FUNGSI VALIDASI KATEGORI
// ============================================================

/**
 * Memastikan kategori tersedia dan masih aktif.
 */
function admin_fasilitas_check_category(
    PDO $pdo,
    int $idKategori
): void {

    if ($idKategori <= 0) {
        admin_fail('Silakan pilih kategori fasilitas.', 422);
    }

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
            'Kategori tidak ditemukan atau sedang tidak aktif.',
            422
        );
    }
}

// ============================================================
// 05. FUNGSI MEMERIKSA KEBERADAAN FASILITAS
// ============================================================

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

    return (bool) $stmt->fetchColumn();
}

// ============================================================
// 06. MEMERIKSA METHOD REQUEST
// ============================================================

try {

    $method = admin_method(
        'GET',
        'POST',
        'PUT',
        'DELETE'
    );

    // ========================================================
    // 07. GET - MENGAMBIL DATA FASILITAS
    // ========================================================

    if ($method === 'GET') {

        // ----------------------------------------------------
        // A. PAGINATION
        // ----------------------------------------------------

        [$page, $limit, $offset] = admin_page();

        $where = [];
        $params = [];

        // ----------------------------------------------------
        // B. FILTER PENCARIAN
        // ----------------------------------------------------

        if (
            isset($_GET['search']) &&
            trim((string) $_GET['search']) !== ''
        ) {

            $search = '%' . trim((string) $_GET['search']) . '%';

            $where[] = "(
                f.kode_fasilitas LIKE :search1
                OR f.nama_fasilitas LIKE :search2
                OR k.nama_kategori LIKE :search3
            )";

            $params[':search1'] = $search;
            $params[':search2'] = $search;
            $params[':search3'] = $search;
        }

        // ----------------------------------------------------
        // C. FILTER STATUS
        // ----------------------------------------------------

        if (
            isset($_GET['status']) &&
            $_GET['status'] !== '' &&
            $_GET['status'] !== 'semua'
        ) {

            $status = trim((string) $_GET['status']);

            if (!in_array($status, ['Aktif', 'Nonaktif'], true)) {
                admin_fail('Filter status tidak valid.', 422);
            }

            $where[] = 'f.status_fasilitas = :status';

            $params[':status'] = $status;
        }

        // ----------------------------------------------------
        // D. FILTER KATEGORI
        // ----------------------------------------------------

        if (
            isset($_GET['kategori']) &&
            $_GET['kategori'] !== '' &&
            $_GET['kategori'] !== 'semua'
        ) {

            $kategori = filter_var(
                $_GET['kategori'],
                FILTER_VALIDATE_INT
            );

            if (!$kategori || $kategori <= 0) {
                admin_fail('Filter kategori tidak valid.', 422);
            }

            $where[] = 'f.id_kategori = :kategori';

            $params[':kategori'] = (int) $kategori;
        }

        // ----------------------------------------------------
        // E. MENYUSUN WHERE CLAUSE
        // ----------------------------------------------------

        $clause = $where
            ? 'WHERE ' . implode(' AND ', $where)
            : '';

        // ----------------------------------------------------
        // F. MENGHITUNG JUMLAH DATA
        // ----------------------------------------------------

        $count = $pdo->prepare("
            SELECT COUNT(*)
            FROM fasilitas f

            INNER JOIN kategori_fasilitas k
                ON k.id_kategori = f.id_kategori

            $clause
        ");

        $count->execute($params);

        $total = (int) $count->fetchColumn();

        // ----------------------------------------------------
        // G. MENGAMBIL DATA DARI DATABASE
        // ----------------------------------------------------

        $stmt = $pdo->prepare("
            SELECT
                f.id_fasilitas,
                f.kode_fasilitas,
                f.nama_fasilitas,
                f.id_kategori,
                f.jumlah_unit,
                f.frekuensi_penggunaan,
                f.status_fasilitas,
                f.id_penginput,

                k.kode_kategori,
                k.nama_kategori,

                u.nama_lengkap AS nama_penginput,

                'Dipilih saat pelaporan' AS lokasi_ruangan

            FROM fasilitas f

            INNER JOIN kategori_fasilitas k
                ON k.id_kategori = f.id_kategori

            LEFT JOIN pengguna u
                ON u.id_pengguna = f.id_penginput

            $clause

            ORDER BY f.id_fasilitas DESC

            LIMIT :limit OFFSET :offset
        ");

        // Bind parameter pencarian dan filter.
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }

        // Bind pagination.
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

        // ----------------------------------------------------
        // H. RESPONSE DATA FASILITAS
        // ----------------------------------------------------

        admin_ok(
            'Data fasilitas berhasil dimuat.',
            [
                'items' => $items,

                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'total_pages' => (int) ceil($total / $limit)
                ]
            ]
        );
    }

    // ========================================================
    // 08. MEMBACA INPUT POST, PUT, DAN DELETE
    // ========================================================

    $input = admin_input();

    // ========================================================
    // 09. POST - MENAMBAHKAN FASILITAS
    // ========================================================

    if ($method === 'POST') {

        // Mengambil input.
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

        // Memvalidasi kategori.
        $idKategori = filter_var(
            $input['id_kategori'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$idKategori || $idKategori <= 0) {
            admin_fail(
                'Kategori fasilitas wajib dipilih.',
                422
            );
        }

        // Memvalidasi jumlah unit.
        $jumlahUnit = filter_var(
            $input['jumlah_unit'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (
            $jumlahUnit === false ||
            $jumlahUnit < 0
        ) {
            admin_fail(
                'Jumlah unit harus berupa bilangan bulat minimal 0.',
                422
            );
        }

        // Memvalidasi frekuensi dan status.
        $frekuensi = admin_fasilitas_frequency($input);
        $status = admin_fasilitas_status($input);

        // Memastikan kategori tersedia.
        admin_fasilitas_check_category(
            $pdo,
            (int) $idKategori
        );

        // Menyimpan fasilitas.
        $stmt = $pdo->prepare("
            INSERT INTO fasilitas (
                kode_fasilitas,
                nama_fasilitas,
                id_kategori,
                jumlah_unit,
                frekuensi_penggunaan,
                status_fasilitas,
                id_penginput
            ) VALUES (
                :kode,
                :nama,
                :kategori,
                :jumlah,
                :frekuensi,
                :status,
                :penginput
            )
        ");

        $stmt->execute([
            ':kode' => $kode,
            ':nama' => $nama,
            ':kategori' => (int) $idKategori,
            ':jumlah' => (int) $jumlahUnit,
            ':frekuensi' => $frekuensi,
            ':status' => $status,
            ':penginput' => admin_user_id()
        ]);

        // Mengembalikan ID fasilitas baru.
        admin_ok(
            'Fasilitas berhasil ditambahkan.',
            [
                'id_fasilitas' => (int) $pdo->lastInsertId()
            ],
            201
        );
    }

    // ========================================================
    // 10. MENGAMBIL ID FASILITAS
    // ========================================================

    $id = admin_id(
        $input,
        'id_fasilitas'
    );

    // ========================================================
    // 11. PUT - MEMPERBARUI DATA FASILITAS
    // ========================================================

    if ($method === 'PUT') {

        // Memastikan fasilitas tersedia.
        if (!admin_fasilitas_exists($pdo, $id)) {
            admin_fail(
                'Fasilitas tidak ditemukan.',
                404
            );
        }

        // Mengambil dan memvalidasi input.
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

        $idKategori = filter_var(
            $input['id_kategori'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$idKategori || $idKategori <= 0) {
            admin_fail(
                'Kategori fasilitas wajib dipilih.',
                422
            );
        }

        $jumlahUnit = filter_var(
            $input['jumlah_unit'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (
            $jumlahUnit === false ||
            $jumlahUnit < 0
        ) {
            admin_fail(
                'Jumlah unit tidak valid.',
                422
            );
        }

        $frekuensi = admin_fasilitas_frequency($input);
        $status = admin_fasilitas_status($input);

        // Memastikan kategori masih aktif.
        admin_fasilitas_check_category(
            $pdo,
            (int) $idKategori
        );

        // Memperbarui data fasilitas.
        $stmt = $pdo->prepare("
            UPDATE fasilitas
            SET
                kode_fasilitas = :kode,
                nama_fasilitas = :nama,
                id_kategori = :kategori,
                jumlah_unit = :jumlah,
                frekuensi_penggunaan = :frekuensi,
                status_fasilitas = :status

            WHERE id_fasilitas = :id
        ");

        $stmt->execute([
            ':kode' => $kode,
            ':nama' => $nama,
            ':kategori' => (int) $idKategori,
            ':jumlah' => (int) $jumlahUnit,
            ':frekuensi' => $frekuensi,
            ':status' => $status,
            ':id' => $id
        ]);

        admin_ok(
            'Data fasilitas berhasil diperbarui.'
        );
    }

    // ========================================================
    // 12. DELETE - MENGHAPUS DATA FASILITAS
    // ========================================================

    if ($method === 'DELETE') {

        // Memastikan fasilitas tersedia.
        if (!admin_fasilitas_exists($pdo, $id)) {
            admin_fail(
                'Fasilitas tidak ditemukan.',
                404
            );
        }

        // Memeriksa apakah fasilitas pernah digunakan laporan.
        $checkReport = $pdo->prepare("
            SELECT COUNT(*)
            FROM laporan_kerusakan
            WHERE id_fasilitas = :id
        ");

        $checkReport->execute([
            ':id' => $id
        ]);

        $totalLaporan = (int) $checkReport->fetchColumn();

        if ($totalLaporan > 0) {
            admin_fail(
                'Fasilitas tidak dapat dihapus karena sudah digunakan dalam laporan. Ubah status menjadi Nonaktif.',
                409
            );
        }

        // Menghapus fasilitas jika belum digunakan laporan.
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

    // ========================================================
    // 13. MENANGANI ERROR DATABASE
    // ========================================================

    if ((string) $e->getCode() === '23000') {

        admin_fail(
            'Kode fasilitas sudah digunakan atau data masih memiliki relasi dengan tabel lain.',
            409
        );
    }

    admin_exception($e);

} catch (Throwable $e) {

    // ========================================================
    // 14. MENANGANI ERROR APLIKASI
    // ========================================================

    admin_exception($e);
}
