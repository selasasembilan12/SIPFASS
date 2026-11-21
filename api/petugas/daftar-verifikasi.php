<?php
declare(strict_types=1);
//revisi akhir
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(__DIR__, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

date_default_timezone_set('Asia/Jayapura');

function verifikasiListResponse(
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

    // 01. VALIDASI METODE REQUEST
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        header('Allow: GET');

        verifikasiListResponse(
            405,
            false,
            'Metode request tidak diizinkan.'
        );
    }

    // 02. VALIDASI SESSION
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
        verifikasiListResponse(
            401,
            false,
            'Sesi login tidak valid. Silakan login kembali.'
        );
    }

    // 03. VALIDASI IDENTITAS DAN HAK AKSES
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
        verifikasiListResponse(
            401,
            false,
            'Pengguna tidak ditemukan.'
        );
    }

    if (strcasecmp((string) $user['status_akun'], 'Aktif') !== 0) {
        verifikasiListResponse(
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
        verifikasiListResponse(
            403,
            false,
            'Anda tidak memiliki hak akses verifikasi laporan.'
        );
    }

    // 04. MENGAMBIL LAPORAN DAN DATA VERIFIKASI TERAKHIR
    //
    // Relasi lokasi:
    // laporan_kerusakan.id_lokasi
    //     -> lokasi_ruangan.id_lokasi
    //
    // Relasi fasilitas:
    // laporan_kerusakan.id_fasilitas
    //     -> fasilitas.id_fasilitas

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
            u.nama_lengkap AS nama_pelapor,
            u.nomor_identitas,
            u.nama_pengguna AS username_pelapor,

            -- DATA FASILITAS
            f.kode_fasilitas,
            f.nama_fasilitas,
            f.frekuensi_penggunaan,
            f.status_fasilitas,

            -- DATA LOKASI
            l.kode_lokasi,
            l.nama_lokasi AS lokasi_ruangan,
            l.status_lokasi,

            -- HASIL VERIFIKASI TERAKHIR
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

        LEFT JOIN lokasi_ruangan l
            ON l.id_lokasi = lk.id_lokasi

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

        ORDER BY
            CASE
                WHEN LOWER(TRIM(lk.status_verifikasi))
                    IN ('menunggu', 'menunggu verifikasi',
                        'pending', 'diajukan', 'baru')
                THEN 0
                ELSE 1
            END ASC,

            lk.tanggal_dibuat DESC,
            lk.id_laporan DESC
    ";

    $stmt = $pdo->query($sql);

    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 05. NORMALISASI DATA UNTUK RESPONS JSON
    foreach ($data as &$laporan) {

        $laporan['id_laporan'] = (int) $laporan['id_laporan'];

        $laporan['id_pelapor'] = (int) $laporan['id_pelapor'];

        $laporan['id_fasilitas'] = (int) $laporan['id_fasilitas'];

        $laporan['id_lokasi'] = (int) $laporan['id_lokasi'];

        $laporan['tingkat_kerusakan_x1'] =
            (int) $laporan['tingkat_kerusakan_x1'];

        $laporan['dampak_akademik_x2'] =
            (int) $laporan['dampak_akademik_x2'];

        $laporan['frekuensi_penggunaan_x3'] =
            (int) $laporan['frekuensi_penggunaan_x3'];

        if ($laporan['x1_sebelum'] !== null) {
            $laporan['x1_sebelum'] = (int) $laporan['x1_sebelum'];
        }

        if ($laporan['x1_sesudah'] !== null) {
            $laporan['x1_sesudah'] = (int) $laporan['x1_sesudah'];
        }

        if ($laporan['x2_sebelum'] !== null) {
            $laporan['x2_sebelum'] = (int) $laporan['x2_sebelum'];
        }

        if ($laporan['x2_sesudah'] !== null) {
            $laporan['x2_sesudah'] = (int) $laporan['x2_sesudah'];
        }

        if ($laporan['x3_digunakan'] !== null) {
            $laporan['x3_digunakan'] = (int) $laporan['x3_digunakan'];
        }

        $laporan['id_riwayat_verifikasi'] =
            $laporan['id_riwayat_verifikasi'] !== null
                ? (int) $laporan['id_riwayat_verifikasi']
                : null;
    }

    unset($laporan);

    // 06. MENGIRIM DATA
    verifikasiListResponse(
        200,
        true,
        'Daftar laporan berhasil dimuat.',
        $data
    );

} catch (Throwable $e) {

    error_log(
        '[SIPFAS DAFTAR VERIFIKASI ERROR] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    verifikasiListResponse(
        500,
        false,
        'Terjadi kesalahan saat mengambil daftar verifikasi.'
    );
}
