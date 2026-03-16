# Kindle CSV インポートスクリプト

Amazonのデータエクスポートから `data/books.json` を生成するスクリプト群です。

## 全体の流れ

```
1. Amazonにデータをリクエスト（数日かかる）
2. import-kindle-csv.mjs でセッションデータをインポート
3. fetch-titles.mjs でタイトル・著者名を自動取得
4. fetch-metadata.mjs でISBN・総ページ数を取得
5. fetch-covers.mjs で表紙画像URLを取得
6. 必要に応じて手動で補完（Google Sheets活用等）
```

## 1. Amazonからデータをリクエスト

1. [Amazon データリクエストページ](https://www.amazon.co.jp/hz/privacy-central/data-requests/preview.html) にアクセス
2. **「Kindle」** カテゴリを選択してリクエストを送信
3. 確認メールが届くのでリンクをクリック
4. **数日後**にダウンロードリンク付きのメールが届く

## 2. セッションデータをインポート

ダウンロードしたKindleフォルダを指定するだけでCSVファイルを自動検出します。

```bash
# Kindleフォルダを指定（推奨）
node scripts/import-kindle-csv.mjs --kindle-dir ~/Downloads/Kindle

# 既存の books.json に追記する場合
node scripts/import-kindle-csv.mjs --kindle-dir ~/Downloads/Kindle --merge
```

個別にファイルを指定することもできます。

```bash
node scripts/import-kindle-csv.mjs \
  --sessions path/to/Kindle.Devices.ReadingSession/Kindle.Devices.ReadingSession.csv \
  --orders path/to/Kindle.UnifiedLibraryIndex/datasets/Kindle.UnifiedLibraryIndex.CustomerOrders_FE/Kindle.UnifiedLibraryIndex.CustomerOrders_FE.csv
```

### 使用するファイル

| ファイル | 内容 |
|---------|------|
| `Kindle.Devices.ReadingSession/Kindle.Devices.ReadingSession.csv` | 読書セッション（日時・読書時間・ページめくり数） |
| `Kindle.UnifiedLibraryIndex/.../CustomerOrders_FE.csv` | 購入済み書籍のタイトル（一部のみ） |

### ReadingSession.csv のカラム

| カラム | 内容 |
|--------|------|
| `ASIN` | 本の識別子 |
| `start_timestamp` | セッション開始日時 |
| `end_timestamp` | セッション終了日時 |
| `total_reading_millis` | 読書時間（ミリ秒） |
| `number_of_page_flips` | めくったページ数 |
| `device_family` | デバイス種別 |
| `content_type` | コンテンツ種別 |

### オプション

| オプション | 必須 | 説明 |
|-----------|------|------|
| `--kindle-dir <path>` | * | ダウンロードしたKindleフォルダのパス |
| `--sessions <path>` | * | ReadingSession.csv のパス（個別指定時） |
| `--orders <path>` | No | CustomerOrders_FE.csv のパス（タイトル取得用） |
| `--merge` | No | 既存の books.json とマージする |

`--kindle-dir` または `--sessions` のいずれかが必須です。

## 3. タイトル・著者名を取得

インポート後、タイトルが不明な本についてAmazon.co.jpの商品ページからタイトルと著者名を自動取得します。

```bash
# 実行（タイトル不明の本のみ対象）
node scripts/fetch-titles.mjs

# まず確認だけしたい場合（変更を保存しない）
node scripts/fetch-titles.mjs --dry-run

# 全ての本を対象にする（著者名の補完等）
node scripts/fetch-titles.mjs --all
```

451冊の場合、デフォルトの待機時間（2秒）で約15分かかります。

### オプション

| オプション | 説明 |
|-----------|------|
| `--dry-run` | 変更を保存せずに結果だけ表示 |
| `--all` | タイトル不明の本だけでなく全ての本を対象にする |
| `--delay <ms>` | リクエスト間の待機時間（ミリ秒）。デフォルト: 2000 |

## 4. ISBN・総ページ数を取得

タイトルが判明している本について、国立国会図書館（NDL）検索APIとGoogle Books APIからISBN・総ページ数を自動取得します。

```bash
# 実行（ISBN/ページ数が未設定の本のみ対象）
node scripts/fetch-metadata.mjs

# 確認だけ（保存しない）
node scripts/fetch-metadata.mjs --dry-run

# 全ての本を対象にする
node scripts/fetch-metadata.mjs --all
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--dry-run` | 変更を保存せずに結果だけ表示 |
| `--all` | ISBN/ページ数がある本も含め全て対象にする |
| `--delay <ms>` | リクエスト間の待機時間（ミリ秒）。デフォルト: 1000 |

ISBNが設定されると、表紙画像が国立国会図書館のサムネイルAPIから自動取得されます。

## 5. 表紙画像URLを取得

タイトルが判明している本について、Google Books APIから表紙画像URLを取得します。

```bash
# 実行（coverURLが未設定の本のみ対象）
node scripts/fetch-covers.mjs

# 確認だけ（保存しない）
node scripts/fetch-covers.mjs --dry-run

# 全ての本を対象にする
node scripts/fetch-covers.mjs --all
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--dry-run` | 変更を保存せずに結果だけ表示 |
| `--all` | coverUrlがある本も含め全て対象にする |
| `--delay <ms>` | リクエスト間の待機時間（ミリ秒）。デフォルト: 500 |

### 表紙画像の解決順序

アプリは以下の優先順位で表紙画像を表示します。

1. **ISBN** → OpenBD API → NDL サムネイルAPI（`ndlsearch.ndl.go.jp/thumbnail/{ISBN}.jpg`）
2. **coverUrl**（Google Books等の外部URL）
3. **プレースホルダー画像**（`public/placeholder-cover.svg`）

## 6. 手動で補完する

### Google Sheetsを使ったタイトル一括取得

Amazonのスクレイピングがブロックされてタイトルを自動取得できない場合、Google SheetsのIMPORTXML関数で取得できます。

#### 準備

タイトル未取得のASIN一覧をTSV形式で出力します。

```bash
node -e "
const data = JSON.parse(require('fs').readFileSync('data/books.json','utf-8'));
const targets = data.books.filter(b =>
  b.asin && (!b.title || b.title.startsWith('不明') || b.title === 'Amazon.co.jp')
);
console.log(['ASIN', 'URL', 'タイトル', '著者'].join('\t'));
targets.forEach((b, i) => {
  const row = i + 2;
  const url = 'https://www.amazon.co.jp/dp/' + b.asin;
  const t = '=IFERROR(IMPORTXML(B'+row+',\"//span[@id=\'ebooksProductTitle\']\"),IFERROR(IMPORTXML(B'+row+',\"//span[@id=\'productTitle\']\"),\"\"))';
  const a = '=IFERROR(IMPORTXML(B'+row+',\"//div[@id=\'bylineInfo\']//span[contains(@class,\'author\')]//a\"),\"\")';
  console.log([b.asin, url, t, a].join('\t'));
});
" > data/import-asins.tsv
```

#### 手順

1. Google Sheetsで新しいスプレッドシートを作成
2. `data/import-asins.tsv` の内容をコピーしてA1セルに貼り付け
3. 貼り付け時に「テキストを列に分割」→ 区切り文字「タブ」を選択
4. C列・D列のIMPORTXML数式が自動的にAmazonからタイトル・著者を取得

#### 注意事項

- **IMPORTXML は1シートあたり50個まで**の制限があります。各行で2つの数式を使うため、**1シートにつき25件まで**が上限です
- 大量に貼り付けるとエラーになります。25件ずつ処理してください
- Amazonにブロックされると `#N/A` になります。時間をおいて再試行してください
- 結果が出たら**値として貼り付け**（Ctrl+Shift+V / Cmd+Shift+V）で固定してから、次の25件に進んでください

#### 結果の反映

スプレッドシートでタイトル・著者が取得できたら、結果をコピーして以下を実行します。
タイトル反映 → ISBN・ページ数取得 → 表紙画像取得 を一括で行います。

```bash
# クリップボードから一括反映（推奨）
pbpaste | ./scripts/import-and-enrich.sh

# TSVファイルから一括反映
./scripts/import-and-enrich.sh data/result.tsv

# まず確認だけしたい場合
pbpaste | ./scripts/import-and-enrich.sh --dry-run
```

入力TSVは以下のいずれかの形式に対応しています（タブ区切り）。

| 形式 | 列 |
|------|-----|
| 3列 | ASIN, タイトル, 著者 |
| 4列 | ASIN, URL, タイトル, 著者 |

ヘッダー行や `#N/A`（IMPORTXML失敗）は自動的にスキップされます。

各ステップを個別に実行することもできます。

```bash
# 1. タイトル・著者の反映のみ
pbpaste | node scripts/import-titles-tsv.mjs -

# 2. ISBN・ページ数の取得のみ
node scripts/fetch-metadata.mjs

# 3. 表紙画像URLの取得のみ
node scripts/fetch-covers.mjs
```

### ISBN

自動取得できなかった場合、ISBNを手動で追加できます。
Amazonの商品ページの「登録情報」欄、または本の奥付で確認できます。

```json
"isbn": "9784000000000"
```

### currentPage の精度について

`currentPage` はページめくり数（`number_of_page_flips`）の累計から算出しています。
ページめくりには戻る操作も含まれるため、実際のページ番号とは異なる場合があります。
気になる場合はKindleアプリで実際のページ数を確認して修正してください。
