<?php
declare(strict_types=1);


require_once dirname(__DIR__, 2) . '/config/auth-check.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(_DIR_, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

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

// Hanya menerima GET.
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');

    daftarFasilitasResponse(
        405,
        false,
        'Metode permintaan tidak diizinkan.'
    );
}

// Validasi login dan role.
sipfas_require_auth();
sipfas_require_role(['Pelapor']);

try {
    global $pdo;

    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException('Koneksi database tidak tersedia.');
    }

    $pdo->setAttribute(
        PDO::ATTR_ERRMODE,
        PDO::ERRMODE_EXCEPTION
    );

    // ==========================================
    // A. MENGAMBIL KATEGORI AKTIF
    // ==========================================

    $stmtKategori = $pdo->prepare("
        SELECT
            id_kategori,
            kode_kategori,
            nama_kategori,
            deskripsi
        FROM kategori_fasilitas
        WHERE status_kategori = 'Aktif'
        ORDER BY nama_kategori ASC
    ");

    $stmtKategori->execute();

    $kategori = $stmtKategori->fetchAll(PDO::FETCH_ASSOC);

    // ==========================================
    // B. MENGAMBIL LOKASI AKTIF
    // ==========================================

    $stmtLokasi = $pdo->prepare("
        SELECT
            id_lokasi,
            kode_lokasi,
            nama_lokasi,
            status_lokasi
        FROM lokasi_ruangan
        WHERE status_lokasi = 'Aktif'
        ORDER BY nama_lokasi ASC
    ");

    $stmtLokasi->execute();

    $lokasi = $stmtLokasi->fetchAll(PDO::FETCH_ASSOC);

    // ==========================================
    // C. MENGAMBIL FASILITAS AKTIF
    // ==========================================

    /*
     * Lokasi diambil melalui id_lokasi.
     * Bukan membaca lokasi_ruangan dari tabel fasilitas.
     */

    $stmtFasilitas = $pdo->prepare("
        SELECT
            f.id_fasilitas,
            f.kode_fasilitas,
            f.nama_fasilitas,
            f.id_kategori,
            f.id_lokasi,
            f.frekuensi_penggunaan,
            f.status_fasilitas,

            k.kode_kategori,
            k.nama_kategori,

            l.kode_lokasi,
            l.nama_lokasi

        FROM fasilitas f

        INNER JOIN kategori_fasilitas k
            ON k.id_kategori = f.id_kategori

        INNER JOIN lokasi_ruangan l
            ON l.id_lokasi = f.id_lokasi

        WHERE
            f.status_fasilitas = 'Aktif'
            AND k.status_kategori = 'Aktif'
            AND l.status_lokasi = 'Aktif'

        ORDER BY
            l.nama_lokasi ASC,
            f.nama_fasilitas ASC
    ");

    $stmtFasilitas->execute();

    $hasilFasilitas = $stmtFasilitas->fetchAll(PDO::FETCH_ASSOC);

    // ==========================================
    // D. FORMAT DATA FASILITAS
    // ==========================================

    $daftarFasilitas = [];

    foreach ($hasilFasilitas as $item) {

        $frekuensi = (int) $item['frekuensi_penggunaan'];

        $daftarFasilitas[] = [
            'id_fasilitas' => (int) $item['id_fasilitas'],
            'kode_fasilitas' => $item['kode_fasilitas'],
            'nama_fasilitas' => $item['nama_fasilitas'],

            'id_kategori' => (int) $item['id_kategori'],
            'kode_kategori' => $item['kode_kategori'],
            'nama_kategori' => $item['nama_kategori'],

            'id_lokasi' => (int) $item['id_lokasi'],
            'kode_lokasi' => $item['kode_lokasi'],
            'nama_lokasi' => $item['nama_lokasi'],

            'frekuensi_penggunaan' => $frekuensi,
            'status_fasilitas' => $item['status_fasilitas']
        ];
    }

    // ==========================================
    // E. FORMAT DATA KATEGORI
    // ==========================================

    $daftarKategori = [];

    foreach ($kategori as $item) {
        $daftarKategori[] = [
            'id_kategori' => (int) $item['id_kategori'],
            'kode_kategori' => $item['kode_kategori'],
            'nama_kategori' => $item['nama_kategori'],
            'deskripsi' => $item['deskripsi']
        ];
    }

    // ==========================================
    // F. FORMAT DATA LOKASI
    // ==========================================

    $daftarLokasi = [];

    foreach ($lokasi as $item) {
        $daftarLokasi[] = [
            'id_lokasi' => (int) $item['id_lokasi'],
            'kode_lokasi' => $item['kode_lokasi'],
            'nama_lokasi' => $item['nama_lokasi']
        ];
    }

    // ==========================================
    // G. RESPONSE
    // ==========================================

    daftarFasilitasResponse(
        200,
        true,
        'Data fasilitas berhasil dimuat.',
        [
            'kategori' => $daftarKategori,
            'lokasi' => $daftarLokasi,
            'fasilitas' => $daftarFasilitas,

            'total_kategori' => count($daftarKategori),
            'total_lokasi' => count($daftarLokasi),
            'total_fasilitas' => count($daftarFasilitas)
        ]
    );

} catch (Throwable $e) {

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
