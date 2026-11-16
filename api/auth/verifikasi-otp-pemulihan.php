<?php
declare(strict_types=1);

// SIPFAS - endpoint OTP Pemulihan: ensure, resend dan verify.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respons(int $status, bool $success, string $message, array $extra = []): void
{
    http_response_code($status);
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respons(405, false, 'Metode tidak diizinkan.');
}
if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') {
    respons(415, false, 'Gunakan format JSON.');
}
$data = json_decode(file_get_contents('php://input', false, null, 0, 2049), true);
if (!is_array($data)) respons(400, false, 'Data tidak valid.');
$action = $data['action'] ?? 'verify';
if (!in_array($action, ['ensure', 'resend', 'verify'], true)) {
    respons(422, false, 'Aksi tidak valid.');
}
if ($action === 'verify' && (!is_string($data['otp'] ?? null) || !preg_match('/^[0-9]{8}$/D', $data['otp']))) {
    respons(422, false, 'Masukkan 8 digit OTP.');
}
if (session_status() !== PHP_SESSION_ACTIVE) {
    ini_set('session.use_strict_mode', '1');
    session_start(['cookie_httponly' => true, 'cookie_samesite' => 'Lax',
        'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
}

// Identitas wajib berasal dari sesi server, bukan email/ID dari browser.
$idPengguna = (string) ($_SESSION['pemulihan_id_pengguna'] ?? '');
if (!empty($_SESSION['pemulihan_terverifikasi']) || time() >= (int) ($_SESSION['pemulihan_pending_expires'] ?? 0)) {
    respons(401, false, 'Sesi pemulihan tidak berlaku. Silakan ulangi pemulihan.');
}
if (!ctype_digit($idPengguna) || $idPengguna === '0') {
    respons(401, false, 'Sesi tidak ditemukan. Silakan ulangi proses.');
}
$tujuan = 'Pemulihan';
$sessionKey = 'pemulihan_id_otp';
$pdo = null;
try {
    $secret = getenv('OTP_SECRET');
    if (!$secret || strlen($secret) < 32) throw new RuntimeException('OTP_SECRET belum dikonfigurasi.');
    // Gunakan koneksi PDO kelompok apabila tersedia, atau konfigurasi environment.
    $koneksi = __DIR__ . '/../../koneksi.php';
    if (is_file($koneksi)) require_once $koneksi;
    if (!($pdo instanceof PDO)) {
        $dbUser = getenv('DB_USER');
        $dbPassword = getenv('DB_PASSWORD');
        if ($dbUser === false || $dbPassword === false) throw new RuntimeException('Konfigurasi DB belum lengkap.');
        $pdo = new PDO('mysql:host=' . (getenv('DB_HOST') ?: 'localhost') . ';dbname=sipfas;charset=utf8mb4',
            $dbUser, $dbPassword);
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
    $pdo->beginTransaction();
    // Kunci akun untuk mencegah pengiriman bersamaan dan periksa peran/status.
    $q = $pdo->prepare('SELECT p.id_pengguna, p.id_peran, p.nama_lengkap, p.nama_pengguna,
        p.email, p.status_akun, r.nama_peran FROM pengguna p JOIN peran r ON r.id_peran = p.id_peran
        WHERE p.id_pengguna = ? FOR UPDATE');
    $q->execute([$idPengguna]);
    $user = $q->fetch(PDO::FETCH_ASSOC);
    if (!$user || strcasecmp(trim($user['status_akun']), 'Aktif') !== 0) {
        $pdo->rollBack();
        respons(403, false, 'Akun tidak tersedia atau tidak aktif.');
    }
    $q = $pdo->prepare('SELECT *, UNIX_TIMESTAMP(berlaku_sampai) AS expires_at,
        (berlaku_sampai > NOW()) AS masih_berlaku FROM otp_verifikasi
        WHERE id_pengguna = ? AND tujuan = ? ORDER BY id_otp DESC LIMIT 1 FOR UPDATE');
    $q->execute([$idPengguna, $tujuan]);
    $row = $q->fetch(PDO::FETCH_ASSOC);
    $owned = $row && (string) $row['id_otp'] === (string) ($_SESSION[$sessionKey] ?? '');
    $active = $row && (int) $row['masih_berlaku'] === 1 && $row['digunakan_pada'] === null;
    [$prefix, $domain] = explode('@', $user['email'], 2);
    $masked = substr($prefix, 0, 2) . '***@' . $domain;
    if ($action !== 'verify') {
        if ($active) {
            $pdo->rollBack();
            if (!$owned) respons(429, false, 'Tunggu hingga kode sebelumnya kedaluwarsa.');
            respons(200, true, 'Kode OTP masih berlaku.', [
                'expires_at' => (int) $row['expires_at'], 'masked_email' => $masked,
                'remaining_attempts' => $row['dibatalkan_pada'] !== null ? 0 : max(0, 3 - (int) $row['jumlah_percobaan'])
            ]);
        }
        // Batasi pengiriman per akun untuk menghindari spam.
        $q = $pdo->prepare('SELECT COUNT(*) FROM otp_verifikasi WHERE id_pengguna = ?
            AND tujuan = ? AND tanggal_dibuat >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)');
        $q->execute([$idPengguna, $tujuan]);
        if ((int) $q->fetchColumn() >= 5) {
            $pdo->rollBack();
            respons(429, false, 'Batas pengiriman tercapai. Coba lagi nanti.');
        }
        $otp = str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
        $q = $pdo->prepare('UPDATE otp_verifikasi SET dibatalkan_pada = NOW()
            WHERE id_pengguna = ? AND tujuan = ? AND digunakan_pada IS NULL AND dibatalkan_pada IS NULL');
        $q->execute([$idPengguna, $tujuan]);
        $q = $pdo->prepare('INSERT INTO otp_verifikasi (id_pengguna, tujuan, kode_hash, berlaku_sampai, jumlah_percobaan)
            VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 MINUTE), 0)');
        $q->execute([$idPengguna, $tujuan, hash_hmac('sha256', $otp, $secret)]);
        $idOtp = $pdo->lastInsertId();
        // PHPMailer sudah tersedia di vendor; SMTP dikonfigurasi di server.
        require_once __DIR__ . '/../../vendor/autoload.php';
        $host = getenv('SMTP_HOST');
        $from = getenv('SMTP_FROM');
        $smtpUser = getenv('SMTP_USER');
        $smtpPass = getenv('SMTP_PASSWORD');
        if (!$host || !$from || !$smtpUser || !$smtpPass) throw new RuntimeException('SMTP belum dikonfigurasi.');
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $host;
        $mail->SMTPAuth = true;
        $mail->Username = $smtpUser;
        $mail->Password = $smtpPass;
        $mail->Port = (int) (getenv('SMTP_PORT') ?: 587);
        $mail->SMTPSecure = $mail->Port === 465 ? 'ssl' : 'tls';
        $mail->Timeout = 10;
        $mail->CharSet = 'UTF-8';
        $mail->setFrom($from, 'SIPFAS');
        $mail->addAddress($user['email']);
        $mail->Subject = 'Kode OTP SIPFAS';
        $mail->Body = "Kode OTP Anda: $otp. Berlaku 2 menit. Jangan berikan kode ini kepada siapa pun.";
        $mail->send();
        $q = $pdo->prepare('SELECT UNIX_TIMESTAMP(berlaku_sampai) FROM otp_verifikasi WHERE id_otp = ?');
        $q->execute([$idOtp]);
        $expiry = (int) $q->fetchColumn();
        $pdo->commit();
        $_SESSION[$sessionKey] = (string) $idOtp;
        respons(200, true, 'Kode OTP dikirim ke email.', [
            'expires_at' => $expiry, 'masked_email' => $masked, 'remaining_attempts' => 3
        ]);
    }

    if (!$owned || !$row || $row['digunakan_pada'] !== null) {
        $pdo->rollBack();
        respons(409, false, 'Kode OTP tidak tersedia.');
    }
    if (!$active) {
        $pdo->rollBack();
        respons(410, false, 'Kode OTP kedaluwarsa.');
    }
    $attempts = (int) $row['jumlah_percobaan'];
    if ($attempts >= 3 || $row['dibatalkan_pada'] !== null) {
        $pdo->rollBack();
        respons(429, false, 'Batas percobaan tercapai.', ['remaining_attempts' => 0]);
    }
    if (!hash_equals($row['kode_hash'], hash_hmac('sha256', $data['otp'], $secret))) {
        $attempts++;
        $sql = 'UPDATE otp_verifikasi SET jumlah_percobaan = ?' . ($attempts === 3 ? ', dibatalkan_pada = NOW()' : '') . ' WHERE id_otp = ?';
        $pdo->prepare($sql)->execute([$attempts, $row['id_otp']]);
        $pdo->commit();
        respons($attempts === 3 ? 429 : 422, false, 'Kode OTP salah. Percobaan ' . $attempts . '/3.',
            ['remaining_attempts' => 3 - $attempts]);
    }
    $redirect = 'password-baru.html';
    $q = $pdo->prepare('UPDATE otp_verifikasi SET digunakan_pada = NOW() WHERE id_otp = ?
        AND digunakan_pada IS NULL AND dibatalkan_pada IS NULL AND berlaku_sampai > NOW()');
    $q->execute([$row['id_otp']]);
    if ($q->rowCount() !== 1) {
        $pdo->rollBack();
        respons(410, false, 'Kode OTP tidak berlaku lagi.');
    }
    $pdo->commit();
    if (!session_regenerate_id(true)) respons(500, false, 'Sesi gagal dibuat.');
    unset($_SESSION[$sessionKey]);
    $_SESSION['pemulihan_terverifikasi'] = true;
    $_SESSION['pemulihan_reset_berlaku_sampai'] = time() + 600;
    unset($_SESSION['pemulihan_pending_expires']);
    respons(200, true, 'Verifikasi berhasil!', ['redirect' => $redirect]);
} catch (Throwable $e) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    error_log('SIPFAS OTP: ' . get_class($e));
    respons(500, false, 'Terjadi kesalahan server. Periksa konfigurasi database dan SMTP.');
}
