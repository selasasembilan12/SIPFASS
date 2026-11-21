<?php
declare(strict_types=1);
//revisi akhir
// Memuat konfigurasi session dan koneksi database.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(__DIR__, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

// Mengatur respons JSON.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

date_default_timezone_set('Asia/Jayapura');

// Mengirim respons JSON.
function riwayatLaporanResponse(
    int $status,
    bool $success,
    string $message,
    array $data = [],
    array $stats = []
): never {
    http_response_code($status);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data,
        'stats' => $stats
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

try {

    // 01. Memastikan metode request GET.
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        header('Allow: GET');

        riwayatLaporanResponse(
            405,
            false,
            'Metode permintaan tidak diizinkan.'
        );
    }

    // 02. Memeriksa session pengguna.
    $userId = (int) (
        $_SESSION['id_pengguna']
        ?? $_SESSION['user']['id_pengguna']
        ?? $_SESSION['sipfas_user']['id_pengguna']
        ?? 0
    );

    if (
        $userId <= 0 ||
        ($_SESSION['login_terverifikasi'] ?? false) !== true
    ) {
        riwayatLaporanResponse(
            401,
            false,
            'Sesi login tidak ditemukan. Silakan login kembali.'
        );
    }

    // 03. Memeriksa identitas dan hak akses.
    $userStmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.status_akun,
            p.nama_peran
        FROM pengguna u
        INNER JOIN peran p
            ON p.id_peran = u.id_peran
        WHERE u.id_pengguna = :id
        LIMIT 1
    ");

    $userStmt->execute([
        ':id' => $userId
    ]);

    $user = $userStmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        riwayatLaporanResponse(
            401,
            false,
            'Data pengguna tidak ditemukan.'
        );
    }

    if (strcasecmp((string) $user['status_akun'], 'Aktif') !== 0) {
        riwayatLaporanResponse(
            403,
            false,
            'Akun pengguna tidak aktif.'
        );
    }

    if (
        !in_array(
            (string) $user['nama_peran'],
            ['Petugas Sarpras', 'Administrator'],
            true
        )
    ) {
        riwayatLaporanResponse(
            403,
            false,
            'Anda tidak memiliki akses riwayat laporan.'
        );
    }

    // 04. Mengambil filter pencarian jika tersedia.
    $keyword = trim((string) ($_GET['keyword'] ?? ''));
    $filterStatus = trim((string) ($_GET['status'] ?? ''));

    if (mb_strlen($keyword) > 150) {
        riwayatLaporanResponse(
            422,
            false,
            'Kata pencarian terlalu panjang.'
        );
    }

    if (mb_strlen($filterStatus) > 30) {
        riwayatLaporanResponse(
            422,
            false,
            'Filter status tidak valid.'
        );
    }

    // 05. Menyusun kondisi pencarian.
    $where = [];
    $params = [];

    if ($keyword !== '') {
        $where[] = "(
            lk.kode_laporan LIKE :keyword1
            OR pelapor.nama_lengkap LIKE :keyword2
            OR pelapor.nomor_identitas LIKE :keyword3
            OR f.nama_fasilitas LIKE :keyword4
            OR l.nama_lokasi LIKE :keyword5
        )";

        $search = '%' . $keyword . '%';

        $params[':keyword1'] = $search;
        $params[':keyword2'] = $search;
        $params[':keyword3'] = $search;
        $params[':keyword4'] = $search;
        $params[':keyword5'] = $search;
    }

    if ($filterStatus !== '') {
        $allowedFilters = [
            'selesai',
            'tidak valid',
            'sedang diproses',
            'menunggu penanganan',
            'menunggu verifikasi'
        ];

        if (
            !in_array(
                strtolower($filterStatus),
                $allowedFilters,
                true
            )
        ) {
            riwayatLaporanResponse(
                422,
                false,
                'Pilihan filter status tidak tersedia.'
            );
        }

        if (strtolower($filterStatus) === 'selesai') {
            $where[] = "LOWER(TRIM(lk.status_penanganan))
                IN ('selesai', 'completed', 'ditutup')";

        } elseif (strtolower($filterStatus) === 'tidak valid') {
            $where[] = "LOWER(TRIM(lk.status_verifikasi))
                IN ('tidak valid', 'invalid', 'ditolak')";

        } elseif (strtolower($filterStatus) === 'sedang diproses') {
            $where[] = "LOWER(TRIM(lk.status_penanganan))
                IN ('sedang diproses', 'diproses',
                    'dalam proses', 'sedang dikerjakan')";

        } elseif (strtolower($filterStatus) === 'menunggu penanganan') {
            $where[] = "LOWER(TRIM(lk.status_penanganan))
                IN ('menunggu penanganan', 'menunggu',
                    'belum ditangani')";

        } elseif (strtolower($filterStatus) === 'menunggu verifikasi') {
            $where[] = "LOWER(TRIM(lk.status_verifikasi))
                IN ('menunggu', 'menunggu verifikasi',
                    'pending', 'diajukan', 'baru')";
        }
    }

    $whereSql = count($where) > 0
        ? 'WHERE ' . implode(' AND ', $where)
        : '';

    // 06. Mengambil seluruh laporan beserta informasi pendukung.
    $sql = "
        SELECT
            lk.id_laporan,
            lk.kode_laporan,

            lk.id_pelapor,
            lk.id_fasilitas,
            lk.id_lokasi,

            lk.deskripsi_kerusakan,

            lk.tingkat_kerusakan_x1,
            lk.dampak_akademik_x2,
            lk.frekuensi_penggunaan_x3,

            lk.tingkat_kerusakan_x1_terverifikasi,
            lk.dampak_akademik_x2_terverifikasi,

            lk.prioritas_awal,
            lk.prioritas_prediksi,

            lk.id_pelatihan_awal,
            lk.id_pelatihan,

            lk.status_verifikasi,
            lk.status_penanganan,

            lk.id_verifikator,
            lk.id_petugas_penanggung_jawab,

            lk.catatan_verifikasi,
            lk.waktu_verifikasi,

            lk.tanggal_dibuat,
            lk.tanggal_diperbarui,

            -- IDENTITAS PELAPOR
            pelapor.nama_lengkap AS nama_pelapor,
            pelapor.nomor_identitas,
            pelapor.email AS email_pelapor,

            -- DATA FASILITAS
            f.kode_fasilitas,
            f.nama_fasilitas,

            -- DATA LOKASI
            l.kode_lokasi,
            l.nama_lokasi AS lokasi_ruangan,

            -- IDENTITAS VERIFIKATOR
            verifikator.nama_lengkap AS nama_verifikator,

            -- IDENTITAS PETUGAS
            petugas.nama_lengkap AS nama_petugas,

            -- RIWAYAT VERIFIKASI TERAKHIR
            rv.id_riwayat_verifikasi,
            rv.hasil_verifikasi,

            rv.x1_sebelum,
            rv.x1_sesudah,
            rv.x2_sebelum,
            rv.x2_sesudah,
            rv.x3_digunakan,

            rv.prioritas_sebelum,
            rv.prioritas_sesudah,

            rv.alasan_koreksi,
            rv.catatan_verifikasi AS catatan_verifikasi_terakhir,
            rv.waktu_verifikasi AS waktu_verifikasi_terakhir

        FROM laporan_kerusakan lk

        LEFT JOIN pengguna pelapor
            ON pelapor.id_pengguna = lk.id_pelapor

        LEFT JOIN fasilitas f
            ON f.id_fasilitas = lk.id_fasilitas

        LEFT JOIN lokasi_ruangan l
            ON l.id_lokasi = lk.id_lokasi

        LEFT JOIN pengguna verifikator
            ON verifikator.id_pengguna = lk.id_verifikator

        LEFT JOIN pengguna petugas
            ON petugas.id_pengguna =
                lk.id_petugas_penanggung_jawab

        LEFT JOIN riwayat_verifikasi_laporan rv
            ON rv.id_riwayat_verifikasi = (
                SELECT MAX(rv2.id_riwayat_verifikasi)
                FROM riwayat_verifikasi_laporan rv2
                WHERE rv2.id_laporan = lk.id_laporan
            )

        {$whereSql}

        ORDER BY
            lk.tanggal_dibuat DESC,
            lk.id_laporan DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $laporan = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 07. Mengambil seluruh riwayat penanganan.
    $historyStmt = $pdo->query("
        SELECT
            rp.id_riwayat_penanganan,
            rp.id_laporan,
            rp.id_petugas,
            rp.tindak_lanjut_perbaikan,
            rp.catatan_petugas,
            rp.waktu_mulai_penanganan,
            rp.waktu_selesai_penanganan,
            rp.waktu_pembaruan,

            u.nama_lengkap AS nama_petugas

        FROM riwayat_penanganan rp

        INNER JOIN pengguna u
            ON u.id_pengguna = rp.id_petugas

        ORDER BY
            rp.waktu_pembaruan DESC,
            rp.id_riwayat_penanganan DESC
    ");

    $semuaRiwayatPenanganan = $historyStmt->fetchAll(
        PDO::FETCH_ASSOC
    );

    // 08. Mengambil seluruh riwayat perubahan status.
    $statusStmt = $pdo->query("
        SELECT
            rs.id_riwayat,
            rs.id_laporan,
            rs.id_pengguna,
            rs.jenis_status,
            rs.status_sebelumnya,
            rs.status_baru,
            rs.catatan,
            rs.tanggal_perubahan,

            u.nama_lengkap AS nama_pengguna

        FROM riwayat_status_laporan rs

        INNER JOIN pengguna u
            ON u.id_pengguna = rs.id_pengguna

        ORDER BY
            rs.tanggal_perubahan DESC,
            rs.id_riwayat DESC
    ");

    $semuaRiwayatStatus = $statusStmt->fetchAll(
        PDO::FETCH_ASSOC
    );

    // 09. Mengelompokkan riwayat berdasarkan ID laporan.
    $riwayatPenanganan = [];

    foreach ($semuaRiwayatPenanganan as $item) {
        $id = (int) $item['id_laporan'];

        $item['id_riwayat_penanganan'] =
            (int) $item['id_riwayat_penanganan'];

        $item['id_laporan'] = $id;
        $item['id_petugas'] = (int) $item['id_petugas'];

        $riwayatPenanganan[$id][] = $item;
    }

    $riwayatStatus = [];

    foreach ($semuaRiwayatStatus as $item) {
        $id = (int) $item['id_laporan'];

        $item['id_riwayat'] = (int) $item['id_riwayat'];
        $item['id_laporan'] = $id;
        $item['id_pengguna'] = (int) $item['id_pengguna'];

        $riwayatStatus[$id][] = $item;
    }

    // 10. Menyusun laporan dan seluruh riwayatnya.
    $stats = [
        'total' => 0,
        'selesai' => 0,
        'tidak_valid' => 0,
        'diproses' => 0,
        'menunggu_penanganan' => 0,
        'menunggu_verifikasi' => 0
    ];

    foreach ($laporan as &$item) {

        $id = (int) $item['id_laporan'];

        $item['id_laporan'] = $id;

        $integerFields = [
            'id_pelapor',
            'id_fasilitas',
            'id_lokasi',
            'tingkat_kerusakan_x1',
            'dampak_akademik_x2',
            'frekuensi_penggunaan_x3',
            'tingkat_kerusakan_x1_terverifikasi',
            'dampak_akademik_x2_terverifikasi'
        ];

        foreach ($integerFields as $field) {
            if (
                $item[$field] !== null
            ) {
                $item[$field] = (int) $item[$field];
            }
        }

        // Menyisipkan riwayat milik masing-masing laporan.
        $item['riwayat_penanganan'] =
            $riwayatPenanganan[$id] ?? [];

        $item['riwayat_status'] =
            $riwayatStatus[$id] ?? [];

        $verification = strtolower(
            trim((string) $item['status_verifikasi'])
        );

        $handling = strtolower(
            trim((string) $item['status_penanganan'])
        );

        $stats['total']++;

        if (
            in_array(
                $verification,
                ['tidak valid', 'invalid', 'ditolak'],
                true
            )
        ) {
            $stats['tidak_valid']++;

        } elseif (
            in_array(
                $handling,
                ['selesai', 'completed', 'ditutup'],
                true
            )
        ) {
            $stats['selesai']++;

        } elseif (
            in_array(
                $handling,
                [
                    'sedang diproses',
                    'diproses',
                    'dalam proses',
                    'sedang dikerjakan'
                ],
                true
            )
        ) {
            $stats['diproses']++;

        } elseif (
            in_array(
                $verification,
                [
                    'menunggu',
                    'menunggu verifikasi',
                    'pending',
                    'diajukan',
                    'baru'
                ],
                true
            )
        ) {
            $stats['menunggu_verifikasi']++;

        } else {
            $stats['menunggu_penanganan']++;
        }
    }

    unset($item);

    // 11. Mengirim seluruh riwayat laporan.
    riwayatLaporanResponse(
        200,
        true,
        'Riwayat laporan berhasil dimuat.',
        $laporan,
        $stats
    );

} catch (Throwable $e) {

    error_log(
        '[SIPFAS RIWAYAT LAPORAN ERROR] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    riwayatLaporanResponse(
        500,
        false,
        'Gagal mengambil riwayat laporan. Periksa PHP error log.'
    );
}
