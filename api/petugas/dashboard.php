<?php
declare(strict_types=1);
//refisi akhir

// Memuat konfigurasi session dan koneksi database SIPFAS.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

// Mengatur respons JSON dan zona waktu WIT.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

date_default_timezone_set('Asia/Jayapura');

// Mengirim respons JSON.
function dashboardResponse(
    int $status,
    bool $success,
    string $message,
    array $data = [],
    ?array $stats = null
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

    // Mengambil identitas pengguna dari session login.
    $userId = (int) (
        $_SESSION['id_pengguna']
        ?? $_SESSION['user']['id_pengguna']
        ?? $_SESSION['sipfas_user']['id_pengguna']
        ?? 0
    );

    // Memastikan pengguna sudah melewati autentikasi.
    if (
        $userId <= 0 ||
        ($_SESSION['login_terverifikasi'] ?? false) !== true
    ) {
        dashboardResponse(
            401,
            false,
            'Sesi login tidak ditemukan. Silakan login kembali.'
        );
    }

    // Memastikan akun pengguna masih aktif dan memiliki peran yang benar.
    $userStmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.id_peran,
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
        dashboardResponse(
            401,
            false,
            'Data pengguna tidak ditemukan.'
        );
    }

    if (strcasecmp((string) $user['status_akun'], 'Aktif') !== 0) {
        dashboardResponse(
            403,
            false,
            'Akun tidak aktif. Hubungi Administrator.'
        );
    }

    if (
        !in_array(
            (string) $user['nama_peran'],
            ['Petugas Sarpras', 'Administrator'],
            true
        )
    ) {
        dashboardResponse(
            403,
            false,
            'Anda tidak memiliki akses ke Dashboard Petugas.'
        );
    }

    // Mengambil laporan beserta data pelapor, fasilitas, dan lokasi.
    // Subquery memastikan hanya riwayat verifikasi terbaru yang digunakan.
    // Subquery penanganan juga hanya mengambil catatan terbaru setiap laporan.
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

            lk.status_verifikasi,
            lk.status_penanganan,

            lk.id_verifikator,
            lk.id_petugas_penanggung_jawab,

            lk.catatan_verifikasi,
            lk.waktu_verifikasi,

            lk.tanggal_dibuat,
            lk.tanggal_diperbarui,

            u.nama_lengkap AS nama_pelapor,
            u.nomor_identitas,

            f.kode_fasilitas,
            f.nama_fasilitas,
            f.frekuensi_penggunaan,

            l.kode_lokasi,
            l.nama_lokasi AS lokasi_ruangan,

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
            rv.waktu_verifikasi AS waktu_verifikasi_terakhir,

            verifikator.nama_lengkap AS nama_verifikator,

            rp.id_riwayat_penanganan,
            rp.id_petugas AS id_petugas_penanganan,

            rp.tindak_lanjut_perbaikan,
            rp.catatan_petugas,

            rp.waktu_mulai_penanganan,
            rp.waktu_selesai_penanganan,
            rp.waktu_pembaruan,

            petugas.nama_lengkap AS nama_petugas

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

        LEFT JOIN riwayat_penanganan rp
            ON rp.id_riwayat_penanganan = (
                SELECT MAX(rp2.id_riwayat_penanganan)
                FROM riwayat_penanganan rp2
                WHERE rp2.id_laporan = lk.id_laporan
            )

        LEFT JOIN pengguna petugas
            ON petugas.id_pengguna = COALESCE(
                lk.id_petugas_penanggung_jawab,
                rp.id_petugas
            )

        ORDER BY
            lk.tanggal_dibuat DESC,
            lk.id_laporan DESC
    ";

    $stmt = $pdo->query($sql);

    $laporan = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Menghitung statistik berdasarkan status database.
    $stats = [
        'total' => count($laporan),
        'pending' => 0,
        'handling' => 0,
        'completed' => 0,
        'invalid' => 0
    ];

    foreach ($laporan as $item) {

        $verification = strtolower(
            trim((string) ($item['hasil_verifikasi'] ?? ''))
        );

        $verificationStatus = strtolower(
            trim((string) ($item['status_verifikasi'] ?? ''))
        );

        $handlingStatus = strtolower(
            trim((string) ($item['status_penanganan'] ?? ''))
        );

        // Laporan yang ditolak atau tidak valid.
        if (
            in_array(
                $verification,
                ['tidak valid', 'invalid', 'ditolak'],
                true
            ) ||
            in_array(
                $verificationStatus,
                ['tidak valid', 'invalid', 'ditolak'],
                true
            )
        ) {
            $stats['invalid']++;
            continue;
        }

        // Laporan yang sudah selesai diperbaiki.
        if (
            in_array(
                $handlingStatus,
                ['selesai', 'completed', 'ditutup'],
                true
            )
        ) {
            $stats['completed']++;
            continue;
        }

        // Laporan valid yang masuk proses penanganan.
        if (
            in_array(
                $verification,
                ['valid', 'terverifikasi', 'diterima'],
                true
            ) ||
            in_array(
                $verificationStatus,
                ['valid', 'terverifikasi', 'diterima'],
                true
            ) ||
            in_array(
                $handlingStatus,
                [
                    'diproses',
                    'dalam proses',
                    'sedang dikerjakan',
                    'menunggu perbaikan'
                ],
                true
            )
        ) {
            $stats['handling']++;
            continue;
        }

        // Laporan yang belum diverifikasi.
        $stats['pending']++;
    }

    // Mengirim data laporan dan statistik kepada Dashboard.js.
    dashboardResponse(
        200,
        true,
        'Data Dashboard Petugas berhasil dimuat.',
        $laporan,
        $stats
    );

} catch (Throwable $e) {

    // Mencatat detail kesalahan tanpa membocorkan informasi server.
    error_log(
        '[SIPFAS DASHBOARD ERROR] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    dashboardResponse(
        500,
        false,
        'Gagal memuat Dashboard Petugas. Periksa PHP error log.'
    );
}
