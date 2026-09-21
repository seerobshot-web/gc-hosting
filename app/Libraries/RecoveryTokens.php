<?php
declare(strict_types=1);
namespace App\Libraries;
use App\Domain\Tenancy\ResourceUnavailable;
use CodeIgniter\Shield\Models\UserModel;
use PDO;
use Throwable;
final class RecoveryTokens
{
    public function __construct(private PDO $db) {}
    public function issue(string $email): ?string
    {
        $user=model(UserModel::class)->findByCredentials(['email'=>strtolower(trim($email))]);
        if (!$user || !$user->active || $user->isBanned()) { return null; }
        $token=bin2hex(random_bytes(32));
        $this->db->prepare("INSERT INTO glinks.recovery_tokens(token_hash,user_id,email,credential_digest,expires_at)
            VALUES (?,?,?,?,now()+interval '30 minutes')")->execute([
                hash('sha256',$token),$user->id,strtolower($user->email),hash('sha256',(string)$user->password_hash)]);
        return $token;
    }
    public function reset(string $token, string $password): void
    {
        if (!preg_match('/\A[a-f0-9]{64}\z/',$token)) { throw new ResourceUnavailable(); }
        $this->db->beginTransaction();
        try {
            $q=$this->db->prepare('SELECT user_id FROM glinks.recovery_tokens WHERE token_hash=?');
            $q->execute([hash('sha256',$token)]);
            $id=(int)$q->fetchColumn();
            // All concurrent reset attempts for this account serialize on its user row.
            $q=$this->db->prepare("SELECT u.id,i.secret,i.secret2 FROM public.users u
                JOIN public.auth_identities i ON i.user_id=u.id AND i.type='email_password'
                WHERE u.id=? AND u.active=1 AND u.deleted_at IS NULL FOR UPDATE OF u,i");
            $q->execute([$id]);
            $account=$q->fetch(PDO::FETCH_ASSOC);
            if (!$account) { throw new ResourceUnavailable(); }
            $user=model(UserModel::class)->findById($id);
            if (!$user || $user->isBanned() || strlen($password)>255
                || !service('passwords')->check($password,$user)->isOK()) {
                throw new \InvalidArgumentException('Use a stronger password of at least 12 characters.');
            }
            $q=$this->db->prepare('UPDATE glinks.recovery_tokens SET used_at=now()
                WHERE token_hash=? AND used_at IS NULL AND expires_at>clock_timestamp()
                AND email=? AND credential_digest=? RETURNING user_id');
            $q->execute([hash('sha256',$token),strtolower($account['secret']),hash('sha256',$account['secret2'])]);
            if (!$q->fetchColumn()) { throw new ResourceUnavailable(); }
            $hash=service('passwords')->hash($password);
            if (!is_string($hash)) { throw new \RuntimeException('Password hashing failed'); }
            $this->db->prepare("UPDATE public.auth_identities SET secret2=?,force_reset=0,updated_at=now()
                WHERE user_id=? AND type='email_password'")->execute([$hash,$id]);
            $this->db->prepare('UPDATE glinks.recovery_tokens SET used_at=now() WHERE user_id=? AND used_at IS NULL')->execute([$id]);
            $this->db->prepare('DELETE FROM public.auth_remember_tokens WHERE user_id=?')->execute([$id]);
            $this->db->commit();
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) { $this->db->rollBack(); }
            throw $e;
        }
    }
}
