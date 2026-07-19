# Research Network — 統合版（48体、v0.1の16体＋拡張群32体）

`monster-designs-draft.md`(v0.1、16体)と`monster-designs-expansion-draft.md`(拡張群、32体)の研究元/研究先を突き合わせ、矛盾を解消した統合マスターです。両ファイルの該当行はこの内容に合わせて更新済みです。

## この作業でやったこと

前回時点では、各モンスターの「研究元」欄は書いた本人(私)が意図を持って埋めていましたが、対応する「研究先」欄への反映を毎回はしておらず、後から書いたモンスターほど整合が崩れていました。今回、スクリプトで全48ノードの研究元/研究先を突き合わせ、以下を機械的に検出・修正しました。

- 非対称エッジ(片方だけに書かれている関係): 26箇所
- 起点数の目安(1〜3)超過: 終焉の亡霊王が4件→3件に調整(疫病鴉からの直接リンクを削除。疫病鴉の影響は疫病提督経由で伝わるため実害なし)
- 研究元の記載ミス: 共鳴の賢者(誤って古歯車と記載→正しくは号令蜂)、深淵の主(誤って沼主・雷蜘蛛と記載→正しくは卵守り・沼主)
- 派生数の目安(3〜5)超過: 苔芽が6件→5件に調整(灯精の起点を苔芽から苔癒しへ変更)

検証の結果、**エラーなし**（全エッジ双方向整合、自己参照なし、起点0〜3件、派生0〜5件）です。

## 全体構造

- 起点（研究元なし、R1）: 6件 — 草牙ネズミ、風羽虫、苔芽、泥殻虫、火種トカゲ、古歯車
- 終端（研究先なし）: 7件 — 災炎翼竜(火)、極光神獣(光)、深海王(水)、大地の巨神(地)、終焉の亡霊王(闇)、嵐の支配者(風)、引力の魔女(スライス外の暫定終端)
- 引力の魔女のみ、明確な後継先が今回の48体の中に見つからず、意図的に開いたままにしています(将来拡張候補)

