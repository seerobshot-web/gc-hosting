<?php
declare(strict_types=1);
namespace App\Libraries;
use PDO;
final class GlinksDatabase
{
    public static function connect(): PDO
    {
        $config = config('Database');
        $db = $config->{$config->defaultGroup};
        if ($db['DBDriver'] !== 'Postgre') {
            throw new \RuntimeException('GLINKS requires PostgreSQL');
        }
        $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s;connect_timeout=5',
            $db['hostname'], $db['port'], $db['database']);
        return new PDO($dsn, $db['username'], $db['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
}
