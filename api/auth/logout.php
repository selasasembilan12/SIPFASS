<?php



// Mengatur session sesuai konfigurasi login.php.
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => isset($_SERVER['HTTPS']) &&
                    $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    session_start();
}

// Mencegah halaman logout tersimpan dalam cache.
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// Fungsi respons JSON.
function logoutResponse(
    bool $success,
    string $message,
    array $data = [],
    int $status = 200
): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

// Memastikan metode request GET atau POST.
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');

    logoutResponse(
        false,
        'Metode permintaan tidak diizinkan.',
        [],
        405
    );
}

try {

    // Menghapus seluruh data session pengguna.
    $_SESSION = [];

    // Menghapus cookie session dari browser.
    if (ini_get('session.use_cookies')) {

        $params = session_get_cookie_params();

        $cookieOptions = [
            'expires' => time() - 42000,
            'path' => $params['path'] ?: '/',
            'secure' => (bool) $params['secure'],
            'httponly' => (bool) $params['httponly'],
            'samesite' => $params['samesite'] ?: 'Lax'
        ];

        if (!empty($params['domain'])) {
            $cookieOptions['domain'] = $params['domain'];
        }

        setcookie(
            session_name(),
            '',
            $cookieOptions
        );
    }

    // Menghancurkan session pada server.
    if (!session_destroy()) {
        throw new RuntimeException(
            'Gagal mengakhiri session.'
        );
    }

    // Tujuan halaman login SIPFAS.
    $loginUrl = '../../auth/login.html';

    // Jika logout diakses melalui browser.
    if ($method === 'GET') {
        header(
            'Location: ' . $loginUrl,
            true,
            303
        );
        exit;
    }

    // Jika logout dipanggil melalui JavaScript fetch.
    logoutResponse(
        true,
        'Anda berhasil keluar dari akun SIPFAS.',
        [
            'redirect' => $loginUrl
        ]
    );

} catch (Throwable $e) {

    // Mencatat kesalahan pada log server.
    error_log(
        '[SIPFAS LOGOUT ERROR] ' . $e->getMessage()
    );

    logoutResponse(
        false,
        'Terjadi kesalahan saat mengakhiri sesi.',
        [],
        500
    );
}