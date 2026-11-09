from langchain.tools import tool
from bs4 import BeautifulSoup
from urllib.parse import urlsplit

import requests
from tavily import TavilyClient
import os
from dotenv import load_dotenv

load_dotenv()

tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))


def search_web(
    query: str,
    *,
    topic: str = "general",
    time_range: str | None = None,
) -> list[dict[str, str]]:
    search_options = {
        "query": query,
        "max_results": 5,
        "topic": topic,
    }
    if time_range is not None:
        search_options["time_range"] = time_range

    response = tavily.search(**search_options)
    return response["results"]


def _extract_page_text(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for element in soup(["script", "style", "noscript", "svg", "nav", "footer", "header", "aside", "form"]):
        element.decompose()

    content = soup.find("main") or soup.find("article") or soup.body or soup
    return " ".join(content.stripped_strings)


@tool
def web_search(query : str) -> str:
    """Search the web for recent and reliable information on a topic. Returns Titles, URLs and snippets."""
    results = search_web(query)

    out = []
    for r in results:
        out.append(
            f"Title: {r['title']}\nURL: {r['url']}\n"
            f"Published: {r.get('published_date', 'Unknown')}\n"
            f"Snippet: {r['content'][:500]}\n"
        )
    
    return "\n----\n".join(out)

@tool
def scrape_url(url: str) -> str:
    """Fetch readable page text with BeautifulSoup, falling back to Jina Reader when blocked."""
    parsed_url = urlsplit(url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        return "Error: URL must be an absolute HTTP or HTTPS URL."

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    direct_error = "The page returned no readable text."

    try:
        response = requests.get(url, headers=headers, timeout=12)
        response.raise_for_status()
        text = _extract_page_text(response.text)
        if text:
            return text[:2000]
    except requests.exceptions.RequestException as exc:
        direct_error = str(exc)

    try:
        jina_response = requests.get(
            f"https://r.jina.ai/{url}",
            headers=headers,
            timeout=15,
        )
        jina_response.raise_for_status()
        text = jina_response.text.strip()
        if text:
            return text[:2000]
        jina_error = "Jina Reader returned empty content."
    except requests.exceptions.RequestException as exc:
        jina_error = str(exc)

    return (
        "Scraping failed. "
        f"Direct request/BeautifulSoup: {direct_error}. "
        f"Jina Reader fallback: {jina_error}"
    )