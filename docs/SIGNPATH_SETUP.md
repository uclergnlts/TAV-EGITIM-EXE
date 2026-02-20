# SignPath OSS + GitHub Actions Kurulumu

Bu akis, `dist/*.exe` unsigned ciktilarini GitHub artifact olarak yukler ve SignPath ile imzalayip `signed-windows` artifact olarak geri alir.

## 1) On Kosullar

- Repo **public (open-source)** olmali.
- SignPath hesabin olmali.
- GitHub repo admin yetkin olmali.

## 2) GitHub Secrets/Variables

Repo ayarlarinda su degerleri ekle:

### Secret

- `SIGNPATH_API_TOKEN`: SignPath API token

### Variables

- `SIGNPATH_ORGANIZATION_ID`: SignPath organization id
- `SIGNPATH_PROJECT_SLUG`: SignPath project slug
- `SIGNPATH_SIGNING_POLICY_SLUG`: Ornek `release-signing`
- `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` (opsiyonel): SignPath tarafinda ozel artifact config kullaniyorsan

## 3) SignPath Tarafi

SignPath panelinde:

1. GitHub connector/Trusted Build ayarini bu repo icin etkinlestir.
2. Bir `Project` olustur.
3. Bir `Signing Policy` olustur (slug'i not et).
4. Gerekliyse `Artifact Configuration` olustur (slug'i not et).

## 4) Workflow Calistirma

Workflow dosyasi: `.github/workflows/signpath-oss-sign.yml`

Calistirma yollari:

- Manuel: GitHub Actions > `Sign Windows Release (SignPath OSS)` > `Run workflow`
- Otomatik: `v*` tag push edince calisir.

## 5) Sonuc

- Unsigned paket: `unsigned-windows` artifact
- Signed paket: `signed-windows` artifact

## 6) Notlar

- Workflow `electron-builder` ile Windows exe ciktisi uretiyor.
- Imza tamamlaninca signed dosyalar artifact olarak iner.
- Ilk kurulumda SignPath tarafi dogru baglanmazsa `403` veya policy/artifact config hatasi gorulebilir.
