<?php

namespace Tests\Feature;

use App\Models\LearningState;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SpeechIntentTest extends TestCase
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
        Storage::disk('local')->put('test/audio/irem-v4-v1/short-hero.mp3', 'ID3old-short-Alp');
        Storage::disk('local')->put('test/audio/irem-v4-v1/ali.mp3', 'ID3fixed-Ali');
        Storage::disk('local')->put('test/catalog.json', json_encode(['version' => 1, 'revision' => 'irem-v4-v1', 'phrases' => [
            'alparslan ile adım adım öğrenelim.' => ['spoken' => 'Alp ile adım adım öğrenelim.', 'file' => 'irem-v4-v1/short-hero.mp3'],
            'ali' => ['spoken' => 'Ali', 'file' => 'irem-v4-v1/ali.mp3'],
        ]], JSON_UNESCAPED_UNICODE));
        config(['services.elevenlabs' => [
            'enabled' => true, 'key' => 'fake-test-key', 'voice_id' => 'approved-test-voice', 'model_id' => 'eleven_v4',
            'revision' => 'irem-v4-v1', 'settings' => [], 'daily_char_limit' => 500, 'monthly_char_limit' => 1000,
            'session_daily_char_limit' => 500, 'ip_daily_char_limit' => 500,
            'catalog_path' => Storage::disk('local')->path('test/catalog.json'),
            'fixed_audio_path' => Storage::disk('local')->path('test/audio'),
        ]]);
        $this->withSession(['learning_browser_id' => 'intent-browser']);
        LearningState::create(['browser_id' => 'intent-browser', 'revision' => 1, 'payload' => [
            'activeListId' => 'school', 'lists' => [
                ['id' => 'school', 'words' => [], 'sentences' => ['İnal anten al.']],
                ['id' => 'archive', 'words' => [], 'sentences' => ['Nil eski yola git.']],
            ],
        ]]);
    }

    public function test_literal_hero_lesson_preserves_the_canonical_name_and_bypasses_old_short_audio_while_narration_uses_alp(): void
    {
        $text = 'Alparslan ile adım adım öğrenelim.';
        $literal = $this->postJson('/api/speech/resolve', ['text' => $text, 'literal' => true])->assertOk()->json('url');
        Http::assertSent(fn ($request) => $request['text'] === 'Alparslan ile adım adım öğrenelim.'
            && $request['apply_text_normalization'] === 'auto'
            && $request['language_code'] === 'tr');
        $audio = $this->get($literal)->assertOk();
        $this->assertSame('ID3'.str_repeat('audio', 20), $audio->baseResponse->getFile()->getContent());
        $narration = $this->postJson('/api/speech/resolve', ['text' => $text, 'profile_name' => 'Alp'])->assertOk()->json('url');
        Http::assertSent(fn ($request) => $request['text'] === 'Alp ile adım adım öğrenelim.');
        $this->assertNotSame(parse_url($literal, PHP_URL_PATH), parse_url($narration, PHP_URL_PATH));
        $this->postJson('/api/speech/resolve', ['text' => $text, 'profile_name' => ''])->assertOk();
        Http::assertSent(fn ($request) => $request['text'] === 'Minik Aslan ile adım adım öğrenelim.');
        Http::assertSentCount(3);
    }

    public function test_literal_and_narration_intent_have_distinct_private_cache_even_when_the_spoken_teacher_text_matches(): void
    {
        $text = 'İnal anten al.';
        $literal = $this->postJson('/api/speech/resolve', ['text' => $text, 'literal' => true])->assertOk()->json('url');
        $narration = $this->postJson('/api/speech/resolve', ['text' => $text])->assertOk()->json('url');
        $this->assertNotSame(parse_url($literal, PHP_URL_PATH), parse_url($narration, PHP_URL_PATH));
        $this->postJson('/api/speech/resolve', ['text' => $text, 'literal' => true])->assertOk();
        Http::assertSentCount(2);
    }

    public function test_literal_is_a_strict_boolean_and_cannot_be_combined_with_any_profile_name_field(): void
    {
        foreach ([true, false] as $literal) {
            foreach (['Alp', '', null] as $profileName) {
                $this->postJson('/api/speech/resolve', ['text' => 'Ali', 'literal' => $literal, 'profile_name' => $profileName])->assertUnprocessable();
            }
        }
        foreach (['true', 1, null] as $literal) {
            $this->postJson('/api/speech/resolve', ['text' => 'Ali', 'literal' => $literal])->assertUnprocessable();
        }
        Http::assertNothingSent();
    }

    public function test_literal_does_not_change_ordinary_fixed_learning_targets(): void
    {
        $url = $this->postJson('/api/speech/resolve', ['text' => 'Ali', 'literal' => true])->assertOk()->json('url');
        $audio = $this->get($url)->assertOk();
        $this->assertSame('ID3fixed-Ali', $audio->baseResponse->getFile()->getContent());
        Http::assertNothingSent();
    }

    public function test_literal_keeps_unknown_teacher_text_bound_to_the_own_active_saved_list(): void
    {
        $before = LearningState::where('browser_id', 'intent-browser')->first()->payload;
        $this->postJson('/api/speech/resolve', ['text' => 'İnal anten al.', 'literal' => true])->assertOk();
        Http::assertSent(fn ($request) => $request['text'] === 'İnal anten al.');
        $this->postJson('/api/speech/resolve', ['text' => 'Nil eski yola git.', 'literal' => true])->assertUnprocessable();
        $this->postJson('/api/speech/resolve', ['text' => 'Yetkisiz bir metin.', 'literal' => true])->assertUnprocessable();
        $this->withSession(['learning_browser_id' => 'other-intent-browser']);
        $this->postJson('/api/speech/resolve', ['text' => 'İnal anten al.', 'literal' => true])->assertUnprocessable();
        $this->assertSame($before, LearningState::where('browser_id', 'intent-browser')->first()->payload);
        Http::assertSentCount(1);
    }
}
