<?php
declare(strict_types=1);
namespace App\Domain\Publishing;

use PDO;

/**
 * Records a first-party redirect click. No visitor identifier (no cookie,
 * session, IP, or user agent) is ever captured - only what the schema's
 * own column set allows: which link, on which publication, and the
 * referring host. See glinks.click_events in 001_foundation.sql.
 */
final class ClickTracker
{
    public function __construct(private PDO $db) {}

    public function record(int $workspaceId, int $pageId, int $linkId, int $publicationId, ?string $refererHeader): void
    {
        $statement = $this->db->prepare(
            'INSERT INTO glinks.click_events (workspace_id, page_id, link_id, publication_id, referrer_host)
             VALUES (?, ?, ?, ?, ?)'
        );
        $statement->execute([$workspaceId, $pageId, $linkId, $publicationId, $this->refererHost($refererHeader)]);
    }

    /** Host only, never the full referring URL (which can carry paths/query PII). */
    private function refererHost(?string $refererHeader): ?string
    {
        if ($refererHeader === null || $refererHeader === '') {
            return null;
        }
        $host = parse_url($refererHeader, PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            return null;
        }
        // referrer_host CHECK (length <= 253) matches the DNS hostname limit.
        return mb_substr(strtolower($host), 0, 253);
    }
}
