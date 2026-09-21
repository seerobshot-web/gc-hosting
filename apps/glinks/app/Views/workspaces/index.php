<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="<?= base_url('glinks.css') ?>">
<title>Your workspaces · GLINKS</title>
<?= view('_partials/topbar') ?>
<main class="wide">
<h1>Your workspaces</h1>

<?php if (!$workspaces): ?>
<div class="empty-state">
  <p>You don't have any workspaces yet.</p>
  <p>Create one below for your church, ministry, or nonprofit.</p>
</div>
<?php else: ?>
<div class="card-grid">
<?php foreach ($workspaces as $workspace): ?>
  <div class="card">
    <h3><?= esc($workspace['name']) ?></h3>
    <div class="stats">
      <span><?= esc($workspace['role']) ?></span>
      <span><?= (int) $workspace['page_count'] ?> page<?= (int) $workspace['page_count'] === 1 ? '' : 's' ?></span>
    </div>
    <div class="actions">
      <a href="<?= site_url('workspaces/'.$workspace['id'].'/pages') ?>">Manage pages</a>
      <?php if ($workspace['role'] === 'owner'): ?>
        <a href="<?= site_url('workspaces/'.$workspace['id'].'/invitations') ?>">Invitations</a>
      <?php endif ?>
    </div>
  </div>
<?php endforeach ?>
</div>
<?php endif ?>

<h2>New workspace</h2>
<form method="post" action="<?= site_url('workspaces') ?>">
<?= csrf_field() ?>
<label>Organization name<input name="name" required maxlength="160"></label>
<button>Create workspace</button>
</form>
</main>
</html>
