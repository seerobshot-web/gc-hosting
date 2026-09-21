<?php
declare(strict_types=1);
namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

final class CreateGlinks extends Migration
{
    public function up()
    {
        if ($this->db->DBDriver !== 'Postgre') {
            throw new \RuntimeException('GLINKS requires PostgreSQL; SQLite does not test these constraints.');
        }
        $this->db->query(file_get_contents(APPPATH . 'Database/Sql/001_foundation.sql'));
    }

    public function down()
    {
        throw new \RuntimeException('Destructive rollback disabled. Restore a backup or apply a forward migration.');
    }
}
