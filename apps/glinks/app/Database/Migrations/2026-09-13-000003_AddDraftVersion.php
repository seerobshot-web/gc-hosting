<?php
namespace App\Database\Migrations;
use CodeIgniter\Database\Migration;
final class AddDraftVersion extends Migration
{
    public function up() { $this->db->query('ALTER TABLE glinks.pages ADD COLUMN draft_version bigint NOT NULL DEFAULT 0 CHECK (draft_version>=0)'); }
    public function down() { throw new \RuntimeException('Use a forward migration.'); }
}
