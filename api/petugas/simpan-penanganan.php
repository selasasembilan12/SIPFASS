//SIMPAN-PENANGANAN.PHP
<?php

// Memuat konfigurasi sistem dan koneksi database
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/config/koneksi.php';

// Mengatur header respons JSON dan zona waktu WIT
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
date_default_timezone_set('Asia/Jayapura');

// Memastikan metode request adalah POST
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metode request harus POST.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Membaca dan memvalidasi input JSON
$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '{}', true);
if (!is_array($input) || empty($input)) {
    $input = $_POST;
}

$kode         = trim((string)($input['kode_laporan'] ?? $input['reportCode'] ?? ''));
$tindakLanjut = trim((string)($input['tindak_lanjut_perbaikan'] ?? $input['followUp'] ?? ''));
$statusBaru   = trim((string)($input['status_penanganan'] ?? $input['status'] ?? ''));
$catatan      = trim((string)($input['catatan_petugas'] ?? $input['officerNotes'] ?? ''));

if ($kode === '' || $tindakLanjut === '' || $statusBaru === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Kode laporan, tindak lanjut, dan status wajib diisi.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // Mencari data laporan target di database
    $cols = $pdo->query("SHOW COLUMNS FROM laporan_kerusakan")->fetchAll(PDO::FETCH_COLUMN);
    $codeCol = in_array('kode_laporan', $cols, true)
        ? 'kode_laporan'
        : (in_array('nomor_laporan', $cols, true) ? 'nomor_laporan' : 'id_laporan');

    $stmt = $pdo->prepare("SELECT * FROM laporan_kerusakan WHERE {$codeCol} = :kode OR id_laporan = :id_num LIMIT 1");
    $stmt->execute([
        ':kode'   => $kode,
        ':id_num' => ctype_digit($kode) ? (int)$kode : 0,
    ]);
    $laporan = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$laporan) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => "Laporan {$kode} tidak ditemukan."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $idLaporan = (int)$laporan['id_laporan'];

    // Mengambil ID petugas dari session atau fallback ke Petugas Sarpras pertama
    $idPetugas = (int)($_SESSION['id_pengguna'] ?? $_SESSION['user']['id_pengguna'] ?? 0);
    if ($idPetugas <= 0) {
        $idPetugas = (int)($pdo->query("
            SELECT u.id_pengguna
            FROM pengguna u
            JOIN peran p ON p.id_peran = u.id_peran
            WHERE p.nama_peran IN ('Petugas Sarpras', 'Administrator')
            ORDER BY u.id_pengguna ASC
            LIMIT 1
        ")->fetchColumn() ?: 1);
    }

    // Mempertahankan waktu_mulai_penanganan dari riwayat sebelumnya jika sudah ada
    $prevStmt = $pdo->prepare("
        SELECT waktu_mulai_penanganan, waktu_selesai_penanganan
        FROM riwayat_penanganan
        WHERE id_laporan = :id
        ORDER BY id_riwayat_penanganan DESC
        LIMIT 1
    ");
    $prevStmt->execute([':id' => $idLaporan]);
    $prev = $prevStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $nowSql      = date('Y-m-d H:i:s');
    $startedAt   = $prev['waktu_mulai_penanganan'] ?? null;
    $completedAt = $prev['waktu_selesai_penanganan'] ?? null;

    if (!$startedAt && in_array($statusBaru, ['Diproses', 'Selesai'], true)) {
        $startedAt = $nowSql;
    }

    if ($statusBaru === 'Selesai') {
        if (!$completedAt) {
            $completedAt = $nowSql;
        }
    } else {
        $completedAt = null;
    }

    // Memulai transaksi penyimpanan
    $pdo->beginTransaction();

    // Menyimpan tindak lanjut perbaikan ke riwayat_penanganan
    $ins = $pdo->prepare("
        INSERT INTO riwayat_penanganan (
            id_laporan,
            id_petugas,
            tindak_lanjut_perbaikan,
            catatan_petugas,
            waktu_mulai_penanganan,
            waktu_selesai_penanganan,
            waktu_pembaruan
        ) VALUES (
            :id_laporan,
            :id_petugas,
            :tindak_lanjut,
            :catatan,
            :mulai,
            :selesai,
            :pembaruan
        )
    ");

    $ins->execute([
        ':id_laporan'    => $idLaporan,
        ':id_petugas'    => $idPetugas,
        ':tindak_lanjut' => $tindakLanjut,
        ':catatan'       => $catatan !== '' ? $catatan : null,
        ':mulai'         => $startedAt,
        ':selesai'       => $completedAt,
        ':pembaruan'     => $nowSql,
    ]);

    // Memperbarui status terbaru pada laporan_kerusakan
    $statusLama = (string)($laporan['status_laporan'] ?? $laporan['status'] ?? 'Terverifikasi');

    if (in_array('status_laporan', $cols, true)) {
        $pdo->prepare("UPDATE laporan_kerusakan SET status_laporan = :st WHERE id_laporan = :id")
            ->execute([':st' => $statusBaru, ':id' => $idLaporan]);
    } elseif (in_array('status', $cols, true)) {
        $pdo->prepare("UPDATE laporan_kerusakan SET status = :st WHERE id_laporan = :id")
            ->execute([':st' => $statusBaru, ':id' => $idLaporan]);
    }

    // Mencatat log perubahan status ke riwayat_status_laporan
    $pdo->prepare("
        INSERT INTO riwayat_status_laporan (
            id_laporan,
            id_pengguna,
            jenis_status,
            status_sebelumnya,
            status_baru,
            catatan
        ) VALUES (
            :id_laporan,
            :id_pengguna,
            'Penanganan',
            :status_sebelumnya,
            :status_baru,
            :catatan
        )
    ")->execute([
        ':id_laporan'        => $idLaporan,
        ':id_pengguna'       => $idPetugas,
        ':status_sebelumnya' => $statusLama,
        ':status_baru'       => $statusBaru,
        ':catatan'           => $catatan !== '' ? $catatan : null,
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Data penanganan berhasil disimpan ke database.',
        'data'    => [
            'kode_laporan'             => $kode,
            'status_penanganan'        => $statusBaru,
            'waktu_mulai_penanganan'   => $startedAt ? date(DATE_ATOM, strtotime($startedAt)) : null,
            'waktu_selesai_penanganan' => $completedAt ? date(DATE_ATOM, strtotime($completedAt)) : null,
            'waktu_pembaruan'          => date(DATE_ATOM, strtotime($nowSql)),
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[SIPFAS SIMPAN PENANGANAN ERROR] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Gagal menyimpan penanganan: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}