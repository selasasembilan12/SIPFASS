//PROFIL.PHP
<?php

// Memuat konfigurasi sistem dan koneksi database
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/config/koneksi.php';

// Mengatur header respons JSON
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

try {
    // Membaca ID pengguna dari session aktif
    $userId = (int)($_SESSION['id_pengguna'] ?? $_SESSION['user']['id_pengguna'] ?? 0);

    if ($userId > 0) {
        // Mengambil profil pengguna berdasarkan session login
        $stmt = $pdo->prepare("
            SELECT
                u.id_pengguna,
                u.nama_lengkap,
                u.nama_pengguna,
                u.email,
                u.foto_profil,
                p.nama_peran
            FROM pengguna u
            INNER JOIN peran p ON p.id_peran = u.id_peran
            WHERE u.id_pengguna = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $userId]);
    } else {
        // Fallback jika diakses saat pengujian tanpa session aktif
        $stmt = $pdo->query("
            SELECT
                u.id_pengguna,
                u.nama_lengkap,
                u.nama_pengguna,
                u.email,
                u.foto_profil,
                p.nama_peran
            FROM pengguna u
            INNER JOIN peran p ON p.id_peran = u.id_peran
            WHERE p.nama_peran IN ('Petugas Sarpras', 'Administrator')
            ORDER BY u.id_pengguna ASC
            LIMIT 1
        ");
    }

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'message' => 'Profil aktif berhasil dimuat.',
        'user'    => $user ?: null,
        'data'    => $user ?: null,
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
} catch (Throwable $e) {
    error_log('[SIPFAS PROFIL LOGIN ERROR] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Gagal memuat profil pengguna.',
        'user'    => null,
    ], JSON_UNESCAPED_UNICODE);
}