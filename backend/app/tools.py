import os
import json

import httpx
from langchain_core.tools import tool


# ---------------------------------------------------------------------------
# 1. Serper Google Search
# ---------------------------------------------------------------------------
@tool
async def serper_search(query: str) -> str:
    """Search Google using Serper API. Use this to find market data, competitor info, news, and trends."""
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return "Error: SERPER_API_KEY not set"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={"q": query, "num": 10},
            )
            response.raise_for_status()
            data = response.json()

        results = []
        for item in data.get("organic", [])[:8]:
            results.append(
                f"**{item.get('title', '')}**\n"
                f"URL: {item.get('link', '')}\n"
                f"{item.get('snippet', '')}\n"
            )

        if data.get("knowledgeGraph"):
            kg = data["knowledgeGraph"]
            results.insert(
                0,
                f"**Knowledge Graph: {kg.get('title', '')}**\n"
                f"{kg.get('description', '')}\n",
            )

        return "\n---\n".join(results) if results else "No results found."
    except Exception as e:
        return f"Serper search error: {e}"


# ---------------------------------------------------------------------------
# 2. Firecrawl Web Scraper
# ---------------------------------------------------------------------------
@tool
async def firecrawl_scrape(url: str) -> str:
    """Scrape a webpage and return its content as markdown. Use this to get detailed information from specific URLs."""
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        return "Error: FIRECRAWL_API_KEY not set"

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://api.firecrawl.dev/v1/scrape",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"url": url, "formats": ["markdown"]},
            )
            response.raise_for_status()
            data = response.json()

        if not data.get("success"):
            return f"Failed to scrape {url}"

        markdown = data.get("data", {}).get("markdown", "")
        if len(markdown) > 8000:
            markdown = markdown[:8000] + "\n\n... [content truncated]"

        return markdown if markdown else f"No content extracted from {url}"
    except Exception as e:
        return f"Firecrawl scrape error for {url}: {e}"


# ---------------------------------------------------------------------------
# 3. Playwright Web Scraper (fallback for dynamic pages)
# ---------------------------------------------------------------------------
@tool
async def playwright_scrape(url: str) -> str:
    """Scrape a webpage using a headless browser (Playwright). Use this for dynamic/JS-heavy pages that Firecrawl cannot handle, or as a fallback when other scrapers fail."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return "Error: playwright not installed. Run: pip install playwright && playwright install chromium"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            await page.goto(url, wait_until="networkidle", timeout=30000)
            # Get main text content
            content = await page.evaluate("""() => {
                // Remove script/style/nav/footer elements
                const remove = document.querySelectorAll('script, style, nav, footer, header, aside, [role="banner"], [role="navigation"]');
                remove.forEach(el => el.remove());
                return document.body.innerText;
            }""")
            await browser.close()

        if not content or not content.strip():
            return f"No text content extracted from {url}"

        content = content.strip()
        if len(content) > 8000:
            content = content[:8000] + "\n\n... [content truncated]"

        return f"**Scraped from: {url}**\n\n{content}"
    except Exception as e:
        return f"Playwright scrape error for {url}: {e}"


# ---------------------------------------------------------------------------
# 4. NewsData.io — Latest News Search
# ---------------------------------------------------------------------------
@tool
async def newsdata_search(query: str) -> str:
    """Search latest news articles using NewsData.io. Use this to find recent news, press releases, and media coverage about companies, markets, or trends."""
    api_key = os.getenv("NEWSDATA_API_KEY")
    if not api_key:
        return "Error: NEWSDATA_API_KEY not set"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                "https://newsdata.io/api/1/latest",
                params={"apikey": api_key, "q": query, "language": "en"},
            )
            response.raise_for_status()
            data = response.json()

        if data.get("status") != "success":
            return f"NewsData API error: {data.get('results', {}).get('message', 'Unknown error')}"

        articles = data.get("results", [])
        if not articles:
            return "No news articles found."

        results = []
        for article in articles[:8]:
            title = article.get("title", "No title")
            link = article.get("link", "")
            description = article.get("description", "No description")
            pub_date = article.get("pubDate", "")
            source = article.get("source_id", "")
            results.append(
                f"**{title}**\n"
                f"Source: {source} | Date: {pub_date}\n"
                f"URL: {link}\n"
                f"{description}\n"
            )

        return "\n---\n".join(results)
    except Exception as e:
        return f"NewsData search error: {e}"


# ---------------------------------------------------------------------------
# 5. Hacker News Algolia — Developer Sentiment
# ---------------------------------------------------------------------------
@tool
async def hn_search(query: str) -> str:
    """Search Hacker News posts and comments via Algolia API. Use this to find developer sentiment, tech community discussions, and buzz about products or technologies."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                "https://hn.algolia.com/api/v1/search",
                params={"query": query, "tags": "story", "hitsPerPage": 10},
            )
            response.raise_for_status()
            data = response.json()

        hits = data.get("hits", [])
        if not hits:
            return "No Hacker News results found."

        results = []
        for hit in hits:
            title = hit.get("title", "No title")
            url = hit.get("url", "")
            points = hit.get("points", 0)
            num_comments = hit.get("num_comments", 0)
            author = hit.get("author", "")
            created = hit.get("created_at", "")
            hn_url = f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}"
            results.append(
                f"**{title}**\n"
                f"Points: {points} | Comments: {num_comments} | By: {author} | Date: {created}\n"
                f"URL: {url}\n"
                f"HN Discussion: {hn_url}\n"
            )

        return "\n---\n".join(results)
    except Exception as e:
        return f"Hacker News search error: {e}"


