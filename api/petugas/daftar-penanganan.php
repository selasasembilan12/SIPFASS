<?php
declare(strict_types=1);
//revisi akhir
// Memuat konfigurasi session dan koneksi database.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(_DIR_, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

// Mengatur respons JSON.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

date_default_timezone_set('Asia/Jayapura');

// Mengirim respons JSON.
function daftarPenangananResponse(
    int $status,
    bool $success,
    string $message,
    array $data = []
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

    // 01. Memastikan metode request GET.
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        header('Allow: GET');

        daftarPenangananResponse(
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
        daftarPenangananResponse(
            401,
            false,
            'Sesi login tidak ditemukan. Silakan login kembali.'
        );
    }

    // 03. Memastikan akun aktif dan memiliki hak akses.
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
        daftarPenangananResponse(
            401,
            false,
            'Data pengguna tidak ditemukan.'
        );
    }

    if (strcasecmp((string) $user['status_akun'], 'Aktif') !== 0) {
        daftarPenangananResponse(
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
        daftarPenangananResponse(
            403,
            false,
            'Anda tidak memiliki hak akses penanganan laporan.'
        );
    }

    // 04. Mengambil daftar laporan yang sudah lolos verifikasi.
    // Laporan tidak valid dan belum diverifikasi tidak ditampilkan.
    // Riwayat penanganan hanya mengambil catatan terbaru.

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

            lk.id_pelatihan,
            lk.prioritas_awal,
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

            -- DATA KATEGORI
            k.kode_kategori,
            k.nama_kategori,

            -- DATA LOKASI
            l.kode_lokasi,
            l.nama_lokasi AS lokasi_ruangan,

            -- IDENTITAS VERIFIKATOR
            verifikator.nama_lengkap AS nama_verifikator,

            -- IDENTITAS PETUGAS PENANGGUNG JAWAB
            petugas.nama_lengkap AS nama_petugas,

            -- RIWAYAT PENANGANAN TERAKHIR
            rp.id_riwayat_penanganan,
            rp.id_petugas AS id_petugas_penanganan,
            rp.tindak_lanjut_perbaikan,
            rp.catatan_petugas,
            rp.waktu_mulai_penanganan,
            rp.waktu_selesai_penanganan,
            rp.waktu_pembaruan

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

        LEFT JOIN riwayat_penanganan rp
            ON rp.id_riwayat_penanganan = (
                SELECT MAX(rp2.id_riwayat_penanganan)
                FROM riwayat_penanganan rp2
                WHERE rp2.id_laporan = lk.id_laporan
            )

        WHERE
            LOWER(TRIM(lk.status_verifikasi))
                IN ('terverifikasi', 'valid', 'diterima')

            AND LOWER(TRIM(lk.status_penanganan))
                NOT IN (
                    'selesai',
                    'completed',
                    'ditutup',
                    'tidak ditangani'
                )

        ORDER BY
            CASE
                WHEN LOWER(TRIM(lk.status_penanganan))
                    IN (
                        'menunggu penanganan',
                        'menunggu',
                        'belum ditangani'
                    )
                THEN 0
                ELSE 1
            END ASC,

            lk.tanggal_diperbarui DESC,
            lk.id_laporan DESC
    ";

    $stmt = $pdo->query($sql);

    $laporan = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 05. Menormalisasi data numerik.
    foreach ($laporan as &$item) {

        $integerFields = [
            'id_laporan',
            'id_pelapor',
            'id_fasilitas',
            'id_lokasi',
            'tingkat_kerusakan_x1',
            'dampak_akademik_x2',
            'frekuensi_penggunaan_x3',
            'tingkat_kerusakan_x1_terverifikasi',
            'dampak_akademik_x2_terverifikasi',
            'id_pelatihan',
            'id_verifikator',
            'id_petugas_penanggung_jawab',
            'id_riwayat_penanganan',
            'id_petugas_penanganan'
        ];

        foreach ($integerFields as $field) {
            if (
                array_key_exists($field, $item) &&
                $item[$field] !== null
            ) {
                $item[$field] = (int) $item[$field];
            }
        }

        // Menentukan status penanganan berdasarkan data database.
        $status = strtolower(
            trim((string) $item['status_penanganan'])
        );

        if (
            in_array(
                $status,
                ['menunggu penanganan', 'menunggu', 'belum ditangani'],
                true
            )
        ) {
            $item['status_penanganan_label'] = 'Menunggu Penanganan';

        } elseif (
            in_array(
                $status,
                ['diproses', 'dalam proses', 'sedang dikerjakan'],
                true
            )
        ) {
            $item['status_penanganan_label'] = 'Sedang Diproses';

        } else {
            $item['status_penanganan_label'] =
                $item['status_penanganan'];
        }
    }

    unset($item);

    // 06. Menghitung jumlah laporan berdasarkan status penanganan.
    $stats = [
        'total' => count($laporan),
        'menunggu' => 0,
        'diproses' => 0,
        'ditugaskan' => 0
    ];

    foreach ($laporan as $item) {

        $status = strtolower(
            trim((string) $item['status_penanganan'])
        );

        if (
            in_array(
                $status,
                ['menunggu penanganan', 'menunggu', 'belum ditangani'],
                true
            )
        ) {
            $stats['menunggu']++;

        } elseif (
            in_array(
                $status,
                ['diproses', 'dalam proses', 'sedang dikerjakan'],
                true
            )
        ) {
            $stats['diproses']++;
        }

        if (
            !empty($item['id_petugas_penanggung_jawab'])
        ) {
            $stats['ditugaskan']++;
        }
    }

    // 07. Mengirim daftar laporan kepada JavaScript.
    daftarPenangananResponse(
        200,
        true,
        'Daftar penanganan berhasil dimuat.',
        [
            'laporan' => $laporan,
            'stats' => $stats
        ]
    );

} catch (Throwable $e) {

    // Mencatat detail kesalahan tanpa membocorkan informasi server.
    error_log(
        '[SIPFAS DAFTAR PENANGANAN ERROR] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    daftarPenangananResponse(
        500,
        false,
        'Gagal mengambil daftar penanganan. Periksa PHP error log.'
    );
}
