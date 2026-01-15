<?php

use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * Tests that require WordPress to be loaded.
 */
class WordPressTest extends TestCase {

	/**
	 * Skip all tests if WordPress is not loaded.
	 */
	protected function set_up() {
		parent::set_up();

		if ( ! function_exists( 'wp_insert_post' ) ) {
			$this->markTestSkipped( 'WordPress is not loaded. Run tests using wp-tester CLI or set WP_LOAD_PATH environment variable.' );
		}
	}

	/**
	 * Test that we can create and retrieve a post using WordPress functions.
	 */
	public function test_can_create_and_retrieve_post() {
		// Create a post using WordPress function
		$post_id = wp_insert_post( array(
			'post_title'   => 'Test Post',
			'post_content' => 'This is a test post content.',
			'post_status'  => 'publish',
			'post_type'    => 'post',
		) );

		$this->assertIsInt( $post_id );
		$this->assertGreaterThan( 0, $post_id );

		// Retrieve the post
		$post = get_post( $post_id );

		$this->assertNotNull( $post );
		$this->assertEquals( 'Test Post', $post->post_title );
		$this->assertEquals( 'This is a test post content.', $post->post_content );
		$this->assertEquals( 'publish', $post->post_status );

		// Clean up
		wp_delete_post( $post_id, true );
	}

	/**
	 * Test that we can use WordPress sanitization functions.
	 */
	public function test_wordpress_sanitize_functions() {
		$unsafe_text  = '<script>alert("xss")</script>Hello World';
		$safe_text    = sanitize_text_field( $unsafe_text );

		$this->assertEquals( 'Hello World', $safe_text );
		$this->assertStringNotContainsString( '<script>', $safe_text );
	}

	/**
	 * Test that we can work with WordPress options.
	 */
	public function test_wordpress_options() {
		$option_name  = 'wp_tester_test_option';
		$option_value = 'test_value_' . time();

		// Add option
		$result = add_option( $option_name, $option_value );
		$this->assertTrue( $result );

		// Get option
		$retrieved = get_option( $option_name );
		$this->assertEquals( $option_value, $retrieved );

		// Update option
		$new_value = 'updated_value_' . time();
		update_option( $option_name, $new_value );
		$this->assertEquals( $new_value, get_option( $option_name ) );

		// Delete option
		delete_option( $option_name );
		$this->assertFalse( get_option( $option_name ) );
	}
}