# ---------------------------------------------------------------------------
# 6. Hacker News Algolia — Comment Search (deeper sentiment)
# ---------------------------------------------------------------------------
@tool
async def hn_comment_search(query: str) -> str:
    """Search Hacker News comments via Algolia API. Use this to find what developers are saying in discussions about specific products, technologies, or market trends."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                "https://hn.algolia.com/api/v1/search",
                params={"query": query, "tags": "comment", "hitsPerPage": 10},
            )
            response.raise_for_status()
            data = response.json()

        hits = data.get("hits", [])
        if not hits:
            return "No Hacker News comments found."

        results = []
        for hit in hits:
            comment_text = hit.get("comment_text", "")
            if comment_text and len(comment_text) > 500:
                comment_text = comment_text[:500] + "..."
            author = hit.get("author", "")
            created = hit.get("created_at", "")
            story_title = hit.get("story_title", "")
            hn_url = f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}"
            results.append(
                f"**Re: {story_title}**\n"
                f"By: {author} | Date: {created}\n"
                f"Discussion: {hn_url}\n"
                f"{comment_text}\n"
            )

        return "\n---\n".join(results)
    except Exception as e:
        return f"HN comment search error: {e}"


# ---------------------------------------------------------------------------
# 7. Reddit Search (public JSON API — no auth required)
# ---------------------------------------------------------------------------
@tool
async def reddit_search(query: str) -> str:
    """Search Reddit posts and comments. Use this to find user sentiment, complaints, praise, and discussions about products or markets."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                "https://www.reddit.com/search.json",
                params={"q": query, "sort": "relevance", "limit": 10, "t": "year"},
                headers={
                    "User-Agent": "GrowthIntelligencePlatform/1.0 (research-tool)",
                },
            )
            response.raise_for_status()
            data = response.json()

        posts = data.get("data", {}).get("children", [])
        if not posts:
            return "No Reddit results found."

        results = []
        for post in posts:
            p = post.get("data", {})
            title = p.get("title", "No title")
            subreddit = p.get("subreddit", "")
            author = p.get("author", "")
            score = p.get("score", 0)
            num_comments = p.get("num_comments", 0)
            selftext = p.get("selftext", "")
            if len(selftext) > 400:
                selftext = selftext[:400] + "..."
            permalink = p.get("permalink", "")
            url = f"https://reddit.com{permalink}" if permalink else ""
            entry = (
                f"**r/{subreddit}: {title}**\n"
                f"Score: {score} | Comments: {num_comments} | By: u/{author}\n"
                f"URL: {url}\n"
            )
            if selftext:
                entry += f"{selftext}\n"
            results.append(entry)

        return "\n---\n".join(results)
    except Exception as e:
        return f"Reddit search error: {e}"


# ---------------------------------------------------------------------------
# 8. Google Ads Transparency Search (via Serper)
# ---------------------------------------------------------------------------
@tool
async def ad_transparency_search(query: str) -> str:
    """Search for competitor advertising and ad creatives via Google. Use this to find advertising strategies, messaging, positioning, and ad spend insights for competitors."""
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return "Error: SERPER_API_KEY not set"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={"q": f"{query} advertising campaigns ads messaging", "num": 10},
            )
            response.raise_for_status()
            data = response.json()

        results = []
        for item in data.get("organic", [])[:8]:
            results.append(
                f"**{item.get('title', '')}**\n"
                f"URL: {item.get('link', '')}\n"
                f"{item.get('snippet', '')}\n"
            )

        return "\n---\n".join(results) if results else "No ad intelligence results found."
    except Exception as e:
        return f"Ad transparency search error: {e}"


