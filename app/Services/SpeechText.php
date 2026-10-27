<?php

namespace App\Services;

final class SpeechText
{
    public const READING_POLICY = 'tr-reading-v2';

    public const PREVIOUS_TEXT = 'Türkçe okuma ve yazma çalışması yapıyoruz.';

    public const NEXT_TEXT = 'Türkçe okumaya devam edelim.';

    private const HERO = '~(?<![\p{L}\p{M}])(?:alp\s+arslan|alparslan|\{\{child\}\})(?:(?<mark>[’\']?)(?<suffix>dan|den|da|de|ın|in|un|ün|la|le|ı|i|u|ü|a|e))?(?=$|[^\p{L}\p{M}])~iu';

    private static function unicode(string $text): string
    {
        if (class_exists(\Normalizer::class)) {
            return \Normalizer::normalize($text, \Normalizer::FORM_C) ?: $text;
        }

        return strtr($text, ["I\u{0307}" => 'İ', "c\u{0327}" => 'ç', "C\u{0327}" => 'Ç',
            "s\u{0327}" => 'ş', "S\u{0327}" => 'Ş', "g\u{0306}" => 'ğ', "G\u{0306}" => 'Ğ',
            "o\u{0308}" => 'ö', "O\u{0308}" => 'Ö', "u\u{0308}" => 'ü', "U\u{0308}" => 'Ü']);
    }

    public static function normalize(string $text): string
    {
        $text = self::unicode($text);
        $text = mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], $text), 'UTF-8');
        $text = str_replace(['“', '”', '„', '"', '‘', '’'], '', $text);

        return trim(preg_replace('/\s+/u', ' ', $text) ?? '');
    }

    public static function profileName(string $name): string
    {
        return trim(preg_replace('/\s+/u', ' ', self::unicode($name)) ?? '');
    }

    public static function providerText(string $text): string
    {
        // A provider-only spelling cue: the canonical lesson and profile text
        // remain unchanged. Letter/mark/number boundaries protect longer words.
        return preg_replace_callback('/(?<![\p{L}\p{M}\p{N}_])nine(?![\p{L}\p{M}\p{N}_])/iu',
            static fn (array $match): string => mb_substr($match[0], 0, 1) === 'N' ? 'Ni-ne' : 'ni-ne', $text);
    }

    public static function providerNormalization(string $text): string
    {
        $token = preg_replace('/[.!?]\z/u', '', $text);

        return mb_strlen($token) <= 24
            && preg_match('/\A[abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ-]+\z/u', $token) === 1
            ? 'off' : 'auto';
    }

    public static function personalizable(string $template): bool
    {
        if (! preg_match(self::HERO, $template)) {
            return false;
        }

        // A bare word is a learning target, not permission to rename it.
        return str_contains($template, '{{child}}') || preg_match('/[\p{L}\p{M}]/u', preg_replace(self::HERO, '', $template)) === 1;
    }

    public static function personalize(string $template, ?string $profileName): string
    {
        $name = $profileName ? self::profileName($profileName) : 'Minik Aslan';

        return preg_replace_callback(self::HERO, static function (array $match) use ($name): string {
            $suffix = $match['suffix'] ?? '';
            if ($suffix === '') {
                return $name;
            }
            $lower = mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], $name), 'UTF-8');
            preg_match_all('/[aeıioöuü]/u', $lower, $vowels);
            $vowel = $vowels[0] === [] ? 'e' : end($vowels[0]);
            $last = mb_substr($lower, -1);
            $two = str_contains('aıou', $vowel) ? 'a' : 'e';
            $four = str_contains('aı', $vowel) ? 'ı' : (str_contains('ei', $vowel) ? 'i' : (str_contains('ou', $vowel) ? 'u' : 'ü'));
            $endsVowel = str_contains('aeıioöuü', $last);
            $voiced = str_contains('fstkçşhp', $last) ? 't' : 'd';
            $suffix = mb_strtolower($suffix, 'UTF-8');
            $ending = match (true) {
                in_array($suffix, ['a', 'e'], true) => ($endsVowel ? 'y' : '').$two,
                in_array($suffix, ['ı', 'i', 'u', 'ü'], true) => ($endsVowel ? 'y' : '').$four,
                in_array($suffix, ['ın', 'in', 'un', 'ün'], true) => ($endsVowel ? 'n' : '').$four.'n',
                in_array($suffix, ['la', 'le'], true) => ($endsVowel ? 'y' : '').'l'.$two,
                in_array($suffix, ['dan', 'den'], true) => $voiced.$two.'n',
                default => $voiced.$two,
            };

            return $name.(($match['mark'] ?? '') ?: '’').$ending;
        }, $template);
    }
}
