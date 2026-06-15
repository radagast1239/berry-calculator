# Калькулятор урожая ягоды

Веб-калькулятор урожайности клубники (КСД / НСД) по сценариям Минимум / Средний / Максимум.

## Локальный запуск

```bash
npm install
npm run dev
```

Адрес: `http://localhost:5173`

Продакшен локально:

```bash
npm run start
```

Адрес: `http://localhost:4173`

## Публикация на GitHub Pages (постоянная ссылка)

### 1. Создайте репозиторий на GitHub

1. Откройте https://github.com/new
2. Имя репозитория: `berry-calculator` (или любое другое)
3. Тип: **Public**
4. **Не** ставьте галочки README / .gitignore / license
5. Нажмите **Create repository**

### 2. Залейте код с компьютера

В PowerShell из папки `berry-calculator`:

```powershell
cd "X:\КАЛЬКУЛЯТОР ЯГОДА\berry-calculator"

git init
git add .
git commit -m "Калькулятор урожая ягоды"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/berry-calculator.git
git push -u origin main
```

Замените `ВАШ_ЛОГИН` на свой логин GitHub.

При первом `git push` GitHub попросит войти (браузер или токен).

### 3. Включите GitHub Pages

1. Репозиторий → **Settings** → **Pages**
2. В **Build and deployment** → **Source**: выберите **GitHub Actions**
3. Подождите 1–3 минуты после push (вкладка **Actions** — зелёная галочка)

### 4. Готовая ссылка для клиента

```
https://ВАШ_ЛОГИН.github.io/berry-calculator/
```

Пример: `https://niko.github.io/berry-calculator/`

Ссылка работает всегда, ПК может быть выключен.

## Обновление после правок

```bash
git add .
git commit -m "обновление калькулятора"
git push
```

Через 1–2 минуты сайт обновится автоматически.
