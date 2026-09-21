<?php
namespace Config;
use CodeIgniter\Config\BaseConfig;
class Glinks extends BaseConfig
{
    // Native PostgreSQL + live HTTP gates passed in Actions run 34780841924.
    // Production still requires explicit configuration and its deployment checks.
    public bool $enableTenantRoutes = ENVIRONMENT !== 'production';
}
