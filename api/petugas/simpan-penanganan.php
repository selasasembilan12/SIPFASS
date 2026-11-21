<?php
declare(strict_types=1);

// ======================================================
// 1. KONFIGURASI DAN KEAMANAN
// ======================================================

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/config/csrf.php';

// Perlindungan CSRF.
sipfas_csrf_require_valid();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

date_default_timezone_set('Asia/Jayapura');

// ======================================================
// 2. FUNGSI RESPONS JSON
// ======================================================

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

// ======================================================
// 3. FUNGSI NORMALISASI STATUS
// ======================================================

function normalisasiStatusPenanganan(string $status): string
{
    $status = mb_strtolower(trim($status));

    $status = preg_replace('/\s+/', ' ', $status);

    if (in_array($status, [
        'diproses',
        'sedang diproses',
        'processing',
        'dalam proses',
        'sedang dikerjakan'
    ], true)) {
        return 'Sedang Diproses';
    }

    if (in_array($status, [
        'selesai',
        'completed',
        'selesai ditangani',
        'selesai diperbaiki'
    ], true)) {
        return 'Selesai';
    }

    if (in_array($status, [
        'menunggu',
        'menunggu penanganan',
        'belum ditangani'
    ], true)) {
        return 'Menunggu';
    }

    return '';
}

// ======================================================
// 4. MEMULAI PROSES
// ======================================================

