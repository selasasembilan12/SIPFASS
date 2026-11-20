<?php
declare(strict_types=1);

// =========================================================
// 1. MEMUAT BOOTSTRAP DAN RESPONS JSON
// =========================================================

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/response.php';


// =========================================================
// 2. MEMBUAT ATAU MENGAMBIL TOKEN CSRF
// =========================================================

if (!function_exists('sipfas_csrf_token')) {

    function sipfas_csrf_token(): string
    {
        // Memeriksa apakah token tersedia dan valid.
        if (
            empty($_SESSION['_csrf_token']) ||
            !is_string($_SESSION['_csrf_token'])
        ) {
            // Membuat token acak yang aman secara kriptografis.
            $_SESSION['_csrf_token'] = bin2hex(
                random_bytes(32)
            );
        }

        return $_SESSION['_csrf_token'];
    }
}


// =========================================================
// 3. MEMBUAT INPUT TOKEN UNTUK FORM HTML
// =========================================================

if (!function_exists('sipfas_csrf_field')) {

    function sipfas_csrf_field(): string
    {
        $token = sipfas_csrf_token();

        return '<input type="hidden" name="csrf_token" value="' .
            htmlspecialchars(
                $token,
                ENT_QUOTES,
                'UTF-8'
            ) .
            '">';
    }
}


// =========================================================
// 4. MENGAMBIL TOKEN DARI REQUEST
// =========================================================

if (!function_exists('sipfas_csrf_get_request_token')) {

    function sipfas_csrf_get_request_token(): ?string
    {
        // Prioritas pertama: token dari form POST.
        if (
            isset($_POST['csrf_token']) &&
            is_string($_POST['csrf_token'])
        ) {
            return $_POST['csrf_token'];
        }

        // Prioritas kedua: token dari HTTP Header.
        // Digunakan oleh JavaScript Fetch.
        $headerToken = null;

        if (function_exists('getallheaders')) {

            $headers = getallheaders();

            if (is_array($headers)) {

                foreach ($headers as $name => $value) {

                    if (
                        strtolower((string) $name) ===
                        'x-csrf-token' &&
                        is_string($value)
                    ) {
                        $headerToken = $value;
                        break;
                    }
                }
            }
        }

        // Fallback untuk server Apache/XAMPP.
        if ($headerToken === null) {

            $serverToken =
                $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;

            if (is_string($serverToken)) {
                $headerToken = $serverToken;
            }
        }

        return $headerToken;
    }
}


// =========================================================
// 5. MEMVALIDASI TOKEN CSRF
// =========================================================

if (!function_exists('sipfas_csrf_verify')) {

    function sipfas_csrf_verify(?string $token = null): bool
    {
        // Mengambil token yang tersimpan dalam session.
        $sessionToken = $_SESSION['_csrf_token'] ?? null;

        // Token session harus tersedia dan valid.
        if (
            !is_string($sessionToken) ||
            $sessionToken === ''
        ) {
            return false;
        }

        // Jika token tidak diberikan secara langsung,
        // ambil token dari request.
        if ($token === null) {
            $token = sipfas_csrf_get_request_token();
        }

        // Token request harus berupa string.
        if (
            !is_string($token) ||
            $token === ''
        ) {
            return false;
        }

        // Membandingkan token secara aman.
        return hash_equals($sessionToken, $token);
    }
}


// =========================================================
// 6. RESPONS PENOLAKAN CSRF
// =========================================================

if (!function_exists('sipfas_csrf_reject')) {

    function sipfas_csrf_reject(): never
    {
        // Menggunakan respons JSON standar SIPFAS.
        response_error(
            'Token keamanan tidak valid atau telah kedaluwarsa.',
            419
        );
    }
}


// =========================================================
// 7. MEWAJIBKAN VALIDASI CSRF
// =========================================================

if (!function_exists('sipfas_csrf_require_valid')) {

    function sipfas_csrf_require_valid(): void
    {
        // Mengambil metode HTTP.
        $method = strtoupper(
            $_SERVER['REQUEST_METHOD'] ?? 'GET'
        );

        // Metode yang tidak mengubah data tidak memerlukan CSRF.
        if (
            in_array(
                $method,
                ['GET', 'HEAD', 'OPTIONS'],
                true
            )
        ) {
            return;
        }

        // Hanya metode perubahan data yang didukung.
        if (
            !in_array(
                $method,
                ['POST', 'PUT', 'PATCH', 'DELETE'],
                true
            )
        ) {
            http_response_code(405);

            header(
                'Content-Type: application/json; charset=utf-8'
            );

            echo json_encode([
                'success' => false,
                'message' => 'Metode request tidak diizinkan.',
                'data' => null,
                'errors' => null
            ], JSON_UNESCAPED_UNICODE);

            exit;
        }

        // Memvalidasi token CSRF.
        if (!sipfas_csrf_verify()) {
            sipfas_csrf_reject();
        }
    }
}