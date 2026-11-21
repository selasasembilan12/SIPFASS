<?php
declare(strict_types=1);

require_once __DIR__ . '/_admin-common.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(__DIR__, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

require_once dirname(__DIR__, 2) .
    '/services/C45/C45Service.php';

use SIPFAS\Services\C45\C45Service;

try {

    global $pdo;

    // ==================================================
    // 01. VALIDASI REQUEST
    // ==================================================

    $method = admin_method('GET', 'POST');

    if (!$pdo instanceof PDO) {
        throw new RuntimeException(
            'Koneksi database tidak tersedia.'
        );
    }

    $adminId = admin_user_id();

    if ($adminId < 1) {
        admin_fail(
            'Sesi Administrator tidak valid.',
            401
        );
    }

    // ==================================================
    // 02. MENGAMBIL DATA MODEL DAN RIWAYAT
    // ==================================================

    if ($method === 'GET') {

        // ----------------------------------------------
        // RIWAYAT PELATIHAN
        // ----------------------------------------------

        $historyStatement = $pdo->query("
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

            LIMIT 20
        ");

        $history = $historyStatement->fetchAll(
            PDO::FETCH_ASSOC
        );

        // ----------------------------------------------
        // MODEL AKTIF
        // ----------------------------------------------

        $activeStatement = $pdo->query("
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

            WHERE status_model = 'Aktif'

            ORDER BY id_pelatihan DESC

            LIMIT 1
        ");

        $active = $activeStatement->fetch(
            PDO::FETCH_ASSOC
        ) ?: null;

        $activeEvaluations = [];

        // ----------------------------------------------
        // STRUKTUR POHON DAN EVALUASI ATRIBUT
        // ----------------------------------------------

        if ($active) {

            $treeJSON = $active['struktur_pohon'] ?? null;

            $active['struktur_pohon'] = null;

            if (
                is_string($treeJSON) &&
                $treeJSON !== ''
            ) {

                $decodedTree = json_decode(
                    $treeJSON,
                    true
                );

                if (
                    json_last_error() === JSON_ERROR_NONE &&
                    is_array($decodedTree)
                ) {
                    $active['struktur_pohon'] = $decodedTree;
                }
            }

            $evaluationStatement = $pdo->prepare("
                SELECT
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

            $evaluationStatement->execute([
                ':id' => (int)$active['id_pelatihan']
            ]);

            $evaluationRows = $evaluationStatement->fetchAll(
                PDO::FETCH_ASSOC
            );

            foreach ($evaluationRows as $row) {

                $attribute = strtolower(
                    (string)$row['nama_atribut']
                );

                $activeEvaluations[] = [
                    'node' => $row['nama_node'],

                    'attribute' => $attribute,

                    'nama_atribut' => $attribute,

                    'entropy' => (float)$row['nilai_entropy'],

                    'information_gain' =>
                        (float)$row['perolehan_informasi'],

                    'split_information' =>
                        (float)$row['nilai_informasi_pemisah'],

                    'gain_ratio' =>
                        (float)$row['rasio_gain'],

                    'selected' =>
                        (bool)$row['terpilih_sebagai_akar']
                ];
            }
        }

        // ----------------------------------------------
        // RESPONSE GET
        // ----------------------------------------------

        admin_ok(
            'Data pelatihan C4.5 berhasil dimuat.',
            [
                'items' => $history,

                'active_model' => $active,

                'active_evaluations' => $activeEvaluations,

                'csrf_token' => sipfas_csrf_token()
            ]
        );
    }

    // ==================================================
    // 03. MEMBACA PARAMETER PELATIHAN
    // ==================================================

    $input = admin_input();

    $trainPercent = filter_var(
        $input['persentase_latih'] ?? 80,
        FILTER_VALIDATE_INT
    );

    $seed = filter_var(
        $input['seed'] ?? 42,
        FILTER_VALIDATE_INT
    );

    if (
        $trainPercent === false ||
        $trainPercent < 1 ||
        $trainPercent > 99
    ) {
        admin_fail(
            'Persentase data latih harus antara 1 sampai 99.',
            422
        );
    }

    if (
        $seed === false ||
        $seed < 0
    ) {
        admin_fail(
            'Seed pengacakan tidak valid.',
            422
        );
    }

    // ==================================================
    // 04. MENJALANKAN ALGORITMA C4.5
    // ==================================================

    $service = new C45Service();

    $result = $service->train(
        $pdo,
        (int)$trainPercent,
        (int)$seed
    );

    $evaluation = $result['evaluation'];

    $tree = $result['decision_tree'];

    $rootAttribute = $result['root_attribute'];

    if (
        !is_array($tree) ||
        empty($tree)
    ) {
        admin_fail(
            'Pohon keputusan tidak berhasil dibentuk.',
            422
        );
    }

    // ==================================================
    // 05. VALIDASI HASIL EVALUASI
    // ==================================================

    $percent = static function ($value): float {

        return round(
            (float)$value * 100,
            2
        );
    };

    $accuracy = $percent(
        $evaluation['accuracy'] ?? 0
    );

    $precision = $percent(
        $evaluation['macro_precision'] ?? 0
    );

    $recall = $percent(
        $evaluation['macro_recall'] ?? 0
    );

    $f1 = $percent(
        $evaluation['macro_f1'] ?? 0
    );

    $errorRate = $percent(
        $evaluation['error_rate'] ?? 0
    );

    // ==================================================
    // 06. TRANSAKSI PENYIMPANAN MODEL
    // ==================================================

    $pdo->beginTransaction();

    try {

        // ----------------------------------------------
        // ARSIPKAN MODEL AKTIF SEBELUMNYA
        // ----------------------------------------------

        $pdo->exec("
            UPDATE riwayat_pelatihan_c45

            SET status_model = 'Arsip'

            WHERE status_model = 'Aktif'
        ");

        // ----------------------------------------------
        // SIMPAN MODEL BARU
        // ----------------------------------------------

        $insertModel = $pdo->prepare("
            INSERT INTO riwayat_pelatihan_c45 (

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
                id_pelatih

            ) VALUES (

                'C4.5',

                :train_percent,
                :test_percent,

                :dataset_count,
                :training_count,
                :testing_count,

                :root_attribute,
                :tree,

                :accuracy,
                :precision,
                :recall,
                :f1,
                :error_rate,

                'Aktif',
                :trainer

            )
        ");

        $treeJSON = json_encode(
            $tree,
            JSON_UNESCAPED_UNICODE |
            JSON_UNESCAPED_SLASHES |
            JSON_THROW_ON_ERROR
        );

        $insertModel->execute([

            ':train_percent' =>
                (int)$result['training_percentage'],

            ':test_percent' =>
                (int)$result['testing_percentage'],

            ':dataset_count' =>
                (int)$result['dataset_count'],

            ':training_count' =>
                (int)$result['training_count'],

            ':testing_count' =>
                (int)$result['testing_count'],

            ':root_attribute' =>
                $rootAttribute,

            ':tree' => $treeJSON,

            ':accuracy' => $accuracy,

            ':precision' => $precision,

            ':recall' => $recall,

            ':f1' => $f1,

            ':error_rate' => $errorRate,

            ':trainer' => $adminId

        ]);

        $trainingId = (int)$pdo->lastInsertId();

        // ==================================================
        // 07. MENYIMPAN PERHITUNGAN ATRIBUT
        // ==================================================

        $insertCalculation = $pdo->prepare("
            INSERT INTO perhitungan_atribut_c45 (

                id_pelatihan,
                nama_node,
                nama_atribut,

                nilai_entropy,
                perolehan_informasi,
                nilai_informasi_pemisah,
                rasio_gain,

                terpilih_sebagai_akar

            ) VALUES (

                :training_id,
                'ROOT',
                :attribute,

                :entropy,
                :gain,
                :split_info,
                :gain_ratio,

                :selected

            )
        ");

        foreach (
            $result['root_evaluations'] as $item
        ) {

            $attribute = strtolower(
                (string)$item['attribute']
            );

            $insertCalculation->execute([

                ':training_id' => $trainingId,

                ':attribute' => $attribute,

                ':entropy' => round(
                    (float)$item['entropy'],
                    6
                ),

                ':gain' => round(
                    (float)$item['information_gain'],
                    6
                ),

                ':split_info' => round(
                    (float)$item['split_information'],
                    6
                ),

                ':gain_ratio' => round(
                    (float)$item['gain_ratio'],
                    6
                ),

                ':selected' =>
                    $attribute === $rootAttribute ? 1 : 0

            ]);
        }

        // ==================================================
        // 08. MENYIMPAN DETAIL DATA LATIH DAN DATA UJI
        // ==================================================

        $insertDetail = $pdo->prepare("
            INSERT INTO detail_pelatihan_c45 (

                id_pelatihan,
                id_data,
                jenis_data,

                label_sebenarnya,
                label_prediksi,
                status_prediksi

            ) VALUES (

                :training_id,
                :data_id,
                :kind,

                :actual,
                :predicted,
                :correct

            )
        ");

        // ----------------------------------------------
        // DATA LATIH
        // ----------------------------------------------

        foreach ($result['training_data'] as $row) {

            $insertDetail->execute([

                ':training_id' => $trainingId,

                ':data_id' => (int)$row['id'],

                ':kind' => 'Latih',

                ':actual' => (string)$row['label'],

                ':predicted' => null,

                ':correct' => null

            ]);
        }

        // ----------------------------------------------
        // DATA UJI
        // ----------------------------------------------

        foreach ($evaluation['predictions'] as $row) {

            $insertDetail->execute([

                ':training_id' => $trainingId,

                ':data_id' => (int)$row['id'],

                ':kind' => 'Uji',

                ':actual' => (string)$row['actual'],

                ':predicted' => (string)$row['predicted'],

                ':correct' =>
                    !empty($row['correct']) ? 1 : 0

            ]);
        }

        // ----------------------------------------------
        // SELESAIKAN TRANSAKSI
        // ----------------------------------------------

        $pdo->commit();

    } catch (Throwable $e) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $e;
    }

    // ==================================================
    // 09. NAMA ATRIBUT
    // ==================================================

    $attributeNames = [

        'x1' => 'Tingkat Kerusakan',

        'x2' => 'Dampak Akademik',

        'x3' => 'Frekuensi Penggunaan'

    ];

    // ==================================================
    // 10. RESPONSE PELATIHAN BERHASIL
    // ==================================================

    admin_ok(
        'Pelatihan C4.5 berhasil dijalankan dan model tersimpan.',
        [

            'id_pelatihan' => $trainingId,

            'algorithm' => $result['algorithm'],

            'dataset_count' => $result['dataset_count'],

            'invalid_count' => $result['invalid_count'],

            'invalid_rows' => $result['invalid_rows'],

            'training_count' => $result['training_count'],

            'testing_count' => $result['testing_count'],

            'training_percentage' =>
                $result['training_percentage'],

            'testing_percentage' =>
                $result['testing_percentage'],

            'root_attribute' => $rootAttribute,

            'root_attribute_name' =>
                $attributeNames[$rootAttribute] ?? $rootAttribute,

            'root_evaluations' =>
                $result['root_evaluations'],

            'decision_tree' => $tree,

            'evaluation' => $evaluation,

            'trained_at' => $result['trained_at']

        ],
        201
    );

} catch (PDOException $e) {

    error_log(
        '[SIPFAS C4.5 DATABASE] ' . $e->getMessage()
    );

    admin_exception($e);

} catch (Throwable $e) {

    error_log(
        '[SIPFAS C4.5 TRAINING] ' . $e->getMessage()
    );

    admin_fail(
        $e instanceof InvalidArgumentException ||
        $e instanceof RuntimeException
            ? $e->getMessage()
            : 'Pelatihan C4.5 gagal. Periksa log PHP.',
        422
    );
}
