<?php

namespace App\Services;

final class SpeechText
{
    public static function normalize(string $text): string
    {
        if (class_exists(\Normalizer::class)) {
            $text = \Normalizer::normalize($text, \Normalizer::FORM_C) ?: $text;
        } else {
            // The Turkish combinations used by this app, on PHP without intl.
            $text = strtr($text, ["I\u{0307}" => 'İ', "c\u{0327}" => 'ç', "C\u{0327}" => 'Ç',
                "s\u{0327}" => 'ş', "S\u{0327}" => 'Ş', "g\u{0306}" => 'ğ', "G\u{0306}" => 'Ğ',
                "o\u{0308}" => 'ö', "O\u{0308}" => 'Ö', "u\u{0308}" => 'ü', "U\u{0308}" => 'Ü']);
        }
        $text = mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], $text), 'UTF-8');
        $text = str_replace(['“', '”', '„', '"', '‘', '’'], '', $text);

        return trim(preg_replace('/\s+/u', ' ', $text) ?? '');
    }
}
