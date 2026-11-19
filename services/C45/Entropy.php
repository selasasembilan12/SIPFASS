<?php

namespace SIPFAS\Services\C45;

class Entropy
{
    public static function calculate(array $data, string $target = 'label'): float
    {
        $total = count($data);

        if ($total === 0) {
            return 0.0;
        }

        $counts = [];

        foreach ($data as $row) {
            $label = (string) ($row[$target] ?? '');

            if ($label === '') {
                continue;
            }

            $counts[$label] = ($counts[$label] ?? 0) + 1;
        }

        $validTotal = array_sum($counts);

        if ($validTotal === 0) {
            return 0.0;
        }

        $entropy = 0.0;

        foreach ($counts as $count) {
            $probability = $count / $validTotal;

            if ($probability > 0) {
                $entropy -= $probability * log($probability, 2);
            }
        }

        return $entropy;
    }

    public static function classCounts(
        array $data,
        string $target = 'label'
    ): array {
        $counts = [];

        foreach ($data as $row) {
            $label = (string) ($row[$target] ?? '');

            if ($label === '') {
                continue;
            }

            $counts[$label] = ($counts[$label] ?? 0) + 1;
        }

        return $counts;
    }
}