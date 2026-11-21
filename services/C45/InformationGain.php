<?php
// Information Gain: Mengukur seberapa besar suatu atribut mengurangi ketidakpastian data.
namespace SIPFAS\Services\C45;

class InformationGain
{
    public static function calculate(
        array $data,
        string $attribute,
        string $target = 'label'
    ): float {
        $total = count($data);

        if ($total === 0) {
            return 0.0;
        }

        $initialEntropy = Entropy::calculate($data, $target);

        $groups = [];

        foreach ($data as $row) {
            if (!array_key_exists($attribute, $row)) {
                throw new \InvalidArgumentException(
                    "Atribut {$attribute} tidak ditemukan."
                );
            }

            $value = (string) $row[$attribute];

            $groups[$value][] = $row;
        }

        $remainingEntropy = 0.0;

        foreach ($groups as $group) {
            $probability = count($group) / $total;

            $remainingEntropy +=
                $probability * Entropy::calculate($group, $target);
        }

        return max(0.0, $initialEntropy - $remainingEntropy);
    }
}