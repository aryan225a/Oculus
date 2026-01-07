const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

function setGeminiApiKey(apiKey) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
}

function sendDailyActivityReport() {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName("Sheet1");
    const data = sheet.getDataRange().getValues();
    const tz = Session.getScriptTimeZone();
    const todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

    const activityMap = {};
    for (let i = 1; i < data.length; i++) {
      const [rowDate, url, seconds, title] = data[i];
      const rowDay = Utilities.formatDate(new Date(rowDate), tz, "yyyy-MM-dd");
      if (rowDay === todayStr && seconds > 0) {
        const key = String(title || url).trim();
        activityMap[key] = (activityMap[key] || 0) + Number(seconds);
      }
    }

    const activityLog = Object.keys(activityMap).map(k => ({
      title: k,
      time_sec: activityMap[k],
      time_min: Math.round(activityMap[k] / 60)
    }));

    if (!activityLog.length) return;

    activityLog.sort((a, b) => b.time_sec - a.time_sec);

    const totalHours = (
      activityLog.reduce((s, e) => s + e.time_sec, 0) / 3600
    ).toFixed(1);

    const top10 = activityLog.slice(0, 10);

    const prompt = `
You are generating a daily productivity email.

Follow this structure EXACTLY.
Do not add extra sections.

## Executive Summary
- Bullet points only
- Max 5 bullets

## The Roast
- 3–4 short sarcastic lines
- Friendly, not offensive

## Coaching Plan
- Exactly 3 actionable bullet points

Context:
Date: ${todayStr}
Total Active Time: ${totalHours} hours
Top Sites:
${JSON.stringify(top10, null, 2)}
`;

    const aiMarkdown = callGemini(prompt);

    let platformStats = computePlatformStats(activityLog);
    platformStats = compressPlatforms(platformStats);
    const pieUrl = buildPieChartUrl(platformStats);
    const pieSection = renderPieChartSection(pieUrl, totalHours);

    const biggestTimeSink = renderBiggestTimeSink(activityLog);

    const { start, end } = getWeekStartToTodayRange();
    const weeklyStats = aggregateByRange(data, start, end);

    const comparisonTable = renderComparisonTable(
      todayStr,
      { totalHours, topSite: activityLog[0].title },
      `Week so far`,
      weeklyStats
    );

    const aiHtml = renderMarkdown(aiMarkdown);
    const tableHtml = buildActivityTable(top10);

    const finalHtml = buildEmailLayout(
      todayStr,
      totalHours,
      `
        ${aiHtml}
        ${pieSection}
        ${biggestTimeSink}
        ${comparisonTable}
      `,
      tableHtml
    );

    GmailApp.sendEmail(
      "<YOUR_EMAIL_ADDRESS>",
      `Daily Intelligence • ${totalHours}h • ${todayStr}`,
      "",
      { htmlBody: finalHtml }
    );

  } catch (e) {
    Logger.log(e.toString());
  }
}

function buildEmailLayout(date, hours, mainContentHtml, tableHtml) {
  return `
  <div style="
    font-family:Segoe UI,system-ui,sans-serif;
    max-width:680px;
    margin:auto;
    background:#f4f6f8;
    padding:16px;
    color:#1f1f1f;
  ">

    <!-- Hero Header -->
    <div style="
      background:linear-gradient(135deg,#1a73e8,#4285f4);
      padding:24px;
      border-radius:14px;
      color:#fff;
      box-shadow:0 6px 18px rgba(0,0,0,0.15);
    ">
      <h1 style="margin:0;font-size:22px;font-weight:600;">
        Daily Intelligence
      </h1>
      <div style="margin-top:6px;font-size:13px;opacity:0.9;">
        ${date} · ${hours} hours tracked
      </div>
    </div>

    <!-- Main Content -->
    <div style="margin-top:18px;">
      ${mainContentHtml}
    </div>

    <!-- Activity Table Card -->
    <div style="
      background:#ffffff;
      margin-top:18px;
      padding:20px;
      border-radius:14px;
      box-shadow:0 4px 12px rgba(0,0,0,0.06);
    ">
      <h3 style="
        margin:0 0 12px 0;
        font-size:16px;
        font-weight:600;
        border-bottom:1px solid #e0e0e0;
        padding-bottom:6px;
      ">
        Top Activity Breakdown
      </h3>
      ${tableHtml}
    </div>

    <!-- Footer -->
    <div style="
      margin-top:16px;
      text-align:center;
      font-size:11px;
      color:#777;
    ">
      Generated automatically · Personal productivity analytics
    </div>

  </div>`;
}


