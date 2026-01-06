# 📘 Setup Guide — Oculus

Complete step-by-step instructions to set up the entire privacy-first productivity tracking system.

**Estimated time: 30-45 minutes**

---

## 📋 Overview

The system consists of **three independent components** that work together:

1. **ActivityWatch** — Tracks your browsing activity locally
2. **n8n** — Automates hourly data collection and transfer
3. **Google Apps Script** — Generates daily AI-powered email reports

Set them up **in this order** for smooth integration.

---

## Component 1: ActivityWatch

### Step 1.1: Download ActivityWatch

1. Visit: [https://activitywatch.net/](https://activitywatch.net/)
2. Download the latest version for your OS (Windows, macOS, Linux)
3. Install and launch the application

### Step 1.2: Verify ActivityWatch is Running

1. Open your browser and go to:
   ```
   http://127.0.0.1:5600
   ```

2. You should see the ActivityWatch dashboard
3. Ensure **Web Watcher** is active (usually auto-enabled)

### Step 1.3: Get Your ActivityWatch Bucket Name

This is needed for the n8n workflow later.

1. Open this URL in your browser:
   ```
   http://127.0.0.1:5600/api/0/buckets
   ```

2. Look for an entry similar to:
   ```
   aw-watcher-web-chrome_YOUR_DEVICE_NAME
   ```
   Or:
   ```
   aw-watcher-web-firefox_YOUR_DEVICE_NAME
   ```

3. **Copy the full bucket name** — you'll need it in Step 2.4

**Example:** `aw-watcher-web-chrome_desktop-abc123`

✅ **ActivityWatch Setup Complete**

---

## Component 2: n8n (Local Automation)

### Step 2.1: Install n8n Locally

#### Option A: Using npm (Recommended)

```bash
npm install -g n8n
```

Then start n8n:
```bash
n8n
```

#### Option B: Using Docker

```bash
docker run -it --rm --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n
```

### Step 2.2: Open n8n Dashboard

1. Open your browser to:
   ```
   http://localhost:5678
   ```

2. You should see the n8n setup screen
3. Configure n8n with your preferences (email, timezone, etc.)

### Step 2.3: Import the Workflow

1. In n8n, click **Import Workflow**
2. Copy and paste the contents of `n8n/activitywatch_collector.json`
3. Click **Import** to add the workflow

### Step 2.4: Configure the Workflow Nodes

Your imported workflow has several nodes that need configuration. Follow these steps:

#### Node 1: HTTP Request (ActivityWatch)

1. Click the **HTTP Request** node
2. In the URL field, update:
   ```
   http://127.0.0.1:5600/api/0/buckets/[YOUR_BUCKET_NAME]/events
   ```
   Replace `[YOUR_BUCKET_NAME]` with the bucket name from Step 1.3

3. Important: The workflow already defines `start` and `end` using n8n expressions.

   These expressions dynamically fetch the **last 1 hour of activity** on every run:

   - `start = now − 1 hour`
   - `end = now`

   Do NOT replace these with hardcoded timestamps.
   Do NOT manually add `start` or `end` parameters in the URL field.

   If you want a different window (e.g., last 30 minutes or 2 hours), modify the expression — not the URL.

#### Node 2: Google Sheets (Append)

1. **Create a new Google Sheet** (or use an existing one):
   - Go to [https://sheets.google.com](https://sheets.google.com)
   - Click **+ Create new spreadsheet**
   - Name it: `Daily Activity Log`

2. **Copy the Sheet ID**:
   - It's in the URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`
   - Copy everything after `d/` and before `/edit`

3. **In n8n**, click the **Google Sheets** node
4. Click **Connect** and authenticate with your Google account
5. Paste your **Sheet ID**
6. Set the sheet name to: `Sheet1`
7. Set the range to: `A:E` (for Date, Website, Duration_Seconds, Page_Title, Time)

### Step 2.5: Prepare Your Google Sheet

1. Open your newly created Google Sheet
2. Set up the headers in **Row 1**:
   - **A1:** `Date`
   - **B1:** `Website`
   - **C1:** `Duration_Seconds`
   - **D1:** `Page_Title`
   - **E1:** `Time`

3. Save the sheet (Ctrl+S or Cmd+S)

### Step 2.6: Configure the Workflow Trigger

1. Click the **Trigger** node (usually a clock icon)
2. Set it to run **every 1 hour**
3. Choose your preferred trigger time

### Step 2.7: Activate the Workflow

1. Click the **Toggle** switch to **ON**
2. The workflow will now run automatically every hour

✅ **n8n Setup Complete**

---

## Component 3: Google Apps Script (Daily Reports)

### Step 3.1: Open Google Apps Script Editor

1. Go to your Google Sheet (created in Step 2.5)
2. Click **Extensions → Apps Script**
3. A new tab will open with the Apps Script editor

### Step 3.2: Add the Daily Report Code

1. Delete any existing code in the editor
2. Copy the entire contents of `apps-script/daily_report.gs`
3. Paste it into the editor
4. Click **Save** (Ctrl+S or Cmd+S)

### Step 3.3: Set Your Email Address

1. In the code, find the line:
   ```javascript
   GmailApp.sendEmail("<YOUR_EMAIL_ADDRESS>",
   ```

2. Replace `<YOUR_EMAIL_ADDRESS>` with **your email address**

3. Save the file

### Step 3.4: Set Your Gemini API Key

1. First, get a **free Gemini API key**:
   - Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
   - Click **Create API Key**
   - Copy your new API key

2. **Keep this key secure** — don't share it

3. In Apps Script, set the function dropdown to: **`setGeminiApiKey`**

4. Click the **Run** button (▶️)

5. **Approve permissions** when prompted (click your email, then Allow)

6. **A prompt will ask for your API key** — paste your Gemini API key and click OK

7. Check the **Execution log** at the bottom — you should see:
   ```
   API Key set successfully
   ```

### Step 3.5: Create a Daily Trigger

1. Click **Triggers** (clock icon on left sidebar)
2. Click **+ Create new trigger**
3. Configure as follows:
   - **Function:** `sendDailyActivityReport`
   - **Deployment:** Head
   - **Event source:** Time-driven
   - **Type:** Day timer
   - **Time of day:** Choose your preferred time (e.g., 11:00 PM)

4. Click **Save**

### Step 3.6: Test the Setup

Run a test to ensure everything works:

1. Set the function dropdown to: **`sendDailyActivityReport`**
2. Click **Run** button
3. **Approve permissions** (click your Google account, then Allow)
4. Check the **Execution log** for success message
5. **Check your email** — you should receive a test report

If you see an email with activity data and AI analysis, you're done! ✅

---

## Step 4: (Optional) Auto-start n8n on System Boot

So n8n runs automatically when you start your computer.

### On Windows:

1. Create a file named `start-n8n.vbs` with this content:
   ```vbscript
   CreateObject("WScript.Shell").Run "n8n", 0
   ```

2. Save it to your Desktop

3. Press **Win + R**, type `shell:startup`, and press Enter

4. Copy `start-n8n.vbs` to this Startup folder

5. Restart your computer — n8n will now auto-start

### On macOS:

1. Create a file named `start-n8n.sh`:
   ```bash
   #!/bin/bash
   n8n &
   ```

2. Make it executable:
   ```bash
   chmod +x start-n8n.sh
   ```

3. Add it to **System Preferences → General → Login Items**

### On Linux:

1. Create a systemd service file: `/etc/systemd/system/n8n.service`:
   ```ini
   [Unit]
   Description=n8n Workflow Automation
   After=network.target

   [Service]
   Type=simple
   User=your_username
   ExecStart=/usr/local/bin/n8n
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```

2. Enable and start:
   ```bash
   sudo systemctl enable n8n
   sudo systemctl start n8n
   ```

---

## ✅ Verification Checklist

Run through this checklist to ensure everything works:

- [ ] **ActivityWatch** is running (`http://127.0.0.1:5600` loads)
- [ ] **n8n** is running (`http://localhost:5678` loads)
- [ ] **n8n workflow** is active and triggered hourly
- [ ] **Google Sheet** has data appearing hourly
- [ ] **Apps Script** test run succeeded
- [ ] **Email received** with activity analysis
- [ ] **Daily trigger** is set in Apps Script
- [ ] **Gemini API key** is set securely

If all checks pass, you're ready! 🎉

---

## 🐛 Troubleshooting

### No Data Appearing in Google Sheet

**Problem:** Rows aren't being added hourly

**Solutions:**
1. Verify ActivityWatch is running: `http://127.0.0.1:5600`
2. Check the n8n workflow is **active** (toggle should be ON)
3. Click **Test** on the HTTP Request node to manually fetch data
4. Check n8n **Execution logs** for errors
5. Verify your **ActivityWatch bucket name** is correct
6. Ensure you're browsing normally so ActivityWatch has data to collect

### "API key not set" Error

**Problem:** Apps Script says API key is missing

**Solutions:**
1. Run `setGeminiApiKey('YOUR_KEY')` again in Apps Script
2. Make sure you clicked **Run** and approved permissions
3. Check **Execution log** for the "API Key set successfully" message
4. Verify your Gemini API key is valid (check [ai.google.dev](https://ai.google.dev))

### Email Not Received

**Problem:** No daily email arrives

**Solutions:**
1. Check **Execution log** in Apps Script for errors
2. Verify the daily **trigger** is created and enabled
3. Ensure the email address in the code is correct
4. Check your **Gmail spam folder**
5. Verify Gmail permissions were granted in Step 3.4
6. Try running `sendDailyActivityReport()` manually to test

### n8n Workflow Not Running

**Problem:** Workflow is active but not executing

**Solutions:**
1. Verify **trigger** is set to "Time-driven"
2. Check that **n8n is running** (browser access works)
3. Review **Execution history** in n8n for failed runs
4. Ensure ActivityWatch bucket name is spelled correctly
5. Try clicking **Test** on nodes to diagnose issues

### Charts Not Loading in Email

**Problem:** Email received but charts show broken images

**Solutions:**
1. Ensure you have **internet access**
2. QuickChart may be temporarily unavailable — try rerunning the script
3. Check that the prompt doesn't exceed token limits

### Timezone Issues

**Problem:** Activity data doesn't match your local time

**Solutions:**
1. In n8n, verify the **timezone** setting matches your location
2. 2. In n8n, verify the workflow timezone matches your local timezone
3. Do NOT add or hardcode start/end parameters
4. Adjust the time window only by editing the n8n expression (e.g. minus({ hours: 1 }))
5. Check that your Google Sheet's **timezone** is correct (File → Spreadsheet settings)

---

## 🔒 Security Best Practices

✅ **Store your API key securely:**
- Use Apps Script Properties (as configured)
- Never commit API keys to git
- Add `.env` to `.gitignore`

✅ **Keep Google Sheet private:**
- Only you should have access
- Don't share the Sheet ID publicly

✅ **Rotate API keys periodically:**
- Delete old keys from Google Cloud Console
- Update in Apps Script

✅ **Keep dependencies updated:**
- Run `npm update -g n8n` monthly
- Check ActivityWatch for updates

---

## 🎯 Next Steps

1. **Run normally for 1-2 hours** so n8n collects real data
2. **Wait for your first daily email** (at the scheduled trigger time)
3. **Review the report** for accuracy and formatting
4. **Customize** as needed:
   - Modify the AI prompt in `daily_report.gs`
   - Change email template styling
   - Adjust trigger time to suit your workflow

---

## 📞 Getting Help

| Issue | Check |
|-------|-------|
| Data not flowing | Execution logs in n8n and Apps Script |
| Email formatting | Raw email source in Gmail |
| API errors | Apps Script Execution log |
| Workflow issues | n8n documentation: [https://docs.n8n.io/](https://docs.n8n.io/) |
| ActivityWatch issues | [https://docs.activitywatch.net/](https://docs.activitywatch.net/) |

---

## ✨ You're All Set!

Your privacy-first productivity tracking system is now running. 

**Summary of what's happening:**
1. ActivityWatch tracks your browsing 24/7 locally
2. n8n pulls data hourly and stores it in Google Sheets
3. Google Apps Script analyzes the data daily using Gemini AI
4. You receive a personalized email with three perspectives on your productivity

Enjoy your intelligence reports! 🚀

---

## 📝 Quick Reference

| Component | Port | Purpose |
|-----------|------|---------|
| ActivityWatch | 5600 | Local activity tracking |
| n8n | 5678 | Workflow automation |
| Google Sheets | — | Cloud data storage |
| Google Apps Script | — | Report generation |

**Key Files:**
- `n8n/activitywatch_collector.json` — Automation workflow
- `apps-script/daily_report.gs` — Report generation code

**Key URLs:**
- ActivityWatch: `http://127.0.0.1:5600`
- n8n: `http://localhost:5678`
- Google Sheets: `https://sheets.google.com`
- Gemini API: `https://aistudio.google.com/app/apikey`