<?php

return [

    'elevenlabs' => [
        'enabled' => env('ELEVENLABS_ENABLED', false),
        'key' => env('ELEVENLABS_API_KEY'),
        'voice_id' => env('ELEVENLABS_VOICE_ID', ''),
        // Enabled only after the approved account's actual model is verified.
        'model_id' => env('ELEVENLABS_MODEL_ID', ''),
        'revision' => env('ELEVENLABS_REVISION', 'irem-v4-v1'),
        'settings' => [
            'stability' => (float) env('ELEVENLABS_STABILITY', 0.5),
            'similarity_boost' => (float) env('ELEVENLABS_SIMILARITY_BOOST', 0.75),
        ],
        'daily_char_limit' => (int) env('ELEVENLABS_DAILY_CHAR_LIMIT', 500),
        'monthly_char_limit' => (int) env('ELEVENLABS_MONTHLY_CHAR_LIMIT', 1000),
        'session_daily_char_limit' => (int) env('ELEVENLABS_SESSION_DAILY_CHAR_LIMIT', 200),
        'ip_daily_char_limit' => (int) env('ELEVENLABS_IP_DAILY_CHAR_LIMIT', 500),
        'catalog_path' => resource_path('speech/catalog.json'),
        'fixed_audio_path' => public_path('audio'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
