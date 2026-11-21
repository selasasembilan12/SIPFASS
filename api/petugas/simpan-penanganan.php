<?php
declare(strict_types=1);
//revisi akhir
// Memuat konfigurasi session dan koneksi database.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(__DIR__, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

// Mengatur respons JSON.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

date_default_timezone_set('Asia/Jayapura');

// Mengirim respons JSON.
function simpanPenangananResponse(
    int $status,
    bool $success,
    string $message,
    ?array $data = null
): never {
    http_response_code($status);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

try {

    // 01. Memastikan metode request POST.
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: POST');

        simpanPenangananResponse(
            405,
            false,
            'Metode permintaan tidak diizinkan.'
        );
    }

    // 02. Memeriksa session petugas.
    $userId = (int) (
        $_SESSION['id_pengguna']
        ?? $_SESSION['user']['id_pengguna']
        ?? $_SESSION['sipfas_user']['id_pengguna']
        ?? 0
    );

    if (
        $userId <= 0 ||
        ($_SESSION['login_terverifikasi'] ?? false) !== true
    ) {
        simpanPenangananResponse(
            401,
            false,
            'Sesi login tidak ditemukan. Silakan login kembali.'
        );
    }

    // 03. Memeriksa identitas dan hak akses petugas.
    $userStmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.status_akun,
            p.nama_peran
        FROM pengguna u
        INNER JOIN peran p
            ON p.id_peran = u.id_peran
        WHERE u.id_pengguna = :id
        LIMIT 1
    ");

    $userStmt->execute([
        ':id' => $userId
    ]);

    $user = $userStmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        simpanPenangananResponse(
            401,
            false,
            'Identitas petugas tidak ditemukan.'
        );
    }

    if (strcasecmp((string) $user['status_akun'], 'Aktif') !== 0) {
        simpanPenangananResponse(
            403,
            false,
            'Akun petugas tidak aktif.'
        );
    }

    $role = (string) $user['nama_peran'];

    if (
        !in_array(
            $role,
            ['Petugas Sarpras', 'Administrator'],
            true
        )
    ) {
        simpanPenangananResponse(
            403,
            false,
            'Anda tidak memiliki hak akses penanganan.'
        );
    }

    // 04. Memvalidasi format request JSON.
    $contentType = strtolower(
        trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])
    );

    if ($contentType !== 'application/json') {
        simpanPenangananResponse(
            415,
            false,
            'Gunakan format JSON.'
        );
    }

    $raw = file_get_contents('php://input');

    if ($raw === false || strlen($raw) > 100000) {
        simpanPenangananResponse(
            413,
            false,
            'Ukuran data permintaan terlalu besar.'
        );
    }

    $input = json_decode($raw, true);

    if (!is_array($input)) {
        simpanPenangananResponse(
            400,
            false,
            'Format data permintaan tidak valid.'
        );
    }

    // 05. Mengambil data tindakan penanganan.
    $kode = trim((string) (
        $input['kode_laporan']
        ?? $input['kode']
        ?? ''
    ));

    $idLaporan = filter_var(
        $input['id_laporan'] ?? null,
        FILTER_VALIDATE_INT
    );

    $tindakan = trim((string) (
        $input['tindak_lanjut_perbaikan']
        ?? $input['tindakan']
        ?? ''
    ));

    $catatan = trim((string) (
        $input['catatan_petugas']
        ?? $input['catatan']
        ?? ''
    ));

    $statusBaru = trim((string) (
        $input['status_penanganan']
        ?? $input['status']
        ?? ''
    ));

    if ($kode === '' && (!$idLaporan || $idLaporan <= 0)) {
        simpanPenangananResponse(
            422,
            false,
            'Kode laporan atau ID laporan wajib diisi.'
        );
    }

    if ($kode !== '' && mb_strlen($kode) > 30) {
        simpanPenangananResponse(
            422,
            false,
            'Kode laporan tidak valid.'
        );
    }

    if ($tindakan === '') {
        simpanPenangananResponse(
            422,
            false,
            'Tindakan perbaikan wajib diisi.'
        );
    }

    if (
        mb_strlen($tindakan) > 10000 ||
        mb_strlen($catatan) > 10000
    ) {
        simpanPenangananResponse(
            422,
            false,
            'Teks tindakan atau catatan terlalu panjang.'
        );
    }

    // Status yang diperbolehkan untuk disimpan.
    $allowedStatuses = [
        'Sedang Diproses',
        'Selesai'
    ];

    if (!in_array($statusBaru, $allowedStatuses, true)) {
        simpanPenangananResponse(
            422,
            false,
            'Status penanganan harus Sedang Diproses atau Selesai.'
        );
    }

    // 06. Memulai transaksi database.
    $pdo->beginTransaction();

    // Mengunci laporan agar tidak diperbarui bersamaan.
    if ($kode !== '') {

        $reportStmt = $pdo->prepare("
            SELECT
                id_laporan,
                kode_laporan,
                status_verifikasi,
                status_penanganan,
                id_petugas_penanggung_jawab
            FROM laporan_kerusakan
            WHERE kode_laporan = :kode
            LIMIT 1
            FOR UPDATE
        ");

        $reportStmt->execute([
            ':kode' => $kode
        ]);

    } else {

        $reportStmt = $pdo->prepare("
            SELECT
                id_laporan,
                kode_laporan,
                status_verifikasi,
                status_penanganan,
                id_petugas_penanggung_jawab
            FROM laporan_kerusakan
            WHERE id_laporan = :id
            LIMIT 1
            FOR UPDATE
        ");

        $reportStmt->execute([
            ':id' => $idLaporan
        ]);
    }

    $report = $reportStmt->fetch(PDO::FETCH_ASSOC);

    if (!$report) {
        $pdo->rollBack();

        simpanPenangananResponse(
            404,
            false,
            'Laporan tidak ditemukan.'
        );
    }

    // 07. Memastikan laporan sudah lolos verifikasi.
    $verificationStatus = strtolower(
        trim((string) $report['status_verifikasi'])
    );

    if (
        !in_array(
            $verificationStatus,
            ['terverifikasi', 'valid', 'diterima'],
            true
        )
    ) {
        $pdo->rollBack();

        simpanPenangananResponse(
            409,
            false,
            'Laporan belum lolos verifikasi.'
        );
    }

    // 08. Memeriksa status penanganan sebelumnya.
    $currentStatus = strtolower(
        trim((string) $report['status_penanganan'])
    );

    $isWaiting = in_array(
        $currentStatus,
        [
            'menunggu penanganan',
            'menunggu',
            'belum ditangani'
        ],
        true
    );

    $isProcessing = in_array(
        $currentStatus,
        [
            'sedang diproses',
            'diproses',
            'dalam proses',
            'sedang dikerjakan'
        ],
        true
    );

    $isCompleted = in_array(
        $currentStatus,
        ['selesai', 'completed', 'ditutup'],
        true
    );

    if ($isCompleted) {
        $pdo->rollBack();

        simpanPenangananResponse(
            409,
            false,
            'Laporan sudah selesai ditangani.'
        );
    }

    if (!$isWaiting && !$isProcessing) {
        $pdo->rollBack();

        simpanPenangananResponse(
            409,
            false,
            'Status laporan tidak memungkinkan untuk diproses.'
        );
    }

    // 09. Memeriksa petugas penanggung jawab.
    $assignedUser = (int) (
        $report['id_petugas_penanggung_jawab'] ?? 0
    );

    if (
        $assignedUser > 0 &&
        $assignedUser !== $userId &&
        $role !== 'Administrator'
    ) {
        $pdo->rollBack();

        simpanPenangananResponse(
            403,
            false,
            'Laporan ini sudah ditangani oleh petugas lain.'
        );
    }

    // 10. Memeriksa urutan perubahan status.
    if ($statusBaru === 'Sedang Diproses' && $isCompleted) {
        $pdo->rollBack();

        simpanPenangananResponse(
            409,
            false,
            'Laporan yang sudah selesai tidak dapat diproses kembali.'
        );
    }

    if ($statusBaru === 'Selesai' && !$isProcessing) {
        $pdo->rollBack();

        simpanPenangananResponse(
            409,
            false,
            'Laporan harus berstatus Sedang Diproses sebelum diselesaikan.'
        );
    }

    // 11. Menentukan waktu mulai dan selesai.
    $waktuMulai = null;
    $waktuSelesai = null;

    if ($isWaiting) {

        // Penanganan pertama dimulai saat petugas memproses laporan.
        $waktuMulai = date('Y-m-d H:i:s');

    } else {

        // Mengambil waktu mulai penanganan pertama.
        $startStmt = $pdo->prepare("
            SELECT MIN(waktu_mulai_penanganan)
            FROM riwayat_penanganan
            WHERE id_laporan = :id
              AND waktu_mulai_penanganan IS NOT NULL
        ");

        $startStmt->execute([
            ':id' => $report['id_laporan']
        ]);

        $waktuMulai = $startStmt->fetchColumn();

        if (!$waktuMulai) {
            $pdo->rollBack();

            simpanPenangananResponse(
                409,
                false,
                'Riwayat waktu mulai penanganan tidak ditemukan.'
            );
        }
    }

    if ($statusBaru === 'Selesai') {
        $waktuSelesai = date('Y-m-d H:i:s');
    }

    // 12. Menyimpan riwayat tindakan perbaikan.
    $historyStmt = $pdo->prepare("
        INSERT INTO riwayat_penanganan (
            id_laporan,
            id_petugas,
            tindak_lanjut_perbaikan,
            catatan_petugas,
            waktu_mulai_penanganan,
            waktu_selesai_penanganan
        ) VALUES (
            :id_laporan,
            :id_petugas,
            :tindakan,
            :catatan,
            :waktu_mulai,
            :waktu_selesai
        )
    ");

    $historyStmt->execute([
        ':id_laporan' => $report['id_laporan'],
        ':id_petugas' => $userId,
        ':tindakan' => $tindakan,
        ':catatan' => $catatan !== ''
            ? $catatan
            : null,
        ':waktu_mulai' => $waktuMulai,
        ':waktu_selesai' => $waktuSelesai
    ]);

    $idRiwayat = (int) $pdo->lastInsertId();

    // 13. Memperbarui status laporan dan petugas penanggung jawab.
    $updateStmt = $pdo->prepare("
        UPDATE laporan_kerusakan
        SET
            status_penanganan = :status,
            id_petugas_penanggung_jawab = :petugas
        WHERE id_laporan = :id
    ");

    $updateStmt->execute([
        ':status' => $statusBaru,
        ':petugas' => $userId,
        ':id' => $report['id_laporan']
    ]);

    // 14. Mencatat perubahan status laporan.
    $statusHistoryStmt = $pdo->prepare("
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
    ");

    $statusHistoryStmt->execute([
        ':id_laporan' => $report['id_laporan'],
        ':id_pengguna' => $userId,
        ':status_sebelumnya' => $report['status_penanganan'],
        ':status_baru' => $statusBaru,
        ':catatan' => $catatan !== ''
            ? $catatan
            : $tindakan
    ]);

    // 15. Memastikan seluruh perubahan berhasil.
    $pdo->commit();

    // 16. Mengirim hasil penyimpanan kepada JavaScript.
    simpanPenangananResponse(
        200,
        true,
        $statusBaru === 'Selesai'
            ? 'Penanganan laporan berhasil diselesaikan.'
            : 'Tindakan penanganan berhasil disimpan.',
        [
            'id_laporan' => (int) $report['id_laporan'],
            'kode_laporan' => $report['kode_laporan'],
            'id_riwayat_penanganan' => $idRiwayat,
            'id_petugas' => $userId,
            'status_sebelumnya' => $report['status_penanganan'],
            'status_penanganan' => $statusBaru,
            'waktu_mulai_penanganan' => $waktuMulai,
            'waktu_selesai_penanganan' => $waktuSelesai
        ]
    );

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        '[SIPFAS SIMPAN PENANGANAN ERROR] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    simpanPenangananResponse(
        500,
        false,
        'Gagal menyimpan penanganan laporan. Periksa PHP error log.'
    );
}
