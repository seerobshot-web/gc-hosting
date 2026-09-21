<?php
declare(strict_types=1);
namespace App\Domain\Publishing;
use App\Domain\Tenancy\WorkspaceAccess;
use App\Domain\Tenancy\ResourceUnavailable;
use InvalidArgumentException;
use PDO;
use Throwable;
final class PageEditor
{
    public function __construct(private PDO $db) {}
    private function authorize(int $actor,int $workspace): void
    {
        $q=$this->db->prepare('SELECT id FROM glinks.workspaces WHERE id=? FOR UPDATE');
        $q->execute([$workspace]);
        (new WorkspaceAccess($this->db))->requireRole($actor,$workspace,'edit');
    }
    private function profile(array $profile): array
    {
        if (array_diff(array_keys($profile),['name','bio']) || !is_string($profile['name']??null)
            || trim($profile['name'])==='' || mb_strlen($profile['name'])>160
            || !is_string($profile['bio']??null) || mb_strlen($profile['bio'])>500) {
            throw new InvalidArgumentException('Provide a name (1-160 characters) and bio (up to 500).');
        }
        return ['name'=>trim($profile['name']),'bio'=>$profile['bio']];
    }
    public function create(int $actor,int $workspace,string $handle,array $profile): int
    {
        $profile=$this->profile($profile);
        if (!preg_match('/\A[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\z/',$handle)
            || in_array($handle,['admin','api','go','stats','health','login','register','www','support','recover','workspaces','invitations'],true)) {
            throw new InvalidArgumentException('Invalid or reserved handle.');
        }
        $this->db->beginTransaction();
        try {
            $this->authorize($actor,$workspace);
            $q=$this->db->prepare('INSERT INTO glinks.pages(workspace_id,handle,draft) VALUES (?,?,CAST(? AS jsonb)) RETURNING id');
            $q->execute([$workspace,$handle,json_encode($profile,JSON_THROW_ON_ERROR)]);
            $id=(int)$q->fetchColumn();
            $this->db->commit();
            return $id;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) { $this->db->rollBack(); }
            throw $e;
        }
    }
    public function save(int $actor,int $workspace,int $page,int $version,array $profile,array $links): void
    {
        $profile=$this->profile($profile);
        if ($version<0 || !array_is_list($links) || count($links)>100) { throw new InvalidArgumentException('Use a list of at most 100 links.'); }
        $normalized=[]; $ids=[]; $slugs=[];
        foreach ($links as $link) {
            if (!is_array($link)) { throw new InvalidArgumentException('Each link must be an object.'); }
            $id=$link['id']??null;
            if (array_key_exists('id',$link) && (!is_int($id) || $id<1)) { throw new InvalidArgumentException('Invalid link ID.'); }
            unset($link['id']);
            $link=LinkInput::validate($link);
            if (($id!==null && isset($ids[$id])) || isset($slugs[$link['slug']])) { throw new InvalidArgumentException('Duplicate link IDs or slugs.'); }
            if ($id!==null) { $ids[$id]=true; }
            $slugs[$link['slug']]=true;
            $normalized[]=['id'=>$id]+$link;
        }
        $this->db->beginTransaction();
        try {
            $this->authorize($actor,$workspace);
            $q=$this->db->prepare('SELECT draft_version FROM glinks.pages WHERE workspace_id=? AND id=? FOR UPDATE');
            $q->execute([$workspace,$page]);
            $current=$q->fetchColumn();
            if ($current===false) { throw new ResourceUnavailable(); }
            if ((int)$current!==$version) { throw new StaleDraft('This page changed. Reload before saving.'); }
            $q=$this->db->prepare('SELECT id,slug FROM glinks.links WHERE workspace_id=? AND page_id=?');
            $q->execute([$workspace,$page]);
            $existing=$q->fetchAll(PDO::FETCH_KEY_PAIR);
            foreach ($normalized as $link) {
                if ($link['id']!==null && !isset($existing[$link['id']])) { throw new ResourceUnavailable(); }
                if ($link['id']!==null && $existing[$link['id']]!==$link['slug']) { throw new InvalidArgumentException('Existing link slugs cannot change.'); }
            }
            $this->db->prepare('UPDATE glinks.links SET deleted_at=now() WHERE workspace_id=? AND page_id=? AND deleted_at IS NULL')->execute([$workspace,$page]);
            foreach ($normalized as $position=>$link) {
                $values=[$link['title'],$link['url'],$link['emoji'],$link['enabled']?'true':'false',$position];
                if ($link['id']===null) {
                    $this->db->prepare('INSERT INTO glinks.links(title,url,emoji,enabled,position,workspace_id,page_id,slug)
                        VALUES (?,?,?,?,?,?,?,?)')->execute([...$values,$workspace,$page,$link['slug']]);
                } else {
                    $this->db->prepare('UPDATE glinks.links SET title=?,url=?,emoji=?,enabled=?,position=?,deleted_at=NULL
                        WHERE workspace_id=? AND page_id=? AND id=?')->execute([...$values,$workspace,$page,$link['id']]);
                }
            }
            $this->db->prepare('UPDATE glinks.pages SET draft=CAST(? AS jsonb),draft_version=draft_version+1,updated_at=now()
                WHERE workspace_id=? AND id=?')->execute([json_encode($profile,JSON_THROW_ON_ERROR),$workspace,$page]);
            $this->db->commit();
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) { $this->db->rollBack(); }
            throw $e;
        }
    }
}
