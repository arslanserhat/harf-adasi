<?php

namespace App\Http\Requests;

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
        if (strlen($this->getContent()) > 4096 || array_diff(array_keys($this->all()), ['text']) !== []) {
            throw ValidationException::withMessages(['text' => 'Yalnızca kısa bir çalışma metni gönderilebilir.']);
        }
    }

    public function rules(): array
    {
        return ['text' => ['required', 'string', 'max:1000', 'not_regex:/[<>\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u']];
    }
}
