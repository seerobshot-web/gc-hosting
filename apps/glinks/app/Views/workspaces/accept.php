<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<link rel="stylesheet" href="<?= base_url('glinks.css') ?>">
<title>Accept invitation - GLINKS</title><main><h1>Join this workspace</h1><p>Accept using the verified email address that received this invitation.</p>
<form method="post" action="<?= site_url('invitations/accept') ?>"><?= csrf_field() ?><input type="hidden" name="token" value="<?= esc($token,'attr') ?>"><button>Accept invitation</button></form></main></html>
