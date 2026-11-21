<?php
declare(strict_types=1);
//revisi akhir
// Memuat konfigurasi session dan koneksi database.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(_DIR_, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

date_default_timezone_set('Asia/Jayapura');

// Mengirim respons JSON.
function detailPenangananResponse(
    int $status,
    bool $success,
    string $message,
    ?array $data = null
): never {
    http_response_code($status);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

try {

    // 01. Memastikan metode GET.
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        header('Allow: GET');

        detailPenangananResponse(
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
        detailPenangananResponse(
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
        detailPenangananResponse(
            401,
            false,
            'Identitas pengguna tidak ditemukan.'
        );
    }

    if (strcasecmp((string) $user['status_akun'], 'Aktif') !== 0) {
        detailPenangananResponse(
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
        detailPenangananResponse(
            403,
            false,
            'Anda tidak memiliki akses penanganan laporan.'
        );
    }

    // 04. Mengambil identitas laporan.
    $kode = trim((string) (
        $_GET['kode']
        ?? $_GET['kode_laporan']
        ?? ''
    ));

    $idLaporan = filter_var(
        $_GET['id_laporan'] ?? null,
        FILTER_VALIDATE_INT
    );

    if ($kode === '' && (!$idLaporan || $idLaporan <= 0)) {
        detailPenangananResponse(
            400,
            false,
            'Kode laporan atau ID laporan wajib diisi.'
        );
    }

    if ($kode !== '' && mb_strlen($kode) > 30) {
        detailPenangananResponse(
            422,
            false,
            'Kode laporan tidak valid.'
        );
    }

    // 05. Mengambil detail laporan.
    $where = $kode !== ''
        ? 'lk.kode_laporan = :kode'
        : 'lk.id_laporan = :id_laporan';

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

            lk.id_pelatihan_awal,
            lk.prioritas_awal,

            lk.id_pelatihan,
            lk.prioritas_prediksi,

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
            f.frekuensi_penggunaan,
            f.status_fasilitas,

            -- KATEGORI FASILITAS
            k.kode_kategori,
            k.nama_kategori,

            -- DATA LOKASI
            l.kode_lokasi,
            l.nama_lokasi AS lokasi_ruangan,
            l.status_lokasi,

            -- IDENTITAS VERIFIKATOR
            verifikator.nama_lengkap AS nama_verifikator,

            -- IDENTITAS PETUGAS PENANGGUNG JAWAB
            petugas.nama_lengkap AS nama_petugas,
            petugas.nomor_identitas AS identitas_petugas,

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

        LEFT JOIN kategori_fasilitas k
            ON k.id_kategori = f.id_kategori

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

        WHERE {$where}

        LIMIT 1
    ";

    $stmt = $pdo->prepare($sql);

    if ($kode !== '') {
        $stmt->execute([
            ':kode' => $kode
        ]);
    } else {
        $stmt->execute([
            ':id_laporan' => $idLaporan
        ]);
    }

    $laporan = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$laporan) {
        detailPenangananResponse(
            404,
            false,
            'Data laporan tidak ditemukan.'
        );
    }

    // 06. Memastikan laporan sudah lolos verifikasi.
    $statusVerifikasi = strtolower(
        trim((string) $laporan['status_verifikasi'])
    );

    if (
        !in_array(
            $statusVerifikasi,
            ['terverifikasi', 'valid', 'diterima'],
            true
        )
    ) {
        detailPenangananResponse(
            409,
            false,
            'Laporan belum lolos verifikasi dan belum dapat ditangani.'
        );
    }

    // 07. Mengambil seluruh riwayat penanganan.
    $historyStmt = $pdo->prepare("
        SELECT
            rp.id_riwayat_penanganan,
            rp.id_laporan,
            rp.id_petugas,
            rp.tindak_lanjut_perbaikan,
            rp.catatan_petugas,
            rp.waktu_mulai_penanganan,
            rp.waktu_selesai_penanganan,
            rp.waktu_pembaruan,

            u.nama_lengkap AS nama_petugas,
            u.nomor_identitas AS identitas_petugas

        FROM riwayat_penanganan rp

        INNER JOIN pengguna u
            ON u.id_pengguna = rp.id_petugas

        WHERE rp.id_laporan = :id_laporan

        ORDER BY
            rp.waktu_pembaruan DESC,
            rp.id_riwayat_penanganan DESC
    ");

    $historyStmt->execute([
        ':id_laporan' => $laporan['id_laporan']
    ]);

    $riwayatPenanganan = $historyStmt->fetchAll(PDO::FETCH_ASSOC);

    // 08. Mengambil riwayat perubahan status.
    $statusStmt = $pdo->prepare("
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

        WHERE rs.id_laporan = :id_laporan

        ORDER BY
            rs.tanggal_perubahan DESC,
            rs.id_riwayat DESC
    ");

    $statusStmt->execute([
        ':id_laporan' => $laporan['id_laporan']
    ]);

    $riwayatStatus = $statusStmt->fetchAll(PDO::FETCH_ASSOC);

    // 09. Normalisasi data numerik.
    $integerFields = [
        'id_laporan',
        'id_pelapor',
        'id_fasilitas',
        'id_lokasi',
        'id_pelatihan_awal',
        'id_pelatihan',
        'id_verifikator',
        'id_petugas_penanggung_jawab',
        'tingkat_kerusakan_x1',
        'dampak_akademik_x2',
        'frekuensi_penggunaan_x3',
        'tingkat_kerusakan_x1_terverifikasi',
        'dampak_akademik_x2_terverifikasi',
        'id_riwayat_verifikasi',
        'x1_sebelum',
        'x1_sesudah',
        'x2_sebelum',
        'x2_sesudah',
        'x3_digunakan'
    ];

    foreach ($integerFields as $field) {
        if (
            array_key_exists($field, $laporan) &&
            $laporan[$field] !== null
        ) {
            $laporan[$field] = (int) $laporan[$field];
        }
    }

    foreach ($riwayatPenanganan as &$item) {
        $item['id_riwayat_penanganan'] =
            (int) $item['id_riwayat_penanganan'];

        $item['id_laporan'] = (int) $item['id_laporan'];

        $item['id_petugas'] = (int) $item['id_petugas'];
    }

    unset($item);

    foreach ($riwayatStatus as &$item) {
        $item['id_riwayat'] = (int) $item['id_riwayat'];
        $item['id_laporan'] = (int) $item['id_laporan'];
        $item['id_pengguna'] = (int) $item['id_pengguna'];
    }

    unset($item);

    // 10. Mengirim detail laporan dan seluruh riwayat.
    detailPenangananResponse(
        200,
        true,
        'Detail penanganan berhasil dimuat.',
        [
            'laporan' => $laporan,
            'riwayat_penanganan' => $riwayatPenanganan,
            'riwayat_status' => $riwayatStatus,
            'total_riwayat_penanganan' => count($riwayatPenanganan),
            'total_riwayat_status' => count($riwayatStatus)
        ]
    );

} catch (Throwable $e) {

    error_log(
        '[SIPFAS DETAIL PENANGANAN ERROR] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    detailPenangananResponse(
        500,
        false,
        'Gagal memuat detail penanganan. Periksa PHP error log.'
    );
}
