<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator;

class StoreLearningStateRequest extends FormRequest
{
    private const SKILLS = ['listen', 'syllables', 'build', 'recall', 'write', 'meaning', 'sentence'];

    private const WORD = '/\A[abcçdefgğhıijklmnoöprsştuüvyz]{1,24}\z/u';

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        // Reject oversized snapshots before expanding any nested wildcard rules.
        if (strlen($this->getContent()) > 524288) {
            throw ValidationException::withMessages([
                'state' => 'Öğrenme kaydı en fazla 512 KB olabilir.',
            ]);
        }
        $state = $this->input('state');
        if (is_array($state) && is_array($state['lists'] ?? null)) {
            foreach ($state['lists'] as &$list) {
                if (is_array($list) && is_array($list['sentences'] ?? null)) {
                    $list['sentences'] = array_map(fn ($sentence) => is_string($sentence) ? $this->normalizeTeacherSentence($sentence) : $sentence, $list['sentences']);
                }
            }
            unset($list);
            $this->merge(['state' => $state]);
        }
    }

    public function rules(): array
    {
        return [
            'browser_id' => ['prohibited'],
            'profile_id' => ['prohibited'],
            'user_id' => ['prohibited'],
            'base_revision' => ['required', 'integer', 'min:0', 'max:4294967294'],
            'state' => ['required', 'array:version,updatedAt,lists,activeListId,events,progress,session'],
            'state.version' => ['required', 'integer', Rule::in([1])],
            'state.updatedAt' => ['required', 'integer', 'min:0', 'max:32503680000000'],
            'state.activeListId' => ['required', 'string', 'max:80'],
            'state.lists' => ['present', 'array', 'list', 'max:20'],
            'state.lists.*' => ['array:id,title,words,letters,syllables,sentences,updatedAt'],
            'state.lists.*.id' => ['required', 'string', 'max:80', 'distinct:strict'],
            'state.lists.*.title' => ['required', 'string', 'max:80'],
            'state.lists.*.updatedAt' => ['required', 'integer', 'min:0', 'max:32503680000000'],
            'state.lists.*.letters' => ['sometimes', 'array', 'list', 'max:29'],
            'state.lists.*.letters.*' => ['required', 'string', 'regex:/\A[abcçdefgğhıijklmnoöprsştuüvyz]\z/u'],
            'state.lists.*.syllables' => ['sometimes', 'array', 'list', 'max:100'],
            'state.lists.*.syllables.*' => ['required', 'string', 'regex:/\A[abcçdefgğhıijklmnoöprsştuüvyz]{1,6}\z/u'],
            'state.lists.*.sentences' => ['sometimes', 'array', 'list', 'max:100'],
            'state.lists.*.sentences.*' => ['required', 'string', 'max:240'],
            'state.lists.*.words' => ['present', 'array', 'list', 'max:100'],
            'state.lists.*.words.*' => ['array:text,parts,meaning,sentence,emoji'],
            'state.lists.*.words.*.text' => ['required', 'string', 'regex:'.self::WORD],
            'state.lists.*.words.*.parts' => ['required', 'array', 'list', 'min:1', 'max:24'],
            'state.lists.*.words.*.parts.*' => ['required', 'string', 'regex:'.self::WORD],
            'state.lists.*.words.*.meaning' => ['present', 'nullable', 'string', 'max:240'],
            'state.lists.*.words.*.sentence' => ['present', 'nullable', 'string', 'max:240'],
            'state.lists.*.words.*.emoji' => ['sometimes', 'nullable', 'string', 'max:16'],
            'state.events' => ['present', 'array', 'list', 'max:500'],
            'state.events.*' => ['array:id,word,skill,correct,mistakes,hints,writingReviewed,independent,at'],
            'state.events.*.id' => ['required', 'string', 'max:160', 'distinct:strict'],
            'state.events.*.word' => ['required', 'string', 'regex:'.self::WORD],
            'state.events.*.skill' => ['required', Rule::in(self::SKILLS)],
            'state.events.*.correct' => ['required', 'boolean'],
            'state.events.*.mistakes' => ['required', 'integer', 'min:0', 'max:1000000'],
            'state.events.*.hints' => ['required', 'integer', 'min:0', 'max:1000000'],
            'state.events.*.writingReviewed' => ['required', 'boolean'],
            'state.events.*.independent' => ['required', 'boolean'],
            'state.events.*.at' => ['required', 'integer', 'min:0', 'max:32503680000000'],
            'state.progress' => ['present', 'array', 'max:200'],
            'state.session' => ['present', 'nullable', 'array:id,createdAt,wordTexts,tasks,index,results,paused,storySeen,storyEpisode'],
            'state.session.id' => ['required_with:state.session', 'string', 'max:160'],
            'state.session.createdAt' => ['required_with:state.session', 'integer', 'min:0', 'max:32503680000000'],
            'state.session.wordTexts' => ['required_with:state.session', 'array', 'list', 'max:3'],
            'state.session.wordTexts.*' => ['required', 'string', 'regex:'.self::WORD],
            'state.session.tasks' => ['required_with:state.session', 'array', 'list', 'min:1', 'max:20'],
            'state.session.tasks.*' => ['array:id,word,skill,kind,target,tokens,options,support,reason,parts,meaning,sentence,emoji'],
            'state.session.tasks.*.id' => ['required', 'string', 'max:160', 'distinct:strict'],
            'state.session.tasks.*.word' => ['required', 'string', 'regex:'.self::WORD],
            'state.session.tasks.*.skill' => ['required', Rule::in(self::SKILLS)],
            'state.session.tasks.*.kind' => ['required', Rule::in(self::SKILLS)],
            'state.session.tasks.*.target' => ['required', 'string', 'max:240'],
            'state.session.tasks.*.tokens' => ['present', 'array', 'list', 'max:40'],
            'state.session.tasks.*.tokens.*' => ['required', 'string', 'max:80'],
            'state.session.tasks.*.options' => ['present', 'array', 'list', 'max:10'],
            'state.session.tasks.*.options.*' => ['required', 'string', 'max:240'],
            'state.session.tasks.*.support' => ['required', 'integer', 'min:0', 'max:2'],
            'state.session.tasks.*.reason' => ['present', 'nullable', 'string', 'max:240'],
            'state.session.tasks.*.parts' => ['present', 'array', 'list', 'max:24'],
            'state.session.tasks.*.parts.*' => ['required', 'string', 'regex:'.self::WORD],
            'state.session.tasks.*.meaning' => ['present', 'nullable', 'string', 'max:240'],
            'state.session.tasks.*.sentence' => ['present', 'nullable', 'string', 'max:240'],
            'state.session.tasks.*.emoji' => ['sometimes', 'nullable', 'string', 'max:16'],
            'state.session.index' => ['required_with:state.session', 'integer', 'min:0', 'max:20'],
            'state.session.results' => [Rule::excludeIf(fn (): bool => ! is_array($this->input('state.session'))), 'present', 'array', 'max:20'],
            'state.session.paused' => ['required_with:state.session', 'boolean'],
            'state.session.storySeen' => ['sometimes', 'boolean'],
            'state.session.storyEpisode' => ['sometimes', 'integer', 'min:0', 'max:2'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $state = $this->input('state');
            if (! is_array($state)) {
                return;
            }

            $nodes = 0;
            if (! $this->safeTree($state, 0, $nodes)) {
                $validator->errors()->add('state', 'Öğrenme kaydı geçerli düz metin ve sınırlı JSON verisi içermeli.');
            }

            $wordCount = 0;
            foreach (is_array($state['lists'] ?? null) ? $state['lists'] : [] as $index => $list) {
                if (! is_array($list) || ! is_array($list['words'] ?? null)) {
                    continue;
                }
                $wordCount += count($list['words']);
                foreach (['letters', 'syllables'] as $unitType) {
                    $units = is_array($list[$unitType] ?? null) ? $list[$unitType] : [];
                    $seenUnits = [];
                    foreach ($units as $unitIndex => $unit) {
                        if (! is_string($unit)) {
                            continue;
                        }
                        if (in_array($unit, $seenUnits, true)) {
                            $validator->errors()->add("state.lists.$index.$unitType.$unitIndex", 'Aynı öğretmen listesinde bir öğe yalnızca bir kez bulunabilir.');
                        }
                        $seenUnits[] = $unit;
                        if ($unitType === 'syllables' && ! $this->validTeacherSyllable($unit)) {
                            $validator->errors()->add("state.lists.$index.syllables.$unitIndex", 'Bağımsız hecede tek bir ünlü olmalı ve hece Türkçe harflerle yazılmalı.');
                        }
                    }
                }
                $seenSentences = [];
                foreach (is_array($list['sentences'] ?? null) ? $list['sentences'] : [] as $sentenceIndex => $sentence) {
                    if (! is_string($sentence)) {
                        continue;
                    }
                    $path = "state.lists.$index.sentences.$sentenceIndex";
                    if (! $this->validTeacherSentence($sentence)) {
                        $validator->errors()->add($path, 'Cümle Türkçe harflerle tek satırda, en fazla 40 kelime olmalı.');
                    }
                    $key = mb_strtolower(str_replace(['I', 'İ'], ['ı', 'i'], $sentence), 'UTF-8');
                    if (in_array($key, $seenSentences, true)) {
                        $validator->errors()->add($path, 'Aynı öğretmen listesinde bir cümle yalnızca bir kez bulunabilir.');
                    }
                    $seenSentences[] = $key;
                }
                $texts = [];
                foreach ($list['words'] as $wordIndex => $word) {
                    if (! is_array($word)) {
                        continue;
                    }
                    $text = $word['text'] ?? null;
                    $parts = $word['parts'] ?? null;
                    if (is_string($text)) {
                        if (in_array($text, $texts, true)) {
                            $validator->errors()->add("state.lists.$index.words.$wordIndex.text", 'Aynı listede bir kelime yalnızca bir kez bulunabilir.');
                        }
                        $texts[] = $text;
                    }
                    if (is_string($text) && is_array($parts) && count(array_filter($parts, 'is_string')) === count($parts) && implode('', $parts) !== $text) {
                        $validator->errors()->add("state.lists.$index.words.$wordIndex.parts", 'Heceler birleştiğinde kelimeyi oluşturmalı.');
                    }
                }
            }
            if ($wordCount > 1000) {
                $validator->errors()->add('state.lists', 'Toplam en fazla 1000 kelime kaydedilebilir.');
            }

            $lists = is_array($state['lists'] ?? null) ? $state['lists'] : [];
            if ($lists !== [] && ! in_array($state['activeListId'] ?? null, array_column(array_filter($lists, 'is_array'), 'id'), true)) {
                $validator->errors()->add('state.activeListId', 'Çalışılacak liste bulunamadı.');
            }

            $progress = $state['progress'] ?? [];
            if (is_array($progress)) {
                foreach ($progress as $word => $skills) {
                    if (! is_string($word) || preg_match(self::WORD, $word) !== 1 || ! is_array($skills) || count($skills) > 7) {
                        $validator->errors()->add('state.progress', 'Beceri kayıtları geçerli kelimeler ve beceriler içermeli.');
                        break;
                    }
                    foreach ($skills as $skill => $summary) {
                        if (! in_array($skill, self::SKILLS, true) || ! $this->validSummary($summary)) {
                            $validator->errors()->add('state.progress', 'Beceri özeti geçerli değil.');
                            break 2;
                        }
                    }
                }
            }

            $session = $state['session'] ?? null;
            if (is_array($session) && is_array($session['tasks'] ?? null) && is_int($session['index'] ?? null) && $session['index'] > count($session['tasks'])) {
                $validator->errors()->add('state.session.index', 'Etkinlik sırası görev sayısını aşamaz.');
            }
            if (is_array($session) && is_array($session['results'] ?? null)) {
                $tasks = is_array($session['tasks'] ?? null) ? $session['tasks'] : [];
                foreach ($session['results'] as $id => $result) {
                    $task = null;
                    foreach ($tasks as $candidate) {
                        if (is_array($candidate) && ($candidate['id'] ?? null) === $id) {
                            $task = $candidate;
                            break;
                        }
                    }
                    if ($task === null || ! $this->validResult($result, $task)) {
                        $validator->errors()->add('state.session.results', 'Sonuç yalnızca bu oturumdaki bir göreve ait olabilir.');
                        break;
                    }
                }
            }
        }];
    }

    private function validResult(mixed $result, array $task): bool
    {
        if (! is_array($result) || array_diff(array_keys($result), [
            'correct', 'mistakes', 'hints', 'writingReviewed', 'independent',
            'modelOpened', 'reviewExposed', 'ui', 'id', 'word', 'skill', 'at', 'inkPaths',
        ]) !== []) {
            return false;
        }
        foreach (['correct', 'writingReviewed', 'independent', 'modelOpened', 'reviewExposed'] as $key) {
            if (array_key_exists($key, $result) && ! is_bool($result[$key])) {
                return false;
            }
        }
        foreach (['mistakes', 'hints'] as $key) {
            if (array_key_exists($key, $result) && (! is_int($result[$key]) || $result[$key] < 0 || $result[$key] > 100)) {
                return false;
            }
        }
        if (isset($result['id']) && (! is_string($result['id']) || strlen($result['id']) > 160)) {
            return false;
        }
        if (isset($result['word']) && (! is_string($result['word']) || preg_match(self::WORD, $result['word']) !== 1)) {
            return false;
        }
        if (isset($result['skill']) && ! in_array($result['skill'], self::SKILLS, true)) {
            return false;
        }
        if (isset($result['at']) && (! is_int($result['at']) || $result['at'] < 0 || $result['at'] > 32503680000000)) {
            return false;
        }
        if (array_key_exists('inkPaths', $result)) {
            if (! is_array($result['inkPaths']) || ! array_is_list($result['inkPaths']) || count($result['inkPaths']) > 12) {
                return false;
            }
            foreach ($result['inkPaths'] as $path) {
                if (! is_string($path) || strlen($path) > 8000 || preg_match('/\AM[-\d .L]+\z/', $path) !== 1) {
                    return false;
                }
            }
        }
        if (array_key_exists('ui', $result) && ! $this->validTaskUi($result['ui'], $task, ($result['correct'] ?? false) === true)) {
            return false;
        }

        return true;
    }

    private function validTaskUi(mixed $ui, array $task, bool $correct): bool
    {
        $keys = ['taskKey', 'selected', 'model', 'audioPlayed'];
        if (! is_array($ui) || array_diff(array_keys($ui), $keys) !== [] || array_diff($keys, array_keys($ui)) !== []
            || ! is_string($ui['taskKey']) || strlen($ui['taskKey']) > 8000
            || ! is_array($ui['selected']) || ! array_is_list($ui['selected']) || count($ui['selected']) > 40
            || ! is_bool($ui['model']) || ! is_bool($ui['audioPlayed'])) {
            return false;
        }
        foreach (['id', 'word', 'kind', 'skill', 'target'] as $key) {
            if (! is_string($task[$key] ?? null)) {
                return false;
            }
        }
        foreach (['tokens', 'options', 'parts'] as $key) {
            if (! is_array($task[$key] ?? null)) {
                return false;
            }
        }
        try {
            $scope = json_decode($ui['taskKey'], true, 16, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return false;
        }
        // Decode the browser's canonical key rather than relying on PHP and
        // JavaScript to use the same Unicode/escaping options for JSON strings.
        if ($scope !== [$task['id'], $task['word'], $task['kind'], $task['skill'], $task['target'],
            $task['tokens'], $task['options'], $task['parts'], $task['support'] ?? null]) {
            return false;
        }
        $tokens = $task['tokens'] !== [] ? $task['tokens'] : match ($task['kind']) {
            'sentence' => preg_split('/\s+/u', $task['target']),
            'syllables' => $task['parts'],
            default => mb_str_split($task['word']),
        };
        $assembly = ! in_array($task['kind'], ['listen', 'meaning', 'write'], true);
        if (count($ui['selected']) > count($tokens) || (! $assembly && $ui['selected'] !== [])
            || ($assembly && ! $correct && count($ui['selected']) === count($tokens))) {
            return false;
        }
        $bank = $task['kind'] === 'build' && mb_strlen($task['word']) === 1 && $task['options'] !== [] ? $task['options'] : $tokens;
        $ids = [];
        foreach ($ui['selected'] as $index => $tile) {
            if (! is_array($tile) || count($tile) !== 2 || ! is_int($tile['id'] ?? null) || $tile['id'] < 0
                || in_array($tile['id'], $ids, true) || ! is_string($tile['text'] ?? null)
                || ($bank[$tile['id']] ?? null) !== $tile['text'] || ($tokens[$index] ?? null) !== $tile['text']) {
                return false;
            }
            $ids[] = $tile['id'];
        }

        return true;
    }

    private function validTeacherSyllable(string $text): bool
    {
        if (preg_match('/\A([bcçdfgğhjklmnprsştvyz]{0,3})([aeıioöuü])([bcçdfgğhjklmnprsştvyz]{0,2})\z/u', $text, $parts) !== 1) {
            return false;
        }

        return mb_strlen($parts[1]) <= 1 || in_array($parts[1], [
            'tr', 'pr', 'br', 'kr', 'gr', 'fr', 'pl', 'bl', 'kl', 'gl', 'fl', 'dr', 'sp', 'st', 'sk', 'str', 'spr', 'skr',
        ], true);
    }

    private function validSummary(mixed $summary): bool
    {
        if (! is_array($summary)) {
            return false;
        }
        $counters = ['attempts', 'independentSuccesses', 'assistedSuccesses', 'mistakes', 'hints'];
        $times = ['lastAt', 'lastIndependentAt', 'nextDueAt'];
        $keys = [...$counters, ...$times, 'intervalDays', 'independentDays', 'recent'];
        if (array_diff(array_keys($summary), $keys) !== []) {
            return false;
        }
        foreach ([...$counters, ...$times] as $key) {
            if (! isset($summary[$key]) || ! is_int($summary[$key]) || $summary[$key] < 0 || $summary[$key] > (in_array($key, $times, true) ? 32503680000000 : 1000000000)) {
                return false;
            }
        }
        if (! isset($summary['intervalDays']) || ! is_numeric($summary['intervalDays']) || $summary['intervalDays'] < 0 || $summary['intervalDays'] > 3650) {
            return false;
        }
        if (! is_array($summary['independentDays'] ?? null) || ! array_is_list($summary['independentDays']) || count($summary['independentDays']) > 30 || ! is_array($summary['recent'] ?? null) || ! array_is_list($summary['recent']) || count($summary['recent']) > 8) {
            return false;
        }
        foreach ($summary['independentDays'] as $day) {
            if (! is_string($day) || ! preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $day)) {
                return false;
            }
        }
        foreach ($summary['recent'] as $value) {
            if (! is_int($value) || ! in_array($value, [0, 1, 2], true)) {
                return false;
            }
        }

        return true;
    }

    private function normalizeTeacherSentence(string $sentence): string
    {
        if (class_exists(\Normalizer::class)) {
            $sentence = \Normalizer::normalize($sentence, \Normalizer::FORM_C) ?: $sentence;
        } else {
            $sentence = strtr($sentence, ["I\u{0307}" => 'İ', "c\u{0327}" => 'ç', "C\u{0327}" => 'Ç',
                "s\u{0327}" => 'ş', "S\u{0327}" => 'Ş', "g\u{0306}" => 'ğ', "G\u{0306}" => 'Ğ',
                "o\u{0308}" => 'ö', "O\u{0308}" => 'Ö', "u\u{0308}" => 'ü', "U\u{0308}" => 'Ü']);
        }

        // Collapse typographic spaces while keeping embedded controls/newlines
        // intact so validation rejects them rather than silently joining lines.
        return trim(preg_replace('/\p{Zs}+/u', ' ', $sentence) ?? $sentence);
    }

    private function validTeacherSentence(string $sentence): bool
    {
        $letters = 'abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';

        return ! preg_match('/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}<>]/u', $sentence)
            && preg_match('/\A['.$letters.'0-9 .,!?;:…‘’“”„\'"()\[\]\-–—]+\z/u', $sentence) === 1
            && preg_match('/['.$letters.']/u', $sentence) === 1
            && count(preg_split('/\s+/u', $sentence, -1, PREG_SPLIT_NO_EMPTY)) <= 40;
    }

    private function safeTree(mixed $value, int $depth, int &$nodes): bool
    {
        if (++$nodes > 100000 || $depth > 12) {
            return false;
        }
        if (is_array($value)) {
            foreach ($value as $key => $child) {
                if ((is_string($key) && (strlen($key) > 240 || preg_match('/[<>\x00-\x1F]/u', $key))) || ! $this->safeTree($child, $depth + 1, $nodes)) {
                    return false;
                }
            }

            return true;
        }
        if (is_string($value)) {
            return mb_strlen($value) <= 8000 && ! preg_match('/[<>\x00-\x08\x0B\x0C\x0E-\x1F]/u', $value);
        }

        return $value === null || is_bool($value) || is_int($value) || (is_float($value) && is_finite($value));
    }
}
