
<?php

function json_response(array $payload, int $statusCode = 200)
{
    // Menentukan HTTP status code respons.
    http_response_code($statusCode);

    // Memberitahu browser bahwa respons menggunakan JSON.
    header('Content-Type: application/json; charset=utf-8');

    // Mencegah browser menyimpan respons API dalam cache.
    header('Cache-Control: no-store, no-cache, must-revalidate');

    // Mengubah array PHP menjadi JSON.
    echo json_encode(
        $payload,
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );

    // Menghentikan proses setelah respons dikirim.
    exit;
}


/**
 * ---------------------------------------------------------
 * 2. FUNGSI RESPONS BERHASIL
 * ---------------------------------------------------------
 *
 * Digunakan ketika proses API berhasil dilakukan.
 *
 * Parameter:
 * - $message   : Pesan keberhasilan.
 * - $data      : Data yang akan dikirim (opsional).
 * - $statusCode: HTTP status code.
 *
 * Contoh:
 * response_success('Login berhasil', $user);
 *
 */

function response_success(
    string $message = 'Berhasil',
    $data = null,
    int $statusCode = 200
) {

    // Menyusun respons keberhasilan.
    json_response([
        'success' => true,
        'message' => $message,
        'data' => $data,
        'errors' => null
    ], $statusCode);
}


/**
 * ---------------------------------------------------------
 * 3. FUNGSI RESPONS GAGAL
 * ---------------------------------------------------------
 *
 * Digunakan ketika proses API mengalami kegagalan.
 *
 * Parameter:
 * - $message   : Pesan kesalahan.
 * - $statusCode: HTTP status code.
 * - $errors    : Detail kesalahan (opsional).
 *
 * Contoh:
 * response_error('Email tidak ditemukan', 404);
 *
 */

function response_error(
    string $message = 'Terjadi kesalahan',
    int $statusCode = 400,
    $errors = null
) {

    // Menyusun respons kegagalan.
    json_response([
        'success' => false,
        'message' => $message,
        'data' => null,
        'errors' => $errors
    ], $statusCode);
}
