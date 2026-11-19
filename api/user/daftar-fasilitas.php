<?php
declare(strict_types=1);


// ============================================================
// 01. MEMUAT AUTENTIKASI DAN KONEKSI DATABASE
// ============================================================

require_once dirname(__DIR__, 2) . '/config/auth-check.php';

// auth-check.php sudah memuat bootstrap.php
// dan menyediakan koneksi PDO melalui variabel $pdo.

// ============================================================
// 02. HEADER RESPONSE
// ============================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

// ============================================================
// 03. FUNGSI RESPONSE JSON
// ============================================================

function daftarFasilitasResponse(
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
    ], JSON_UNESCAPED_UNICODE |
       JSON_UNESCAPED_SLASHES |
       JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

// ============================================================
// 04. MEMERIKSA METHOD REQUEST
// ============================================================

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {

    header('Allow: GET');

    daftarFasilitasResponse(
        405,
        false,
        'Metode permintaan tidak diizinkan.'
    );
}

// ============================================================
// 05. MEMERIKSA AUTENTIKASI
// ============================================================

sipfas_require_auth();

$user = sipfas_current_user();

// Memastikan pengguna memiliki role Pelapor.
$role = trim((string) ($user['nama_peran'] ?? ''));

if (strcasecmp($role, 'Pelapor') !== 0) {

    daftarFasilitasResponse(
        403,
        false,
        'Akses ditolak. API ini khusus untuk pengguna Pelapor.'
    );
}

// ============================================================
// 06. MENGAMBIL DATA DARI DATABASE
// ============================================================

try {

    // --------------------------------------------------------
    // A. MENGAMBIL KATEGORI FASILITAS
    // --------------------------------------------------------

    $queryKategori = $pdo->prepare("
        SELECT
            id_kategori,
            kode_kategori,
            nama_kategori,
            deskripsi

        FROM kategori_fasilitas

        WHERE status_kategori = 'Aktif'

        ORDER BY nama_kategori ASC
    ");

    $queryKategori->execute();

    $kategori = $queryKategori->fetchAll(PDO::FETCH_ASSOC);

    // --------------------------------------------------------
    // B. MENGAMBIL FASILITAS AKTIF
    // --------------------------------------------------------

    $queryFasilitas = $pdo->prepare("
        SELECT
            f.id_fasilitas,
            f.kode_fasilitas,
            f.nama_fasilitas,
            f.id_kategori,
            f.lokasi_ruangan,
            f.frekuensi_penggunaan,
            f.status_fasilitas,

            k.kode_kategori,
            k.nama_kategori

        FROM fasilitas f

        INNER JOIN kategori_fasilitas k
            ON f.id_kategori = k.id_kategori

        WHERE
            f.status_fasilitas = 'Aktif'
            AND k.status_kategori = 'Aktif'

        ORDER BY
            f.lokasi_ruangan ASC,
            f.nama_fasilitas ASC
    ");

    $queryFasilitas->execute();

    $hasilFasilitas = $queryFasilitas->fetchAll(PDO::FETCH_ASSOC);

    // --------------------------------------------------------
    // C. MENGUMPULKAN LOKASI UNIK
    // --------------------------------------------------------

    $lokasiUnik = [];

    foreach ($hasilFasilitas as $item) {

        $namaLokasi = trim(
            (string) $item['lokasi_ruangan']
        );

        if ($namaLokasi === '') {
            continue;
        }

        $key = mb_strtolower($namaLokasi);

        if (!isset($lokasiUnik[$key])) {

            $lokasiUnik[$key] = [
                'value' => $namaLokasi,
                'label' => $namaLokasi
            ];
        }
    }

    $daftarLokasi = array_values($lokasiUnik);

    // --------------------------------------------------------
    // D. MENYUSUN DATA FASILITAS
    // --------------------------------------------------------

    $daftarFasilitas = [];

    foreach ($hasilFasilitas as $item) {

        $daftarFasilitas[] = [

            'id_fasilitas' =>
                (int) $item['id_fasilitas'],

            'kode_fasilitas' =>
                $item['kode_fasilitas'],

            'nama_fasilitas' =>
                $item['nama_fasilitas'],

            'id_kategori' =>
                (int) $item['id_kategori'],

            'kode_kategori' =>
                $item['kode_kategori'],

            'nama_kategori' =>
                $item['nama_kategori'],

            'lokasi_ruangan' =>
                $item['lokasi_ruangan'],

            'frekuensi_penggunaan' =>
                $item['frekuensi_penggunaan'],

            'status_fasilitas' =>
                $item['status_fasilitas']
        ];
    }

    // --------------------------------------------------------
    // E. MENGIRIM DATA KE USER
    // --------------------------------------------------------

    daftarFasilitasResponse(
        200,
        true,
        'Data fasilitas berhasil dimuat.',
        [
            'lokasi' => $daftarLokasi,

            'kategori' => $kategori,

            'fasilitas' => $daftarFasilitas,

            'total_lokasi' => count($daftarLokasi),

            'total_kategori' => count($kategori),

            'total_fasilitas' => count($daftarFasilitas)
        ]
    );

} catch (Throwable $e) {

    // Mencatat kesalahan sebenarnya pada log PHP.
    error_log(
        '[SIPFAS DAFTAR FASILITAS] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    daftarFasilitasResponse(
        500,
        false,
        'Terjadi kesalahan saat mengambil data fasilitas.'
    );
}
