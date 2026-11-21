<?php
declare(strict_types=1);



ini_set('display_errors', '0');

require_once dirname(__DIR__, 2) . '/config/auth-check.php';
require_once dirname(__DIR__, 2) . '/services/C45/C45Service.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(_DIR_, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

// ==========================================
// 01. RESPONSE JSON
// ==========================================

function simpanLaporanResponse(
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

// ==========================================
// 02. VALIDASI METHOD
// ==========================================

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {

    header('Allow: POST');

    simpanLaporanResponse(
        405,
        false,
        'Metode permintaan tidak diizinkan.'
    );
}

// ==========================================
// 03. VALIDASI CONTENT TYPE
// ==========================================

$contentType = strtolower(
    trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])
);

if ($contentType !== 'application/json') {

    simpanLaporanResponse(
        415,
        false,
        'Gunakan format JSON.'
    );
}

// ==========================================
// 04. VALIDASI LOGIN DAN ROLE
// ==========================================

sipfas_require_auth();
sipfas_require_role(['Pelapor']);

$userSession = sipfas_current_user();
$idPengguna = sipfas_current_user_id();

if (!$userSession || !$idPengguna) {

    simpanLaporanResponse(
        401,
        false,
        'Sesi login tidak valid. Silakan login kembali.'
    );
}

// ==========================================
// 05. MEMBACA JSON
// ==========================================

$rawInput = file_get_contents('php://input');

if ($rawInput === false || strlen($rawInput) > 8192) {

    simpanLaporanResponse(
        400,
        false,
        'Data permintaan tidak valid.'
    );
}

$input = json_decode($rawInput, true);

if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {

    simpanLaporanResponse(
        400,
        false,
        'Format JSON tidak valid.'
    );
}

// ==========================================
// 06. VALIDASI INPUT
// ==========================================

$kodeLaporan = trim(
    (string) ($input['kode_laporan'] ?? '')
);

$idFasilitas = filter_var(
    $input['id_fasilitas'] ?? null,
    FILTER_VALIDATE_INT
);

$deskripsi = trim(
    (string) ($input['deskripsi_kerusakan'] ?? '')
);

$x1 = filter_var(
    $input['tingkat_kerusakan_x1'] ?? null,
    FILTER_VALIDATE_INT
);

$x2 = filter_var(
    $input['dampak_akademik_x2'] ?? null,
    FILTER_VALIDATE_INT
);

// Kode laporan maksimal 30 karakter.
if (
    $kodeLaporan === '' ||
    mb_strlen($kodeLaporan, 'UTF-8') > 30
) {

    simpanLaporanResponse(
        422,
        false,
        'Kode laporan wajib diisi dan maksimal 30 karakter.'
    );
}

if (!$idFasilitas || $idFasilitas <= 0) {

    simpanLaporanResponse(
        422,
        false,
        'Silakan pilih fasilitas yang valid.'
    );
}

if ($deskripsi === '') {

    simpanLaporanResponse(
        422,
        false,
        'Deskripsi kerusakan wajib diisi.'
    );
}

if (mb_strlen($deskripsi, 'UTF-8') > 300) {

    simpanLaporanResponse(
        422,
        false,
        'Deskripsi kerusakan maksimal 300 karakter.'
    );
}

if (!in_array($x1, [1, 2, 3], true)) {

    simpanLaporanResponse(
        422,
        false,
        'Nilai tingkat kerusakan tidak valid.'
    );
}

if (!in_array($x2, [1, 2, 3], true)) {

    simpanLaporanResponse(
        422,
        false,
        'Nilai dampak akademik tidak valid.'
    );
}

// ==========================================
// 07. PRIORITAS AWAL DITENTUKAN OLEH MODEL C4.5
// ==========================================
// Prediksi dijalankan setelah X3 berhasil diambil dari database
// fasilitas. Model harus sudah dilatih oleh Administrator.

// ==========================================
// 08. PROSES DATABASE
// ==========================================

