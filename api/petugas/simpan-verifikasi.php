<?php
declare(strict_types=1);
//revisi akhir
// Memuat konfigurasi session dan koneksi database.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

// Mengatur respons JSON.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

date_default_timezone_set('Asia/Jayapura');

// Mengirim respons JSON.
function simpanVerifikasiResponse(
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

        simpanVerifikasiResponse(
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
        simpanVerifikasiResponse(
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
        simpanVerifikasiResponse(
            401,
            false,
            'Identitas petugas tidak ditemukan.'
        );
    }

    if (strcasecmp((string) $user['status_akun'], 'Aktif') !== 0) {
        simpanVerifikasiResponse(
            403,
            false,
            'Akun petugas tidak aktif.'
        );
    }

    if (
        !in_array(
            (string) $user['nama_peran'],
            ['Petugas Sarpras', 'Administrator'],
            true
        )
    ) {
        simpanVerifikasiResponse(
            403,
            false,
            'Anda tidak memiliki hak akses verifikasi.'
        );
    }

    // 04. Memeriksa ukuran dan format request JSON.
    $contentType = strtolower(
        trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])
    );

    if ($contentType !== 'application/json') {
        simpanVerifikasiResponse(
            415,
            false,
            'Gunakan format JSON.'
        );
    }

    $raw = file_get_contents('php://input');

    if ($raw === false || strlen($raw) > 100000) {
        simpanVerifikasiResponse(
            413,
            false,
            'Ukuran data permintaan terlalu besar.'
        );
    }

    $input = json_decode($raw, true);

    if (!is_array($input)) {
        simpanVerifikasiResponse(
            400,
            false,
            'Format data permintaan tidak valid.'
        );
    }

    // 05. Mengambil dan memvalidasi data verifikasi.
    $kode = trim((string) (
        $input['kode_laporan']
        ?? $input['kode']
        ?? $input['reportCode']
        ?? ''
    ));

    $hasil = trim((string) (
        $input['hasil_verifikasi']
        ?? $input['keputusan']
        ?? $input['decision']
        ?? ''
    ));

    $x1Sesudah = $input['x1_sesudah']
        ?? $input['tingkat_kerusakan_x1_terverifikasi']
        ?? null;

    $x2Sesudah = $input['x2_sesudah']
        ?? $input['dampak_akademik_x2_terverifikasi']
        ?? null;

    $prioritasSesudah = trim((string) (
        $input['prioritas_sesudah']
        ?? $input['prioritas_prediksi']
        ?? ''
    ));

    $alasanKoreksi = trim((string) (
        $input['alasan_koreksi']
        ?? ''
    ));

    $catatan = trim((string) (
        $input['catatan_verifikasi']
        ?? $input['catatan']
        ?? ''
    ));

    if ($kode === '' || mb_strlen($kode) > 30) {
        simpanVerifikasiResponse(
            422,
            false,
            'Kode laporan tidak valid.'
        );
    }

    // Menentukan hasil verifikasi yang diperbolehkan.
    $hasilNormal = strtolower($hasil);

    $hasilValid = [
        'valid',
        'terverifikasi',
        'diterima'
    ];

    $hasilTidakValid = [
        'tidak valid',
        'invalid',
        'ditolak'
    ];

    if (
        !in_array($hasilNormal, $hasilValid, true) &&
        !in_array($hasilNormal, $hasilTidakValid, true)
    ) {
        simpanVerifikasiResponse(
            422,
            false,
            'Hasil verifikasi harus Valid atau Tidak Valid.'
        );
    }

    $isValid = in_array(
        $hasilNormal,
        $hasilValid,
        true
    );

    $hasilFinal = $isValid ? 'Valid' : 'Tidak Valid';

    // Memastikan nilai X1 dan X2 merupakan bilangan bulat.
    $validateAttribute = function (
        mixed $value,
        string $field
    ): int {
        if (
            filter_var(
                $value,
                FILTER_VALIDATE_INT
            ) === false
        ) {
            throw new InvalidArgumentException(
                $field . ' harus berupa bilangan bulat.'
            );
        }

        $number = (int) $value;

        if ($number < 1 || $number > 5) {
            throw new InvalidArgumentException(
                $field . ' harus berada pada rentang 1 sampai 5.'
            );
        }

        return $number;
    };

    // Nilai koreksi wajib tersedia jika laporan dinyatakan valid.
    if ($isValid) {
        if ($x1Sesudah === null || $x2Sesudah === null) {
            simpanVerifikasiResponse(
                422,
                false,
                'Nilai X1 dan X2 hasil verifikasi wajib diisi.'
            );
        }

        $x1Sesudah = $validateAttribute(
            $x1Sesudah,
            'Nilai X1'
        );

        $x2Sesudah = $validateAttribute(
            $x2Sesudah,
            'Nilai X2'
        );

        if ($prioritasSesudah === '') {
            simpanVerifikasiResponse(
                422,
                false,
                'Hasil klasifikasi prioritas wajib tersedia.'
            );
        }

        if (mb_strlen($prioritasSesudah) > 20) {
            simpanVerifikasiResponse(
                422,
                false,
                'Format prioritas tidak valid.'
            );
        }

        if (
            $prioritasSesudah === 'Belum Dinilai' ||
            $prioritasSesudah === 'Tidak Diketahui'
        ) {
            simpanVerifikasiResponse(
                422,
                false,
                'Prioritas belum memiliki hasil klasifikasi.'
            );
        }

    } else {

        // Laporan tidak valid tidak boleh membawa hasil koreksi.
        $x1Sesudah = null;
        $x2Sesudah = null;
        $prioritasSesudah = null;
    }

    if (
        mb_strlen($alasanKoreksi) > 5000 ||
        mb_strlen($catatan) > 5000
    ) {
        simpanVerifikasiResponse(
            422,
            false,
            'Alasan atau catatan verifikasi terlalu panjang.'
        );
    }

    if (
        $x1Sesudah !== null &&
        $x2Sesudah !== null &&
        (
            $x1Sesudah === null ||
            $x2Sesudah === null
        )
    ) {
        simpanVerifikasiResponse(
            422,
            false,
            'Data koreksi atribut tidak lengkap.'
        );
    }

    // 06. Memulai transaksi database.
    $pdo->beginTransaction();

    // Mengunci laporan agar tidak diverifikasi bersamaan.
    $reportStmt = $pdo->prepare("
        SELECT
            id_laporan,
            kode_laporan,
            tingkat_kerusakan_x1,
            dampak_akademik_x2,
            frekuensi_penggunaan_x3,
            tingkat_kerusakan_x1_terverifikasi,
            dampak_akademik_x2_terverifikasi,
            id_pelatihan_awal,
            prioritas_awal,
            id_pelatihan,
            prioritas_prediksi,
            status_verifikasi,
            status_penanganan
        FROM laporan_kerusakan
        WHERE kode_laporan = :kode
        LIMIT 1
        FOR UPDATE
    ");

    $reportStmt->execute([
        ':kode' => $kode
    ]);

    $report = $reportStmt->fetch(PDO::FETCH_ASSOC);

    if (!$report) {
        $pdo->rollBack();

        simpanVerifikasiResponse(
            404,
            false,
            'Laporan tidak ditemukan.'
        );
    }

    // Memastikan laporan belum diverifikasi.
    $currentStatus = strtolower(
        trim((string) $report['status_verifikasi'])
    );

    $alreadyVerified = in_array(
        $currentStatus,
        [
            'terverifikasi',
            'diverifikasi',
            'valid',
            'tidak valid',
            'ditolak',
            'selesai diverifikasi'
        ],
        true
    );

    if ($alreadyVerified) {
        $pdo->rollBack();

        simpanVerifikasiResponse(
            409,
            false,
            'Laporan ini sudah diverifikasi dan tidak dapat diproses ulang.'
        );
    }

    // 07. Memastikan model C4.5 tersedia.
    $modelId = (int) (
        $report['id_pelatihan']
        ?? $report['id_pelatihan_awal']
        ?? 0
    );

    if ($modelId <= 0) {
        $pdo->rollBack();

        simpanVerifikasiResponse(
            422,
            false,
            'Laporan belum memiliki referensi model C4.5. Periksa proses klasifikasi awal.'
        );
    }

    $modelStmt = $pdo->prepare("
        SELECT
            id_pelatihan,
            versi_algoritma,
            struktur_pohon,
            status_model
        FROM riwayat_pelatihan_c45
        WHERE id_pelatihan = :id
        LIMIT 1
    ");

    $modelStmt->execute([
        ':id' => $modelId
    ]);

    $model = $modelStmt->fetch(PDO::FETCH_ASSOC);

    if (!$model) {
        $pdo->rollBack();

        simpanVerifikasiResponse(
            422,
            false,
            'Referensi model C4.5 tidak ditemukan.'
        );
    }

    // 08. Menentukan nilai sebelum dan sesudah verifikasi.
    $x1Sebelum = (int) $report['tingkat_kerusakan_x1'];

    $x2Sebelum = (int) $report['dampak_akademik_x2'];

    $x3Digunakan = (int) $report['frekuensi_penggunaan_x3'];

    $prioritasSebelum = (string) (
        $report['prioritas_prediksi']
        ?: $report['prioritas_awal']
        ?: 'Belum Dinilai'
    );

    // Nilai model sebelum dan sesudah tetap merujuk pada model yang
    // sama jika tidak ada proses pelatihan model baru.
    $modelIdSebelum = $modelId;

    $modelIdSesudah = $isValid
        ? $modelId
        : null;

    // 09. Menyimpan riwayat verifikasi.
    $historyStmt = $pdo->prepare("
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
            alasan_koreksi,
            catatan_verifikasi,
            waktu_verifikasi
        ) VALUES (
            :id_laporan,
            :id_verifikator,
            :hasil,
            :x1_sebelum,
            :x1_sesudah,
            :x2_sebelum,
            :x2_sesudah,
            :x3,
            :prioritas_sebelum,
            :prioritas_sesudah,
            :model_sebelum,
            :model_sesudah,
            :alasan,
            :catatan,
            NOW()
        )
    ");

    $historyStmt->execute([
        ':id_laporan' => $report['id_laporan'],
        ':id_verifikator' => $userId,
        ':hasil' => $hasilFinal,
        ':x1_sebelum' => $x1Sebelum,
        ':x1_sesudah' => $x1Sesudah,
        ':x2_sebelum' => $x2Sebelum,
        ':x2_sesudah' => $x2Sesudah,
        ':x3' => $x3Digunakan,
        ':prioritas_sebelum' => $prioritasSebelum,
        ':prioritas_sesudah' => $prioritasSesudah,
        ':model_sebelum' => $modelIdSebelum,
        ':model_sesudah' => $modelIdSesudah,
        ':alasan' => $alasanKoreksi !== ''
            ? $alasanKoreksi
            : null,
        ':catatan' => $catatan !== ''
            ? $catatan
            : null
    ]);

    // 10. Memperbarui status dan hasil verifikasi laporan.
    if ($isValid) {

        $updateStmt = $pdo->prepare("
            UPDATE laporan_kerusakan
            SET
                tingkat_kerusakan_x1_terverifikasi = :x1,
                dampak_akademik_x2_terverifikasi = :x2,
                id_verifikator = :verifikator,
                catatan_verifikasi = :catatan,
                waktu_verifikasi = NOW(),
                status_verifikasi = 'Terverifikasi',
                status_penanganan = 'Menunggu Penanganan',
                prioritas_prediksi = :prioritas
            WHERE id_laporan = :id
        ");

        $updateStmt->execute([
            ':x1' => $x1Sesudah,
            ':x2' => $x2Sesudah,
            ':verifikator' => $userId,
            ':catatan' => $catatan !== ''
                ? $catatan
                : null,
            ':prioritas' => $prioritasSesudah,
            ':id' => $report['id_laporan']
        ]);

        $newHandlingStatus = 'Menunggu Penanganan';

    } else {

        $updateStmt = $pdo->prepare("
            UPDATE laporan_kerusakan
            SET
                id_verifikator = :verifikator,
                catatan_verifikasi = :catatan,
                waktu_verifikasi = NOW(),
                status_verifikasi = 'Tidak Valid',
                status_penanganan = 'Tidak Ditangani'
            WHERE id_laporan = :id
        ");

        $updateStmt->execute([
            ':verifikator' => $userId,
            ':catatan' => $catatan !== ''
                ? $catatan
                : null,
            ':id' => $report['id_laporan']
        ]);

        $newHandlingStatus = 'Tidak Ditangani';
    }

    // 11. Mencatat perubahan status verifikasi.
    $statusStmt = $pdo->prepare("
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
    ");

    $statusStmt->execute([
        ':id_laporan' => $report['id_laporan'],
        ':id_pengguna' => $userId,
        ':status_sebelumnya' => $report['status_verifikasi'],
        ':status_baru' => $isValid
            ? 'Terverifikasi'
            : 'Tidak Valid',
        ':catatan' => $catatan !== ''
            ? $catatan
            : $hasilFinal
    ]);

    // 12. Mencatat perubahan status penanganan.
    $handlingHistoryStmt = $pdo->prepare("
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

    $handlingHistoryStmt->execute([
        ':id_laporan' => $report['id_laporan'],
        ':id_pengguna' => $userId,
        ':status_sebelumnya' => $report['status_penanganan'],
        ':status_baru' => $newHandlingStatus,
        ':catatan' => $isValid
            ? 'Laporan telah lolos verifikasi dan menunggu penanganan.'
            : 'Laporan tidak valid dan tidak diteruskan ke penanganan.'
    ]);

    // 13. Memastikan seluruh perubahan berhasil disimpan.
    $pdo->commit();

    // 14. Mengirim hasil kepada JavaScript.
    simpanVerifikasiResponse(
        200,
        true,
        $isValid
            ? 'Verifikasi berhasil disimpan. Laporan diteruskan ke penanganan.'
            : 'Verifikasi berhasil disimpan. Laporan dinyatakan tidak valid.',
        [
            'id_laporan' => (int) $report['id_laporan'],
            'kode_laporan' => $kode,
            'hasil_verifikasi' => $hasilFinal,
            'status_verifikasi' => $isValid
                ? 'Terverifikasi'
                : 'Tidak Valid',
            'status_penanganan' => $newHandlingStatus,
            'x1_sebelum' => $x1Sebelum,
            'x1_sesudah' => $x1Sesudah,
            'x2_sebelum' => $x2Sebelum,
            'x2_sesudah' => $x2Sesudah,
            'x3_digunakan' => $x3Digunakan,
            'prioritas_sebelum' => $prioritasSebelum,
            'prioritas_sesudah' => $prioritasSesudah,
            'id_verifikator' => $userId,
            'id_pelatihan' => $modelId,
            'waktu_verifikasi' => date('Y-m-d H:i:s')
        ]
    );

} catch (InvalidArgumentException $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    simpanVerifikasiResponse(
        422,
        false,
        $e->getMessage()
    );

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        '[SIPFAS SIMPAN VERIFIKASI ERROR] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    simpanVerifikasiResponse(
        500,
        false,
        'Gagal menyimpan hasil verifikasi. Periksa PHP error log.'
    );
}
