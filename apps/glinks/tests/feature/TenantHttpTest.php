<?php
declare(strict_types=1);

use App\Libraries\GlinksDatabase;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Shield\Test\AuthenticationTesting;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\FeatureTestTrait;

final class TenantHttpTest extends CIUnitTestCase
{
    use FeatureTestTrait;
    use AuthenticationTesting;


    protected function setUp(): void
    {
        parent::setUp();
        config('Email')->fromEmail='glinks@example.test';
        config('Email')->fromName='GLINKS';
        config('Glinks')->enableTenantRoutes = true;
        // RouteCollection caches Config/Routes.php's output after the first
        // load (didDiscover); framework bootstrap triggers that first load
        // before any test's setUp() runs, with the gate still closed. Force
        // a fresh read here so this run's routes reflect the flag above.
        service('routes')->resetRoutes();
        auth()->logout();
        $_SESSION = [];
        $this->session = [];
        // Every case gets its own rate-limit cache namespace.
        config('Cache')->prefix = 'glinks-test-'.bin2hex(random_bytes(6)).'-';
        \Config\Services::resetSingle('cache');
        \Config\Services::resetSingle('throttler');
    }

    private function user(string $suffix): User
    {
        $name = 'u' . bin2hex(random_bytes(5)) . $suffix;
        $model = model(UserModel::class);
        $user = new User(['username'=>$name,'email'=>$name.'@example.test',
            'password'=>'LongTestPassword!473','active'=>1]);
        self::assertTrue($model->save($user));
        return $model->findById($model->getInsertID());
    }

    private function fixture(): array
    {
        $owner = $this->user('owner');
        $other = $this->user('other');
        $db = GlinksDatabase::connect();
        $db->beginTransaction();
        $ids = [];
        foreach ([$owner,$other] as $index=>$user) {
            $q=$db->prepare("INSERT INTO glinks.users(auth_provider,auth_subject) VALUES ('shield',?) RETURNING id");
            $q->execute([(string)$user->id]);
            $uid=(int)$q->fetchColumn();
            $q=$db->prepare('INSERT INTO glinks.workspaces(name) VALUES (?) RETURNING id');
            $q->execute(['Workspace '.$index]);
            $wid=(int)$q->fetchColumn();
            $q=$db->prepare("INSERT INTO glinks.memberships VALUES (?,?,'owner')");
            $q->execute([$wid,$uid]);
            $q=$db->prepare("INSERT INTO glinks.pages(workspace_id,handle,draft) VALUES (?,?,'{\"name\":\"Draft\"}') RETURNING id");
            $q->execute([$wid,'page-'.bin2hex(random_bytes(6))]);
            $pid=(int)$q->fetchColumn();
            $ids[]=[$uid,$wid,$pid];
        }
        $db->commit();
        return [$owner,$other,$ids,$db];
    }

    public function testAnonymousRequestsCannotReadWorkspaces(): void
    {
        $this->get('workspaces')->assertRedirectTo(site_url('login'));
    }

    public function testSessionLoginUsesShieldCredentials(): void
    {
        $user=$this->user('login');
        $token=csrf_hash();
        $this->withSession()->post('login',[
            'email'=>$user->email,'password'=>'LongTestPassword!473',csrf_token()=>$token,
        ])->assertRedirectTo(site_url('workspaces'));
        self::assertTrue(auth()->loggedIn());
        self::assertSame((int)$user->id,(int)auth()->id());
    }

    public function testOwnPageCanBeReadAndPublished(): void
    {
        [$owner,,$ids,$db]=$this->fixture();
        [, $wid,$pid]=$ids[0];
        $this->actingAs($owner)->withSession()->get("workspaces/$wid/pages/$pid")->assertStatus(200);
        $token=csrf_hash();
        $result=$this->withSession()->post("workspaces/$wid/pages/$pid/publish",[csrf_token()=>$token]);
        $result->assertStatus(200);
        $result->assertHeader('Cache-Control','private, no-store');
        $q=$db->prepare('SELECT published_publication_id FROM glinks.pages WHERE workspace_id=? AND id=?');
        $q->execute([$wid,$pid]);
        self::assertGreaterThan(0,(int)$q->fetchColumn());
    }

