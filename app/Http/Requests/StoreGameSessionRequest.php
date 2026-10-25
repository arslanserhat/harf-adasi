<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreGameSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'completion_id' => ['required', 'uuid'],
            'mode' => ['required', Rule::in([
                'letters', 'syllables', 'words', 'reading', 'sentences', 'numbers', 'adventures', 'island',
            ])],
            'item_key' => ['required', 'string', 'max:120'],
            'duration_seconds' => ['required', 'integer', 'min:0', 'max:3600'],
            'writing_reviewed' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'completion_id.uuid' => 'Alıştırma kimliği geçerli değil.',
            'mode.in' => 'Bu oyun bölümü bulunamadı.',
            'item_key.required' => 'Tamamlanan alıştırma belirtilmeli.',
            'duration_seconds.max' => 'Bir alıştırma en fazla bir saat olabilir.',
        ];
    }
}
