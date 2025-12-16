<?php

use PHPUnit\Framework\TestCase;
use Yoast\PHPUnitPolyfills\TestCases\TestCase as PolyfillTestCase;

/**
 * Tests for WP Tester Test Plugin.
 */
class PluginTest extends PolyfillTestCase {

	/**
	 * Test that the sanitize function removes extra whitespace.
	 */
	public function test_sanitize_text_removes_extra_whitespace() {
		$input    = "  Hello    World  \n  Test  ";
		$expected = "Hello World Test";
		$result   = wp_tester_sanitize_text( $input );

		$this->assertEquals( $expected, $result );
	}

	/**
	 * Test that the custom content filter is registered.
	 */
	public function test_custom_content_filter_is_registered() {
		$content = "hello world";
		$result  = apply_filters( 'wp_tester_custom_content', $content );

		$this->assertEquals( 'HELLO WORLD', $result );
	}
}
