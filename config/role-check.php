<?php
// =========================================================
// 1. MEMANGGIL FILE AUTENTIKASI
// =========================================================

// Memuat auth-check.php agar sistem dapat mengetahui
// apakah pengguna sudah login atau belum.
require_once __DIR__ . '/auth-check.php';


// =========================================================
// 2. MENDEFINISIKAN ID ROLE SIPFAS
// =========================================================

// ID 1 digunakan untuk Administrator.
if (!defined('SIPFAS_ROLE_ADMIN')) {
    define('SIPFAS_ROLE_ADMIN', 1);
}

// ID 2 digunakan untuk Petugas Sarpras.
if (!defined('SIPFAS_ROLE_PETUGAS')) {
    define('SIPFAS_ROLE_PETUGAS', 2);
}

// ID 3 digunakan untuk Pelapor.
if (!defined('SIPFAS_ROLE_PELAPOR')) {
    define('SIPFAS_ROLE_PELAPOR', 3);
}


// =========================================================
// 3. MENGAMBIL ID ROLE PENGGUNA AKTIF
// =========================================================

if (!function_exists('sipfas_current_role_id')) {

    function sipfas_current_role_id(): ?int
    {
        // Mengambil data pengguna yang sedang login.
        $user = sipfas_current_user();

        // Jika pengguna belum login, kembalikan null.
        if ($user === null) {
            return null;
        }

        // Mengambil ID role dari session pengguna.
        $roleId = $user['id_peran'] ?? null;

        // Memastikan ID role berupa angka yang valid.
        if (
            !is_numeric($roleId) ||
            (int) $roleId <= 0
        ) {
            return null;
        }

        // Mengembalikan ID role pengguna.
        return (int) $roleId;
    }
}


// =========================================================
// 4. MEMERIKSA ROLE PENGGUNA
// =========================================================

if (!function_exists('sipfas_has_role')) {

    function sipfas_has_role($allowedRoles): bool
    {
        // Memastikan pengguna sudah login.
        if (!sipfas_is_authenticated()) {
            return false;
        }

        // Mengambil ID role pengguna yang sedang login.
        $currentRole = sipfas_current_role_id();

        // Jika role tidak tersedia, akses ditolak.
        if ($currentRole === null) {
            return false;
        }

        // Mengubah satu ID role menjadi array.
        if (!is_array($allowedRoles)) {
            $allowedRoles = [$allowedRoles];
        }

        // Memeriksa apakah setiap role yang diizinkan valid.
        foreach ($allowedRoles as $role) {

            if (
                !is_numeric($role) ||
                (int) $role <= 0
            ) {
                return false;
            }
        }

        // Mengubah seluruh ID role menjadi integer.
        $allowedRoles = array_map('intval', $allowedRoles);

        // Memeriksa apakah role pengguna termasuk
        // dalam daftar role yang diperbolehkan.
        return in_array($currentRole, $allowedRoles, true);
    }
}


// =========================================================
// 5. MEWAJIBKAN ROLE TERTENTU
// =========================================================

// Fungsi ini tetap dipertahankan untuk kompatibilitas.
// Pemeriksaan utamanya menggunakan fungsi yang sudah
// didefinisikan di auth-check.php.


// =========================================================
// 6. MEMERIKSA APAKAH PENGGUNA ADALAH ADMINISTRATOR
// =========================================================

if (!function_exists('sipfas_is_admin')) {

    function sipfas_is_admin(): bool
    {
        // Memeriksa apakah pengguna memiliki role Administrator.
        return sipfas_has_role(SIPFAS_ROLE_ADMIN);
    }
}


// =========================================================
// 7. MEMERIKSA APAKAH PENGGUNA ADALAH PETUGAS
// =========================================================

if (!function_exists('sipfas_is_petugas')) {

    function sipfas_is_petugas(): bool
    {
        // Memeriksa apakah pengguna memiliki role Petugas Sarpras.
        return sipfas_has_role(SIPFAS_ROLE_PETUGAS);
    }
}


// =========================================================
// 8. MEMERIKSA APAKAH PENGGUNA ADALAH PELAPOR
// =========================================================

if (!function_exists('sipfas_is_pelapor')) {

    function sipfas_is_pelapor(): bool
    {
        // Memeriksa apakah pengguna memiliki role Pelapor.
        return sipfas_has_role(SIPFAS_ROLE_PELAPOR);
    }
}