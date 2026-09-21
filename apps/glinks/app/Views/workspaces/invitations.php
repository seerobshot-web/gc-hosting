<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<link rel="stylesheet" href="<?= base_url('glinks.css') ?>">
<title>Invitations - GLINKS</title><main><h1>Workspace invitations</h1>
<form method="post" action="<?= site_url("workspaces/$workspace/invitations") ?>"><?= csrf_field() ?>
<label>Email<input type="email" name="email" required maxlength="254"></label>
<label>Role<select name="role"><option value="viewer">Viewer</option><option value="editor">Editor</option></select></label><button>Send invitation</button></form>
<ul><?php foreach ($invitations as $invite): ?><li><?= esc($invite['email']) ?> - <?= esc($invite['role']) ?>
<?php if (!$invite['used_at'] && !$invite['revoked_at']): ?>
<form method="post" action="<?= site_url("workspaces/$workspace/invitations/".$invite['id']."/revoke") ?>"><?= csrf_field() ?><button>Revoke invitation</button></form>
<?php else: ?> (closed)<?php endif ?></li><?php endforeach ?></ul><a href="<?= site_url('workspaces') ?>">Workspaces</a></main></html>
