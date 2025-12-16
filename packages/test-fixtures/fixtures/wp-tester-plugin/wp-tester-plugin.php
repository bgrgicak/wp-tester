<?php
/**
 * Plugin Name: WP Tester Test Plugin
 * Description: Minimal test plugin for wp-tester
 * Version: 1.0.0
 * Author: WP Tester
 */

/**
 * Sanitize text by removing extra whitespace.
 *
 * @param string $text Text to sanitize.
 * @return string Sanitized text.
 */
function wp_tester_sanitize_text( $text ) {
	return trim( preg_replace( '/\s+/', ' ', $text ) );
}

/**
 * Add custom content filter.
 */
add_filter( 'wp_tester_custom_content', function( $content ) {
	return strtoupper( $content );
} );