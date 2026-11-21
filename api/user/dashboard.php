<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(_DIR_, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

function dashboardResponse(
    bool $success,
    string $message,
    array $data = [],
    int $status = 200
): never {
    http_response_code($status);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    dashboardResponse(false, 'Metode tidak diizinkan.', [], 405);
}

$userSession = $_SESSION['user'] ?? null;

if (
    ($_SESSION['login_terverifikasi'] ?? false) !== true ||
    !is_array($userSession)
) {
    dashboardResponse(false, 'Sesi login tidak ditemukan.', [], 401);
}

$idPengguna = (int)($userSession['id_pengguna'] ?? 0);

if ($idPengguna <= 0) {
    dashboardResponse(false, 'Identitas pengguna tidak valid.', [], 401);
}

try {
    // Pastikan akun masih aktif dan merupakan Pelapor.
    $stmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.nama_lengkap,
            u.nama_pengguna,
            u.email,
            u.foto_profil,
            u.status_akun,
            p.nama_peran
        FROM pengguna u
        INNER JOIN peran p ON p.id_peran = u.id_peran
        WHERE u.id_pengguna = :id
        LIMIT 1
    ");

    $stmt->execute([':id' => $idPengguna]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        dashboardResponse(false, 'Pengguna tidak ditemukan.', [], 404);
    }

    if (strcasecmp($user['status_akun'], 'Aktif') !== 0) {
        dashboardResponse(false, 'Akun tidak aktif.', [], 403);
    }

    if (strcasecmp($user['nama_peran'], 'Pelapor') !== 0) {
        dashboardResponse(false, 'Akses khusus Pelapor.', [], 403);
    }

    // Statistik laporan berdasarkan data database.
    $stmt = $pdo->prepare("
        SELECT
            COUNT(*) AS total,

            SUM(
                CASE
                    WHEN LOWER(status_verifikasi) LIKE '%menunggu%'
                    THEN 1 ELSE 0
                END
            ) AS menunggu,

            SUM(
                CASE
                    WHEN LOWER(status_verifikasi) LIKE '%proses%'
                      OR LOWER(status_verifikasi) LIKE '%verifikasi%'
                      OR LOWER(status_penanganan) LIKE '%proses%'
                      OR LOWER(status_penanganan) LIKE '%ditangani%'
                    THEN 1 ELSE 0
                END
            ) AS diproses,

            SUM(
                CASE
                    WHEN LOWER(status_penanganan) LIKE '%selesai%'
                    THEN 1 ELSE 0
                END
            ) AS selesai,

            SUM(
                CASE
                    WHEN LOWER(status_verifikasi) LIKE '%tolak%'
                      OR LOWER(status_verifikasi) LIKE '%tidak valid%'
                    THEN 1 ELSE 0
                END
            ) AS ditolak

        FROM laporan_kerusakan
        WHERE id_pelapor = :id_pelapor
    ");

    $stmt->execute([':id_pelapor' => $idPengguna]);
    $ringkasan = $stmt->fetch(PDO::FETCH_ASSOC);

    // Lima laporan terbaru.
    $stmt = $pdo->prepare("
        SELECT
            l.id_laporan,
            l.kode_laporan,
            l.id_fasilitas,
            l.deskripsi_kerusakan,
            l.prioritas_awal,
            l.prioritas_prediksi,
            l.status_verifikasi,
            l.status_penanganan,
            l.tanggal_dibuat,
            f.nama_fasilitas,
            f.kode_fasilitas,
            lr.nama_lokasi

        FROM laporan_kerusakan l

        LEFT JOIN fasilitas f
            ON f.id_fasilitas = l.id_fasilitas

        LEFT JOIN lokasi_ruangan lr
            ON lr.id_lokasi = l.id_lokasi

        WHERE l.id_pelapor = :id_pelapor

        ORDER BY l.tanggal_dibuat DESC, l.id_laporan DESC

        LIMIT 5
    ");

    $stmt->execute([':id_pelapor' => $idPengguna]);
    $laporan = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $hasilLaporan = [];

    foreach ($laporan as $row) {
        $hasilLaporan[] = [
            'id_laporan' => (int)$row['id_laporan'],
            'kode_laporan' => $row['kode_laporan'],
            'id_fasilitas' => (int)$row['id_fasilitas'],
            'nama_fasilitas' => $row['nama_fasilitas'] ?? '-',
            'kode_fasilitas' => $row['kode_fasilitas'] ?? '',
            'nama_lokasi' => $row['nama_lokasi'] ?? '-',
            'deskripsi_kerusakan' => $row['deskripsi_kerusakan'],
            'prioritas_awal' => $row['prioritas_awal'],
            'prioritas_prediksi' => $row['prioritas_prediksi'],
            'status_verifikasi' => $row['status_verifikasi'],
            'status_penanganan' => $row['status_penanganan'],
            'tanggal_dibuat' => $row['tanggal_dibuat']
        ];
    }

    dashboardResponse(true, 'Dashboard berhasil dimuat.', [
        'profil' => [
            'id_pengguna' => (int)$user['id_pengguna'],
            'nama_lengkap' => $user['nama_lengkap'],
            'nama_pengguna' => $user['nama_pengguna'],
            'email' => $user['email'],
            'foto_profil' => $user['foto_profil'],
            'nama_peran' => $user['nama_peran']
        ],

        'ringkasan' => [
            'total_laporan' => (int)($ringkasan['total'] ?? 0),
            'menunggu' => (int)($ringkasan['menunggu'] ?? 0),
            'diproses' => (int)($ringkasan['diproses'] ?? 0),
            'selesai' => (int)($ringkasan['selesai'] ?? 0),
            'ditolak' => (int)($ringkasan['ditolak'] ?? 0)
        ],

        'laporan_terbaru' => $hasilLaporan
    ]);

} catch (Throwable $e) {
    error_log('[SIPFAS DASHBOARD] ' . $e->getMessage());

    dashboardResponse(
        false,
        'Gagal mengambil data Dashboard dari database.',
        [],
        500
    );
}
