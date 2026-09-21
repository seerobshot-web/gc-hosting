<?php
declare(strict_types=1);
namespace App\Domain\Publishing;

use InvalidArgumentException;

final class LinkInput
{
    public static function validate(array $input): array
    {
        if (array_diff(array_keys($input), ['title', 'url', 'slug', 'emoji', 'enabled'])) {
            throw new InvalidArgumentException('Unknown link fields');
        }
        $title = $input['title'] ?? null;
        $url = $input['url'] ?? null;
        $slug = $input['slug'] ?? null;
        if (!is_string($title) || trim($title) === '' || strlen($title) > 240) {
            throw new InvalidArgumentException('Invalid title');
        }
        if (!is_string($slug) || !preg_match('/\A[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\z/', $slug)) {
            throw new InvalidArgumentException('Invalid slug');
        }
        if (!is_string($url) || strlen($url) > 2048 || preg_match('/[\x00-\x20\x7f]/', $url)
            || !filter_var($url, FILTER_VALIDATE_URL)) {
            throw new InvalidArgumentException('Invalid URL');
        }
        $parts = parse_url($url);
        if (!in_array(strtolower($parts['scheme'] ?? ''), ['https', 'http'], true)
            || isset($parts['user']) || isset($parts['pass'])) {
            throw new InvalidArgumentException('Only HTTP(S) destinations without credentials are allowed');
        }
        $emoji = $input['emoji'] ?? null;
        if ($emoji !== null && (!is_string($emoji) || strlen($emoji) > 32)) {
            throw new InvalidArgumentException('Invalid emoji');
        }
        if (isset($input['enabled']) && !is_bool($input['enabled'])) {
            throw new InvalidArgumentException('Enabled must be a boolean');
        }
        return ['title' => trim($title), 'url' => $url, 'slug' => $slug,
            'emoji' => $emoji, 'enabled' => $input['enabled'] ?? true];
    }
}
