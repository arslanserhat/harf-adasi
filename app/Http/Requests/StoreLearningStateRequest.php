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
            'state.lists.*' => ['array:id,title,words,updatedAt'],
            'state.lists.*.id' => ['required', 'string', 'max:80', 'distinct:strict'],
            'state.lists.*.title' => ['required', 'string', 'max:80'],
            'state.lists.*.updatedAt' => ['required', 'integer', 'min:0', 'max:32503680000000'],
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
            'state.session' => ['present', 'nullable', 'array:id,createdAt,wordTexts,tasks,index,results,paused,storySeen'],
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
                $ids = array_column(array_filter($tasks, 'is_array'), 'id');
                foreach ($session['results'] as $id => $result) {
                    if (! in_array($id, $ids, true) || ! $this->validResult($result)) {
                        $validator->errors()->add('state.session.results', 'Sonuç yalnızca bu oturumdaki bir göreve ait olabilir.');
                        break;
                    }
                }
            }
        }];
    }

    private function validResult(mixed $result): bool
    {
        if (! is_array($result) || array_diff(array_keys($result), [
            'correct', 'mistakes', 'hints', 'writingReviewed', 'independent',
            'modelOpened', 'id', 'word', 'skill', 'at', 'inkPaths',
        ]) !== []) {
            return false;
        }
        foreach (['correct', 'writingReviewed', 'independent', 'modelOpened'] as $key) {
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
        return true;
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
