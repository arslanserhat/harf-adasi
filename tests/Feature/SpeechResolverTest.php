<?php

namespace Tests\Feature;

use App\Models\LearningState;
use Illuminate\Cache\ArrayLock;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\Repository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SpeechResolverTest extends TestCase
{
    use RefreshDatabase;

    private string $fixture;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=']);
        $this->travelTo(now()->setDate(2026, 10, 10)->setTime(12, 0));
        Cache::flush();
        Storage::fake('local');
        Http::preventStrayRequests();
        $this->fixture = storage_path('framework/testing/speech-'.bin2hex(random_bytes(6)));
        File::ensureDirectoryExists($this->fixture.'/audio/irem-v4-v1');
        File::put($this->fixture.'/catalog.json', json_encode(['version' => 1, 'revision' => 'irem-v4-v1', 'phrases' => [
            'hadi başlayalım.' => ['spoken' => 'Hadi, başlayalım!', 'file' => 'irem-v4-v1/start.mp3'],
            'minik aslan burada.' => ['spoken' => 'Minik Aslan burada.', 'file' => 'irem-v4-v1/lion.mp3'],
        ]], JSON_UNESCAPED_UNICODE));
        config(['services.elevenlabs' => [
            'enabled' => true, 'key' => 'test-key-never-public', 'voice_id' => 'approved-test-voice', 'model_id' => 'approved-test-model',
            'revision' => 'irem-v4-v1', 'settings' => ['stability' => 0.4, 'similarity_boost' => 0.75],
            'daily_char_limit' => 500, 'monthly_char_limit' => 1000, 'session_daily_char_limit' => 200,
            'ip_daily_char_limit' => 500, 'catalog_path' => $this->fixture.'/catalog.json', 'fixed_audio_path' => $this->fixture.'/audio',
        ]]);
        $this->withSession(['learning_browser_id' => 'browser-a']);
        LearningState::create(['browser_id' => 'browser-a', 'revision' => 1, 'payload' => $this->teacherState()]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->fixture);
        parent::tearDown();
    }

    private function teacherState(): array
    {
        return ['activeListId' => 'school', 'lists' => [['id' => 'school', 'letters' => ['l'], 'syllables' => ['la'], 'words' => [
            ['text' => 'nane', 'parts' => ['na', 'ne'], 'sentence' => 'Anne nane al.'],
            ['text' => 'lale', 'parts' => ['la', 'le'], 'sentence' => 'Lale al.'],
        ]]]];
    }

    private function provider(): void
    {
        Http::fake(['api.elevenlabs.io/*' => Http::response('ID3'.str_repeat('audio', 20), 200, ['Content-Type' => 'audio/mpeg'])]);
    }

    public function test_disabled_or_incomplete_provider_never_makes_a_request(): void
    {
        Http::fake();
        config(['services.elevenlabs.enabled' => false]);
        $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertStatus(503)->assertJsonPath('error', 'speech_unavailable');
        config(['services.elevenlabs.enabled' => true, 'services.elevenlabs.voice_id' => '']);
        $this->postJson('/api/speech/resolve', ['text' => 'lale'])->assertStatus(503);
        Http::assertNothingSent();
    }

    public function test_only_exact_authorized_text_and_strict_bounded_payloads_are_accepted(): void
    {
        Http::fake();
        foreach (['Bana istediğim uzun bir metni oku', 'https://example.test/audio.mp3', 'Bilal Deniz', '<script>'] as $text) {
            $this->postJson('/api/speech/resolve', ['text' => $text])->assertUnprocessable();
        }
        foreach (['voice_id', 'model_id', 'url', 'browser_id', 'profile_id', 'user_id'] as $key) {
            $this->postJson('/api/speech/resolve', ['text' => 'nane', $key => 'injected'])->assertUnprocessable();
        }
        $this->postJson('/api/speech/resolve', ['text' => str_repeat('a', 1001)])->assertUnprocessable();
        $this->postJson('/api/speech/resolve', ['text' => ['nane']])->assertUnprocessable();
        Http::assertNothingSent();
    }

    public function test_fixed_new_recording_plays_without_a_key_or_generation_budget_and_requires_its_session(): void
    {
        Http::fake();
        File::put($this->fixture.'/audio/irem-v4-v1/start.mp3', 'ID3fixed-audio');
        config(['services.elevenlabs.enabled' => false, 'services.elevenlabs.daily_char_limit' => 0]);
        $response = $this->postJson('/api/speech/resolve', ['text' => 'Hadi başlayalım.'])->assertOk()
            ->assertJsonStructure(['url', 'revision', 'expires_at'])->assertJsonPath('revision', 'irem-v4-v1');
        $url = $response->json('url');
        $this->assertStringStartsWith('/api/speech/audio/', $url);
        $this->assertGreaterThan(now()->timestamp, $response->json('expires_at'));
        $audio = $this->get($url)->assertOk()->assertHeader('Content-Type', 'audio/mpeg');
        $this->assertStringContainsString('private', $audio->headers->get('Cache-Control'));
        $this->withHeader('Range', 'bytes=0-2')->get($url)->assertStatus(206)->assertHeader('Content-Range', 'bytes 0-2/14');
        $this->withHeader('Range', '')->withSession(['learning_browser_id' => 'browser-b'])->get($url)->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_saved_teacher_text_uses_fixed_voice_and_settings_then_cache_reuse_costs_nothing(): void
    {
        $this->provider();
        $first = $this->postJson('/api/speech/resolve', ['text' => 'NANE'])->assertOk();
        Http::assertSent(fn ($request) => $request->url() === 'https://api.elevenlabs.io/v1/text-to-speech/approved-test-voice?output_format=mp3_44100_128'
            && $request['text'] === 'nane' && $request['model_id'] === 'approved-test-model'
            && ($request['language_code'] ?? null) === 'tr'
            && $request['voice_settings'] === ['stability' => 0.4, 'similarity_boost' => 0.75]);
        config(['services.elevenlabs.daily_char_limit' => 0, 'services.elevenlabs.monthly_char_limit' => 0]);
        $second = $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertOk();
        $this->assertSame(parse_url($first->json('url'), PHP_URL_PATH), parse_url($second->json('url'), PHP_URL_PATH));
        Http::assertSentCount(1);
        $this->assertCount(1, Storage::disk('local')->allFiles('speech'));
        $this->assertStringNotContainsString('test-key', $first->getContent());
    }

    public function test_catalog_spoken_wording_is_canonical_and_generated_clip_is_not_public(): void
    {
        $this->provider();
        $response = $this->postJson('/api/speech/resolve', ['text' => 'Hadi başlayalım.'])->assertOk();
        Http::assertSent(fn ($request) => $request['text'] === 'Hadi, başlayalım!');
        $this->get($response->json('url'))->assertOk();
        $this->assertStringNotContainsString('/storage/', $response->json('url'));
        $this->assertFalse(File::exists(public_path('audio/irem-v4-v1/start.mp3')));
    }

    public function test_other_sessions_cannot_resolve_teacher_text_or_reuse_signed_audio_urls(): void
    {
        $this->provider();
        $url = $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertOk()->json('url');
        $this->withSession(['learning_browser_id' => 'browser-b']);
        $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertUnprocessable();
        $this->get($url)->assertForbidden();
        Http::assertSentCount(1);
    }

    public function test_expired_tampered_and_traversal_playback_is_rejected(): void
    {
        $this->provider();
        $url = $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertOk()->json('url');
        $this->get($url.'x')->assertForbidden();
        $this->get('/api/speech/audio/../catalog.json')->assertNotFound();
        $this->travel(11)->minutes();
        $this->get($url)->assertForbidden();
    }

    public function test_daily_monthly_and_session_character_caps_refuse_new_generation_but_allow_completed_hits(): void
    {
        $this->provider();
        config(['services.elevenlabs.daily_char_limit' => 6]);
        $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertOk();
        $this->postJson('/api/speech/resolve', ['text' => 'lale'])->assertStatus(429)->assertJsonPath('error', 'speech_quota');
        $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertOk();
        config(['services.elevenlabs.daily_char_limit' => 500, 'services.elevenlabs.monthly_char_limit' => 6]);
        $this->travel(1)->days();
        $this->postJson('/api/speech/resolve', ['text' => 'lale'])->assertStatus(429);
        config(['services.elevenlabs.monthly_char_limit' => 1000, 'services.elevenlabs.session_daily_char_limit' => 3]);
        $this->postJson('/api/speech/resolve', ['text' => 'lale'])->assertStatus(429);
        Http::assertSentCount(1);
    }

    public function test_inflight_identical_miss_is_not_synthesized_twice(): void
    {
        $this->provider();
        $url = $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertOk()->json('url');
        $hash = basename(parse_url($url, PHP_URL_PATH));
        foreach (Storage::disk('local')->allFiles('speech') as $file) {
            Storage::disk('local')->delete($file);
        }
        $lock = Cache::lock('speech:generate:'.$hash, 30);
        $this->assertTrue($lock->get());
        try {
            $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertStatus(429);
        } finally {
            $lock->release();
        }
        Http::assertSentCount(1);
    }

    public function test_ambiguous_provider_failure_is_not_retried_and_never_exposes_its_body(): void
    {
        Http::fake(['api.elevenlabs.io/*' => Http::failedConnection('private provider diagnostics with test-key')]);
        $response = $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertStatus(503);
        $this->assertStringNotContainsString('private provider', $response->getContent());
        $this->assertStringNotContainsString('test-key', $response->getContent());
        $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertStatus(503);
        Http::assertSentCount(1);
    }

    public function test_failure_published_after_the_early_check_but_before_lock_acquisition_prevents_duplicate_billing(): void
    {
        $this->provider();
        // Real array-cache reads, writes and locks; advance only the interleaving
        // point where another request finishes with an ambiguous charged failure.
        $store = new class extends ArrayStore
        {
            public function lock($name, $seconds = 0, $owner = null)
            {
                if (! str_starts_with($name, 'speech:generate:')) {
                    return parent::lock($name, $seconds, $owner);
                }

                return new class($this, $name, $seconds, $owner) extends ArrayLock
                {
                    public function acquire()
                    {
                        $acquired = parent::acquire();
                        if ($acquired) {
                            $hash = substr($this->name, strlen('speech:generate:'));
                            $this->store->put('speech:failed:'.$hash, true, 300);
                        }

                        return $acquired;
                    }
                };
            }
        };
        Cache::extend('speech-race', fn () => new Repository($store));
        config(['cache.default' => 'speech-race', 'cache.stores.speech-race' => ['driver' => 'speech-race']]);
        $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertStatus(503)->assertJsonPath('error', 'speech_unavailable');
        Http::assertNothingSent();
        $this->assertSame([], Storage::disk('local')->allFiles('speech'));
    }

    public function test_changing_the_fixed_voice_revision_invalidates_generated_cache(): void
    {
        $this->provider();
        $first = $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertOk()->json('url');
        config(['services.elevenlabs.revision' => 'irem-v4-v2']);
        $second = $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertOk()->assertJsonPath('revision', 'irem-v4-v2')->json('url');
        $this->assertNotSame(parse_url($first, PHP_URL_PATH), parse_url($second, PHP_URL_PATH));
        Http::assertSentCount(2);
    }

    public function test_cached_teacher_audio_still_requires_the_current_active_teacher_list(): void
    {
        $this->provider();
        $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertOk();
        LearningState::where('browser_id', 'browser-a')->first()->update(['payload' => ['activeListId' => 'other', 'lists' => [['id' => 'other', 'words' => []]]]]);
        $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertUnprocessable();
        Http::assertSentCount(1);
    }

    public function test_ip_and_global_limits_cannot_be_evaded_by_creating_a_new_session(): void
    {
        $this->provider();
        config(['services.elevenlabs.ip_daily_char_limit' => 6]);
        $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertOk();
        LearningState::create(['browser_id' => 'browser-b', 'revision' => 1, 'payload' => $this->teacherState()]);
        $this->withSession(['learning_browser_id' => 'browser-b']);
        $this->postJson('/api/speech/resolve', ['text' => 'lale'])->assertStatus(429);
        config(['services.elevenlabs.ip_daily_char_limit' => 500, 'services.elevenlabs.daily_char_limit' => 6]);
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.2'])->postJson('/api/speech/resolve', ['text' => 'lale'])->assertStatus(429);
        Http::assertSentCount(1);
    }

    public function test_uncached_text_requests_have_a_session_rate_limit(): void
    {
        $this->provider();
        foreach (['nane', 'lale', 'na', 'ne', 'la', 'le'] as $word) {
            $this->postJson('/api/speech/resolve', ['text' => $word])->assertOk();
        }
        $this->postJson('/api/speech/resolve', ['text' => 'l'])->assertStatus(429);
        Http::assertSentCount(6);
    }

    public function test_resolver_has_real_web_csrf_protection_without_the_test_bypass(): void
    {
        Http::fake();
        $environment = $this->app['env'];
        $this->app['env'] = 'production';
        try {
            $this->postJson('/api/speech/resolve', ['text' => 'nane'])->assertStatus(419);
        } finally {
            $this->app['env'] = $environment;
        }
        Http::assertNothingSent();
    }
}
