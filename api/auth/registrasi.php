
<?php

// Mengatur format respons API.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// Memanggil koneksi database PDO.
require_once __DIR__ . '/../../koneksi.php';

// Menyeragamkan respons JSON dari server.
function registerResponse(bool $success, string $message, array $data = [], int $statusCode = 200): never {
    http_response_code($statusCode);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

// Memastikan registrasi hanya menggunakan metode POST.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    registerResponse(false, 'Metode permintaan tidak diizinkan.', [], 405);
}

// Memeriksa ketersediaan koneksi database.
if (!isset($pdo) || !($pdo instanceof PDO)) {
    error_log('[SIPFAS REGISTRASI] Koneksi PDO tidak tersedia.');
    registerResponse(false, 'Koneksi database tidak tersedia.', [], 500);
}

// Membaca data JSON atau form POST dari frontend.
$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    $input = $_POST;
}

// Mengambil nilai formulir registrasi.
$namaLengkap = trim((string)($input['fullName'] ?? $input['nama_lengkap'] ?? ''));
$nomorIdentitas = trim((string)($input['nim'] ?? $input['nomor_identitas'] ?? ''));
$namaPengguna = strtolower(trim((string)($input['username'] ?? $input['nama_pengguna'] ?? '')));
$email = strtolower(trim((string)($input['email'] ?? '')));
$password = (string)($input['password'] ?? '');
$konfirmasiPassword = (string)($input['confirmPassword'] ?? $input['konfirmasi_password'] ?? '');

// Memvalidasi nama lengkap.
if ($namaLengkap === '' || mb_strlen($namaLengkap, 'UTF-8') < 3 || mb_strlen($namaLengkap, 'UTF-8') > 150) {
    registerResponse(false, 'Nama lengkap wajib diisi dengan panjang 3 sampai 150 karakter.', [], 422);
}

// Memvalidasi nomor identitas.
if (!preg_match('/^[0-9]{5,20}$/', $nomorIdentitas)) {
    registerResponse(false, 'Nomor identitas harus berupa angka dengan panjang 5 sampai 20 digit.', [], 422);
}

// Memvalidasi username.
if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}$/', $namaPengguna)) {
    registerResponse(false, 'Username harus terdiri dari 3 sampai 30 karakter dan hanya menggunakan huruf, angka, titik, garis bawah, atau tanda hubung.', [], 422);
}

// Memvalidasi format dan panjang email.
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 150) {
    registerResponse(false, 'Alamat email tidak valid.', [], 422);
}

// Memvalidasi kekuatan password.
if (strlen($password) < 8 || strlen($password) > 72 || !preg_match('/[A-Z]/', $password) || !preg_match('/[a-z]/', $password) || !preg_match('/[0-9]/', $password)) {
    registerResponse(false, 'Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.', [], 422);
}

// Memastikan konfirmasi password sesuai.
if ($password !== $konfirmasiPassword) {
    registerResponse(false, 'Konfirmasi password tidak sesuai.', [], 422);
}

try {
    // Memulai transaksi database.
    $pdo->beginTransaction();

    // Mengambil ID peran Pelapor dari tabel peran.
    $roleStmt = $pdo->prepare("SELECT id_peran FROM peran WHERE nama_peran = :role LIMIT 1");
    $roleStmt->execute([':role' => 'Pelapor']);
    $role = $roleStmt->fetch(PDO::FETCH_ASSOC);

    if (!$role) {
        $pdo->rollBack();
        registerResponse(false, 'Role Pelapor belum tersedia di database.', [], 500);
    }

    // Memeriksa apakah identitas, username, atau email sudah terdaftar.
    $checkSql = "SELECT nomor_identitas, nama_pengguna, email FROM pengguna WHERE nomor_identitas = :nim OR nama_pengguna = :username OR email = :email LIMIT 1";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute([
        ':nim' => $nomorIdentitas,
        ':username' => $namaPengguna,
        ':email' => $email
    ]);

    $duplicate = $checkStmt->fetch(PDO::FETCH_ASSOC);

    // Menghentikan registrasi apabila ditemukan data duplikat.
    if ($duplicate) {
        $pdo->rollBack();

        if ((string)$duplicate['nomor_identitas'] === $nomorIdentitas) {
            registerResponse(false, 'Nomor identitas sudah terdaftar.', [], 409);
        }

        if (strcasecmp((string)$duplicate['nama_pengguna'], $namaPengguna) === 0) {
            registerResponse(false, 'Username sudah digunakan.', [], 409);
        }

        if (strcasecmp((string)$duplicate['email'], $email) === 0) {
            registerResponse(false, 'Email sudah terdaftar.', [], 409);
        }

        registerResponse(false, 'Data akun sudah digunakan.', [], 409);
    }

    // Mengamankan password sebelum disimpan ke database.
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    if ($passwordHash === false) {
        throw new RuntimeException('Gagal memproses password.');
    }

    // Menyimpan akun baru dengan peran Pelapor.
    // Email belum dinyatakan terverifikasi pada tahap registrasi.
    $insertSql = "INSERT INTO pengguna (
        id_peran,
        nama_lengkap,
        nomor_identitas,
        nama_pengguna,
        email,
        kata_sandi,
        status_akun,
        email_terverifikasi_pada,
        dibuat_oleh
    ) VALUES (
        :id_peran,
        :nama_lengkap,
        :nim,
        :username,
        :email,
        :password,
        'Aktif',
        NULL,
        NULL
    )";

    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        ':id_peran' => (int)$role['id_peran'],
        ':nama_lengkap' => $namaLengkap,
        ':nim' => $nomorIdentitas,
        ':username' => $namaPengguna,
        ':email' => $email,
        ':password' => $passwordHash
    ]);

    // Mengambil ID pengguna yang baru dibuat.
    $idPengguna = (int)$pdo->lastInsertId();

    // Menyimpan perubahan transaksi secara permanen.
    $pdo->commit();

    // Mengirimkan informasi keberhasilan ke frontend.
    registerResponse(true, 'Registrasi berhasil. Silakan login menggunakan username atau email.', [
        'id_pengguna' => $idPengguna,
        'nama_lengkap' => $namaLengkap,
        'nama_pengguna' => $namaPengguna,
        'email' => $email,
        'role' => 'Pelapor',
        'redirect' => '../../auth/login.html'
    ], 201);

} catch (PDOException $e) {
    // Membatalkan transaksi apabila terjadi kesalahan database.
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('[SIPFAS REGISTRASI PDO] ' . $e->getMessage());

    // Menangani pelanggaran UNIQUE constraint.
    if ((int)($e->errorInfo[1] ?? 0) === 1062) {
        registerResponse(false, 'Nomor identitas, username, atau email sudah terdaftar.', [], 409);
    }

    registerResponse(false, 'Terjadi kesalahan database saat menyimpan akun.', [], 500);

} catch (Throwable $e) {
    // Memastikan transaksi dibatalkan jika proses gagal.
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('[SIPFAS REGISTRASI] ' . $e->getMessage());

    registerResponse(false, 'Terjadi kesalahan pada server. Silakan coba kembali.', [], 500);
}