function buildActivityTable(topSites) {
  const rows = topSites.map((s, i) => `
    <tr style="background:${i % 2 ? '#fafafa' : '#fff'};">
      <td style="padding:8px;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${s.title}">
        ${s.title}
      </td>
      <td style="padding:8px;text-align:right;">
        ${s.time_min} min
      </td>
    </tr>
  `).join("");

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#eee;">
          <th style="padding:8px;text-align:left;">Context</th>
          <th style="padding:8px;text-align:right;">Time</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}


function renderMarkdown(md) {

  const sections = md.split(/^## /gm).filter(Boolean);

  return sections.map(section => {
    const lines = section.split('\n').filter(l => l.trim() !== '');
    const title = lines.shift().trim();

    let bodyHtml = '';
    let inList = false;

    lines.forEach(line => {
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      if (line.startsWith('- ')) {
        if (!inList) {
          bodyHtml += '<ul style="padding-left:16px;margin:8px 0 0 0;">';
          inList = true;
        }
        bodyHtml += `<li style="margin-bottom:6px;">${line.replace('- ', '')}</li>`;
      } else {
        if (inList) {
          bodyHtml += '</ul>';
          inList = false;
        }
        bodyHtml += `<p style="margin:8px 0 0 0;line-height:1.55;">${line}</p>`;
      }
    });

    if (inList) bodyHtml += '</ul>';

    return `
      <div style="
        background:#ffffff;
        margin-top:14px;
        padding:16px;
        border-radius:14px;
        box-shadow:0 4px 12px rgba(0,0,0,0.06);
      ">
        <h3 style="
          margin:0 0 6px 0;
          color:#1a73e8;
          font-size:16px;
        ">
          ${title}
        </h3>

        <div style="
          height:1px;
          background:#e8eaed;
          margin:8px 0 10px 0;
        "></div>

        ${bodyHtml}
      </div>
    `;
  }).join('');
}


function computePlatformStats(activityLog) {
  const totalSec = activityLog.reduce((s, e) => s + e.time_sec, 0);
  return activityLog.map(e => ({
    title: e.title,
    minutes: Math.round(e.time_sec / 60),
    percent: Math.round((e.time_sec / totalSec) * 100)
  }));
}


function compressPlatforms(platforms, minPercent = 4) {
  let main = [];
  let others = { title: 'Others', minutes: 0, percent: 0 };
  platforms.forEach(p => {
    if (p.percent >= minPercent) main.push(p);
    else {
      others.minutes += p.minutes;
      others.percent += p.percent;
    }
  });
  if (others.percent > 0) main.push(others);
  return main;
}


function buildPieChartUrl(platforms) {
  const chartConfig = {
    type: 'pie',
    data: {
      labels: platforms.map(p => p.title),
      datasets: [{
        data: platforms.map(p => p.percent),
        backgroundColor: ['#1a73e8','#34a853','#fbbc04','#ea4335','#9334e6','#00acc1','#5f6368']
      }]
    },
    options: { plugins: { legend: { position: 'right' } } }
  };
  return 'https://quickchart.io/chart?c=' + encodeURIComponent(JSON.stringify(chartConfig));
}


function renderPieChartSection(pieUrl, totalHours) {
  return `
    <div style="
      background:#ffffff;
      margin-top:14px;
      padding:16px;
      border-radius:14px;
      box-shadow:0 4px 12px rgba(0,0,0,0.06);
    ">
      <h3 style="margin:0;font-size:16px;"> Time Allocation</h3>

      <div style="height:1px;background:#e8eaed;margin:8px 0 10px 0;"></div>

      <img src="${pieUrl}"
           style="max-width:100%;border-radius:10px;">

      <div style="margin-top:6px;font-size:12px;color:#666;">
        Based on ${totalHours} hours of activity
      </div>
    </div>
  `;
}


function renderBiggestTimeSink(activityLog) {
  const top = activityLog[0];
  return `
    <div style="
      background:#fff7e6;
      margin-top:14px;
      padding:14px;
      border-radius:14px;
      border-left:5px solid #fbbc04;
      box-shadow:0 4px 12px rgba(0,0,0,0.05);
    ">
      <div style="font-weight:600;margin-bottom:4px;">
        Biggest Time Sink
      </div>
      <div style="font-size:14px;">
        ${top.title} · ${Math.round(top.time_sec / 60)} minutes
      </div>
    </div>
  `;
}


function getWeekStartToTodayRange() {
  const today = new Date();
  const day = today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - day);
  start.setHours(0,0,0,0);
  const end = new Date(today);
  end.setHours(23,59,59,999);
  return { start, end };
}


