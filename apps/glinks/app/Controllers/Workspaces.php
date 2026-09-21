<?php
declare(strict_types=1);
namespace App\Controllers;

use App\Domain\Tenancy\ResourceUnavailable;
use App\Domain\Tenancy\WorkspaceAccess;
use App\Domain\Publishing\PagePublisher;
use App\Libraries\GlinksDatabase;
use CodeIgniter\Exceptions\PageNotFoundException;
use PDO;
use Throwable;

final class Workspaces extends BaseController
{
    private function principal(PDO $db): int
    {
        // The principal is obtained only from Shield's verified session.
        if (!auth()->loggedIn()) {
            throw PageNotFoundException::forPageNotFound();
        }
        $stmt = $db->prepare("INSERT INTO glinks.users(auth_provider,auth_subject)
            VALUES ('shield', ?) ON CONFLICT (auth_provider,auth_subject)
            DO UPDATE SET auth_subject = EXCLUDED.auth_subject RETURNING id");
        $stmt->execute([(string) auth()->id()]);
        return (int) $stmt->fetchColumn();
    }

    public function index()
    {
        $db = GlinksDatabase::connect();
        $id = $this->principal($db);
        $query = $db->prepare('SELECT w.id,w.name,m.role FROM glinks.workspaces w
            JOIN glinks.memberships m ON m.workspace_id=w.id WHERE m.user_id=? ORDER BY w.id');
        $query->execute([$id]);
        return $this->response->setHeader('Cache-Control','private, no-store')
            ->setBody(view('workspaces/index',['workspaces'=>$query->fetchAll()]));
    }

    public function create()
    {
        $input = $this->request->getPost();
        unset($input[csrf_token()]);
        if (array_diff(array_keys($input), ['name'])
            || !isset($input['name']) || !is_string($input['name'])
            || trim($input['name']) === '' || mb_strlen($input['name']) > 160) {
            return $this->response->setStatusCode(422)->setJSON(['error'=>'Provide a workspace name of 1–160 characters.']);
        }
        $db = GlinksDatabase::connect();
        $user = $this->principal($db);
        $db->beginTransaction();
        try {
            $insert = $db->prepare('INSERT INTO glinks.workspaces(name) VALUES (?) RETURNING id');
            $insert->execute([trim($input['name'])]);
            $workspace = (int) $insert->fetchColumn();
            $member = $db->prepare("INSERT INTO glinks.memberships VALUES (?,?,'owner')");
            $member->execute([$workspace,$user]);
            $db->commit();
            return redirect()->to(site_url('workspaces'));
        } catch (Throwable $error) {
            if ($db->inTransaction()) { $db->rollBack(); }
            throw $error;
        }
    }

    public function page(string $workspaceId, string $pageId)
    {
        $db = GlinksDatabase::connect();
        $user = $this->principal($db);
        try {
            (new WorkspaceAccess($db))->requireRole($user,(int)$workspaceId,'read');
            $query = $db->prepare('SELECT id,handle,draft,published_publication_id
                FROM glinks.pages WHERE workspace_id=? AND id=?');
            $query->execute([(int)$workspaceId,(int)$pageId]);
            $page = $query->fetch();
            if (!$page) { throw new ResourceUnavailable(); }
            $page['draft'] = json_decode($page['draft'],true,512,JSON_THROW_ON_ERROR);
            return $this->response->setHeader('Cache-Control','private, no-store')->setJSON($page);
        } catch (ResourceUnavailable) {
            return $this->response->setStatusCode(404)->setJSON(['error'=>'Resource unavailable']);
        }
    }

    public function publish(string $workspaceId, string $pageId)
    {
        $db = GlinksDatabase::connect();
        $user = $this->principal($db);
        $input = $this->request->getPost();
        unset($input[csrf_token()]);
        if ($input !== []) {
            return $this->response->setStatusCode(422)->setJSON(['error'=>'Unexpected publish fields']);
        }
        try {
            $publication = (new PagePublisher($db,new WorkspaceAccess($db)))
                ->publish($user,(int)$workspaceId,(int)$pageId);
            return $this->response->setHeader('Cache-Control','private, no-store')
                ->setJSON(['publicationId'=>$publication]);
        } catch (ResourceUnavailable) {
            return $this->response->setStatusCode(404)->setJSON(['error'=>'Resource unavailable']);
        }
    }
}
