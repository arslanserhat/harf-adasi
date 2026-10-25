<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_sessions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('browser_id');
            $table->uuid('completion_id');
            $table->string('mode', 16);
            $table->string('item_key', 120);
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->boolean('writing_reviewed')->nullable();
            $table->timestamps();

            $table->unique(['browser_id', 'completion_id']);
            $table->index(['browser_id', 'mode']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_sessions');
    }
};
