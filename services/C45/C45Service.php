<?php
// C45Service.php menghubungkan proses pengambilan dataset, pelatihan, pembentukan pohon, dan prediksi.
namespace SIPFAS\Services\C45;

require_once __DIR__ . '/Entropy.php';
require_once __DIR__ . '/InformationGain.php';
require_once __DIR__ . '/SplitInformation.php';
require_once __DIR__ . '/GainRatio.php';
require_once __DIR__ . '/DecisionTree.php';
require_once __DIR__ . '/ModelEvaluation.php';

use PDO;

class C45Service
{
    private const ATTRIBUTES = [
        'x1',
        'x2',
        'x3'
    ];

    private const ATTRIBUTE_NAMES = [
        'x1' => 'Tingkat Kerusakan',
        'x2' => 'Dampak Akademik',
        'x3' => 'Frekuensi Penggunaan'
    ];

    private const VALID_CLASSES = [
        'Rendah',
        'Sedang',
        'Tinggi'
    ];



//  * Konversi frekuensi penggunaan fasilitas ke kategori X3.

public static function mapFrekuensiPenggunaan(int $frekuensi): int
{
    // Validasi jumlah hari penggunaan.
    if ($frekuensi < 0 || $frekuensi > 7) {
        throw new \InvalidArgumentException(
            'Frekuensi penggunaan fasilitas harus antara 0 sampai 7 hari.'
        );
    }

    // 0-2 hari = Jarang.
    if ($frekuensi <= 2) {
        return 1;
    }

    // 3-4 hari = Sedang.
    if ($frekuensi <= 4) {
        return 2;
    }

    // 5-7 hari = Sering.
    return 3;
}

    //  * Mengambil dataset langsung dari database SIPFAS.

    public function getDataset(PDO $pdo): array
    {
        $sql = "
            SELECT
                id_data,
                kode_data,
                nama_fasilitas,
                tingkat_kerusakan_x1,
                dampak_akademik_x2,
                frekuensi_penggunaan_x3,
                label_prioritas
            FROM dataset_c45
            ORDER BY id_data ASC
        ";

        $statement = $pdo->query($sql);

        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);

        $dataset = [];
        $invalid = [];

        foreach ($rows as $row) {
            $x1 = filter_var(
                $row['tingkat_kerusakan_x1'],
                FILTER_VALIDATE_INT
            );

            $x2 = filter_var(
                $row['dampak_akademik_x2'],
                FILTER_VALIDATE_INT
            );

            $x3 = filter_var(
                $row['frekuensi_penggunaan_x3'],
                FILTER_VALIDATE_INT
            );

            $label = trim(
                (string) $row['label_prioritas']
            );

            if (
                !in_array($x1, [1, 2, 3], true) ||
                !in_array($x2, [1, 2, 3], true) ||
                !in_array($x3, [1, 2, 3], true) ||
                !in_array($label, self::VALID_CLASSES, true)
            ) {
                $invalid[] = [
                    'id_data' => $row['id_data'],
                    'reason' => 'Atribut atau label tidak valid.'
                ];

                continue;
            }

            $dataset[] = [
                'id' => (int) $row['id_data'],
                'kode_data' => $row['kode_data'],
                'facility' => $row['nama_fasilitas'],
                'x1' => $x1,
                'x2' => $x2,
                'x3' => $x3,
                'label' => $label
            ];
        }

        return [
            'data' => $dataset,
            'total_database' => count($rows),
            'valid_count' => count($dataset),
            'invalid_count' => count($invalid),
            'invalid_rows' => $invalid
        ];
    }

    /**
     * Menjalankan proses pelatihan dan pengujian C4.5.
     */
    public function train(
        PDO $pdo,
        int $trainPercent = 80,
        int $seed = 42
    ): array {
        $datasetResult = $this->getDataset($pdo);

        $dataset = $datasetResult['data'];

        if (count($dataset) < 2) {
            throw new \RuntimeException(
                'Dataset valid minimal harus berjumlah dua data.'
            );
        }

        // Pembagian dataset.
        $split = ModelEvaluation::split(
            $dataset,
            $trainPercent,
            $seed
        );

        $training = $split['training'];
        $testing = $split['testing'];

        // Evaluasi kandidat atribut pada akar.
        $rootEvaluations = GainRatio::evaluate(
            $training,
            self::ATTRIBUTES,
            'label'
        );

        // Membuat model decision tree.
        $decisionTree = new DecisionTree(
            'label',
            self::ATTRIBUTE_NAMES
        );

        $tree = $decisionTree->train(
            $training,
            self::ATTRIBUTES
        );

        // Mengambil atribut akar.
        $rootAttribute = $decisionTree->getRootAttribute(
            $tree
        );

        // Pengujian menggunakan data yang tidak dilatih.
        $evaluation = ModelEvaluation::evaluate(
            $decisionTree,
            $tree,
            $testing
        );

        $rootName = $rootAttribute !== null
            ? self::ATTRIBUTE_NAMES[$rootAttribute]
            : null;

        return [
            'algorithm' => 'Decision Tree C4.5',

            'dataset_count' => count($dataset),

            'invalid_count' => $datasetResult['invalid_count'],

            'invalid_rows' => $datasetResult['invalid_rows'],

            'training_count' => count($training),

            'testing_count' => count($testing),

            // Dibutuhkan API untuk menyimpan jejak data latih ke detail_pelatihan_c45.
            'training_data' => $training,

            'training_percentage' => $trainPercent,

            'testing_percentage' => 100 - $trainPercent,

            'seed' => $seed,

            'root_attribute' => $rootAttribute,

            'root_attribute_name' => $rootName,

            'root_evaluations' => $rootEvaluations,

            'decision_tree' => $tree,

            'evaluation' => $evaluation,

            'trained_at' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Menghitung prediksi dari model yang telah dilatih.
     *
     * Tidak melakukan pelatihan ulang.
     */
    public function predict(
        array $tree,
        array $input
    ): string {
        foreach (self::ATTRIBUTES as $attribute) {
            if (!isset($input[$attribute])) {
                throw new \InvalidArgumentException(
                    "Atribut {$attribute} wajib diisi."
                );
            }

            $value = filter_var(
                $input[$attribute],
                FILTER_VALIDATE_INT
            );

            if (!in_array($value, [1, 2, 3], true)) {
                throw new \InvalidArgumentException(
                    "Nilai {$attribute} harus 1, 2, atau 3."
                );
            }

            $input[$attribute] = $value;
        }

        $decisionTree = new DecisionTree(
            'label',
            self::ATTRIBUTE_NAMES
        );

        return $decisionTree->predict(
            $tree,
            $input
        );
    }
}