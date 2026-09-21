<?php
declare(strict_types=1);
namespace App\Domain\Tenancy;

use PDO;
use RuntimeException;

/** Resolve from the authenticated principal, never from a role in request input. */
final class WorkspaceAccess
{
    public function __construct(private PDO $db) {}

    public function requireRole(int $userId, int $workspaceId, string $action): Role
    {
        $statement = $this->db->prepare(
            'SELECT role FROM glinks.memberships WHERE user_id = :user AND workspace_id = :workspace'
        );
        $statement->execute(['user' => $userId, 'workspace' => $workspaceId]);
        $value = $statement->fetchColumn();
        $role = is_string($value) ? Role::tryFrom($value) : null;
        if (!$role || !$role->allows($action)) {
            // HTTP adapters should map this to 404 to avoid disclosing resource existence.
            throw new ResourceUnavailable('Workspace resource unavailable');
        }
        return $role;
    }
}
