
<?php

// Memuat bootstrap untuk memastikan session sudah aktif.
require_once __DIR__ . '/bootstrap.php';

// Memuat fungsi respons JSON.
require_once __DIR__ . '/response.php';

/**
 * ---------------------------------------------------------
 * 1. MEMBUAT ATAU MENGAMBIL TOKEN CSRF
 * ---------------------------------------------------------
 *
 * Jika token belum tersedia di session, sistem akan
 * membuat token acak menggunakan random_bytes().
 *
 * Jika sudah tersedia, sistem menggunakan token yang sama.
 *
 */

function sipfas_csrf_token(): string
{
    // Memeriksa apakah token CSRF sudah tersedia.
    if (
        empty($_SESSION['_csrf_token']) ||
        !is_string($_SESSION['_csrf_token'])
    ) {

        // Membuat token acak yang aman secara kriptografis.
        $_SESSION['_csrf_token'] = bin2hex(random_bytes(32));
    }

    // Mengembalikan token CSRF.
    return $_SESSION['_csrf_token'];
}


/**
 * ---------------------------------------------------------
 * 2. MEMBUAT INPUT TOKEN UNTUK FORM HTML
 * ---------------------------------------------------------
 *
 * Fungsi ini menghasilkan input tersembunyi yang dapat
 * dimasukkan ke dalam form HTML.
 *
 * Dengan demikian, setiap form yang membutuhkan
 * perlindungan CSRF dapat mengirimkan token.
 *
 */

function sipfas_csrf_field(): string
{
    // Mengambil token CSRF yang tersimpan di session.
    $token = sipfas_csrf_token();

    // Mengembalikan input HTML tersembunyi.
    return '<input type="hidden" name="csrf_token" value="' .
        htmlspecialchars($token, ENT_QUOTES, 'UTF-8') .
        '">';
}


/**
 * ---------------------------------------------------------
 * 3. MENGAMBIL TOKEN DARI REQUEST
 * ---------------------------------------------------------
 *
 * Token dapat dikirim melalui:
 * - Form HTML menggunakan POST.
 * - JavaScript menggunakan header X-CSRF-Token.
 *
 */

function sipfas_csrf_get_request_token(): ?string
{
    // Mengambil token dari form POST jika tersedia.
    if (isset($_POST['csrf_token']) && is_string($_POST['csrf_token'])) {
        return $_POST['csrf_token'];
    }

    // Memeriksa header HTTP yang dikirim JavaScript.
    $headers = function_exists('getallheaders')
        ? getallheaders()
        : [];

    foreach ($headers as $name => $value) {

        // Mencocokkan nama header tanpa membedakan huruf besar/kecil.
        if (strtolower($name) === 'x-csrf-token' && is_string($value)) {
            return $value;
        }
    }

    // Mengembalikan null jika token tidak ditemukan.
    return null;
}


/**
 * ---------------------------------------------------------
 * 4. MEMVALIDASI TOKEN CSRF
 * ---------------------------------------------------------
 *
 * Membandingkan token dari request dengan token yang
 * tersimpan di session.
 *
 * Menggunakan hash_equals() untuk mencegah timing attack.
 *
 */

function sipfas_csrf_verify(?string $token = null): bool
{
    // Mengambil token yang tersimpan di session.
    $sessionToken = $_SESSION['_csrf_token'] ?? null;

    // Jika token session tidak tersedia, validasi gagal.
    if (!is_string($sessionToken) || $sessionToken === '') {
        return false;
    }

    // Jika token tidak diberikan secara langsung,
    // ambil token dari request.
    if ($token === null) {
        $token = sipfas_csrf_get_request_token();
    }

    // Jika token request tidak tersedia, validasi gagal.
    if (!is_string($token) || $token === '') {
        return false;
    }

    // Membandingkan token request dengan token session.
    return hash_equals($sessionToken, $token);
}


/**
 * ---------------------------------------------------------
 * 5. MEWAJIBKAN VALIDASI CSRF
 * ---------------------------------------------------------
 *
 * Fungsi ini digunakan pada API atau proses yang mengubah
 * data, seperti POST, PUT, PATCH, dan DELETE.
 *
 * Jika token tidak valid, permintaan akan ditolak.
 *
 */

function sipfas_csrf_require_valid(): void
{
    // Mengambil metode HTTP dari request.
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    // Metode yang tidak mengubah data tidak perlu validasi CSRF.
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
        return;
    }

    // Memeriksa validitas token CSRF.
    if (!sipfas_csrf_verify()) {

        // Mengirimkan respons gagal menggunakan response.php
        // jika fungsi respons sudah tersedia.
        if (function_exists('response_error')) {
            response_error(
                'Token keamanan tidak valid atau telah kedaluwarsa.',
                419
            );
        }

        // Respons cadangan jika response.php belum dimuat.
        http_response_code(419);

        header('Content-Type: application/json; charset=utf-8');

        echo json_encode([
            'success' => false,
            'message' => 'Token CSRF tidak valid.',
            'data' => null,
            'errors' => null
        ]);

        exit;
    }
}
