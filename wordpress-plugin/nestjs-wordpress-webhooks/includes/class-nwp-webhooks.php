<?php
/**
 * Webhook dispatcher.
 *
 * @package NestJSWordPress
 */

declare(strict_types=1);

defined( 'ABSPATH' ) || exit;

/**
 * Collects content changes during a request and sends one signed webhook per change on shutdown.
 *
 * Why collect instead of sending from each hook: a single edit fires `save_post` and
 * `transition_post_status` several times (autosave, revision, the post itself, meta updates).
 * Queuing by "type:id" deduplicates them, and sending on `shutdown` guarantees terms and meta
 * have been saved by the time the application refetches.
 *
 * The webhook describes *what changed* (a content change: event, type, ID, slug and, for
 * posts, the taxonomies their type uses). It deliberately does not compute cache tags: the
 * library's invalidation contract derives them, and reads dependencies from cached results
 * (a menu knows the pages it links to, a post knows its author and image).
 */
final class NWP_Webhooks {

	/**
	 * Pending changes keyed by "kind:id" so repeated hooks for the same object collapse.
	 *
	 * @var array<string, array{event: string, type: string, id: int, slug: string, taxonomies?: string[]}>
	 */
	private static array $queue = array();

	/**
	 * Registers hooks. Does nothing (beyond the optional menu filter) until both constants are set.
	 */
	public static function init(): void {
		if ( defined( 'NWP_PUBLIC_MENUS' ) && NWP_PUBLIC_MENUS ) {
			// Core only exposes /wp/v2/menus* to users who can edit menus.
			add_filter( 'rest_menu_read_access', '__return_true' );
		}

		if ( ! self::is_configured() ) {
			return;
		}

		// Fires on every status change, including publish → publish (an update) and → trash.
		add_action( 'transition_post_status', array( self::class, 'on_transition_post_status' ), 10, 3 );
		// Permanent deletion of a post that skipped the trash.
		add_action( 'before_delete_post', array( self::class, 'on_before_delete_post' ), 10, 2 );

		// Attachments keep the `inherit` status, so transition_post_status never sees their edits.
		add_action( 'attachment_updated', array( self::class, 'on_attachment_saved' ) );
		add_action( 'delete_attachment', array( self::class, 'on_attachment_deleted' ) );

		// Entries embed their author's name and avatar.
		add_action( 'profile_update', array( self::class, 'on_user_saved' ) );
		add_action( 'deleted_user', array( self::class, 'on_user_deleted' ) );

		add_action( 'created_term', array( self::class, 'on_term_saved' ), 10, 3 );
		add_action( 'edited_term', array( self::class, 'on_term_saved' ), 10, 3 );
		add_action( 'delete_term', array( self::class, 'on_term_deleted' ), 10, 4 );

		add_action( 'wp_update_nav_menu', array( self::class, 'on_menu_saved' ) );
		// Single-item edits (REST API, WP-CLI) do not fire wp_update_nav_menu.
		add_action( 'wp_update_nav_menu_item', array( self::class, 'on_menu_saved' ) );
		add_action( 'wp_delete_nav_menu', array( self::class, 'on_menu_deleted' ) );

		add_action( 'shutdown', array( self::class, 'flush' ) );
	}

	/**
	 * Whether the webhook URL and secret are configured.
	 */
	private static function is_configured(): bool {
		return defined( 'NWP_WEBHOOK_URL' ) && is_string( NWP_WEBHOOK_URL ) && '' !== NWP_WEBHOOK_URL
			&& defined( 'NWP_WEBHOOK_SECRET' ) && is_string( NWP_WEBHOOK_SECRET ) && '' !== NWP_WEBHOOK_SECRET;
	}

	/**
	 * Queues a change when a post becomes, stays or stops being public.
	 *
	 * Drafts that were never published are ignored: the application never served them.
	 *
	 * @param string  $new_status New post status.
	 * @param string  $old_status Previous post status.
	 * @param WP_Post $post       Post object.
	 */
	public static function on_transition_post_status( string $new_status, string $old_status, WP_Post $post ): void {
		if ( 'publish' !== $new_status && 'publish' !== $old_status ) {
			return;
		}
		if ( ! self::is_tracked_post( $post ) ) {
			return;
		}

		$event = 'trash' === $new_status ? 'post.deleted' : 'post.saved';
		self::queue_post( $event, $post );
	}

