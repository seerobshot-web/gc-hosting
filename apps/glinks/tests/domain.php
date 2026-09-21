<?php
declare(strict_types=1);
require __DIR__ . '/../app/Domain/Tenancy/Role.php';
require __DIR__ . '/../app/Domain/Publishing/LinkInput.php';
use App\Domain\Tenancy\Role;
use App\Domain\Publishing\LinkInput;

$count = 0;
function check(bool $condition, string $message): void {
    global $count;
    if (!$condition) { throw new RuntimeException($message); }
    $count++;
}
check(Role::Owner->allows('members'), 'Owner manages members');
check(!Role::Editor->allows('members'), 'Editor cannot manage members');
check(Role::Editor->allows('publish'), 'Editor publishes');
check(!Role::Viewer->allows('publish'), 'Viewer cannot publish');
check(Role::Viewer->allows('analytics'), 'Viewer reads analytics');
foreach (Role::cases() as $role) {
    check(!$role->allows('unknown'), 'Unknown actions must fail closed');
}
$base = ['title' => 'Give', 'slug' => 'give', 'url' => 'https://example.org/give'];
check(LinkInput::validate($base)['enabled'] === true, 'Links default enabled');
foreach ([
    ['url' => 'javascript:alert(1)'],
    ['url' => 'https://user:password@example.org'],
    ['url' => "https://example.org/\r\nX-Test:true"],
    ['workspace_id' => 2],
    ['slug' => '../other'],
    ['enabled' => 'false'],
    ['title' => ''],
] as $change) {
    $rejected = false;
    try { LinkInput::validate(array_replace($base, $change)); }
    catch (InvalidArgumentException) { $rejected = true; }
    check($rejected, 'Invalid input was accepted: ' . json_encode($change));
}
echo "PASS: $count domain checks\n";
