<?php

namespace App\Services;

use App\Http\Controllers\GameProgressController;
use App\Models\LearningState;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

final class SpeechResolver
{
    public function resolve(string $text, Request $request): array
    {
        $browser = GameProgressController::browserId($request);
        $allowed = $this->allowed(SpeechText::normalize($text), $browser);
        if ($allowed === null) {
            throw new SpeechFailure('speech_text_not_allowed', 422);
        }
        [$spoken, $fixed] = $allowed;
        $revision = $this->revision();
        $hash = hash('sha256', json_encode([$spoken, config('services.elevenlabs.voice_id'),
            config('services.elevenlabs.model_id'), config('services.elevenlabs.settings', []), $revision], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
        $local = 'speech/'.$revision.'/'.$hash.'.mp3';

        if ($fixed && is_file($fixed)) {
            $this->remember($hash, ['source' => 'fixed', 'path' => $fixed]);
        } elseif (Storage::disk('local')->exists($local)) {
            $this->remember($hash, ['source' => 'local', 'path' => $local]);
        } else {
            $this->generate($hash, $spoken, $local, $browser, (string) $request->ip());
        }

        $expiry = now()->addMinutes(10);
        $url = URL::temporarySignedRoute('speech.audio', $expiry,
            ['hash' => $hash, 'scope' => $this->scope($hash, $browser)], absolute: false);

        return ['url' => $url, 'revision' => $revision, 'expires_at' => $expiry->timestamp];
    }

    public function audioPath(string $hash, Request $request): string
    {
        if (! URL::hasValidSignature($request, absolute: false)
            || ! hash_equals($this->scope($hash, GameProgressController::browserId($request)), (string) $request->query('scope'))) {
            throw new SpeechFailure('speech_link_invalid', 403);
        }
        $record = Cache::get('speech:clip:'.$hash);
        if (! is_array($record)) {
            throw new SpeechFailure('speech_clip_missing', 404);
        }
        $path = ($record['source'] ?? null) === 'local' ? Storage::disk('local')->path($record['path']) : ($record['path'] ?? '');
        if (! is_string($path) || ! is_file($path)) {
            throw new SpeechFailure('speech_clip_missing', 404);
        }

        return $path;
    }

    private function revision(): string
    {
        $revision = config('services.elevenlabs.revision', 'irem-v4-v1');
        if (! is_string($revision) || ! preg_match('/\A[a-z0-9-]{1,64}\z/', $revision)) {
            throw new SpeechFailure('speech_unavailable');
        }

        return $revision;
    }

    private function allowed(string $key, string $browser): ?array
    {
        $path = config('services.elevenlabs.catalog_path', resource_path('speech/catalog.json'));
        $catalog = is_file($path) ? json_decode(file_get_contents($path), true) : null;
        $entry = is_array($catalog) && ($catalog['version'] ?? null) === 1 && ($catalog['revision'] ?? null) === $this->revision()
            ? ($catalog['phrases'][$key] ?? null) : null;
        if (is_array($entry) && is_string($entry['spoken'] ?? null) && mb_strlen($entry['spoken']) <= 1000) {
            $fixed = null;
            if (is_string($entry['file'] ?? null) && preg_match('/\A'.preg_quote($this->revision(), '/').'\/[a-zA-Z0-9_-]+\.mp3\z/', $entry['file'])) {
                $fixed = rtrim(config('services.elevenlabs.fixed_audio_path', public_path('audio')), '/\\').DIRECTORY_SEPARATOR.$entry['file'];
            }

            return [$entry['spoken'], $fixed];
        }

        // The browser supplies no identity and cannot ask for arbitrary profile
        // names or prose. Read only this session's already-saved active content.
        $payload = LearningState::query()->where('browser_id', $browser)->first()?->payload;
        $active = collect($payload['lists'] ?? [])->firstWhere('id', $payload['activeListId'] ?? null);
        if (! is_array($active)) {
            return null;
        }
        $texts = [...($active['letters'] ?? []), ...($active['syllables'] ?? [])];
        foreach ($active['words'] ?? [] as $word) {
            if (! is_array($word)) {
                continue;
            }
            $texts[] = $word['text'] ?? '';
            $texts[] = $word['sentence'] ?? '';
            array_push($texts, ...($word['parts'] ?? []));
        }
        foreach ($texts as $candidate) {
            if (is_string($candidate) && $candidate !== '' && mb_strlen($candidate) <= 240 && SpeechText::normalize($candidate) === $key) {
                return [$candidate, null];
            }
        }

        return null;
    }

    private function scope(string $hash, string $browser): string
    {
        return hash_hmac('sha256', $hash.'|'.$browser, (string) config('app.key'));
    }

    private function remember(string $hash, array $record): void
    {
        Cache::put('speech:clip:'.$hash, $record, now()->addDay());
    }

    private function generate(string $hash, string $spoken, string $path, string $browser, string $ip): void
    {
        if (! config('services.elevenlabs.enabled') || ! config('services.elevenlabs.key')
            || ! config('services.elevenlabs.voice_id') || ! config('services.elevenlabs.model_id')) {
            throw new SpeechFailure('speech_unavailable');
        }
        if (Cache::has('speech:failed:'.$hash)) {
            throw new SpeechFailure('speech_unavailable');
        }
        $lock = Cache::lock('speech:generate:'.$hash, 35);
        if (! $lock->get()) {
            throw new SpeechFailure('speech_busy', 429);
        }
        try {
            if (Storage::disk('local')->exists($path)) {
                $this->remember($hash, ['source' => 'local', 'path' => $path]);

                return;
            }
            // A previous owner may have written a charged-failure cooldown
            // after our fast check and before we acquired this lock.
            if (Cache::has('speech:failed:'.$hash)) {
                throw new SpeechFailure('speech_unavailable');
            }
            $this->reserve($hash, mb_strlen($spoken), $browser, $ip);
            try {
                // Deliberately one request: timeout/disconnect may already have
                // consumed credits. Keep the reservation and cool down failures.
                $response = Http::connectTimeout(5)->timeout(20)->withOptions(['allow_redirects' => false])->accept('audio/mpeg')
                    ->withHeaders(['xi-api-key' => config('services.elevenlabs.key')])
                    ->post('https://api.elevenlabs.io/v1/text-to-speech/'.rawurlencode(config('services.elevenlabs.voice_id')).'?output_format=mp3_44100_128', [
                        'text' => $spoken, 'model_id' => config('services.elevenlabs.model_id'), 'language_code' => 'tr',
                        'voice_settings' => config('services.elevenlabs.settings', []),
                    ]);
                $body = $response->body();
                $type = strtolower((string) $response->header('Content-Type'));
                if (! $response->successful() || ! str_starts_with($type, 'audio/') || strlen($body) < 3 || strlen($body) > 2097152
                    || ! (str_starts_with($body, 'ID3') || (ord($body[0]) === 255 && (ord($body[1]) & 224) === 224))) {
                    throw new \RuntimeException('Invalid speech response.');
                }
                $temporary = $path.'.'.Str::random(12).'.tmp';
                try {
                    if (! Storage::disk('local')->put($temporary, $body) || ! Storage::disk('local')->move($temporary, $path)) {
                        throw new \RuntimeException('Speech cache unavailable.');
                    }
                } finally {
                    Storage::disk('local')->delete($temporary);
                }
                $this->remember($hash, ['source' => 'local', 'path' => $path]);
            } catch (\Throwable) {
                Cache::put('speech:failed:'.$hash, true, now()->addMinutes(5));
                throw new SpeechFailure('speech_unavailable');
            }
        } finally {
            $lock->release();
        }
    }

    private function reserve(string $hash, int $characters, string $browser, string $ip): void
    {
        $lock = Cache::lock('speech:budget', 5);
        if (! $lock->get()) {
            throw new SpeechFailure('speech_busy', 429);
        }
        try {
            $day = now()->format('Y-m-d');
            $month = now()->format('Y-m');
            $session = hash('sha256', $browser);
            $address = hash('sha256', $ip);
            $seenKey = 'speech:unique:'.$day.':'.$session;
            $seen = Cache::get($seenKey, []);
            $sessionCost = in_array($hash, $seen, true) ? 0 : $characters;
            $budgets = [
                ['speech:daily:'.$day, $characters, 'daily_char_limit', 500, now()->endOfDay()],
                ['speech:monthly:'.$month, $characters, 'monthly_char_limit', 1000, now()->endOfMonth()],
                ['speech:session:'.$day.':'.$session, $sessionCost, 'session_daily_char_limit', 200, now()->endOfDay()],
                ['speech:ip:'.$day.':'.$address, $characters, 'ip_daily_char_limit', 500, now()->endOfDay()],
            ];
            foreach ($budgets as [$key, $cost, $setting, $fallback]) {
                if ((int) Cache::get($key, 0) + $cost > max(0, (int) config('services.elevenlabs.'.$setting, $fallback))) {
                    throw new SpeechFailure('speech_quota', 429);
                }
            }
            $minute = now()->format('Y-m-d-H-i');
            $requests = [['speech:session-minute:'.$session.':'.$minute, 6], ['speech:ip-minute:'.$address.':'.$minute, 12]];
            foreach ($requests as [$key, $limit]) {
                if ((int) Cache::get($key, 0) >= $limit) {
                    throw new SpeechFailure('speech_quota', 429);
                }
            }
            foreach ($budgets as [$key, $cost, $setting, $fallback, $expiry]) {
                Cache::put($key, (int) Cache::get($key, 0) + $cost, $expiry);
            }
            foreach ($requests as [$key]) {
                Cache::put($key, (int) Cache::get($key, 0) + 1, 120);
            }
            if ($sessionCost > 0) {
                Cache::put($seenKey, [...$seen, $hash], now()->endOfDay());
            }
        } finally {
            $lock->release();
        }
    }
}
