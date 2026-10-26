<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_states', function (Blueprint $table): void {
            $table->unsignedInteger('reset_revision')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('learning_states', function (Blueprint $table): void {
            $table->dropColumn('reset_revision');
        });
    }
};
