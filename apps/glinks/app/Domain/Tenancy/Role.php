<?php
declare(strict_types=1);
namespace App\Domain\Tenancy;

enum Role: string
{
    case Owner = 'owner';
    case Editor = 'editor';
    case Viewer = 'viewer';

    public function allows(string $action): bool
    {
        return match ($action) {
            'read', 'analytics' => true,
            'edit', 'publish' => $this !== self::Viewer,
            'members', 'workspace' => $this === self::Owner,
            default => false,
        };
    }
}
