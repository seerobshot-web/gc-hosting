<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<link rel="stylesheet" href="<?= base_url('glinks.css') ?>">
<title>Choose password - GLINKS</title><main><h1>Choose a new password</h1>
<?php if (!empty($error)): ?><p role="alert"><?= esc($error) ?></p><?php endif ?>
<form method="post" action="<?= site_url('recover/reset') ?>"><?= csrf_field() ?>
<input type="hidden" name="token" value="<?= esc($token,'attr') ?>">
<label>New password<input type="password" name="password" autocomplete="new-password" minlength="12" maxlength="255" required></label>
<label>Confirm password<input type="password" name="password_confirm" autocomplete="new-password" minlength="12" maxlength="255" required></label><button>Change password</button></form></main></html>
