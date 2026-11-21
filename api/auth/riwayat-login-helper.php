<?php
declare(strict_types=1);


function catatRiwayatLogin(PDO $pdo, array $user): bool
{
    try {
        // ----------------------------------------------------
        // 01. Mengambil identitas pengguna.
        // ----------------------------------------------------

        $idPengguna = (int) ($user['id_pengguna'] ?? 0);

        $identitasLogin = trim(
            (string) (
                $user['nama_pengguna']
                ?? $user['email']
                ?? $user['nama_lengkap']
                ?? ''
            )
        );

        // Memastikan identitas pengguna tersedia.
        if ($idPengguna <= 0 || $identitasLogin === '') {
            throw new InvalidArgumentException(
                'Identitas pengguna untuk riwayat login tidak valid.'
            );
        }

        // ----------------------------------------------------
        // 02. Menyiapkan query penyimpanan.
        // ----------------------------------------------------

        $sql = "
            INSERT INTO riwayat_login (
                id_pengguna,
                identitas_login,
                aktivitas,
                status,
                waktu_aktivitas
            ) VALUES (
                :id_pengguna,
                :identitas_login,
                :aktivitas,
                :status,
                NOW()
            )
        ";

        // ----------------------------------------------------
        // 03. Menjalankan penyimpanan ke database.
        // ----------------------------------------------------

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            ':id_pengguna' => $idPengguna,
            ':identitas_login' => $identitasLogin,
            ':aktivitas' => 'Login',
            ':status' => 'Berhasil'
        ]);

        // Memastikan satu baris berhasil ditambahkan.
        return $stmt->rowCount() === 1;

    } catch (Throwable $e) {

        // Mencatat kesalahan ke log PHP.
        error_log(
            '[SIPFAS RIWAYAT LOGIN ERROR] ' .
            $e->getMessage()
        );

        return false;
    }
}
