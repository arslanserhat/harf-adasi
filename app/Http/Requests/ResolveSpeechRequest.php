<?php

namespace App\Http\Requests;

use App\Services\SpeechText;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\ValidationException;

final class ResolveSpeechRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (strlen($this->getContent()) > 4096 || array_diff(array_keys($this->all()), ['text', 'profile_name', 'literal']) !== []) {
            throw ValidationException::withMessages(['text' => 'Yalnızca kısa bir çalışma metni gönderilebilir.']);
        }
        if (array_key_exists('literal', $this->all()) && array_key_exists('profile_name', $this->all())) {
            throw ValidationException::withMessages(['literal' => 'Ders metni ve kişisel anlatım birlikte seçilemez.']);
        }
        if (is_string($this->input('profile_name'))) {
            $this->merge(['profile_name' => SpeechText::profileName($this->input('profile_name'))]);
        }
    }

    public function rules(): array
    {
        return [
            'text' => ['required', 'string', 'max:1000', 'not_regex:/[<>\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u'],
            'profile_name' => ['sometimes', 'nullable', 'string', 'max:40', 'regex:/\A[\p{L}\p{M}][\p{L}\p{M} .’\'\-]*\z/u'],
            'literal' => ['sometimes', 'boolean:strict'],
        ];
    }
}
