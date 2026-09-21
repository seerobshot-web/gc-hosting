<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="<?= base_url('glinks.css') ?>">
<title>Pages · GLINKS</title>
<?= view('_partials/topbar', ['crumb' => ['label' => 'Workspaces', 'href' => site_url('workspaces')]]) ?>
<main class="wide">
<h1>Workspace pages</h1>

<?php if (!$pages): ?>
<div class="empty-state">
  <p>No pages yet in this workspace.</p>
  <?php if ($canEdit): ?><p>Create one below.</p><?php endif ?>
</div>
<?php else: ?>
<div class="card-grid">
<?php foreach ($pages as $page): ?>
  <div class="card">
    <h3><?= esc($page['handle']) ?></h3>
    <div class="stats">
      <span class="badge <?= $page['published'] ? 'badge-published' : 'badge-draft' ?>">
        <?= $page['published'] ? 'Published' : 'Draft only' ?>
      </span>
      <span><?= (int) $page['link_count'] ?> link<?= (int) $page['link_count'] === 1 ? '' : 's' ?></span>
    </div>
    <?php if ($canEdit): ?>
      <div class="actions"><a href="<?= site_url("workspaces/$workspace/pages/".$page['id']."/edit") ?>">Edit</a></div>
    <?php endif ?>
  </div>
<?php endforeach ?>
</div>
<?php endif ?>

<?php if ($canEdit): ?>
<h2>Create page</h2>
<form method="post" action="<?= site_url("workspaces/$workspace/pages") ?>">
<?= csrf_field() ?>
<label>Handle<input name="handle" pattern="[a-z0-9][a-z0-9-]*" maxlength="64" required></label>
<label>Name<input name="name" maxlength="160" required></label>
<label>Bio<textarea name="bio" maxlength="500"></textarea></label>
<button>Create page</button>
</form>
<?php endif ?>

<p><a href="<?= site_url('workspaces') ?>">Workspaces</a></p>
</main>
</html>
