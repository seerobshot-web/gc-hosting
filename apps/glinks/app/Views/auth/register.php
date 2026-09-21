<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Create an account · GLINKS</title><link rel="stylesheet" href="<?= base_url('glinks.css') ?>">
<main><p>GLINKS by Glory Cloud Hosts</p><h1>Create an account</h1>
<?php if (session('error')): ?><p role="alert"><?= esc(session('error')) ?></p><?php endif ?>
<?php foreach ((array) session('errors') as $error): ?><p role="alert"><?= esc($error) ?></p><?php endforeach ?>
<form method="post" action="<?= url_to('register') ?>"><?= csrf_field() ?>
<label>Username<input name="username" autocomplete="username" required minlength="3" maxlength="30"></label>
<label>Email<input name="email" type="email" autocomplete="email" required maxlength="254"></label>
<label>Password<input name="password" type="password" autocomplete="new-password" required minlength="12"></label>
<label>Repeat password<input name="password_confirm" type="password" autocomplete="new-password" required></label>
<button>Create account</button></form><p><a href="<?= url_to('login') ?>">Sign in</a></p>
</main></html>
