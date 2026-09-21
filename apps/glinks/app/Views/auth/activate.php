<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<link rel="stylesheet" href="<?= base_url('glinks.css') ?>">
<title>Verify email - GLINKS</title><main><h1>Verify your email</h1><p>Enter the code sent to your email address.</p>
<?php if (session('error')): ?><p role="alert"><?= esc(session('error')) ?></p><?php endif ?>
<form method="post" action="<?= url_to('auth-action-verify') ?>"><?= csrf_field() ?>
<label>Verification code<input name="token" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button>Verify email</button></form>
<p><a href="<?= url_to('auth-action-show') ?>">Send a new code</a></p></main></html>
