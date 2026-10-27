<?php

namespace Tests\Feature;

use App\Models\LearningState;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TurkishSpeechPronunciationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=']);
        Cache::flush();
        Storage::fake('local');
        Http::preventStrayRequests();
        Http::fake(['api.elevenlabs.io/*' => Http::response('ID3'.str_repeat('audio', 20), 200, ['Content-Type' => 'audio/mpeg'])]);
        Storage::disk('local')->put('test/catalog.json', json_encode(['version' => 1, 'revision' => 'irem-v4-v1', 'phrases' => [
            'alparslan ile nine eve gidiyor.' => ['spoken' => 'Alp ile Nine eve gidiyor.'],
        ]], JSON_UNESCAPED_UNICODE));
        config(['services.elevenlabs' => [
            'enabled' => true, 'key' => 'fake-test-key', 'voice_id' => 'approved-test-voice', 'model_id' => 'eleven_v4',
            'revision' => 'irem-v4-v1', 'settings' => [], 'daily_char_limit' => 500, 'monthly_char_limit' => 1000,
            'session_daily_char_limit' => 500, 'ip_daily_char_limit' => 500,
            'catalog_path' => Storage::disk('local')->path('test/catalog.json'),
            'fixed_audio_path' => Storage::disk('local')->path('test/audio'),
        ]]);
        $this->withSession(['learning_browser_id' => 'pronunciation-browser']);
        LearningState::create(['browser_id' => 'pronunciation-browser', 'revision' => 1, 'payload' => [
            'activeListId' => 'school', 'lists' => [['id' => 'school', 'words' => [
                ['text' => 'nine', 'parts' => ['ni', 'ne'], 'sentence' => 'Nine naneli çörek aldı.'],
            ], 'sentences' => ['Ninem, nineler ile geldi.']]],
        ]]);
    }

    public function test_new_v4_teacher_word_requests_use_turkish_phonetic_spelling_and_fixed_context_without_rewriting_the_state(): void
    {
        $before = LearningState::where('browser_id', 'pronunciation-browser')->first()->payload;
        $this->postJson('/api/speech/resolve', ['text' => 'nine'])->assertOk();
        Http::assertSent(fn ($request) => $request['text'] === 'ni-ne'
            && ($request['previous_text'] ?? null) === 'Türkçe okuma ve yazma çalışması yapıyoruz.'
            && ($request['next_text'] ?? null) === 'Türkçe okumaya devam edelim.'
            && $request['model_id'] === 'eleven_v4' && $request['language_code'] === 'tr');
        $this->assertSame($before, LearningState::where('browser_id', 'pronunciation-browser')->first()->payload);
    }

    public function test_sentence_initial_nine_is_changed_but_longer_unicode_words_remain_literal(): void
    {
        $this->postJson('/api/speech/resolve', ['text' => 'Nine naneli çörek aldı.'])->assertOk();
        Http::assertSent(fn ($request) => $request['text'] === 'Ni-ne naneli çörek aldı.');
        $this->postJson('/api/speech/resolve', ['text' => 'Ninem, nineler ile geldi.'])->assertOk();
        Http::assertSent(fn ($request) => $request['text'] === 'Ninem, nineler ile geldi.');
    }

    public function test_profile_rendering_precedes_provider_only_pronunciation_rules(): void
    {
        $this->postJson('/api/speech/resolve', ['text' => 'Alparslan ile Nine eve gidiyor.', 'profile_name' => 'Alp'])->assertOk();
        Http::assertSent(fn ($request) => $request['text'] === 'Alp ile Ni-ne eve gidiyor.');
    }

    public function test_old_bad_generated_cache_is_not_reused_and_new_policy_cache_is_reused(): void
    {
        // Literal previous cache identity; the new policy must not serve the
        // provider's old English reading from this existing private file.
        $oldHash = hash('sha256', json_encode(['nine', 'approved-test-voice', 'eleven_v4', [], 'irem-v4-v1'], JSON_UNESCAPED_UNICODE));
        Storage::disk('local')->put('speech/irem-v4-v1/'.$oldHash.'.mp3', 'ID3old-bad-reading');
        $first = $this->postJson('/api/speech/resolve', ['text' => 'nine'])->assertOk()->json('url');
        $this->assertNotSame($oldHash, basename(parse_url($first, PHP_URL_PATH)));
        $second = $this->postJson('/api/speech/resolve', ['text' => 'nine'])->assertOk()->json('url');
        $this->assertSame(parse_url($first, PHP_URL_PATH), parse_url($second, PHP_URL_PATH));
        Http::assertSentCount(1);
    }

    public function test_new_reading_context_invalidates_old_cache_even_when_word_spelling_is_unchanged(): void
    {
        $text = 'Ninem, nineler ile geldi.';
        $oldHash = hash('sha256', json_encode([$text, 'approved-test-voice', 'eleven_v4', [], 'irem-v4-v1'], JSON_UNESCAPED_UNICODE));
        Storage::disk('local')->put('speech/irem-v4-v1/'.$oldHash.'.mp3', 'ID3old-context-free-reading');
        $url = $this->postJson('/api/speech/resolve', ['text' => $text])->assertOk()->json('url');
        $this->assertNotSame($oldHash, basename(parse_url($url, PHP_URL_PATH)));
        Http::assertSent(fn ($request) => $request['text'] === $text
            && ($request['previous_text'] ?? null) === 'Türkçe okuma ve yazma çalışması yapıyoruz.'
            && ($request['next_text'] ?? null) === 'Türkçe okumaya devam edelim.');
        Http::assertSentCount(1);
    }

    public function test_fixed_corrected_mp3_selection_stays_unchanged_and_clients_cannot_choose_context(): void
    {
        Storage::disk('local')->put('test/audio/irem-v4-v1/nine.mp3', 'ID3fixed-corrected-reading');
        Storage::disk('local')->put('test/catalog.json', json_encode(['version' => 1, 'revision' => 'irem-v4-v1', 'phrases' => [
            'nine' => ['spoken' => 'nine', 'file' => 'irem-v4-v1/nine.mp3'],
        ]]));
        $this->postJson('/api/speech/resolve', ['text' => 'nine'])->assertOk();
        $this->postJson('/api/speech/resolve', ['text' => 'nine', 'previous_text' => 'client context'])->assertUnprocessable();
        $this->postJson('/api/speech/resolve', ['text' => 'nine', 'next_text' => 'client context'])->assertUnprocessable();
        Http::assertNothingSent();
    }
}
