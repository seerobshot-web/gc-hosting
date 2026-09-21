<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="<?= base_url('glinks.css') ?>"><title>Edit page - GLINKS</title><main><h1>Edit <?= esc($page['handle']) ?></h1>
<form method="post" action="<?= site_url("workspaces/$workspace/pages/".$page['id']."/edit") ?>"><?= csrf_field() ?>
<input type="hidden" name="version" value="<?= esc($page['draft_version'],'attr') ?>">
<label>Name<input name="name" value="<?= esc($profile['name']??'','attr') ?>" maxlength="160" required></label>
<label>Bio<textarea name="bio" maxlength="500"><?= esc($profile['bio']??'') ?></textarea></label>
<label>Links (JSON)<textarea name="links" rows="18" spellcheck="false"><?= esc(json_encode($links,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)) ?></textarea></label>
<p>Each link needs title, url, and slug. Optional fields: emoji and enabled. Keep existing IDs and slugs. Omit a link to remove it from the draft. New links omit id.</p>
<pre><?= esc('[{"title":"Our website","url":"https://example.org","slug":"website"}]') ?></pre>
<button>Save draft</button></form>
<form method="post" action="<?= site_url("workspaces/$workspace/pages/".$page['id']."/publish") ?>"><?= csrf_field() ?><button>Publish saved draft</button></form>
<p>Publishing saves an immutable snapshot. Public page delivery is still being built.</p></main></html>
