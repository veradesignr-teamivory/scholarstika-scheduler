# Scholarstika Scheduler

Posts Scholarstika's content plan (56 posts, Oct – 31 Dec 2026) to the **Facebook Page**, **Instagram**, **LinkedIn** and the **WordPress blog** automatically, at each post's scheduled time (West Africa Time).

**How it works:** open a post, drop in the Canva images or video, and click **Save & mark ready**. Every 15 minutes the scheduler publishes every Ready post whose time has come. It retries a failed channel up to 3 times, then shows you the error.

| Post type | What to attach | Goes to |
|---|---|---|
| Single image / flyer | 1 JPG | Facebook photo, Instagram post, LinkedIn image post |
| Carousel | 2–10 JPGs, in order | Facebook multi-photo post, Instagram carousel, LinkedIn multi-image post |
| Reel / video | 1 MP4 (9:16), optional JPG cover | Instagram Reel, Facebook video, LinkedIn video |
| Blog | The article text, optional featured image | WordPress post (published, or saved as draft) |

> **Canva tip:** download images as **JPG**. Instagram rejects PNG. For carousels, use *Download → JPG → All pages*.

---

## Setup (about 45 minutes, once)

### 1. Put the code on GitHub
1. Create a free account at github.com if you don't have one.
2. Click **New repository**, name it `scholarstika-scheduler`, and keep it **Private**.
3. Choose **uploading an existing file**, then drag in everything from this folder (not `node_modules`).

### 2. Deploy on Vercel
1. Go to vercel.com and sign in with GitHub.
2. Click **Add New → Project**, then import `scholarstika-scheduler`. Leave the settings as they are and click **Deploy**. The first deploy works even before the rest is set up.
3. Note your address, e.g. `https://scholarstika-scheduler.vercel.app`.

> **Free plan works.** Vercel's free Hobby plan is enough. The 15-minute posting schedule is run by **GitHub Actions**, which is free (step 8). Vercel's own cron runs only once a day, as a backup.

### 3. Add storage (in the Vercel project)
1. Open **Storage → Create → Upstash (Redis)**. The free plan is enough. Connect it to the project.
2. Open **Storage → Create → Blob** and connect it. This holds your images and videos.

### 4. Add settings
In **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | The password you'll use to open the app |
| `CRON_SECRET` | Any long random text (e.g. 40 random letters and numbers) |
| `APP_URL` | Your Vercel address from step 2 |

Then go to **Deployments → ⋯ → Redeploy**. Open your address and sign in. You'll see all 56 posts.

### 5. Connect Facebook and Instagram
**First, check these on Facebook and Instagram:**
- Your Instagram must be a **Business** or **Creator** account. Switch in Instagram: Settings → Account type.
- It must be **linked to the Scholarstika Facebook Page**. In Meta Business Suite go to Settings → Instagram accounts, or on the Page go to Settings → Linked accounts.

**Then create a Meta app:**
1. Go to developers.facebook.com → **My Apps → Create App**.
2. Pick the use case **"Manage everything on your Page"**, or "Other → Business" if that's offered.
3. Add the products **Facebook Login for Business** and **Instagram** (Instagram API with Facebook Login).
4. Under **Facebook Login → Settings → Valid OAuth Redirect URIs**, add:
   `https://YOUR-APP.vercel.app/api/auth/meta/callback`
5. From **App settings → Basic**, copy the **App ID** and **App Secret** into Vercel as `META_APP_ID` and `META_APP_SECRET`, then redeploy.
6. In the app, open **Connections & settings → Connect Facebook & Instagram**. Approve with the account that manages the Scholarstika Page, and **select the Page and the Instagram account** when asked.

The app can stay in **Development mode** because only you (an app admin) use it, so Meta's App Review isn't needed. The Page connection doesn't expire.

### 6. Connect LinkedIn
1. Go to linkedin.com/developers → **Create app**. Link it to the Scholarstika company page; this is required to create the app.
2. Under **Products**, request **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**. Both are approved instantly.
3. Under **Auth → Authorized redirect URLs**, add:
   `https://YOUR-APP.vercel.app/api/auth/linkedin/callback`
4. Copy the **Client ID** and **Client Secret** into Vercel as `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`, then redeploy.
5. In the app, click **Connect LinkedIn**.

**Personal profile or company page?** By default, posts go to **your personal LinkedIn profile**. To post as the **Scholarstika company page** instead:
- Request the **Community Management API** product on your LinkedIn app. LinkedIn reviews this, which can take several days to weeks.
- Once approved, add `LINKEDIN_ORG_ID`: the number in your page's admin URL, `linkedin.com/company/12345678/admin`. Redeploy and click **Reconnect LinkedIn**.

A LinkedIn connection lasts **60 days**. The settings page shows how many days are left; click **Reconnect LinkedIn** before it runs out. Apps approved for refresh tokens renew automatically.

### 6b. Connect the WordPress blog
This works with WordPress on Hostinger or any other host (WordPress 5.6 or newer, site on HTTPS).
1. In WordPress admin, go to **Users → Profile**. Use an Administrator, Editor or Author account.
2. Scroll to **Application Passwords**, type `Scholarstika Scheduler` as the name, and click **Add New Application Password**. Copy the code it shows; it's only shown once.
3. In Vercel, add:
   - `WP_URL`: `https://scholarstika.org` (your site address)
   - `WP_USERNAME`: the WordPress username of that account (not the email)
   - `WP_APP_PASSWORD`: the code from step 2
   - Optional: `WP_POST_STATUS` = `draft` if you'd rather review each article in WordPress before it goes live
   - Optional: `WP_CATEGORY_ID` to file every post under one category
