<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreGameSessionRequest;
use App\Models\GameSession;
use Illuminate\Http\JsonResponse;

class GameSessionController extends Controller
{
    public function store(StoreGameSessionRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $session = GameSession::query()->firstOrCreate([
            'browser_id' => GameProgressController::browserId($request),
            'completion_id' => $validated['completion_id'],
        ], [
            'mode' => $validated['mode'],
            'item_key' => trim($validated['item_key']),
            'duration_seconds' => $validated['duration_seconds'],
            'writing_reviewed' => $validated['writing_reviewed'] ?? null,
        ]);

        // A network retry may confirm the same event; it cannot replace a
        // previous completion with different data or award it twice.
        return response()->json([
            'saved' => true,
            'duplicate' => ! $session->wasRecentlyCreated,
            'completion' => [
                'completion_id' => $session->completion_id,
                'mode' => $session->mode,
                'item_key' => $session->item_key,
                'writing_reviewed' => $session->writing_reviewed,
            ],
        ], $session->wasRecentlyCreated ? 201 : 200)
            ->header('Cache-Control', 'private, no-store');
    }
}
