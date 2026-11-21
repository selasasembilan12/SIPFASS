<?php
declare(strict_types=1);


require_once __DIR__ . '/_admin-common.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(_DIR_, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

try {

    global $pdo;

    // ==============================================
    // 01. VALIDASI
    // ==============================================

    admin_method('GET');

    if (!$pdo instanceof PDO) {
        throw new RuntimeException(
            'Koneksi database tidak tersedia.'
        );
    }

    // ==============================================
    // 02. DETAIL PENGUJIAN BERDASARKAN ID
    // ==============================================

    $id = filter_var(
        $_GET['id_pelatihan'] ?? null,
        FILTER_VALIDATE_INT
    );

    if ($id !== false && $id !== null) {

        if ($id < 1) {
            admin_fail(
                'ID pelatihan tidak valid.',
                422
            );
        }

        // ------------------------------------------
        // DATA MODEL
        // ------------------------------------------

        $modelStatement = $pdo->prepare("
            SELECT
                id_pelatihan,
                versi_algoritma,
                persentase_latih,
                persentase_uji,
                jumlah_dataset,
                jumlah_data_latih,
                jumlah_data_uji,
                atribut_akar,
                struktur_pohon,
                akurasi,
                presisi,
                recall,
                skor_f1,
                tingkat_kesalahan,
                status_model,
                id_pelatih,
                waktu_pelatihan

            FROM riwayat_pelatihan_c45

            WHERE id_pelatihan = :id

            LIMIT 1
        ");

        $modelStatement->execute([
            ':id' => $id
        ]);

        $model = $modelStatement->fetch(
            PDO::FETCH_ASSOC
        );

        if (!$model) {
            admin_fail(
                'Riwayat pengujian tidak ditemukan.',
                404
            );
        }

        // ------------------------------------------
        // DECODE DECISION TREE
        // ------------------------------------------

        $treeJSON = $model['struktur_pohon'];

        $model['struktur_pohon'] = null;

        if (
            is_string($treeJSON) &&
            $treeJSON !== ''
        ) {

            $tree = json_decode(
                $treeJSON,
                true
            );

            if (
                json_last_error() === JSON_ERROR_NONE &&
                is_array($tree)
            ) {
                $model['struktur_pohon'] = $tree;
            }
        }

        // ------------------------------------------
        // DETAIL DATA LATIH DAN DATA UJI
        // ------------------------------------------

        $detailStatement = $pdo->prepare("
            SELECT
                id_detail,
                id_pelatihan,
                id_data,
                jenis_data,
                label_sebenarnya,
                label_prediksi,
                status_prediksi

            FROM detail_pelatihan_c45

            WHERE id_pelatihan = :id

            ORDER BY id_detail ASC
        ");

        $detailStatement->execute([
            ':id' => $id
        ]);

        $details = $detailStatement->fetchAll(
            PDO::FETCH_ASSOC
        );

        // ------------------------------------------
        // PERHITUNGAN ATRIBUT
        // ------------------------------------------

        $calculationStatement = $pdo->prepare("
            SELECT
                id_perhitungan,
                id_pelatihan,
                nama_node,
                nama_atribut,
                nilai_entropy,
                perolehan_informasi,
                nilai_informasi_pemisah,
                rasio_gain,
                terpilih_sebagai_akar

            FROM perhitungan_atribut_c45

            WHERE id_pelatihan = :id

            ORDER BY id_perhitungan ASC
        ");

        $calculationStatement->execute([
            ':id' => $id
        ]);

        $calculations = $calculationStatement->fetchAll(
            PDO::FETCH_ASSOC
        );

        // ------------------------------------------
        // FORMAT DETAIL PREDIKSI
        // ------------------------------------------

        $predictions = [];

        $matrix = [
            'Rendah' => [
                'Rendah' => 0,
                'Sedang' => 0,
                'Tinggi' => 0
            ],
            'Sedang' => [
                'Rendah' => 0,
                'Sedang' => 0,
                'Tinggi' => 0
            ],
            'Tinggi' => [
                'Rendah' => 0,
                'Sedang' => 0,
                'Tinggi' => 0
            ]
        ];

        foreach ($details as $detail) {

            if ($detail['jenis_data'] !== 'Uji') {
                continue;
            }

            $actual = (string)$detail['label_sebenarnya'];

            $predicted = (string)$detail['label_prediksi'];

            $correct = (int)$detail['status_prediksi'] === 1;

            $predictions[] = [
                'id_data' => (int)$detail['id_data'],

                'actual' => $actual,

                'predicted' => $predicted,

                'correct' => $correct
            ];

            if (
                isset($matrix[$actual]) &&
                isset($matrix[$actual][$predicted])
            ) {
                $matrix[$actual][$predicted]++;
            }
        }

        // ------------------------------------------
        // RESPONSE DETAIL
        // ------------------------------------------

        admin_ok(
            'Detail hasil pengujian berhasil dimuat.',
            [
                'history' => $model,

                'details' => $details,

                'predictions' => $predictions,

                'confusion_matrix' => $matrix,

                'attribute_calculations' => $calculations
            ]
        );
    }

    // ==============================================
    // 03. MENGAMBIL RIWAYAT PENGUJIAN
    // ==============================================

    [$page, $limit, $offset] = admin_page();

    $total = (int)$pdo->query("
        SELECT COUNT(*)
        FROM riwayat_pelatihan_c45
    ")->fetchColumn();

    $historyStatement = $pdo->prepare("
        SELECT
            id_pelatihan,
            versi_algoritma,
            persentase_latih,
            persentase_uji,
            jumlah_dataset,
            jumlah_data_latih,
            jumlah_data_uji,
            atribut_akar,
            akurasi,
            presisi,
            recall,
            skor_f1,
            tingkat_kesalahan,
            status_model,
            id_pelatih,
            waktu_pelatihan

        FROM riwayat_pelatihan_c45

        ORDER BY id_pelatihan DESC

        LIMIT :limit OFFSET :offset
    ");

    $historyStatement->bindValue(
        ':limit',
        $limit,
        PDO::PARAM_INT
    );

    $historyStatement->bindValue(
        ':offset',
        $offset,
        PDO::PARAM_INT
    );

    $historyStatement->execute();

    $items = $historyStatement->fetchAll(
        PDO::FETCH_ASSOC
    );

    // ==============================================
    // 04. MODEL AKTIF
    // ==============================================

    $activeStatement = $pdo->query("
        SELECT
            id_pelatihan,
            status_model,
            akurasi,
            presisi,
            recall,
            skor_f1,
            waktu_pelatihan

        FROM riwayat_pelatihan_c45

        WHERE status_model = 'Aktif'

        ORDER BY id_pelatihan DESC

        LIMIT 1
    ");

    $activeModel = $activeStatement->fetch(
        PDO::FETCH_ASSOC
    ) ?: null;

    // ==============================================
    // 05. RESPONSE RIWAYAT
    // ==============================================

    admin_ok(
        'Riwayat hasil pengujian berhasil dimuat.',
        [
            'items' => $items,

            'active_model' => $activeModel,

            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,

                'total_pages' => max(
                    1,
                    (int)ceil($total / $limit)
                )
            ]
        ]
    );

} catch (Throwable $e) {

    error_log(
        '[SIPFAS HASIL PENGUJIAN] ' .
        $e->getMessage()
    );

    admin_exception($e);
}
