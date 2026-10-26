<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLearningStateRequest;
use App\Models\LearningState;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LearningStateController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $record = LearningState::query()
            ->where('browser_id', GameProgressController::browserId($request))
            ->first();

        return $this->snapshot($record);
    }

    public function store(StoreLearningStateRequest $request): JsonResponse
    {
        $browserId = GameProgressController::browserId($request);
        $validated = $request->validated();
        $baseRevision = (int) $validated['base_revision'];
        $payload = $validated['state'];
        $record = LearningState::query()->where('browser_id', $browserId)->first();

        if (! $record) {
            if ($baseRevision !== 0) {
                return $this->conflict(null);
            }
            try {
                $record = LearningState::query()->create([
                    'browser_id' => $browserId,
                    'payload' => $payload,
                    'revision' => 1,
                ]);

                return $this->snapshot($record, 201, ['saved' => true]);
            } catch (UniqueConstraintViolationException) {
                // A simultaneous first save may already have claimed revision 1.
                return $this->conflict(LearningState::query()->where('browser_id', $browserId)->first());
            }
        }

        // Eloquent bulk updates do not run encrypted attribute casts. Encrypt
        // using a model before the single conditional database update.
        $candidate = new LearningState(['payload' => $payload]);
        $updated = LearningState::query()
            ->whereKey($record->getKey())
            ->where('revision', $baseRevision)
            ->update([
                'payload' => $candidate->getAttributes()['payload'],
                'revision' => $baseRevision + 1,
                'updated_at' => now(),
            ]);

        if ($updated !== 1) {
            return $this->conflict($record->fresh());
        }

        return $this->snapshot($record->fresh(), 200, ['saved' => true]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $revision = self::clearForBrowser(GameProgressController::browserId($request));

        return response()->json(['reset' => true, 'revision' => $revision, 'reset_revision' => $revision])
            ->header('Cache-Control', 'private, no-store');
    }

    public static function clearForBrowser(string $browserId): int
    {
        return DB::transaction(function () use ($browserId): int {
            $record = LearningState::query()->firstOrCreate(
                ['browser_id' => $browserId],
                ['payload' => null, 'revision' => 0],
            );

            // Keep a revision tombstone. A delayed save from before reset must
            // conflict instead of recreating the child's deleted work.
            LearningState::query()->whereKey($record->getKey())->update([
                'payload' => null,
                'reset_revision' => DB::raw('revision + 1'),
                'revision' => DB::raw('revision + 1'),
                'updated_at' => now(),
            ]);

            return $record->fresh()->revision;
        });
    }

    private function conflict(?LearningState $record): JsonResponse
    {
        return $this->snapshot($record, 409, [
            'saved' => false,
            'conflict' => true,
            'message' => 'Daha yeni bir öğrenme kaydı var. Güncel kaydı alıp yeniden deneyin.',
        ]);
    }

    private function snapshot(?LearningState $record, int $status = 200, array $extra = []): JsonResponse
    {
        return response()->json([
            ...$extra,
            'state' => $record?->payload,
            'revision' => $record?->revision ?? 0,
            'reset_revision' => $record?->reset_revision ?? 0,
        ], $status)->header('Cache-Control', 'private, no-store');
    }
}
