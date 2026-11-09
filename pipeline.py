from agents import writer_chain, critic_chain
from tools import scrape_url, search_web

def run_research_pipeline(topic: str) -> dict:
    state = {}

    print("\n" + "="*50)
    print("Step 1 - Searching the web...")
    print("="*50)

    is_news_query = any(
        keyword in topic.lower()
        for keyword in ("latest", "news", "current", "today", "recent")
    )
    results = search_web(
        topic,
        topic="news" if is_news_query else "general",
        time_range="week" if is_news_query else None,
    )
    if not results:
        raise RuntimeError("Tavily search returned no results for this topic.")

    state["search_results"] = "\n----\n".join(
        (
            f"Title: {result['title']}\n"
            f"URL: {result['url']}\n"
            f"Published: {result.get('published_date', 'Unknown')}\n"
            f"Snippet: {result['content'][:500]}"
        )
        for result in results
    )
    print("\nSearch result:", state['search_results'])

    print("\n" + "="*50)
    print("Step 2 - Scraping the top search results...")
    print("="*50)

    scraped_pages = []
    for result in results[:3]:
        page_content = scrape_url.invoke({"url": result["url"]})
        scraped_pages.append(
            f"Title: {result['title']}\n"
            f"URL: {result['url']}\n"
            f"Content: {page_content}"
        )
    state["scraped_content"] = "\n\n----\n\n".join(scraped_pages)
    print("\nScraped content:\n", state['scraped_content'])

    print("\n" + "="*50)
    print("Step 3 - Writer is drafting the report...")
    print("="*50)

    research_combined = (
        f"SEARCH RESULTS:\n{state['search_results']}\n\n"
        f"DETAILED SCRAPED CONTENT:\n{state['scraped_content']}"
    )

    state["report"] = writer_chain.invoke({
        "topic": topic,
        "research": research_combined
    })
    print("\nFinal Report\n", state['report'])

    print("\n" + "="*50)
    print("Step 4 - Critic is reviewing the report...")
    print("="*50)

    state["feedback"] = critic_chain.invoke({
        "report": state['report']
    })
    print("\nCritic report\n", state['feedback'])

    return state

if __name__ == "__main__":
    topic_input = input("\nEnter a research topic: ")
    run_research_pipeline(topic_input)