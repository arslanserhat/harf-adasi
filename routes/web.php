<?php

use App\Http\Controllers\GameProgressController;
use App\Http\Controllers\GameSessionController;
use Illuminate\Support\Facades\Route;

Route::view('/', 'game')->name('game');

Route::get('/healthz', fn () => response()->json([
    'status' => 'ok',
    'application' => 'harf-adasi',
]))->name('healthz');

// These JSON routes deliberately live in web.php: browser sessions and Laravel's
// CSRF protection apply, and no caller-supplied profile identifier is accepted.
Route::get('/api/progress', GameProgressController::class)
    ->middleware('throttle:120,1')
    ->name('game.progress');

Route::delete('/api/progress', [GameProgressController::class, 'destroy'])
    ->middleware('throttle:10,1')
    ->name('game.progress.destroy');

Route::post('/api/sessions', [GameSessionController::class, 'store'])
    ->middleware('throttle:60,1')
    ->name('game.sessions.store');
