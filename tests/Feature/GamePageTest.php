<?php

namespace Tests\Feature;

use Tests\TestCase;

class GamePageTest extends TestCase
{
    public function test_laravel_page_bootstraps_the_shared_game_and_csrf_token(): void
    {
        $this->withoutVite()->get('/')->assertOk()
            ->assertSee('Harf Adası')
            ->assertSee('name="csrf-token"', false)
            ->assertSee('name="harf-backend"', false)
            ->assertSee('id="main"', false);
    }

    public function test_health_check_exposes_no_environment_or_secrets(): void
    {
        $this->getJson('/healthz')->assertOk()->assertExactJson([
            'status' => 'ok',
            'application' => 'harf-adasi',
        ]);
    }
}