try {

    // ==================================================
    // 4.1. VALIDASI METODE REQUEST
    // ==================================================

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

        header('Allow: POST');

        simpanPenangananResponse(
            405,
            false,
            'Metode permintaan tidak diizinkan.'
        );
    }

    // ==================================================
    // 4.2. VALIDASI SESSION
    // ==================================================

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

    // ==================================================
    // 4.3. VALIDASI IDENTITAS DAN HAK AKSES
    // ==================================================

    $userStmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.nama_lengkap,
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
            'Identitas pengguna tidak ditemukan.'
        );
    }

    // Memastikan akun masih aktif.
    if (
        strcasecmp(
            trim((string) $user['status_akun']),
            'Aktif'
        ) !== 0
    ) {

        simpanPenangananResponse(
            403,
            false,
            'Akun pengguna tidak aktif.'
        );
    }

    // Memastikan peran pengguna.
    $role = trim((string) $user['nama_peran']);

    if (!in_array($role, [
        'Petugas Sarpras',
        'Administrator'
    ], true)) {

        simpanPenangananResponse(
            403,
            false,
            'Anda tidak memiliki hak akses penanganan.'
        );
    }

    // ==================================================
    // 5. VALIDASI FORMAT JSON
    // ==================================================

    $contentType = strtolower(
        trim(
            explode(
                ';',
                $_SERVER['CONTENT_TYPE'] ?? ''
            )[0]
        )
    );

    if ($contentType !== 'application/json') {

        simpanPenangananResponse(
            415,
            false,
            'Gunakan format JSON.'
        );
    }

    $raw = file_get_contents('php://input');

    if ($raw === false) {

        simpanPenangananResponse(
            400,
            false,
            'Data permintaan tidak dapat dibaca.'
        );
    }

    if (strlen($raw) > 100000) {

        simpanPenangananResponse(
            413,
            false,
            'Ukuran data permintaan terlalu besar.'
        );
    }

    $input = json_decode($raw, true);

    if (
        json_last_error() !== JSON_ERROR_NONE ||
        !is_array($input)
    ) {

        simpanPenangananResponse(
            400,
            false,
            'Format data permintaan tidak valid.'
        );
    }

    // ==================================================
    // 6. MENGAMBIL DATA REQUEST
    // ==================================================

    $kodeInput = $input['kode_laporan']
        ?? $input['kode']
        ?? '';

    $idInput = $input['id_laporan'] ?? null;

    $tindakanInput = $input['tindak_lanjut_perbaikan']
        ?? $input['tindakan']
        ?? '';

    $catatanInput = $input['catatan_petugas']
        ?? $input['catatan']
        ?? '';

    $statusInput = $input['status_penanganan']
        ?? $input['status']
        ?? '';

    // Memastikan data berupa tipe sederhana.
    foreach ([
        'kode_laporan' => $kodeInput,
        'tindak_lanjut_perbaikan' => $tindakanInput,
        'catatan_petugas' => $catatanInput,
        'status_penanganan' => $statusInput
    ] as $field => $value) {

        if (!is_string($value) && !is_numeric($value)) {

            simpanPenangananResponse(
                422,
                false,
                'Format kolom ' . $field . ' tidak valid.'
            );
        }
    }

    if (
        $idInput !== null &&
        !is_int($idInput) &&
        !(is_string($idInput) && ctype_digit($idInput))
    ) {

        simpanPenangananResponse(
            422,
            false,
            'ID laporan tidak valid.'
        );
    }

    $kode = trim((string) $kodeInput);

    $idLaporan = $idInput !== null
        ? filter_var($idInput, FILTER_VALIDATE_INT)
        : false;

    $tindakan = trim((string) $tindakanInput);

    $catatan = trim((string) $catatanInput);

    $statusBaru = normalisasiStatusPenanganan(
        (string) $statusInput
    );

    // ==================================================
    // 7. VALIDASI IDENTITAS LAPORAN
    // ==================================================

    if (
        $kode === '' &&
        (!$idLaporan || $idLaporan <= 0)
    ) {

        simpanPenangananResponse(
            422,
            false,
            'Kode laporan atau ID laporan wajib diisi.'
        );
    }

    if (
        $kode !== '' &&
        (
            mb_strlen($kode) > 30 ||
            preg_match('/[\x00-\x1F\x7F]/', $kode)
        )
    ) {

        simpanPenangananResponse(
            422,
            false,
            'Kode laporan tidak valid.'
        );
    }

    // ==================================================
    // 8. VALIDASI TINDAKAN DAN CATATAN
    // ==================================================

    if ($tindakan === '') {

        simpanPenangananResponse(
            422,
            false,
            'Tindakan perbaikan wajib diisi.'
        );
    }

    if (
        mb_strlen($tindakan) > 10000 ||
        mb_strlen($catatan) > 5000
    ) {

        simpanPenangananResponse(
            422,
            false,
            'Teks tindakan atau catatan terlalu panjang.'
        );
    }

    // ==================================================
    // 9. VALIDASI STATUS PENANGANAN
    // ==================================================

    if (!in_array($statusBaru, [
        'Sedang Diproses',
        'Selesai'
    ], true)) {

        simpanPenangananResponse(
            422,
            false,
            'Status penanganan harus Diproses atau Selesai.'
        );
    }

    // ==================================================
    // 10. MEMULAI TRANSAKSI DATABASE
    // ==================================================

    $pdo->beginTransaction();

    // ==================================================
    // 11. MENGUNCI DATA LAPORAN
    // ==================================================

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

    // ==================================================
    // 12. VALIDASI STATUS VERIFIKASI
    // ==================================================

    $verificationStatus = mb_strtolower(
        trim((string) $report['status_verifikasi'])
    );

    if (!in_array($verificationStatus, [
        'terverifikasi',
        'valid',
        'diterima'
    ], true)) {

        $pdo->rollBack();

        simpanPenangananResponse(
            409,
            false,
            'Laporan belum lolos verifikasi.'
        );
    }

    // ==================================================
    // 13. VALIDASI STATUS PENANGANAN SEBELUMNYA
    // ==================================================

    $statusLama = (string) (
        $report['status_penanganan'] ?? ''
    );

    $currentStatus = normalisasiStatusPenanganan(
        $statusLama
    );

    if ($currentStatus === 'Selesai') {

        $pdo->rollBack();

        simpanPenangananResponse(
            409,
            false,
            'Laporan sudah selesai ditangani.'
        );
    }

    if (!in_array($currentStatus, [
        'Menunggu',
        'Sedang Diproses'
    ], true)) {

        $pdo->rollBack();

        simpanPenangananResponse(
            409,
            false,
            'Status laporan tidak memungkinkan untuk diproses.'
        );
    }

    // ==================================================
    // 14. VALIDASI PETUGAS PENANGGUNG JAWAB
    // ==================================================

    $assignedUser = (int) (
        $report['id_petugas_penanggung_jawab'] ?? 0
    );

    // Petugas hanya boleh menangani laporan yang belum
    // ditugaskan atau sudah menjadi tanggung jawabnya.
    // Administrator dapat mengelola penanganan laporan.

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

    // ==================================================
    // 15. MENENTUKAN WAKTU PENANGANAN
    // ==================================================

    $waktuSekarang = date('Y-m-d H:i:s');

    $waktuMulai = null;
    $waktuSelesai = null;

    if ($currentStatus === 'Menunggu') {

        // Pertama kali laporan mulai ditangani.
        $waktuMulai = $waktuSekarang;

    } else {

        // Mempertahankan waktu mulai pertama.
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
        $waktuSelesai = $waktuSekarang;
    }

    // ==================================================
    // 16. MENYIMPAN RIWAYAT PENANGANAN
    // ==================================================

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
        ':catatan' => $catatan !== '' ? $catatan : null,
        ':waktu_mulai' => $waktuMulai,
        ':waktu_selesai' => $waktuSelesai
    ]);

    $idRiwayat = (int) $pdo->lastInsertId();

    if ($idRiwayat <= 0) {

        throw new RuntimeException(
            'ID riwayat penanganan gagal diperoleh.'
        );
    }

    // ==================================================
    // 17. MEMBACA WAKTU PEMBARUAN
    // ==================================================

    $updatedStmt = $pdo->prepare("
        SELECT waktu_pembaruan

        FROM riwayat_penanganan

        WHERE id_riwayat_penanganan = :id

        LIMIT 1
    ");

    $updatedStmt->execute([
        ':id' => $idRiwayat
    ]);

    $waktuPembaruan = $updatedStmt->fetchColumn();

    // ==================================================
    // 18. MEMPERBARUI STATUS DAN PETUGAS LAPORAN
    // ==================================================

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

    // ==================================================
    // 19. MENCATAT PERUBAHAN STATUS
    // ==================================================

    // Riwayat status hanya ditambahkan jika status
    // benar-benar mengalami perubahan.

    $statusBerubah = $currentStatus !== $statusBaru;

    if ($statusBerubah) {

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
            ':status_sebelumnya' => $statusLama,
            ':status_baru' => $statusBaru,
            ':catatan' => $catatan !== ''
                ? $catatan
                : $tindakan
        ]);
    }

    // ==================================================
    // 20. MENYELESAIKAN TRANSAKSI
    // ==================================================

    $pdo->commit();

    // ==================================================
    // 21. MENYIAPKAN RESPONS DATABASE
    // ==================================================

    $responseData = [
        'id_laporan' => (int) $report['id_laporan'],

        'kode_laporan' => $report['kode_laporan'],

        'id_riwayat_penanganan' => $idRiwayat,

        'id_petugas' => $userId,

        'nama_petugas' => $user['nama_lengkap'],

        'status_sebelumnya' => $statusLama,

        'status_penanganan' => $statusBaru,

        'tindak_lanjut_perbaikan' => $tindakan,

        'catatan_petugas' => $catatan !== ''
            ? $catatan
            : null,

        'waktu_mulai_penanganan' => $waktuMulai,

        'waktu_selesai_penanganan' => $waktuSelesai,

        'waktu_pembaruan' => $waktuPembaruan,

        'status_berubah' => $statusBerubah
    ];

    // ==================================================
    // 22. MENGIRIM RESPONS KE JAVASCRIPT
    // ==================================================

    simpanPenangananResponse(
        200,
        true,

        $statusBaru === 'Selesai'
            ? 'Penanganan laporan berhasil diselesaikan.'
            : 'Tindakan penanganan berhasil disimpan.',

        $responseData
    );

} catch (Throwable $e) {

    // ==================================================
    // 23. ROLLBACK JIKA TERJADI KEGAGALAN
    // ==================================================

    if (
        isset($pdo) &&
        $pdo instanceof PDO &&
        $pdo->inTransaction()
    ) {
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
