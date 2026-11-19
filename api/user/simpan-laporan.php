<?php
declare(strict_types=1);


require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

// ============================================================
// 02. RESPONSE JSON
// ============================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// ============================================================
// 03. FUNGSI RESPONSE
// ============================================================

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
            'data' => $data
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_INVALID_UTF8_SUBSTITUTE
    );

    exit;
}

// ============================================================
// 04. MEMASTIKAN REQUEST POST
// ============================================================

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST'
) {

    header('Allow: POST');

    simpanLaporanResponse(
        405,
        false,
        'Metode permintaan tidak diizinkan.'
    );
}

// ============================================================
// 05. MEMASTIKAN CONTENT TYPE JSON
// ============================================================

$contentType = strtolower(
    trim(
        explode(
            ';',
            $_SERVER['CONTENT_TYPE'] ?? ''
        )[0]
    )
);

if ($contentType !== 'application/json') {

    simpanLaporanResponse(
        415,
        false,
        'Gunakan format JSON.'
    );
}

// ============================================================
// 06. MEMBACA DATA JSON
// ============================================================

$rawInput = file_get_contents('php://input');

if (
    $rawInput === false ||
    strlen($rawInput) > 8192
) {

    simpanLaporanResponse(
        400,
        false,
        'Data permintaan tidak valid.'
    );
}

$input = json_decode(
    $rawInput,
    true
);

if (!is_array($input)) {

    simpanLaporanResponse(
        400,
        false,
        'Format data tidak valid.'
    );
}

// ============================================================
// 07. MEMASTIKAN SESSION LOGIN
// ============================================================

$idPengguna = (int) (
    $_SESSION['id_pengguna'] ?? 0
);

$namaPeran = trim(
    (string) (
        $_SESSION['nama_peran'] ?? ''
    )
);

if ($idPengguna <= 0) {

    simpanLaporanResponse(
        401,
        false,
        'Sesi login tidak ditemukan. Silakan login kembali.'
    );
}

// ============================================================
// 08. MEMASTIKAN ROLE PELAPOR
// ============================================================

if (
    strcasecmp(
        $namaPeran,
        'Pelapor'
    ) !== 0
) {

    simpanLaporanResponse(
        403,
        false,
        'Akses ditolak. API ini khusus untuk Pelapor.'
    );
}

// ============================================================
// 09. MENGAMBIL INPUT
// ============================================================

$kodeLaporan = trim(
    (string) (
        $input['kode_laporan'] ?? ''
    )
);

$idFasilitas = (int) (
    $input['id_fasilitas'] ?? 0
);

$deskripsiKerusakan = trim(
    (string) (
        $input['deskripsi_kerusakan'] ?? ''
    )
);

$tingkatKerusakanX1 = trim(
    (string) (
        $input['tingkat_kerusakan_x1'] ?? ''
    )
);

$dampakAkademikX2 = trim(
    (string) (
        $input['dampak_akademik_x2'] ?? ''
    )
);

$prioritasAwal = trim(
    (string) (
        $input['prioritas_awal'] ?? ''
    )
);

// ============================================================
// 10. VALIDASI INPUT
// ============================================================

if ($kodeLaporan === '') {

    simpanLaporanResponse(
        422,
        false,
        'Kode laporan tidak boleh kosong.'
    );
}

if (
    strlen($kodeLaporan) > 100
) {

    simpanLaporanResponse(
        422,
        false,
        'Kode laporan terlalu panjang.'
    );
}

if ($idFasilitas <= 0) {

    simpanLaporanResponse(
        422,
        false,
        'Fasilitas belum dipilih.'
    );
}

if ($deskripsiKerusakan === '') {

    simpanLaporanResponse(
        422,
        false,
        'Deskripsi kerusakan wajib diisi.'
    );
}

if (
    strlen($deskripsiKerusakan) > 300
) {

    simpanLaporanResponse(
        422,
        false,
        'Deskripsi kerusakan maksimal 300 karakter.'
    );
}

if (
    $tingkatKerusakanX1 === ''
) {

    simpanLaporanResponse(
        422,
        false,
        'Tingkat kerusakan wajib dipilih.'
    );
}

if (
    $dampakAkademikX2 === ''
) {

    simpanLaporanResponse(
        422,
        false,
        'Dampak akademik wajib dipilih.'
    );
}

if (
    !in_array(
        $prioritasAwal,
        [
            'Tinggi',
            'Sedang',
            'Rendah'
        ],
        true
    )
) {

    simpanLaporanResponse(
        422,
        false,
        'Prioritas laporan tidak valid.'
    );
}

// ============================================================
// 11. MEMPROSES DATABASE
// ============================================================

