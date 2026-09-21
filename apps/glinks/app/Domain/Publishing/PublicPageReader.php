<?php
declare(strict_types=1);
namespace App\Domain\Publishing;

use PDO;

/**
 * Read-only projection of a page's currently published snapshot, for the
 * public (unauthenticated) surface. Never reads the mutable `draft`/`links`
 * rows — publication.snapshot is the immutable contract (see PagePublisher).
 */
final class PublicPageReader
{
    public function __construct(private PDO $db) {}

    /**
     * @return array{workspaceId:int,pageId:int,publicationId:int,publishedAt:string,profile:array{name:string,bio:string},links:list<array{id:int,slug:string,title:string,url:string,emoji:?string,enabled:bool}>}|null
     */
    public function forHandle(string $handle): ?array
    {
        // The join to publications on the page's own published_publication_id
        // returns no row for both "no such page" and "page exists but was
        // never published" - a page that only ever had a draft is not
        // distinguishable from a page that doesn't exist, same as every
        // other resource-existence check in this app.
        $statement = $this->db->prepare(
            'SELECT p.workspace_id, p.id AS page_id, pub.id AS publication_id,
                    pub.snapshot, pub.created_at
             FROM glinks.pages p
             JOIN glinks.publications pub
                 ON pub.workspace_id = p.workspace_id
                AND pub.page_id = p.id
                AND pub.id = p.published_publication_id
             WHERE p.handle = ?'
        );
        $statement->execute([$handle]);
        $row = $statement->fetch();
        if ($row === false) {
            return null;
        }

        $snapshot = json_decode($row['snapshot'], true, 512, JSON_THROW_ON_ERROR);
        $links = [];
        foreach ($snapshot['links'] ?? [] as $link) {
            if (($link['enabled'] ?? false) !== true) {
                continue;
            }
            $links[] = [
                'id' => (int) $link['id'],
                'slug' => (string) $link['slug'],
                'title' => (string) $link['title'],
                'url' => (string) $link['url'],
                'emoji' => $link['emoji'] ?? null,
                'enabled' => true,
            ];
        }

        return [
            'workspaceId' => (int) $row['workspace_id'],
            'pageId' => (int) $row['page_id'],
            'publicationId' => (int) $row['publication_id'],
            'publishedAt' => (string) $row['created_at'],
            'profile' => [
                'name' => (string) ($snapshot['page']['name'] ?? ''),
                'bio' => (string) ($snapshot['page']['bio'] ?? ''),
            ],
            'links' => $links,
        ];
    }

    /**
     * @param array{links:list<array{id:int,slug:string,url:string,enabled:bool}>} $page as returned by forHandle()
     * @return array{id:int,url:string}|null
     */
    public function findEnabledLink(array $page, string $slug): ?array
    {
        foreach ($page['links'] as $link) {
            if ($link['slug'] === $slug) {
                return ['id' => $link['id'], 'url' => $link['url']];
            }
        }
        return null;
    }
}
