<?php
/**
 * Checks NWP_Webhooks::sign() against the test vectors shared with the TypeScript signature
 * module, so the plugin and the library cannot drift apart. Runs without WordPress:
 *
 *     php tests/signature-vectors.php ../packages/nestjs-wordpress/test/fixtures/signature-vectors.json
 *
 * @package NestJSWordPress
 */

declare(strict_types=1);

// The class file exits when loaded outside WordPress; sign() itself needs no WordPress.
define( 'ABSPATH', __DIR__ );
require __DIR__ . '/../nestjs-wordpress-webhooks/includes/class-nwp-webhooks.php';

$path = $argv[1] ?? '';
$data = is_readable( $path ) ? json_decode( (string) file_get_contents( $path ), true ) : null;
if ( ! is_array( $data ) || ! isset( $data['vectors'] ) ) {
	fwrite( STDERR, "Usage: php tests/signature-vectors.php <signature-vectors.json>\n" );
	exit( 2 );
}

$failures = 0;
foreach ( $data['vectors'] as $vector ) {
	$actual = NWP_Webhooks::sign( $vector['secret'], $vector['timestamp'], $vector['body'] );
	$ok     = hash_equals( $vector['signature'], $actual );
	$failures += $ok ? 0 : 1;
	echo ( $ok ? 'ok   ' : 'FAIL ' ) . $vector['name'] . ( $ok ? '' : " (got {$actual})" ) . "\n";
}

exit( $failures > 0 ? 1 : 0 );
