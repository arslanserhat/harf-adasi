<?php

namespace App\Http\Controllers;

use App\Models\GameSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GameProgressController extends Controller
{
    public const MODES = [
        'letters', 'syllables', 'words', 'reading', 'sentences', 'numbers',
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
            ->get(['mode', 'item_key', 'duration_seconds', 'writing_reviewed']);

        // Repeating an exercise is useful practice, but never grants a second
        // distinct completion. A reviewed writing attempt is kept if present.
        $items = $sessions->groupBy(fn (GameSession $session) => $session->mode.'\0'.$session->item_key)
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
        GameSession::query()
            ->where('browser_id', self::browserId($request))
            ->delete();

        return response()->json(['reset' => true])
            ->header('Cache-Control', 'private, no-store');
    }
}
