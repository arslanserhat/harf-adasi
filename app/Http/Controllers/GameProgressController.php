<?php

namespace App\Http\Controllers;

use App\Models\GameSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GameProgressController extends Controller
{
    public const MODES = [
        'letters', 'syllables', 'words', 'reading', 'sentences', 'numbers', 'adventures', 'island',
    ];

    public static function browserId(Request $request): string
    {
        if (! $request->session()->has('learning_browser_id')) {
            $request->session()->put('learning_browser_id', (string) Str::uuid());
        }

        return $request->session()->get('learning_browser_id');
    }

    public function __invoke(Request $request): JsonResponse
    {
        $sessions = GameSession::query()
            ->where('browser_id', self::browserId($request))
            ->orderBy('id')
            ->get(['id', 'mode', 'item_key', 'duration_seconds', 'writing_reviewed']);

        // Repeating an exercise is useful practice, but never grants a second
        // distinct completion. A reviewed writing attempt is kept if present.
        $items = $sessions->groupBy(function (GameSession $session): string {
            $key = $session->mode === 'island'
                ? preg_replace('/:(beach|garden|station|cat|dog|bird)$/', '', $session->item_key)
                : $session->item_key;

            return $session->mode.'\0'.$key;
        })
            ->sortBy(fn ($attempts) => $attempts->last()->id)
            ->map(function ($attempts): array {
                $latest = $attempts->last();

                return [
                    'mode' => $latest->mode,
                    'item_key' => $latest->item_key,
                    'writing_reviewed' => $attempts->contains('writing_reviewed', true)
                        ? true : $latest->writing_reviewed,
                ];
            })->values();

        return response()->json([
            'completed_items' => $items,
            'totals' => [
                'sessions' => $sessions->count(),
                'completed_items' => $items->count(),
                'practice_seconds' => $sessions->sum('duration_seconds'),
            ],
            'by_mode' => collect(self::MODES)->mapWithKeys(fn (string $mode): array => [
                $mode => [
                    'sessions' => $sessions->where('mode', $mode)->count(),
                    'completed_items' => $items->where('mode', $mode)->count(),
                ],
            ]),
        ])->header('Cache-Control', 'private, no-store');
    }

    public function destroy(Request $request): JsonResponse
    {
        $browserId = self::browserId($request);
        $revision = DB::transaction(function () use ($browserId): int {
            GameSession::query()->where('browser_id', $browserId)->delete();

            return LearningStateController::clearForBrowser($browserId);
        });

        return response()->json(['reset' => true, 'learning_revision' => $revision])
            ->header('Cache-Control', 'private, no-store');
    }
}
