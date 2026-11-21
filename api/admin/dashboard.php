<?php
declare(strict_types=1);

// ============================================================
// 01. MEMUAT KONEKSI DAN AUTENTIKASI ADMIN
// ============================================================

require_once __DIR__ . '/_admin-common.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(_DIR_, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

// ============================================================
// 02. FUNGSI MEMERIKSA KOLOM DATABASE
// ============================================================

function dashboard_columns(PDO $pdo, string $table): array
{
    $allowedTables = [
        'fasilitas',
        'kategori_fasilitas',
        'pengguna',
        'peran',
        'laporan_kerusakan',
        'lokasi_ruangan',
        'riwayat_verifikasi_laporan',
        'riwayat_penanganan',
        'riwayat_pelatihan_c45'
    ];

    if (!in_array($table, $allowedTables, true)) {
        throw new RuntimeException('Nama tabel tidak diizinkan.');
    }

    $stmt = $pdo->query("SHOW COLUMNS FROM `$table`");

    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

/**
 * Memilih nama kolom yang tersedia berdasarkan beberapa kandidat.
 */
function dashboard_pick_column(
    array $columns,
    array $candidates
): ?string {
    foreach ($candidates as $candidate) {
        if (in_array($candidate, $columns, true)) {
            return $candidate;
        }
    }

    return null;
}

/**
 * Membuat ekspresi SQL untuk kolom opsional.
 */
function dashboard_optional_column(
    ?string $column,
    string $alias,
    string $fallback = 'NULL'
): string {
    if ($column === null) {
        return "$fallback AS `$alias`";
    }

    return "t.`$column` AS `$alias`";
}

// ============================================================
// 03. MEMERIKSA METODE REQUEST
// ============================================================

try {

    admin_method('GET');

    // ========================================================
    // 04. MENGAMBIL STRUKTUR KOLOM DATABASE
    // ========================================================

    $columnsFasilitas = dashboard_columns($pdo, 'fasilitas');
    $columnsKategori = dashboard_columns($pdo, 'kategori_fasilitas');
    $columnsPengguna = dashboard_columns($pdo, 'pengguna');
    $columnsPeran = dashboard_columns($pdo, 'peran');
    $columnsLaporan = dashboard_columns($pdo, 'laporan_kerusakan');
    $columnsLokasi = dashboard_columns($pdo, 'lokasi_ruangan');
    $columnsVerifikasi = dashboard_columns(
        $pdo,
        'riwayat_verifikasi_laporan'
    );
    $columnsPenanganan = dashboard_columns(
        $pdo,
        'riwayat_penanganan'
    );
    $columnsPelatihan = dashboard_columns(
        $pdo,
        'riwayat_pelatihan_c45'
    );

    // ========================================================
    // 05. STATISTIK FASILITAS
    // ========================================================

    $totalFasilitas = (int) $pdo->query("
        SELECT COUNT(*)
        FROM fasilitas
    ")->fetchColumn();

    $totalKategori = (int) $pdo->query("
        SELECT COUNT(*)
        FROM kategori_fasilitas
    ")->fetchColumn();

    // Menghitung fasilitas yang berstatus aktif.
    $fasilitasAktif = 0;

    if (in_array('status_fasilitas', $columnsFasilitas, true)) {

        $stmt = $pdo->query("
            SELECT COUNT(*)
            FROM fasilitas
            WHERE status_fasilitas = 'Aktif'
        ");

        $fasilitasAktif = (int) $stmt->fetchColumn();
    }

    // ========================================================
    // 06. STATISTIK PENGGUNA
    // ========================================================

    $stmtPengguna = $pdo->query("
        SELECT
            COUNT(*) AS total_pengguna,

            SUM(
                CASE
                    WHEN LOWER(TRIM(p.nama_peran))
                        = 'administrator'
                    THEN 1 ELSE 0
                END
            ) AS total_admin,

            SUM(
                CASE
                    WHEN LOWER(TRIM(p.nama_peran))
                        = 'petugas sarpras'
                    THEN 1 ELSE 0
                END
            ) AS total_petugas,

            SUM(
                CASE
                    WHEN LOWER(TRIM(p.nama_peran))
                        = 'pelapor'
                    THEN 1 ELSE 0
                END
            ) AS total_pelapor

        FROM pengguna u

        INNER JOIN peran p
            ON p.id_peran = u.id_peran
    ");

    $pengguna = $stmtPengguna->fetch(PDO::FETCH_ASSOC) ?: [];

    // ========================================================
    // 07. STATISTIK LAPORAN KERUSAKAN
    // ========================================================

    $totalLaporan = (int) $pdo->query("
        SELECT COUNT(*)
        FROM laporan_kerusakan
    ")->fetchColumn();

    // Menghitung laporan yang sedang menunggu.
    $laporanMenunggu = 0;

    if (in_array('status_verifikasi', $columnsLaporan, true)) {

        $stmt = $pdo->query("
            SELECT COUNT(*)
            FROM laporan_kerusakan
            WHERE status_verifikasi = 'Menunggu'
        ");

        $laporanMenunggu = (int) $stmt->fetchColumn();
    }

    // Menghitung laporan yang sedang diproses.
    $laporanDiproses = 0;

    if (in_array('status_penanganan', $columnsLaporan, true)) {

        $stmt = $pdo->query("
            SELECT COUNT(*)
            FROM laporan_kerusakan
            WHERE status_penanganan = 'Diproses'
        ");

        $laporanDiproses = (int) $stmt->fetchColumn();
    }

    // Menghitung laporan yang sudah selesai.
    $laporanSelesai = 0;

    if (in_array('status_penanganan', $columnsLaporan, true)) {

        $stmt = $pdo->query("
            SELECT COUNT(*)
            FROM laporan_kerusakan
            WHERE status_penanganan = 'Selesai'
        ");

        $laporanSelesai = (int) $stmt->fetchColumn();
    }

    // ========================================================
    // 08. MENGAMBIL MODEL C4.5 TERBARU
    // ========================================================

    $model = [
        'akurasi' => null,
        'jumlah_data_uji' => 0,
        'id_pelatihan' => null,
        'status_model' => null
    ];

    $stmtModel = $pdo->query("
        SELECT
            id_pelatihan,
            akurasi,
            jumlah_data_uji,
            status_model

        FROM riwayat_pelatihan_c45

        ORDER BY
            CASE
                WHEN status_model = 'Aktif' THEN 0
                ELSE 1
            END,
            id_pelatihan DESC

        LIMIT 1
    ");

    $hasilModel = $stmtModel->fetch(PDO::FETCH_ASSOC);

    if ($hasilModel) {

        $model = [
            'akurasi' => $hasilModel['akurasi'] !== null
                ? (float) $hasilModel['akurasi']
                : null,

            'jumlah_data_uji' =>
                (int) $hasilModel['jumlah_data_uji'],

            'id_pelatihan' =>
                (int) $hasilModel['id_pelatihan'],

            'status_model' =>
                $hasilModel['status_model']
        ];
    }

    // ========================================================
    // 09. MENENTUKAN KOLOM LOKASI
    // ========================================================

    $kolomNamaLokasi = dashboard_pick_column(
        $columnsLokasi,
        [
            'nama_lokasi',
            'nama_ruangan',
            'lokasi_ruangan'
        ]
    );

    $kolomIdLokasi = dashboard_pick_column(
        $columnsLaporan,
        ['id_lokasi']
    );

    $joinLokasi = '';
    $selectLokasi = "'-' AS lokasi_ruangan";

    if ($kolomIdLokasi && $kolomNamaLokasi) {

        $joinLokasi = "
            LEFT JOIN lokasi_ruangan lr
                ON lr.id_lokasi = lk.id_lokasi
        ";

        $selectLokasi = "lr.`$kolomNamaLokasi` AS lokasi_ruangan";
    }

    // ========================================================
    // 10. MENENTUKAN KOLOM STATUS LAPORAN
    // ========================================================

    $kolomStatusVerifikasi = dashboard_pick_column(
        $columnsLaporan,
        ['status_verifikasi']
    );

    $kolomStatusPenanganan = dashboard_pick_column(
        $columnsLaporan,
        ['status_penanganan']
    );

    $kolomPrioritas = dashboard_pick_column(
        $columnsLaporan,
        ['prioritas_awal', 'prioritas', 'label_prioritas']
    );

    $kolomTanggal = dashboard_pick_column(
        $columnsLaporan,
        ['tanggal_dibuat', 'tanggal_laporan', 'created_at']
    );

    $kolomDeskripsi = dashboard_pick_column(
        $columnsLaporan,
        ['deskripsi_kerusakan', 'deskripsi']
    );

    $selectStatusVerifikasi = $kolomStatusVerifikasi
        ? "lk.`$kolomStatusVerifikasi` AS status_verifikasi"
        : "'Menunggu' AS status_verifikasi";

    $selectStatusPenanganan = $kolomStatusPenanganan
        ? "lk.`$kolomStatusPenanganan` AS status_penanganan"
        : "'Menunggu' AS status_penanganan";

    $selectPrioritas = $kolomPrioritas
        ? "lk.`$kolomPrioritas` AS prioritas_awal"
        : "'Belum Dinilai' AS prioritas_awal";

    $selectTanggal = $kolomTanggal
        ? "lk.`$kolomTanggal` AS tanggal_dibuat"
        : "NULL AS tanggal_dibuat";

    $selectDeskripsi = $kolomDeskripsi
        ? "lk.`$kolomDeskripsi` AS deskripsi_kerusakan"
        : "NULL AS deskripsi_kerusakan";

    // ========================================================
    // 11. MENGAMBIL LAPORAN TERBARU
    // ========================================================

    $sqlLaporan = "
        SELECT
            lk.id_laporan,
            lk.kode_laporan,

            $selectTanggal,

            $selectDeskripsi,

            $selectStatusVerifikasi,

            $selectStatusPenanganan,

            $selectPrioritas,

            f.nama_fasilitas,
            f.kode_fasilitas,

            $selectLokasi,

            u.nama_lengkap AS nama_pelapor,
            u.nomor_identitas,

            rv.hasil_verifikasi,
            rv.catatan_verifikasi,
            rv.prioritas_sesudah,

            rp.tindak_lanjut_perbaikan,
            rp.catatan_petugas,
            rp.waktu_mulai_penanganan,
            rp.waktu_selesai_penanganan

        FROM laporan_kerusakan lk

        LEFT JOIN fasilitas f
            ON f.id_fasilitas = lk.id_fasilitas

        LEFT JOIN pengguna u
            ON u.id_pengguna = lk.id_pelapor

        $joinLokasi

        LEFT JOIN riwayat_verifikasi_laporan rv
            ON rv.id_riwayat_verifikasi = (
                SELECT MAX(v.id_riwayat_verifikasi)
                FROM riwayat_verifikasi_laporan v
                WHERE v.id_laporan = lk.id_laporan
            )

        LEFT JOIN riwayat_penanganan rp
            ON rp.id_riwayat_penanganan = (
                SELECT MAX(p.id_riwayat_penanganan)
                FROM riwayat_penanganan p
                WHERE p.id_laporan = lk.id_laporan
            )

        ORDER BY lk.id_laporan DESC

        LIMIT 100
    ";

    $stmtLaporan = $pdo->query($sqlLaporan);

    $laporanTerbaru = $stmtLaporan->fetchAll(PDO::FETCH_ASSOC);

    // ========================================================
    // 12. MENYUSUN RESPONSE STATISTIK
    // ========================================================

    $statistics = [

        'total_fasilitas' => $totalFasilitas,

        'total_kategori' => $totalKategori,

        'fasilitas_aktif' => $fasilitasAktif,

        'total_pengguna' =>
            (int) ($pengguna['total_pengguna'] ?? 0),

        'total_admin' =>
            (int) ($pengguna['total_admin'] ?? 0),

        'total_petugas' =>
            (int) ($pengguna['total_petugas'] ?? 0),

        'total_pelapor' =>
            (int) ($pengguna['total_pelapor'] ?? 0),

        'total_laporan' => $totalLaporan,

        'laporan_menunggu' => $laporanMenunggu,

        'laporan_diproses' => $laporanDiproses,

        'laporan_selesai' => $laporanSelesai
    ];

    // ========================================================
    // 13. MENGIRIM DATA KE DASHBOARD ADMIN
    // ========================================================

    admin_ok(
        'Data dashboard berhasil dimuat.',
        [
            'statistics' => $statistics,

            'model' => $model,

            'latest_reports' => $laporanTerbaru
        ]
    );

} catch (PDOException $e) {

    // Mencatat kesalahan database pada log server.
    error_log(
        '[SIPFAS ADMIN DASHBOARD SQL] ' .
        $e->getMessage()
    );

    admin_fail(
        'Gagal mengambil data dashboard dari database. Periksa log PHP.',
        500
    );

} catch (Throwable $e) {

    // Mencatat kesalahan aplikasi.
    error_log(
        '[SIPFAS ADMIN DASHBOARD] ' .
        $e->getMessage()
    );

    admin_fail(
        'Terjadi kesalahan saat memuat dashboard Administrator.',
        500
    );
}