4. Redeploy. **Connections & settings** should show WordPress in green.

**Writing the blog posts:** each Friday blog post has an **Article** box. Paste or write the article there (`##` for headings, `-` for bullets), optionally attach a featured image, then click **Save & mark ready**. The app needs at least 150 words before it accepts the post. The title, excerpt (meta description) and URL slug come from the plan.

**If the WordPress test fails with 401 or 403:**
- **Application Passwords section missing:** the site isn't on HTTPS, or a security plugin has turned the feature off. In Wordfence: *Login Security → Settings → Disable application passwords* must be off.
- **"Refused the login" with a correct password:** on some Apache setups the login header is dropped. Add this line at the top of WordPress's `.htaccess` (Hostinger File Manager → `public_html/.htaccess`):
  `SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1`
- **Blocked by a firewall:** Hostinger or Cloudflare bot protection can block requests from Vercel. Allow `/wp-json/` or switch off "bot fight mode" for the API.

### 7. Use your own domain (Hostinger)
To open the app at e.g. `scheduler.scholarstika.org` instead of the `vercel.app` address:
1. In Vercel, go to **Settings → Domains → Add** and enter `scheduler.scholarstika.org`. Vercel shows a **CNAME** value, usually `cname.vercel-dns.com`.
2. In Hostinger, go to **hPanel → Domains → scholarstika.org → DNS / Nameservers → DNS records** and add:
   - Type `CNAME`, Name `scheduler`, Target the value Vercel showed, TTL default.
3. Wait 5–30 minutes until Vercel shows the domain as **Valid**. HTTPS is set up automatically.
4. Change `APP_URL` in Vercel to `https://scheduler.scholarstika.org` and redeploy.
5. Update the two redirect URLs in your Meta app and your LinkedIn app to the new address, then click Connect again in the app.

Your main website on Hostinger is not affected; only the `scheduler.` subdomain points to Vercel.

### 8. Turn on the 15-minute schedule (GitHub Actions)
1. In your GitHub repository, go to **Settings → Secrets and variables → Actions → New repository secret**, and add two secrets:
   - `APP_URL`: your app's address, e.g. `https://scheduler.scholarstika.org`
   - `CRON_SECRET`: exactly the same value you set in Vercel
2. Open the **Actions** tab. If asked, click **I understand my workflows, go ahead and enable them**.
3. Click **Publish due posts → Run workflow** once to test. A green tick means the scheduler answered.

From then on, GitHub calls the app every 15 minutes. At busy times GitHub can start a few minutes late. GitHub also pauses scheduled workflows in a repository with no activity for 60 days, and emails you first; any commit, or clicking **Enable workflow**, restarts it.

### 9. Test it
1. On **Connections & settings**, all three accounts should show green.
2. Open any upcoming post, attach media, then click **Post now instead** and confirm. Check that it appears on each account. To test without posting to followers, use a post you'd send anyway.

---

## Day to day

1. Each week, open the upcoming posts, attach the Canva files, and click **Save & mark ready**.
2. The home page warns you about posts in the next 3 days that still need media. Posts without media are **not** sent.
3. Posts publish on their own. Check **Status** on the home page, and open a post for links to the live posts or any error.
4. **Run scheduler now** publishes anything due straight away, without waiting for the next 15-minute run.

You can edit the caption, hashtags, date, time and channels of any post until it's published. Posts dated in the past start as drafts, so nothing goes out by surprise. Change the date, or use **Post now**.

## Why not host it on Hostinger directly?
The scheduler is a Node.js app that needs a server that is always running, plus storage for your media. Hostinger's regular web hosting serves PHP and static websites, so it can't run the app as it is. Hostinger's VPS plans can, but you'd have to maintain the server yourself. Vercel's free plan with your Hostinger domain (step 7) gives you the same address with no server to look after.

## Other ways to trigger the schedule
If you'd rather not use GitHub Actions, any cron service can call
`https://YOUR-APP/api/cron?key=YOUR_CRON_SECRET` every 15 minutes, e.g. cron-job.org (free). On Vercel Pro you can instead change the schedule in `vercel.json` to `"*/15 * * * *"`.

## Troubleshooting

| Message | Fix |
|---|---|
| "Instagram only accepts JPEG images" | Re-download from Canva as JPG and replace the file. |
| "No Instagram account is linked to the Facebook Page" | Link them in Meta Business Suite, then Reconnect Facebook & Instagram. |
| "(#200) … not authorized" or "permission" | Reconnect Facebook & Instagram and tick every Page and permission it asks for. |
| LinkedIn 401 or "Token rejected" | Click Reconnect LinkedIn. The 60-day connection ran out. |
| LinkedIn 426 or "version" error | Add `LINKEDIN_API_VERSION` (e.g. `202609`, last month as YYYYMM) and redeploy. |
| "Instagram is still processing the video" | Normal for Reels. It publishes on the next run. |

## Technical notes
- Next.js 15 (App Router) on Vercel. Data is stored in Upstash Redis and media in Vercel Blob (public URLs, which Instagram and Facebook fetch).
- APIs used: Facebook Graph API (`/photos`, `/feed`, `/videos`), Instagram Content Publishing (media containers, then `media_publish`) and the LinkedIn versioned Posts, Images and Videos APIs.
- `data/posts.json` is the original plan. It seeds the database on first run only, so later edits live in the database.
- The cron route is `/api/cron`. It's protected by `CRON_SECRET` and takes a lock so two runs never overlap.
