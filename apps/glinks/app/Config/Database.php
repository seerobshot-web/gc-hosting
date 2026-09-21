<?php
namespace Config;
use CodeIgniter\Database\Config;
class Database extends Config
{
    public string $filesPath = APPPATH . 'Database' . DIRECTORY_SEPARATOR;
    public string $defaultGroup = 'default';
    public array $default = [
        'DSN'=>'', 'hostname'=>'127.0.0.1', 'username'=>'glinks', 'password'=>'',
        'database'=>'glinks', 'schema'=>'public', 'DBDriver'=>'Postgre', 'DBPrefix'=>'',
        'pConnect'=>false, 'DBDebug'=>true, 'charset'=>'utf8', 'swapPre'=>'', 'failover'=>[],
        'port'=>5432, 'dateFormat'=>['date'=>'Y-m-d','datetime'=>'Y-m-d H:i:s','time'=>'H:i:s'],
    ];
    public array $tests = [
        'DSN'=>'', 'hostname'=>'127.0.0.1', 'username'=>'glinks', 'password'=>'',
        'database'=>'glinks_test', 'schema'=>'public', 'DBDriver'=>'Postgre', 'DBPrefix'=>'',
        'pConnect'=>false, 'DBDebug'=>true, 'charset'=>'utf8', 'swapPre'=>'', 'failover'=>[],
        'port'=>5432, 'dateFormat'=>['date'=>'Y-m-d','datetime'=>'Y-m-d H:i:s','time'=>'H:i:s'],
    ];
    public function __construct()
    {
        parent::__construct();
        if (ENVIRONMENT === 'testing') { $this->defaultGroup = 'tests'; }
    }
}
