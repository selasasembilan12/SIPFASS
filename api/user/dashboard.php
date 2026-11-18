<?php
declare(strict_types=1);

/**
 * ============================================================
 * SIPFAS - API DASHBOARD USER / PELAPOR
 * ============================================================
 *
 * Method:
 * GET
 *
 * Fungsi:
 * 1. Memastikan user sudah login.
 * 2. Memastikan akun masih aktif.
 * 3. Memastikan role adalah Pelapor.
 * 4. Mengambil ringkasan laporan milik user.
 * 5. Mengambil beberapa laporan terbaru milik user.
 *
 * Sumber data:
 * - pengguna
 * - peran
 * - laporan_kerusakan
 *
 * Catatan:
 * Dashboard USER hanya menampilkan laporan milik user
 * yang sedang login.
 *
 * Dashboard PETUGAS nantinya berbeda:
 * PETUGAS akan mengambil seluruh laporan dari seluruh user.
 *
 * ============================================================
 */

// ============================================================
// 01. BOOTSTRAP
// ============================================================

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

// ============================================================
// 02. RESPONSE JSON
// ============================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

/**
 * Mengirim response JSON.
 */
function dashboardResponse(
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
// 03. MEMASTIKAN METHOD GET
// ============================================================

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {

    header('Allow: GET');

    dashboardResponse(
        false,
        'Metode permintaan tidak diizinkan.',
        [],
        405
    );
}

// ============================================================
// 04. MEMERIKSA SESSION LOGIN
// ============================================================

$userSession = $_SESSION['user'] ?? null;

if (
    ($_SESSION['login_terverifikasi'] ?? false) !== true ||
    !is_array($userSession)
) {
    dashboardResponse(
        false,
        'Sesi login tidak ditemukan. Silakan login kembali.',
        [],
        401
    );
}

// ============================================================
// 05. MENGAMBIL ID PENGGUNA DARI SESSION
// ============================================================

$idPengguna = (int) (
    $userSession['id_pengguna'] ?? 0
);

if ($idPengguna <= 0) {

    dashboardResponse(
        false,
        'Identitas pengguna tidak valid.',
        [],
        401
    );
}

// ============================================================
// 06. PROSES DATABASE
// ============================================================

try {

    // ========================================================
    // 06.1. MENGAMBIL DATA PENGGUNA TERBARU
    // ========================================================

    $stmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.id_peran,
            u.nama_lengkap,
            u.nama_pengguna,
            u.email,
            u.foto_profil,
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

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // ========================================================
    // 06.2. MEMERIKSA USER
    // ========================================================

    if (!$user) {

        dashboardResponse(
            false,
            'Data pengguna tidak ditemukan.',
            [],
            404
        );
    }

    // ========================================================
    // 06.3. MEMERIKSA STATUS AKUN
    // ========================================================

    if (
        strcasecmp(
            trim((string) $user['status_akun']),
            'Aktif'
        ) !== 0
    ) {

        dashboardResponse(
            false,
            'Akun tidak aktif. Hubungi Administrator.',
            [],
            403
        );
    }

    // ========================================================
    // 06.4. MEMERIKSA ROLE
    // ========================================================

    if (
        strcasecmp(
            trim((string) $user['nama_peran']),
            'Pelapor'
        ) !== 0
    ) {

        dashboardResponse(
            false,
            'Akses ditolak. Dashboard ini khusus untuk Pelapor.',
            [],
            403
        );
    }

    // ========================================================
    // 06.5. TOTAL SEMUA LAPORAN USER
    // ========================================================

    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS total
        FROM laporan_kerusakan
        WHERE id_pelapor = :id_pelapor
    ");

    $stmt->execute([
        ':id_pelapor' => $idPengguna
    ]);

    $totalLaporan = (int) $stmt->fetchColumn();

    // ========================================================
    // 06.6. MENGAMBIL DATA STATUS LAPORAN
    // ========================================================
    //
    // Kita mengambil status secara dinamis dari database.
    // Dengan demikian dashboard tidak bergantung pada
    // jumlah status tertentu.
    //
    // ========================================================

    $stmt = $pdo->prepare("
        SELECT
            status_laporan,
            COUNT(*) AS jumlah
        FROM laporan_kerusakan
        WHERE id_pelapor = :id_pelapor
        GROUP BY status_laporan
        ORDER BY jumlah DESC
    ");

    $stmt->execute([
        ':id_pelapor' => $idPengguna
    ]);

    $statusRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $statusLaporan = [];

    foreach ($statusRows as $row) {

        $status = trim(
            (string) ($row['status_laporan'] ?? '')
        );

        if ($status === '') {
            $status = 'Tidak Diketahui';
        }

        $statusLaporan[] = [
            'status' => $status,
            'jumlah' => (int) $row['jumlah']
        ];
    }

    // ========================================================
    // 06.7. MENGHITUNG STATUS UTAMA
    // ========================================================
    //
    // Dibuat fleksibel terhadap penamaan status.
    //
    // ========================================================

    $menunggu = 0;
    $diproses = 0;
    $selesai = 0;
    $ditolak = 0;

    foreach ($statusLaporan as $row) {

        $status = mb_strtolower(
            $row['status'],
            'UTF-8'
        );

        $jumlah = (int) $row['jumlah'];

        if (
            str_contains($status, 'menunggu') ||
            str_contains($status, 'diajukan') ||
            str_contains($status, 'pending')
        ) {
            $menunggu += $jumlah;
        }

        elseif (
            str_contains($status, 'proses') ||
            str_contains($status, 'ditangani') ||
            str_contains($status, 'verifikasi')
        ) {
            $diproses += $jumlah;
        }

        elseif (
            str_contains($status, 'selesai') ||
            str_contains($status, 'selesai')
        ) {
            $selesai += $jumlah;
        }

        elseif (
            str_contains($status, 'tolak') ||
            str_contains($status, 'ditolak')
        ) {
            $ditolak += $jumlah;
        }
    }

    // ========================================================
    // 06.8. MENGAMBIL LAPORAN TERBARU USER
    // ========================================================
    //
    // Hanya laporan milik user yang sedang login.
    //
    // ========================================================

    $stmt = $pdo->prepare("
        SELECT
            id_laporan,
            id_fasilitas,
            kode_laporan,
            deskripsi_kerusakan,
            status_laporan,
            tanggal_dibuat

        FROM laporan_kerusakan

        WHERE id_pelapor = :id_pelapor

        ORDER BY id_laporan DESC

        LIMIT 5
    ");

    $stmt->execute([
        ':id_pelapor' => $idPengguna
    ]);

    $laporanRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $laporanTerbaru = [];

    foreach ($laporanRows as $laporan) {

        $laporanTerbaru[] = [
            'id_laporan' => (int) $laporan['id_laporan'],

            'id_fasilitas' => isset($laporan['id_fasilitas'])
                ? (int) $laporan['id_fasilitas']
                : null,

            'kode_laporan' => (string) (
                $laporan['kode_laporan'] ?? ''
            ),

            'deskripsi_kerusakan' => (string) (
                $laporan['deskripsi_kerusakan'] ?? ''
            ),

            'status_laporan' => (string) (
                $laporan['status_laporan'] ?? ''
            ),

            'tanggal_dibuat' => $laporan['tanggal_dibuat'] ?? null
        ];
    }

    // ========================================================
    // 06.9. DATA USER
    // ========================================================

    $profil = [
        'id_pengguna' => (int) $user['id_pengguna'],

        'nama_lengkap' => (string) (
            $user['nama_lengkap'] ?? ''
        ),

        'nama_pengguna' => (string) (
            $user['nama_pengguna'] ?? ''
        ),

        'email' => (string) (
            $user['email'] ?? ''
        ),

        'foto_profil' => $user['foto_profil'],

        'nama_peran' => (string) (
            $user['nama_peran'] ?? ''
        )
    ];

    // ========================================================
    // 06.10. RESPONSE BERHASIL
    // ========================================================

    dashboardResponse(
        true,
        'Data dashboard berhasil dimuat.',
        [
            'profil' => $profil,

            'ringkasan' => [
                'total_laporan' => $totalLaporan,
                'menunggu' => $menunggu,
                'diproses' => $diproses,
                'selesai' => $selesai,
                'ditolak' => $ditolak
            ],

            'status_laporan' => $statusLaporan,

            'laporan_terbaru' => $laporanTerbaru
        ]
    );

} catch (PDOException $e) {

    error_log(
        '[SIPFAS DASHBOARD USER DB] ' .
        $e->getMessage()
    );

    dashboardResponse(
        false,
        'Data dashboard belum dapat dimuat karena terjadi kesalahan database.',
        [],
        500
    );

} catch (Throwable $e) {

    error_log(
        '[SIPFAS DASHBOARD USER] ' .
        get_class($e) .
        ': ' .
        $e->getMessage()
    );

    dashboardResponse(
        false,
        'Terjadi kesalahan saat memproses dashboard.',
        [],
        500
    );
}