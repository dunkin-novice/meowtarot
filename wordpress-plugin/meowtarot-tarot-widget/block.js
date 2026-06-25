/* MeowTarot Tarot Widget — editor block (no build step; uses WP globals). */
( function ( blocks, element, blockEditor, components, serverSideRender, i18n ) {
	var el = element.createElement;
	var Fragment = element.Fragment;
	var __ = i18n.__;
	var InspectorControls = blockEditor.InspectorControls;
	var PanelBody = components.PanelBody;
	var SelectControl = components.SelectControl;
	var RangeControl = components.RangeControl;

	blocks.registerBlockType( 'meowtarot/tarot-widget', {
		title: __( 'MeowTarot Tarot Widget', 'meowtarot-tarot-widget' ),
		description: __( 'A free cat-themed tarot card draw (single card or Past · Present · Future spread).', 'meowtarot-tarot-widget' ),
		icon: 'star-filled',
		category: 'widgets',
		keywords: [ 'tarot', 'meowtarot', 'fortune', 'oracle' ],
		attributes: {
			spread: { type: 'string', default: 'one' },
			lang: { type: 'string', default: 'auto' },
			height: { type: 'number', default: 600 }
		},
		edit: function ( props ) {
			var a = props.attributes;
			return el(
				Fragment,
				{},
				el(
					InspectorControls,
					{},
					el(
						PanelBody,
						{ title: __( 'Widget settings', 'meowtarot-tarot-widget' ), initialOpen: true },
						el( SelectControl, {
							label: __( 'Spread', 'meowtarot-tarot-widget' ),
							value: a.spread,
							options: [
								{ label: __( 'Single card', 'meowtarot-tarot-widget' ), value: 'one' },
								{ label: __( 'Past · Present · Future', 'meowtarot-tarot-widget' ), value: 'three' }
							],
							onChange: function ( v ) { props.setAttributes( { spread: v } ); }
						} ),
						el( SelectControl, {
							label: __( 'Language', 'meowtarot-tarot-widget' ),
							value: a.lang,
							options: [
								{ label: __( 'Auto (site language)', 'meowtarot-tarot-widget' ), value: 'auto' },
								{ label: 'English', value: 'en' },
								{ label: 'ไทย (Thai)', value: 'th' }
							],
							onChange: function ( v ) { props.setAttributes( { lang: v } ); }
						} ),
						el( RangeControl, {
							label: __( 'Height (px)', 'meowtarot-tarot-widget' ),
							value: a.height,
							min: 360,
							max: 1000,
							onChange: function ( v ) { props.setAttributes( { height: v } ); }
						} )
					)
				),
				el( serverSideRender, { block: 'meowtarot/tarot-widget', attributes: a } )
			);
		},
		save: function () {
			return null; // Dynamic block — rendered in PHP.
		}
	} );
} )(
	window.wp.blocks,
	window.wp.element,
	window.wp.blockEditor,
	window.wp.components,
	window.wp.serverSideRender,
	window.wp.i18n
);
