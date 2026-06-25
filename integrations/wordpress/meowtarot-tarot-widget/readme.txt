=== MeowTarot — Free Tarot Widget ===
Contributors: meowtarot
Tags: tarot, fortune telling, divination, oracle, widget
Requires at least: 5.8
Tested up to: 6.5
Requires PHP: 7.2
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Add a free, cute cat-themed tarot card draw to your site — single card or a Past · Present · Future spread. Shortcode + block. English & Thai.

== Description ==

MeowTarot — Free Tarot Widget lets you drop an interactive tarot card draw onto any page or post. Visitors pick a spread (a single card, or a 3-card Past · Present · Future reading), draw, and each card links through to its full meaning.

* Two spreads: **Single Card** and **Past · Present · Future**.
* Works as a **shortcode** `[meowtarot_tarot]` or a **block** ("MeowTarot Tarot Widget").
* **English & Thai** — auto-detects your site language, or set it per instance.
* Lightweight: a single lazy-loaded iframe, nothing heavy added to your pages.
* Free, with a small attribution link back to MeowTarot.

= Shortcode usage =

`[meowtarot_tarot]` — single card, auto language.
`[meowtarot_tarot spread="three"]` — Past · Present · Future.
`[meowtarot_tarot spread="three" lang="th" height="640"]` — Thai, taller.

Attributes: `spread` (one|three), `lang` (auto|en|th), `height` (px), `width` (px).

== Installation ==

1. Upload the plugin zip via **Plugins → Add New → Upload Plugin**, or copy the `meowtarot-tarot-widget` folder to `wp-content/plugins/`.
2. **Activate** the plugin.
3. Add the `[meowtarot_tarot]` shortcode to any page/post, or insert the **MeowTarot Tarot Widget** block and pick a spread in the sidebar.

== Frequently Asked Questions ==

= Is it really free? =
Yes. The widget loads from meowtarot.com and includes a small attribution link. Please keep the link — that is what keeps it free.

= Will it slow down my site? =
No. It is a single lazy-loaded iframe, so it only loads when scrolled into view and adds no heavy scripts to your page.

= Can I show it in Thai? =
Yes. Set `lang="th"` on the shortcode/block, or leave it on "auto" and it follows your site language.

== Changelog ==

= 1.0.0 =
* Initial release: shortcode + block, Single and Past · Present · Future spreads, English & Thai.
