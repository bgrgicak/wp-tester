<?php
/**
 * PHPUnit bootstrap file for WP Tester Test Plugin.
 */

// Mock WordPress functions BEFORE loading the plugin
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

// Load the plugin file AFTER mock functions are defined
require_once dirname( __DIR__ ) . '/wp-tester-plugin.php';
