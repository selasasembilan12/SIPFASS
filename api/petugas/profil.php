<?php
declare(strict_types=1);
//revisi akhir
// Memuat konfigurasi session dan koneksi database.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

// Mengatur respons JSON.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

function profilResponse(
    int $status,
    bool $success,
    string $message,
    ?array $user = null
): never {
    http_response_code($status);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'user' => $user,
        'data' => $user
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

try {

    // 01. Memastikan metode request GET.
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        header('Allow: GET');

        profilResponse(
            405,
            false,
            'Metode permintaan tidak diizinkan.'
        );
    }

    // 02. Mengambil ID pengguna dari session aktif.
    $userId = (int) (
        $_SESSION['id_pengguna']
        ?? $_SESSION['user']['id_pengguna']
        ?? $_SESSION['sipfas_user']['id_pengguna']
        ?? 0
    );

    // Session tidak boleh digantikan dengan akun pertama database.
    if (
        $userId <= 0 ||
        ($_SESSION['login_terverifikasi'] ?? false) !== true
    ) {
        profilResponse(
            401,
            false,
            'Sesi login tidak ditemukan. Silakan login kembali.'
        );
    }

    // 03. Mengambil identitas pengguna berdasarkan session.
    $stmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.id_peran,
            u.nama_lengkap,
            u.nomor_identitas,
            u.nama_pengguna,
            u.email,
            u.unit_kerja,
            u.foto_profil,
            u.status_akun,
            u.tanggal_dibuat,
            u.tanggal_diperbarui,
            p.nama_peran

        FROM pengguna u

        INNER JOIN peran p
            ON p.id_peran = u.id_peran

        WHERE u.id_pengguna = :id
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $userId
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        profilResponse(
            404,
            false,
            'Data profil pengguna tidak ditemukan.'
        );
    }

    // 04. Memastikan akun masih aktif.
    if (
        strcasecmp(
            (string) $user['status_akun'],
            'Aktif'
        ) !== 0
    ) {
        profilResponse(
            403,
            false,
            'Akun pengguna tidak aktif.'
        );
    }

    // 05. Memastikan pengguna memiliki peran petugas.
    if (
        !in_array(
            (string) $user['nama_peran'],
            ['Petugas Sarpras', 'Administrator'],
            true
        )
    ) {
        profilResponse(
            403,
            false,
            'Anda tidak memiliki akses profil petugas.'
        );
    }

    // 06. Menyusun data profil tanpa informasi kata sandi.
    $profile = [
        'id_pengguna' => (int) $user['id_pengguna'],
        'id_peran' => (int) $user['id_peran'],

        'nama_lengkap' => (string) $user['nama_lengkap'],
        'nomor_identitas' => (string) $user['nomor_identitas'],

        'nama_pengguna' => (string) $user['nama_pengguna'],
        'email' => (string) $user['email'],

        'unit_kerja' => $user['unit_kerja'],
        'foto_profil' => $user['foto_profil'],

        'status_akun' => (string) $user['status_akun'],
        'nama_peran' => (string) $user['nama_peran'],

        'tanggal_dibuat' => $user['tanggal_dibuat'],
        'tanggal_diperbarui' => $user['tanggal_diperbarui']
    ];

    // 07. Memperbarui data profil pada session.
    $_SESSION['id_pengguna'] = $profile['id_pengguna'];
    $_SESSION['id_peran'] = $profile['id_peran'];
    $_SESSION['nama_peran'] = $profile['nama_peran'];
    $_SESSION['nama_lengkap'] = $profile['nama_lengkap'];

    if (isset($_SESSION['user']) && is_array($_SESSION['user'])) {
        $_SESSION['user'] = array_merge(
            $_SESSION['user'],
            $profile
        );
    }

    if (
        isset($_SESSION['sipfas_user']) &&
        is_array($_SESSION['sipfas_user'])
    ) {
        $_SESSION['sipfas_user'] = array_merge(
            $_SESSION['sipfas_user'],
            $profile
        );
    }

    // 08. Mengirim profil terbaru dari database.
    profilResponse(
        200,
        true,
        'Profil pengguna berhasil dimuat.',
        $profile
    );

} catch (Throwable $e) {

    // Mencatat kesalahan pada log server.
    error_log(
        '[SIPFAS PROFIL PETUGAS ERROR] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    profilResponse(
        500,
        false,
        'Gagal memuat profil pengguna. Periksa PHP error log.'
    );
}
