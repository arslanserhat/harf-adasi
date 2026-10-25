<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GameSession extends Model
{
    protected $fillable = [
        'browser_id',
        'completion_id',
        'mode',
        'item_key',
        'duration_seconds',
        'writing_reviewed',
    ];

    protected function casts(): array
    {
        return [
            'duration_seconds' => 'integer',
            'writing_reviewed' => 'boolean',
        ];
    }
}
