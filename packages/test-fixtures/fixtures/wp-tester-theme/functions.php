<?php
/**
 * WP Tester Test Theme functions.
 */

/**
 * Format a date string in a friendly format.
 *
 * @param string $date Date string.
 * @return string Formatted date.
 */
function wp_tester_theme_format_date( $date ) {
	$timestamp = strtotime( $date );
	if ( false === $timestamp ) {
		return '';
	}
	return date( 'F j, Y', $timestamp );
}

/**
 * Register navigation menu.
 */
add_action( 'after_setup_theme', function() {
	register_nav_menus( array(
		'primary' => __( 'Primary Menu' ),
	) );
} );
