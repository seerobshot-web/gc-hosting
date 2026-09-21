<?php
namespace Config;
class Auth extends \CodeIgniter\Shield\Config\Auth
{
    public array $redirects = [
        'register' => 'workspaces', 'login' => 'workspaces', 'logout' => 'login',
        'force_reset' => 'workspaces', 'permission_denied' => 'workspaces', 'group_denied' => 'workspaces',
    ];
    public array $actions = ['register'=>\CodeIgniter\Shield\Authentication\Actions\EmailActivator::class,'login'=>null];
    public bool $allowMagicLinkLogins = false;
    public bool $recordActiveDate = false;
    public int $minimumPasswordLength = 12;
    public array $sessionConfig = [
        'field' => 'glinks_user', 'allowRemembering' => false,
        'rememberCookieName' => 'glinks_remember', 'rememberLength' => 2592000,
    ];
    public function __construct()
    {
        parent::__construct();
        $this->views['action_email_activate_show'] = 'auth/activate';
        $this->views['action_email_activate_email'] = 'auth/activate_email';
        $this->views['login'] = 'auth/login';
        $this->views['register'] = 'auth/register';
    }
}
