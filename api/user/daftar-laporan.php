<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(__DIR__, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

function daftarResponse(
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
    daftarResponse(false, 'Metode tidak diizinkan.', [], 405);
}

$user = $_SESSION['user'] ?? [];
$idPelapor = (int)($user['id_pengguna'] ?? 0);

if (
    ($_SESSION['login_terverifikasi'] ?? false) !== true ||
    $idPelapor <= 0
) {
    daftarResponse(false, 'Sesi login tidak valid.', [], 401);
}

try {
    // Validasi akun dan role Pelapor.
    $stmt = $pdo->prepare("
        SELECT u.id_pengguna, u.nama_lengkap, u.status_akun, p.nama_peran
        FROM pengguna u
        INNER JOIN peran p ON p.id_peran = u.id_peran
        WHERE u.id_pengguna = :id
        LIMIT 1
    ");

    $stmt->execute([':id' => $idPelapor]);
    $pengguna = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$pengguna) {
        daftarResponse(false, 'Pengguna tidak ditemukan.', [], 404);
    }

    if (strcasecmp($pengguna['status_akun'], 'Aktif') !== 0) {
        daftarResponse(false, 'Akun tidak aktif.', [], 403);
    }

    if (strcasecmp($pengguna['nama_peran'], 'Pelapor') !== 0) {
        daftarResponse(false, 'Akses khusus Pelapor.', [], 403);
    }

    // Mengambil laporan langsung dari database.
    $stmt = $pdo->prepare("
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

        WHERE l.id_pelapor = :id_pelapor

        ORDER BY l.tanggal_dibuat DESC, l.id_laporan DESC
    ");

    $stmt->execute([':id_pelapor' => $idPelapor]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $laporan = [];

    foreach ($rows as $row) {
        $laporan[] = [
            'id_laporan' => (int)$row['id_laporan'],
            'id_pelapor' => (int)$row['id_pelapor'],
            'id_fasilitas' => (int)$row['id_fasilitas'],
            'id_lokasi' => (int)$row['id_lokasi'],

            'kode_laporan' => $row['kode_laporan'],
            'nama_fasilitas' => $row['nama_fasilitas'] ?? '-',
            'kode_fasilitas' => $row['kode_fasilitas'] ?? '',
            'nama_lokasi' => $row['nama_lokasi'] ?? '-',

            'deskripsi_kerusakan' => $row['deskripsi_kerusakan'],

            'tingkat_kerusakan_x1' => (int)$row['tingkat_kerusakan_x1'],
            'dampak_akademik_x2' => (int)$row['dampak_akademik_x2'],
            'frekuensi_penggunaan_x3' => (int)$row['frekuensi_penggunaan_x3'],

            'tingkat_kerusakan_x1_terverifikasi' =>
                $row['tingkat_kerusakan_x1_terverifikasi'] !== null
                    ? (int)$row['tingkat_kerusakan_x1_terverifikasi']
                    : null,

            'dampak_akademik_x2_terverifikasi' =>
                $row['dampak_akademik_x2_terverifikasi'] !== null
                    ? (int)$row['dampak_akademik_x2_terverifikasi']
                    : null,

            'prioritas_awal' => $row['prioritas_awal'],
            'prioritas_prediksi' => $row['prioritas_prediksi'],

            'status_verifikasi' => $row['status_verifikasi'],
            'status_penanganan' => $row['status_penanganan'],

            'catatan_verifikasi' => $row['catatan_verifikasi'],
            'waktu_verifikasi' => $row['waktu_verifikasi'],

            'tanggal_dibuat' => $row['tanggal_dibuat'],
            'tanggal_diperbarui' => $row['tanggal_diperbarui']
        ];
    }

    daftarResponse(true, 'Daftar laporan berhasil dimuat.', [
        'jumlah' => count($laporan),
        'pengguna' => [
            'id_pengguna' => (int)$pengguna['id_pengguna'],
            'nama_lengkap' => $pengguna['nama_lengkap']
        ],
        'laporan' => $laporan
    ]);

} catch (Throwable $e) {
    error_log('[SIPFAS DAFTAR LAPORAN] ' . $e->getMessage());

    daftarResponse(
        false,
        'Gagal mengambil daftar laporan dari database.',
        [],
        500
    );
}
