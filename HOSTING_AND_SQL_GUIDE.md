# DokanPro Enterprise ERP - হোস্টিং ও লোকালহোস্ট গাইড (Hosting & Localhost Deployment Guide)

**ডেভেলপার পরিচিতি (Developer Details):**
- **Developer:** Md. Tarikul Islam
- **Phone:** 01312305225
- **Address:** Sherpur, Sadar, Sherpur

---

## 🌟 ১. কিভাবে cPanel / Shared Hosting / VPS-এ ইনস্টল ও আপডেট করবেন (আগের ডাটা না হারিয়ে):

### ধাপ ১: ফাইল আপলোড (কোড ফাইল মাত্র)
1. সফটওয়্যার বিল্ড (`npm run build`) করার পর তৈরি হওয়া `dist` ফোল্ডারের ফাইলগুলো (`index.html`, `assets/`, `api.php`, `.htaccess`, `db_config.example.php`) আপনার cPanel-এর `public_html` ফোল্ডারে আপলোড করুন।
2. **গুরুত্বপূর্ণ:** `npm run build` করার সময় `erp_data_snapshot.json` বা `database.sql` কখনোই `dist/` ফোল্ডারে ঢোকানো হয় না, যাতে কোড আপডেট করলে লাইভ ডাটা ওভাররাইট না হয়।

### ধাপ ২: ডাটাবেস তৈরি ও SQL ফাইল ইমপোর্ট (শুধুমাত্র প্রথমবার)
1. cPanel থেকে **MySQL Database Wizard**-এ গিয়ে নতুন ডাটাবেস ও ইউজার তৈরি করুন (যেমন: `dokanpro_db`)।
2. **phpMyAdmin** ওপেন করে আপনার ডাটাবেস সিলেক্ট করুন এবং প্রথমবার `database.sql` ইমপোর্ট করুন।
3. **কোড আপডেটের সময় পুনরায় SQL ইমপোর্ট করার প্রয়োজন নেই!** `api.php` স্বয়ংক্রিয়ভাবে MySQL-এ `erp_state_store` টেবিল এবং সার্ভারে `erp_storage/` ফোল্ডারে সমস্ত ডাটা ও দৈনিক ব্যাকআপ সুরক্ষিত রাখে।

### ধাপ ৩: আলাদা `db_config.php` ফাইলে ডাটাবেস তথ্য সংরক্ষণ (Update-Safe)
`api.php` এডিট করার বদলে `db_config.example.php` কপি করে `public_html/erp_storage/db_config.php` (অথবা `public_html/db_config.php`) হিসেবে সেভ করুন:
```php
<?php
define('DB_HOST', 'localhost');
define('DB_USER', 'your_cpanel_db_user');
define('DB_PASS', 'your_cpanel_db_password');
define('DB_NAME', 'your_cpanel_db_name');
```
এর ফলে GitHub Actions অথবা cPanel Git™ Version Control থেকে নতুন কোড ডিপ্লয় করলেও আপনার DB পাসওয়ার্ড, `erp_storage/`, দৈনিক ব্যাকআপ এবং MySQL ডাটা ১০০% অক্ষত থাকবে।

---

## 💻 ২. কিভাবে Localhost (XAMPP / Laragon / WAMP)-এ চালাবেন:

1. **XAMPP** ওপেন করে **Apache** এবং **MySQL** Start করুন।
2. ব্রাউজারে `http://localhost/phpmyadmin` ওপেন করুন।
3. নতুন ডাটাবেস তৈরি করুন: `dokanpro_erp_db`
4. **Import** ট্যাবে গিয়ে `database.sql` ফাইলটি সিলেক্ট করে ইমপোর্ট দিন।
5. এই প্রজেক্ট ফোল্ডারটি `htdocs` ফোল্ডারে রাখুন অথবা সরাসরি React/Node দিয়ে রান করুন।

---

## ⚡ ৩. কিভাবে Node.js / Localhost টার্মিনালে চালাবেন:

1. টার্মিনাল ওপেন করে ডিপেন্ডেন্সি ইনস্টল করুন:
   ```bash
   npm install
   ```
2. অ্যাপ্লিকেশন বিল্ড করুন:
   ```bash
   npm run build
   ```
3. লোকালহোস্ট সার্ভার স্টার্ট করুন:
   ```bash
   npm start
   ```
4. ব্রাউজারে যান: `http://localhost:3000`

---

## 💾 ৪. সফটওয়্যার থেকে সরাসরি ১-ক্লিকে SQL ফাইল ডাউনলোড:

- সফটওয়্যারের **Settings (সেটিংস) ➔ Database & SQL Backup (ডাটাবেস ও এসকিউএল ব্যাকআপ)** ট্যাবে যান।
- **"সম্পূর্ণ ডাটাবেস ব্যাকআপ (.sql ফাইল) ডাউনলোড করুন"** বাটনে চাপ দিন।
- তৎক্ষণাৎ আপনার সমস্ত কাস্টমার, প্রোডাক্ট, ক্যাশ, বাকি ও বিক্রির ডাটা সহ ফুল MySQL/MariaDB ফাইল ডাউনলোড হয়ে যাবে।