try {

    global $pdo;

    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException('Koneksi PDO tidak tersedia.');
    }

    $pdo->setAttribute(
        PDO::ATTR_ERRMODE,
        PDO::ERRMODE_EXCEPTION
    );

    // --------------------------------------
    // A. VALIDASI PENGGUNA
    // --------------------------------------

    $stmtUser = $pdo->prepare("
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

    $stmtUser->execute([
        ':id_pengguna' => $idPengguna
    ]);

    $pengguna = $stmtUser->fetch(PDO::FETCH_ASSOC);

    if (!$pengguna) {

        simpanLaporanResponse(
            404,
            false,
            'Data pengguna tidak ditemukan.'
        );
    }

    if (
        strcasecmp(
            trim((string) $pengguna['status_akun']),
            'Aktif'
        ) !== 0
    ) {

        simpanLaporanResponse(
            403,
            false,
            'Akun tidak aktif. Hubungi Administrator.'
        );
    }

    if (
        strcasecmp(
            trim((string) $pengguna['nama_peran']),
            'Pelapor'
        ) !== 0
    ) {

        simpanLaporanResponse(
            403,
            false,
            'Akses API hanya untuk Pelapor.'
        );
    }

    // --------------------------------------
    // B. AMBIL DATA FASILITAS
    // --------------------------------------

    $stmtFasilitas = $pdo->prepare("
        SELECT
            f.id_fasilitas,
            f.kode_fasilitas,
            f.nama_fasilitas,
            f.id_kategori,
            f.id_lokasi,
            f.frekuensi_penggunaan,
            f.status_fasilitas,

            k.nama_kategori,
            k.status_kategori,

            l.nama_lokasi,
            l.status_lokasi

        FROM fasilitas f

        INNER JOIN kategori_fasilitas k
            ON k.id_kategori = f.id_kategori

        INNER JOIN lokasi_ruangan l
            ON l.id_lokasi = f.id_lokasi

        WHERE f.id_fasilitas = :id_fasilitas

        LIMIT 1
    ");

    $stmtFasilitas->execute([
        ':id_fasilitas' => $idFasilitas
    ]);

    $fasilitas = $stmtFasilitas->fetch(PDO::FETCH_ASSOC);

    if (!$fasilitas) {

        simpanLaporanResponse(
            404,
            false,
            'Fasilitas tidak ditemukan di database.'
        );
    }

    // --------------------------------------
    // C. VALIDASI STATUS FASILITAS
    // --------------------------------------

    if (
        strcasecmp(
            trim((string) $fasilitas['status_fasilitas']),
            'Aktif'
        ) !== 0
    ) {

        simpanLaporanResponse(
            422,
            false,
            'Fasilitas sedang tidak aktif.'
        );
    }

    // --------------------------------------
    // D. VALIDASI KATEGORI
    // --------------------------------------

    if (
        strcasecmp(
            trim((string) $fasilitas['status_kategori']),
            'Aktif'
        ) !== 0
    ) {

        simpanLaporanResponse(
            422,
            false,
            'Kategori fasilitas sedang tidak aktif.'
        );
    }

    // --------------------------------------
    // E. VALIDASI LOKASI
    // --------------------------------------

    if (
        strcasecmp(
            trim((string) $fasilitas['status_lokasi']),
            'Aktif'
        ) !== 0
    ) {

        simpanLaporanResponse(
            422,
            false,
            'Lokasi fasilitas sedang tidak aktif.'
        );
    }

    // --------------------------------------
    // F. MENGHITUNG X3
    // Aturan konversi dipusatkan di C45Service agar sama
    // dengan Dataset Admin dan proses pelatihan.
    // --------------------------------------

    $frekuensi = (int) $fasilitas['frekuensi_penggunaan'];

    if ($frekuensi < 0 || $frekuensi > 7) {
        simpanLaporanResponse(
            422,
            false,
            'Frekuensi penggunaan fasilitas harus antara 0 sampai 7.'
        );
    }

    $x3 = \SIPFAS\Services\C45\C45Service::mapFrekuensiPenggunaan(
        $frekuensi
    );

    // --------------------------------------
    // G. PREDIKSI DENGAN MODEL C4.5 AKTIF
    // --------------------------------------

    $stmtModel = $pdo->query("
        SELECT id_pelatihan, struktur_pohon
        FROM riwayat_pelatihan_c45
        WHERE status_model = 'Aktif'
        ORDER BY id_pelatihan DESC
        LIMIT 1
    ");

    $activeModel = $stmtModel->fetch(PDO::FETCH_ASSOC);

    if (!$activeModel || empty($activeModel['struktur_pohon'])) {
        simpanLaporanResponse(
            409,
            false,
            'Model C4.5 belum tersedia. Administrator harus menjalankan Pelatihan C4.5 terlebih dahulu.'
        );
    }

    $decisionTree = json_decode(
        (string) $activeModel['struktur_pohon'],
        true
    );

    if (!is_array($decisionTree) || empty($decisionTree)) {
        throw new RuntimeException('Struktur model C4.5 aktif tidak valid.');
    }

    $c45Service = new \SIPFAS\Services\C45\C45Service();

    $prioritasAwal = $c45Service->predict(
        $decisionTree,
        [
            'x1' => $x1,
            'x2' => $x2,
            'x3' => $x3
        ]
    );

    // --------------------------------------
    // H. VALIDASI KODE LAPORAN
    // --------------------------------------

    $stmtKode = $pdo->prepare("
        SELECT id_laporan
        FROM laporan_kerusakan
        WHERE kode_laporan = :kode_laporan
        LIMIT 1
    ");

    $stmtKode->execute([
        ':kode_laporan' => $kodeLaporan
    ]);

    if ($stmtKode->fetch()) {

        simpanLaporanResponse(
            409,
            false,
            'Kode laporan sudah digunakan. Silakan buat kode baru.'
        );
    }

    // --------------------------------------
    // I. SIMPAN LAPORAN
    // --------------------------------------

    $pdo->beginTransaction();

    $stmtInsert = $pdo->prepare("
        INSERT INTO laporan_kerusakan (

            id_pelapor,
            id_fasilitas,
            id_lokasi,

            kode_laporan,
            deskripsi_kerusakan,

            tingkat_kerusakan_x1,
            dampak_akademik_x2,
            frekuensi_penggunaan_x3,

            id_pelatihan_awal,
            prioritas_awal,

            status_verifikasi,
            status_penanganan,

            tanggal_dibuat,
            tanggal_diperbarui

        ) VALUES (

            :id_pelapor,
            :id_fasilitas,
            :id_lokasi,

            :kode_laporan,
            :deskripsi_kerusakan,

            :x1,
            :x2,
            :x3,

            :id_pelatihan_awal,
            :prioritas_awal,

            :status_verifikasi,
            :status_penanganan,

            NOW(),
            NOW()
        )
    ");

    $stmtInsert->execute([

        ':id_pelapor' => $idPengguna,

        ':id_fasilitas' =>
            (int) $fasilitas['id_fasilitas'],

        ':id_lokasi' =>
            (int) $fasilitas['id_lokasi'],

        ':kode_laporan' => $kodeLaporan,

        ':deskripsi_kerusakan' => $deskripsi,

        ':x1' => $x1,

        ':x2' => $x2,

        ':x3' => $x3,

        ':id_pelatihan_awal' => (int) $activeModel['id_pelatihan'],

        ':prioritas_awal' => $prioritasAwal,

        ':status_verifikasi' => 'Menunggu',

        ':status_penanganan' => 'Menunggu'
    ]);

    $idLaporan = (int) $pdo->lastInsertId();

    $pdo->commit();

    // --------------------------------------
    // J. RESPONSE BERHASIL
    // --------------------------------------

    simpanLaporanResponse(
        201,
        true,
        'Laporan berhasil disimpan ke database.',
        [
            'id_laporan' => $idLaporan,

            'kode_laporan' => $kodeLaporan,

            'id_pelapor' => (int) $idPengguna,

            'id_fasilitas' =>
                (int) $fasilitas['id_fasilitas'],

            'kode_fasilitas' =>
                $fasilitas['kode_fasilitas'],

            'nama_fasilitas' =>
                $fasilitas['nama_fasilitas'],

            'id_kategori' =>
                (int) $fasilitas['id_kategori'],

            'nama_kategori' =>
                $fasilitas['nama_kategori'],

            'id_lokasi' =>
                (int) $fasilitas['id_lokasi'],

            'nama_lokasi' =>
                $fasilitas['nama_lokasi'],

            'frekuensi_penggunaan' => $frekuensi,

            'tingkat_kerusakan_x1' => $x1,

            'dampak_akademik_x2' => $x2,

            'frekuensi_penggunaan_x3' => $x3,

            'id_pelatihan_awal' => (int) $activeModel['id_pelatihan'],

            'prioritas_awal' => $prioritasAwal,

            'status_verifikasi' => 'Menunggu',

            'status_penanganan' => 'Menunggu'
        ]
    );

} catch (Throwable $e) {

    if (
        isset($pdo) &&
        $pdo instanceof PDO &&
        $pdo->inTransaction()
    ) {
        $pdo->rollBack();
    }

    error_log(
        '[SIPFAS SIMPAN LAPORAN] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    simpanLaporanResponse(
        500,
        false,
        'Terjadi kesalahan server saat menyimpan laporan. Periksa log PHP.'
    );
}
