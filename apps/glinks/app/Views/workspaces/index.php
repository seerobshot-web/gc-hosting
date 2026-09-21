<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your workspaces · GLINKS</title><link rel="stylesheet" href="<?= base_url('glinks.css') ?>">
<main><p>GLINKS by Glory Cloud Hosts</p><h1>Your workspaces</h1>
<?php if (!$workspaces): ?><p>Create a workspace for your church, ministry, or nonprofit.</p><?php endif ?>
<ul><?php foreach ($workspaces as $workspace): ?>
<li><?= esc($workspace['name']) ?> <small><?= esc($workspace['role']) ?></small> <a href="<?= site_url('workspaces/'.$workspace['id'].'/pages') ?>">Pages</a>
<?php if ($workspace['role']==='owner'): ?><a href="<?= site_url('workspaces/'.$workspace['id'].'/invitations') ?>">Manage invitations</a><?php endif ?></li>
<?php endforeach ?></ul>
<h2>New workspace</h2><form method="post" action="<?= site_url('workspaces') ?>"><?= csrf_field() ?>
<label>Organization name<input name="name" required maxlength="160"></label><button>Create workspace</button>
</form><form method="post" action="<?= url_to('logout') ?>"><?= csrf_field() ?><button>Sign out</button></form>
</main></html>
