import os

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


# ---------------------------------------------------------------------------
# 2. Firecrawl Web Scraper
# ---------------------------------------------------------------------------
@tool
async def firecrawl_scrape(url: str) -> str:
    """Scrape a webpage and return its content as markdown. Use this to get detailed information from specific URLs."""
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        return "Error: FIRECRAWL_API_KEY not set"

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


# ---------------------------------------------------------------------------
# 3. NewsData.io — Latest News Search
# ---------------------------------------------------------------------------
@tool
async def newsdata_search(query: str) -> str:
    """Search latest news articles using NewsData.io. Use this to find recent news, press releases, and media coverage about companies, markets, or trends."""
    api_key = os.getenv("NEWSDATA_API_KEY")
    if not api_key:
        return "Error: NEWSDATA_API_KEY not set"

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


# ---------------------------------------------------------------------------
# 4. Hacker News Algolia — Developer Sentiment
# ---------------------------------------------------------------------------
@tool
async def hn_search(query: str) -> str:
    """Search Hacker News posts and comments via Algolia API. Use this to find developer sentiment, tech community discussions, and buzz about products or technologies."""
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


# ---------------------------------------------------------------------------
# 5. Hacker News Algolia — Comment Search (deeper sentiment)
# ---------------------------------------------------------------------------
@tool
async def hn_comment_search(query: str) -> str:
    """Search Hacker News comments via Algolia API. Use this to find what developers are saying in discussions about specific products, technologies, or market trends."""
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


# ---------------------------------------------------------------------------
# 6. PushShift Reddit Comment Search
# ---------------------------------------------------------------------------
@tool
async def reddit_search(query: str) -> str:
    """Search Reddit comments via PushShift API. Use this to find user sentiment, complaints, praise, and discussions about products or markets."""
    api_key = os.getenv("PUSHSHIFT_API_KEY")
    if not api_key:
        return "Error: PUSHSHIFT_API_KEY not set"

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            "https://api.pushshift.io/reddit/comment/search",
            params={
                "q": query,
                "sort": "created_utc",
                "order": "desc",
                "limit": 10,
                "track_total_hits": "false",
            },
            headers={
                "accept": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
        )
        response.raise_for_status()
        data = response.json()

    comments = data.get("data", [])
    if not comments:
        return "No Reddit comments found."

    results = []
    for comment in comments:
        body = comment.get("body", "")
        if len(body) > 500:
            body = body[:500] + "..."
        subreddit = comment.get("subreddit", "")
        author = comment.get("author", "")
        permalink = comment.get("permalink", "")
        url = f"https://reddit.com{permalink}" if permalink else ""
        results.append(
            f"**r/{subreddit}** — u/{author}\n"
            f"URL: {url}\n"
            f"{body}\n"
        )

    return "\n---\n".join(results)


# ---------------------------------------------------------------------------
# 7. Meta Ad Library Search
# ---------------------------------------------------------------------------
@tool
async def meta_ad_search(query: str) -> str:
    """Search Meta Ad Library for competitor ads. Use this to find advertising creatives, messaging, and positioning from competitors on Facebook and Instagram."""
    api_key = os.getenv("META_AD_API_KEY")
    if not api_key:
        return "Error: META_AD_API_KEY not set"

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            "https://graph.facebook.com/v19.0/ads_archive",
            params={
                "access_token": api_key,
                "search_terms": query,
                "ad_reached_countries": '["US"]',
                "ad_type": "ALL",
                "limit": 10,
                "fields": "ad_creative_bodies,ad_creative_link_titles,ad_delivery_start_time,page_name,ad_snapshot_url",
            },
        )
        response.raise_for_status()
        data = response.json()

    ads = data.get("data", [])
    if not ads:
        return "No Meta ads found for this query."

    results = []
    for ad in ads:
        page_name = ad.get("page_name", "Unknown")
        bodies = ad.get("ad_creative_bodies", [])
        titles = ad.get("ad_creative_link_titles", [])
        start_date = ad.get("ad_delivery_start_time", "")
        snapshot_url = ad.get("ad_snapshot_url", "")
        body_text = bodies[0] if bodies else "No body text"
        title_text = titles[0] if titles else "No title"
        results.append(
            f"**{page_name}** — {title_text}\n"
            f"Started: {start_date}\n"
            f"Ad: {body_text}\n"
            f"Snapshot: {snapshot_url}\n"
        )

    return "\n---\n".join(results)


# ---------------------------------------------------------------------------
# Tool groups per agent domain
# ---------------------------------------------------------------------------
MARKET_TREND_TOOLS = [serper_search, newsdata_search, firecrawl_scrape]
COMPETITIVE_TOOLS = [serper_search, firecrawl_scrape, newsdata_search]
WIN_LOSS_TOOLS = [serper_search, hn_search, hn_comment_search, reddit_search, firecrawl_scrape]
PRICING_TOOLS = [serper_search, firecrawl_scrape]
POSITIONING_TOOLS = [serper_search, firecrawl_scrape, meta_ad_search, hn_comment_search]
ADJACENT_MARKET_TOOLS = [serper_search, newsdata_search, hn_search, firecrawl_scrape]
