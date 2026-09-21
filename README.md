# ŞAK Almanya Website

`sakalmanya.com.tr` için statik sayfalar ve Vercel Free uyumlu serverless üniversite API'si.

## Dosyalar

- `index.html`: Site içeriği ve SEO etiketleri
- `styles.css`: Tasarım, mobil uyum ve renk sistemi
- `script.js`: Yıl bilgisi, menü ve sayfa etkileşimleri
- `api/universities.js`: Sayfalı üniversite kartları ve tekil detay sayfaları
- `scripts/build-university-api.py`: `sakalmanya_uni_dataset.xlsx` dosyasını kontrollü API çıktısına dönüştüren derleme aracı
- `assets/hero-germany-study.png`: Yerel hero görseli
- `assets/belgeler/`: Almanca sınav belgeleri ve okul kabulleri için klasör

## Yayına Almadan Önce

1. Dataset güncellendiğinde dosya adını `sakalmanya_uni_dataset.xlsx` olarak koru.
2. Derleme aracını çalıştır; Excel dosyasını repoya veya public klasöre ekleme.
3. Değişiklikleri `main` dalına gönder; Vercel statik sayfaları ve API fonksiyonunu birlikte yayınlar.

İletişim bağlantıları `iletisim@andaykahveci.com` e-posta adresine yönlendirilir.
