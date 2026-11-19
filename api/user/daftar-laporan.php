<?php

declare(strict_types=1);


require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');


/* ============================================================
   01. RESPONSE
============================================================ */

function daftarLaporanResponse(
    bool $success,
    string $message,
    array $data = [],
    int $status = 200
): never {

    http_response_code($status);

    echo json_encode(
        [
            'success' => $success,
            'message' => $message,
            'data' => $data
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_INVALID_UTF8_SUBSTITUTE
    );

    exit;
}


/* ============================================================
   02. MEMERIKSA METHOD
============================================================ */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {

    header('Allow: GET');

    daftarLaporanResponse(
        false,
        'Metode permintaan tidak diizinkan.',
        [],
        405
    );
}


/* ============================================================
   03. MEMERIKSA SESSION LOGIN
============================================================ */

$userSession = $_SESSION['user'] ?? null;

if (
    ($_SESSION['login_terverifikasi'] ?? false) !== true ||
    !is_array($userSession)
) {

    daftarLaporanResponse(
        false,
        'Sesi login tidak ditemukan. Silakan login kembali.',
        [],
        401
    );
}


/* ============================================================
   04. MENGAMBIL ID PENGGUNA
============================================================ */

$idPengguna = (int) (
    $userSession['id_pengguna'] ?? 0
);

if ($idPengguna <= 0) {

    daftarLaporanResponse(
        false,
        'Identitas pengguna tidak valid.',
        [],
        401
    );
}


/* ============================================================
   05. MENGAMBIL DATA DARI DATABASE
============================================================ */

try {

    /*
     * Memastikan pengguna benar-benar ada di database
     * dan memiliki role Pelapor.
     */

    $stmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.nama_lengkap,
            u.nama_pengguna,
            u.status_akun,
            p.id_peran,
            p.nama_peran

        FROM pengguna u

        INNER JOIN peran p
            ON p.id_peran = u.id_peran

        WHERE u.id_pengguna = :id_pengguna

        LIMIT 1
    ");

    $stmt->execute([
        ':id_pengguna' => $idPengguna
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);


    if (!$user) {

        daftarLaporanResponse(
            false,
            'Data pengguna tidak ditemukan.',
            [],
            404
        );
    }


    /* ========================================================
       06. STATUS AKUN
    ======================================================== */

    if (
        strcasecmp(
            trim((string) $user['status_akun']),
            'Aktif'
        ) !== 0
    ) {

        daftarLaporanResponse(
            false,
            'Akun tidak aktif. Hubungi Administrator.',
            [],
            403
        );
    }


    /* ========================================================
       07. ROLE PELAPOR
    ======================================================== */

    if (
        strcasecmp(
            trim((string) $user['nama_peran']),
            'Pelapor'
        ) !== 0
    ) {

        daftarLaporanResponse(
            false,
            'Akses ditolak. API ini khusus untuk Pelapor.',
            [],
            403
        );
    }


    /* ========================================================
       08. MENGAMBIL LAPORAN USER
    ======================================================== */

    /*
     * PENTING:
     *
     * Filter menggunakan id_pelapor.
     *
     * Artinya user hanya melihat laporan miliknya sendiri.
     *
     * Nanti API Petugas TIDAK menggunakan filter ini,
     * sehingga Petugas dapat melihat semua laporan.
     */

    $stmt = $pdo->prepare("
        SELECT

            l.id_laporan,
            l.id_pelapor,
            l.id_fasilitas,
            l.kode_laporan,

            l.deskripsi_kerusakan,

            l.tingkat_kerusakan_x1,
            l.dampak_akademik_x2,
            l.frekuensi_penggunaan_x3,

            l.tingkat_kerusakan_x1_terverifikasi,
            l.dampak_akademik_x2_terverifikasi,
            l.frekuensi_penggunaan_x3_terverifikasi,

            l.prioritas_awal,
            l.id_petugas,
            l.prioritas_prediksi,

            l.status_verifikasi,
            l.status_penanganan,

            l.catatan_verifikasi,

            l.waktu_dibuat,
            l.waktu_diperbarui,

            f.nama_fasilitas,
            f.kode_fasilitas,
            f.lokasi

        FROM laporan_kerusakan l

        LEFT JOIN fasilitas f
            ON f.id_fasilitas = l.id_fasilitas

        WHERE l.id_pelapor = :id_pelapor

        ORDER BY l.waktu_dibuat DESC
    ");

    $stmt->execute([
        ':id_pelapor' => $idPengguna
    ]);

    $laporan = $stmt->fetchAll(PDO::FETCH_ASSOC);


    /* ========================================================
       09. FORMAT DATA
    ======================================================== */

    $hasil = [];

    foreach ($laporan as $row) {

        $hasil[] = [

            'id_laporan' =>
                (int) $row['id_laporan'],

            'id_pelapor' =>
                (int) $row['id_pelapor'],

            'id_fasilitas' =>
                (int) $row['id_fasilitas'],

            'kode_laporan' =>
                (string) $row['kode_laporan'],

            'nama_fasilitas' =>
                (string) ($row['nama_fasilitas'] ?? ''),

            'kode_fasilitas' =>
                (string) ($row['kode_fasilitas'] ?? ''),

            'lokasi' =>
                (string) ($row['lokasi'] ?? ''),

            'deskripsi_kerusakan' =>
                (string) ($row['deskripsi_kerusakan'] ?? ''),

            'tingkat_kerusakan_x1' =>
                $row['tingkat_kerusakan_x1'],

            'dampak_akademik_x2' =>
                $row['dampak_akademik_x2'],

            'frekuensi_penggunaan_x3' =>
                $row['frekuensi_penggunaan_x3'],

            'tingkat_kerusakan_x1_terverifikasi' =>
                $row['tingkat_kerusakan_x1_terverifikasi'],

            'dampak_akademik_x2_terverifikasi' =>
                $row['dampak_akademik_x2_terverifikasi'],

            'frekuensi_penggunaan_x3_terverifikasi' =>
                $row['frekuensi_penggunaan_x3_terverifikasi'],

            'prioritas_awal' =>
                $row['prioritas_awal'],

            'id_petugas' =>
                $row['id_petugas'] !== null
                    ? (int) $row['id_petugas']
                    : null,

            'prioritas_prediksi' =>
                $row['prioritas_prediksi'],

            'status_verifikasi' =>
                (string) ($row['status_verifikasi'] ?? ''),

            'status_penanganan' =>
                (string) ($row['status_penanganan'] ?? ''),

            'catatan_verifikasi' =>
                (string) ($row['catatan_verifikasi'] ?? ''),

            'waktu_dibuat' =>
                $row['waktu_dibuat'],

            'waktu_diperbarui' =>
                $row['waktu_diperbarui']
        ];
    }


    /* ========================================================
       10. RESPONSE BERHASIL
    ======================================================== */

    daftarLaporanResponse(
        true,
        'Daftar laporan berhasil dimuat.',
        [
            'jumlah' => count($hasil),

            'pengguna' => [
                'id_pengguna' =>
                    (int) $user['id_pengguna'],

                'nama_lengkap' =>
                    (string) $user['nama_lengkap'],

                'nama_peran' =>
                    (string) $user['nama_peran']
            ],

            'laporan' => $hasil
        ]
    );


} catch (Throwable $e) {

    error_log(
        '[SIPFAS DAFTAR LAPORAN] ' .
        get_class($e) .
        ': ' .
        $e->getMessage()
    );

    daftarLaporanResponse(
        false,
        'Terjadi kesalahan server saat mengambil daftar laporan.',
        [],
        500
    );
}