<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="<?= base_url('glinks.css') ?>"><title>Pages - GLINKS</title><main><h1>Workspace pages</h1><ul>
<?php foreach ($pages as $page): ?><li><?php if ($canEdit): ?><a href="<?= site_url("workspaces/$workspace/pages/".$page['id']."/edit") ?>"><?= esc($page['handle']) ?></a><?php else: ?><?= esc($page['handle']) ?><?php endif ?></li><?php endforeach ?></ul>
<?php if ($canEdit): ?><h2>Create page</h2><form method="post" action="<?= site_url("workspaces/$workspace/pages") ?>"><?= csrf_field() ?>
<label>Handle<input name="handle" pattern="[a-z0-9][a-z0-9-]*" maxlength="64" required></label>
<label>Name<input name="name" maxlength="160" required></label><label>Bio<textarea name="bio" maxlength="500"></textarea></label><button>Create page</button></form><?php endif ?>
<p><a href="<?= site_url('workspaces') ?>">Workspaces</a></p></main></html>
