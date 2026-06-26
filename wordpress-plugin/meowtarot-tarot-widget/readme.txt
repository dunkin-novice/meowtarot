=== MeowTarot Tarot Widget ===
Contributors: dunkinkr
Tags: tarot, fortune telling, divination, oracle, widget
Requires at least: 5.8
Tested up to: 7.0
Requires PHP: 7.2
Stable tag: 1.2.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Add a free, cute cat-themed tarot card draw to your site — single card or a Past · Present · Future spread. Shortcode, block, or sidebar widget. English & Thai.

== Description ==

MeowTarot Tarot Widget lets you drop a free, interactive tarot card draw onto any page, post, or sidebar. Visitors pick a spread (a single card, or a 3-card Past · Present · Future reading), draw, and each card links through to its full meaning.

* Two spreads: **Single Card** and **Past · Present · Future**.
* Three ways to add it: **shortcode** `[meowtarot_tarot]`, a **block** ("MeowTarot Tarot Widget"), or a classic **sidebar widget**.
* **English & Thai** — auto-detects your site language, or set it per instance.
* Lightweight: a single lazy-loaded iframe, nothing heavy added to your pages.
* Free. An optional attribution link back to MeowTarot is available but **off by default** — you choose whether to show it.

= Shortcode usage =

`[meowtarot_tarot]` — single card, auto language.
`[meowtarot_tarot spread="three"]` — Past · Present · Future.
`[meowtarot_tarot spread="three" lang="th" height="640"]` — Thai, taller.

Attributes: `spread` (one|three), `lang` (auto|en|th), `height` (px), `width` (px), `attribution` (yes|no).
The legacy shortcode `[meowtarot_daily_card]` is kept as an alias.

= Attribution link (optional, off by default) =

The widget can show a small "Free Tarot Reading — MeowTarot" link below it. It is **disabled by default**. To turn it on, either:

* Tick **Settings → MeowTarot Tarot → Attribution link** (applies site-wide), or
* Add `attribution="yes"` to a shortcode, or toggle "Show attribution link" on the block.

It is entirely optional — a kind way to support the free widget, never required.

== Installation ==

1. Upload the plugin zip via **Plugins → Add New → Upload Plugin**, or copy the `meowtarot-tarot-widget` folder to `wp-content/plugins/`.
2. **Activate** the plugin.
3. Add the `[meowtarot_tarot]` shortcode to any page/post, insert the **MeowTarot Tarot Widget** block, or drop the **MeowTarot Tarot Widget** into a sidebar.

== Frequently Asked Questions ==

= Is it really free? =
Yes, completely free. The widget loads from meowtarot.com. There is an optional attribution link you can switch on if you would like to support it, but it is off by default and never required.

= Will it slow down my site? =
No. It is a single lazy-loaded iframe, so it only loads when scrolled into view and adds no heavy scripts to your page.

= Can I show it in Thai? =
Yes. Set `lang="th"` on the shortcode/block, or leave it on "auto" and it follows your site language.

== External services ==

This plugin embeds the tarot widget by loading it in an iframe from MeowTarot (https://www.meowtarot.com), a service operated by MeowTarot. The widget HTML is requested from meowtarot.com when a visitor views a page containing the widget; standard request data (such as IP address and user agent) is sent to that server as part of loading the iframe, the same as any embedded content. No personal data is collected by the plugin itself, and nothing is sent until the widget is displayed.

* Terms: https://www.meowtarot.com/terms
* Privacy Policy: https://www.meowtarot.com/privacy.html

== Changelog ==

= 1.2.1 =
* Security hardening: escape the sidebar widget title output with esc_html().

= 1.2.0 =
* The front-end attribution link is now **opt-in and off by default** (WordPress.org Guideline 10). Enable it site-wide under Settings → MeowTarot Tarot, per shortcode with `attribution="yes"`, or via the block toggle.
* Added a settings page and a "Settings" link on the Plugins screen.
* Documented the external service (iframe from meowtarot.com).
* Tested up to WordPress 7.0.

= 1.1.0 =
* Added a classic sidebar widget and a `[meowtarot_daily_card]` back-compat alias.

= 1.0.0 =
* Initial release: shortcode + block, Single and Past · Present · Future spreads, English & Thai.
