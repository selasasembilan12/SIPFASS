<?php

declare(strict_types=1);

// ============================================================
// SIPFAS - API DETAIL LAPORAN PELAPOR
// Mengambil detail laporan berdasarkan ID atau kode laporan.
// Data bersumber langsung dari database.
// ============================================================

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(__DIR__, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// ============================================================
// 01. FUNGSI RESPONSE JSON
// ============================================================

function detailResponse(
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

// ============================================================
// 02. PEMERIKSAAN METODE REQUEST
// ============================================================

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {

    header('Allow: GET');

    detailResponse(
        false,
        'Metode tidak diizinkan.',
        [],
        405
    );
}

// ============================================================
// 03. PEMERIKSAAN SESSION PENGGUNA
// ============================================================

$user = $_SESSION['user'] ?? [];

$idPelapor = (int)(
    $user['id_pengguna'] ?? 0
);

if (
    ($_SESSION['login_terverifikasi'] ?? false) !== true ||
    $idPelapor <= 0
) {

    detailResponse(
        false,
        'Silakan login kembali.',
        [],
        401
    );
}

// ============================================================
// 04. MENGAMBIL ID ATAU KODE LAPORAN
// ============================================================

$identitasLaporan = trim(
    (string)($_GET['id'] ?? '')
);

if ($identitasLaporan === '') {

    detailResponse(
        false,
        'ID atau kode laporan tidak ditemukan.',
        [],
        400
    );
}

// Mencegah input yang terlalu panjang.
if (strlen($identitasLaporan) > 100) {

    detailResponse(
        false,
        'Identitas laporan tidak valid.',
        [],
        400
    );
}

// Memeriksa apakah identitas berupa angka.
$isNumericId = ctype_digit($identitasLaporan);

if ($isNumericId && (int)$identitasLaporan <= 0) {

    detailResponse(
        false,
        'ID laporan tidak valid.',
        [],
        400
    );
}

// ============================================================
// 05. PROSES PENGAMBILAN DATA
// ============================================================

try {

    // --------------------------------------------------------
    // Memastikan akun masih aktif dan berperan sebagai Pelapor.
    // --------------------------------------------------------

    $stmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.status_akun,
            p.nama_peran

        FROM pengguna u

        INNER JOIN peran p
            ON p.id_peran = u.id_peran

        WHERE u.id_pengguna = :id_pengguna

        LIMIT 1
    ");

    $stmt->execute([
        ':id_pengguna' => $idPelapor
    ]);

    $pengguna = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$pengguna) {

        detailResponse(
            false,
            'Pengguna tidak ditemukan.',
            [],
            404
        );
    }

    if (
        strcasecmp(
            (string)$pengguna['status_akun'],
            'Aktif'
        ) !== 0
    ) {

        detailResponse(
            false,
            'Akun tidak aktif.',
            [],
            403
        );
    }

    if (
        strcasecmp(
            (string)$pengguna['nama_peran'],
            'Pelapor'
        ) !== 0
    ) {

        detailResponse(
            false,
            'Akses khusus Pelapor.',
            [],
            403
        );
    }

    // --------------------------------------------------------
    // Menentukan pencarian berdasarkan ID atau kode.
    // --------------------------------------------------------

    if ($isNumericId) {

        $kondisiLaporan = "
            l.id_laporan = :identitas
        ";

    } else {

        $kondisiLaporan = "
            l.kode_laporan = :identitas
        ";
    }

    // --------------------------------------------------------
    // Mengambil detail laporan dari database.
    // --------------------------------------------------------

    $sql = "

        SELECT

            l.id_laporan,
            l.id_pelapor,
            l.id_fasilitas,
            l.id_lokasi,

            l.kode_laporan,
            l.deskripsi_kerusakan,

            l.tingkat_kerusakan_x1,
            l.dampak_akademik_x2,
            l.frekuensi_penggunaan_x3,

            l.id_pelatihan_awal,

            l.tingkat_kerusakan_x1_terverifikasi,
            l.dampak_akademik_x2_terverifikasi,

            l.prioritas_awal,
            l.prioritas_prediksi,

            l.status_verifikasi,
            l.status_penanganan,

            l.id_verifikator,
            l.id_petugas_penanggung_jawab,

            l.catatan_verifikasi,
            l.waktu_verifikasi,

            l.tanggal_dibuat,
            l.tanggal_diperbarui,

            f.nama_fasilitas,
            f.kode_fasilitas,

            lr.nama_lokasi

        FROM laporan_kerusakan l

        LEFT JOIN fasilitas f
            ON f.id_fasilitas = l.id_fasilitas

        LEFT JOIN lokasi_ruangan lr
            ON lr.id_lokasi = l.id_lokasi

        WHERE

            $kondisiLaporan

            AND l.id_pelapor = :id_pelapor

        LIMIT 1

    ";

    $stmt = $pdo->prepare($sql);

    $parameter = [
        ':identitas' => $isNumericId
            ? (int)$identitasLaporan
            : $identitasLaporan,

        ':id_pelapor' => $idPelapor
    ];

    $stmt->execute($parameter);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    // --------------------------------------------------------
    // Jika laporan tidak ditemukan.
    // --------------------------------------------------------

    if (!$row) {

        detailResponse(
            false,
            'Laporan tidak ditemukan atau bukan milik akun ini.',
            [],
            404
        );
    }

    // --------------------------------------------------------
    // Mengubah data database menjadi JSON.
    // --------------------------------------------------------

    $data = [

        'id_laporan' =>
            (int)$row['id_laporan'],

        'id_pelapor' =>
            (int)$row['id_pelapor'],

        'id_fasilitas' =>
            (int)$row['id_fasilitas'],

        'id_lokasi' =>
            (int)$row['id_lokasi'],

        'kode_laporan' =>
            $row['kode_laporan'],

        'nama_fasilitas' =>
            $row['nama_fasilitas'] ?? '-',

        'kode_fasilitas' =>
            $row['kode_fasilitas'] ?? '',

        'nama_lokasi' =>
            $row['nama_lokasi'] ?? '-',

        'deskripsi_kerusakan' =>
            $row['deskripsi_kerusakan'],

        'tingkat_kerusakan_x1' =>
            $row['tingkat_kerusakan_x1'] !== null
                ? (int)$row['tingkat_kerusakan_x1']
                : null,

        'dampak_akademik_x2' =>
            $row['dampak_akademik_x2'] !== null
                ? (int)$row['dampak_akademik_x2']
                : null,

        'frekuensi_penggunaan_x3' =>
            $row['frekuensi_penggunaan_x3'] !== null
                ? (int)$row['frekuensi_penggunaan_x3']
                : null,
        'id_pelatihan_awal' =>
            $row['id_pelatihan_awal'] !== null
                ? (int)$row['id_pelatihan_awal']
                : null,

        'tingkat_kerusakan_x1_terverifikasi' =>
            $row['tingkat_kerusakan_x1_terverifikasi'] !== null
                ? (int)$row['tingkat_kerusakan_x1_terverifikasi']
                : null,

        'dampak_akademik_x2_terverifikasi' =>
            $row['dampak_akademik_x2_terverifikasi'] !== null
                ? (int)$row['dampak_akademik_x2_terverifikasi']
                : null,

        'prioritas_awal' =>
            $row['prioritas_awal'],

        'prioritas_prediksi' =>
            $row['prioritas_prediksi'],

        'status_verifikasi' =>
            $row['status_verifikasi'],

        'status_penanganan' =>
            $row['status_penanganan'],

        'id_verifikator' =>
            $row['id_verifikator'],

        'id_petugas_penanggung_jawab' =>
            $row['id_petugas_penanggung_jawab'],

        'catatan_verifikasi' =>
            $row['catatan_verifikasi'],

        'waktu_verifikasi' =>
            $row['waktu_verifikasi'],

        'tanggal_dibuat' =>
            $row['tanggal_dibuat'],

        'tanggal_diperbarui' =>
            $row['tanggal_diperbarui']

    ];

    // --------------------------------------------------------
    // Berhasil.
    // --------------------------------------------------------

    detailResponse(
        true,
        'Detail laporan berhasil dimuat.',
        $data,
        200
    );

} catch (Throwable $e) {

    error_log(
        '[SIPFAS DETAIL LAPORAN] ' .
        $e->getMessage()
    );

    detailResponse(
        false,
        'Gagal mengambil detail laporan dari database.',
        [],
        500
    );
}