    public function testOtherWorkspaceCannotBeRead(): void
    {
        [$owner,,$ids]=$this->fixture();
        [, $wid,$pid]=$ids[1];
        $result=$this->actingAs($owner)->withSession()->get("workspaces/$wid/pages/$pid");
        $result->assertStatus(404);
        self::assertStringNotContainsString('"Draft"', $result->response()->getBody());
    }

    public function testPageIdCannotBeSubstitutedAcrossWorkspaces(): void
    {
        [$owner,,$ids]=$this->fixture();
        $wid=$ids[0][1]; $pid=$ids[1][2];
        $this->actingAs($owner)->withSession()->get("workspaces/$wid/pages/$pid")->assertStatus(404);
    }

    public function testOtherWorkspaceCannotBePublished(): void
    {
        [$owner,,$ids,$db]=$this->fixture();
        [, $wid,$pid]=$ids[1];
        $this->actingAs($owner);
        $token=csrf_hash();
        $this->withSession()->post("workspaces/$wid/pages/$pid/publish",[csrf_token()=>$token])->assertStatus(404);
        self::assertSame(0,(int)$db->query('SELECT count(*) FROM glinks.publications WHERE page_id='.(int)$pid)->fetchColumn());
    }

    public function testViewerCannotPublish(): void
    {
        [$owner,$viewer,$ids,$db]=$this->fixture();
        $wid=$ids[0][1]; $pid=$ids[0][2]; $viewerId=$ids[1][0];
        $db->prepare("INSERT INTO glinks.memberships VALUES (?,?,'viewer')")->execute([$wid,$viewerId]);
        $this->actingAs($viewer)->withSession()->get("workspaces/$wid/pages/$pid")->assertStatus(200);
        $token=csrf_hash();
        $this->withSession()->post("workspaces/$wid/pages/$pid/publish",[csrf_token()=>$token])->assertStatus(404);
    }

    public function testWorkspaceCreationRejectsOwnerInjection(): void
    {
        $user=$this->user('create');
        $this->actingAs($user);
        $token=csrf_hash();
        $this->withSession()->post('workspaces',[
            'name'=>'Injected workspace','user_id'=>12345,csrf_token()=>$token,
        ])->assertStatus(422);
    }

    public function testRegistrationCreatesAShieldAccount(): void
    {
        $name='register'.bin2hex(random_bytes(4));
        $token=csrf_hash();
        $this->withSession()->post('register',[
            'username'=>$name,'email'=>$name.'@example.test',
            'password'=>'LongRegistrationPassword!473',
            'password_confirm'=>'LongRegistrationPassword!473',
            csrf_token()=>$token,
        ])->assertRedirectTo(url_to('auth-action-show'));
        self::assertFalse(auth()->loggedIn());
        $pending=auth('session')->getAuthenticator()->getPendingUser();
        self::assertSame($name,$pending->username);
        self::assertFalse((bool)$pending->active);
        $activation=new \CodeIgniter\Shield\Authentication\Actions\EmailActivator();
        $code=$activation->createIdentity($pending);
        $this->withSession()->post('auth/a/verify',[
            'token'=>$code,csrf_token()=>csrf_hash(),
        ])->assertRedirectTo(site_url('workspaces'));
        self::assertTrue(auth()->loggedIn());
        self::assertTrue((bool)model(UserModel::class)->findById($pending->id)->active);
    }

    public function testWrongPasswordDoesNotAuthenticate(): void
    {
        $user=$this->user('wrong');
        $token=csrf_hash();
        $this->withSession()->post('login',[
            'email'=>$user->email,'password'=>'DefinitelyWrong!873',csrf_token()=>$token,
        ])->assertRedirect();
        self::assertFalse(auth()->loggedIn());
    }

