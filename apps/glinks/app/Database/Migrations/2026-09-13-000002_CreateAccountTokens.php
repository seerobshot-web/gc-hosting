<?php
declare(strict_types=1);
namespace App\Database\Migrations;
use CodeIgniter\Database\Migration;
final class CreateAccountTokens extends Migration
{
    public function up()
    {
        $this->db->query(<<<'SQL'
CREATE TABLE glinks.recovery_tokens (
 token_hash char(64) PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES public.users(id),
 email text NOT NULL,
 credential_digest char(64) NOT NULL,
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recovery_user_idx ON glinks.recovery_tokens(user_id);
CREATE TABLE glinks.invitations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 workspace_id bigint NOT NULL REFERENCES glinks.workspaces(id),
 invited_by bigint NOT NULL REFERENCES glinks.users(id),
 email text NOT NULL CHECK (email = lower(email)),
 role text NOT NULL CHECK (role IN ('editor','viewer')),
 token_hash char(64) NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitations_workspace_idx ON glinks.invitations(workspace_id);
SQL);
    }
    public function down() { throw new \RuntimeException('Use a forward migration or restore a backup.'); }
}
