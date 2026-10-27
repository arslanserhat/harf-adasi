<?php

namespace App\Services;

use RuntimeException;

final class SpeechFailure extends RuntimeException
{
    public function __construct(public readonly string $reason, public readonly int $status = 503)
    {
        parent::__construct('Speech request could not be completed.');
    }
}
