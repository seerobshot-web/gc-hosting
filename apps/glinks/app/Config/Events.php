<?php
namespace Config;
use CodeIgniter\Events\Events;
// Avoid registering the starter's debug toolbar/hot-reload routes on auth pages.
Events::on('login', static function (\CodeIgniter\Shield\Entities\User $user): void {
    session()->set('glinks_credential',hash('sha256',(string)$user->password_hash));
});
