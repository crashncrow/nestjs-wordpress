<?php
/**
 * Plugin Name: nestjs-wordpress dev fixtures
 * Description: Registers a demo custom post type, taxonomy and classic menu locations
 *              so the seed can create content without third-party plugins. Dev only.
 *
 * @package NestJSWordPress
 */

declare(strict_types=1);

add_action(
	'init',
	static function (): void {
		register_post_type(
			'book',
			array(
				'label'        => 'Books',
				'public'       => true,
				'show_in_rest' => true,
				'rest_base'    => 'books',
				'has_archive'  => true,
				'supports'     => array( 'title', 'editor', 'excerpt', 'thumbnail', 'author' ),
				'taxonomies'   => array( 'genre' ),
			)
		);

		register_taxonomy(
			'genre',
			array( 'book' ),
			array(
				'label'        => 'Genres',
				'public'       => true,
				'hierarchical' => true,
				'show_in_rest' => true,
				'rest_base'    => 'genres',
			)
		);
	}
);

// Block themes (the WP 7.x default) do not declare classic menu locations,
// but /wp/v2/menu-locations only lists registered ones.
add_action(
	'after_setup_theme',
	static function (): void {
		register_nav_menus(
			array(
				'primary' => 'Primary',
				'footer'  => 'Footer',
			)
		);
	}
);
