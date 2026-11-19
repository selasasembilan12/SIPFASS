<?php
declare(strict_types=1);

/*
 * SIPFAS - SIMPAN LAPORAN KERUSAKAN
 * Penyimpanan utama menggunakan database MySQL.
 */

ini_set('display_errors', '0');

require_once dirname(__DIR__, 2) . '/config/auth-check.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

function simpanLaporanResponse(
    int $status,
    bool $success,
    string $message,
    array $data = []
): never {
    http_response_code($status);

    echo json_encode(
        [
            'success' => $success,
            'message' => $message,
            'data' => $data,
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES |
        JSON_INVALID_UTF8_SUBSTITUTE
    );

    exit;
}

/* ============================================================
   01. VALIDASI REQUEST
============================================================ */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    simpanLaporanResponse(405, false, 'Metode permintaan tidak diizinkan.');
}

$contentType = strtolower(
    trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])
);

if ($contentType !== 'application/json') {
    simpanLaporanResponse(415, false, 'Gunakan format JSON.');
}

/* ============================================================
   02. AUTENTIKASI RESMI SIPFAS
============================================================ */

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

/* ============================================================
   03. MEMBACA BODY JSON
============================================================ */

$rawInput = file_get_contents('php://input');

if ($rawInput === false || strlen($rawInput) > 8192) {
    simpanLaporanResponse(400, false, 'Data permintaan tidak valid.');
}

$input = json_decode($rawInput, true);

if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {
    simpanLaporanResponse(400, false, 'Format JSON tidak valid.');
}

/* ============================================================
   04. MENGAMBIL DAN MEMVALIDASI INPUT
============================================================ */

$kodeLaporan = trim((string) ($input['kode_laporan'] ?? ''));
$idFasilitas = filter_var(
    $input['id_fasilitas'] ?? null,
    FILTER_VALIDATE_INT
);
$deskripsi = trim((string) ($input['deskripsi_kerusakan'] ?? ''));

$x1 = filter_var(
    $input['tingkat_kerusakan_x1'] ?? null,
    FILTER_VALIDATE_INT
);
$x2 = filter_var(
    $input['dampak_akademik_x2'] ?? null,
    FILTER_VALIDATE_INT
);

if ($kodeLaporan === '' || strlen($kodeLaporan) > 100) {
    simpanLaporanResponse(422, false, 'Kode laporan tidak valid.');
}

if (!$idFasilitas || $idFasilitas <= 0) {
    simpanLaporanResponse(422, false, 'Silakan pilih fasilitas yang valid.');
}

if ($deskripsi === '') {
    simpanLaporanResponse(422, false, 'Deskripsi kerusakan wajib diisi.');
}

if (mb_strlen($deskripsi, 'UTF-8') > 300) {
    simpanLaporanResponse(
        422,
        false,
        'Deskripsi kerusakan maksimal 300 karakter.'
    );
}

if (!in_array($x1, [1, 2, 3], true)) {
    simpanLaporanResponse(422, false, 'Nilai tingkat kerusakan tidak valid.');
}

if (!in_array($x2, [1, 2, 3], true)) {
    simpanLaporanResponse(422, false, 'Nilai dampak akademik tidak valid.');
}

/*
 * Prioritas dihitung ulang di backend.
 * Frontend tidak menjadi sumber kebenaran perhitungan.
 */
if ($x1 === 3) {
    $prioritasAwal = 'Tinggi';
} elseif ($x1 === 2 && $x2 === 3) {
    $prioritasAwal = 'Tinggi';
} elseif ($x1 === 2 || $x2 === 3) {
    $prioritasAwal = 'Sedang';
} else {
    $prioritasAwal = 'Rendah';
}

