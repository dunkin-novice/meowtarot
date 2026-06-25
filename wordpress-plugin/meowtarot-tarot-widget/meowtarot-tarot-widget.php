<?php
/**
 * Plugin Name:       MeowTarot — Free Tarot Widget
 * Plugin URI:        https://www.meowtarot.com/widgets/
 * Description:       Embed a free, cute cat-themed tarot card draw (single card or Past · Present · Future spread) anywhere via a shortcode, block, or sidebar widget. English & Thai.
 * Version:           1.1.0
 * Requires at least: 5.8
 * Requires PHP:      7.2
 * Author:            MeowTarot
 * Author URI:        https://www.meowtarot.com/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       meowtarot-tarot-widget
 *
 * @package MeowTarot
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'MEOWTAROT_WIDGET_VERSION', '1.1.0' );
define( 'MEOWTAROT_WIDGET_BASE', 'https://www.meowtarot.com' );

/**
 * Render the widget: a lazy-loaded iframe + the attribution backlink.
 *
 * @param array $atts Shortcode / block attributes.
 * @return string HTML.
 */
function meowtarot_widget_render( $atts ) {
	$atts = shortcode_atts(
		array(
			'spread' => 'one',   // one | three
			'lang'   => 'auto',  // auto | en | th
			'height' => '600',
			'width'  => '340',
		),
		$atts,
		'meowtarot_tarot'
	);

	$spread = ( 'three' === $atts['spread'] ) ? 'three' : 'one';

	$lang = in_array( $atts['lang'], array( 'en', 'th' ), true ) ? $atts['lang'] : '';
	if ( '' === $lang ) {
		// Infer from the site locale when set to "auto".
		$lang = ( 0 === strpos( strtolower( get_locale() ), 'th' ) ) ? 'th' : 'en';
	}

	$height = max( 360, min( 1200, (int) $atts['height'] ) );
	$width  = max( 240, min( 600, (int) $atts['width'] ) );

	$base = ( 'th' === $lang ) ? MEOWTAROT_WIDGET_BASE . '/th' : MEOWTAROT_WIDGET_BASE;

	$src = MEOWTAROT_WIDGET_BASE . '/widget.html?utm_source=wpplugin&utm_medium=embed&utm_campaign=widget';
	if ( 'th' === $lang ) {
		$src .= '&lang=th';
	}
	if ( 'three' === $spread ) {
		$src .= '&spread=three';
	}

	$iframe_title = ( 'th' === $lang ) ? 'เปิดไพ่ทาโรต์ฟรีโดย MeowTarot' : 'Free Tarot Card Draw by MeowTarot';
	$link_text    = ( 'th' === $lang ) ? 'ดูดวงทาโรต์ฟรี — MeowTarot' : 'Free Tarot Reading — MeowTarot';
	$link_href    = $base . '/?utm_source=wpplugin&utm_medium=referral&utm_campaign=attribution';

	$html  = '<div class="meowtarot-widget" style="max-width:' . esc_attr( $width ) . 'px;margin:0 auto;text-align:center">';
	$html .= '<iframe src="' . esc_url( $src ) . '" title="' . esc_attr( $iframe_title ) . '"';
	$html .= ' width="' . esc_attr( $width ) . '" height="' . esc_attr( $height ) . '" loading="lazy"';
	$html .= ' style="border:0;max-width:100%;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -12px rgba(61,26,92,.4)"></iframe>';
	// Attribution backlink (do-follow) — this is what keeps the widget free. Please keep it.
	$html .= '<p style="font:13px/1.5 system-ui,-apple-system,sans-serif;margin:8px 0 0">';
	$html .= '<a href="' . esc_url( $link_href ) . '" target="_blank" rel="noopener">' . esc_html( $link_text ) . '</a></p>';
	$html .= '</div>';

	return $html;
}
add_shortcode( 'meowtarot_tarot', 'meowtarot_widget_render' );
// Back-compat alias for the original shortcode shipped on /widgets/.
add_shortcode( 'meowtarot_daily_card', 'meowtarot_widget_render' );

/**
 * Register the dynamic Gutenberg block (server-rendered via the shortcode renderer).
 */
function meowtarot_widget_block_init() {
	if ( ! function_exists( 'register_block_type' ) ) {
		return;
	}

	wp_register_script(
		'meowtarot-widget-block',
		plugins_url( 'block.js', __FILE__ ),
		array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-server-side-render', 'wp-i18n' ),
		MEOWTAROT_WIDGET_VERSION,
		true
	);

	register_block_type(
		'meowtarot/tarot-widget',
		array(
			'api_version'     => 2,
			'editor_script'   => 'meowtarot-widget-block',
			'render_callback' => 'meowtarot_widget_block_render',
			'attributes'      => array(
				'spread' => array(
					'type'    => 'string',
					'default' => 'one',
				),
				'lang'   => array(
					'type'    => 'string',
					'default' => 'auto',
				),
				'height' => array(
					'type'    => 'number',
					'default' => 600,
				),
			),
		)
	);
}
add_action( 'init', 'meowtarot_widget_block_init' );

