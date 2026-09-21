<?php
declare(strict_types=1);

use App\Domain\Publishing\PageEditor;
use App\Domain\Publishing\PagePublisher;
use App\Domain\Tenancy\WorkspaceAccess;
use App\Libraries\GlinksDatabase;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\FeatureTestTrait;

final class PublicPageTest extends CIUnitTestCase
{
    use FeatureTestTrait;

    protected function setUp(): void
    {
        parent::setUp();
        // The public routes are registered outside the enableTenantRoutes
        // gate, but the router still only reads Config/Routes.php once per
        // process (see TenantHttpTest's setUp for why) - reset regardless
        // so this suite doesn't depend on execution order relative to it.
        service('routes')->resetRoutes();
    }

    /** @return array{0:int,1:int,2:string} [workspaceId, pageId, handle] */
    private function draftPage(\PDO $db): array
    {
        $model = model(UserModel::class);
        $name = 'u' . bin2hex(random_bytes(5));
        $user = new User(['username' => $name, 'email' => $name . '@example.test',
            'password' => 'LongTestPassword!473', 'active' => 1]);
        $model->save($user);
        $user = $model->findById($model->getInsertID());

        $db->beginTransaction();
        $q = $db->prepare("INSERT INTO glinks.users(auth_provider,auth_subject) VALUES ('shield',?) RETURNING id");
        $q->execute([(string) $user->id]);
        $uid = (int) $q->fetchColumn();
        $q = $db->prepare('INSERT INTO glinks.workspaces(name) VALUES (?) RETURNING id');
        $q->execute(['Public test workspace']);
        $workspaceId = (int) $q->fetchColumn();
        $q = $db->prepare("INSERT INTO glinks.memberships VALUES (?,?,'owner')");
        $q->execute([$workspaceId, $uid]);
        $handle = 'p-' . bin2hex(random_bytes(6));
        $q = $db->prepare("INSERT INTO glinks.pages(workspace_id,handle,draft) VALUES (?,?,'{}') RETURNING id");
        $q->execute([$workspaceId, $handle]);
        $pageId = (int) $q->fetchColumn();
        $db->commit();

        return [$uid, $workspaceId, $pageId, $handle];
    }

    /** Publishes a page with the given profile/links, returns the handle. */
    private function publishedPage(\PDO $db, array $profile, array $links): string
    {
        [$uid, $workspaceId, $pageId, $handle] = $this->draftPage($db);
        (new PageEditor($db))->save($uid, $workspaceId, $pageId, 0, $profile, $links);
        (new PagePublisher($db, new WorkspaceAccess($db)))->publish($uid, $workspaceId, $pageId);
        return $handle;
    }

    public function testPublishedPageReturns200WithProfileLinksAndMetadata(): void
    {
        $db = GlinksDatabase::connect();
        $handle = $this->publishedPage($db,
            ['name' => 'Grace Community', 'bio' => 'Sunday gatherings and giving.'],
            [['slug' => 'give', 'title' => 'Give Online', 'url' => 'https://example.org/give', 'emoji' => '💝']]);

        $result = $this->get($handle);
        $result->assertStatus(200);
        $result->assertSee('Grace Community');
        $result->assertSee('Sunday gatherings and giving.');
        $result->assertSee('Give Online');
        $body = (string) $result->response()->getBody();
        self::assertStringContainsString('rel="canonical"', $body);
        self::assertStringContainsString('property="og:title"', $body);
        // esc() HTML-encodes the slashes in attribute values (correct,
        // safe behavior) - assert against the encoded form it actually emits.
        self::assertStringContainsString('go&#x2F;' . $handle . '&#x2F;give', $body);
        self::assertTrue($result->response()->hasHeader('ETag'));
        self::assertSame('public, max-age=60, must-revalidate', $result->response()->getHeaderLine('Cache-Control'));
    }

    public function testConditionalGetReturns304ForMatchingEtag(): void
    {
        $db = GlinksDatabase::connect();
        $handle = $this->publishedPage($db, ['name' => 'Etag Test', 'bio' => ''], []);

        $first = $this->get($handle);
        $etag = $first->response()->getHeaderLine('ETag');
        self::assertNotSame('', $etag);

        $second = $this->withHeaders(['If-None-Match' => $etag])->get($handle);
        $second->assertStatus(304);
    }

    public function testDraftOnlyPageReturns404(): void
    {
        $db = GlinksDatabase::connect();
        [, , , $handle] = $this->draftPage($db);

        $this->get($handle)->assertStatus(404);
    }

    public function testMissingHandleReturns404(): void
    {
        $this->get('this-handle-does-not-exist-' . bin2hex(random_bytes(4)))->assertStatus(404);
    }

