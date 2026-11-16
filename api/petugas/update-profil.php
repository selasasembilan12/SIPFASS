//UPDATE-PROFIL.PHP
<?php

// Memuat konfigurasi sistem dan koneksi database
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/config/koneksi.php';

// Mengatur header respons JSON
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

// Memastikan metode request adalah POST
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metode request harus POST.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Membaca input dari JSON body atau FormData ($_POST)
$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '{}', true);
if (!is_array($input) || empty($input)) {
    $input = $_POST;
}

try {
    // Mengambil ID pengguna aktif dari session atau fallback ke Petugas Sarpras pertama
    $userId = (int)($_SESSION['id_pengguna'] ?? $_SESSION['user']['id_pengguna'] ?? 0);
    if ($userId <= 0) {
        $userId = (int)($pdo->query("
            SELECT u.id_pengguna
            FROM pengguna u
            JOIN peran p ON p.id_peran = u.id_peran
            WHERE p.nama_peran IN ('Petugas Sarpras', 'Administrator')
            ORDER BY u.id_pengguna ASC
            LIMIT 1
        ")->fetchColumn() ?: 1);
    }

    // Mengambil data pengguna saat ini
    $stmt = $pdo->prepare("SELECT * FROM pengguna WHERE id_pengguna = :id LIMIT 1");
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Data pengguna tidak ditemukan.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Memeriksa mode pembaruan password atau pembaruan profil umum
    $action = strtolower(trim((string)($input['action'] ?? '')));
    $oldPassword = (string)($input['old_password'] ?? $input['password_lama'] ?? '');
    $newPassword = (string)($input['new_password'] ?? $input['password_baru'] ?? '');

    if ($action === 'password' || ($oldPassword !== '' && $newPassword !== '')) {
        if ($oldPassword === '' || $newPassword === '') {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'Password lama dan password baru wajib diisi.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (!password_verify($oldPassword, (string)$user['kata_sandi'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Password lama tidak sesuai.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (strlen($newPassword) < 6) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'Password baru minimal 6 karakter.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $hashed = password_hash($newPassword, PASSWORD_DEFAULT);
        $pdo->prepare("UPDATE pengguna SET kata_sandi = :pass WHERE id_pengguna = :id")
            ->execute([':pass' => $hashed, ':id' => $userId]);

        echo json_encode([
            'success' => true,
            'message' => 'Kata sandi berhasil diperbarui.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Validasi input data profil
    $namaLengkap  = trim((string)($input['nama_lengkap'] ?? $user['nama_lengkap']));
    $namaPengguna = strtolower(trim((string)($input['nama_pengguna'] ?? $user['nama_pengguna'])));
    $email        = strtolower(trim((string)($input['email'] ?? $user['email'])));
    $noHp         = trim((string)($input['no_hp'] ?? $input['nomor_telepon'] ?? ($user['no_hp'] ?? $user['nomor_telepon'] ?? '')));

    if ($namaLengkap === '' || $namaPengguna === '' || $email === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Nama lengkap, username, dan email wajib diisi.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Format alamat email tidak valid.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Memastikan username atau email belum dipakai pengguna lain
    $cekDuplikat = $pdo->prepare("
        SELECT id_pengguna
        FROM pengguna
        WHERE (nama_pengguna = :username OR email = :email)
          AND id_pengguna != :id
        LIMIT 1
    ");
    $cekDuplikat->execute([
        ':username' => $namaPengguna,
        ':email'    => $email,
        ':id'       => $userId,
    ]);

    if ($cekDuplikat->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Username atau email sudah digunakan akun lain.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Menangani unggahan foto profil jika ada file yang dikirim
    $cols = $pdo->query("SHOW COLUMNS FROM pengguna")->fetchAll(PDO::FETCH_COLUMN);
    $fotoPath = $user['foto_profil'] ?? null;

    if (isset($_FILES['foto_profil']) && $_FILES['foto_profil']['error'] === UPLOAD_ERR_OK) {
        $ext = strtolower(pathinfo($_FILES['foto_profil']['name'], PATHINFO_EXTENSION));
        $allowedExt = ['jpg', 'jpeg', 'png', 'webp'];

        if (!in_array($ext, $allowedExt, true)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'Format foto harus JPG, PNG, atau WEBP.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $uploadDir = dirname(__DIR__, 2) . '/uploads/profil/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0775, true);
        }

        $fileName = 'profil_' . $userId . '_' . time() . '.' . $ext;
        if (move_uploaded_file($_FILES['foto_profil']['tmp_name'], $uploadDir . $fileName)) {
            $fotoPath = 'uploads/profil/' . $fileName;
        }
    }

    // Menyusun query UPDATE sesuai kolom yang tersedia di tabel pengguna
    $updates = [
        'nama_lengkap = :nama_lengkap',
        'nama_pengguna = :nama_pengguna',
        'email = :email',
    ];
    $params = [
        ':nama_lengkap'  => $namaLengkap,
        ':nama_pengguna' => $namaPengguna,
        ':email'         => $email,
        ':id'            => $userId,
    ];

    if (in_array('no_hp', $cols, true)) {
        $updates[] = 'no_hp = :no_hp';
        $params[':no_hp'] = $noHp !== '' ? $noHp : null;
    } elseif (in_array('nomor_telepon', $cols, true)) {
        $updates[] = 'nomor_telepon = :no_hp';
        $params[':no_hp'] = $noHp !== '' ? $noHp : null;
    }

    if (in_array('foto_profil', $cols, true) && $fotoPath !== null) {
        $updates[] = 'foto_profil = :foto_profil';
        $params[':foto_profil'] = $fotoPath;
    }

    $pdo->prepare("UPDATE pengguna SET " . implode(', ', $updates) . " WHERE id_pengguna = :id")
        ->execute($params);

    // Memperbarui data nama lengkap di session aktif
    if (isset($_SESSION['nama_lengkap'])) {
        $_SESSION['nama_lengkap'] = $namaLengkap;
    }
    if (isset($_SESSION['user']['nama_lengkap'])) {
        $_SESSION['user']['nama_lengkap'] = $namaLengkap;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Profil berhasil diperbarui.',
        'data'    => [
            'id_pengguna'   => $userId,
            'nama_lengkap'  => $namaLengkap,
            'nama_pengguna' => $namaPengguna,
            'email'         => $email,
            'foto_profil'   => $fotoPath,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('[SIPFAS UPDATE PROFIL ERROR] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Gagal memperbarui profil: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}