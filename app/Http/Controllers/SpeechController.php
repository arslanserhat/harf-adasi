<?php

namespace App\Http\Controllers;

use App\Http\Requests\ResolveSpeechRequest;
use App\Services\SpeechFailure;
use App\Services\SpeechResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

final class SpeechController extends Controller
{
    public function resolve(ResolveSpeechRequest $request, SpeechResolver $speech): JsonResponse
    {
        try {
            return response()->json($speech->resolve($request->validated('text'), $request))
                ->header('Cache-Control', 'private, no-store');
        } catch (SpeechFailure $failure) {
            return $this->failure($failure);
        }
    }

    public function audio(Request $request, string $hash, SpeechResolver $speech): BinaryFileResponse|JsonResponse
    {
        try {
            return response()->file($speech->audioPath($hash, $request), [
                'Content-Type' => 'audio/mpeg', 'Cache-Control' => 'private, max-age=600',
                'X-Content-Type-Options' => 'nosniff',
            ])->setPrivate();
        } catch (SpeechFailure $failure) {
            return $this->failure($failure);
        }
    }

    private function failure(SpeechFailure $failure): JsonResponse
    {
        return response()->json(['error' => $failure->reason, 'message' => 'Bu ses şu anda hazırlanamadı. Yazılı yönergeyle devam edebilirsin.'], $failure->status)
            ->header('Cache-Control', 'private, no-store');
    }
}
