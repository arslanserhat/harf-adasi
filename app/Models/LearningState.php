<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LearningState extends Model
{
    protected $fillable = ['browser_id', 'payload', 'revision'];

    protected function casts(): array
    {
        return [
            'payload' => 'encrypted:array',
            'revision' => 'integer',
            'reset_revision' => 'integer',
        ];
    }
}
