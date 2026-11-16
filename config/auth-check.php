
<?php

// =========================================================
// 1. MEMANGGIL KONFIGURASI UTAMA
// =========================================================

// Memuat bootstrap.php agar session dan koneksi database
// sudah diinisialisasi sebelum pemeriksaan autentikasi.
require_once __DIR__ . '/bootstrap.php';

// Memuat response.php untuk menangani respons JSON
// ketika pengguna tidak memiliki akses.
require_once __DIR__ . '/response.php';


// =========================================================
// 2. MEMERIKSA STATUS LOGIN PENGGUNA
// =========================================================

function sipfas_is_authenticated(): bool
{
    // Memastikan session pengguna tersedia dalam bentuk array.
    if (
        !isset($_SESSION['user']) ||
        !is_array($_SESSION['user'])
    ) {
        return false;
    }

    // Memastikan ID pengguna tersedia dan valid.
    $idPengguna = $_SESSION['user']['id_pengguna'] ?? null;

    // Pengguna dianggap login jika memiliki ID yang valid.
    return (
        is_scalar($idPengguna) &&
        (int) $idPengguna > 0
    );
}


// =========================================================
// 3. MENGAMBIL DATA PENGGUNA YANG SEDANG LOGIN
// =========================================================

function sipfas_current_user(): ?array
{
    // Memeriksa apakah pengguna sudah login.
    if (!sipfas_is_authenticated()) {
        return null;
    }

    // Mengembalikan informasi pengguna dari session.
    return $_SESSION['user'];
}


// =========================================================
// 4. MENGAMBIL ID PENGGUNA AKTIF
// =========================================================

function sipfas_current_user_id(): ?int
{
    // Mengambil data pengguna yang sedang login.
    $user = sipfas_current_user();

    // Jika belum login, kembalikan null.
    if ($user === null) {
        return null;
    }

    // Mengembalikan ID pengguna.
    return (int) $user['id_pengguna'];
}


// =========================================================
// 5. MEWAJIBKAN PENGGUNA SUDAH LOGIN
// =========================================================

function sipfas_require_auth(): void
{
    // Memeriksa status autentikasi pengguna.
    if (!sipfas_is_authenticated()) {

        // Mengirim respons JSON jika pengguna belum login.
        response_error(
            'Anda harus login terlebih dahulu.',
            401
        );
    }
}


// =========================================================
// 6. MENGAMBIL NAMA PENGGUNA AKTIF
// =========================================================

function sipfas_current_user_name(): ?string
{
    // Mengambil data pengguna yang sedang login.
    $user = sipfas_current_user();

    // Jika pengguna belum login, kembalikan null.
    if ($user === null) {
        return null;
    }

    // Mengembalikan nama lengkap pengguna.
    return $user['nama_lengkap'] ?? null;
}