try {

    // --------------------------------------------------------
    // 11A. MEMERIKSA DATA PENGGUNA
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
        ':id_pengguna' => $idPengguna
    ]);

    $pengguna = $stmt->fetch(
        PDO::FETCH_ASSOC
    );

    if (!$pengguna) {

        simpanLaporanResponse(
            404,
            false,
            'Data pengguna tidak ditemukan.'
        );
    }

    if (
        strcasecmp(
            trim(
                (string) $pengguna['status_akun']
            ),
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
            trim(
                (string) $pengguna['nama_peran']
            ),
            'Pelapor'
        ) !== 0
    ) {

        simpanLaporanResponse(
            403,
            false,
            'Akses ditolak. Akun bukan Pelapor.'
        );
    }

    // --------------------------------------------------------
    // 11B. MEMERIKSA FASILITAS
    // --------------------------------------------------------

    $stmt = $pdo->prepare("
        SELECT
            id_fasilitas,
            frekuensi_penggunaan
        FROM fasilitas
        WHERE id_fasilitas = :id_fasilitas
        LIMIT 1
    ");

    $stmt->execute([
        ':id_fasilitas' => $idFasilitas
    ]);

    $fasilitas = $stmt->fetch(
        PDO::FETCH_ASSOC
    );

    if (!$fasilitas) {

        simpanLaporanResponse(
            404,
            false,
            'Fasilitas yang dipilih tidak ditemukan.'
        );
    }

    // --------------------------------------------------------
    // 11C. MENGAMBIL X3 DARI FREKUENSI FASILITAS
    // --------------------------------------------------------

    $frekuensiPenggunaan = (int) (
        $fasilitas['frekuensi_penggunaan'] ?? 0
    );

    /*
     * Pemetaan X3:
     *
     * 0 - 2 hari  = 1
     * 3 - 4 hari  = 2
     * 5 - 7 hari  = 3
     */

    if (
        $frekuensiPenggunaan <= 2
    ) {

        $frekuensiPenggunaanX3 = 1;

    } elseif (
        $frekuensiPenggunaan <= 4
    ) {

        $frekuensiPenggunaanX3 = 2;

    } else {

        $frekuensiPenggunaanX3 = 3;
    }

    // --------------------------------------------------------
    // 11D. MEMERIKSA KODE LAPORAN
    // --------------------------------------------------------

    $stmt = $pdo->prepare("
        SELECT
            id_laporan
        FROM laporan_kerusakan
        WHERE kode_laporan = :kode_laporan
        LIMIT 1
    ");

    $stmt->execute([
        ':kode_laporan' => $kodeLaporan
    ]);

    if ($stmt->fetch()) {

        simpanLaporanResponse(
            409,
            false,
            'Kode laporan sudah digunakan.'
        );
    }

    // --------------------------------------------------------
    // 11E. MENYIMPAN LAPORAN
    // --------------------------------------------------------

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
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
        )
        VALUES (
            :id_pelapor,
            :id_fasilitas,
            :kode_laporan,
            :deskripsi_kerusakan,
            :tingkat_kerusakan_x1,
            :dampak_akademik_x2,
            :frekuensi_penggunaan_x3,
            :prioritas_awal,
            :status_verifikasi,
            :status_penanganan,
            NOW(),
            NOW()
        )
    ");

    $stmt->execute([
        ':id_pelapor' =>
            $idPengguna,

        ':id_fasilitas' =>
            $idFasilitas,

        ':kode_laporan' =>
            $kodeLaporan,

        ':deskripsi_kerusakan' =>
            $deskripsiKerusakan,

        ':tingkat_kerusakan_x1' =>
            $tingkatKerusakanX1,

        ':dampak_akademik_x2' =>
            $dampakAkademikX2,

        ':frekuensi_penggunaan_x3' =>
            $frekuensiPenggunaanX3,

        ':prioritas_awal' =>
            $prioritasAwal,

        ':status_verifikasi' =>
            'Menunggu',

        ':status_penanganan' =>
            'Menunggu'
    ]);

    $idLaporan = (int) (
        $pdo->lastInsertId()
    );

    $pdo->commit();

    // --------------------------------------------------------
    // 11F. RESPONSE BERHASIL
    // --------------------------------------------------------

    simpanLaporanResponse(
        201,
        true,
        'Laporan berhasil disimpan ke database.',
        [
            'id_laporan' =>
                $idLaporan,

            'kode_laporan' =>
                $kodeLaporan,

            'id_pelapor' =>
                $idPengguna,

            'id_fasilitas' =>
                $idFasilitas,

            'frekuensi_penggunaan_x3' =>
                $frekuensiPenggunaanX3,

            'prioritas_awal' =>
                $prioritasAwal,

            'status_verifikasi' =>
                'Menunggu',

            'status_penanganan' =>
                'Menunggu'
        ]
    );

} catch (Throwable $e) {

    // Membatalkan transaksi jika masih aktif.
    if (
        $pdo->inTransaction()
    ) {

        $pdo->rollBack();
    }

    // Mencatat detail error pada server.
    error_log(
        '[SIPFAS SIMPAN LAPORAN] ' .
        get_class($e) .
        ': ' .
        $e->getMessage()
    );

    simpanLaporanResponse(
        500,
        false,
        'Terjadi kesalahan server saat menyimpan laporan.'
    );
}