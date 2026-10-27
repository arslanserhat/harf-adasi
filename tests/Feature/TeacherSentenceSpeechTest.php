<?php

namespace Tests\Feature;

use App\Models\LearningState;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TeacherSentenceSpeechTest extends TestCase
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
        config(['services.elevenlabs' => [
            'enabled' => true, 'key' => 'fake-test-key', 'voice_id' => 'approved-test-voice', 'model_id' => 'approved-test-model',
            'revision' => 'irem-v4-v1', 'settings' => [], 'daily_char_limit' => 500, 'monthly_char_limit' => 1000,
            'session_daily_char_limit' => 500, 'ip_daily_char_limit' => 500,
            'catalog_path' => storage_path('framework/testing/no-sentence-catalog-'.bin2hex(random_bytes(6)).'.json'),
        ]]);
        $this->withSession(['learning_browser_id' => 'sentence-browser-a']);
        LearningState::create(['browser_id' => 'sentence-browser-a', 'revision' => 1, 'payload' => [
            'activeListId' => 'school', 'lists' => [
                ['id' => 'school', 'words' => [], 'sentences' => ['İnal, Nil ile yeni bahçeye gel.', 'Ali ile Lale, Nil’i bekle.', 'İnal, anten al.', 'Nine anten al.']],
                ['id' => 'archive', 'words' => [], 'sentences' => ['Nil, eski yola git.']],
            ],
        ]]);
    }

    public function test_saved_active_independent_sentence_uses_original_case_names_and_punctuation(): void
    {
        $this->postJson('/api/speech/resolve', ['text' => 'İNAL, NİL İLE YENİ BAHÇEYE GEL.'])->assertOk();
        Http::assertSent(fn ($request) => $request['text'] === 'İnal, Nil ile yeni bahçeye gel.' && $request['language_code'] === 'tr');
        $this->postJson('/api/speech/resolve', ['text' => 'Ali ile Lale, Nil’i bekle.'])->assertOk();
        Http::assertSent(fn ($request) => $request['text'] === 'Ali ile Lale, Nil’i bekle.');
        Http::assertSentCount(2);
    }

    public function test_independent_sentences_require_the_own_session_active_list_and_never_accept_a_profile_rewrite(): void
    {
        $text = 'İnal, Nil ile yeni bahçeye gel.';
        $this->postJson('/api/speech/resolve', ['text' => $text, 'profile_name' => 'Alp'])->assertUnprocessable();
        $this->postJson('/api/speech/resolve', ['text' => 'Nil, eski yola git.'])->assertUnprocessable();
        Http::assertNothingSent();
        $this->postJson('/api/speech/resolve', ['text' => $text])->assertOk();
        $this->withSession(['learning_browser_id' => 'sentence-browser-b']);
        $this->postJson('/api/speech/resolve', ['text' => $text])->assertUnprocessable();
        Http::assertSentCount(1);
    }

    public function test_tapping_exact_sentence_tokens_preserves_saved_case_and_strips_only_edge_punctuation(): void
    {
        $before = LearningState::where('browser_id', 'sentence-browser-a')->first()->payload;
        foreach ([['anten', 'anten'], ['inal', 'İnal'], ['al', 'al']] as [$target, $spoken]) {
            $this->postJson('/api/speech/resolve', ['text' => $target])->assertOk();
            Http::assertSent(fn ($request) => $request['text'] === $spoken);
        }
        $this->assertSame($before, LearningState::where('browser_id', 'sentence-browser-a')->first()->payload);
        Http::assertSentCount(3);
    }

    public function test_sentence_tokens_do_not_authorize_substrings_inactive_content_other_browsers_or_name_rewrites(): void
    {
        foreach (['ante', 'eski', 'yola'] as $target) {
            $this->postJson('/api/speech/resolve', ['text' => $target])->assertUnprocessable();
        }
        $this->postJson('/api/speech/resolve', ['text' => 'anten', 'profile_name' => 'Alp'])->assertUnprocessable();
        Http::assertNothingSent();
        $this->postJson('/api/speech/resolve', ['text' => 'anten'])->assertOk();
        $this->withSession(['learning_browser_id' => 'sentence-browser-b']);
        $this->postJson('/api/speech/resolve', ['text' => 'anten'])->assertUnprocessable();
        Http::assertSentCount(1);
    }

    public function test_sentence_target_names_remain_literal_and_reject_profile_name(): void
    {
        foreach (['Ali', 'Lale', 'Nil', 'İnal'] as $name) {
            $this->postJson('/api/speech/resolve', ['text' => $name, 'profile_name' => 'Alp'])->assertUnprocessable();
            $this->postJson('/api/speech/resolve', ['text' => $name])->assertOk();
            Http::assertSent(fn ($request) => $request['text'] === $name);
        }
        Http::assertSentCount(4);
    }

    public function test_sentence_word_taps_keep_the_existing_provider_only_turkish_pronunciation_policy(): void
    {
        $this->postJson('/api/speech/resolve', ['text' => 'Nine'])->assertOk();
        Http::assertSent(fn ($request) => $request['text'] === 'Ni-ne');
        $this->assertSame('Nine anten al.', LearningState::where('browser_id', 'sentence-browser-a')->first()->payload['lists'][0]['sentences'][3]);
    }
}
