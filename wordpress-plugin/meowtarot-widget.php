<?php
/**
 * Plugin Name: MeowTarot Daily Card Widget
 * Plugin URI: https://meowtarot.com/widgets
 * Description: Embeds a beautiful, interactive Daily Cat Tarot card reading into your WordPress site using the [meowtarot_daily_card] shortcode.
 * Version: 1.0.0
 * Author: MeowTarot
 * Author URI: https://meowtarot.com
 * License: GPL2
 */

// Prevent direct access to the file
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Register the shortcode [meowtarot_daily_card]
 */
function meowtarot_daily_card_shortcode( $atts ) {
    // Optional attributes (e.g., width, height)
    $atts = shortcode_atts( array(
        'width'  => '100%',
        'height' => '600px',
        'theme'  => 'light'
    ), $atts, 'meowtarot_daily_card' );

    $width = esc_attr( $atts['width'] );
    $height = esc_attr( $atts['height'] );
    $theme = esc_attr( $atts['theme'] );

    // Build the iframe HTML with the hardcoded backlink for SEO
    $output = '<div class="meowtarot-widget-container" style="width: ' . $width . '; max-width: 400px; margin: 0 auto; text-align: center;">';
    $output .= '<iframe src="https://meowtarot.com/widget.html?theme=' . $theme . '" width="100%" height="' . $height . '" frameborder="0" scrolling="no" style="border:none; overflow:hidden; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></iframe>';
    $output .= '<div style="font-size: 11px; margin-top: 8px; color: #666; font-family: sans-serif;">';
    $output .= 'Free Daily Tarot by <a href="https://meowtarot.com" target="_blank" style="color: #d4a373; text-decoration: none; font-weight: bold;">MeowTarot</a>';
    $output .= '</div>';
    $output .= '</div>';

    return $output;
}

add_shortcode( 'meowtarot_daily_card', 'meowtarot_daily_card_shortcode' );

/**
 * Register a basic WordPress Sidebar Widget for users who don't use shortcodes
 */
class MeowTarot_Sidebar_Widget extends WP_Widget {

    function __construct() {
        parent::__construct(
            'meowtarot_sidebar_widget',
            'MeowTarot Daily Card',
            array( 'description' => 'A beautifully animated Daily Cat Tarot card pull.' )
        );
    }

    public function widget( $args, $instance ) {
        echo $args['before_widget'];
        if ( ! empty( $instance['title'] ) ) {
            echo $args['before_title'] . apply_filters( 'widget_title', $instance['title'] ) . $args['after_title'];
        }
        // Echo the shortcode output
        echo do_shortcode('[meowtarot_daily_card]');
        echo $args['after_widget'];
    }

    public function form( $instance ) {
        $title = ! empty( $instance['title'] ) ? $instance['title'] : 'Daily Cat Tarot';
        ?>
        <p>
            <label for="<?php echo esc_attr( $this->get_field_id( 'title' ) ); ?>">Title:</label>
            <input class="widefat" id="<?php echo esc_attr( $this->get_field_id( 'title' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'title' ) ); ?>" type="text" value="<?php echo esc_attr( $title ); ?>">
        </p>
        <?php
    }

    public function update( $new_instance, $old_instance ) {
        $instance = array();
        $instance['title'] = ( ! empty( $new_instance['title'] ) ) ? strip_tags( $new_instance['title'] ) : '';
        return $instance;
    }
}

function register_meowtarot_widget() {
    register_widget( 'MeowTarot_Sidebar_Widget' );
}
add_action( 'widgets_init', 'register_meowtarot_widget' );
