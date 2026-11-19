<?php
declare(strict_types=1);
//revisi akhir demi
// Memuat konfigurasi session dan koneksi database.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

// Mengatur respons JSON dan zona waktu.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

date_default_timezone_set('Asia/Jayapura');

// Mengirim respons JSON.
function detailVerifikasiResponse(
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

    // 01. Memastikan metode permintaan GET.
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        header('Allow: GET');

        detailVerifikasiResponse(
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
        detailVerifikasiResponse(
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
        detailVerifikasiResponse(
            401,
            false,
            'Data pengguna tidak ditemukan.'
        );
    }

    if (strcasecmp((string) $user['status_akun'], 'Aktif') !== 0) {
        detailVerifikasiResponse(
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
        detailVerifikasiResponse(
            403,
            false,
            'Anda tidak memiliki akses untuk melihat detail verifikasi.'
        );
    }

    // 04. Mengambil kode laporan dari URL.
    $kode = trim((string) ($_GET['kode'] ?? ''));

    if ($kode === '') {
        detailVerifikasiResponse(
            400,
            false,
            'Kode laporan wajib diisi.'
        );
    }

    if (mb_strlen($kode) > 30) {
        detailVerifikasiResponse(
            422,
            false,
            'Format kode laporan tidak valid.'
        );
    }

    // 05. Mengambil detail laporan, pelapor, fasilitas, dan lokasi.
    // Relasi lokasi menggunakan id_lokasi, bukan kolom fasilitas.

    $sql = "
        SELECT
            lk.*,

            -- IDENTITAS PELAPOR
            u.nama_lengkap AS nama_pelapor,
            u.nomor_identitas,
            u.nama_pengguna AS username_pelapor,
            u.email AS email_pelapor,

            -- DATA FASILITAS
            f.kode_fasilitas,
            f.nama_fasilitas,
            f.frekuensi_penggunaan AS frekuensi_fasilitas,
            f.status_fasilitas,

            -- KATEGORI FASILITAS
            k.kode_kategori,
            k.nama_kategori,

            -- DATA LOKASI
            l.kode_lokasi,
            l.nama_lokasi AS lokasi_ruangan,
            l.status_lokasi,

            -- MODEL C4.5 AWAL
            model_awal.versi_algoritma AS versi_model_awal,
            model_awal.akurasi AS akurasi_model_awal,
            model_awal.presisi AS presisi_model_awal,
            model_awal.recall AS recall_model_awal,
            model_awal.skor_f1 AS f1_model_awal,
            model_awal.waktu_pelatihan AS waktu_pelatihan_awal,

            -- MODEL C4.5 TERKINI
            model_aktif.versi_algoritma AS versi_model_terkini,
            model_aktif.akurasi AS akurasi_model_terkini,
            model_aktif.presisi AS presisi_model_terkini,
            model_aktif.recall AS recall_model_terkini,
            model_aktif.skor_f1 AS f1_model_terkini,
            model_aktif.waktu_pelatihan AS waktu_pelatihan_terkini,

            -- RIWAYAT VERIFIKASI TERAKHIR
            rv.id_riwayat_verifikasi,
            rv.id_verifikator AS id_verifikator_terakhir,
            rv.hasil_verifikasi,

            rv.x1_sebelum,
            rv.x1_sesudah,

            rv.x2_sebelum,
            rv.x2_sesudah,

            rv.x3_digunakan,

            rv.prioritas_sebelum,
            rv.prioritas_sesudah,

            rv.id_pelatihan_sebelum,
            rv.id_pelatihan_sesudah,

            rv.alasan_koreksi,
            rv.catatan_verifikasi AS catatan_verifikasi_terakhir,
            rv.waktu_verifikasi AS waktu_verifikasi_terakhir,

            -- IDENTITAS VERIFIKATOR
            verifikator.nama_lengkap AS nama_verifikator

        FROM laporan_kerusakan lk

        LEFT JOIN pengguna u
            ON u.id_pengguna = lk.id_pelapor

        LEFT JOIN fasilitas f
            ON f.id_fasilitas = lk.id_fasilitas

        LEFT JOIN kategori_fasilitas k
            ON k.id_kategori = f.id_kategori

        LEFT JOIN lokasi_ruangan l
            ON l.id_lokasi = lk.id_lokasi

        LEFT JOIN riwayat_pelatihan_c45 model_awal
            ON model_awal.id_pelatihan = lk.id_pelatihan_awal

        LEFT JOIN riwayat_pelatihan_c45 model_aktif
            ON model_aktif.id_pelatihan = lk.id_pelatihan

        LEFT JOIN riwayat_verifikasi_laporan rv
            ON rv.id_riwayat_verifikasi = (
                SELECT MAX(rv2.id_riwayat_verifikasi)
                FROM riwayat_verifikasi_laporan rv2
                WHERE rv2.id_laporan = lk.id_laporan
            )

        LEFT JOIN pengguna verifikator
            ON verifikator.id_pengguna = COALESCE(
                rv.id_verifikator,
                lk.id_verifikator
            )

        WHERE lk.kode_laporan = :kode

        LIMIT 1
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        ':kode' => $kode
    ]);

    $laporan = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$laporan) {
        detailVerifikasiResponse(
            404,
            false,
            'Laporan dengan kode ' . $kode . ' tidak ditemukan.'
        );
    }

    // 06. Menormalisasi nilai numerik.
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
        'id_pelatihan_awal',
        'id_pelatihan',
        'id_verifikator',
        'id_petugas_penanggung_jawab',
        'id_riwayat_verifikasi',
        'id_verifikator_terakhir',
        'x1_sebelum',
        'x1_sesudah',
        'x2_sebelum',
        'x2_sesudah',
        'x3_digunakan',
        'id_pelatihan_sebelum',
        'id_pelatihan_sesudah'
    ];

    foreach ($integerFields as $field) {
        if (
            array_key_exists($field, $laporan) &&
            $laporan[$field] !== null
        ) {
            $laporan[$field] = (int) $laporan[$field];
        }
    }

    // 07. Mengirim detail laporan kepada halaman JavaScript.
    detailVerifikasiResponse(
        200,
        true,
        'Detail laporan berhasil dimuat.',
        $laporan
    );

} catch (Throwable $e) {

    // Mencatat kesalahan pada log PHP.
    error_log(
        '[SIPFAS DETAIL VERIFIKASI ERROR] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    detailVerifikasiResponse(
        500,
        false,
        'Terjadi kesalahan saat memuat detail verifikasi. Periksa PHP error log.'
    );
}
