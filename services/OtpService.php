
<?php

/**
 * =========================================================
 * SIPFAS - OTP SERVICE
 * =========================================================
 *
 * Fungsi:
 * 1. Membuat OTP enam digit.
 * 2. Menyimpan OTP dalam database.
 * 3. Membatasi masa berlaku selama 2 menit.
 * 4. Membatasi percobaan maksimal 3 kali.
 * 5. Memvalidasi kode OTP.
 * 6. Membatalkan OTP yang sudah digunakan.
 * 7. Membatalkan OTP lama ketika OTP baru dibuat.
 *
 * =========================================================
 */


class OtpService
{
    // Masa berlaku OTP dalam detik.
    private const OTP_EXPIRY = 120;

    // Maksimal percobaan memasukkan OTP.
    private const MAX_ATTEMPTS = 3;


    // =====================================================
    // 1. MEMBUAT DAN MENYIMPAN OTP
    // =====================================================

    public static function create(
        PDO $pdo,
        int $userId,
        string $purpose
    ): string {

        // Memastikan tujuan OTP valid.
        self::validatePurpose($purpose);

        // Membuat kode OTP enam digit.
        $otp = (string) random_int(100000, 999999);

        // Mengamankan OTP menggunakan password_hash.
        $otpHash = password_hash(
            $otp,
            PASSWORD_DEFAULT
        );

        // Menghitung waktu kedaluwarsa.
        $expiredAt = date(
            'Y-m-d H:i:s',
            time() + self::OTP_EXPIRY
        );

        try {

            // Memulai transaksi database.
            $pdo->beginTransaction();

            // Membatalkan OTP lama yang belum digunakan.
            $cancel = $pdo->prepare("
                UPDATE otp_verifikasi
                SET dibatalkan_pada = NOW()
                WHERE id_pengguna = :id_pengguna
                AND tujuan = :tujuan
                AND digunakan_pada IS NULL
                AND dibatalkan_pada IS NULL
            ");

            $cancel->execute([
                ':id_pengguna' => $userId,
                ':tujuan' => $purpose
            ]);

            // Menyimpan OTP baru.
            $insert = $pdo->prepare("
                INSERT INTO otp_verifikasi (
                    id_pengguna,
                    tujuan,
                    kode_hash,
                    berlaku_sampai,
                    jumlah_percobaan
                )
                VALUES (
                    :id_pengguna,
                    :tujuan,
                    :kode_hash,
                    :berlaku_sampai,
                    0
                )
            ");

            $insert->execute([
                ':id_pengguna' => $userId,
                ':tujuan' => $purpose,
                ':kode_hash' => $otpHash,
                ':berlaku_sampai' => $expiredAt
            ]);

            // Menyimpan perubahan database.
            $pdo->commit();

            // Mengembalikan kode OTP untuk dikirim melalui email.
            return $otp;

        } catch (Throwable $e) {

            // Membatalkan transaksi jika terjadi kesalahan.
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }


    // =====================================================
    // 2. MEMVALIDASI OTP
    // =====================================================

    public static function verify(
        PDO $pdo,
        int $userId,
        string $purpose,
        string $otp
    ): bool {

        // Memastikan tujuan OTP valid.
        self::validatePurpose($purpose);

        // Memastikan format OTP terdiri dari enam angka.
        if (!preg_match('/^[0-9]{6}$/', $otp)) {
            return false;
        }

        try {

            // Memulai transaksi database.
            $pdo->beginTransaction();

            // Mengambil OTP terbaru yang masih aktif.
            $query = $pdo->prepare("
                SELECT *
                FROM otp_verifikasi
                WHERE id_pengguna = :id_pengguna
                AND tujuan = :tujuan
                AND digunakan_pada IS NULL
                AND dibatalkan_pada IS NULL
                AND berlaku_sampai > NOW()
                AND jumlah_percobaan < :maksimal
                ORDER BY id_otp DESC
                LIMIT 1
                FOR UPDATE
            ");

            $query->execute([
                ':id_pengguna' => $userId,
                ':tujuan' => $purpose,
                ':maksimal' => self::MAX_ATTEMPTS
            ]);

            $record = $query->fetch(PDO::FETCH_ASSOC);

            // Jika OTP tidak ditemukan atau sudah kedaluwarsa.
            if (!$record) {
                $pdo->commit();
                return false;
            }

            // Memeriksa kecocokan kode OTP.
            $isValid = password_verify(
                $otp,
                $record['kode_hash']
            );

            // Jika OTP salah.
            if (!$isValid) {

                // Menambah jumlah percobaan.
                $attempts = (int) $record['jumlah_percobaan'] + 1;

                // Jika sudah mencapai tiga kali,
                // OTP otomatis dibatalkan.
                $cancelledAt = (
                    $attempts >= self::MAX_ATTEMPTS
                ) ? date('Y-m-d H:i:s') : null;

                // Memperbarui jumlah percobaan.
                $update = $pdo->prepare("
                    UPDATE otp_verifikasi
                    SET
                        jumlah_percobaan = :jumlah,
                        dibatalkan_pada = :dibatalkan
                    WHERE id_otp = :id_otp
                ");

                $update->execute([
                    ':jumlah' => $attempts,
                    ':dibatalkan' => $cancelledAt,
                    ':id_otp' => $record['id_otp']
                ]);

                $pdo->commit();

                return false;
            }

            // Jika OTP benar, tandai sebagai sudah digunakan.
            $update = $pdo->prepare("
                UPDATE otp_verifikasi
                SET digunakan_pada = NOW()
                WHERE id_otp = :id_otp
            ");

            $update->execute([
                ':id_otp' => $record['id_otp']
            ]);

            // Menyimpan perubahan.
            $pdo->commit();

            return true;

        } catch (Throwable $e) {

            // Membatalkan transaksi jika terjadi kesalahan.
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }


    // =====================================================
    // 3. MEMBATALKAN OTP AKTIF
    // =====================================================

    public static function cancel(
        PDO $pdo,
        int $userId,
        string $purpose
    ): void {

        self::validatePurpose($purpose);

        $query = $pdo->prepare("
            UPDATE otp_verifikasi
            SET dibatalkan_pada = NOW()
            WHERE id_pengguna = :id_pengguna
            AND tujuan = :tujuan
            AND digunakan_pada IS NULL
            AND dibatalkan_pada IS NULL
        ");

        $query->execute([
            ':id_pengguna' => $userId,
            ':tujuan' => $purpose
        ]);
    }


    // =====================================================
    // 4. MEMVALIDASI TUJUAN OTP
    // =====================================================

    private static function validatePurpose(
        string $purpose
    ): void {

        // Daftar tujuan OTP yang diperbolehkan.
        $allowed = [
            'Login',
            'Pemulihan',
            'VerifikasiEmail'
        ];

        // Menolak tujuan yang tidak dikenal.
        if (!in_array($purpose, $allowed, true)) {
            throw new InvalidArgumentException(
                'Tujuan OTP tidak valid.'
            );
        }
    }
}
