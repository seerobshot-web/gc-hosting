<?php
namespace Config;
use CodeIgniter\Config\Filters as BaseFilters;
class Filters extends BaseFilters
{
    public array $aliases = [
        'csrf'=>\CodeIgniter\Filters\CSRF::class,
        'invalidchars'=>\CodeIgniter\Filters\InvalidChars::class,
        'secureheaders'=>\CodeIgniter\Filters\SecureHeaders::class,
        'forcehttps'=>\CodeIgniter\Filters\ForceHTTPS::class,
        'credential'=>\App\Filters\CredentialSession::class,
        'private'=>\App\Filters\PrivateResponses::class,
    ];
    public array $required = ['before'=>['forcehttps'],'after'=>['private']];
    public array $globals = ['before'=>['credential','csrf','invalidchars'],'after'=>['secureheaders']];
    public array $methods = [];
    public array $filters = ['auth-rates'=>['before'=>['login','register','auth/a/*','recover','recover/*','invitations/*','workspaces/*/invitations','workspaces/*/invitations/*']]];
}
