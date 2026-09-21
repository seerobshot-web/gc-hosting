<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Libraries\GlinksDatabase;
use App\Domain\Publishing\PageEditor;
use App\Domain\Publishing\StaleDraft;
use App\Domain\Tenancy\WorkspaceAccess;
use App\Domain\Tenancy\ResourceUnavailable;
final class Pages extends BaseController
{
    private function principal(\PDO $db): int
    {
        $q=$db->prepare("SELECT id FROM glinks.users WHERE auth_provider='shield' AND auth_subject=?");
        $q->execute([(string)auth()->id()]);
        return (int)$q->fetchColumn();
    }
    private function failure(\Throwable $e)
    {
        if ($e instanceof ResourceUnavailable) { return $this->response->setStatusCode(404)->setJSON(['error'=>'Resource unavailable']); }
        if ($e instanceof StaleDraft) { return $this->response->setStatusCode(409)->setJSON(['error'=>$e->getMessage()]); }
        if ($e instanceof \InvalidArgumentException || $e instanceof \JsonException
            || ($e instanceof \PDOException && $e->getCode()==='23505')) {
            return $this->response->setStatusCode(422)->setJSON(['error'=>'Invalid draft, link fields, or unavailable handle/slug.']);
        }
        throw $e;
    }
    public function index(string $workspace)
    {
        $db=GlinksDatabase::connect();
        try {
            $role=(new WorkspaceAccess($db))->requireRole($this->principal($db),(int)$workspace,'read');
            $q=$db->prepare('SELECT id,handle FROM glinks.pages WHERE workspace_id=? ORDER BY id');
            $q->execute([(int)$workspace]);
            return view('pages/index',['workspace'=>$workspace,'pages'=>$q->fetchAll(),'canEdit'=>$role->allows('edit')]);
        } catch (ResourceUnavailable $e) { return $this->failure($e); }
    }
    public function create(string $workspace)
    {
        $input=$this->request->getPost(); unset($input[csrf_token()]);
        if (array_diff(array_keys($input),['name','bio','handle']) || !is_string($input['handle']??null)) {
            return $this->response->setStatusCode(422)->setJSON(['error'=>'Invalid page fields']);
        }
        $db=GlinksDatabase::connect();
        try {
            $id=(new PageEditor($db))->create($this->principal($db),(int)$workspace,$input['handle'],
                ['name'=>$input['name']??null,'bio'=>$input['bio']??'']);
            return redirect()->to(site_url("workspaces/$workspace/pages/$id/edit"));
        } catch (\Throwable $e) { return $this->failure($e); }
    }
    public function edit(string $workspace,string $page)
    {
        $db=GlinksDatabase::connect();
        try {
            (new WorkspaceAccess($db))->requireRole($this->principal($db),(int)$workspace,'edit');
            $q=$db->prepare('SELECT id,handle,draft,draft_version FROM glinks.pages WHERE workspace_id=? AND id=?');
            $q->execute([(int)$workspace,(int)$page]);
            $record=$q->fetch();
            if (!$record) { throw new ResourceUnavailable(); }
            $q=$db->prepare('SELECT id,slug,title,url,emoji,enabled FROM glinks.links WHERE workspace_id=? AND page_id=? AND deleted_at IS NULL ORDER BY position,id');
            $q->execute([(int)$workspace,(int)$page]);
            return view('pages/edit',['workspace'=>$workspace,'page'=>$record,
                'profile'=>json_decode($record['draft'],true,512,JSON_THROW_ON_ERROR),'links'=>$q->fetchAll()]);
        } catch (\Throwable $e) { return $this->failure($e); }
    }
    public function save(string $workspace,string $page)
    {
        $input=$this->request->getPost(); unset($input[csrf_token()]);
        if (array_diff(array_keys($input),['name','bio','version','links'])
            || !is_string($input['version']??null) || !ctype_digit($input['version'])
            || !is_string($input['links']??null) || strlen($input['links'])>300000) {
            return $this->response->setStatusCode(422)->setJSON(['error'=>'Invalid draft fields']);
        }
        $db=GlinksDatabase::connect();
        try {
            $links=json_decode($input['links'],true,32,JSON_THROW_ON_ERROR);
            if (!is_array($links)) { throw new \InvalidArgumentException(); }
            (new PageEditor($db))->save($this->principal($db),(int)$workspace,(int)$page,(int)$input['version'],
                ['name'=>$input['name']??null,'bio'=>$input['bio']??''],$links);
            return redirect()->to(site_url("workspaces/$workspace/pages/$page/edit"));
        } catch (\Throwable $e) { return $this->failure($e); }
    }
}
