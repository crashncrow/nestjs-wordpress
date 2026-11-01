<?php
/**
 * Plugin Name:       nestjs-wordpress Webhooks
 * Plugin URI:        https://github.com/crashncrow/nestjs-wordpress
 * Description:       Sends HMAC-signed content-change webhooks to a nestjs-wordpress application.
 * Version:           0.2.0-beta.1
 * Requires at least: 6.5
 * Requires PHP:      8.1
 * Author:            crashncrow
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 * Text Domain:       nestjs-wordpress-webhooks
 *
 * Configuration (wp-config.php):
 *
 *     define( 'NWP_WEBHOOK_URL', 'https://api.example.com/webhooks/wordpress' );
 *     define( 'NWP_WEBHOOK_SECRET', 'a-long-random-string' );
 *     define( 'NWP_PUBLIC_MENUS', true ); // Optional: expose menus to anonymous REST reads.
 *
 * @package NestJSWordPress
 */

declare(strict_types=1);

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/includes/class-nwp-webhooks.php';

NWP_Webhooks::init();
