<?php

namespace SIPFAS\Services\C45;

class SplitInformation
{
    public static function calculate(
        array $data,
        string $attribute
    ): float {
        $total = count($data);

        if ($total === 0) {
            return 0.0;
        }

        $groups = [];

        foreach ($data as $row) {
            if (!array_key_exists($attribute, $row)) {
                throw new \InvalidArgumentException(
                    "Atribut {$attribute} tidak ditemukan."
                );
            }

            $value = (string) $row[$attribute];

            $groups[$value] = ($groups[$value] ?? 0) + 1;
        }

        $splitInformation = 0.0;

        foreach ($groups as $count) {
            $probability = $count / $total;

            if ($probability > 0) {
                $splitInformation -=
                    $probability * log($probability, 2);
            }
        }

        return $splitInformation;
    }
}