	/**
	 * Queues a deletion when a published post is deleted permanently.
	 *
	 * @param int     $post_id Post ID.
	 * @param WP_Post $post    Post object.
	 */
	public static function on_before_delete_post( int $post_id, WP_Post $post ): void {
		if ( 'publish' === $post->post_status && self::is_tracked_post( $post ) ) {
			self::queue_post( 'post.deleted', $post );
		}
	}

	/**
	 * Queues an attachment edit (title, alt text, caption, file).
	 *
	 * @param int $post_id Attachment ID.
	 */
	public static function on_attachment_saved( int $post_id ): void {
		$post = get_post( $post_id );
		if ( $post instanceof WP_Post && self::is_tracked_post( $post ) ) {
			self::queue_post( 'post.saved', $post );
		}
	}

	/**
	 * Queues an attachment deletion.
	 *
	 * @param int $post_id Attachment ID.
	 */
	public static function on_attachment_deleted( int $post_id ): void {
		$post = get_post( $post_id );
		if ( $post instanceof WP_Post && self::is_tracked_post( $post ) ) {
			self::queue_post( 'post.deleted', $post );
		}
	}

	/**
	 * Queues a user profile update.
	 *
	 * @param int $user_id User ID.
	 */
	public static function on_user_saved( int $user_id ): void {
		$user = get_userdata( $user_id );
		self::queue_user( 'user.saved', $user_id, $user instanceof WP_User ? $user->user_nicename : '' );
	}

	/**
	 * Queues a user deletion.
	 *
	 * @param int $user_id User ID.
	 */
	public static function on_user_deleted( int $user_id ): void {
		self::queue_user( 'user.deleted', $user_id, '' );
	}

	/**
	 * Queues a term creation or update.
	 *
	 * @param int    $term_id  Term ID.
	 * @param int    $tt_id    Term taxonomy ID.
	 * @param string $taxonomy Taxonomy slug.
	 */
	public static function on_term_saved( int $term_id, int $tt_id, string $taxonomy ): void {
		$term = get_term( $term_id, $taxonomy );
		if ( $term instanceof WP_Term && self::is_tracked_taxonomy( $taxonomy ) ) {
			self::queue_term( 'term.saved', $term_id, $taxonomy, $term->slug );
		}
	}

	/**
	 * Queues a term deletion.
	 *
	 * @param int     $term_id      Term ID.
	 * @param int     $tt_id        Term taxonomy ID.
	 * @param string  $taxonomy     Taxonomy slug.
	 * @param WP_Term $deleted_term Copy of the deleted term.
	 */
	public static function on_term_deleted( int $term_id, int $tt_id, string $taxonomy, $deleted_term ): void {
		if ( self::is_tracked_taxonomy( $taxonomy ) ) {
			$slug = $deleted_term instanceof WP_Term ? $deleted_term->slug : '';
			self::queue_term( 'term.deleted', $term_id, $taxonomy, $slug );
		}
	}

	/**
	 * Queues a menu update (items, name or settings).
	 *
	 * @param int $menu_id Menu (nav_menu term) ID.
	 */
	public static function on_menu_saved( int $menu_id ): void {
		self::queue_menu( 'menu.saved', $menu_id );
	}

	/**
	 * Queues a menu deletion.
	 *
	 * @param int $menu_id Menu (nav_menu term) ID.
	 */
	public static function on_menu_deleted( int $menu_id ): void {
		self::queue_menu( 'menu.deleted', $menu_id );
	}

	/**
	 * Only public, REST-visible content can be cached by the application.
	 *
	 * @param WP_Post $post Post object.
	 */
	private static function is_tracked_post( WP_Post $post ): bool {
		if ( wp_is_post_revision( $post ) || wp_is_post_autosave( $post ) ) {
			return false;
		}
		$type = get_post_type_object( $post->post_type );
		return $type instanceof WP_Post_Type && $type->public && $type->show_in_rest;
	}

	/**
	 * Menus are `nav_menu` terms; they are reported through the menu hooks instead.
	 *
	 * @param string $taxonomy Taxonomy slug.
	 */
	private static function is_tracked_taxonomy( string $taxonomy ): bool {
		$object = get_taxonomy( $taxonomy );
		return 'nav_menu' !== $taxonomy && $object instanceof WP_Taxonomy && $object->show_in_rest;
	}