/* ============================================================
   05. PROSES DATABASE
============================================================ */

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Pastikan akun masih aktif dan role tetap Pelapor.
    $stmtUser = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.status_akun,
            p.nama_peran
        FROM pengguna u
        INNER JOIN peran p ON p.id_peran = u.id_peran
        WHERE u.id_pengguna = :id_pengguna
        LIMIT 1
    ");

    $stmtUser->execute([
        ':id_pengguna' => $idPengguna,
    ]);

    $pengguna = $stmtUser->fetch(PDO::FETCH_ASSOC);

    if (!$pengguna) {
        simpanLaporanResponse(404, false, 'Data pengguna tidak ditemukan.');
    }

    if (strcasecmp(trim((string) $pengguna['status_akun']), 'Aktif') !== 0) {
        simpanLaporanResponse(403, false, 'Akun tidak aktif. Hubungi Administrator.');
    }

    if (strcasecmp(trim((string) $pengguna['nama_peran']), 'Pelapor') !== 0) {
        simpanLaporanResponse(403, false, 'Akses API hanya untuk Pelapor.');
    }

    // Ambil fasilitas dan kategori dari database.
    $stmtFasilitas = $pdo->prepare("
        SELECT
            f.id_fasilitas,
            f.kode_fasilitas,
            f.nama_fasilitas,
            f.id_kategori,
            f.lokasi_ruangan,
            f.frekuensi_penggunaan,
            f.status_fasilitas,
            k.status_kategori
        FROM fasilitas f
        INNER JOIN kategori_fasilitas k
            ON k.id_kategori = f.id_kategori
        WHERE f.id_fasilitas = :id_fasilitas
        LIMIT 1
    ");

    $stmtFasilitas->execute([
        ':id_fasilitas' => $idFasilitas,
    ]);

    $fasilitas = $stmtFasilitas->fetch(PDO::FETCH_ASSOC);

    if (!$fasilitas) {
        simpanLaporanResponse(404, false, 'Fasilitas tidak ditemukan di database.');
    }

    if (
        strcasecmp(trim((string) $fasilitas['status_fasilitas']), 'Aktif') !== 0 ||
        strcasecmp(trim((string) $fasilitas['status_kategori']), 'Aktif') !== 0
    ) {
        simpanLaporanResponse(
            422,
            false,
            'Fasilitas atau kategorinya sedang tidak aktif.'
        );
    }

    // Pemetaan frekuensi teks Admin menjadi X3 numerik.
    $frekuensi = mb_strtolower(
        trim((string) ($fasilitas['frekuensi_penggunaan'] ?? '')),
        'UTF-8'
    );

    if (str_contains($frekuensi, 'sering')) {
        $x3 = 3;
    } elseif (str_contains($frekuensi, 'sedang')) {
        $x3 = 2;
    } elseif (str_contains($frekuensi, 'jarang')) {
        $x3 = 1;
    } else {
        preg_match('/\d+/', $frekuensi, $match);
        $jumlahHari = isset($match[0]) ? (int) $match[0] : null;

        if ($jumlahHari === null) {
            simpanLaporanResponse(
                422,
                false,
                'Frekuensi penggunaan fasilitas belum memiliki format yang dikenali. Periksa data fasilitas di Admin.'
            );
        }

        if ($jumlahHari <= 2) {
            $x3 = 1;
        } elseif ($jumlahHari <= 4) {
            $x3 = 2;
        } else {
            $x3 = 3;
        }
    }

    // Pastikan kode laporan belum digunakan.
    $stmtKode = $pdo->prepare("
        SELECT id_laporan
        FROM laporan_kerusakan
        WHERE kode_laporan = :kode_laporan
        LIMIT 1
    ");

    $stmtKode->execute([
        ':kode_laporan' => $kodeLaporan,
    ]);

    if ($stmtKode->fetch(PDO::FETCH_ASSOC)) {
        simpanLaporanResponse(409, false, 'Kode laporan sudah digunakan. Silakan kirim ulang.');
    }

    /*
     * Kolom tanggal mengikuti struktur database yang terlihat
     * pada phpMyAdmin/ERD: tanggal_dibuat dan tanggal_diperbarui.
     */
    $pdo->beginTransaction();

    $stmtInsert = $pdo->prepare("
        INSERT INTO laporan_kerusakan (
            id_pelapor,
            id_fasilitas,
            kode_laporan,
            deskripsi_kerusakan,
            tingkat_kerusakan_x1,
            dampak_akademik_x2,
            frekuensi_penggunaan_x3,
            prioritas_awal,
            status_verifikasi,
            status_penanganan,
            tanggal_dibuat,
            tanggal_diperbarui
        ) VALUES (
            :id_pelapor,
            :id_fasilitas,
            :kode_laporan,
            :deskripsi_kerusakan,
            :x1,
            :x2,
            :x3,
            :prioritas_awal,
            :status_verifikasi,
            :status_penanganan,
            NOW(),
            NOW()
        )
    ");

    $stmtInsert->execute([
        ':id_pelapor' => $idPengguna,
        ':id_fasilitas' => $idFasilitas,
        ':kode_laporan' => $kodeLaporan,
        ':deskripsi_kerusakan' => $deskripsi,
        ':x1' => $x1,
        ':x2' => $x2,
        ':x3' => $x3,
        ':prioritas_awal' => $prioritasAwal,
        ':status_verifikasi' => 'Menunggu',
        ':status_penanganan' => 'Menunggu',
    ]);

    $idLaporan = (int) $pdo->lastInsertId();

    $pdo->commit();

    simpanLaporanResponse(
        201,
        true,
        'Laporan berhasil disimpan ke database.',
        [
            'id_laporan' => $idLaporan,
            'kode_laporan' => $kodeLaporan,
            'id_pelapor' => $idPengguna,
            'id_fasilitas' => (int) $fasilitas['id_fasilitas'],
            'kode_fasilitas' => (string) $fasilitas['kode_fasilitas'],
            'nama_fasilitas' => (string) $fasilitas['nama_fasilitas'],
            'lokasi_ruangan' => (string) $fasilitas['lokasi_ruangan'],
            'tingkat_kerusakan_x1' => $x1,
            'dampak_akademik_x2' => $x2,
            'frekuensi_penggunaan_x3' => $x3,
            'prioritas_awal' => $prioritasAwal,
            'status_verifikasi' => 'Menunggu',
            'status_penanganan' => 'Menunggu',
        ]
    );

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        '[SIPFAS SIMPAN LAPORAN] ' .
        get_class($e) . ': ' . $e->getMessage()
    );

    simpanLaporanResponse(
        500,
        false,
        'Terjadi kesalahan server saat menyimpan laporan. Periksa log PHP.'
    );
}