| No | 名称 | ID | レア度 | 属性 | 研究元 | 研究先 |
|---|---|---|---|---|---|---|
| 1 | 草牙ネズミ | `species.kusakiba-nezumi` | R1 | 無 | —（起点） | 疾風狼 |
| 2 | 風羽虫 | `species.kazane-mushi` | R1 | 風 | —（起点） | 火花鳥、毒針蛾、霧妖、電鰻 |
| 3 | 苔芽 | `species.koke-me` | R1 | 水 | —（起点） | 苔癒し、風樹祭司、卵守り、蔦絡み、光蝶 |
| 4 | 泥殻虫 | `species.dei-kakumushi` | R1 | 地 | —（起点） | 岩甲虫、鉄角獣、甲殻の守護者 |
| 5 | 火種トカゲ | `species.hidane-tokage` | R1 | 火 | —（起点） | 炎機兵、溶岩甲獣、毒針蛾、呪蛙 |
| 6 | 古歯車 | `species.furu-haguruma` | R1 | 無 | —（起点） | 号令蜂、共鳴蜂 |
| 7 | 疾風狼 | `species.shippu-rou` | R2 | 風 | 草牙ネズミ | 鉄角獣、影狩人、双牙狼 |
| 8 | 岩甲虫 | `species.ganko-mushi` | R2 | 地 | 泥殻虫 | 溶岩甲獣、聖獣の番、甲殻の守護者 |
| 9 | 火花鳥 | `species.hibana-dori` | R2 | 火 | 風羽虫 | 炎機兵、風樹祭司 |
| 10 | 苔癒し | `species.koke-iyashi` | R2 | 水 | 苔芽 | 風樹祭司、浄化の巫女、灯精 |
| 11 | 鉄角獣 | `species.tekkaku-ju` | R3 | 地 | 疾風狼、泥殻虫 | 溶岩甲獣、磁蟹 |
| 12 | 毒針蛾 | `species.dokubari-ga` | R3 | 闇 | 風羽虫、火種トカゲ | 影渡り、疫病鴉 |
| 13 | 炎機兵 | `species.enkihei` | R3 | 火 | 火花鳥、火種トカゲ | 災炎翼竜、骨の弓兵 |
| 14 | 溶岩甲獣 | `species.yogan-koju` | R4 | 火 | 岩甲虫、鉄角獣、火種トカゲ | 災炎翼竜 |
| 15 | 風樹祭司 | `species.fuju-saishi` | R4 | 風 | 苔芽、火花鳥、苔癒し | 災炎翼竜、大蘇生樹 |
| 16 | 災炎翼竜 | `species.saien-yokuryu` | R5 | 火 | 炎機兵、溶岩甲獣、風樹祭司 | —（終端） |
| 17 | 磁蟹 | `species.jisei-gani` | R2 | 地 | 鉄角獣 | 磁界竜、引力の魔女 |
| 18 | 灯精 | `species.tousei` | R2 | 光 | 苔癒し | 大蘇生樹、聖獣の番 |
| 19 | 卵守り | `species.tamagomori` | R2 | 水 | 苔芽 | 深淵の主、沼主、疫病提督 |
| 20 | 霧妖 | `species.kiriyou` | R2 | 闇 | 風羽虫 | 引力の魔女、骨の弓兵 |
| 21 | 蔦絡み | `species.tsutagarami` | R2 | 風 | 苔芽 | 沼主、雷蜘蛛 |
| 22 | 呪蛙 | `species.noroi-gaeru` | R2 | 闇 | 火種トカゲ | 疫病鴉 |
| 23 | 号令蜂 | `species.gourei-bachi` | R2 | 風 | 古歯車 | 共鳴の賢者、共鳴蜂 |
| 24 | 電鰻 | `species.den-unagi` | R2 | 水 | 風羽虫 | 深淵の主、雷蜘蛛、双牙狼 |
| 25 | 影渡り | `species.kagewatari` | R2 | 闇 | 毒針蛾 | 鏡影の刺客、影狩人 |
| 26 | 光蝶 | `species.hikari-chou` | R2 | 光 | 苔芽 | 浄化の巫女 |
| 27 | 引力の魔女 | `species.inryoku-no-majo` | R3 | 闇 | 磁蟹、霧妖 | —（終端） |
| 28 | 聖獣の番 | `species.seiju-no-tsugai` | R3 | 光 | 灯精、岩甲虫 | 極光神獣 |
| 29 | 沼主 | `species.numanushi` | R3 | 水 | 卵守り、蔦絡み | 深海王、深淵の主 |
| 30 | 疫病鴉 | `species.ekibyou-garasu` | R3 | 闇 | 呪蛙、毒針蛾 | 疫病提督 |
| 31 | 共鳴蜂 | `species.kyoumei-bachi` | R3 | 風 | 号令蜂、古歯車 | 共鳴の賢者 |
| 32 | 雷蜘蛛 | `species.raigumo` | R3 | 水 | 電鰻、蔦絡み | 深海王 |
| 33 | 影狩人 | `species.kagekariudo` | R3 | 闇 | 影渡り、疾風狼 | 鏡影の刺客 |
| 34 | 浄化の巫女 | `species.jouka-no-miko` | R3 | 光 | 光蝶、苔癒し | 大蘇生樹、極光神獣 |
| 35 | 甲殻の守護者 | `species.koukaku-no-shugosha` | R3 | 地 | 岩甲虫、泥殻虫 | 磁界竜、大地の巨神 |
| 36 | 骨の弓兵 | `species.hone-no-kyuuhei` | R3 | 闇 | 炎機兵、霧妖 | 終焉の亡霊王 |
| 37 | 双牙狼 | `species.souga-rou` | R3 | 風 | 疾風狼、電鰻 | 嵐の支配者 |
| 38 | 大蘇生樹 | `species.dai-sosei-ju` | R4 | 光 | 灯精、浄化の巫女、風樹祭司 | 極光神獣 |
| 39 | 磁界竜 | `species.jikai-ryu` | R4 | 地 | 磁蟹、甲殻の守護者 | 大地の巨神 |
| 40 | 疫病提督 | `species.ekibyou-teitoku` | R4 | 闇 | 疫病鴉、卵守り | 終焉の亡霊王 |
| 41 | 共鳴の賢者 | `species.kyoumei-no-kenja` | R4 | 風 | 共鳴蜂、号令蜂 | 嵐の支配者 |
| 42 | 深淵の主 | `species.shinen-no-nushi` | R4 | 水 | 卵守り、電鰻、沼主 | 深海王 |
| 43 | 鏡影の刺客 | `species.kyouei-no-shikaku` | R4 | 闇 | 影狩人、影渡り | 終焉の亡霊王 |
| 44 | 極光神獣 | `species.kyokkou-shinju` | R5 | 光 | 聖獣の番、大蘇生樹、浄化の巫女 | —（終端） |
| 45 | 深海王 | `species.shinkai-ou` | R5 | 水 | 沼主、深淵の主、雷蜘蛛 | —（終端） |
| 46 | 大地の巨神 | `species.daichi-no-kyoshin` | R5 | 地 | 磁界竜、甲殻の守護者 | —（終端） |
| 47 | 終焉の亡霊王 | `species.shuen-no-bourei-ou` | R5 | 闇 | 疫病提督、骨の弓兵、鏡影の刺客 | —（終端） |
| 48 | 嵐の支配者 | `species.arashi-no-shihaisha` | R5 | 風 | 共鳴の賢者、双牙狼 | —（終端） |

