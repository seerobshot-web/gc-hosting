<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Libraries\GlinksDatabase;
use App\Domain\Tenancy\InvitationService;
use App\Domain\Tenancy\WorkspaceAccess;
use App\Domain\Tenancy\ResourceUnavailable;
use CodeIgniter\Shield\Models\UserModel;
final class Invitations extends BaseController
{
    private function principal(\PDO $db): int
    {
        $q=$db->prepare("SELECT id FROM glinks.users WHERE auth_provider='shield' AND auth_subject=?");
        $q->execute([(string)auth()->id()]);
        return (int)$q->fetchColumn();
    }
    public function index(string $workspace)
    {
        $db=GlinksDatabase::connect();
        try {
            (new WorkspaceAccess($db))->requireRole($this->principal($db),(int)$workspace,'members');
            $q=$db->prepare('SELECT id,email,role,expires_at,used_at,revoked_at FROM glinks.invitations WHERE workspace_id=? ORDER BY id DESC LIMIT 100');
            $q->execute([(int)$workspace]);
            return view('workspaces/invitations',['workspace'=>$workspace,'invitations'=>$q->fetchAll()]);
        } catch (ResourceUnavailable) { return $this->response->setStatusCode(404)->setJSON(['error'=>'Resource unavailable']); }
    }
    public function create(string $workspace)
    {
        $input=$this->request->getPost();
        unset($input[csrf_token()]);
        if (array_diff(array_keys($input),['email','role']) || !is_string($input['email']??null) || !is_string($input['role']??null)) {
            return $this->response->setStatusCode(422)->setJSON(['error'=>'Invalid invitation']);
        }
        $db=GlinksDatabase::connect();
        try {
            $token=(new InvitationService($db))->issue($this->principal($db),(int)$workspace,$input['email'],$input['role']);
        } catch (ResourceUnavailable) { return $this->response->setStatusCode(404)->setJSON(['error'=>'Resource unavailable']);
        } catch (\InvalidArgumentException) { return $this->response->setStatusCode(422)->setJSON(['error'=>'Invalid invitation']); }
        try {
            helper('email');
            $mail=emailer(['mailType'=>'text'])->setFrom(setting('Email.fromEmail'),setting('Email.fromName'))
                ->setTo(strtolower(trim($input['email'])))->setSubject('GLINKS workspace invitation')
                ->setMessage("Sign in with this email address, verify your account, then open this invitation within 48 hours:\n".site_url('invitations/accept').'?token='.$token);
            if (!$mail->send()) { throw new \RuntimeException('Delivery failed'); }
        } catch (\Throwable) {
            $db->prepare('UPDATE glinks.invitations SET revoked_at=now() WHERE token_hash=?')->execute([hash('sha256',$token)]);
            log_message('error','GLINKS invitation delivery failed');
            return $this->response->setStatusCode(503)->setJSON(['error'=>'Invitation could not be delivered. Please try again.']);
        }
        return redirect()->to(site_url("workspaces/$workspace/invitations"));
    }
    public function acceptForm()
    {
        $token=$this->request->getGet('token');
        return view('workspaces/accept',['token'=>is_string($token)?$token:'']);
    }
    public function accept()
    {
        $token=$this->request->getPost('token');
        if (!is_string($token)) { return $this->response->setStatusCode(422)->setBody('Invalid invitation.'); }
        try {
            $user=model(UserModel::class)->findById(auth()->id());
            (new InvitationService(GlinksDatabase::connect()))->accept($user,$token);
            return redirect()->to(site_url('workspaces'));
        } catch (ResourceUnavailable) { return $this->response->setStatusCode(404)->setJSON(['error'=>'Resource unavailable']); }
    }
    public function revoke(string $workspace,string $id)
    {
        $db=GlinksDatabase::connect();
        try {
            (new InvitationService($db))->revoke($this->principal($db),(int)$workspace,(int)$id);
            return redirect()->to(site_url("workspaces/$workspace/invitations"));
        } catch (ResourceUnavailable) { return $this->response->setStatusCode(404)->setJSON(['error'=>'Resource unavailable']); }
    }
}
