# ŞAK Almanya Website

`sakalmanya.com.tr` için statik sayfalar ve Vercel Free uyumlu serverless üniversite API'si.

## Dosyalar

- `index.html`: Site içeriği ve SEO etiketleri
- `styles.css`: Tasarım, mobil uyum ve renk sistemi
- `script.js`: Yıl bilgisi, menü ve sayfa etkileşimleri
- `contact.js`: TR/DE/EN iletişim formlarının doğrulama ve gönderim durumları
- `api/universities.js`: Sayfalı üniversite kartları ve tekil detay sayfaları
- `scripts/build-university-api.py`: `sakalmanya_uni_dataset.xlsx` dosyasını kontrollü API çıktısına dönüştüren derleme aracı
- `assets/hero-germany-study.png`: Yerel hero görseli
- `assets/belgeler/`: Almanca sınav belgeleri ve okul kabulleri için klasör

## Yayına Almadan Önce

1. Dataset güncellendiğinde dosya adını `sakalmanya_uni_dataset.xlsx` olarak koru.
2. Derleme aracını çalıştır; Excel dosyasını repoya veya public klasöre ekleme.
3. Değişiklikleri `main` dalına gönder; Vercel statik sayfaları ve API fonksiyonunu birlikte yayınlar.

İletişim bağlantıları `iletisim@andaykahveci.com` e-posta adresine yönlendirilir.

## İletişim formu

Ana sayfaların İletişim bölümündeki form FormSubmit üzerinden `iletisim@andaykahveci.com` adresine gönderilir. JavaScript açıkken AJAX kullanılır; JavaScript kapalıyken standart POST ve sağlayıcının doğrulama ekranı devreye girer. Form ad-soyad, e-posta, eğitim seviyesi (lise/lisans/master), danışmanlık hizmeti (lisans/master/Almanca dersi), isteğe bağlı Almanca seviyesi, mesaj ve onay içerir; telefon alanı yoktur.

Canlı kullanım öncesinde alıcı adresini FormSubmit ile doğrulamak gerekir. İlk gönderimin ardından bu adrese gelen aktivasyon bağlantısı hesap sahibi tarafından onaylanmalıdır. Daha sonra gerçek bir gönderimin gelen kutusuna ulaştığı doğrulanmalıdır. Yerel otomatik kontroller sağlayıcı yanıtlarını taklit eder; canlı teslimatı kanıtlamaz.

Gönderim hatasında alanlar korunur ve doğrudan e-posta bağlantısı kullanılabilir. Form verileri Analytics veya tarayıcı depolamasına yazılmaz.