## レア度別フロー(概要)

```
R1(6, 起点)
  草牙ネズミ→疾風狼    風羽虫→火花鳥/毒針蛾/霧妖/電鰻    苔芽→苔癒し/風樹祭司/卵守り/蔦絡み/光蝶
  泥殻虫→岩甲虫/鉄角獣/甲殻の守護者    火種トカゲ→炎機兵/溶岩甲獣/毒針蛾/呪蛙    古歯車→号令蜂/共鳴蜂

R2(14, 専門特化)
  既存4(疾風狼・岩甲虫・火花鳥・苔癒し) + 新規10(磁蟹・灯精・卵守り・霧妖・蔦絡み・呪蛙・号令蜂・電鰻・影渡り・光蝶)

R3(14, 複数要素の組み合わせ)
  既存3(鉄角獣・毒針蛾・炎機兵) + 新規11(引力の魔女・聖獣の番・沼主・疫病鴉・共鳴蜂・雷蜘蛛・影狩人・浄化の巫女・甲殻の守護者・骨の弓兵・双牙狼)

R4(8, 編成中核候補)
  既存2(溶岩甲獣・風樹祭司) + 新規6(大蘇生樹・磁界竜・疫病提督・共鳴の賢者・深淵の主・鏡影の刺客)

R5(6, 属性ごとの到達点)
  火=災炎翼竜(既存)  光=極光神獣  水=深海王  地=大地の巨神  闇=終焉の亡霊王  風=嵐の支配者
```

## 将来実装向けデータ（そのままコードに落とし込める形）

docs16のスキーマがまだ研究網ノード自体の型を定義していないため確定インターフェースではありませんが、実装時の下敷きとして使える形にしています。IDはすべて既存の`species.xxx`と一致させています。