	/**
	 * Adds a post change to the queue.
	 *
	 * @param string  $event Event name.
	 * @param WP_Post $post  Post object.
	 */
	private static function queue_post( string $event, WP_Post $post ): void {
		// Publishing or removing an entry changes the term counts of these taxonomies.
		$taxonomies = array_values( array_filter( get_object_taxonomies( $post->post_type ), array( self::class, 'is_tracked_taxonomy' ) ) );

		self::$queue[ 'post:' . $post->ID ] = array(
			'event'      => $event,
			'type'       => $post->post_type,
			'id'         => $post->ID,
			'slug'       => $post->post_name,
			'taxonomies' => $taxonomies,
		);
	}

	/**
	 * Adds a term change to the queue.
	 *
	 * @param string $event    Event name.
	 * @param int    $term_id  Term ID.
	 * @param string $taxonomy Taxonomy slug.
	 * @param string $slug     Term slug.
	 */
	private static function queue_term( string $event, int $term_id, string $taxonomy, string $slug ): void {
		self::$queue[ 'term:' . $term_id ] = array(
			'event' => $event,
			'type'  => $taxonomy,
			'id'    => $term_id,
			'slug'  => $slug,
		);
	}

	/**
	 * Adds a menu change to the queue.
	 *
	 * @param string $event   Event name.
	 * @param int    $menu_id Menu ID.
	 */
	private static function queue_menu( string $event, int $menu_id ): void {
		$menu = wp_get_nav_menu_object( $menu_id );

		self::$queue[ 'menu:' . $menu_id ] = array(
			'event' => $event,
			'type'  => 'nav_menu',
			'id'    => $menu_id,
			'slug'  => $menu instanceof WP_Term ? $menu->slug : '',
		);
	}

	/**
	 * Adds a user change to the queue.
	 *
	 * @param string $event   Event name.
	 * @param int    $user_id User ID.
	 * @param string $slug    User slug (nicename).
	 */
	private static function queue_user( string $event, int $user_id, string $slug ): void {
		self::$queue[ 'user:' . $user_id ] = array(
			'event' => $event,
			'type'  => 'user',
			'id'    => $user_id,
			'slug'  => $slug,
		);
	}

	/**
	 * Sends every queued change. Runs on `shutdown`, after the response has been built.
	 */
	public static function flush(): void {
		$changes     = self::$queue;
		self::$queue = array();

		foreach ( $changes as $change ) {
			self::send( $change );
		}
	}

	/**
	 * Sends one signed webhook.
	 *
	 * Signature: hex HMAC-SHA256 of "<timestamp>.<body>" with NWP_WEBHOOK_SECRET, sent as
	 * `X-NWP-Signature: sha256=<hex>` together with `X-NWP-Timestamp`. Signing the timestamp
	 * lets the receiver reject replayed requests.
	 *
	 * @param array{event: string, type: string, id: int, slug: string, taxonomies?: string[]} $change Change to send.
	 */
	private static function send( array $change ): void {
		$body = wp_json_encode( $change );
		if ( false === $body ) {
			return;
		}

		$timestamp = (string) time();
		$signature = hash_hmac( 'sha256', $timestamp . '.' . $body, NWP_WEBHOOK_SECRET );

		$args = array(
			'body'     => $body,
			'headers'  => array(
				'Content-Type'    => 'application/json',
				'X-NWP-Timestamp' => $timestamp,
				'X-NWP-Signature' => 'sha256=' . $signature,
			),
			'timeout'  => 5,
			// Non-blocking: the editor's request does not wait for the application.
			'blocking' => self::is_blocking(),
		);

		/**
		 * Filters the request arguments, e.g. to add headers or change the timeout.
		 *
		 * @param array $args   Arguments for wp_remote_post().
		 * @param array $change The change being sent.
		 */
		$args = apply_filters( 'nwp_webhook_request_args', $args, $change );

		wp_remote_post( NWP_WEBHOOK_URL, $args );
	}

	/**
	 * Whether to wait for the response.
	 *
	 * Web requests use non-blocking calls so publishing stays fast. WP-CLI and cron are
	 * different: the PHP process exits right after `shutdown`, which can kill a non-blocking
	 * request before it is fully written, and no user is waiting anyway.
	 */
	private static function is_blocking(): bool {
		$blocking = ( defined( 'WP_CLI' ) && WP_CLI ) || wp_doing_cron();

		/**
		 * Filters whether webhooks are sent with a blocking request.
		 *
		 * @param bool $blocking Default value.
		 */
		return (bool) apply_filters( 'nwp_webhook_blocking', $blocking );
	}
}
