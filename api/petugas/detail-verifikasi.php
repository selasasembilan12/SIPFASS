//DETAIL-VERIFIKASI.PHP
<?php

// Memuat konfigurasi sistem dan koneksi database
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/config/koneksi.php';

// Mengatur header respons JSON dan zona waktu WIT
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
date_default_timezone_set('Asia/Jayapura');

// Validasi parameter kode laporan dari URL
$kode = trim((string)($_GET['kode'] ?? ''));
if ($kode === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Kode laporan wajib diisi.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // Mendeteksi nama kolom kode laporan pada tabel laporan_kerusakan
    $cols = $pdo->query("SHOW COLUMNS FROM laporan_kerusakan")->fetchAll(PDO::FETCH_COLUMN);
    $codeCol = in_array('kode_laporan', $cols, true)
        ? 'kode_laporan'
        : (in_array('nomor_laporan', $cols, true) ? 'nomor_laporan' : 'id_laporan');

    // Mengambil detail satu laporan dan hasil verifikasi terakhirnya
    $stmt = $pdo->prepare("
        SELECT
            lk.*,
            u.nama_lengkap AS nama_pelapor,
            u.nomor_identitas,
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
            rv.waktu_verifikasi
        FROM laporan_kerusakan lk
        LEFT JOIN pengguna u ON lk.id_pelapor = u.id_pengguna
        LEFT JOIN fasilitas f ON lk.id_fasilitas = f.id_fasilitas
        LEFT JOIN riwayat_verifikasi_laporan rv ON rv.id_riwayat_verifikasi = (
            SELECT MAX(id_riwayat_verifikasi)
            FROM riwayat_verifikasi_laporan
            WHERE id_laporan = lk.id_laporan
        )
        WHERE lk.{$codeCol} = :kode OR lk.id_laporan = :id_num
        LIMIT 1
    ");

    $stmt->execute([
        ':kode'   => $kode,
        ':id_num' => ctype_digit($kode) ? (int)$kode : 0,
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => "Laporan {$kode} tidak ditemukan."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Detail verifikasi berhasil dimuat.',
        'data'    => $row,
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
} catch (Throwable $e) {
    error_log('[SIPFAS DETAIL VERIFIKASI ERROR] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Gagal memuat detail verifikasi: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}