<?php
declare(strict_types=1);

/**
 * =========================================================
 * SIPFAS - AUTHENTICATION CHECK
 * =========================================================
 *
 * Fungsi:
 * 1. Memeriksa session login resmi.
 * 2. Mengambil identitas pengguna aktif.
 * 3. Mengambil ID pengguna aktif.
 * 4. Mengambil nama pengguna aktif.
 * 5. Memeriksa role pengguna.
 * 6. Menolak akses pengguna yang belum login.
 *
 * Standar session:
 * $_SESSION['user']
 * $_SESSION['login_terverifikasi']
 *
 * =========================================================
 */

// =========================================================
// 1. MEMUAT BOOTSTRAP
// =========================================================

require_once __DIR__ . '/bootstrap.php';

// =========================================================
// 2. MEMERIKSA STATUS AUTENTIKASI
// =========================================================

if (!function_exists('sipfas_is_authenticated')) {

    function sipfas_is_authenticated(): bool
    {
        // Login wajib sudah melewati verifikasi OTP.
        if (
            !isset($_SESSION['login_terverifikasi']) ||
            $_SESSION['login_terverifikasi'] !== true
        ) {
            return false;
        }

        // Identitas utama harus berupa array.
        if (
            !isset($_SESSION['user']) ||
            !is_array($_SESSION['user'])
        ) {
            return false;
        }

        $user = $_SESSION['user'];

        // ID pengguna wajib valid.
        $idPengguna = $user['id_pengguna'] ?? null;

        if (
            !is_scalar($idPengguna) ||
            (int) $idPengguna <= 0
        ) {
            return false;
        }

        // ID session dan ID user harus sama.
        if (
            (int) ($_SESSION['id_pengguna'] ?? 0) !==
            (int) $idPengguna
        ) {
            return false;
        }

        // Role harus tersedia.
        if (
            empty($user['nama_peran']) ||
            empty($user['nama_lengkap'])
        ) {
            return false;
        }

        return true;
    }
}

// =========================================================
// 3. MENGAMBIL DATA PENGGUNA AKTIF
// =========================================================

if (!function_exists('sipfas_current_user')) {

    function sipfas_current_user(): ?array
    {
        if (!sipfas_is_authenticated()) {
            return null;
        }

        return $_SESSION['user'];
    }
}

// =========================================================
// 4. MENGAMBIL ID PENGGUNA AKTIF
// =========================================================

if (!function_exists('sipfas_current_user_id')) {

    function sipfas_current_user_id(): ?int
    {
        $user = sipfas_current_user();

        if ($user === null) {
            return null;
        }

        return (int) $user['id_pengguna'];
    }
}

// =========================================================
// 5. MENGAMBIL NAMA PENGGUNA AKTIF
// =========================================================

if (!function_exists('sipfas_current_user_name')) {

    function sipfas_current_user_name(): ?string
    {
        $user = sipfas_current_user();

        if ($user === null) {
            return null;
        }

        return (string) $user['nama_lengkap'];
    }
}

// =========================================================
// 6. MENGAMBIL ROLE PENGGUNA AKTIF
// =========================================================

if (!function_exists('sipfas_current_user_role')) {

    function sipfas_current_user_role(): ?string
    {
        $user = sipfas_current_user();

        if ($user === null) {
            return null;
        }

        return (string) $user['nama_peran'];
    }
}

// =========================================================
// 7. RESPONS JSON AUTENTIKASI
// =========================================================

if (!function_exists('sipfas_auth_response')) {

    function sipfas_auth_response(
        int $status,
        string $message
    ): never {

        http_response_code($status);

        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate');

        echo json_encode([
            'success' => false,
            'message' => $message,
            'data' => []
        ], JSON_UNESCAPED_UNICODE);

        exit;
    }
}

// =========================================================
// 8. MEWAJIBKAN PENGGUNA SUDAH LOGIN
// =========================================================

if (!function_exists('sipfas_require_auth')) {

    function sipfas_require_auth(): void
    {
        if (!sipfas_is_authenticated()) {

            sipfas_auth_response(
                401,
                'Sesi login tidak ditemukan. Silakan login kembali.'
            );
        }
    }
}

// =========================================================
// 9. MEMBATASI AKSES BERDASARKAN ROLE
// =========================================================

if (!function_exists('sipfas_require_role')) {

    function sipfas_require_role(array $allowedRoles): void
    {
        // Memastikan pengguna sudah login.
        sipfas_require_auth();

        $currentRole = sipfas_current_user_role();

        // Memeriksa apakah role diizinkan.
        if (
            $currentRole === null ||
            !in_array($currentRole, $allowedRoles, true)
        ) {
            sipfas_auth_response(
                403,
                'Anda tidak memiliki hak akses ke halaman ini.'
            );
        }
    }
}

// =========================================================
// 10. MENGAMBIL DATA SESSION SIPFAS
// =========================================================

if (!function_exists('sipfas_session_user')) {

    function sipfas_session_user(): ?array
    {
        return sipfas_current_user();
    }
}
