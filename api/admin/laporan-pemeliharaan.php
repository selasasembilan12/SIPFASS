<?php
declare(strict_types=1);

require_once __DIR__ . '/_admin-common.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(_DIR_, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

try {
    global $pdo;

    // ==========================================
    // 01. VALIDASI REQUEST
    // ==========================================

    admin_method('GET');

    if (!$pdo instanceof PDO) {
        throw new RuntimeException('Koneksi database tidak tersedia.');
    }

    [$page, $limit, $offset] = admin_page();

    $search = trim((string)($_GET['search'] ?? ''));

    $statusVerifikasi = trim(
        (string)($_GET['status_verifikasi'] ?? '')
    );

    $statusPenanganan = trim(
        (string)($_GET['status_penanganan'] ?? '')
    );

    // ==========================================
    // 02. MEMBUAT KONDISI PENCARIAN
    // ==========================================

    $where = [];
    $params = [];

    if ($search !== '') {
        $where[] = "(
            l.kode_laporan LIKE :search1
            OR f.nama_fasilitas LIKE :search2
            OR f.kode_fasilitas LIKE :search3
            OR u.nama_lengkap LIKE :search4
            OR lr.nama_lokasi LIKE :search5
        )";

        $keyword = '%' . $search . '%';

        $params[':search1'] = $keyword;
        $params[':search2'] = $keyword;
        $params[':search3'] = $keyword;
        $params[':search4'] = $keyword;
        $params[':search5'] = $keyword;
    }

    if ($statusVerifikasi !== '') {
        $where[] = 'l.status_verifikasi = :status_verifikasi';
        $params[':status_verifikasi'] = $statusVerifikasi;
    }

    if ($statusPenanganan !== '') {
        $where[] = 'l.status_penanganan = :status_penanganan';
        $params[':status_penanganan'] = $statusPenanganan;
    }

    $whereSQL = $where
        ? 'WHERE ' . implode(' AND ', $where)
        : '';

    // ==========================================
    // 03. RELASI DATABASE
    // ==========================================

    $joinSQL = "
        FROM laporan_kerusakan l

        LEFT JOIN pengguna u
            ON u.id_pengguna = l.id_pelapor

        LEFT JOIN fasilitas f
            ON f.id_fasilitas = l.id_fasilitas

        LEFT JOIN lokasi_ruangan lr
            ON lr.id_lokasi = l.id_lokasi

        LEFT JOIN (
            SELECT rv1.*
            FROM riwayat_verifikasi_laporan rv1

            INNER JOIN (
                SELECT
                    id_laporan,
                    MAX(id_riwayat_verifikasi) AS id_terakhir
                FROM riwayat_verifikasi_laporan
                GROUP BY id_laporan
            ) rv2
                ON rv2.id_terakhir = rv1.id_riwayat_verifikasi

        ) rv
            ON rv.id_laporan = l.id_laporan

        LEFT JOIN pengguna pv
            ON pv.id_pengguna = rv.id_verifikator

        LEFT JOIN (
            SELECT rp1.*
            FROM riwayat_penanganan rp1

            INNER JOIN (
                SELECT
                    id_laporan,
                    MAX(id_riwayat_penanganan) AS id_terakhir
                FROM riwayat_penanganan
                GROUP BY id_laporan
            ) rp2
                ON rp2.id_terakhir = rp1.id_riwayat_penanganan

        ) rp
            ON rp.id_laporan = l.id_laporan

        LEFT JOIN pengguna pp
            ON pp.id_pengguna = rp.id_petugas
    ";

    // ==========================================
    // 04. MENGHITUNG TOTAL DATA
    // ==========================================

    $stmtCount = $pdo->prepare("
        SELECT COUNT(*)
        {$joinSQL}
        {$whereSQL}
    ");

    $stmtCount->execute($params);

    $totalFiltered = (int)$stmtCount->fetchColumn();

    // ==========================================
    // 05. MENGAMBIL DATA LAPORAN
    // ==========================================

    $sql = "
        SELECT
            l.id_laporan,
            l.id_pelapor,
            l.id_fasilitas,
            l.id_lokasi,

            l.kode_laporan,
            l.deskripsi_kerusakan,

            l.tingkat_kerusakan_x1,
            l.dampak_akademik_x2,
            l.frekuensi_penggunaan_x3,

            l.tingkat_kerusakan_x1_terverifikasi,
            l.dampak_akademik_x2_terverifikasi,

            l.id_pelatihan_awal,
            l.prioritas_awal,

            l.id_pelatihan,
            l.prioritas_prediksi,

            l.status_verifikasi,
            l.status_penanganan,

            l.id_verifikator,
            l.id_petugas_penanggung_jawab,

            l.catatan_verifikasi,
            l.waktu_verifikasi,

            l.tanggal_dibuat,
            l.tanggal_diperbarui,

            u.nama_lengkap AS nama_pelapor,
            u.nomor_identitas,

            f.kode_fasilitas,
            f.nama_fasilitas,

            lr.nama_lokasi,
            lr.kode_lokasi,

            rv.hasil_verifikasi,
            rv.prioritas_sebelum,
            rv.prioritas_sesudah,
            rv.x1_sebelum,
            rv.x1_sesudah,
            rv.x2_sebelum,
            rv.x2_sesudah,
            rv.catatan_verifikasi AS catatan_verifikasi_terakhir,
            rv.alasan_koreksi,
            rv.waktu_verifikasi AS waktu_verifikasi_terakhir,

            pv.nama_lengkap AS nama_verifikator,

            rp.tindak_lanjut_perbaikan,
            rp.catatan_petugas,
            rp.waktu_mulai_penanganan,
            rp.waktu_selesai_penanganan,
            rp.waktu_pembaruan,

            pp.nama_lengkap AS nama_petugas

        {$joinSQL}

        {$whereSQL}

        ORDER BY
            l.tanggal_dibuat DESC,
            l.id_laporan DESC

        LIMIT :limit OFFSET :offset
    ";

    $stmt = $pdo->prepare($sql);

    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, PDO::PARAM_STR);
    }

    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // ==========================================
    // 06. FORMAT DATA UNTUK JAVASCRIPT
    // ==========================================

    $items = [];

    foreach ($rows as $row) {

        $prioritas = $row['prioritas_sesudah']
            ?: $row['prioritas_prediksi']
            ?: $row['prioritas_awal']
            ?: null;

        $verifikasi = $row['status_verifikasi']
            ?: 'Menunggu';

        $penanganan = $row['status_penanganan']
            ?: 'Menunggu';

        $catatanVerifikasi = $row['catatan_verifikasi_terakhir']
            ?: $row['catatan_verifikasi']
            ?: $row['alasan_koreksi']
            ?: null;

        $items[] = [
            'id_laporan' => (int)$row['id_laporan'],

            'id_pelapor' => (int)$row['id_pelapor'],

            'id_fasilitas' => (int)$row['id_fasilitas'],

            'id_lokasi' => (int)$row['id_lokasi'],

            'kode_laporan' => $row['kode_laporan'],

            'deskripsi_kerusakan' => $row['deskripsi_kerusakan'],

            'nama_pelapor' => $row['nama_pelapor'] ?? '-',

            'nomor_identitas' => $row['nomor_identitas'] ?? '-',

            'nama_fasilitas' => $row['nama_fasilitas'] ?? '-',

            'kode_fasilitas' => $row['kode_fasilitas'] ?? '-',

            'nama_lokasi' => $row['nama_lokasi'] ?? '-',

            'kode_lokasi' => $row['kode_lokasi'] ?? '-',

            'tingkat_kerusakan_x1' =>
                (int)$row['tingkat_kerusakan_x1'],

            'dampak_akademik_x2' =>
                (int)$row['dampak_akademik_x2'],

            'frekuensi_penggunaan_x3' =>
                (int)$row['frekuensi_penggunaan_x3'],

            'tingkat_kerusakan_x1_terverifikasi' =>
                $row['tingkat_kerusakan_x1_terverifikasi'] !== null
                    ? (int)$row['tingkat_kerusakan_x1_terverifikasi']
                    : null,

            'dampak_akademik_x2_terverifikasi' =>
                $row['dampak_akademik_x2_terverifikasi'] !== null
                    ? (int)$row['dampak_akademik_x2_terverifikasi']
                    : null,

            'prioritas_awal' => $row['prioritas_awal'],

            'prioritas_prediksi' => $row['prioritas_prediksi'],

            'prioritas_rekomendasi' => $prioritas,

            'status_verifikasi' => $verifikasi,

            'hasil_verifikasi' => $row['hasil_verifikasi'],

            'status_penanganan' => $penanganan,

            'catatan_verifikasi' => $catatanVerifikasi,

            'waktu_verifikasi' =>
                $row['waktu_verifikasi_terakhir']
                ?: $row['waktu_verifikasi'],

            'nama_verifikator' => $row['nama_verifikator'] ?? '-',

            'tindak_lanjut_perbaikan' =>
                $row['tindak_lanjut_perbaikan'],

            'catatan_petugas' => $row['catatan_petugas'],

            'waktu_mulai_penanganan' =>
                $row['waktu_mulai_penanganan'],

            'waktu_selesai_penanganan' =>
                $row['waktu_selesai_penanganan'],

            'nama_petugas' => $row['nama_petugas'] ?? '-',

            'tanggal_dibuat' => $row['tanggal_dibuat'],

            'tanggal_diperbarui' => $row['tanggal_diperbarui']
        ];
    }

    // ==========================================
    // 07. STATISTIK SELURUH LAPORAN
    // ==========================================

    $stats = $pdo->query("
        SELECT
            COUNT(*) AS total,

            SUM(
                CASE
                    WHEN LOWER(status_verifikasi) LIKE '%menunggu%'
                    THEN 1 ELSE 0
                END
            ) AS menunggu,

            SUM(
                CASE
                    WHEN
                        LOWER(status_penanganan) LIKE '%proses%'
                        OR LOWER(status_penanganan) LIKE '%perbaikan%'
                        OR LOWER(status_penanganan) LIKE '%ditangani%'
                    THEN 1 ELSE 0
                END
            ) AS diproses,

            SUM(
                CASE
                    WHEN LOWER(status_penanganan) LIKE '%selesai%'
                    THEN 1 ELSE 0
                END
            ) AS selesai

        FROM laporan_kerusakan
    ")->fetch(PDO::FETCH_ASSOC);

    // ==========================================
    // 08. RESPONSE
    // ==========================================

    admin_ok(
        'Laporan pemeliharaan berhasil dimuat dari database.',
        [
            'items' => $items,

            'statistics' => [
                'total' => (int)($stats['total'] ?? 0),
                'menunggu' => (int)($stats['menunggu'] ?? 0),
                'diproses' => (int)($stats['diproses'] ?? 0),
                'selesai' => (int)($stats['selesai'] ?? 0)
            ],

            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $totalFiltered,
                'total_pages' => max(
                    1,
                    (int)ceil($totalFiltered / $limit)
                )
            ],

            'csrf_token' => sipfas_csrf_token()
        ]
    );

} catch (Throwable $e) {

    error_log(
        '[SIPFAS ADMIN LAPORAN] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    admin_exception($e);
}
