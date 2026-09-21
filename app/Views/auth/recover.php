<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<link rel="stylesheet" href="<?= base_url('glinks.css') ?>">
<title>Recover account - GLINKS</title><main><h1>Recover your account</h1>
<?php if (!empty($sent)): ?><p>If an eligible account exists, a recovery link will be sent to that address.</p>
<?php else: ?>
<?php if (!empty($error)): ?><p role="alert"><?= esc($error) ?></p><?php endif ?>
<form method="post" action="<?= site_url('recover') ?>"><?= csrf_field() ?>
<label>Email<input type="email" name="email" maxlength="254" autocomplete="email" required></label><button>Send recovery link</button></form>
<?php endif ?><p><a href="<?= site_url('login') ?>">Sign in</a></p></main></html>
