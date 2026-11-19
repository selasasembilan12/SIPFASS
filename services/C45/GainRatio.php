<?php

namespace SIPFAS\Services\C45;

class GainRatio
{
    public static function calculate(
        array $data,
        string $attribute,
        string $target = 'label'
    ): float {
        $gain = InformationGain::calculate(
            $data,
            $attribute,
            $target
        );

        $splitInfo = SplitInformation::calculate(
            $data,
            $attribute
        );

        if ($splitInfo <= 0) {
            return 0.0;
        }

        return $gain / $splitInfo;
    }

    public static function evaluate(
        array $data,
        array $attributes,
        string $target = 'label'
    ): array {
        $results = [];

        foreach ($attributes as $attribute) {
            $gain = InformationGain::calculate(
                $data,
                $attribute,
                $target
            );

            $splitInfo = SplitInformation::calculate(
                $data,
                $attribute
            );

            $gainRatio = $splitInfo > 0
                ? $gain / $splitInfo
                : 0.0;

            $results[] = [
                'attribute' => $attribute,
                'entropy' => Entropy::calculate($data, $target),
                'information_gain' => $gain,
                'split_information' => $splitInfo,
                'gain_ratio' => $gainRatio
            ];
        }

        return $results;
    }

    public static function bestAttribute(
        array $data,
        array $attributes,
        string $target = 'label'
    ): ?array {
        if (empty($data) || empty($attributes)) {
            return null;
        }

        $evaluations = self::evaluate(
            $data,
            $attributes,
            $target
        );

        $valid = array_values(array_filter(
            $evaluations,
            function ($item) {
                return $item['split_information'] > 0;
            }
        ));

        if (empty($valid)) {
            return null;
        }

        $averageGain = array_sum(array_column(
            $valid,
            'information_gain'
        )) / count($valid);

        $eligible = array_values(array_filter(
            $valid,
            function ($item) use ($averageGain) {
                return $item['information_gain'] >= $averageGain;
            }
        ));

        $candidates = !empty($eligible)
            ? $eligible
            : $valid;

        usort($candidates, function ($a, $b) {
            $ratioComparison =
                $b['gain_ratio'] <=> $a['gain_ratio'];

            if ($ratioComparison !== 0) {
                return $ratioComparison;
            }

            return $b['information_gain']
                <=> $a['information_gain'];
        });

        if ($candidates[0]['gain_ratio'] <= 0) {
            return null;
        }

        return $candidates[0];
    }
}