<?php
/**
 * Shared top bar. Optional $crumb = ['label' => string, 'href' => string]
 * renders a single breadcrumb link between the brand and the sign-out
 * control. Only rendered on authenticated pages, so it always offers
 * sign-out.
 */
?>
<header class="topbar">
  <nav>
    <a class="brand" href="<?= site_url('workspaces') ?>">GLINKS</a>
    <?php if (!empty($crumb)): ?>
      <a href="<?= esc($crumb['href'], 'attr') ?>"><?= esc($crumb['label']) ?></a>
    <?php endif ?>
  </nav>
  <form method="post" action="<?= url_to('logout') ?>"><?= csrf_field() ?><button class="link" type="submit">Sign out</button></form>
</header>
