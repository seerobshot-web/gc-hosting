<?php
declare(strict_types=1);
namespace App\Domain\Publishing;

use App\Domain\Tenancy\WorkspaceAccess;
use PDO;
use App\Domain\Tenancy\ResourceUnavailable;
use Throwable;

final class PagePublisher
{
    public function __construct(private PDO $db, private WorkspaceAccess $access) {}

    public function publish(int $userId, int $workspaceId, int $pageId): int
    {
        $this->db->beginTransaction();
        try {
            // Workspace lock serializes publication with membership changes.
            $lock = $this->db->prepare('SELECT id FROM glinks.workspaces WHERE id = ? FOR UPDATE');
            $lock->execute([$workspaceId]);
            $this->access->requireRole($userId, $workspaceId, 'publish');
            $page = $this->db->prepare(
                'SELECT draft FROM glinks.pages WHERE workspace_id = ? AND id = ? FOR UPDATE'
            );
            $page->execute([$workspaceId, $pageId]);
            $draft = $page->fetchColumn();
            if (!is_string($draft)) {
                throw new ResourceUnavailable('Page unavailable');
            }
            $links = $this->db->prepare(
                'SELECT id, slug, title, url, emoji, enabled FROM glinks.links
                 WHERE workspace_id = ? AND page_id = ? AND deleted_at IS NULL ORDER BY position, id'
            );
            $links->execute([$workspaceId, $pageId]);
            $snapshotLinks = $links->fetchAll(PDO::FETCH_ASSOC);
            foreach ($snapshotLinks as $link) {
                LinkInput::validate([
                    'title' => $link['title'], 'url' => $link['url'], 'slug' => $link['slug'],
                    'emoji' => $link['emoji'],
                ]);
            }
            $snapshot = json_encode([
                'schemaVersion' => 1,
                'page' => json_decode($draft, true, 512, JSON_THROW_ON_ERROR),
                'links' => $snapshotLinks,
            ], JSON_THROW_ON_ERROR);
            $insert = $this->db->prepare(
                'INSERT INTO glinks.publications (workspace_id, page_id, snapshot)
                 VALUES (?, ?, CAST(? AS jsonb)) RETURNING id'
            );
            $insert->execute([$workspaceId, $pageId, $snapshot]);
            $id = (int) $insert->fetchColumn();
            $update = $this->db->prepare(
                'UPDATE glinks.pages SET published_publication_id = ?, updated_at = now()
                 WHERE workspace_id = ? AND id = ?'
            );
            $update->execute([$id, $workspaceId, $pageId]);
            $this->db->commit();
            return $id;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }
}
