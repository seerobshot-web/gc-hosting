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

        // database.default.DSN (the only piece Config\Database actually
        // reads from .env) is a libpq-style string, not the individual
        // hostname/port/database/username keys below it in the config
        // array -- those keep their file defaults unless set separately.
        // Parse DSN when present so this connects to the same server as
        // the rest of the framework instead of silently falling back to
        // those defaults.
        $params = $db['DSN'] !== '' ? self::parseDsn($db['DSN']) : [];

        $host    = $params['host'] ?? $db['hostname'];
        $port    = (int) ($params['port'] ?? $db['port']);
        $dbname  = $params['dbname'] ?? $db['database'];
        $user    = $params['user'] ?? $db['username'];
        $pass    = $params['password'] ?? $db['password'];
        $sslmode = $params['sslmode'] ?? null;

        $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s;connect_timeout=5%s',
            $host, $port, $dbname, $sslmode !== null ? ";sslmode={$sslmode}" : '');

        return new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }

    /**
     * Parses a libpq-style "key=value key2=value2" DSN into an associative
     * array of its keyword/value pairs.
     *
     * @return array<string, string>
     */
    private static function parseDsn(string $dsn): array
    {
        preg_match_all('/(\w+)=(?:\'([^\']*)\'|(\S+))/', $dsn, $matches, PREG_SET_ORDER);

        $params = [];
        foreach ($matches as $match) {
            $params[$match[1]] = $match[2] !== '' ? $match[2] : $match[3];
        }

        return $params;
    }
}
