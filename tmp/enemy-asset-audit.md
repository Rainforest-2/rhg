# Enemy Asset Audit

Generated: 2026-05-17T14:10:20.775Z

## Actor Asset Failure Class

- ok: 718
- expected-missing: 40
- actor-bundle-not-in-manifest: 18
- neutral-animation-missing: 1
- imgcut-missing: 1

## Icon Generation Failure Class

- ok: 758
- image-or-imgcut-invalid: 18
- source-missing: 2

## Icon Composition Method

- composed-initial-pose: 739
- single-cut-degraded-fallback: 19
- failed: 18
- none: 2

## Non-Allowlisted Icon Failures

- enemy:552: image-or-imgcut-invalid; bad-png-signature
- enemy:554: image-or-imgcut-invalid; bad-png-signature
- enemy:556: image-or-imgcut-invalid; bad-png-signature
- enemy:560: image-or-imgcut-invalid; bad-png-signature
- enemy:561: image-or-imgcut-invalid; bad-png-signature
- enemy:562: image-or-imgcut-invalid; bad-png-signature
- enemy:585: image-or-imgcut-invalid; bad-png-signature
- enemy:586: image-or-imgcut-invalid; bad-png-signature
- enemy:587: image-or-imgcut-invalid; bad-png-signature
- enemy:588: image-or-imgcut-invalid; bad-png-signature
- enemy:589: image-or-imgcut-invalid; bad-png-signature
- enemy:590: source-missing; missing image/imgcut/model/neutral animation source
- enemy:591: source-missing; missing image/imgcut/model/neutral animation source
- enemy:610: image-or-imgcut-invalid; bad-png-signature
- enemy:611: image-or-imgcut-invalid; bad-png-signature
- enemy:612: image-or-imgcut-invalid; bad-png-signature
- enemy:698: image-or-imgcut-invalid; bad-png-signature
- enemy:699: image-or-imgcut-invalid; bad-png-signature
- enemy:700: image-or-imgcut-invalid; bad-png-signature
- enemy:701: image-or-imgcut-invalid; bad-png-signature

## Degraded Single-Cut Fallback

- enemy:19: composition unavailable: composed-pose-rendered-zero-parts
- enemy:284: composition unavailable: composed-pose-rendered-zero-parts
- enemy:285: composition unavailable: composed-pose-rendered-zero-parts
- enemy:286: composition unavailable: composed-pose-no-visible-parts
- enemy:287: composition unavailable: composed-pose-no-visible-parts
- enemy:288: composition unavailable: composed-pose-rendered-zero-parts
- enemy:289: composition unavailable: composed-pose-no-visible-parts
- enemy:290: composition unavailable: composed-pose-no-visible-parts
- enemy:291: composition unavailable: composed-pose-no-visible-parts
- enemy:292: composition unavailable: composed-pose-no-visible-parts
- enemy:303: composition unavailable: composed-pose-no-visible-parts
- enemy:304: composition unavailable: composed-pose-rendered-zero-parts
- enemy:425: composition unavailable: composed-pose-no-visible-parts
- enemy:427: composition unavailable: composed-pose-no-visible-parts
- enemy:428: composition unavailable: composed-pose-no-visible-parts
- enemy:468: composition unavailable: composed-pose-no-visible-parts
- enemy:469: composition unavailable: composed-pose-no-visible-parts
- enemy:512: composition unavailable: composed-pose-rendered-zero-parts
- enemy:744: composition unavailable: composed-pose-no-visible-parts

## Regression Targets

| enemy | name | asset failure | icon method | icon failure | regenerated |
| --- | --- | --- | --- | --- | --- |
| 388 | ウルトラメェメェ | ok | composed-initial-pose | ok | yes |
| 440 | レインボークマトーク | ok | composed-initial-pose | ok | yes |
| 443 | ミニスターサイクロン | ok | composed-initial-pose | ok | yes |
| 560 | デビルサイクロン | actor-bundle-not-in-manifest | failed | image-or-imgcut-invalid | no |
| 609 | 古兵器マンボロス | ok | composed-initial-pose | ok | yes |
| 610 | 超棘獣ナマケモルガ | actor-bundle-not-in-manifest | failed | image-or-imgcut-invalid | no |
| 611 | 超闇獣ダックジョー | actor-bundle-not-in-manifest | failed | image-or-imgcut-invalid | no |
| 612 | ハニワンワン | actor-bundle-not-in-manifest | failed | image-or-imgcut-invalid | no |
| 613 | 超天獣ラジャコング | ok | composed-initial-pose | ok | yes |
| 695 | 丸太 | ok | composed-initial-pose | ok | yes |
| 696 | 大岩 | ok | composed-initial-pose | ok | yes |
| 697 | ツバサターン | ok | composed-initial-pose | ok | yes |
| 699 | 生命の賢者Dr.ノーヴァ | actor-bundle-not-in-manifest | failed | image-or-imgcut-invalid | no |
