//DASHBOARD.PHP
<?php

// Memuat konfigurasi sistem dan koneksi database
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/config/koneksi.php';

// Mengatur header respons JSON dan zona waktu WIT
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
date_default_timezone_set('Asia/Jayapura');

try {
    // Mengambil seluruh laporan beserta data pelapor, fasilitas, verifikasi, dan penanganan terbaru
    $stmt = $pdo->query("
        SELECT
            lk.*,
            u.nama_lengkap AS nama_pelapor,
            u.nomor_identitas AS nomor_identitas,
            f.nama_fasilitas,
            f.lokasi_ruangan,
            f.frekuensi_penggunaan,
            rv.id_riwayat_verifikasi,
            rv.hasil_verifikasi,
            rv.x1_sebelum,
            rv.x1_sesudah,
            rv.x2_sebelum,
            rv.x2_sesudah,
            rv.x3_digunakan,
            rv.prioritas_sebelum,
            rv.prioritas_sesudah,
            rv.catatan_verifikasi,
            rv.waktu_verifikasi,
            rp.id_riwayat_penanganan,
            rp.tindak_lanjut_perbaikan,
            rp.catatan_petugas,
            rp.waktu_mulai_penanganan,
            rp.waktu_selesai_penanganan,
            rp.waktu_pembaruan
        FROM laporan_kerusakan lk
        LEFT JOIN pengguna u ON lk.id_pelapor = u.id_pengguna
        LEFT JOIN fasilitas f ON lk.id_fasilitas = f.id_fasilitas
        LEFT JOIN riwayat_verifikasi_laporan rv ON rv.id_riwayat_verifikasi = (
            SELECT MAX(id_riwayat_verifikasi)
            FROM riwayat_verifikasi_laporan
            WHERE id_laporan = lk.id_laporan
        )
        LEFT JOIN riwayat_penanganan rp ON rp.id_riwayat_penanganan = (
            SELECT MAX(id_riwayat_penanganan)
            FROM riwayat_penanganan
            WHERE id_laporan = lk.id_laporan
        )
        ORDER BY lk.id_laporan DESC
    ");

    $laporan = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'message' => 'Data dashboard berhasil dimuat.',
        'data'    => $laporan,
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
} catch (Throwable $e) {
    error_log('[SIPFAS DASHBOARD ERROR] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Gagal memuat data dashboard: ' . $e->getMessage(),
        'data'    => [],
    ], JSON_UNESCAPED_UNICODE);
}