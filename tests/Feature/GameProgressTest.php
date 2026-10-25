<?php

namespace Tests\Feature;

use App\Models\GameSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class GameProgressTest extends TestCase
{
    use RefreshDatabase;

    private function completion(array $overrides = []): array
    {
        return array_replace([
            'completion_id' => (string) Str::uuid(),
            'mode' => 'words',
            'item_key' => 'anne',
            'duration_seconds' => 42,
            'writing_reviewed' => true,
        ], $overrides);
    }

    public function test_empty_progress_has_all_six_modes_and_no_child_identity(): void
    {
        $this->getJson('/api/progress')->assertOk()
            ->assertJsonPath('totals.sessions', 0)
            ->assertJsonPath('totals.completed_items', 0)
            ->assertJsonCount(6, 'by_mode')
            ->assertJsonMissingPath('browser_id');
    }

    public function test_completion_retry_does_not_award_or_store_twice(): void
    {
        $payload = $this->completion();
        $this->postJson('/api/sessions', $payload)->assertCreated()
            ->assertJsonPath('duplicate', false);
        $this->postJson('/api/sessions', $payload)->assertOk()
            ->assertJsonPath('duplicate', true);

        $this->assertDatabaseCount('game_sessions', 1);
        $this->getJson('/api/progress')->assertOk()
            ->assertJsonPath('totals.sessions', 1)
            ->assertJsonPath('totals.completed_items', 1)
            ->assertJsonPath('totals.practice_seconds', 42)
            ->assertJsonPath('completed_items.0.writing_reviewed', true);
    }

    public function test_repeating_a_word_counts_practice_but_one_distinct_item(): void
    {
        $this->postJson('/api/sessions', $this->completion())->assertCreated();
        $this->postJson('/api/sessions', $this->completion([
            'duration_seconds' => 18,
            'writing_reviewed' => null,
        ]))->assertCreated();

        $this->getJson('/api/progress')->assertOk()
            ->assertJsonPath('totals.sessions', 2)
            ->assertJsonPath('totals.completed_items', 1)
            ->assertJsonPath('totals.practice_seconds', 60)
            ->assertJsonPath('by_mode.words.completed_items', 1)
            ->assertJsonPath('completed_items.0.writing_reviewed', true);
    }

    public function test_browser_cannot_read_or_replace_another_browsers_progress(): void
    {
        $otherBrowser = (string) Str::uuid();
        $payload = $this->completion();
        GameSession::query()->create(array_merge($payload, ['browser_id' => $otherBrowser]));

        $this->getJson('/api/progress?browser_id='.$otherBrowser)
            ->assertOk()->assertJsonPath('totals.sessions', 0);
        $this->postJson('/api/sessions', array_merge($payload, [
            'browser_id' => $otherBrowser,
            'item_key' => 'etti',
        ]))->assertCreated();

        $this->assertDatabaseCount('game_sessions', 2);
        $this->assertDatabaseHas('game_sessions', [
            'browser_id' => $otherBrowser,
            'item_key' => 'anne',
        ]);
        $this->getJson('/api/progress')->assertOk()
            ->assertJsonPath('totals.sessions', 1)
            ->assertJsonPath('completed_items.0.item_key', 'etti');
    }

    public function test_invalid_mode_duration_and_completion_id_are_rejected(): void
    {
        $this->postJson('/api/sessions', $this->completion([
            'completion_id' => 'not-a-uuid',
            'mode' => 'automatic-handwriting-score',
            'duration_seconds' => -1,
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['completion_id', 'mode', 'duration_seconds']);
        $this->assertDatabaseCount('game_sessions', 0);
    }

    public function test_progress_reset_only_deletes_the_current_browsers_records(): void
    {
        $otherBrowser = (string) Str::uuid();
        GameSession::query()->create(array_merge($this->completion(), [
            'browser_id' => $otherBrowser,
        ]));
        $this->postJson('/api/sessions', $this->completion())->assertCreated();

        $this->deleteJson('/api/progress?browser_id='.$otherBrowser)
            ->assertOk()->assertExactJson(['reset' => true]);
        $this->assertDatabaseCount('game_sessions', 1);
        $this->assertDatabaseHas('game_sessions', ['browser_id' => $otherBrowser]);
        $this->getJson('/api/progress')->assertOk()
            ->assertJsonPath('totals.sessions', 0);
    }

    public function test_native_game_routes_keep_web_session_and_csrf_middleware(): void
    {
        $route = app('router')->getRoutes()->getByName('game.sessions.store');
        $this->assertNotNull($route);
        $this->assertContains('web', $route->gatherMiddleware());
    }

    public function test_completion_endpoint_requires_a_matching_csrf_token(): void
    {
        // Laravel deliberately skips CSRF checks in the testing environment.
        // Exercise the real middleware path while retaining the test database.
        $this->app['env'] = 'local';

        $this->postJson('/api/sessions', $this->completion())->assertStatus(419);
        $this->withSession(['_token' => 'test-csrf-token'])
            ->postJson('/api/sessions', $this->completion(), [
                'X-CSRF-TOKEN' => 'test-csrf-token',
            ])->assertCreated();
    }
}
