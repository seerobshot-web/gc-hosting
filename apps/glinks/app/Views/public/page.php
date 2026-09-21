<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow">
<link rel="canonical" href="<?= esc($canonicalUrl, 'attr') ?>">
<link rel="stylesheet" href="<?= base_url('glinks.css') ?>">
<title><?= esc($profile['name'] !== '' ? $profile['name'] : $handle) ?> · GLINKS</title>
<?php if ($profile['bio'] !== ''): ?><meta name="description" content="<?= esc($profile['bio'], 'attr') ?>"><?php endif ?>
<meta property="og:type" content="profile">
<meta property="og:title" content="<?= esc($profile['name'] !== '' ? $profile['name'] : $handle, 'attr') ?>">
<meta property="og:url" content="<?= esc($canonicalUrl, 'attr') ?>">
<?php if ($profile['bio'] !== ''): ?><meta property="og:description" content="<?= esc($profile['bio'], 'attr') ?>"><?php endif ?>
<body class="public-page">
<main class="public-profile">
  <header class="public-profile__header">
    <h1><?= esc($profile['name'] !== '' ? $profile['name'] : $handle) ?></h1>
    <?php if ($profile['bio'] !== ''): ?><p><?= esc($profile['bio']) ?></p><?php endif ?>
  </header>
  <?php if (!$links): ?>
  <p class="public-profile__empty">No links yet.</p>
  <?php else: ?>
  <ul class="public-profile__links">
    <?php foreach ($links as $link): ?>
    <li>
      <a href="<?= esc($link['visitUrl'], 'attr') ?>">
        <?php if ($link['emoji']): ?><span aria-hidden="true"><?= esc($link['emoji']) ?></span><?php endif ?>
        <span><?= esc($link['title']) ?></span>
      </a>
    </li>
    <?php endforeach ?>
  </ul>
  <?php endif ?>
</main>
</body>
</html>
