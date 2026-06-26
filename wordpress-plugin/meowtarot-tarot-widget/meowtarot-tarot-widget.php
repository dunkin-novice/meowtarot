<?php
/**
 * Plugin Name:       MeowTarot Tarot Widget
 * Plugin URI:        https://www.meowtarot.com/widgets/
 * Description:       Embed a free, cute cat-themed tarot card draw (single card or Past · Present · Future spread) anywhere via a shortcode, block, or sidebar widget. English & Thai.
 * Version:           1.2.1
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

define( 'MEOWTAROT_WIDGET_VERSION', '1.2.1' );
define( 'MEOWTAROT_WIDGET_BASE', 'https://www.meowtarot.com' );

/**
 * Whether to render the optional attribution backlink.
 *
 * Per WordPress.org Plugin Guideline 10, a front-end credit link must be OPT-IN.
 * It is therefore OFF by default: a per-instance `attribution` attribute wins when
 * set, otherwise we fall back to the site-wide setting (Settings → MeowTarot Tarot),
 * which itself defaults to off.
 *
 * @param array $atts Shortcode / block attributes.
 * @return bool
 */
function meowtarot_widget_attribution_enabled( $atts ) {
	if ( isset( $atts['attribution'] ) && '' !== $atts['attribution'] ) {
		$truthy = array( '1', 'yes', 'true', 'on' );
		return in_array( strtolower( (string) $atts['attribution'] ), $truthy, true );
	}
	return (bool) get_option( 'meowtarot_widget_show_attribution', 0 );
}

/**
 * Render the widget: a lazy-loaded iframe + the attribution backlink.
 *
 * @param array $atts Shortcode / block attributes.
 * @return string HTML.
 */
function meowtarot_widget_render( $atts ) {
	$atts = shortcode_atts(
		array(
			'spread'      => 'one',   // one | three
			'lang'        => 'auto',  // auto | en | th
			'height'      => '600',
			'width'       => '340',
			'attribution' => '',      // '' = inherit site setting (default off) | yes/no
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
	// Optional attribution backlink — OFF by default (WordPress.org Guideline 10: front-end
	// credit must be opt-in). Enable site-wide under Settings → MeowTarot Tarot, or per
	// instance with attribution="yes". Keeping it on helps support the free widget. 🙏
	if ( meowtarot_widget_attribution_enabled( $atts ) ) {
		$html .= '<p style="font:13px/1.5 system-ui,-apple-system,sans-serif;margin:8px 0 0">';
		$html .= '<a href="' . esc_url( $link_href ) . '" target="_blank" rel="noopener">' . esc_html( $link_text ) . '</a></p>';
	}
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
				'attribution' => array(
					'type'    => 'boolean',
					'default' => false,
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
			'spread'      => isset( $attributes['spread'] ) ? $attributes['spread'] : 'one',
			'lang'        => isset( $attributes['lang'] ) ? $attributes['lang'] : 'auto',
			'height'      => isset( $attributes['height'] ) ? $attributes['height'] : 600,
			// Block toggle is a real boolean; only override the site setting when it's ON.
			'attribution' => ( isset( $attributes['attribution'] ) && $attributes['attribution'] ) ? 'yes' : '',
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
		// before_widget / after_widget are theme-provided sidebar wrappers (trusted markup).
		echo $args['before_widget']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		if ( ! empty( $instance['title'] ) ) {
			// Escape the title content; before/after_title are theme wrappers.
			echo $args['before_title'] . esc_html( apply_filters( 'widget_title', $instance['title'] ) ) . $args['after_title']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
		$spread = ( isset( $instance['spread'] ) && 'three' === $instance['spread'] ) ? 'three' : 'one';
		// meowtarot_widget_render() returns HTML already escaped with esc_url()/esc_attr()/esc_html().
		echo meowtarot_widget_render( array( 'spread' => $spread ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
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
 * Add "Settings" + "Docs" links on the Plugins screen.
 *
 * @param array $links Existing action links.
 * @return array
 */
function meowtarot_widget_plugin_links( $links ) {
	$settings = '<a href="' . esc_url( admin_url( 'options-general.php?page=meowtarot-tarot-widget' ) ) . '">' . esc_html__( 'Settings', 'meowtarot-tarot-widget' ) . '</a>';
	$docs     = '<a href="' . esc_url( MEOWTAROT_WIDGET_BASE . '/widgets/' ) . '" target="_blank">' . esc_html__( 'Docs', 'meowtarot-tarot-widget' ) . '</a>';
	array_unshift( $links, $settings );
	$links[] = $docs;
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'meowtarot_widget_plugin_links' );

/**
 * Register the single opt-in setting (front-end attribution link, default OFF).
 */
function meowtarot_widget_register_settings() {
	register_setting(
		'meowtarot_widget_settings',
		'meowtarot_widget_show_attribution',
		array(
			'type'              => 'boolean',
			'sanitize_callback' => 'meowtarot_widget_sanitize_bool',
			'default'           => 0,
		)
	);
}
add_action( 'admin_init', 'meowtarot_widget_register_settings' );

/**
 * Sanitize the checkbox value to 0/1.
 *
 * @param mixed $value Raw input.
 * @return int
 */
function meowtarot_widget_sanitize_bool( $value ) {
	return $value ? 1 : 0;
}

/**
 * Add the settings page under Settings.
 */
function meowtarot_widget_settings_menu() {
	add_options_page(
		esc_html__( 'MeowTarot Tarot Widget', 'meowtarot-tarot-widget' ),
		esc_html__( 'MeowTarot Tarot', 'meowtarot-tarot-widget' ),
		'manage_options',
		'meowtarot-tarot-widget',
		'meowtarot_widget_settings_page'
	);
}
add_action( 'admin_menu', 'meowtarot_widget_settings_menu' );

/**
 * Render the settings page.
 */
function meowtarot_widget_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap">
		<h1><?php echo esc_html__( 'MeowTarot Tarot Widget', 'meowtarot-tarot-widget' ); ?></h1>
		<form action="options.php" method="post">
			<?php settings_fields( 'meowtarot_widget_settings' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><?php echo esc_html__( 'Attribution link', 'meowtarot-tarot-widget' ); ?></th>
					<td>
						<label>
							<input type="checkbox" name="meowtarot_widget_show_attribution" value="1" <?php checked( 1, (int) get_option( 'meowtarot_widget_show_attribution', 0 ) ); ?> />
							<?php echo esc_html__( 'Show a small "Free Tarot Reading — MeowTarot" link below the widget on the front end.', 'meowtarot-tarot-widget' ); ?>
						</label>
						<p class="description">
							<?php echo esc_html__( 'Off by default. Turning it on adds a public link to meowtarot.com — entirely optional, and a kind way to support the free widget. You can also set it per instance with attribution="yes" on the shortcode/block.', 'meowtarot-tarot-widget' ); ?>
						</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}