```ts
export const RESEARCH_NETWORK_DRAFT: ReadonlyArray<{
  id: string; rarity: string; origins: readonly string[]; destinations: readonly string[]
}> = [
  { id: "species.kusakiba-nezumi", rarity: "R1", origins: [], destinations: ["species.shippu-rou"] }, // 草牙ネズミ
  { id: "species.kazane-mushi", rarity: "R1", origins: [], destinations: ["species.hibana-dori", "species.dokubari-ga", "species.kiriyou", "species.den-unagi"] }, // 風羽虫
  { id: "species.koke-me", rarity: "R1", origins: [], destinations: ["species.koke-iyashi", "species.fuju-saishi", "species.tamagomori", "species.tsutagarami", "species.hikari-chou"] }, // 苔芽
  { id: "species.dei-kakumushi", rarity: "R1", origins: [], destinations: ["species.ganko-mushi", "species.tekkaku-ju", "species.koukaku-no-shugosha"] }, // 泥殻虫
  { id: "species.hidane-tokage", rarity: "R1", origins: [], destinations: ["species.enkihei", "species.yogan-koju", "species.dokubari-ga", "species.noroi-gaeru"] }, // 火種トカゲ
  { id: "species.furu-haguruma", rarity: "R1", origins: [], destinations: ["species.gourei-bachi", "species.kyoumei-bachi"] }, // 古歯車
  { id: "species.shippu-rou", rarity: "R2", origins: ["species.kusakiba-nezumi"], destinations: ["species.tekkaku-ju", "species.kagekariudo", "species.souga-rou"] }, // 疾風狼
  { id: "species.ganko-mushi", rarity: "R2", origins: ["species.dei-kakumushi"], destinations: ["species.yogan-koju", "species.seiju-no-tsugai", "species.koukaku-no-shugosha"] }, // 岩甲虫
  { id: "species.hibana-dori", rarity: "R2", origins: ["species.kazane-mushi"], destinations: ["species.enkihei", "species.fuju-saishi"] }, // 火花鳥
  { id: "species.koke-iyashi", rarity: "R2", origins: ["species.koke-me"], destinations: ["species.fuju-saishi", "species.jouka-no-miko", "species.tousei"] }, // 苔癒し
  { id: "species.tekkaku-ju", rarity: "R3", origins: ["species.shippu-rou", "species.dei-kakumushi"], destinations: ["species.yogan-koju", "species.jisei-gani"] }, // 鉄角獣
  { id: "species.dokubari-ga", rarity: "R3", origins: ["species.kazane-mushi", "species.hidane-tokage"], destinations: ["species.kagewatari", "species.ekibyou-garasu"] }, // 毒針蛾
  { id: "species.enkihei", rarity: "R3", origins: ["species.hibana-dori", "species.hidane-tokage"], destinations: ["species.saien-yokuryu", "species.hone-no-kyuuhei"] }, // 炎機兵
  { id: "species.yogan-koju", rarity: "R4", origins: ["species.ganko-mushi", "species.tekkaku-ju", "species.hidane-tokage"], destinations: ["species.saien-yokuryu"] }, // 溶岩甲獣
  { id: "species.fuju-saishi", rarity: "R4", origins: ["species.koke-me", "species.hibana-dori", "species.koke-iyashi"], destinations: ["species.saien-yokuryu", "species.dai-sosei-ju"] }, // 風樹祭司
  { id: "species.saien-yokuryu", rarity: "R5", origins: ["species.enkihei", "species.yogan-koju", "species.fuju-saishi"], destinations: [] }, // 災炎翼竜
  { id: "species.jisei-gani", rarity: "R2", origins: ["species.tekkaku-ju"], destinations: ["species.jikai-ryu", "species.inryoku-no-majo"] }, // 磁蟹
  { id: "species.tousei", rarity: "R2", origins: ["species.koke-iyashi"], destinations: ["species.dai-sosei-ju", "species.seiju-no-tsugai"] }, // 灯精
  { id: "species.tamagomori", rarity: "R2", origins: ["species.koke-me"], destinations: ["species.shinen-no-nushi", "species.numanushi", "species.ekibyou-teitoku"] }, // 卵守り
  { id: "species.kiriyou", rarity: "R2", origins: ["species.kazane-mushi"], destinations: ["species.inryoku-no-majo", "species.hone-no-kyuuhei"] }, // 霧妖
  { id: "species.tsutagarami", rarity: "R2", origins: ["species.koke-me"], destinations: ["species.numanushi", "species.raigumo"] }, // 蔦絡み
  { id: "species.noroi-gaeru", rarity: "R2", origins: ["species.hidane-tokage"], destinations: ["species.ekibyou-garasu"] }, // 呪蛙
  { id: "species.gourei-bachi", rarity: "R2", origins: ["species.furu-haguruma"], destinations: ["species.kyoumei-no-kenja", "species.kyoumei-bachi"] }, // 号令蜂
  { id: "species.den-unagi", rarity: "R2", origins: ["species.kazane-mushi"], destinations: ["species.shinen-no-nushi", "species.raigumo", "species.souga-rou"] }, // 電鰻
  { id: "species.kagewatari", rarity: "R2", origins: ["species.dokubari-ga"], destinations: ["species.kyouei-no-shikaku", "species.kagekariudo"] }, // 影渡り
  { id: "species.hikari-chou", rarity: "R2", origins: ["species.koke-me"], destinations: ["species.jouka-no-miko"] }, // 光蝶
  { id: "species.inryoku-no-majo", rarity: "R3", origins: ["species.jisei-gani", "species.kiriyou"], destinations: [] }, // 引力の魔女
  { id: "species.seiju-no-tsugai", rarity: "R3", origins: ["species.tousei", "species.ganko-mushi"], destinations: ["species.kyokkou-shinju"] }, // 聖獣の番
  { id: "species.numanushi", rarity: "R3", origins: ["species.tamagomori", "species.tsutagarami"], destinations: ["species.shinkai-ou", "species.shinen-no-nushi"] }, // 沼主
  { id: "species.ekibyou-garasu", rarity: "R3", origins: ["species.noroi-gaeru", "species.dokubari-ga"], destinations: ["species.ekibyou-teitoku"] }, // 疫病鴉
  { id: "species.kyoumei-bachi", rarity: "R3", origins: ["species.gourei-bachi", "species.furu-haguruma"], destinations: ["species.kyoumei-no-kenja"] }, // 共鳴蜂
  { id: "species.raigumo", rarity: "R3", origins: ["species.den-unagi", "species.tsutagarami"], destinations: ["species.shinkai-ou"] }, // 雷蜘蛛
  { id: "species.kagekariudo", rarity: "R3", origins: ["species.kagewatari", "species.shippu-rou"], destinations: ["species.kyouei-no-shikaku"] }, // 影狩人
  { id: "species.jouka-no-miko", rarity: "R3", origins: ["species.hikari-chou", "species.koke-iyashi"], destinations: ["species.dai-sosei-ju", "species.kyokkou-shinju"] }, // 浄化の巫女
  { id: "species.koukaku-no-shugosha", rarity: "R3", origins: ["species.ganko-mushi", "species.dei-kakumushi"], destinations: ["species.jikai-ryu", "species.daichi-no-kyoshin"] }, // 甲殻の守護者
  { id: "species.hone-no-kyuuhei", rarity: "R3", origins: ["species.enkihei", "species.kiriyou"], destinations: ["species.shuen-no-bourei-ou"] }, // 骨の弓兵
  { id: "species.souga-rou", rarity: "R3", origins: ["species.shippu-rou", "species.den-unagi"], destinations: ["species.arashi-no-shihaisha"] }, // 双牙狼
  { id: "species.dai-sosei-ju", rarity: "R4", origins: ["species.tousei", "species.jouka-no-miko", "species.fuju-saishi"], destinations: ["species.kyokkou-shinju"] }, // 大蘇生樹
  { id: "species.jikai-ryu", rarity: "R4", origins: ["species.jisei-gani", "species.koukaku-no-shugosha"], destinations: ["species.daichi-no-kyoshin"] }, // 磁界竜
  { id: "species.ekibyou-teitoku", rarity: "R4", origins: ["species.ekibyou-garasu", "species.tamagomori"], destinations: ["species.shuen-no-bourei-ou"] }, // 疫病提督
  { id: "species.kyoumei-no-kenja", rarity: "R4", origins: ["species.kyoumei-bachi", "species.gourei-bachi"], destinations: ["species.arashi-no-shihaisha"] }, // 共鳴の賢者
  { id: "species.shinen-no-nushi", rarity: "R4", origins: ["species.tamagomori", "species.den-unagi", "species.numanushi"], destinations: ["species.shinkai-ou"] }, // 深淵の主
  { id: "species.kyouei-no-shikaku", rarity: "R4", origins: ["species.kagekariudo", "species.kagewatari"], destinations: ["species.shuen-no-bourei-ou"] }, // 鏡影の刺客
  { id: "species.kyokkou-shinju", rarity: "R5", origins: ["species.seiju-no-tsugai", "species.dai-sosei-ju", "species.jouka-no-miko"], destinations: [] }, // 極光神獣
  { id: "species.shinkai-ou", rarity: "R5", origins: ["species.numanushi", "species.shinen-no-nushi", "species.raigumo"], destinations: [] }, // 深海王
  { id: "species.daichi-no-kyoshin", rarity: "R5", origins: ["species.jikai-ryu", "species.koukaku-no-shugosha"], destinations: [] }, // 大地の巨神
  { id: "species.shuen-no-bourei-ou", rarity: "R5", origins: ["species.ekibyou-teitoku", "species.hone-no-kyuuhei", "species.kyouei-no-shikaku"], destinations: [] }, // 終焉の亡霊王
  { id: "species.arashi-no-shihaisha", rarity: "R5", origins: ["species.kyoumei-no-kenja", "species.souga-rou"], destinations: [] }, // 嵐の支配者
]
```

## 未解決・後々やること

- 引力の魔女の後継先が未定。今後さらに拡張する際、闇属性の別ラインとして回収する想定
- レシピ本体(触媒名・消費個体・研究データ量・開示段階・ヒント文)はdocs09の目安に沿う想定でまだ作成していません。Phase6(T034〜T037)着手時、またはそれ以前の設計フェーズで別途必要です
- クレンズ効果(光蝶・浄化の巫女)が既存の効果登録・解除機構だけで実装できるかは、T044(または該当タスク)着手時に確認してください
- 種族の演出方針(水棲・霊体・不死・魔族・神獣の見た目の傾向)は未定です
- 48体の数値(ステータス・技コスト・威力)は概算です。T046のバランスシミュレーションで実測・調整が前提です
