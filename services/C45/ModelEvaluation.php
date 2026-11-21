<?php
// ModelEvaluation.php melakukan pengujian menggunakan data testing, termasuk akurasi dan confusion matrix.
namespace SIPFAS\Services\C45;

class ModelEvaluation
{
    public const CLASSES = [
        'Rendah',
        'Sedang',
        'Tinggi'
    ];

    public static function split(
        array $data,
        int $trainPercent = 80,
        int $seed = 42
    ): array {
        if ($trainPercent < 1 || $trainPercent > 99) {
            throw new \InvalidArgumentException(
                'Persentase training harus antara 1 sampai 99.'
            );
        }

        if (count($data) < 2) {
            throw new \InvalidArgumentException(
                'Dataset minimal harus memiliki dua data.'
            );
        }

        $groups = [];

        foreach ($data as $row) {
            $label = (string) ($row['label'] ?? '');

            if (!in_array($label, self::CLASSES, true)) {
                throw new \InvalidArgumentException(
                    'Label dataset tidak valid: ' . $label
                );
            }

            $groups[$label][] = $row;
        }

        $training = [];
        $testing = [];

        foreach (self::CLASSES as $label) {
            $group = $groups[$label] ?? [];

            if (empty($group)) {
                continue;
            }

            // Pengacakan deterministik berdasarkan seed dan ID data.
            usort($group, function ($a, $b) use ($seed, $label) {
                $idA = (string) ($a['id'] ?? '');
                $idB = (string) ($b['id'] ?? '');

                $hashA = hash(
                    'sha256',
                    $seed . '|' . $label . '|' . $idA
                );

                $hashB = hash(
                    'sha256',
                    $seed . '|' . $label . '|' . $idB
                );

                return strcmp($hashA, $hashB);
            });

            $count = count($group);

            // Satu sampel tidak dapat dibagi menjadi train dan test.
            if ($count === 1) {
                $training[] = $group[0];
                continue;
            }

            $testCount = (int) round(
                $count * (100 - $trainPercent) / 100
            );

            $testCount = max(1, $testCount);
            $testCount = min($count - 1, $testCount);

            $testing = array_merge(
                $testing,
                array_slice($group, 0, $testCount)
            );

            $training = array_merge(
                $training,
                array_slice($group, $testCount)
            );
        }

        if (empty($training) || empty($testing)) {
            throw new \RuntimeException(
                'Pembagian dataset tidak menghasilkan data latih dan uji. ' .
                'Periksa jumlah sampel setiap kelas.'
            );
        }

        return [
            'training' => array_values($training),
            'testing' => array_values($testing),
            'training_count' => count($training),
            'testing_count' => count($testing)
        ];
    }

    public static function evaluate(
        DecisionTree $model,
        array $tree,
        array $testing
    ): array {
        if (empty($testing)) {
            throw new \InvalidArgumentException(
                'Data testing tidak boleh kosong.'
            );
        }

        $classes = self::CLASSES;

        $matrix = [];

        foreach ($classes as $actual) {
            foreach ($classes as $predicted) {
                $matrix[$actual][$predicted] = 0;
            }
        }

        $predictions = [];
        $correct = 0;

        foreach ($testing as $row) {
            $actual = (string) $row['label'];

            $predicted = $model->predict(
                $tree,
                $row
            );

            if (!isset($matrix[$actual][$predicted])) {
                throw new \RuntimeException(
                    'Prediksi menghasilkan kelas yang tidak valid.'
                );
            }

            $matrix[$actual][$predicted]++;

            $isCorrect = $actual === $predicted;

            if ($isCorrect) {
                $correct++;
            }

            $predictions[] = [
                'id' => $row['id'] ?? null,
                'x1' => $row['x1'],
                'x2' => $row['x2'],
                'x3' => $row['x3'],
                'actual' => $actual,
                'predicted' => $predicted,
                'correct' => $isCorrect
            ];
        }

        $total = count($testing);

        $accuracy = $correct / $total;

        $classMetrics = [];

        foreach ($classes as $label) {
            $tp = $matrix[$label][$label];

            $fp = 0;
            $fn = 0;

            foreach ($classes as $other) {
                if ($other !== $label) {
                    $fp += $matrix[$other][$label];
                    $fn += $matrix[$label][$other];
                }
            }

            $precision = self::divide(
                $tp,
                $tp + $fp
            );

            $recall = self::divide(
                $tp,
                $tp + $fn
            );

            $f1 = self::divide(
                2 * $precision * $recall,
                $precision + $recall
            );

            $classMetrics[$label] = [
                'true_positive' => $tp,
                'false_positive' => $fp,
                'false_negative' => $fn,
                'precision' => $precision,
                'recall' => $recall,
                'f1_score' => $f1
            ];
        }

        $macroPrecision = 0.0;
        $macroRecall = 0.0;
        $macroF1 = 0.0;

        foreach ($classMetrics as $metrics) {
            $macroPrecision += $metrics['precision'];
            $macroRecall += $metrics['recall'];
            $macroF1 += $metrics['f1_score'];
        }

        $classCount = count($classes);

        return [
            'total_testing' => $total,
            'correct' => $correct,
            'incorrect' => $total - $correct,
            'accuracy' => $accuracy,
            'error_rate' => 1 - $accuracy,
            'macro_precision' => $macroPrecision / $classCount,
            'macro_recall' => $macroRecall / $classCount,
            'macro_f1' => $macroF1 / $classCount,
            'confusion_matrix' => $matrix,
            'class_metrics' => $classMetrics,
            'predictions' => $predictions
        ];
    }

    private static function divide(
        float $numerator,
        float $denominator
    ): float {
        return $denominator > 0
            ? $numerator / $denominator
            : 0.0;
    }
}