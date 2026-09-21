<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="<?= base_url('glinks.css') ?>">
<title>Edit <?= esc($page['handle']) ?> · GLINKS</title>
<?= view('_partials/topbar', ['crumb' => ['label' => 'Pages', 'href' => site_url("workspaces/$workspace/pages")]]) ?>
<main class="wide">
<h1>Edit <?= esc($page['handle']) ?></h1>

<form method="post" action="<?= site_url("workspaces/$workspace/pages/".$page['id']."/edit") ?>">
<?= csrf_field() ?>
<input type="hidden" name="version" value="<?= esc($page['draft_version'], 'attr') ?>">

<label>Name<input name="name" value="<?= esc($profile['name'] ?? '', 'attr') ?>" maxlength="160" required></label>
<label>Bio<textarea name="bio" maxlength="500"><?= esc($profile['bio'] ?? '') ?></textarea></label>

<fieldset>
<legend>Links</legend>

<div id="link-editor">
  <div id="link-rows"></div>
  <button type="button" id="add-link">+ Add link</button>
</div>

<template id="link-row-template">
  <div class="link-row">
    <input type="hidden" data-field="id">
    <div class="link-row-grid">
      <label>Title<input data-field="title" maxlength="240" required></label>
      <label>URL<input data-field="url" type="url" maxlength="2048" required></label>
    </div>
    <div class="link-row-grid field-narrow">
      <label>Emoji<input data-field="emoji" maxlength="32"></label>
      <label>Slug<input data-field="slug" maxlength="64" required></label>
    </div>
    <p class="slug-hint">Slug is used in the public link URL and cannot change once saved.</p>
    <div class="link-row-tools">
      <label class="enabled-toggle"><input type="checkbox" data-field="enabled" checked> Visible on page</label>
      <div class="move-buttons">
        <button type="button" class="move-up" aria-label="Move link up">↑</button>
        <button type="button" class="move-down" aria-label="Move link down">↓</button>
        <button type="button" class="remove-link">Remove</button>
      </div>
    </div>
  </div>
</template>

<input type="hidden" id="links-json" name="links">
<script id="link-data" type="application/json"><?= json_encode(
    $links,
    JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR
) ?></script>

<noscript>
<p role="alert">Enable JavaScript to edit links with this form. Without it, use the JSON fallback below.</p>
<label>Links (JSON)<textarea name="links" rows="18" spellcheck="false"><?= esc(json_encode(
    $links, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
)) ?></textarea></label>
<p>Each link needs title, url, and slug. Optional fields: emoji and enabled. Keep existing IDs and slugs. Omit a link to remove it from the draft. New links omit id.</p>
</noscript>
</fieldset>

<button>Save draft</button>
</form>

<form method="post" action="<?= site_url("workspaces/$workspace/pages/".$page['id']."/publish") ?>">
<?= csrf_field() ?>
<button>Publish saved draft</button>
</form>
<p>Publishing saves an immutable snapshot. Public page delivery is still being built.</p>

<p><a href="<?= site_url("workspaces/$workspace/pages") ?>">Back to pages</a></p>
</main>
<script src="<?= base_url('link-editor.js') ?>" defer></script>
</html>
