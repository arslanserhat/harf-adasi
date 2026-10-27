<?php

use App\Http\Controllers\GameProgressController;
use App\Http\Controllers\GameSessionController;
use App\Http\Controllers\LearningStateController;
use App\Http\Controllers\SpeechController;
use Illuminate\Support\Facades\Route;

Route::view('/', 'game')->name('game');

Route::get('/healthz', fn () => response()->json([
    'status' => 'ok',
    'application' => 'harf-adasi',
]))->name('healthz');

// These JSON routes deliberately live in web.php: browser sessions and Laravel's
// CSRF protection apply, and no caller-supplied profile identifier is accepted.
Route::get('/api/progress', GameProgressController::class)
    ->middleware('throttle:120,1,game.progress:')
    ->name('game.progress');

Route::delete('/api/progress', [GameProgressController::class, 'destroy'])
    ->middleware('throttle:10,1,game.progress.destroy:')
    ->name('game.progress.destroy');

Route::post('/api/sessions', [GameSessionController::class, 'store'])
    ->middleware('throttle:60,1,game.sessions.store:')
    ->name('game.sessions.store');

Route::get('/api/learning', [LearningStateController::class, 'show'])
    ->middleware('throttle:120,1,learning.show:')
    ->name('learning.show');

Route::put('/api/learning', [LearningStateController::class, 'store'])
    ->middleware('throttle:60,1,learning.store:')
    ->name('learning.store');

Route::delete('/api/learning', [LearningStateController::class, 'destroy'])
    ->middleware('throttle:10,1,learning.destroy:')
    ->name('learning.destroy');

Route::post('/api/speech/resolve', [SpeechController::class, 'resolve'])
    ->middleware('throttle:120,1,speech.resolve:')
    ->name('speech.resolve');

Route::get('/api/speech/audio/{hash}', [SpeechController::class, 'audio'])
    ->where('hash', '[a-f0-9]{64}')
    ->middleware('throttle:240,1,speech.audio:')
    ->name('speech.audio');