    public function testReservedHandlesWithNoOtherRouteNeverResolveAsPublicPages(): void
    {
        // These are among the words glinks.pages.handle's CHECK constraint
        // reserves (001_foundation.sql) - a real page can never have one -
        // and, unlike login/register/workspaces/recover, none of them is
        // also a real tenant route, so they must 404 regardless of
        // enableTenantRoutes. (login/register's own reserved-handle safety
        // is exercised implicitly: they 200 as Shield's real pages when
        // open and 404 via the same catch-all as everything else when
        // closed, covered by TenantHttpTest's closed/open gate tests.)
        foreach (['admin', 'api', 'go', 'stats', 'health', 'www', 'support'] as $reserved) {
            $this->get($reserved)->assertStatus(404);
        }
    }

    public function testDisabledLinkIsHiddenFromPageAndItsRedirect404s(): void
    {
        $db = GlinksDatabase::connect();
        $handle = $this->publishedPage($db, ['name' => 'Disabled link test', 'bio' => ''], [
            ['slug' => 'hidden', 'title' => 'Hidden Link', 'url' => 'https://example.org/hidden', 'enabled' => false],
            ['slug' => 'shown', 'title' => 'Shown Link', 'url' => 'https://example.org/shown'],
        ]);

        $result = $this->get($handle);
        $result->assertDontSee('Hidden Link');
        $result->assertSee('Shown Link');
        $this->get("go/$handle/hidden")->assertStatus(404);
    }

    public function testRedirectTracksAndRedirectsToTheLinkUrl(): void
    {
        $db = GlinksDatabase::connect();
        $handle = $this->publishedPage($db, ['name' => 'Redirect test', 'bio' => ''],
            [['slug' => 'website', 'title' => 'Website', 'url' => 'https://example.org/site']]);

        $before = (int) $db->query('SELECT count(*) FROM glinks.click_events')->fetchColumn();
        $result = $this->get("go/$handle/website");
        $result->assertRedirectTo('https://example.org/site');
        self::assertSame(302, $result->response()->getStatusCode());
        $after = (int) $db->query('SELECT count(*) FROM glinks.click_events')->fetchColumn();
        self::assertSame($before + 1, $after);

        $row = $db->query('SELECT referrer_host FROM glinks.click_events ORDER BY id DESC LIMIT 1')->fetch();
        self::assertNull($row['referrer_host']);
    }

    public function testRedirectRecordsRefererHostOnlyNeverTheFullUrl(): void
    {
        $db = GlinksDatabase::connect();
        $handle = $this->publishedPage($db, ['name' => 'Referer test', 'bio' => ''],
            [['slug' => 'website', 'title' => 'Website', 'url' => 'https://example.org/site']]);

        $this->withHeaders(['Referer' => 'https://instagram.com/some/deep/path?with=query'])
            ->get("go/$handle/website");

        $row = $db->query('SELECT referrer_host FROM glinks.click_events ORDER BY id DESC LIMIT 1')->fetch();
        self::assertSame('instagram.com', $row['referrer_host']);
    }

    public function testMalformedRedirectSlugReturns404WithoutTrackingAnything(): void
    {
        $db = GlinksDatabase::connect();
        $handle = $this->publishedPage($db, ['name' => 'Malformed slug test', 'bio' => ''],
            [['slug' => 'website', 'title' => 'Website', 'url' => 'https://example.org/site']]);

        $before = (int) $db->query('SELECT count(*) FROM glinks.click_events')->fetchColumn();
        $this->get("go/$handle/no-such-slug")->assertStatus(404);
        $after = (int) $db->query('SELECT count(*) FROM glinks.click_events')->fetchColumn();
        self::assertSame($before, $after);
    }

    public function testPublicPageNeverExposesWorkspaceOrDraftInternals(): void
    {
        $db = GlinksDatabase::connect();
        [$uid, $workspaceId, $pageId, $handle] = $this->draftPage($db);
        (new PageEditor($db))->save($uid, $workspaceId, $pageId, 0,
            ['name' => 'No leak', 'bio' => 'Public bio'], []);
        (new PagePublisher($db, new WorkspaceAccess($db)))->publish($uid, $workspaceId, $pageId);

        $body = (string) $this->get($handle)->response()->getBody();
        // A raw numeric id is a bad thing to assert against here: it's
        // just an integer, and small values (e.g. workspace id 8) are
        // near-certain to appear incidentally in an HTML document anyway
        // (charset="utf-8", viewport scale, CSS) - this was a false
        // positive first, not a real leak. What actually matters is that
        // no internal field name or identifier label ever appears, since
        // those are what would indicate the response started leaking
        // workspace/draft internals rather than the public projection.
        foreach (['workspace_id', 'page_id', 'draft_version', 'published_publication_id'] as $internalField) {
            self::assertStringNotContainsString($internalField, $body);
        }
    }
}
