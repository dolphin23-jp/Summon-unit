# モンスター素材 生成AI制作ガイド（叩き台16体）

Gemini等の画像生成チャットで使う想定の手順書です。プロンプト本文は画像生成モデルの精度が上がる英語で書き、説明は日本語のままにしています。

## 前提（今回確認した現状）

2026年7月時点のGemini無料枠は主に「Nano Banana 2」で、有償のGemini Advancedだと上位の「Nano Banana Pro」が使えます。今回の用途なら無料枠で十分です。同一キャラクターの一貫性を保つ方法として現状最も効くのは、**生成した画像をそのまま添付して「このスタイルを厳密に踏襲して」と明示的に指示する**ことです。テキストプロンプトの使い回しだけに頼るより、画像添付+厳密指定の方が安定します。

今回は「同じキャラを違うポーズで」ではなく「別々の16体を同じ画風で」なので、必要なのはキャラの同一性ではなく**画風の同一性**です。以下の手順はそれに合わせています。

## 手順

1. **アンカー(基準)画像を1体だけ先に作る。** 下記の「岩甲虫」あたりが複雑さ的にちょうどよい試作台です。スタイル土台プロンプト+岩甲虫の内容で3〜5回生成し、線の太さ・塗り・背景処理・情報量が気に入るものが出るまで同じチャット内で調整を繰り返します。ここで妥協しないのが一番効きます
2. **納得のいく1枚が決まったら、それを毎回添付して残り15体を作る。** プロンプトの冒頭に「添付画像の画風を厳密に維持したまま、まったく別の生物を描いてください」という指示を必ず入れます(下記テンプレートに組み込み済み)
3. **レア度順(R1→R5)にバッチで進める。** 一気に16体出すより、6→4→3→2→1で区切って都度見比べると、途中でスタイルが少しずつズレてきた場合に早く気づけます
4. **保存時のファイル名は`species.xxx`のIDに合わせる。** 実装側(Phase9)でモンスターデータと機械的に紐付けられるようにするためです。使ったプロンプトも一緒にメモしておくと、後で「あの1体だけ描き直したい」となったときに楽です
5. **16体並べて浮いている個体がないか最終チェック。** ずれていたら、その1体だけアンカー画像を添付し直して再生成します

## スタイル土台プロンプト（テンプレート、英語）

**1体目(アンカー)を作るとき:**
```
A trading-card-style creature illustration for a fantasy monster-collecting game.
Creature: {MONSTER_DESCRIPTION}
Style: three-quarter view, centered composition, single flat neutral-colored background (no scene, no environment), clean bold outlines with semi-realistic painterly shading, soft rim lighting, fantasy character design, square 1:1 image, no text, no watermark, no human figures.
```

**2体目以降(アンカー画像を添付して使う):**
```
Using the attached image strictly as the style reference — same line weight, same shading technique, same lighting, same background treatment, same level of detail — generate a completely different creature. Do not reuse the attached creature's design, only its rendering style.
Creature: {MONSTER_DESCRIPTION}
Square 1:1 image, no text, no watermark, no human figures.
```

`{MONSTER_DESCRIPTION}` に下から該当する1行を差し込んでください。

## R1（6体）

| ID | 差し込み内容 |
|---|---|
| species.kusakiba-nezumi | A small, lean rodent-like beast with sharp grass-green fangs, sinewy build for quick bursts of speed, alert crouching posture, short muted-earth-toned fur, small scythe-like claws |
| species.kazane-mushi | A slender dragonfly-like insect with elongated translucent wings, pale blue-green coloring, narrow aerodynamic body, faint wind-swirl motif on the wing membranes |
| species.koke-me | A small round moss-covered plant creature with a softly glowing blue-green bud on top like a healing light, dewdrop textures, calm passive expression |
| species.dei-kakumushi | A heavily armored beetle-like insect with a thick cracked-mud-colored shell resembling a shield, low wide immovable stance, legs barely visible under the heavy carapace |
| species.hidane-tokage | A small lizard with ember-orange scales, faint glowing cracks along its back like smoldering coals, low predatory crouch, subtle heat-haze around its body |
| species.furu-haguruma | A small clockwork automaton creature with exposed brass gears on its back and chest, simple geometric body, one glowing dial-shaped eye, friendly steampunk utility design |

## R2（4体）

| ID | 差し込み内容 |
|---|---|
| species.shippu-rou | A lean athletic wolf with wind-swept pale grey-blue fur, faint trailing wind-streak motifs behind its legs, dynamic mid-stride pose, sharp intense eyes |
| species.ganko-mushi | A stag-beetle-like insect with a polished stone-like carapace, geometric crystalline shoulder plates glowing faintly at the edges, sturdy defensive posture |
| species.hibana-dori | A mid-size bird with ember-orange and dark plumage, small spark particles trailing from its wingtips, poised hovering aiming stance, sharp focused eye |
| species.koke-iyashi | An upright mossy plant creature with softly glowing spore pods, bioluminescent blue-green veins, small floating spore particles, serene nurturing presence |

## R3（3体）

| ID | 差し込み内容 |
|---|---|
| species.tekkaku-ju | A large bulky horned beast with thick iron-grey hide, a massive battering-ram horn on its head, low centered stance, small rock chips scattered near its hooves |
| species.dokubari-ga | A dark purple moth with unsettling patterned wings, glowing sickly-green venom dripping from a needle-like tail stinger, faint toxic mist around the wingtips |
| species.enkihei | An armored mechanical soldier-type construct with a glowing orange furnace-core visible through chest vents, a long cannon-like arm, scattered embers near its feet |

## R4（2体）

| ID | 差し込み内容 |
|---|---|
| species.yogan-koju | A massive armored beast with molten-orange glowing cracks running through dark obsidian-like hide, thick protective shell plates, imposing guardian stance |
| species.fuju-saishi | A humanoid figure in flowing wind-swept robes with leaf and branch motifs, holding a branch-like staff, gentle glowing green-white aura, composed druid-like expression |

## R5（1体）

| ID | 差し込み内容 |
|---|---|
| species.saien-yokuryu | A large majestic dragon with dark scales and molten-orange glowing veins across its wings and body, wide dramatic wingspan, intense glowing eyes, ember particles trailing from the wingtips, the most detailed and powerful-looking of the set |

## 後々の「動き」について

いきなりコマ送りアニメを作る必要はありません。この構成(React+Tailwind、Vercel配信)なら、1枚絵に対してCSSトランジション/トランスフォームだけで十分「動いている」印象を作れます。

- 待機: 微妙な上下バウンス(scale/translateYの往復)
- 攻撃: 対象方向へ一瞬translateして戻る
- 被弾: brightness/opacityの一瞬点滅
- 撃破: フェードアウト+わずかな回転

これなら追加の画像生成なしで実装できます。コマ単位のスプライトアニメ(複数ポーズを描き分ける)は、画風の一貫性がさらに難しくなる別工程なので、まずCSSだけの動きを実装してから、物足りなければ検討する、という順番を勧めます。実装タイミングは前回話した通りPhase4かPhase9です。
