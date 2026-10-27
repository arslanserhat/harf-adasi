<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class RouteThrottleIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->assertSame('array', config('cache.default'));
        config(['app.key' => 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', 'services.elevenlabs.enabled' => false]);
        Http::preventStrayRequests();
        $this->withMiddleware();
        $this->withSession(['learning_browser_id' => 'route-throttle-browser']);
        $this->freezeTime();
    }

    public function test_reading_and_listening_traffic_does_not_consume_the_learning_reset_budget(): void
    {
        for ($index = 0; $index < 12; $index++) {
            $this->getJson('/api/learning')->assertOk();
            $this->postJson('/api/speech/resolve', ['text' => 'Kayıtlı olmayan test cümlesi zürafa.'])->assertUnprocessable();
            $this->getJson('/api/speech/audio/'.str_repeat('a', 64))->assertForbidden();
        }

        $this->deleteJson('/api/learning')->assertOk()
            ->assertJsonPath('reset', true)
            ->assertHeader('X-RateLimit-Limit', '10')
            ->assertHeader('X-RateLimit-Remaining', '9');
        Http::assertNothingSent();
    }

    public static function apiRoutes(): array
    {
        return [
            'read progress' => ['GET', '/api/progress', [], 120, 200],
            'reset progress' => ['DELETE', '/api/progress', [], 10, 200],
            'save game session' => ['POST', '/api/sessions', [], 60, 422],
            'read learning' => ['GET', '/api/learning', [], 120, 200],
            'save learning' => ['PUT', '/api/learning', [], 60, 422],
            'reset learning' => ['DELETE', '/api/learning', [], 10, 200],
            'resolve speech' => ['POST', '/api/speech/resolve', ['text' => 'Kayıtlı olmayan test cümlesi zürafa.'], 120, 422],
            'read speech audio' => ['GET', '/api/speech/audio/'.str_repeat('a', 64), [], 240, 403],
        ];
    }

    #[DataProvider('apiRoutes')]
    public function test_each_api_route_has_its_original_independent_quota(string $method, string $uri, array $body, int $limit, int $status): void
    {
        // Exercise the actual route and throttle middleware. Invalid payloads
        // deliberately avoid writing sessions or requesting provider audio.
        $this->getJson($uri === '/api/learning' ? '/api/progress' : '/api/learning')->assertOk();

        for ($attempt = 1; $attempt <= $limit; $attempt++) {
            $this->json($method, $uri, $body)->assertStatus($status);
        }

        $this->json($method, $uri, $body)->assertStatus(429)
            ->assertHeader('X-RateLimit-Limit', (string) $limit)
            ->assertHeader('X-RateLimit-Remaining', '0');
        Http::assertNothingSent();
    }
}
