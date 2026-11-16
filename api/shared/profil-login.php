<?php

// Memuat konfigurasi sistem dan koneksi database
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/config/koneksi.php';

// Mengatur header respons JSON
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

try {
    // Mengambil ID pengguna yang sedang login dari session
    $userId = (int)($_SESSION['id_pengguna'] ?? $_SESSION['user']['id_pengguna'] ?? 0);

    if ($userId <= 0) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Sesi login tidak ditemukan. Silakan login kembali.',
            'user'    => null,
            'data'    => null,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Mengambil profil lengkap pengguna beserta nama perannya
    $stmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.id_peran,
            u.nama_lengkap,
            u.nomor_identitas,
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
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Data pengguna tidak ditemukan.',
            'user'    => null,
            'data'    => null,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Profil pengguna berhasil dimuat.',
        'user'    => $user,
        'data'    => $user,
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
} catch (Throwable $e) {
    error_log('[SIPFAS SHARED PROFIL ERROR] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Gagal memuat profil pengguna: ' . $e->getMessage(),
        'user'    => null,
    ], JSON_UNESCAPED_UNICODE);
}