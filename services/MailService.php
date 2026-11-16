
<?php

/**
 * =========================================================
 * SIPFAS - MAIL SERVICE
 * =========================================================
 *
 * Fungsi:
 * 1. Menggunakan PHPMailer.
 * 2. Mengambil konfigurasi SMTP Gmail.
 * 3. Mengirim OTP login.
 * 4. Mengirim OTP pemulihan password.
 *
 * =========================================================
 */

// Memanggil library PHPMailer.
require_once dirname(__DIR__) . '/vendor/autoload.php';

// Menggunakan class PHPMailer.
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;


class MailService
{
    /**
     * Mengirim OTP kepada pengguna.
     */

    public static function sendOtp(
        string $email,
        string $otp,
        string $purpose
    ): bool {

        // Membaca konfigurasi email SIPFAS.
        $config = require dirname(__DIR__) . '/config/mail.php';

        // Membuat objek PHPMailer.
        $mail = new PHPMailer(true);

        try {

            // Konfigurasi SMTP Gmail.
            $mail->isSMTP();
            $mail->Host = $config['host'];
            $mail->SMTPAuth = true;
            $mail->Username = $config['username'];
            $mail->Password = $config['password'];

            // Mengatur enkripsi dan port SMTP.
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = $config['port'];

            // Mengatur karakter email.
            $mail->CharSet = 'UTF-8';

            // Identitas pengirim.
            $mail->setFrom(
                $config['from_email'],
                $config['from_name']
            );

            // Alamat email penerima.
            $mail->addAddress($email);

            // Menentukan tujuan OTP.
            $purposeText = match ($purpose) {
                'Login' => 'verifikasi login dua langkah',
                'Pemulihan' => 'pemulihan kata sandi',
                'VerifikasiEmail' => 'verifikasi alamat email',
                default => 'verifikasi akun'
            };

            // Mengatur email menjadi HTML.
            $mail->isHTML(true);

            $mail->Subject = 'Kode Verifikasi SIPFAS';

            // Membuat isi email.
            $mail->Body = '
                <div style="
                    font-family: Arial, sans-serif;
                    max-width: 500px;
                    margin: auto;
                    padding: 25px;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                ">

                    <h2 style="color: #2563eb;">SIPFAS</h2>

                    <p>Halo,</p>

                    <p>
                        Gunakan kode berikut untuk
                        ' . htmlspecialchars($purposeText) . '.
                    </p>

                    <div style="
                        background: #eff6ff;
                        padding: 20px;
                        text-align: center;
                        border-radius: 8px;
                    ">

                        <h1 style="
                            letter-spacing: 8px;
                            color: #2563eb;
                        ">
                            ' . htmlspecialchars($otp) . '
                        </h1>

                    </div>

                    <p>
                        Kode berlaku selama
                        <strong>2 menit</strong>.
                    </p>

                    <p>
                        Maksimal percobaan:
                        <strong>3 kali</strong>.
                    </p>

                    <p>
                        Jangan berikan kode ini kepada siapa pun.
                    </p>

                    <hr>

                    <small>
                        Email otomatis dari SIPFAS.
                    </small>

                </div>
            ';

            // Versi teks biasa.
            $mail->AltBody =
                "Kode OTP SIPFAS: {$otp}. Berlaku selama 2 menit.";

            // Mengirim email.
            $mail->send();

            return true;

        } catch (Exception $e) {

            // Mencatat kesalahan tanpa menampilkan
            // informasi sensitif kepada pengguna.
            error_log(
                'SIPFAS Mail Error: ' . $mail->ErrorInfo
            );

            return false;
        }
    }
}
