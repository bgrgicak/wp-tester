<?php
/**
 * PHPUnit bootstrap file for WP Tester Test Plugin.
 */

// Check if we're running with WordPress test library (unit mode)
$_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( $_tests_dir && file_exists( $_tests_dir . '/includes/functions.php' ) ) {
	// Unit mode: Running with WordPress test suite
	require_once $_tests_dir . '/includes/functions.php';

	// Load plugin before WordPress is loaded
	tests_add_filter( 'muplugins_loaded', function() {
		require dirname( __DIR__ ) . '/wp-tester-plugin.php';
	} );

	require $_tests_dir . '/includes/bootstrap.php';
} else {
	// Standalone mode or integration mode (wp-tester already loaded WordPress)
	// Provide mock functions for basic unit tests when running standalone
	if ( ! function_exists( 'add_filter' ) ) {
		function add_filter( $hook, $callback ) {
			global $_wp_filters;
			if ( ! isset( $_wp_filters ) ) {
				$_wp_filters = array();
			}
			if ( ! isset( $_wp_filters[ $hook ] ) ) {
				$_wp_filters[ $hook ] = array();
			}
			$_wp_filters[ $hook ][] = $callback;
		}
	}

	if ( ! function_exists( 'apply_filters' ) ) {
		function apply_filters( $hook, $value ) {
			global $_wp_filters;
			if ( isset( $_wp_filters[ $hook ] ) ) {
				foreach ( $_wp_filters[ $hook ] as $callback ) {
					$value = call_user_func( $callback, $value );
				}
			}
			return $value;
		}
	}

	// Load the plugin file (if not already loaded by wp-tester)
	if ( ! function_exists( 'wp_tester_sanitize_text' ) ) {
		require_once dirname( __DIR__ ) . '/wp-tester-plugin.php';
	}
}