function aggregateByRange(data, start, end) {
  let totalSec = 0;
  let siteMap = {};
  for (let i = 1; i < data.length; i++) {
    const [date, url, sec, title] = data[i];
    const d = new Date(date);
    if (d >= start && d <= end && sec > 0) {
      totalSec += sec;
      const key = title || url;
      siteMap[key] = (siteMap[key] || 0) + sec;
    }
  }
  const topSites = Object.entries(siteMap)
    .map(([k, v]) => ({ title: k, sec: v }))
    .sort((a, b) => b.sec - a.sec)
    .slice(0, 1);

  return {
    totalHours: (totalSec / 3600).toFixed(1),
    topSite: topSites[0]?.title || '-'
  };
}


function renderComparisonTable(labelA, statsA, labelB, statsB) {
  return `
    <div style="
      background:#ffffff;
      margin-top:14px;
      padding:16px;
      border-radius:14px;
      box-shadow:0 4px 12px rgba(0,0,0,0.06);
    ">
      <h3 style="margin:0;font-size:16px;">Weekly Progress</h3>

      <div style="height:1px;background:#e8eaed;margin:8px 0 12px 0;"></div>

      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f1f3f4;">
            <th style="padding:8px;text-align:left;">Metric</th>
            <th style="padding:8px;text-align:right;">Today</th>
            <th style="padding:8px;text-align:right;">Week so far</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px;">Total Hours</td>
            <td style="padding:8px;text-align:right;">${statsA.totalHours}</td>
            <td style="padding:8px;text-align:right;">${statsB.totalHours}</td>
          </tr>
          <tr>
            <td style="padding:8px;">Top Platform</td>
            <td style="padding:8px;text-align:right;">${statsA.topSite}</td>
            <td style="padding:8px;text-align:right;">${statsB.topSite}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}


function callGeminiWithRetry(prompt) {
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 5000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 }
      };

      const response = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      if (response.getResponseCode() !== 200) {
        throw new Error(`Gemini API error: ${response.getResponseCode()}`);
      }

      const json = JSON.parse(response.getContentText());
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error("Empty Gemini response");
      }

      return {
        success: true,
        content: text
      };

    } catch (err) {
      Logger.log(`Gemini attempt ${attempt} failed: ${err.message}`);

      if (attempt < MAX_RETRIES) {
        Utilities.sleep(RETRY_DELAY_MS);
      }
    }
  }

  return {
    success: false,
    content: `
## AI Analysis Unavailable

- The AI service was temporarily overloaded.
- Your activity data, charts, and insights are still shown below.
- This does not affect future reports.

`
  };
}