# ---------------------------------------------------------------------------
# 9. Mixpanel — Product Analytics Insights
# ---------------------------------------------------------------------------
@tool
async def mixpanel_insights(query: str) -> str:
    """Query Mixpanel for product usage analytics and user behavior insights. Use this to understand product adoption, engagement patterns, and feature usage trends."""
    project_token = os.getenv("MIXPANEL_PROJECT_TOKEN")
    api_secret = os.getenv("MIXPANEL_API_SECRET")
    if not project_token or not api_secret:
        return "Error: MIXPANEL_PROJECT_TOKEN or MIXPANEL_API_SECRET not set"

    try:
        import base64
        auth = base64.b64encode(f"{api_secret}:".encode()).decode()

        async with httpx.AsyncClient(timeout=30) as client:
            # Query top events as a proxy for product analytics
            response = await client.get(
                "https://mixpanel.com/api/2.0/events/top",
                params={"limit": 10},
                headers={
                    "Accept": "application/json",
                    "Authorization": f"Basic {auth}",
                },
            )
            response.raise_for_status()
            data = response.json()

        if not data:
            return "No Mixpanel data available."

        # Format top events
        results = [f"**Mixpanel Product Analytics for: {query}**\n"]
        events = data.get("events", data) if isinstance(data, dict) else data
        if isinstance(events, dict):
            for event_name, event_data in list(events.items())[:10]:
                results.append(f"- **{event_name}**: {json.dumps(event_data)[:200]}")
        elif isinstance(events, list):
            for event in events[:10]:
                results.append(f"- {json.dumps(event)[:200]}")

        return "\n".join(results) if len(results) > 1 else "No actionable Mixpanel data found."
    except Exception as e:
        return f"Mixpanel query error: {e}"


# ---------------------------------------------------------------------------
# 10. Amplitude — Product Analytics
# ---------------------------------------------------------------------------
@tool
async def amplitude_insights(query: str) -> str:
    """Query Amplitude for product analytics, user behavior data, and engagement metrics. Use this to find product-market fit signals and usage patterns."""
    api_key = os.getenv("AMPLITUDE_API_KEY")
    if not api_key:
        return "Error: AMPLITUDE_API_KEY not set"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Query active/new users as a proxy metric
            response = await client.get(
                "https://amplitude.com/api/2/events/segmentation",
                params={
                    "e": json.dumps({"event_type": "_active"}),
                    "start": "20250101",
                    "end": "20250315",
                },
                headers={
                    "Accept": "application/json",
                    "Authorization": f"Api-Key {api_key}",
                },
            )
            response.raise_for_status()
            data = response.json()

        if not data or not data.get("data"):
            return "No Amplitude analytics data available."

        results = [f"**Amplitude Analytics for: {query}**\n"]
        series = data.get("data", {}).get("series", [])
        for i, s in enumerate(series[:5]):
            label = data.get("data", {}).get("seriesLabels", [{}])[i] if i < len(data.get("data", {}).get("seriesLabels", [])) else {}
            results.append(f"- Series {i+1}: {json.dumps(s[:5])[:200]}...")

        return "\n".join(results) if len(results) > 1 else "No actionable Amplitude data found."
    except Exception as e:
        return f"Amplitude query error: {e}"


# ---------------------------------------------------------------------------
# Tool groups per agent domain
# ---------------------------------------------------------------------------
MARKET_TREND_TOOLS = [serper_search, newsdata_search, firecrawl_scrape, playwright_scrape]
COMPETITIVE_TOOLS = [serper_search, firecrawl_scrape, newsdata_search, playwright_scrape]
WIN_LOSS_TOOLS = [serper_search, hn_search, hn_comment_search, reddit_search, firecrawl_scrape, playwright_scrape]
PRICING_TOOLS = [serper_search, firecrawl_scrape, playwright_scrape]
POSITIONING_TOOLS = [serper_search, firecrawl_scrape, ad_transparency_search, hn_comment_search, playwright_scrape]
ADJACENT_MARKET_TOOLS = [serper_search, newsdata_search, hn_search, firecrawl_scrape, playwright_scrape, mixpanel_insights, amplitude_insights]
