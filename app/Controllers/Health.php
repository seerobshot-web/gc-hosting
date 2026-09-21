<?php
declare(strict_types=1);
namespace App\Controllers;

final class Health extends BaseController
{
    public function live()
    {
        return $this->response->setJSON(['service' => 'glinks', 'status' => 'alive'])
            ->setHeader('Cache-Control', 'no-store');
    }

    public function ready()
    {
        try {
            $db = db_connect();
            $db->query('SELECT 1 FROM glinks.workspaces LIMIT 1');
            return $this->response->setJSON(['status' => 'ready'])
                ->setHeader('Cache-Control', 'no-store');
        } catch (\Throwable $error) {
            log_message('error', 'GLINKS readiness failed');
            return $this->response->setStatusCode(503)->setJSON(['status' => 'unavailable'])
                ->setHeader('Cache-Control', 'no-store');
        }
    }
}
