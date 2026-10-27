<?php

namespace Tests\Feature;

use App\Models\GameSession;
use App\Models\LearningState;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class LearningStateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        if (! config('app.key')) {
            config(['app.key' => 'base64:'.base64_encode(random_bytes(32))]);
        }
    }

    private function snapshot(): array
    {
        return [
            'version' => 1,
            'updatedAt' => 1792960000000,
            'lists' => [[
                'id' => 'teacher-week-1',
                'title' => 'Öğretmenimin kelimeleri',
                'updatedAt' => 1792960000000,
                'words' => [[
                    'text' => 'nane',
                    'parts' => ['na', 'ne'],
                    'meaning' => 'Kokulu yaprakları olan bir bitki.',
                    'sentence' => 'Anne nane al.',
                    'emoji' => '🌿',
                ]],
            ]],
            'activeListId' => 'teacher-week-1',
            'events' => [],
            'progress' => [],
            'session' => null,
        ];
    }

    private function saveState(array $state, int $revision = 0)
    {
        return $this->putJson('/api/learning', ['state' => $state, 'base_revision' => $revision]);
    }

    public function test_empty_snapshot_is_private_and_exposes_no_browser_identity(): void
    {
        $response = $this->getJson('/api/learning')->assertOk()
            ->assertExactJson(['state' => null, 'revision' => 0, 'reset_revision' => 0]);

        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertDatabaseCount('learning_states', 0);
    }

    public function test_custom_turkish_words_round_trip_and_snapshot_is_encrypted_at_rest(): void
    {
        $state = $this->snapshot();
        $state['lists'][0]['words'][] = [
            'text' => 'ışık', 'parts' => ['ı', 'şık'],
            'meaning' => 'Çevremizi görmemizi sağlar.', 'sentence' => 'Işık açıldı.', 'emoji' => '💡',
        ];

        $this->saveState($state)->assertCreated()
            ->assertJsonPath('saved', true)
            ->assertJsonPath('revision', 1)
            ->assertJsonPath('state.lists.0.words.1.text', 'ışık')
            ->assertJsonMissingPath('browser_id');

        $this->getJson('/api/learning')->assertOk()
            ->assertJsonPath('revision', 1)
            ->assertJsonPath('state.lists.0.title', 'Öğretmenimin kelimeleri');
        $this->assertSame($state, LearningState::query()->first()->payload);
        $this->assertStringNotContainsString('nane', DB::table('learning_states')->value('payload'));
    }

    public function test_stale_save_conflicts_and_cannot_overwrite_newer_words(): void
    {
        $state = $this->snapshot();
        $this->saveState($state)->assertCreated();
        $state['lists'][0]['title'] = 'Güncel öğretmen listesi';
        $this->saveState($state, 1)->assertOk()->assertJsonPath('revision', 2);

        $this->saveState($this->snapshot(), 1)->assertConflict()
            ->assertJsonPath('saved', false)
            ->assertJsonPath('conflict', true)
            ->assertJsonPath('revision', 2)
            ->assertJsonPath('state.lists.0.title', 'Güncel öğretmen listesi');
        $this->assertDatabaseCount('learning_states', 1);
    }

    public function test_independent_teacher_letters_and_syllables_round_trip_without_vocabulary_words(): void
    {
        $state = $this->snapshot();
        $state['lists'][0]['words'] = [];
        $state['lists'][0]['letters'] = ['a', 'n', 'e', 'ı', 'i', 'ş', 'ğ'];
        $state['lists'][0]['syllables'] = ['na', 'ne', 'an', 'in', 'let', 'tren', 'ğaç'];

        $this->saveState($state)->assertCreated()
            ->assertJsonPath('state.lists.0.words', [])
            ->assertJsonPath('state.lists.0.letters.3', 'ı')
            ->assertJsonPath('state.lists.0.syllables.4', 'let');
        $this->getJson('/api/learning')->assertOk()
            ->assertJsonPath('state.lists.0.syllables', $state['lists'][0]['syllables']);
        $this->assertSame($state, LearningState::query()->first()->payload);
    }

    public function test_independent_teacher_sentences_round_trip_without_words_and_preserve_turkish_case_and_punctuation(): void
    {
        $state = $this->snapshot();
        $state['lists'][0]['words'] = [];
        $state['lists'][0]['sentences'] = ['  İnal,   Nil ile gel.  ', 'Ali, Ayşe’nin elini tut!', 'Oku.'];
        $this->saveState($state)->assertCreated()
            ->assertJsonPath('state.version', 1)
            ->assertJsonPath('state.lists.0.words', [])
            ->assertJsonPath('state.lists.0.sentences', ['İnal, Nil ile gel.', 'Ali, Ayşe’nin elini tut!', 'Oku.']);
        $this->getJson('/api/learning')->assertOk()
            ->assertJsonPath('state.lists.0.sentences.0', 'İnal, Nil ile gel.')
            ->assertJsonPath('state.events', []);
        $this->assertStringNotContainsString('İnal', DB::table('learning_states')->value('payload'));
    }

    public function test_teacher_sentence_validation_rejects_non_sentences_unsafe_content_and_limits(): void
    {
        $state = $this->snapshot();
        foreach ([
            [''], ['...'], [123], [['text' => 'Ali al.']], ['Ali <b>al</b>.'], ["Ali\nal."], ["Ali\tal."],
            ["Ali\u{2028}al."], ["Ali\0al."], ['William eve gel.'], ['Ali '.str_repeat('a', 237)],
            ['Ali '.str_repeat('al ', 40)],
            array_map(fn ($number) => "Ali $number elma al.", range(0, 100)),
        ] as $sentences) {
            $state['lists'][0]['sentences'] = $sentences;
            $this->assertSame(422, $this->saveState($state)->status(), json_encode($sentences, JSON_UNESCAPED_UNICODE));
        }
        $this->assertDatabaseCount('learning_states', 0);
    }

    public function test_duplicate_teacher_sentences_use_nfc_turkish_case_and_whitespace_but_preserve_distinct_punctuation(): void
    {
        $state = $this->snapshot();
        foreach ([['İNAL   EVE GEL.', 'inal eve gel.'], ["I\u{0307}nal eve gel.", 'İnal eve gel.']] as $duplicates) {
            $state['lists'][0]['sentences'] = $duplicates;
            $this->saveState($state)->assertUnprocessable()->assertJsonValidationErrors('state.lists.0.sentences.1');
        }
        $state['lists'][0]['sentences'] = ['İnal eve gel.', 'İnal eve gel!'];
        $this->saveState($state)->assertCreated()->assertJsonPath('state.lists.0.sentences', $state['lists'][0]['sentences']);
    }

    public function test_invalid_or_duplicate_teacher_units_are_rejected_without_creating_state(): void
    {
        foreach (['n', 'tr', 'anne', 'saat', 'bma', 'xan'] as $invalid) {
            $state = $this->snapshot();
            $state['lists'][0]['syllables'] = [$invalid];
            $this->saveState($state)->assertUnprocessable()
                ->assertJsonValidationErrors('state.lists.0.syllables.0');
        }
        $state = $this->snapshot();
        $state['lists'][0]['letters'] = ['an'];
        $this->saveState($state)->assertUnprocessable()
            ->assertJsonValidationErrors('state.lists.0.letters.0');
        $state['lists'][0]['letters'] = ['a', 'a'];
        $state['lists'][0]['syllables'] = ['na', 'na'];
        $this->saveState($state)->assertUnprocessable()
            ->assertJsonValidationErrors(['state.lists.0.letters.1', 'state.lists.0.syllables.1']);
        $this->assertDatabaseCount('learning_states', 0);
    }

    public function test_teacher_unit_limits_and_separate_list_boundaries_are_enforced(): void
    {
        $state = $this->snapshot();
        $state['lists'][0]['letters'] = ['a'];
        $state['lists'][0]['syllables'] = ['na'];
        $state['lists'][] = [
            'id' => 'teacher-week-2', 'title' => 'İkinci hafta', 'updatedAt' => $state['updatedAt'],
            'words' => [], 'letters' => ['a'], 'syllables' => ['na'],
        ];
        $this->saveState($state)->assertCreated();
        $tooMany = [];
        foreach (mb_str_split('bcçdfghjklmnprsştvyz') as $consonant) {
            foreach (mb_str_split('aeıioöuü') as $vowel) {
                $tooMany[] = $consonant.$vowel;
            }
        }
        $state['lists'][0]['syllables'] = array_slice($tooMany, 0, 101);
        $this->saveState($state, 1)->assertUnprocessable()
            ->assertJsonValidationErrors('state.lists.0.syllables');
        $this->getJson('/api/learning')->assertOk()->assertJsonPath('revision', 1);
    }

    public function test_snapshot_and_reset_are_scoped_to_the_server_session(): void
    {
        $first = (string) Str::uuid();
        $second = (string) Str::uuid();
        $state = $this->snapshot();
        $this->withSession(['learning_browser_id' => $first]);
        $this->saveState($state)->assertCreated();

        $this->withSession(['learning_browser_id' => $second]);
        $this->getJson('/api/learning')->assertOk()->assertJsonPath('state', null);
        $state['lists'][0]['title'] = 'Diğer cihazın listesi';
        $this->saveState($state)->assertCreated();
        $this->deleteJson('/api/learning')->assertOk()->assertJsonPath('revision', 2);

        $this->withSession(['learning_browser_id' => $first]);
        $this->getJson('/api/learning')->assertOk()
            ->assertJsonPath('state.lists.0.title', 'Öğretmenimin kelimeleri')
            ->assertJsonPath('revision', 1);
    }

    public function test_reset_keeps_revision_tombstone_and_delayed_save_cannot_restore_deleted_work(): void
    {
        $this->saveState($this->snapshot())->assertCreated();
        $this->deleteJson('/api/learning')->assertOk()
            ->assertJsonPath('reset', true)->assertJsonPath('revision', 2);
        $this->getJson('/api/learning')->assertOk()
            ->assertExactJson(['state' => null, 'revision' => 2, 'reset_revision' => 2]);
        $this->saveState($this->snapshot(), 1)->assertConflict()
            ->assertJsonPath('state', null)->assertJsonPath('revision', 2);
        $this->saveState($this->snapshot(), 2)->assertOk()->assertJsonPath('revision', 3);
    }

    public function test_reset_boundary_survives_a_later_save_of_retained_teacher_lists(): void
    {
        $this->saveState($this->snapshot())->assertCreated()->assertJsonPath('reset_revision', 0);
        $this->deleteJson('/api/learning')->assertOk()
            ->assertJsonPath('revision', 2)->assertJsonPath('reset_revision', 2);

        // The reset browser keeps the teacher list, then saves a non-null
        // snapshot. Other windows must still see the reset boundary.
        $clean = $this->snapshot();
        $clean['lists'][0]['title'] = 'Sıfırlama sonrasında korunan liste';
        $this->saveState($clean, 2)->assertOk()
            ->assertJsonPath('revision', 3)->assertJsonPath('reset_revision', 2);
        $this->getJson('/api/learning')->assertOk()
            ->assertJsonPath('revision', 3)->assertJsonPath('reset_revision', 2)
            ->assertJsonPath('state.lists.0.title', 'Sıfırlama sonrasında korunan liste');
        $this->saveState($this->snapshot(), 1)->assertConflict()
            ->assertJsonPath('revision', 3)->assertJsonPath('reset_revision', 2)
            ->assertJsonPath('state.events', []);

        $this->deleteJson('/api/learning')->assertOk()
            ->assertJsonPath('revision', 4)->assertJsonPath('reset_revision', 4);
    }

    public function test_reset_before_first_save_also_blocks_an_in_flight_revision_zero_save(): void
    {
        $this->deleteJson('/api/learning')->assertOk()->assertJsonPath('revision', 1);
        $this->saveState($this->snapshot())->assertConflict()->assertJsonPath('state', null);
    }

    public function test_full_progress_reset_clears_adaptive_data_but_learning_only_reset_keeps_legacy_games(): void
    {
        $id = (string) Str::uuid();
        $otherId = (string) Str::uuid();
        $this->withSession(['learning_browser_id' => $id]);
        GameSession::query()->create([
            'browser_id' => $id, 'completion_id' => (string) Str::uuid(),
            'mode' => 'words', 'item_key' => 'word:nane',
            'duration_seconds' => 20, 'writing_reviewed' => true,
        ]);
        LearningState::query()->create(['browser_id' => $otherId, 'revision' => 1, 'payload' => $this->snapshot()]);

        $this->saveState($this->snapshot())->assertCreated();
        $this->deleteJson('/api/learning')->assertOk();
        $this->assertDatabaseCount('game_sessions', 1);
        $this->saveState($this->snapshot(), 2)->assertOk();

        $this->deleteJson('/api/progress')->assertOk()
            ->assertJsonPath('reset', true)->assertJsonPath('learning_revision', 4);
        $this->assertDatabaseCount('game_sessions', 0);
        $this->assertNotNull(LearningState::query()->where('browser_id', $otherId)->first()->payload);
        $this->getJson('/api/learning')->assertJsonPath('state', null)->assertJsonPath('revision', 4);
    }

    public function test_resume_preserves_partial_task_results_and_separate_skill_observations(): void
    {
        $state = $this->snapshot();
        $state['events'] = [[
            'id' => 'event-1', 'word' => 'nane', 'skill' => 'build', 'correct' => true,
            'mistakes' => 1, 'hints' => 1, 'writingReviewed' => false,
            'independent' => false, 'at' => 1792960000000,
        ]];
        $state['progress'] = ['nane' => ['build' => [
            'attempts' => 1, 'independentSuccesses' => 0, 'assistedSuccesses' => 1,
            'mistakes' => 1, 'hints' => 1, 'lastAt' => 1792960000000,
            'lastIndependentAt' => 0, 'nextDueAt' => 1793046400000,
            'intervalDays' => 1, 'independentDays' => [], 'recent' => [1],
        ]]];
        $state['session'] = [
            'id' => 'session-1', 'createdAt' => 1792960000000, 'wordTexts' => ['nane'],
            'tasks' => [[
                'id' => 'task-1', 'word' => 'nane', 'skill' => 'build', 'kind' => 'build',
                'target' => 'nane', 'tokens' => ['n', 'a', 'n', 'e'], 'options' => [],
                'support' => 1, 'reason' => 'Harfleri sırala.', 'parts' => ['na', 'ne'],
                'meaning' => 'Kokulu bir bitki.', 'sentence' => 'Anne nane al.', 'emoji' => '🌿',
            ]],
            'index' => 0,
            'results' => ['task-1' => [
                'correct' => false, 'mistakes' => 1, 'hints' => 1,
                'writingReviewed' => false, 'independent' => false, 'modelOpened' => true,
            ]],
            'paused' => true,
            'storyEpisode' => 2,
        ];

        $this->saveState($state)->assertCreated();
        $this->getJson('/api/learning')->assertOk()
            ->assertJsonPath('state.session.results.task-1.modelOpened', true)
            ->assertJsonPath('state.session.tasks.0.tokens.2', 'n')
            ->assertJsonPath('state.session.storyEpisode', 2)
            ->assertJsonPath('state.progress.nane.build.independentSuccesses', 0)
            ->assertJsonPath('state.events.0.writingReviewed', false);
        $state['session']['storyEpisode'] = 3;
        $this->saveState($state, 1)->assertUnprocessable()
            ->assertJsonValidationErrors('state.session.storyEpisode');
    }

    public function test_long_bounded_writing_and_story_resume_round_trip_without_html_or_unbounded_paths(): void
    {
        $state = $this->snapshot();
        $path = 'M10.0 10.0'.str_repeat('L20.0 20.0', 400);
        $state['session'] = [
            'id' => 'writing-session', 'createdAt' => 1792960000000, 'wordTexts' => ['nane'],
            'tasks' => [[
                'id' => 'writing-task', 'word' => 'nane', 'skill' => 'write', 'kind' => 'write',
                'target' => 'nane', 'tokens' => ['n', 'a', 'n', 'e'], 'options' => [],
                'support' => 1, 'reason' => 'Birlikte yazalım.', 'parts' => ['na', 'ne'],
                'meaning' => '', 'sentence' => '', 'emoji' => '',
            ]],
            'index' => 0, 'paused' => true, 'storySeen' => true,
            'results' => ['writing-task' => [
                'correct' => false, 'mistakes' => 0, 'hints' => 0,
                'writingReviewed' => false, 'independent' => true, 'inkPaths' => [$path],
            ]],
        ];
        $this->saveState($state)->assertCreated();
        $this->getJson('/api/learning')->assertOk()
            ->assertJsonPath('state.session.storySeen', true)
            ->assertJsonPath('state.session.results.writing-task.inkPaths.0', $path);

        $state['session']['results']['writing-task']['inkPaths'] = ['M0 0'.str_repeat('L1 1', 2100)];
        $this->saveState($state, 1)->assertUnprocessable();
        $state['session']['results']['writing-task']['inkPaths'] = ['M0 0<script>'];
        $this->saveState($state, 1)->assertUnprocessable();
        $state['session']['results']['writing-task']['inkPaths'] = [$path];
        $state['session']['results']['writing-task']['correct'] = ['unexpected'];
        $this->saveState($state, 1)->assertUnprocessable();
        $this->getJson('/api/learning')->assertJsonPath('revision', 1);
    }

    public function test_partial_assembly_ui_and_review_exposure_round_trip_without_awarding_success(): void
    {
        $state = $this->partialAssemblySnapshot();
        $this->saveState($state)->assertCreated();
        $this->getJson('/api/learning')->assertOk()
            ->assertJsonPath('state.session.results.assembly-task.ui', $state['session']['results']['assembly-task']['ui'])
            ->assertJsonPath('state.session.results.assembly-task.reviewExposed', false)
            ->assertJsonPath('state.session.results.assembly-task.correct', false)
            ->assertJsonPath('state.session.index', 0)
            ->assertJsonPath('state.events', []);

        $state['session']['tasks'][0]['kind'] = 'write';
        $state['session']['tasks'][0]['skill'] = 'write';
        $result = &$state['session']['results']['assembly-task'];
        $result['ui']['taskKey'] = '["assembly-task","nane","write","write","nane",["n","a","n","e"],[],["na","ne"],1]';
        $result['ui']['selected'] = [];
        $result['reviewExposed'] = true;
        $this->saveState($state, 1)->assertOk();
        $this->getJson('/api/learning')->assertJsonPath('state.session.results.assembly-task.reviewExposed', true)
            ->assertJsonPath('state.session.results.assembly-task.correct', false);
    }

    public function test_resume_ui_rejects_mismatched_tasks_invalid_tiles_and_unbounded_or_extra_fields(): void
    {
        $state = $this->partialAssemblySnapshot();
        $validUi = $state['session']['results']['assembly-task']['ui'];
        $invalidUis = [
            [...$validUi, 'taskKey' => str_replace('assembly-task', 'other-task', $validUi['taskKey'])],
            [...$validUi, 'taskKey' => str_replace('nane', 'anne', $validUi['taskKey'])],
            [...$validUi, 'taskKey' => 'not JSON'],
            [...$validUi, 'taskKey' => str_repeat('x', 8001)],
            [...$validUi, 'selected' => [['id' => 0, 'text' => 'n'], ['id' => 0, 'text' => 'n']]],
            [...$validUi, 'selected' => [['id' => 1, 'text' => 'a']]],
            [...$validUi, 'selected' => [['id' => 99, 'text' => 'n']]],
            [...$validUi, 'selected' => [['id' => '0', 'text' => 'n']]],
            [...$validUi, 'selected' => [['id' => 0, 'text' => '<script>']]],
            [...$validUi, 'selected' => [['id' => 0, 'text' => 'n', 'correct' => true]]],
            [...$validUi, 'selected' => [
                ['id' => 0, 'text' => 'n'], ['id' => 1, 'text' => 'a'], ['id' => 2, 'text' => 'n'], ['id' => 3, 'text' => 'e'],
            ]],
            [...$validUi, 'selected' => array_fill(0, 41, ['id' => 0, 'text' => 'n'])],
            [...$validUi, 'model' => 'true'],
            [...$validUi, 'audioPlayed' => 1],
            [...$validUi, 'independent' => true],
            'unexpected',
        ];
        foreach ($invalidUis as $ui) {
            $state['session']['results']['assembly-task']['ui'] = $ui;
            $this->saveState($state)->assertUnprocessable()->assertJsonValidationErrors('state.session.results');
        }
        $state['session']['results']['assembly-task']['ui'] = $validUi;
        $state['session']['results']['assembly-task']['reviewExposed'] = 'true';
        $this->saveState($state)->assertUnprocessable()->assertJsonValidationErrors('state.session.results');
        $this->assertDatabaseCount('learning_states', 0);
    }

    private function partialAssemblySnapshot(): array
    {
        $state = $this->snapshot();
        $state['session'] = [
            'id' => 'assembly-session', 'createdAt' => 1792960000000, 'wordTexts' => ['nane'],
            'tasks' => [[
                'id' => 'assembly-task', 'word' => 'nane', 'skill' => 'build', 'kind' => 'build',
                'target' => 'nane', 'tokens' => ['n', 'a', 'n', 'e'], 'options' => [],
                'support' => 1, 'reason' => 'Harfleri sırala.', 'parts' => ['na', 'ne'],
                'meaning' => '', 'sentence' => '', 'emoji' => '',
            ]],
            'index' => 0, 'paused' => true, 'storySeen' => true,
            'results' => ['assembly-task' => [
                'correct' => false, 'mistakes' => 0, 'hints' => 1, 'writingReviewed' => false,
                'independent' => false, 'modelOpened' => true, 'reviewExposed' => false,
                'ui' => [
                    'taskKey' => '["assembly-task","nane","build","build","nane",["n","a","n","e"],[],["na","ne"],1]',
                    'selected' => [['id' => 0, 'text' => 'n'], ['id' => 1, 'text' => 'a']],
                    'model' => true, 'audioPlayed' => false,
                ],
            ]],
        ];

        return $state;
    }

    public function test_invalid_syllables_duplicate_words_and_html_are_rejected(): void
    {
        $state = $this->snapshot();
        $state['lists'][0]['words'][0]['parts'] = ['na', 'na'];
        $this->saveState($state)->assertUnprocessable()->assertJsonValidationErrors('state.lists.0.words.0.parts');

        $state = $this->snapshot();
        $state['lists'][0]['words'][] = $state['lists'][0]['words'][0];
        $this->saveState($state)->assertUnprocessable()->assertJsonValidationErrors('state.lists.0.words.1.text');

        $state = $this->snapshot();
        $state['lists'][0]['words'][0]['meaning'] = '<script>alert(1)</script>';
        $this->saveState($state)->assertUnprocessable()->assertJsonValidationErrors('state');
        $this->assertDatabaseCount('learning_states', 0);
    }

    public function test_payload_limits_unknown_skills_and_caller_supplied_identity_are_rejected(): void
    {
        $this->putJson('/api/learning', [
            'state' => $this->snapshot(), 'base_revision' => 0, 'browser_id' => (string) Str::uuid(),
        ])->assertUnprocessable()->assertJsonValidationErrors('browser_id');

        $state = $this->snapshot();
        $state['events'] = array_fill(0, 501, [
            'id' => 'too-many', 'word' => 'nane', 'skill' => 'invalid', 'correct' => true,
            'mistakes' => 0, 'hints' => 0, 'writingReviewed' => false,
            'independent' => true, 'at' => 1792960000000,
        ]);
        $this->saveState($state)->assertUnprocessable()->assertJsonValidationErrors('state.events');

        $state = $this->snapshot();
        $state['lists'][0]['words'][0]['meaning'] = str_repeat('x', 524288);
        $this->saveState($state)->assertUnprocessable()->assertJsonValidationErrors('state');
        $this->assertDatabaseCount('learning_states', 0);
    }

    public function test_malformed_nested_values_return_validation_errors_instead_of_server_errors(): void
    {
        $state = $this->snapshot();
        $state['lists'] = [false];
        $state['progress'] = ['nane' => 'invalid'];
        $state['session'] = ['tasks' => 'invalid', 'results' => ['unknown' => false], 'index' => 200];
        $this->saveState($state)->assertUnprocessable();
    }
}
