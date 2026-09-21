<?php
declare(strict_types=1);
namespace App\Controllers;

use App\Domain\Publishing\ClickTracker;
use App\Domain\Publishing\PublicPageReader;
use App\Libraries\GlinksDatabase;

/**
 * The public, unauthenticated surface: rendering a published page and
 * tracking + redirecting its link clicks. Reads only immutable publication
 * snapshots (see PublicPageReader) - never the mutable draft/links rows a
 * signed-in editor is working on.
 */
final class PublicPages extends BaseController
{
    public function show(string $handle)
    {
        $db = GlinksDatabase::connect();
        $page = (new PublicPageReader($db))->forHandle($handle);
        if ($page === null) {
            return $this->response->setStatusCode(404);
        }

        // The publication id is a stable, immutable identity for this exact
        // content - republishing creates a new one - so it doubles as a
        // correct ETag with no extra bookkeeping: a cache never needs
        // explicit invalidation, it just stops matching the moment the page
        // is republished.
        $etag = '"pub-' . $page['publicationId'] . '"';
        $ifNoneMatch = $this->request->getHeaderLine('If-None-Match');
        if ($ifNoneMatch !== '' && $ifNoneMatch === $etag) {
            return $this->publicHeaders($this->response->setStatusCode(304), $etag);
        }

        $links = array_map(
            static fn (array $link) => ['title' => $link['title'], 'url' => $link['url'], 'emoji' => $link['emoji'],
                'visitUrl' => site_url('go/' . $handle . '/' . $link['slug'])],
            $page['links'],
        );

        $body = view('public/page', [
            'handle' => $handle,
            'profile' => $page['profile'],
            'links' => $links,
            'canonicalUrl' => site_url($handle),
        ]);

        return $this->publicHeaders($this->response->setBody($body), $etag);
    }

    public function visit(string $handle, string $slug)
    {
        $db = GlinksDatabase::connect();
        $reader = new PublicPageReader($db);
        $page = $reader->forHandle($handle);
        if ($page === null) {
            return $this->response->setStatusCode(404);
        }
        $link = $reader->findEnabledLink($page, $slug);
        if ($link === null) {
            return $this->response->setStatusCode(404);
        }

        try {
            (new ClickTracker($db))->record(
                $page['workspaceId'],
                $page['pageId'],
                $link['id'],
                $page['publicationId'],
                $this->request->getHeaderLine('Referer') ?: null,
            );
        } catch (\Throwable $error) {
            // A visitor's redirect must never fail because analytics did -
            // log it and continue. See ClickTracker for what is and isn't
            // recorded.
            log_message('error', 'GLINKS click tracking failed: {message}', ['message' => $error->getMessage()]);
        }

        // 302, not 301: the destination URL can change on the next publish,
        // and a permanent redirect would let browsers bake in a stale
        // target past that point. Every visit also needs to reach this
        // server to be counted, so the redirect itself is never cached -
        // this route is deliberately left under the default
        // private/no-store response (see PrivateResponses).
        return redirect()->to($link['url'])->setStatusCode(302);
    }

    private function publicHeaders($response, string $etag)
    {
        // CodeIgniter's response starts with a default Cache-Control
        // already set; setHeader() appends to an existing header rather
        // than replacing it, so this must be removed first (same pattern
        // PrivateResponses::after() already uses for the same reason).
        // Referrer-Policy is left to the framework's own SecureHeaders
        // filter (globals.after, runs after this and always wins):
        // "same-origin" is already at least as private as anything this
        // controller would set - no referrer at all is sent cross-origin.
        return $response
            ->setHeader('X-Glinks-Public', '1')
            ->setHeader('ETag', $etag)
            ->removeHeader('Cache-Control')->setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    }
}
