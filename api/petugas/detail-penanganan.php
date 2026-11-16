//DETAIL-PENANGANAN.PHP
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

    // Mengambil detail laporan dan riwayat penanganan terakhirnya
    $stmt = $pdo->prepare("
        SELECT
            lk.*,
            u.nama_lengkap AS nama_pelapor,
            u.nomor_identitas,
            f.nama_fasilitas,
            f.lokasi_ruangan,
            rp.id_riwayat_penanganan,
            rp.tindak_lanjut_perbaikan,
            rp.catatan_petugas,
            rp.waktu_mulai_penanganan,
            rp.waktu_selesai_penanganan,
            rp.waktu_pembaruan
        FROM laporan_kerusakan lk
        LEFT JOIN pengguna u ON lk.id_pelapor = u.id_pengguna
        LEFT JOIN fasilitas f ON lk.id_fasilitas = f.id_fasilitas
        LEFT JOIN riwayat_penanganan rp ON rp.id_riwayat_penanganan = (
            SELECT MAX(id_riwayat_penanganan)
            FROM riwayat_penanganan
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
        'message' => 'Detail penanganan berhasil dimuat.',
        'data'    => $row,
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
} catch (Throwable $e) {
    error_log('[SIPFAS DETAIL PENANGANAN ERROR] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Gagal memuat detail penanganan: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}