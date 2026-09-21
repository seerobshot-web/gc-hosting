<?php
declare(strict_types=1);
namespace App\Domain\Tenancy;
use PDO;
use Throwable;
use InvalidArgumentException;
use CodeIgniter\Shield\Entities\User;

final class InvitationService
{
    public function __construct(private PDO $db) {}
    private function lockWorkspace(int $workspace): void
    {
        $q=$this->db->prepare('SELECT id FROM glinks.workspaces WHERE id=? FOR UPDATE');
        $q->execute([$workspace]);
        if (!$q->fetchColumn()) { throw new ResourceUnavailable(); }
    }
    public function issue(int $actor, int $workspace, string $email, string $role): string
    {
        $email=strtolower(trim($email));
        if (strlen($email)>254 || !filter_var($email,FILTER_VALIDATE_EMAIL)
            || !in_array($role,['editor','viewer'],true)) { throw new InvalidArgumentException('Invalid invitation'); }
        $token=bin2hex(random_bytes(32));
        $this->db->beginTransaction();
        try {
            $this->lockWorkspace($workspace);
            (new WorkspaceAccess($this->db))->requireRole($actor,$workspace,'members');
            $this->db->prepare('UPDATE glinks.invitations SET revoked_at=now()
                WHERE workspace_id=? AND email=? AND used_at IS NULL AND revoked_at IS NULL')->execute([$workspace,$email]);
            $this->db->prepare("INSERT INTO glinks.invitations(workspace_id,invited_by,email,role,token_hash,expires_at)
                VALUES (?,?,?,?,?,now()+interval '48 hours')")->execute([$workspace,$actor,$email,$role,hash('sha256',$token)]);
            $this->db->commit();
            return $token;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) { $this->db->rollBack(); }
            throw $e;
        }
    }
    public function accept(User $user, string $token): int
    {
        if (!$user->active || !preg_match('/\A[a-f0-9]{64}\z/',$token)) { throw new ResourceUnavailable(); }
        $hash=hash('sha256',$token);
        $q=$this->db->prepare('SELECT workspace_id FROM glinks.invitations WHERE token_hash=?');
        $q->execute([$hash]);
        $workspace=(int)$q->fetchColumn();
        $this->db->beginTransaction();
        try {
            $this->lockWorkspace($workspace);
            $q=$this->db->prepare('SELECT * FROM glinks.invitations WHERE token_hash=? AND used_at IS NULL
                AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE');
            $q->execute([$hash]);
            $invite=$q->fetch(PDO::FETCH_ASSOC);
            if (!$invite || !hash_equals($invite['email'],strtolower((string)$user->email))) { throw new ResourceUnavailable(); }
            // A revoked owner cannot leave behind invitations granting future access.
            (new WorkspaceAccess($this->db))->requireRole((int)$invite['invited_by'],$workspace,'members');
            $q=$this->db->prepare("INSERT INTO glinks.users(auth_provider,auth_subject) VALUES ('shield',?)
                ON CONFLICT (auth_provider,auth_subject) DO UPDATE SET auth_subject=EXCLUDED.auth_subject RETURNING id");
            $q->execute([(string)$user->id]);
            $principal=(int)$q->fetchColumn();
            // Accepting an invitation must never promote or demote an existing member.
            $this->db->prepare('INSERT INTO glinks.memberships(workspace_id,user_id,role)
                VALUES (?,?,?) ON CONFLICT (workspace_id,user_id) DO NOTHING')->execute([$workspace,$principal,$invite['role']]);
            $this->db->prepare('UPDATE glinks.invitations SET used_at=now() WHERE id=?')->execute([$invite['id']]);
            $this->db->commit();
            return $workspace;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) { $this->db->rollBack(); }
            throw $e;
        }
    }
    public function revoke(int $actor, int $workspace, int $id): void
    {
        $this->db->beginTransaction();
        try {
            $this->lockWorkspace($workspace);
            (new WorkspaceAccess($this->db))->requireRole($actor,$workspace,'members');
            $q=$this->db->prepare('UPDATE glinks.invitations SET revoked_at=now() WHERE id=? AND workspace_id=? RETURNING id');
            $q->execute([$id,$workspace]);
            if (!$q->fetchColumn()) { throw new ResourceUnavailable(); }
            $this->db->commit();
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) { $this->db->rollBack(); }
            throw $e;
        }
    }
}
