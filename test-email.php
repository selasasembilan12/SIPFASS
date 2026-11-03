
<?php
/**
 * TEST SMTP SIPFAS
 * Tujuan: Menguji apakah Gmail dapat mengirim email
 * melalui PHPMailer tanpa membutuhkan database.
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Memanggil library PHPMailer dari Composer
require __DIR__ . '/vendor/autoload.php';

// Membaca konfigurasi email
$config = require __DIR__ . '/config/mail.php';

$mail = new PHPMailer(true);

try {

    // Mengaktifkan SMTP
    $mail->isSMTP();
    $mail->Host       = $config['host'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $config['username'];
    $mail->Password   = $config['password'];
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = $config['port'];

    // Pengaturan identitas pengirim
    $mail->setFrom(
        $config['from_email'],
        $config['from_name']
    );

    // GANTI dengan alamat email penerima untuk pengujian
    $mail->addAddress('putryazzahra120@gmail.com');

    // Isi email pengujian
    $mail->isHTML(true);
    $mail->CharSet = 'UTF-8';
    $mail->Subject = 'Pengujian Email SIPFAS';

    $mail->Body = '
        <h2>YAYYYYYYYYYYYY BERHASIL!</h2>
    ';

    $mail->AltBody = 'Email pengujian dari SIPFAS berhasil dikirim.';

    // Mengirim email
    $mail->send();

    echo "BERHASIL! Email SIPFAS berhasil dikirim.";

} catch (Exception $e) {

    echo "GAGAL mengirim email.<br>";
    echo "Pesan: " . htmlspecialchars($mail->ErrorInfo);
}
