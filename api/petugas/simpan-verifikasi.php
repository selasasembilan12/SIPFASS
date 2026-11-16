//SIMPAN-VERIFIKASI.PHP
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

// Membaca input JSON dari request body
$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '{}', true);
if (!is_array($input) || empty($input)) {
    $input = $_POST;
}

$kode = trim((string)($input['kode_laporan'] ?? $input['reportCode'] ?? ''));
if ($kode === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Kode laporan wajib diisi.'], JSON_UNESCAPED_UNICODE);
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

    // Mengambil ID verifikator dari session atau fallback ke Petugas Sarpras pertama
    $idVerifikator = (int)($_SESSION['id_pengguna'] ?? $_SESSION['user']['id_pengguna'] ?? 0);
    if ($idVerifikator <= 0) {
        $idVerifikator = (int)($pdo->query("
            SELECT u.id_pengguna
            FROM pengguna u
            JOIN peran p ON p.id_peran = u.id_peran
            WHERE p.nama_peran IN ('Petugas Sarpras', 'Administrator')
            ORDER BY u.id_pengguna ASC
            LIMIT 1
        ")->fetchColumn() ?: 1);
    }

    // Mengambil ID model C4.5 yang aktif untuk memenuhi relasi Foreign Key
    $idPelatihan = (int)($pdo->query("
        SELECT id_pelatihan
        FROM riwayat_pelatihan_c45
        ORDER BY (status_model = 'Aktif') DESC, id_pelatihan DESC
        LIMIT 1
    ")->fetchColumn() ?: 1);

    // Konversi parameter X1, X2, X3 ke nilai numerik TINYINT
    $mapX1 = ['ringan' => 1, 'sedang' => 2, 'berat' => 3];
    $mapX2 = ['rendah' => 1, 'sedang' => 2, 'tinggi' => 3];
    $mapX3 = ['jarang' => 1, 'kadang' => 4, 'sering' => 7];

    $x1Sesudah = isset($input['x1_sesudah'])
        ? (int)$input['x1_sesudah']
        : ($mapX1[strtolower((string)($input['x1'] ?? ''))] ?? 1);

    $x2Sesudah = isset($input['x2_sesudah'])
        ? (int)$input['x2_sesudah']
        : ($mapX2[strtolower((string)($input['x2'] ?? ''))] ?? 1);

    $x3Used = isset($input['x3_digunakan'])
        ? (int)$input['x3_digunakan']
        : ($mapX3[strtolower((string)($input['x3'] ?? ''))] ?? (int)($laporan['frekuensi_penggunaan_x3'] ?? 1));

    $x1Sebelum = (int)($laporan['tingkat_kerusakan_x1'] ?? $x1Sesudah);
    $x2Sebelum = (int)($laporan['dampak_akademik_x2'] ?? $x2Sesudah);

    $prioritasSebelum = (string)($laporan['label_prioritas'] ?? $laporan['prioritas'] ?? 'Rendah');
    $prioritasRaw     = (string)($input['prioritas_sesudah'] ?? $input['priority'] ?? 'Rendah');
    $prioritasSesudah = ucfirst(strtolower(trim($prioritasRaw)));

    $decisionRaw   = strtolower(trim((string)($input['hasil_verifikasi'] ?? $input['decision'] ?? '')));
    $hasilVerif    = ($decisionRaw === 'valid') ? 'Valid' : 'Tidak Valid';
    $catatan       = trim((string)($input['catatan_verifikasi'] ?? $input['notes'] ?? ''));
    $waktuVerifSql = date('Y-m-d H:i:s');

    // Memulai transaksi database
    $pdo->beginTransaction();

    // Menyimpan riwayat verifikasi ke riwayat_verifikasi_laporan
    $ins = $pdo->prepare("
        INSERT INTO riwayat_verifikasi_laporan (
            id_laporan,
            id_verifikator,
            hasil_verifikasi,
            x1_sebelum,
            x1_sesudah,
            x2_sebelum,
            x2_sesudah,
            x3_digunakan,
            prioritas_sebelum,
            prioritas_sesudah,
            id_pelatihan_sebelum,
            id_pelatihan_sesudah,
            catatan_verifikasi,
            waktu_verifikasi
        ) VALUES (
            :id_laporan,
            :id_verifikator,
            :hasil_verifikasi,
            :x1_sebelum,
            :x1_sesudah,
            :x2_sebelum,
            :x2_sesudah,
            :x3_digunakan,
            :prioritas_sebelum,
            :prioritas_sesudah,
            :id_pelatihan_sebelum,
            :id_pelatihan_sesudah,
            :catatan_verifikasi,
            :waktu_verifikasi
        )
    ");

    $ins->execute([
        ':id_laporan'           => $idLaporan,
        ':id_verifikator'       => $idVerifikator,
        ':hasil_verifikasi'     => $hasilVerif,
        ':x1_sebelum'           => $x1Sebelum,
        ':x1_sesudah'           => $x1Sesudah,
        ':x2_sebelum'           => $x2Sebelum,
        ':x2_sesudah'           => $x2Sesudah,
        ':x3_digunakan'         => $x3Used,
        ':prioritas_sebelum'    => $prioritasSebelum,
        ':prioritas_sesudah'    => $prioritasSesudah,
        ':id_pelatihan_sebelum' => $idPelatihan,
        ':id_pelatihan_sesudah' => $idPelatihan,
        ':catatan_verifikasi'   => $catatan !== '' ? $catatan : null,
        ':waktu_verifikasi'     => $waktuVerifSql,
    ]);

    // Memperbarui status dan prioritas pada laporan_kerusakan
    $statusLama = (string)($laporan['status_laporan'] ?? $laporan['status'] ?? 'Menunggu Verifikasi');
    $statusBaru = ($hasilVerif === 'Valid') ? 'Terverifikasi' : 'Tidak Valid';

    $updates = [];
    $params  = [':id' => $idLaporan];

    if (in_array('status_laporan', $cols, true)) {
        $updates[] = "status_laporan = :status_baru";
        $params[':status_baru'] = $statusBaru;
    } elseif (in_array('status', $cols, true)) {
        $updates[] = "status = :status_baru";
        $params[':status_baru'] = $statusBaru;
    }

    if (in_array('prioritas', $cols, true)) {
        $updates[] = "prioritas = :prioritas_baru";
        $params[':prioritas_baru'] = $prioritasSesudah;
    } elseif (in_array('label_prioritas', $cols, true)) {
        $updates[] = "label_prioritas = :prioritas_baru";
        $params[':prioritas_baru'] = $prioritasSesudah;
    }

    if ($updates) {
        $pdo->prepare("UPDATE laporan_kerusakan SET " . implode(', ', $updates) . " WHERE id_laporan = :id")
            ->execute($params);
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
            'Verifikasi',
            :status_sebelumnya,
            :status_baru,
            :catatan
        )
    ")->execute([
        ':id_laporan'        => $idLaporan,
        ':id_pengguna'       => $idVerifikator,
        ':status_sebelumnya' => $statusLama,
        ':status_baru'       => $statusBaru,
        ':catatan'           => $catatan !== '' ? $catatan : null,
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Verifikasi berhasil disimpan ke database.',
        'data'    => [
            'kode_laporan'      => $kode,
            'hasil_verifikasi'  => $hasilVerif,
            'prioritas_sesudah' => $prioritasSesudah,
            'status_laporan'    => $statusBaru,
            'waktu_verifikasi'  => date(DATE_ATOM, strtotime($waktuVerifSql)),
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[SIPFAS SIMPAN VERIFIKASI ERROR] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Gagal menyimpan verifikasi: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}