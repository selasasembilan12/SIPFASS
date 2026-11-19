<?php

namespace SIPFAS\Services\C45;

class DecisionTree
{
    private string $target;

    private array $attributeNames;

    public function __construct(
        string $target = 'label',
        array $attributeNames = []
    ) {
        $this->target = $target;

        $this->attributeNames = $attributeNames ?: [
            'x1' => 'Tingkat Kerusakan',
            'x2' => 'Dampak Akademik',
            'x3' => 'Frekuensi Penggunaan'
        ];
    }

    public function train(array $data, array $attributes): array
    {
        if (empty($data)) {
            throw new \InvalidArgumentException(
                'Dataset pelatihan tidak boleh kosong.'
            );
        }

        return $this->buildTree($data, $attributes);
    }

    private function buildTree(
        array $data,
        array $attributes,
        int $depth = 0
    ): array {
        $counts = Entropy::classCounts(
            $data,
            $this->target
        );

        if (empty($counts)) {
            throw new \RuntimeException(
                'Dataset tidak memiliki label kelas.'
            );
        }

        $majority = $this->majorityClass($data);

        // Kondisi 1: seluruh data memiliki kelas yang sama.
        if (count($counts) === 1) {
            return [
                'type' => 'leaf',
                'label' => $majority,
                'samples' => count($data)
            ];
        }

        // Kondisi 2: tidak ada atribut tersisa.
        if (empty($attributes)) {
            return [
                'type' => 'leaf',
                'label' => $majority,
                'samples' => count($data)
            ];
        }

        // Menentukan atribut dengan Gain Ratio terbaik.
        $best = GainRatio::bestAttribute(
            $data,
            $attributes,
            $this->target
        );

        if ($best === null) {
            return [
                'type' => 'leaf',
                'label' => $majority,
                'samples' => count($data)
            ];
        }

        $selectedAttribute = $best['attribute'];

        // Memisahkan dataset berdasarkan nilai atribut.
        $groups = [];

        foreach ($data as $row) {
            $value = (string) $row[$selectedAttribute];

            $groups[$value][] = $row;
        }

        $remainingAttributes = array_values(
            array_filter(
                $attributes,
                function ($attribute) use ($selectedAttribute) {
                    return $attribute !== $selectedAttribute;
                }
            )
        );

        $branches = [];

        foreach ($groups as $value => $group) {
            $branches[$value] = $this->buildTree(
                $group,
                $remainingAttributes,
                $depth + 1
            );
        }

        return [
            'type' => 'node',
            'attribute' => $selectedAttribute,
            'attribute_name' =>
                $this->attributeNames[$selectedAttribute]
                ?? $selectedAttribute,
            'information_gain' => $best['information_gain'],
            'split_information' => $best['split_information'],
            'gain_ratio' => $best['gain_ratio'],
            'samples' => count($data),
            'fallback' => $majority,
            'branches' => $branches
        ];
    }

    public function predict(array $tree, array $input): string
    {
        $current = $tree;

        while (($current['type'] ?? null) === 'node') {
            $attribute = $current['attribute'];

            if (!array_key_exists($attribute, $input)) {
                return $current['fallback'];
            }

            $value = (string) $input[$attribute];

            if (!isset($current['branches'][$value])) {
                return $current['fallback'];
            }

            $current = $current['branches'][$value];
        }

        return (string) ($current['label'] ?? 'Rendah');
    }

    private function majorityClass(array $data): string
    {
        $counts = Entropy::classCounts(
            $data,
            $this->target
        );

        $priorityOrder = [
            'Rendah' => 1,
            'Sedang' => 2,
            'Tinggi' => 3
        ];

        uksort($counts, function ($a, $b) use ($priorityOrder) {
            return ($priorityOrder[$a] ?? 99)
                <=> ($priorityOrder[$b] ?? 99);
        });

        arsort($counts);

        return (string) array_key_first($counts);
    }

    public function getRootAttribute(array $tree): ?string
    {
        return ($tree['type'] ?? null) === 'node'
            ? $tree['attribute']
            : null;
    }
}