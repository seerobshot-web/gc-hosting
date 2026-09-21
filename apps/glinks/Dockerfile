FROM php:8.5-cli-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libicu-dev libpq-dev libonig-dev unzip \
    && docker-php-ext-install intl mbstring pdo_pgsql pgsql \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/glinks
COPY . .
RUN composer install --no-interaction --prefer-dist \
    && chown -R www-data:www-data writable
USER www-data
EXPOSE 8080
# Development only. Production must use PHP-FPM behind Caddy, not spark serve.
CMD ["php", "spark", "serve", "--host", "0.0.0.0", "--port", "8080"]
