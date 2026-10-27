<?php

namespace Tests\Feature;

use App\Models\LearningState;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SpeechNormalizationTest extends TestCase
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
            '12' => ['spoken' => '12'],
            'alparslan ile okumaya başlayalım.' => ['spoken' => 'Alpaslan ile okumaya başlayalım.'],
        ]], JSON_UNESCAPED_UNICODE));
        config(['services.elevenlabs' => [
            'enabled' => true, 'key' => 'fake-test-key', 'voice_id' => 'approved-test-voice', 'model_id' => 'eleven_v4',
            'revision' => 'irem-v4-v1', 'settings' => [], 'daily_char_limit' => 500, 'monthly_char_limit' => 1000,
            'session_daily_char_limit' => 500, 'ip_daily_char_limit' => 500,
            'catalog_path' => Storage::disk('local')->path('test/catalog.json'),
        ]]);
        $this->withSession(['learning_browser_id' => 'normalization-browser']);
        LearningState::create(['browser_id' => 'normalization-browser', 'revision' => 1, 'payload' => [
            'activeListId' => 'school', 'lists' => [['id' => 'school', 'words' => [
                ['text' => 'nine', 'parts' => ['ni', 'ne']],
            ], 'syllables' => ['no', 'ni-ne', 'no.', 'ŞÜ!', str_repeat('a', 24), str_repeat('a', 25)],
                'sentences' => ['Nine anten al.']]],
        ]]);
    }

    public function test_isolated_turkish_syllables_disable_provider_normalization_without_changing_the_saved_text(): void
    {
        $before = LearningState::where('browser_id', 'normalization-browser')->first()->payload;
        foreach (['no', 'ni-ne', 'no.', 'ŞÜ!'] as $text) {
            $this->postJson('/api/speech/resolve', ['text' => $text])->assertOk();
            Http::assertSent(fn ($request) => $request['text'] === $text
                && ($request['apply_text_normalization'] ?? null) === 'off'
                && $request['language_code'] === 'tr'
                && $request['previous_text'] === 'Türkçe okuma ve yazma çalışması yapıyoruz.'
                && $request['next_text'] === 'Türkçe okumaya devam edelim.');
        }
        $this->assertSame($before, LearningState::where('browser_id', 'normalization-browser')->first()->payload);
    }

    public function test_full_sentences_and_numbers_keep_automatic_provider_normalization(): void
    {
        foreach ([['Nine anten al.', 'Ni-ne anten al.'], ['12', '12']] as [$text, $spoken]) {
            $this->postJson('/api/speech/resolve', ['text' => $text])->assertOk();
            Http::assertSent(fn ($request) => $request['text'] === $spoken
                && ($request['apply_text_normalization'] ?? null) === 'auto');
        }
    }

    public function test_short_token_length_boundary_and_provider_only_nine_spelling_are_classified(): void
    {
        foreach ([[str_repeat('a', 24), str_repeat('a', 24), 'off'], [str_repeat('a', 25), str_repeat('a', 25), 'auto'], ['nine', 'Ni-ne', 'off']] as [$text, $spoken, $mode]) {
            $this->postJson('/api/speech/resolve', ['text' => $text])->assertOk();
            Http::assertSent(fn ($request) => $request['text'] === $spoken
                && ($request['apply_text_normalization'] ?? null) === $mode);
        }
    }

    public function test_new_normalization_policy_does_not_reuse_private_audio_from_the_previous_policy(): void
    {
        $oldHash = hash('sha256', json_encode(['no', 'approved-test-voice', 'eleven_v4', [], 'irem-v4-v1', [
            'reading_policy' => 'tr-reading-v2',
            'previous_text' => 'Türkçe okuma ve yazma çalışması yapıyoruz.',
            'next_text' => 'Türkçe okumaya devam edelim.',
        ]], JSON_UNESCAPED_UNICODE));
        Storage::disk('local')->put('speech/irem-v4-v1/'.$oldHash.'.mp3', 'ID3old-normalized-numara');
        $first = $this->postJson('/api/speech/resolve', ['text' => 'no'])->assertOk()->json('url');
        $this->assertNotSame($oldHash, basename(parse_url($first, PHP_URL_PATH)));
        $second = $this->postJson('/api/speech/resolve', ['text' => 'no'])->assertOk()->json('url');
        $this->assertSame(parse_url($first, PHP_URL_PATH), parse_url($second, PHP_URL_PATH));
        Http::assertSentCount(1);
    }

    public function test_clients_cannot_choose_normalization_and_personalized_narration_keeps_the_exact_name(): void
    {
        $this->postJson('/api/speech/resolve', ['text' => 'no', 'apply_text_normalization' => 'auto'])->assertUnprocessable();
        Http::assertNothingSent();
        $this->postJson('/api/speech/resolve', ['text' => 'Alparslan ile okumaya başlayalım.', 'profile_name' => 'Alp'])->assertOk();
        Http::assertSent(fn ($request) => $request['text'] === 'Alp ile okumaya başlayalım.'
            && ($request['apply_text_normalization'] ?? null) === 'auto');
    }
}
