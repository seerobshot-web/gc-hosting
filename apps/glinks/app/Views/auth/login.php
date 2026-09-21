<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in · GLINKS</title><link rel="stylesheet" href="<?= base_url('glinks.css') ?>">
<main><p>GLINKS by Glory Cloud Hosts</p><h1>Sign in</h1>
<?php if (session('message')): ?><p role="status"><?= esc(session('message')) ?></p><?php endif ?>
<?php if (session('error')): ?><p role="alert"><?= esc(session('error')) ?></p><?php endif ?>
<?php foreach ((array) session('errors') as $error): ?><p role="alert"><?= esc($error) ?></p><?php endforeach ?>
<form method="post" action="<?= url_to('login') ?>"><?= csrf_field() ?>
<label>Email<input name="email" type="email" autocomplete="email" required maxlength="254"></label>
<label>Password<input name="password" type="password" autocomplete="current-password" required></label>
<button>Sign in</button></form><p><a href="<?= url_to('register') ?>">Create an account</a></p>
<p><a href="<?= site_url('recover') ?>">Forgot your password?</a></p>
</main></html>