    public function testEditorCanPublish(): void
    {
        [, $editor,$ids,$db]=$this->fixture();
        $wid=$ids[0][1]; $pid=$ids[0][2];
        $db->prepare("INSERT INTO glinks.memberships VALUES (?,?,'editor')")->execute([$wid,$ids[1][0]]);
        $this->actingAs($editor);
        $token=csrf_hash();
        $this->withSession()->post("workspaces/$wid/pages/$pid/publish",[csrf_token()=>$token])->assertStatus(200);
    }

    public function testWorkspaceCreatorBecomesOwner(): void
    {
        $user=$this->user('workspace');
        $name='New ministry '.bin2hex(random_bytes(4));
        $this->actingAs($user);
        $token=csrf_hash();
        $this->withSession()->post('workspaces',['name'=>$name,csrf_token()=>$token])->assertRedirect();
        $db=GlinksDatabase::connect();
        $q=$db->prepare("SELECT m.role FROM glinks.workspaces w
            JOIN glinks.memberships m ON m.workspace_id=w.id
            JOIN glinks.users u ON u.id=m.user_id
            WHERE w.name=? AND u.auth_provider='shield' AND u.auth_subject=?");
        $q->execute([$name,(string)$user->id]);
        self::assertSame('owner',$q->fetchColumn());
    }

    public function testMutationWithoutCsrfIsRejected(): void
    {
        $user=$this->user('csrf');
        $this->actingAs($user);
        $this->expectException(\CodeIgniter\Security\Exceptions\SecurityException::class);
        $this->withSession()->post('workspaces',['name'=>'Rejected ministry']);
    }


    public function testAuthRoutesAreRateLimited(): void
    {
        for ($i=0;$i<10;$i++) {
            $this->get('login')->assertStatus(200);
        }
        $this->get('login')->assertStatus(429);
    }


    private function unavailable(callable $operation): void
    {
        try { $operation(); self::fail('Expected ResourceUnavailable'); }
        catch (\App\Domain\Tenancy\ResourceUnavailable) { self::assertTrue(true); }
    }

    public function testRecoveryUpdatesPasswordRejectsReplayAndInvalidatesSession(): void
    {
        $user=$this->user('recovery');
        $this->actingAs($user);
        $db=GlinksDatabase::connect();
        $recovery=new \App\Libraries\RecoveryTokens($db);
        $token=$recovery->issue($user->email);
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/',$token);
        $q=$db->prepare('SELECT token_hash FROM glinks.recovery_tokens WHERE user_id=?');
        $q->execute([$user->id]);
        self::assertSame(hash('sha256',$token),$q->fetchColumn());
        $recovery->reset($token,'ReplacementCredential!6829');
        $this->unavailable(fn()=>$recovery->reset($token,'ReplacementCredential!6829'));
        $this->withSession()->get('workspaces')->assertRedirectTo(site_url('login'));
        self::assertFalse(auth()->loggedIn());
        $this->withSession()->post('login',['email'=>$user->email,
            'password'=>'ReplacementCredential!6829',csrf_token()=>csrf_hash()])->assertRedirectTo(site_url('workspaces'));
        self::assertTrue(auth()->loggedIn());
    }

    public function testRecoveryRejectsExpiredAndUnverifiedAccounts(): void
    {
        $user=$this->user('expired');
        $db=GlinksDatabase::connect();
        $recovery=new \App\Libraries\RecoveryTokens($db);
        $token=$recovery->issue($user->email);
        $db->prepare("UPDATE glinks.recovery_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=?")
            ->execute([hash('sha256',$token)]);
        $this->unavailable(fn()=>$recovery->reset($token,'ReplacementCredential!6829'));
        $user->active=0;
        model(UserModel::class)->save($user);
        self::assertNull($recovery->issue($user->email));
        self::assertNull($recovery->issue('missing-account@example.test'));
    }

    public function testRecoveryResponseDoesNotDiscloseAccountExistence(): void
    {
        $user=$this->user('mail');
        $email=$this->getMockBuilder(\CodeIgniter\Email\Email::class)->onlyMethods(['send'])->getMock();
        $email->expects(self::once())->method('send')->willReturn(true);
        \Config\Services::injectMock('email',$email);
        $known=$this->withSession()->post('recover',['email'=>$user->email,csrf_token()=>csrf_hash()]);
        $known->assertStatus(200);
        $unknown=$this->withSession()->post('recover',['email'=>'absent@example.test',csrf_token()=>csrf_hash()]);
        $unknown->assertStatus(200);
        self::assertSame($known->response()->getBody(),$unknown->response()->getBody());
    }

    public function testInvitationIsRecipientBoundAndSingleUse(): void
    {
        [$owner,$recipient,$ids,$db]=$this->fixture();
        $service=new \App\Domain\Tenancy\InvitationService($db);
        $token=$service->issue($ids[0][0],$ids[0][1],strtoupper($recipient->email),'editor');
        $this->unavailable(fn()=>$service->accept($owner,$token));
        self::assertSame($ids[0][1],$service->accept($recipient,$token));
        $q=$db->prepare('SELECT role FROM glinks.memberships WHERE workspace_id=? AND user_id=?');
        $q->execute([$ids[0][1],$ids[1][0]]);
        self::assertSame('editor',$q->fetchColumn());
        $this->unavailable(fn()=>$service->accept($recipient,$token));
    }

    public function testInvitationRejectsExpiredRevokedAndOtherTenantIssuer(): void
    {
        [, $recipient,$ids,$db]=$this->fixture();
        $service=new \App\Domain\Tenancy\InvitationService($db);
        $this->unavailable(fn()=>$service->issue($ids[1][0],$ids[0][1],$recipient->email,'editor'));
        $token=$service->issue($ids[0][0],$ids[0][1],$recipient->email,'viewer');
        $db->prepare("UPDATE glinks.invitations SET expires_at=now()-interval '1 second' WHERE token_hash=?")->execute([hash('sha256',$token)]);
        $this->unavailable(fn()=>$service->accept($recipient,$token));
        $token=$service->issue($ids[0][0],$ids[0][1],$recipient->email,'viewer');
        $q=$db->prepare('SELECT id FROM glinks.invitations WHERE token_hash=?');
        $q->execute([hash('sha256',$token)]);
        $id=(int)$q->fetchColumn();
        $this->unavailable(fn()=>$service->revoke($ids[1][0],$ids[1][1],$id));
        $service->revoke($ids[0][0],$ids[0][1],$id);
        $this->unavailable(fn()=>$service->accept($recipient,$token));
    }

    public function testInvitationDoesNotChangeExistingMembership(): void
    {
        [$owner,,$ids,$db]=$this->fixture();
        $service=new \App\Domain\Tenancy\InvitationService($db);
        $token=$service->issue($ids[0][0],$ids[0][1],$owner->email,'viewer');
        $service->accept($owner,$token);
        $q=$db->prepare('SELECT role FROM glinks.memberships WHERE workspace_id=? AND user_id=?');
        $q->execute([$ids[0][1],$ids[0][0]]);
        self::assertSame('owner',$q->fetchColumn());
    }

    public function testInvitationFromDemotedOwnerIsRejected(): void
    {
        [, $recipient,$ids,$db]=$this->fixture();
        $service=new \App\Domain\Tenancy\InvitationService($db);
        $token=$service->issue($ids[0][0],$ids[0][1],$recipient->email,'viewer');
        $db->prepare("INSERT INTO glinks.memberships VALUES (?,?,'owner')")->execute([$ids[0][1],$ids[1][0]]);
        $db->prepare("UPDATE glinks.memberships SET role='viewer' WHERE workspace_id=? AND user_id=?")->execute([$ids[0][1],$ids[0][0]]);
        $this->unavailable(fn()=>$service->accept($recipient,$token));
    }

    private function capturedMail(string $recipient): array
    {
        $message=json_decode(file_get_contents('http://127.0.0.1:8025/api/v1/message/latest',
            false,stream_context_create(['http'=>['timeout'=>5]])),true,512,JSON_THROW_ON_ERROR);
        self::assertSame($recipient,$message['To'][0]['Address']);
        return $message;
    }
    private function useLocalSmtp(): void
    {
        if (getenv('GLINKS_SMTP_TEST')!=='true') { self::markTestSkipped('Requires the isolated Mailpit CI service'); }
        \Config\Services::resetSingle('email');
        config('Email')->protocol='smtp';
        config('Email')->SMTPHost='127.0.0.1';
        config('Email')->SMTPPort=1025;
        config('Email')->SMTPCrypto='';
    }
    public function testActivationAndRecoveryThroughLocalSmtp(): void
    {
        $this->useLocalSmtp();
        $name='smtp'.bin2hex(random_bytes(5));
        $address=$name.'@example.test';
        $this->withSession()->post('register',['username'=>$name,'email'=>$address,
            'password'=>'SmtpRegistrationPassword!794','password_confirm'=>'SmtpRegistrationPassword!794',
            csrf_token()=>csrf_hash()])->assertRedirectTo(url_to('auth-action-show'));
        $this->withSession()->get('auth/a/show')->assertStatus(200);
        $message=$this->capturedMail($address);
        self::assertSame(1,preg_match('/<strong>([0-9]{6})<\/strong>/',$message['HTML'],$matches));
        $this->withSession()->post('auth/a/verify',['token'=>$matches[1],csrf_token()=>csrf_hash()])
            ->assertRedirectTo(site_url('workspaces'));
        self::assertTrue(auth()->loggedIn());
        auth()->logout();
        $this->withSession()->post('recover',['email'=>$address,csrf_token()=>csrf_hash()])->assertStatus(200);
        $message=$this->capturedMail($address);
        self::assertSame(1,preg_match('/token=([a-f0-9]{64})/',$message['Text'],$matches));
        $this->withSession()->post('recover/reset',['token'=>$matches[1],'password'=>'ReplacementCredential!6829',
            'password_confirm'=>'ReplacementCredential!6829',csrf_token()=>csrf_hash()])->assertRedirectTo(site_url('login'));
        $this->withSession()->post('login',['email'=>$address,'password'=>'ReplacementCredential!6829',csrf_token()=>csrf_hash()])
            ->assertRedirectTo(site_url('workspaces'));
        self::assertTrue(auth()->loggedIn());
    }
    public function testInvitationThroughLocalSmtpAndHttp(): void
    {
        $this->useLocalSmtp();
        [$owner,$recipient,$ids,$db]=$this->fixture();
        $workspace=$ids[0][1];
        $this->actingAs($owner);
        $this->withSession()->post("workspaces/$workspace/invitations",
            ['email'=>$recipient->email,'role'=>'viewer',csrf_token()=>csrf_hash()])
            ->assertRedirectTo(site_url("workspaces/$workspace/invitations"));
        $message=$this->capturedMail($recipient->email);
        self::assertSame(1,preg_match('/token=([a-f0-9]{64})/',$message['Text'],$matches));
        auth()->logout();
        $this->actingAs($recipient);
        $this->withSession()->post('invitations/accept',['token'=>$matches[1],csrf_token()=>csrf_hash()])
            ->assertRedirectTo(site_url('workspaces'));
        $this->withSession()->get("workspaces/$workspace/pages/".$ids[0][2])->assertStatus(200);
    }
    public function testDraftEditingRetainsLinkIdentityAndPublishedSnapshot(): void
    {
        [$owner,,$ids,$db]=$this->fixture();
        [$actor,$workspace,$page]=$ids[0];
        $editor=new \App\Domain\Publishing\PageEditor($db);
        $profile=['name'=>'First draft','bio'=>'Welcome'];
        $links=[['slug'=>'website','title'=>'Website','url'=>'https://example.org']];
        $editor->save($actor,$workspace,$page,0,$profile,$links);
        $q=$db->prepare('SELECT id FROM glinks.links WHERE workspace_id=? AND page_id=?');
        $q->execute([$workspace,$page]); $linkId=(int)$q->fetchColumn();
        $publication=(new \App\Domain\Publishing\PagePublisher($db,new \App\Domain\Tenancy\WorkspaceAccess($db)))
            ->publish($actor,$workspace,$page);
        $links[0]['id']=$linkId; $links[0]['title']='Updated';
        $editor->save($actor,$workspace,$page,1,['name'=>'New draft','bio'=>'Changed'],$links);
        $q=$db->prepare('SELECT snapshot FROM glinks.publications WHERE id=?');
        $q->execute([$publication]); $snapshot=json_decode($q->fetchColumn(),true);
        self::assertSame('First draft',$snapshot['page']['name']);
        self::assertSame('Website',$snapshot['links'][0]['title']);
        $editor->save($actor,$workspace,$page,2,$profile,[]);
        $q=$db->prepare('SELECT deleted_at FROM glinks.links WHERE id=?');
        $q->execute([$linkId]); self::assertNotNull($q->fetchColumn());
        // Soft deletion reserves the slug, preserving historical click identity.
        try { $editor->save($actor,$workspace,$page,3,$profile,[['slug'=>'website','title'=>'New','url'=>'https://example.org']]); self::fail('Expected reserved slug'); }
        catch (\PDOException $e) { self::assertSame('23505',$e->getCode()); }
        $q=$db->prepare('SELECT draft_version FROM glinks.pages WHERE id=?');
        $q->execute([$page]); self::assertSame(3,(int)$q->fetchColumn());
    }
    public function testDraftHttpRejectsStaleWritesAndOwnershipInjection(): void
    {
        [$owner,,$ids,$db]=$this->fixture();
        [$actor,$workspace,$page]=$ids[0];
        $this->actingAs($owner);
        $path="workspaces/$workspace/pages/$page/edit";
        $input=['name'=>'Edited','bio'=>'Bio','version'=>'0','links'=>'[]'];
        $this->withSession()->post($path,$input+[csrf_token()=>csrf_hash()])->assertRedirectTo(site_url($path));
        $this->withSession()->post($path,$input+[csrf_token()=>csrf_hash()])->assertStatus(409);
        $this->withSession()->post($path,$input+['workspace_id'=>$ids[1][1],csrf_token()=>csrf_hash()])->assertStatus(422);
        $this->withSession()->get($path)->assertStatus(200);
        $this->withSession()->post("workspaces/$workspace/pages",
            ['name'=>'New page','bio'=>'Welcome','handle'=>'new-'.bin2hex(random_bytes(5)),csrf_token()=>csrf_hash()])->assertRedirect();
    }
    public function testDraftEditorRejectsViewerAndCrossTenantLinkIds(): void
    {
        [$owner,$other,$ids,$db]=$this->fixture();
        [$actor,$workspace,$page]=$ids[0];
        $editor=new \App\Domain\Publishing\PageEditor($db);
        $profile=['name'=>'Draft','bio'=>''];
        $db->prepare("INSERT INTO glinks.memberships VALUES (?,?,'viewer')")->execute([$workspace,$ids[1][0]]);
        $this->unavailable(fn()=>$editor->save($ids[1][0],$workspace,$page,0,$profile,[]));
        $q=$db->prepare("INSERT INTO glinks.links(workspace_id,page_id,slug,title,url) VALUES (?,?,'foreign','Foreign','https://example.org') RETURNING id");
        $q->execute([$ids[1][1],$ids[1][2]]); $foreign=(int)$q->fetchColumn();
        $this->unavailable(fn()=>$editor->save($actor,$workspace,$page,0,$profile,[
            ['id'=>$foreign,'slug'=>'foreign','title'=>'Foreign','url'=>'https://example.org']]));
        $this->unavailable(fn()=>$editor->save($actor,$workspace,$ids[1][2],0,$profile,[]));
    }
}