/**
 * Block render callback -> reuse the shortcode renderer.
 *
 * @param array $attributes Block attributes.
 * @return string HTML.
 */
function meowtarot_widget_block_render( $attributes ) {
	return meowtarot_widget_render(
		array(
			'spread' => isset( $attributes['spread'] ) ? $attributes['spread'] : 'one',
			'lang'   => isset( $attributes['lang'] ) ? $attributes['lang'] : 'auto',
			'height' => isset( $attributes['height'] ) ? $attributes['height'] : 600,
		)
	);
}

/**
 * Classic sidebar widget (for themes / users not on the block editor).
 */
class MeowTarot_Sidebar_Widget extends WP_Widget {

	/**
	 * Constructor.
	 */
	public function __construct() {
		parent::__construct(
			'meowtarot_sidebar_widget',
			'MeowTarot Tarot Widget',
			array( 'description' => 'A free cat-themed tarot card draw (single card or Past · Present · Future).' )
		);
	}

	/**
	 * Front-end output.
	 *
	 * @param array $args     Sidebar args.
	 * @param array $instance Saved settings.
	 */
	public function widget( $args, $instance ) {
		echo $args['before_widget']; // phpcs:ignore WordPress.Security.EscapeOutput
		if ( ! empty( $instance['title'] ) ) {
			echo $args['before_title'] . apply_filters( 'widget_title', $instance['title'] ) . $args['after_title']; // phpcs:ignore WordPress.Security.EscapeOutput
		}
		$spread = ( isset( $instance['spread'] ) && 'three' === $instance['spread'] ) ? 'three' : 'one';
		echo meowtarot_widget_render( array( 'spread' => $spread ) ); // phpcs:ignore WordPress.Security.EscapeOutput
		echo $args['after_widget']; // phpcs:ignore WordPress.Security.EscapeOutput
	}

	/**
	 * Settings form.
	 *
	 * @param array $instance Saved settings.
	 */
	public function form( $instance ) {
		$title  = ! empty( $instance['title'] ) ? $instance['title'] : 'Daily Tarot';
		$spread = ! empty( $instance['spread'] ) ? $instance['spread'] : 'one';
		?>
		<p>
			<label for="<?php echo esc_attr( $this->get_field_id( 'title' ) ); ?>">Title:</label>
			<input class="widefat" id="<?php echo esc_attr( $this->get_field_id( 'title' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'title' ) ); ?>" type="text" value="<?php echo esc_attr( $title ); ?>">
		</p>
		<p>
			<label for="<?php echo esc_attr( $this->get_field_id( 'spread' ) ); ?>">Spread:</label>
			<select class="widefat" id="<?php echo esc_attr( $this->get_field_id( 'spread' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'spread' ) ); ?>">
				<option value="one" <?php selected( $spread, 'one' ); ?>>Single card</option>
				<option value="three" <?php selected( $spread, 'three' ); ?>>Past · Present · Future</option>
			</select>
		</p>
		<?php
	}

	/**
	 * Persist settings.
	 *
	 * @param array $new_instance New values.
	 * @param array $old_instance Old values.
	 * @return array
	 */
	public function update( $new_instance, $old_instance ) {
		$instance           = array();
		$instance['title']  = ( ! empty( $new_instance['title'] ) ) ? sanitize_text_field( $new_instance['title'] ) : '';
		$instance['spread'] = ( ! empty( $new_instance['spread'] ) && 'three' === $new_instance['spread'] ) ? 'three' : 'one';
		return $instance;
	}
}

/**
 * Register the sidebar widget.
 */
function meowtarot_register_sidebar_widget() {
	register_widget( 'MeowTarot_Sidebar_Widget' );
}
add_action( 'widgets_init', 'meowtarot_register_sidebar_widget' );

/**
 * Add a "Docs" link on the Plugins screen.
 *
 * @param array $links Existing action links.
 * @return array
 */
function meowtarot_widget_plugin_links( $links ) {
	$links[] = '<a href="' . esc_url( MEOWTAROT_WIDGET_BASE . '/widgets/' ) . '" target="_blank">' . esc_html__( 'Docs', 'meowtarot-tarot-widget' ) . '</a>';
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'meowtarot_widget_plugin_links' );
