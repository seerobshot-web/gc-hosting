<?php
declare(strict_types=1);
namespace App\Filters;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\Shield\Models\UserModel;
final class CredentialSession implements FilterInterface
{
    public function before(RequestInterface $request,$arguments=null)
    {
        if (!auth()->loggedIn()) { return; }
        // Fetch a fresh identity; do not trust a user cached in the session authenticator.
        $user=model(UserModel::class)->findById(auth()->id());
        $bound=session('glinks_credential');
        if (!$user || !$user->active || $user->isBanned() || !is_string($bound)
            || !hash_equals(hash('sha256',(string)$user->password_hash),$bound)) {
            auth()->logout();
            session()->remove('glinks_credential');
            return redirect()->to(site_url('login'));
        }
    }
    public function after(RequestInterface $request,ResponseInterface $response,$arguments=null) {}
}
