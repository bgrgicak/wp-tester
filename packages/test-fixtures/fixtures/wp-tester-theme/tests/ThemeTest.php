<?php

use PHPUnit\Framework\TestCase;
use Yoast\PHPUnitPolyfills\TestCases\TestCase as PolyfillTestCase;

/**
 * Tests for WP Tester Test Theme.
 */
class ThemeTest extends PolyfillTestCase {

	/**
	 * Test that the date formatting function works correctly.
	 */
	public function test_format_date_returns_friendly_format() {
		$input    = '2024-12-15';
		$expected = 'December 15, 2024';
		$result   = wp_tester_theme_format_date( $input );

		$this->assertEquals( $expected, $result );
	}

	/**
	 * Test that navigation menu is registered.
	 */
	public function test_navigation_menu_is_registered() {
		global $_wp_nav_menus;

		// Trigger the after_setup_theme action
		do_action( 'after_setup_theme' );

		$this->assertIsArray( $_wp_nav_menus );
		$this->assertArrayHasKey( 'primary', $_wp_nav_menus );
	}
}
