<?php
/**
 * PHPUnit bootstrap file for WP Tester Test Theme.
 */

// Check if we're running in wp-env or need mocks
$_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( $_tests_dir && file_exists( $_tests_dir . '/includes/functions.php' ) ) {
	// Running with WordPress test suite (wp-env)
	require_once $_tests_dir . '/includes/functions.php';

	// Load theme before WordPress is loaded
	tests_add_filter( 'muplugins_loaded', function() {
		require dirname( __DIR__ ) . '/functions.php';
	} );

	require $_tests_dir . '/includes/bootstrap.php';
} else {
	// Running standalone - use mock functions
	if ( ! function_exists( 'add_action' ) ) {
		function add_action( $hook, $callback ) {
			global $_wp_actions;
			if ( ! isset( $_wp_actions ) ) {
				$_wp_actions = array();
			}
			if ( ! isset( $_wp_actions[ $hook ] ) ) {
				$_wp_actions[ $hook ] = array();
			}
			$_wp_actions[ $hook ][] = $callback;
		}
	}

	if ( ! function_exists( 'do_action' ) ) {
		function do_action( $hook ) {
			global $_wp_actions;
			if ( isset( $_wp_actions[ $hook ] ) ) {
				foreach ( $_wp_actions[ $hook ] as $callback ) {
					call_user_func( $callback );
				}
			}
		}
	}

	if ( ! function_exists( 'register_nav_menus' ) ) {
		function register_nav_menus( $menus ) {
			global $_wp_nav_menus;
			if ( ! isset( $_wp_nav_menus ) ) {
				$_wp_nav_menus = array();
			}
			$_wp_nav_menus = array_merge( $_wp_nav_menus, $menus );
		}
	}

	if ( ! function_exists( '__' ) ) {
		function __( $text ) {
			return $text;
		}
	}

	// Load the theme functions AFTER mock functions are defined
	require_once dirname( __DIR__ ) . '/functions.php';
}
